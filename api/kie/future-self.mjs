import { isAuthorized, rejectUnauthorized } from '../_shared/auth.mjs'
import {
  analyzeGlowUpImage,
  extractGlowUpCoachingPlan,
  glowUpVisionEnabled,
  glowUpVisionRequired,
  normalizeGlowUpVisionAnalysis,
} from '../_shared/glow-up-vision.mjs'
import { validateImageBase64Length } from '../_shared/request-limits.mjs'
import { publishAlignedGlowUpResult } from '../_shared/glow-up-result-align.mjs'

/** Vercel maxDuration 300s — keep margin for JSON response + cold start tail. */
const FUTURE_SELF_BUDGET_MS = Number(process.env.FUTURE_SELF_FUNCTION_BUDGET_MS) || 290_000
const MARKS_QA_RESERVE_MS = Number(process.env.FUTURE_SELF_MARKS_QA_RESERVE_MS) || 8_000
const MARKS_RETRY_MIN_BUDGET_MS = Number(process.env.FUTURE_SELF_MARKS_RETRY_MIN_BUDGET_MS) || 28_000
const TWO_PASS_RESERVE_MS = Number(process.env.FUTURE_SELF_TWO_PASS_RESERVE_MS) || 40_000
const STEP_PIPELINE_MAX_STEP_MS = Number(process.env.FUTURE_SELF_STEP_PIPELINE_MAX_STEP_MS) || 55_000

function remainingFunctionBudgetMs(startedMs, reserveMs = 8_000) {
  return Math.max(0, FUTURE_SELF_BUDGET_MS - (Date.now() - startedMs) - reserveMs)
}

function visionFromClientBody(body) {
  const raw = body?.visionAnalysis ?? body?.vision_analysis
  if (!raw || typeof raw !== 'object') return null
  const analysis = normalizeGlowUpVisionAnalysis(raw.analysis ?? raw)
  if (!analysis) return null
  return {
    analysis,
    model: String(raw.model || 'client').trim() || 'client',
    error: null,
  }
}

/** Lazy-load heavy Fal/prompt modules so boot errors return JSON instead of FUNCTION_INVOCATION_FAILED. */
async function loadGlowUpModules() {
  const [fal, prompts] = await Promise.all([
    import('../_shared/fal.mjs'),
    import('../_shared/future-self-prompts.mjs'),
  ])
  return { ...fal, ...prompts }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!isAuthorized(req)) return rejectUnauthorized(res)

  const handlerStartedMs = Date.now()

  let glowUp
  try {
    glowUp = await loadGlowUpModules()
  } catch (err) {
    console.error('future-self module load failed', err)
    return res.status(500).json({
      error: 'glow_up_module_load_failed',
      message: String(err?.message || err),
    })
  }

  const {
    falApiKey,
    falSyncFutureSelfGlowUp,
    falGlowUpCreateWaitWithMarksGuard,
    glowUpTwoPassEnabled,
    glowUpStepPipelineEnabled,
    glowUpPipelineSteps,
    formatFalErrorMessage,
    futureSelfCombinedPrompt,
    glowUpPromptMeta,
  } = glowUp

  if (!falApiKey()) {
    return res.status(500).json({ error: 'server_misconfigured_missing_fal_key' })
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  const imageBase64 = String(body?.imageBase64 || body?.init_image || '').trim()
  const mode = body?.mode
  if (!imageBase64) {
    return res.status(400).json({ error: 'missing_image_base64' })
  }
  const sizeCheck = validateImageBase64Length(imageBase64)
  if (!sizeCheck.ok) {
    return res.status(sizeCheck.status).json({
      error: sizeCheck.error,
      message: sizeCheck.message,
    })
  }

  if (!futureSelfCombinedPrompt(mode)) {
    return res.status(503).json({
      error: 'missing_glow_up_prompt',
      detail:
        `Glow-up is disabled: no prompt for mode "${mode}" in api/_shared/future-self-prompts.mjs.`,
    })
  }

  try {
    const metrics = body?.metrics ?? null
    const faceProfile = body?.faceProfile ?? null

    /** Step 1 — Claude Vision (client pre-analysis preferred, else server-side). */
    let visionResult = visionFromClientBody(body)
    if (!visionResult?.analysis && glowUpVisionEnabled()) {
      visionResult = await analyzeGlowUpImage(imageBase64, mode)
    }

    if (glowUpVisionRequired() && !visionResult?.analysis) {
      return res.status(503).json({
        error: 'glow_up_vision_failed',
        message: 'Claude Vision could not analyze your photo before glow-up. Please retry with a clear front-facing selfie.',
        visionError: visionResult?.error ?? 'no_analysis',
        visionUsed: false,
      })
    }

    const taskOptions = {
      imageWidth: body?.imageWidth ?? body?.width,
      imageHeight: body?.imageHeight ?? body?.height,
      metrics,
      faceProfile,
      visionAnalysis: visionResult,
      skipVision: true,
    }
    const promptMeta = glowUpPromptMeta(mode, metrics, faceProfile, visionResult)
    const visionMeta = {
      visionUsed: Boolean(visionResult?.analysis),
      visionModel: visionResult?.model ?? null,
      visionKeywords: visionResult?.analysis?.personalizedKeywords ?? null,
      visionPriorityZones: visionResult?.analysis?.priorityZones ?? null,
      visionPersonalizedPrompt: Boolean(visionResult?.analysis?.personalizedEditPrompt),
      visionWaterRetention: visionResult?.analysis?.waterRetentionLevel ?? null,
      visionError: visionResult?.error ?? null,
      coaching: extractGlowUpCoachingPlan(visionResult?.analysis),
    }

    /** Sync skipped when vision, step pipeline, or two-pass chain is active. */
    const stepPipeline = glowUpStepPipelineEnabled()
    const stepCount = stepPipeline ? glowUpPipelineSteps().length : 0
    const twoPass = glowUpTwoPassEnabled()
    const syncEnabled = String(process.env.FUTURE_SELF_FAL_SYNC || '1').trim() !== '0'
      && !visionMeta.visionUsed
      && !twoPass
      && !stepPipeline

    if (syncEnabled) {
      try {
        const synced = await falSyncFutureSelfGlowUp(imageBase64, mode, taskOptions)
        if (synced?.resultUrls?.length) {
          const urls = synced.resultUrls
          let data = {
              taskId: null,
              state: 'success',
              resultUrls: urls,
              resultJson: JSON.stringify({ resultUrls: urls }),
              mode: mode || 'front',
              model: synced.model,
              provider: synced.provider,
              quality: synced.quality,
              imageSize: synced.imageSize,
              promptAdaptive: (synced.promptAdaptive ?? promptMeta.adaptive) || Boolean(faceProfile),
              compositionType: promptMeta.compositionType,
              glowUpTier: promptMeta.glowUpTier,
              deBloatTargetPct: promptMeta.deBloatTargetPct,
              visionUsed: synced.visionUsed ?? visionMeta.visionUsed,
              visionModel: synced.visionModel ?? visionMeta.visionModel,
              visionKeywords: synced.visionKeywords ?? visionMeta.visionKeywords,
              visionPriorityZones: synced.visionPriorityZones ?? visionMeta.visionPriorityZones,
              visionError: synced.visionError ?? visionMeta.visionError,
              coaching: visionMeta.coaching,
              promptStyle: synced.promptStyle || promptMeta.promptStyle,
              promptLength: synced.promptLength ?? null,
              limitGenerations: synced.limitGenerations ?? null,
              delivery: 'sync',
            }
          data = await attachAlignedResult(imageBase64, taskOptions, urls, data)
          return res.status(200).json({
            code: 200,
            msg: 'success',
            data,
          })
        }
      } catch (syncErr) {
        const syncStatus = syncErr?.status ?? syncErr?.detail?.status
        const transient = syncStatus === 408 || syncStatus === 429 || syncStatus === 502 || syncStatus === 503 || syncStatus === 504
        if (!transient) throw syncErr
      }
    }

    const reserveMs = MARKS_QA_RESERVE_MS + (twoPass ? TWO_PASS_RESERVE_MS : 0)
    const falBudgetMs = remainingFunctionBudgetMs(handlerStartedMs, reserveMs)
    const defaultWaitMs = visionMeta.visionUsed
      ? Number(process.env.FUTURE_SELF_FAL_CREATE_WAIT_MS_VISION) || 45_000
      : Number(process.env.FUTURE_SELF_FAL_CREATE_WAIT_MS) || 52_000
    const createWaitMs = stepPipeline
      ? Math.min(
        STEP_PIPELINE_MAX_STEP_MS,
        Math.max(28_000, Math.floor(falBudgetMs / Math.max(1, stepCount + 1))),
      )
      : twoPass
        ? Math.min(
          Number(process.env.FUTURE_SELF_GLOW_UP_PASS_WAIT_MS) || 36_000,
          Math.max(14_000, Math.floor(falBudgetMs / 2)),
        )
        : Math.min(defaultWaitMs, Math.max(12_000, falBudgetMs))

    const guarded = await falGlowUpCreateWaitWithMarksGuard(
      imageBase64,
      mode,
      taskOptions,
      createWaitMs,
      {
        allowMarksRetry: false,
        allowTwoPass: twoPass,
        allowStepPipeline: stepPipeline,
        skipMarksQaForPipeline: stepPipeline,
        handlerStartedMs,
        budgetMs: FUTURE_SELF_BUDGET_MS,
      },
    )
    const created = guarded.created
    const urls = guarded.urls || []
    if (urls.length) {
      let data = {
          taskId: created?.taskId ?? null,
          state: 'success',
          resultUrls: urls,
          resultJson: JSON.stringify({ resultUrls: urls }),
          statusUrl: created?.statusUrl ?? null,
          responseUrl: created?.responseUrl ?? null,
          mode: mode || 'front',
          model: created?.model ?? null,
          provider: created?.provider ?? null,
          quality: created?.quality ?? null,
          imageSize: created?.imageSize ?? null,
          promptAdaptive: (created?.promptAdaptive ?? promptMeta.adaptive) || Boolean(faceProfile),
          compositionType: created?.compositionType ?? promptMeta.compositionType,
          glowUpTier: created?.glowUpTier ?? promptMeta.glowUpTier,
          deBloatTargetPct: created?.deBloatTargetPct ?? promptMeta.deBloatTargetPct,
          visionUsed: created?.visionUsed ?? visionMeta.visionUsed,
          visionModel: created?.visionModel ?? visionMeta.visionModel,
          visionKeywords: created?.visionKeywords ?? visionMeta.visionKeywords,
          visionPriorityZones: created?.visionPriorityZones ?? visionMeta.visionPriorityZones,
          visionError: created?.visionError ?? visionMeta.visionError,
          coaching: visionMeta.coaching,
          promptStyle: created?.promptStyle || promptMeta.promptStyle,
          promptLength: created?.promptLength ?? null,
          limitGenerations: created?.limitGenerations ?? null,
          marksQaPassed: guarded.marksQa?.passed ?? null,
          marksRetry: guarded.marksRetry ?? false,
          secondPass: guarded.secondPass ?? false,
          deBloatRetry: guarded.deBloatRetry ?? false,
          stepPipeline: guarded.stepPipeline ?? null,
          delivery: 'create_wait',
        }
      data = await attachAlignedResult(imageBase64, taskOptions, urls, data)
      return res.status(200).json({
        code: 200,
        msg: 'success',
        data,
      })
    }

    if (!created?.taskId) {
      return res.status(504).json({
        error: 'glow_up_timeout',
        message: 'Glow-up timed out before tracking started. Please retry.',
      })
    }

    // Job still running on Fal — client polls with taskId (+ optional statusUrl).
    return res.status(200).json({
      code: 200,
      msg: 'success',
      data: {
        taskId: created.taskId,
        state: 'processing',
        statusUrl: created.statusUrl ?? null,
        responseUrl: created.responseUrl ?? null,
        mode: mode || 'front',
        model: created.model ?? null,
        provider: created.provider ?? null,
        quality: created.quality ?? null,
        imageSize: created.imageSize ?? null,
        promptAdaptive: (created.promptAdaptive ?? promptMeta.adaptive) || Boolean(faceProfile),
        compositionType: created.compositionType ?? promptMeta.compositionType,
        glowUpTier: created.glowUpTier ?? promptMeta.glowUpTier,
        deBloatTargetPct: created.deBloatTargetPct ?? promptMeta.deBloatTargetPct,
        visionUsed: created.visionUsed ?? visionMeta.visionUsed,
        visionModel: created.visionModel ?? visionMeta.visionModel,
        visionKeywords: created.visionKeywords ?? visionMeta.visionKeywords,
        visionPriorityZones: created.visionPriorityZones ?? visionMeta.visionPriorityZones,
        visionError: created.visionError ?? visionMeta.visionError,
        coaching: visionMeta.coaching,
        promptStyle: created.promptStyle || promptMeta.promptStyle,
        promptLength: created.promptLength ?? null,
        limitGenerations: created.limitGenerations ?? null,
        delivery: 'poll',
      },
    })
  } catch (err) {
    console.error('fal future-self', err?.detail || err)
    const falMessage =
      formatFalErrorMessage(err?.detail?.body)
      || formatFalErrorMessage(err?.detail)
      || (typeof err?.message === 'string' && err.message && err.message !== 'fal_submit_failed'
        ? err.message
        : null)
    return res.status(502).json({
      error: falMessage || String(err?.message || 'fal_future_self_failed'),
      message: falMessage || undefined,
      detail: err?.detail || null,
    })
  }
}

async function attachAlignedResult(imageBase64, taskOptions, urls, data) {
  if (!urls?.length) return data
  try {
    const published = await publishAlignedGlowUpResult(imageBase64, taskOptions, urls)
    if (!published?.urls?.length) return data
    const first = published.urls[0]
    if (!String(first).startsWith('http')) return data
    return {
      ...data,
      resultUrls: published.urls,
      resultJson: JSON.stringify({ resultUrls: published.urls }),
      resultWidth: published.resultWidth ?? data.resultWidth,
      resultHeight: published.resultHeight ?? data.resultHeight,
      resultAligned: Boolean(published.aligned),
    }
  } catch (err) {
    console.warn('attachAlignedResult failed', err?.message || err)
    return data
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
