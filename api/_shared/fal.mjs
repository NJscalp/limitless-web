import {
  buildGlowUpPrompt,
  getGlowUpDeBloatTargets,
  normalizeFutureSelfMode,
  toFalTaskId,
  glowUpPromptMeta,
  buildConciseHeadHairLine,
} from './future-self-prompts.mjs'
import { resolveFalGlowUpImageSize } from './image-dimensions.mjs'
import {
  closestNanoBananaAspectRatio,
  nanoBananaResolutionForInput,
  minResolutionTier,
  publishAlignedGlowUpResult,
} from './glow-up-result-align.mjs'
import { deriveGlowUpVisionFlags } from './glow-up-vision-utils.mjs'
import { analyzeGlowUpImage, glowUpVisionEnabled } from './glow-up-vision.mjs'
import {
  MARKS_RETRY_PROMPT_SUFFIX,
  MARKS_RETRY_SYSTEM_SUFFIX,
  validateGlowUpMarksQa,
  glowUpMarksQaEnabled,
} from './glow-up-marks-qa.mjs'
import {
  DEBLOAT_RETRY_PROMPT_SUFFIX,
  DEBLOAT_RETRY_SYSTEM_SUFFIX,
  SECOND_PASS_SYSTEM_SUFFIX,
  validateGlowUpDeBloatQa,
  glowUpDeBloatQaEnabled,
  fetchGlowUpOutputBase64,
} from './glow-up-debloat-qa.mjs'
import {
  glowUpStepPipelineEnabled,
  glowUpPipelineSteps,
  glowUpCheeksBoostEnabled,
  stepSystemSuffix,
} from './glow-up-steps.mjs'

const FAL_QUEUE_BASE = (process.env.FAL_QUEUE_BASE || 'https://queue.fal.run').replace(/\/$/, '')
const FAL_SYNC_BASE = (process.env.FAL_SYNC_BASE || 'https://fal.run').replace(/\/$/, '')

const NANO_BANANA2_DEFAULT = 'fal-ai/nano-banana-2/edit'
const GPT_IMAGE2_DEFAULT = 'openai/gpt-image-2/edit'

/** Fal glow-up edit model (default: Nano Banana 2). */
export function falGlowUpEditSubmitModel() {
  return (
    process.env.FAL_GLOW_UP_EDIT_MODEL
    || process.env.FAL_NANO_BANANA2_EDIT_MODEL
    || process.env.FAL_GPT_IMAGE2_EDIT_MODEL
    || NANO_BANANA2_DEFAULT
  ).trim()
}

/**
 * Queue status/result paths for sub-path models (…/edit) use the parent model id.
 * @see https://fal.ai/docs/documentation/model-apis/inference/queue
 */
export function falGlowUpEditQueueModel() {
  const submit = falGlowUpEditSubmitModel()
  if (submit.endsWith('/edit')) {
    return submit.slice(0, -'/edit'.length)
  }
  return submit
}

/** @deprecated alias */
export function falGptImage2EditSubmitModel() {
  return falGlowUpEditSubmitModel()
}

/** @deprecated alias */
export function falGptImage2QueueModel() {
  return falGlowUpEditQueueModel()
}

/** @deprecated alias */
export function falGptImage2EditModel() {
  return falGlowUpEditSubmitModel()
}

export function isNanoBananaEditModel(model = falGlowUpEditSubmitModel()) {
  return String(model || '').toLowerCase().includes('nano-banana')
}

/** Nano Banana 2: 0.5K | 1K | 2K | 4K. GPT Image 2 uses `quality` instead. */
export function falGlowUpResolution() {
  const raw = (process.env.FUTURE_SELF_FAL_RESOLUTION || '2K').trim()
  const allowed = new Set(['0.5K', '1K', '2K', '4K'])
  return allowed.has(raw) ? raw : '2K'
}

export function falGlowUpAspectRatio() {
  const raw = (process.env.FUTURE_SELF_FAL_ASPECT_RATIO || 'auto').trim()
  const allowed = new Set([
    'auto', '21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16', '4:1', '1:4', '8:1', '1:8',
  ])
  return allowed.has(raw) ? raw : 'auto'
}

export function falGlowUpOutputFormat() {
  const raw = (process.env.FUTURE_SELF_FAL_OUTPUT_FORMAT || 'jpeg').trim().toLowerCase()
  if (raw === 'jpeg' || raw === 'jpg') return 'jpeg'
  if (raw === 'png' || raw === 'webp') return raw
  return 'jpeg'
}

export function falGlowUpSafetyTolerance() {
  const n = Number(process.env.FUTURE_SELF_FAL_SAFETY_TOLERANCE ?? 6)
  if (Number.isFinite(n) && n >= 1 && n <= 6) return String(Math.round(n))
  return '6'
}

export function falGlowUpLimitGenerations() {
  const raw = String(process.env.FUTURE_SELF_FAL_LIMIT_GENERATIONS ?? '0').trim().toLowerCase()
  if (raw === '1' || raw === 'true' || raw === 'yes') return true
  return false
}

export function falGlowUpThinkingLevel() {
  const raw = String(process.env.FUTURE_SELF_FAL_THINKING_LEVEL ?? 'minimal').trim().toLowerCase()
  if (raw === 'minimal' || raw === 'high') return raw
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'none') return null
  return 'minimal'
}

/** GPT Image 2 only — ignored for Nano Banana 2 (use `falGlowUpResolution`). */
export function falGlowUpQuality() {
  const raw = (process.env.FUTURE_SELF_FAL_QUALITY || 'high').trim().toLowerCase()
  if (raw === 'low' || raw === 'medium' || raw === 'high') return raw
  return 'high'
}

/** Vercel env: `FAL_KEY` (recommended) or `FAL_API_KEY`. */
export function falApiKey() {
  return (process.env.FAL_KEY || process.env.FAL_API_KEY || '').trim()
}

function falAuthHeaders() {
  return {
    Authorization: `Key ${falApiKey()}`,
    'Content-Type': 'application/json',
  }
}

export async function falQueueFetch(modelPath, { method = 'GET', body } = {}) {
  const apiKey = falApiKey()
  if (!apiKey) throw new Error('missing_fal_key')

  const path = modelPath.startsWith('/') ? modelPath : `/${modelPath}`
  const response = await fetchWithTimeout(`${FAL_QUEUE_BASE}${path}`, {
    method,
    headers: falAuthHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  const data = await response.json().catch(() => ({}))
  return { response, data }
}

/** Poll using absolute URLs returned by Fal on submit (most reliable). */
export async function falFetchAbsolute(url, { method = 'GET', body } = {}) {
  const apiKey = falApiKey()
  if (!apiKey) throw new Error('missing_fal_key')
  const absolute = String(url || '').trim()
  if (!absolute.startsWith('http')) throw new Error('invalid_fal_url')

  const response = await fetchWithTimeout(absolute, {
    method,
    headers: falAuthHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

  const data = await response.json().catch(() => ({}))
  return { response, data }
}

export function base64ToDataUri(base64Raw, mime = 'image/jpeg') {
  const trimmed = String(base64Raw || '').trim()
  if (!trimmed) throw new Error('missing_image_base64')
  if (trimmed.startsWith('data:')) return trimmed
  return `data:${mime};base64,${trimmed}`
}

function modelSubmitPath(model = falGlowUpEditSubmitModel()) {
  return `/${model.replace(/^\/+/, '')}`
}

function modelQueuePath(model = falGlowUpEditQueueModel()) {
  return `/${model.replace(/^\/+/, '')}`
}

function falHttpError(code, detail, status) {
  const err = new Error(code)
  err.detail = detail
  err.status = status
  return err
}

function pickFalUrl(...candidates) {
  for (const raw of candidates) {
    const url = String(raw || '').trim()
    if (url.startsWith('http')) return url
  }
  return null
}

function isTransientFalHttpStatus(status) {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504
}

function processingFalEnvelope(requestId, status = 'IN_PROGRESS', extra = {}) {
  return {
    code: 200,
    msg: 'success',
    data: {
      taskId: toFalTaskId(requestId),
      state: 'processing',
      status,
      ...extra,
    },
  }
}

export function formatFalErrorMessage(detail) {
  if (!detail) return null
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === 'string') return item
        const field = Array.isArray(item?.loc) ? item.loc.filter((p) => p !== 'body').join('.') : ''
        const msg = item?.msg || item?.message
        if (!msg) return null
        return field ? `${field}: ${msg}` : msg
      })
      .filter(Boolean)
    return parts.length ? parts.join('; ') : null
  }
  if (typeof detail === 'object') {
    return (
      formatFalErrorMessage(detail.detail)
      || formatFalErrorMessage(detail.body?.detail)
      || detail.message
      || detail.msg
      || null
    )
  }
  return null
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const FAL_FETCH_TIMEOUT_MS = Number(process.env.FUTURE_SELF_FAL_FETCH_TIMEOUT_MS) || 18_000
const FAL_STATUS_CACHE_TTL_MS = Number(process.env.FUTURE_SELF_FAL_STATUS_CACHE_MS) || 2_500
const FAL_STATUS_CACHE_MAX = Number(process.env.FUTURE_SELF_FAL_STATUS_CACHE_MAX) || 2_000
const FAL_TASK_META_TTL_MS = Number(process.env.FUTURE_SELF_FAL_TASK_META_TTL_MS) || 45 * 60 * 1000

/** Short-lived cache so 100 concurrent app polls don't hammer Fal for the same task. */
const falStatusCache = new Map()

/** Stores Fal status/response URLs from job creation — avoids long query strings on poll. */
const falTaskMetaStore = new Map()

export function registerFalTaskMeta(created) {
  const id = String(created?.requestId || created?.taskId || '').replace(/^fal:/, '').trim()
  if (!id) return
  if (falTaskMetaStore.size >= FAL_STATUS_CACHE_MAX) {
    const oldest = falTaskMetaStore.keys().next().value
    if (oldest) falTaskMetaStore.delete(oldest)
  }
  falTaskMetaStore.set(id, {
    statusUrl: created.statusUrl || null,
    responseUrl: created.responseUrl || null,
    inputWidth: Number(created.inputWidth) > 0 ? Math.round(Number(created.inputWidth)) : null,
    inputHeight: Number(created.inputHeight) > 0 ? Math.round(Number(created.inputHeight)) : null,
    expiresAt: Date.now() + FAL_TASK_META_TTL_MS,
  })
}

function resolveFalTaskMetaInput(requestId) {
  const id = String(requestId || '').replace(/^fal:/, '').trim()
  const hit = id ? falTaskMetaStore.get(id) : null
  if (!hit || Date.now() > hit.expiresAt) return null
  return {
    inputWidth: hit.inputWidth ?? null,
    inputHeight: hit.inputHeight ?? null,
  }
}

function resolveFalTaskMeta(requestId, options = {}) {
  const id = String(requestId || '').replace(/^fal:/, '').trim()
  const hit = id ? falTaskMetaStore.get(id) : null
  const fresh = hit && Date.now() <= hit.expiresAt ? hit : null
  return {
    statusUrl: pickFalUrl(options.statusUrl, options.status_url, fresh?.statusUrl),
    responseUrl: pickFalUrl(options.responseUrl, options.response_url, fresh?.responseUrl),
  }
}

function falStatusCacheKey(requestId, statusUrl, responseUrl) {
  return `${String(requestId || '').trim()}|${String(statusUrl || '').trim()}|${String(responseUrl || '').trim()}`
}

function readFalStatusCache(key) {
  const hit = falStatusCache.get(key)
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    falStatusCache.delete(key)
    return null
  }
  return hit.envelope
}

function writeFalStatusCache(key, envelope) {
  if (!key || !envelope) return
  const state = String(envelope?.data?.state || '').toLowerCase()
  // Never cache in-progress — only final outcomes (avoids stale "still in queue").
  if (state !== 'success' && state !== 'fail' && state !== 'failed') return
  const ttl = Math.max(FAL_STATUS_CACHE_TTL_MS, 30_000)
  if (falStatusCache.size >= FAL_STATUS_CACHE_MAX) {
    const oldest = falStatusCache.keys().next().value
    if (oldest) falStatusCache.delete(oldest)
  }
  falStatusCache.set(key, { envelope, expiresAt: Date.now() + ttl })
}

function fetchWithTimeout(url, options = {}, timeoutMs = FAL_FETCH_TIMEOUT_MS) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    })
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(timer))
}

export function glowUpTwoPassEnabled() {
  if (glowUpStepPipelineEnabled()) return false
  const raw = String(process.env.FUTURE_SELF_GLOW_UP_TWO_PASS ?? '1').trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false
  return isNanoBananaEditModel(falGlowUpEditSubmitModel())
}

export { glowUpStepPipelineEnabled, glowUpPipelineSteps }

function resolveNanoBananaAspectRatio(options = {}) {
  const envRaw = String(process.env.FUTURE_SELF_FAL_ASPECT_RATIO || 'auto').trim()
  const allowed = new Set([
    'auto', '21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16', '4:1', '1:4', '8:1', '1:8',
  ])
  if (envRaw && envRaw !== 'auto' && allowed.has(envRaw)) return envRaw
  const w = Number(options.imageWidth)
  const h = Number(options.imageHeight)
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    return closestNanoBananaAspectRatio(w, h)
  }
  return 'auto'
}

function resolveNanoBananaResolution(options = {}) {
  const cap = falGlowUpResolution()
  const w = Number(options.imageWidth)
  const h = Number(options.imageHeight)
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    return minResolutionTier(nanoBananaResolutionForInput(w, h, cap), cap)
  }
  return cap
}

function capFalText(text, maxLen) {
  const s = String(text || '').trim()
  if (!s || s.length <= maxLen) return s
  return `${s.slice(0, maxLen - 1)}…`
}

function buildNanoBanana2Payload(prompt, imageDataUri, mode = 'front', visionResult = null, options = {}) {
  const glowUpStep = options.glowUpStep ? String(options.glowUpStep).trim().toLowerCase() : null
  const deBloatRetry = Boolean(options.deBloatRetry)
  const secondPass = Boolean(options.secondPass)
  const vision = visionResult?.analysis ?? visionResult
  const mergedVision = vision ? getGlowUpDeBloatTargets(mode, options.metrics, options.faceProfile, visionResult).vision : null

  let system
  if (glowUpStep) {
    system = `Expert realistic portrait retoucher — natural glow-up, same person.
⛔ Jaw/chin/cheekbone WIDTH unchanged — never reshape bones or razor-sharpen mandible.
⛔ HEAD HAIR FROZEN: copy exact scalp hair color, length, style, texture, volume, and hairline from input — no restyle or recolor.
${stepSystemSuffix(glowUpStep)}
Balanced edit across face zones — avoid uncanny lower-face-only sculpt while mid-face/under-eyes stay puffy.
Must look like a real photo, not CGI or surgery.`
    if (mergedVision || vision) {
      system += visionMarksSystemLock(mergedVision || vision)
    }
  } else {
    system = glowUpSystemPrompt(mode)
    system += `\n\n⛔ BONE FREEZE: mandible/chin/cheekbone width = input exactly — never reshape jaw or chin bone.`
    system += `\n⛔ HEAD HAIR FROZEN: copy exact scalp hair color, length, style, texture, volume, and hairline from input — no restyle, trim, or recolor.`
    if (secondPass) {
      system += `\nCHEEK-ONLY PASS: input may already have jaw/under-eye definition — push buccal cheek + mid-face slimming ONLY. Cheeks must look significantly narrower than THIS input. Do NOT only edit jaw.`
    } else {
      system += `\nDE-BLOAT PRIMARY: buccal cheeks + mid-face MUST look DRAMATICALLY SLIMMER vs input (most visible change). Maximum under-eye de-puff. FORBIDDEN: subtle/nearly-identical edit; jaw-only edit while cheeks stay puffy; face swap.`
      system += `\nVISIBILITY: before/after must be UNMISTAKABLE — same identity, maximum glow-up. If cheeks unchanged → FAILED.`
    }
    system += `\nSKIN: fade active acne/redness; never add moles/Muttermale; keep pores + undertone.`
    if (deBloatRetry) system += DEBLOAT_RETRY_SYSTEM_SUFFIX
    if (secondPass) system += SECOND_PASS_SYSTEM_SUFFIX
    if (mergedVision) {
      system += visionMarksSystemLock(mergedVision)
      if (mergedVision.realisticGoal) {
        system += `\nTarget look: ${mergedVision.realisticGoal}`
      }
      const avoid = [...(mergedVision.unrealisticAvoid || [])]
      const { hasInputMoles } = deriveGlowUpVisionFlags(mergedVision)
      if (!hasInputMoles && !avoid.some((a) => /mole|muttermal/i.test(String(a)))) {
        avoid.unshift('add moles/Muttermale/beauty marks/pigment spots')
      }
      if (!avoid.some((a) => /jaw|mandible|chin bone|bone sculpt/i.test(String(a)))) {
        avoid.unshift('reshape/sharpen/extend jaw or chin bone')
      }
      if (!avoid.some((a) => /face swap|different person/i.test(String(a)))) {
        avoid.unshift('face swap or different person look')
      }
      if (!avoid.some((a) => /hair|hairline|hairstyle/i.test(String(a)))) {
        avoid.unshift('change head hair color/style/length/hairline/volume')
      }
      if (avoid.length) system += `\nAvoid: ${avoid.slice(0, 5).join('; ')}.`
      system += `\n${buildConciseHeadHairLine(mergedVision || vision)}`
      if (mergedVision.priorityZones?.length) {
        system += `\nPriority zones (cheeks first): ${mergedVision.priorityZones.join(', ')}.`
      } else {
        system += `\nPriority zones: buccal cheeks, mid-face, cheek fat pads, under-eye bags.`
      }
    }
  }

  const payload = {
    prompt: capFalText(prompt, 2800),
    image_urls: [imageDataUri],
    num_images: 1,
    aspect_ratio: resolveNanoBananaAspectRatio(options),
    output_format: falGlowUpOutputFormat(),
    resolution: options.falResolutionOverride || resolveNanoBananaResolution(options),
    safety_tolerance: falGlowUpSafetyTolerance(),
    limit_generations: true,
    system_prompt: capFalText(system, 2800),
  }

  const thinking = falGlowUpThinkingLevel()
  if (thinking) payload.thinking_level = thinking

  return payload
}

function glowUpSystemPrompt(mode = 'front') {
  const custom = String(process.env.FUTURE_SELF_FAL_SYSTEM_PROMPT || '').trim()
  if (custom) return custom
  const key = String(mode || 'front').trim().toLowerCase()
  if (key === 'side' || key === 'side_profile' || key === 'sideprofile') {
    return SIDE_GLOW_UP_SYSTEM_PROMPT
  }
  return DEFAULT_GLOW_UP_SYSTEM_PROMPT
}

function visionMarksSystemLock(vision) {
  const marks = vision?.skinMarks
  const hasMoles = Boolean(marks?.hasMoles) && (marks?.moleCount ?? 0) > 0
  if (hasMoles) {
    const n = marks.moleCount || 'visible'
    return `\nMARKS CRITICAL: input has ${n} mole(s)/Muttermale — preserve EXACT count, size, color, position. Never add or remove while cleaning skin.`
  }
  if (marks?.hasFreckles) {
    return '\nMARKS CRITICAL: input has freckles only — preserve exact freckle positions. ZERO new moles/Muttermale/beauty marks in output.'
  }
  return '\nMARKS CRITICAL: Vision confirmed ZERO moles/Muttermale/freckles in input — output MUST have ZERO moles/Muttermale/beauty marks. Skin cleanup must NOT add brown/dark pigment spots. Any invented mark = failed edit.'
}

const DEFAULT_GLOW_UP_SYSTEM_PROMPT = `Expert realistic portrait retoucher — MAXIMUM VISIBLE glow-up of THIS input face ONLY. NO reference template. ZERO bone change. SAME PERSON always.

⛔ NO FACE SWAP: never copy an external ideal or make a different person.
⛔ HEAD HAIR FROZEN: scalp hair, hairline, temples = pixel-copy from input.

Simulate 12–16 weeks aggressive fat loss + skincare: DRAMATICALLY leaner cheeks, hollower mid-face soft tissue, strongly rested open eyes, much cleaner skin (same skin color).

⛔ BONE FREEZE: mandible, chin, cheekbone width = PIXEL-IDENTICAL to input.

#1 LEANER CHEEKS + MID-FACE (PRIMARY — MUST CHANGE): aggressively strip buccal soft fat — face reads NOTICEABLY thinner. Same bones.

#2 EYES: maximum under-eye de-bloat — clearly open rested look; same eye shape; hunter-eye from de-bloat only.

#3 SKIN: strongly fade ALL active acne/redness; EXACT same undertone. NEVER add moles.

FAILED if before/after cheeks look similar. Before/after must be UNMISTAKABLE — still THIS person.`

const SIDE_GLOW_UP_SYSTEM_PROMPT = `Expert realistic side-profile retoucher — STRONG visible glow-up.

RULE #1 — ZERO INVENTION: NEVER add moles, Muttermale, freckles, beauty marks, stubble, or bone mass not in input. NEVER sharpen/extend mandible/chin bone.
⛔ HEAD HAIR FROZEN: copy exact scalp hair from input — no restyle, recolor, or length change.

Believable profile refresh: STRONGLY fade active blemishes on cheek/jaw; aggressive soft-tissue de-puff if puffy — mandible/chin BONE pixel-identical. Clear jaw-neck definition via fat/water removal only. Skin clearly cleaner — same undertone.`

function buildGptImage2Payload(prompt, imageDataUri, imageBase64, options) {
  const imageSize = resolveFalGlowUpImageSize(imageBase64, {
    imageWidth: options.imageWidth,
    imageHeight: options.imageHeight,
  })

  return {
    payload: {
      prompt,
      image_urls: [imageDataUri],
      image_size: imageSize,
      quality: falGlowUpQuality(),
      num_images: 1,
      output_format: falGlowUpOutputFormat(),
      background: process.env.FUTURE_SELF_FAL_BACKGROUND || 'opaque',
    },
    imageSize,
  }
}

async function resolveGlowUpVisionForPayload(imageBase64, mode, options = {}) {
  if (options.visionAnalysis !== undefined) {
    return options.visionAnalysis
  }
  if (options.skipVision) return null
  return analyzeGlowUpImage(imageBase64, mode)
}

function buildFutureSelfPayload(imageBase64, mode, options = {}) {
  const imageDataUri = base64ToDataUri(imageBase64)
  const key = normalizeFutureSelfMode(mode)
  const promptStyle = isNanoBananaEditModel(falGlowUpEditSubmitModel()) ? 'concise' : 'hybrid'
  const visionResult = options.visionAnalysis ?? null
  const visionAnalysis = visionResult?.analysis ?? null
  let prompt = buildGlowUpPrompt(key, options.metrics, options.faceProfile, promptStyle, visionResult, {
    deBloatRetry: options.deBloatRetry,
    secondPass: options.secondPass,
    glowUpStep: options.glowUpStep,
    stepIndex: options.stepIndex,
    stepTotal: options.stepTotal,
  })
  if (options.marksRetry) {
    prompt += MARKS_RETRY_PROMPT_SUFFIX
  }
  if (options.deBloatRetry) {
    prompt += DEBLOAT_RETRY_PROMPT_SUFFIX
  }
  const promptMeta = glowUpPromptMeta(key, options.metrics, options.faceProfile, visionResult)
  const submitModel = falGlowUpEditSubmitModel()

  if (isNanoBananaEditModel(submitModel)) {
    const payload = buildNanoBanana2Payload(prompt, imageDataUri, key, visionResult, {
      metrics: options.metrics,
      faceProfile: options.faceProfile,
      deBloatRetry: options.deBloatRetry,
      secondPass: options.secondPass,
      glowUpStep: options.glowUpStep,
      imageWidth: options.imageWidth,
      imageHeight: options.imageHeight,
    })
    if (options.marksRetry) {
      payload.system_prompt += MARKS_RETRY_SYSTEM_SUFFIX
    }
    return {
      payload,
      imageSize: {
        aspect_ratio: payload.aspect_ratio,
        resolution: payload.resolution,
      },
      mode: key,
      promptAdaptive: Boolean(options.metrics || options.faceProfile || visionAnalysis),
      compositionAdaptive: Boolean(options.metrics || options.faceProfile),
      visionUsed: Boolean(visionAnalysis),
      visionModel: visionResult?.model ?? null,
      visionKeywords: visionAnalysis?.personalizedKeywords ?? null,
      visionPriorityZones: visionAnalysis?.priorityZones ?? null,
      visionError: visionResult?.error ?? null,
      modelFamily: 'nano-banana-2',
      promptStyle,
      promptLength: prompt.length,
      glowUpTier: promptMeta.glowUpTier,
      deBloatTargetPct: promptMeta.deBloatTargetPct,
      compositionType: promptMeta.compositionType,
    }
  }

  const { payload, imageSize } = buildGptImage2Payload(prompt, imageDataUri, imageBase64, options)
  return {
    payload,
    imageSize,
    mode: key,
    promptAdaptive: Boolean(options.metrics || options.faceProfile || visionAnalysis),
    compositionAdaptive: Boolean(options.metrics || options.faceProfile),
    visionUsed: Boolean(visionAnalysis),
    visionModel: visionResult?.model ?? null,
    visionKeywords: visionAnalysis?.personalizedKeywords ?? null,
    visionPriorityZones: visionAnalysis?.priorityZones ?? null,
    visionError: visionResult?.error ?? null,
    modelFamily: 'gpt-image-2',
    promptStyle: 'hybrid',
    promptLength: prompt.length,
    glowUpTier: promptMeta.glowUpTier,
    deBloatTargetPct: promptMeta.deBloatTargetPct,
    compositionType: promptMeta.compositionType,
  }
}

async function buildFutureSelfPayloadAsync(imageBase64, mode, options = {}) {
  const visionAnalysis = await resolveGlowUpVisionForPayload(imageBase64, mode, options)
  return buildFutureSelfPayload(imageBase64, mode, {
    ...options,
    visionAnalysis,
  })
}

function glowUpQualityMeta(modelFamily) {
  if (modelFamily === 'nano-banana-2') return falGlowUpResolution()
  return falGlowUpQuality()
}

/** Submit Future Self glow-up to Fal queue (Nano Banana 2 edit by default). */
export async function falCreateFutureSelfTask(imageBase64, mode = 'front', options = {}) {
  const submitModel = falGlowUpEditSubmitModel()
  let built = await buildFutureSelfPayloadAsync(imageBase64, mode, options)
  let { payload, imageSize, modelFamily } = built

  let { response, data } = await falQueueFetch(modelSubmitPath(submitModel), {
    method: 'POST',
    body: payload,
  })

  if (!response.ok) {
    const msg = formatFalErrorMessage(data) || 'fal_submit_failed'
    const retryable = response.status === 422 || response.status === 400 || response.status === 413
    if (retryable && !options.falResolutionOverride) {
      console.warn('fal submit retry 0.5K', { status: response.status, msg })
      built = await buildFutureSelfPayloadAsync(imageBase64, mode, {
        ...options,
        falResolutionOverride: '0.5K',
      })
      payload = built.payload
      imageSize = built.imageSize
      modelFamily = built.modelFamily
      ;({ response, data } = await falQueueFetch(modelSubmitPath(submitModel), {
        method: 'POST',
        body: payload,
      }))
    }
  }

  if (!response.ok) {
    const msg = formatFalErrorMessage(data) || 'fal_submit_failed'
    throw falHttpError(msg, data, response.status)
  }

  const requestId = data?.request_id
  if (!requestId) {
    throw falHttpError('fal_missing_request_id', data, response.status)
  }

  const created = {
    taskId: toFalTaskId(requestId),
    requestId: String(requestId),
    statusUrl: pickFalUrl(data?.status_url),
    responseUrl: pickFalUrl(data?.response_url),
    model: submitModel,
    provider: 'fal',
    imageSize,
    quality: glowUpQualityMeta(modelFamily),
    modelFamily,
    promptStyle: built.promptStyle,
    promptLength: built.promptLength,
    limitGenerations: payload.limit_generations,
    glowUpTier: built.glowUpTier,
    deBloatTargetPct: built.deBloatTargetPct,
    compositionType: built.compositionType,
    promptAdaptive: built.promptAdaptive,
    visionUsed: built.visionUsed ?? false,
    visionModel: built.visionModel ?? null,
    visionKeywords: built.visionKeywords ?? null,
    visionPriorityZones: built.visionPriorityZones ?? null,
    visionError: built.visionError ?? null,
  }
  registerFalTaskMeta({
    ...created,
    inputWidth: options.imageWidth,
    inputHeight: options.imageHeight,
  })
  return created
}

/**
 * Direct Fal sync endpoint (no queue status polling) — often fastest path.
 * Returns null on transient failure so caller can fall back to queue submit.
 */
export async function falSyncFutureSelfGlowUp(imageBase64, mode = 'front', options = {}) {
  const submitModel = falGlowUpEditSubmitModel()
  const built = await buildFutureSelfPayloadAsync(imageBase64, mode, options)
  const timeoutMs = Number(process.env.FUTURE_SELF_FAL_SYNC_TIMEOUT_MS) || 50_000
  const syncUrl = `${FAL_SYNC_BASE}${modelSubmitPath(submitModel)}`

  const syncResponse = await fetchWithTimeout(syncUrl, {
    method: 'POST',
    headers: falAuthHeaders(),
    body: JSON.stringify(built.payload),
  }, timeoutMs)
  const syncData = await syncResponse.json().catch(() => ({}))

  if (syncResponse.ok) {
    const urls = extractImageUrls(syncData)
    if (urls.length) {
      return {
        resultUrls: urls,
        model: submitModel,
        provider: 'fal',
        imageSize: built.imageSize,
        quality: glowUpQualityMeta(built.modelFamily),
        modelFamily: built.modelFamily,
        promptStyle: built.promptStyle,
        promptLength: built.promptLength,
        limitGenerations: built.payload?.limit_generations ?? null,
        glowUpTier: built.glowUpTier,
        deBloatTargetPct: built.deBloatTargetPct,
        compositionType: built.compositionType,
        promptAdaptive: built.promptAdaptive,
        visionUsed: built.visionUsed ?? false,
        visionModel: built.visionModel ?? null,
        visionKeywords: built.visionKeywords ?? null,
        visionPriorityZones: built.visionPriorityZones ?? null,
        visionError: built.visionError ?? null,
        delivery: 'sync',
      }
    }
  }

  if (!isTransientFalHttpStatus(syncResponse.status)) {
    const msg = formatFalErrorMessage(syncData) || 'fal_sync_failed'
    throw falHttpError(msg, syncData, syncResponse.status)
  }

  return null
}

/** @deprecated use registerFalTaskMeta via falCreateFutureSelfTask */
export function rememberFalTask(created) {
  registerFalTaskMeta(created)
  return created
}

/**
 * Submit once, wait on the server — app gets the finished image in one HTTP response.
 * Avoids dozens of App ↔ Vercel poll round-trips.
 */
export async function falCreateAndWaitFutureSelf(imageBase64, mode = 'front', options = {}) {
  const waitBudgetMs = Number(process.env.FUTURE_SELF_FAL_WAIT_MS) || 52_000
  const useSync = String(process.env.FUTURE_SELF_FAL_SYNC || '1').trim() !== '0'

  if (useSync) {
    const submitModel = falGlowUpEditSubmitModel()
    const built = await buildFutureSelfPayloadAsync(imageBase64, mode, options)
    const syncResponse = await fetch(`${FAL_SYNC_BASE}${modelSubmitPath(submitModel)}`, {
      method: 'POST',
      headers: falAuthHeaders(),
      body: JSON.stringify(built.payload),
      signal: AbortSignal.timeout(Math.min(waitBudgetMs, 55_000)),
    })
    const syncData = await syncResponse.json().catch(() => ({}))
    if (syncResponse.ok) {
      const urls = extractImageUrls(syncData)
      if (urls.length) {
        return {
          taskId: null,
          state: 'success',
          resultUrls: urls,
          model: submitModel,
          provider: 'fal',
          imageSize: built.imageSize,
          quality: glowUpQualityMeta(built.modelFamily),
          modelFamily: built.modelFamily,
          delivery: 'sync',
        }
      }
    }
    if (!isTransientFalHttpStatus(syncResponse.status)) {
      const msg = formatFalErrorMessage(syncData) || 'fal_sync_failed'
      throw falHttpError(msg, syncData, syncResponse.status)
    }
  }

  const created = await falCreateFutureSelfTask(imageBase64, mode, options)
  rememberFalTask(created)
  const envelope = await falWaitForTaskResult(created, { maxMs: waitBudgetMs, pollMs: 400 })
  const urls = envelope?.data?.resultUrls || []
  if (!urls.length) {
    throw falHttpError(envelope?.data?.failMsg || 'no_result_image', envelope, 502)
  }

  return {
    taskId: created.taskId,
    state: 'success',
    resultUrls: urls,
    model: created.model,
    provider: created.provider,
    imageSize: created.imageSize,
    quality: created.quality,
    modelFamily: created.modelFamily,
    delivery: 'queue',
  }
}

/** Poll Fal queue on the server until success/fail/timeout. */
export async function falWaitForTaskResult(created, { maxMs = 52_000, pollMs = 400 } = {}) {
  const requestId = String(created?.requestId || '').replace(/^fal:/, '')
  if (!requestId) throw new Error('missing_fal_request_id')

  const started = Date.now()
  while (Date.now() - started < maxMs) {
    const envelope = await falTaskEnvelopeForClient(requestId, {
      statusUrl: created.statusUrl,
      responseUrl: created.responseUrl,
    })
    const state = String(envelope?.data?.state || '').toLowerCase()
    if (state === 'success') return envelope
    if (state === 'fail' || state === 'failed') {
      throw falHttpError(
        envelope?.data?.failMsg || 'fal_generation_failed',
        envelope,
        502
      )
    }
    await sleep(pollMs)
  }

  throw falHttpError('fal_wait_timeout', { requestId, maxMs }, 504)
}

/**
 * Create + wait for glow-up — optional two-pass de-bloat chain + marks QA.
 * @returns {{ urls: string[], created: object, marksQa: object|null, marksRetry: boolean, deBloatQa: object|null, deBloatRetry: boolean, secondPass: boolean }}
 */
function isFalWaitTimeoutError(err) {
  const msg = String(err?.message || '')
  return msg === 'fal_wait_timeout' || msg.includes('timeout')
}

/** Run face → skin (etc.) as separate chained Fal edits with dynamic time budget. */
async function runGlowUpStepPipeline(imageBase64, mode, options, waitMs, steps, budgetContext = {}) {
  const { handlerStartedMs, budgetMs } = budgetContext
  let currentBase64 = imageBase64
  let activeCreated = null
  let urls = []
  const completedSteps = []
  const total = steps.length
  let preSkinBase64 = null

  const stepWaitMs = (index) => {
    if (handlerStartedMs && budgetMs) {
      const elapsed = Date.now() - handlerStartedMs
      const left = budgetMs - elapsed - 8_000
      const stepsLeft = total - index
      if (left < 12_000) return Math.max(12_000, left)
      return Math.min(waitMs, Math.max(18_000, Math.floor(left / stepsLeft)))
    }
    return waitMs
  }

  for (let i = 0; i < total; i += 1) {
    const step = steps[i]
    if (step === 'skin') preSkinBase64 = currentBase64
    const maxMs = stepWaitMs(i)
    console.log(`glow-up pipeline step ${i + 1}/${total}: ${step} (wait ${maxMs}ms)`)
    const created = await falCreateFutureSelfTask(currentBase64, mode, {
      ...options,
      glowUpStep: step,
      stepIndex: i + 1,
      stepTotal: total,
      secondPass: false,
      deBloatRetry: false,
    })
    let envelope
    try {
      envelope = await falWaitForTaskResult(created, { maxMs, pollMs: 400 })
    } catch (err) {
      console.warn(`glow-up step ${step} failed`, err?.message || err)
      if (!urls.length) throw err
      break
    }
    const stepUrls = envelope?.data?.resultUrls || []
    if (!stepUrls.length) break

    urls = stepUrls
    activeCreated = created
    completedSteps.push(step)

    if (i < total - 1) {
      const nextBase64 = await fetchGlowUpOutputBase64(stepUrls[0])
      if (!nextBase64) break
      currentBase64 = nextBase64
    }
  }

  if (glowUpCheeksBoostEnabled() && urls.length && completedSteps.includes('skin')) {
    const elapsed = handlerStartedMs ? Date.now() - handlerStartedMs : 0
    const left = budgetMs ? budgetMs - elapsed - 8_000 : 0
    if (left > 22_000) {
      const boostWait = Math.min(waitMs, Math.max(22_000, left - 4_000))
      console.log(`glow-up pipeline cheeks boost (wait ${boostWait}ms)`)
      try {
        const boostCreated = await falCreateFutureSelfTask(currentBase64, mode, {
          ...options,
          glowUpStep: 'cheeks_boost',
          stepIndex: total + 1,
          stepTotal: total + 1,
        })
        const boostEnvelope = await falWaitForTaskResult(boostCreated, {
          maxMs: boostWait,
          pollMs: 400,
        })
        const boostUrls = boostEnvelope?.data?.resultUrls || []
        if (boostUrls.length) {
          urls = boostUrls
          activeCreated = boostCreated
          completedSteps.push('cheeks_boost')
        }
      } catch (boostErr) {
        console.warn('glow-up cheeks boost skipped', boostErr?.message || boostErr)
      }
    }
  }

  return { urls, created: activeCreated, completedSteps, preSkinBase64 }
}

export async function falGlowUpCreateWaitWithMarksGuard(
  imageBase64,
  mode,
  options = {},
  waitMs = 45_000,
  guardOptions = {},
) {
  const allowDeBloatRetry = guardOptions.allowDeBloatRetry !== false
  const allowMarksRetry = guardOptions.allowMarksRetry !== false
  const allowTwoPass = guardOptions.allowTwoPass !== false && glowUpTwoPassEnabled()
  const steps = guardOptions.allowStepPipeline !== false && glowUpStepPipelineEnabled()
    ? glowUpPipelineSteps()
    : null

  let urls = []
  let activeCreated = null
  let marksQa = null
  let marksRetry = false
  let deBloatQa = null
  let deBloatRetry = false
  let secondPass = false
  let stepPipeline = null
  let preSkinBase64 = null

  if (steps?.length) {
    try {
      const piped = await runGlowUpStepPipeline(imageBase64, mode, options, waitMs, steps, {
        handlerStartedMs: guardOptions.handlerStartedMs,
        budgetMs: guardOptions.budgetMs,
      })
      urls = piped.urls
      activeCreated = piped.created
      stepPipeline = piped.completedSteps
      preSkinBase64 = piped.preSkinBase64 ?? null
    } catch (err) {
      if (isFalWaitTimeoutError(err)) {
        return { urls: [], created: null, marksQa: null, marksRetry: false, deBloatQa: null, deBloatRetry: false, secondPass: false, stepPipeline: null, timedOut: true }
      }
      throw err
    }
  } else {
  const created = await falCreateFutureSelfTask(imageBase64, mode, options)
  let envelope
  try {
    envelope = await falWaitForTaskResult(created, { maxMs: waitMs, pollMs: 400 })
  } catch (err) {
    if (isFalWaitTimeoutError(err)) {
      return { urls: [], created, marksQa: null, marksRetry: false, deBloatQa: null, deBloatRetry: false, secondPass: false, stepPipeline: null, timedOut: true }
    }
    throw err
  }
  urls = envelope?.data?.resultUrls || []
  activeCreated = created

  if (urls.length && allowTwoPass) {
    const pass1Base64 = await fetchGlowUpOutputBase64(urls[0])
    if (pass1Base64) {
      const pass2WaitMs = Math.min(
        Number(process.env.FUTURE_SELF_GLOW_UP_SECOND_PASS_WAIT_MS) || waitMs,
        waitMs,
      )
      console.log('glow-up second pass — chaining de-bloat on pass-1 output')
      try {
        const pass2Created = await falCreateFutureSelfTask(pass1Base64, mode, {
          ...options,
          secondPass: true,
        })
        const pass2Envelope = await falWaitForTaskResult(pass2Created, {
          maxMs: pass2WaitMs,
          pollMs: 400,
        })
        const pass2Urls = pass2Envelope?.data?.resultUrls || []
        if (pass2Urls.length) {
          urls = pass2Urls
          activeCreated = pass2Created
          secondPass = true
        }
      } catch (pass2Err) {
        console.warn('glow-up second pass failed — using pass-1', pass2Err?.message || pass2Err)
      }
    }
  }
  }

  if (!stepPipeline && urls.length && glowUpDeBloatQaEnabled() && allowDeBloatRetry) {
    deBloatQa = await validateGlowUpDeBloatQa(imageBase64, urls[0])
    if (deBloatQa.passed === false) {
      const boostSource = secondPass ? await fetchGlowUpOutputBase64(urls[0]) : imageBase64
      const retryWaitMs = Math.min(
        Number(process.env.FUTURE_SELF_GLOW_UP_DEBLOAT_RETRY_WAIT_MS) || 42_000,
        waitMs,
      )
      console.warn('glow-up debloat qa failed — retrying', { secondPass, ...deBloatQa })
      try {
        const retryCreated = await falCreateFutureSelfTask(boostSource || imageBase64, mode, {
          ...options,
          deBloatRetry: true,
          secondPass: Boolean(secondPass && boostSource),
        })
        const retryEnvelope = await falWaitForTaskResult(retryCreated, {
          maxMs: retryWaitMs,
          pollMs: 400,
        })
        const retryUrls = retryEnvelope?.data?.resultUrls || []
        if (retryUrls.length) {
          urls = retryUrls
          activeCreated = retryCreated
          deBloatRetry = true
        }
      } catch (retryErr) {
        console.warn('glow-up debloat retry failed', retryErr?.message || retryErr)
      }
    }
  }

  const vision = options.visionAnalysis?.analysis
  const skipMarksQa = Boolean(stepPipeline?.length && guardOptions.skipMarksQaForPipeline)
  if (urls.length && vision && glowUpMarksQaEnabled() && !skipMarksQa) {
    marksQa = await validateGlowUpMarksQa(imageBase64, urls[0], vision)
    if (
      allowMarksRetry
      && marksQa.passed === false
      && (marksQa.inventedMoles || marksQa.inventedFreckles)
    ) {
      const retryWaitMs = Math.min(
        Number(process.env.FUTURE_SELF_GLOW_UP_MARKS_RETRY_WAIT_MS) || 38_000,
        waitMs,
      )
      console.warn('glow-up marks qa failed — retrying', marksQa)
      try {
        if (stepPipeline?.length) {
          const skinInput = preSkinBase64 || await fetchGlowUpOutputBase64(urls[0])
          const skinStep = 'skin'
          if (skinInput) {
            const retryCreated = await falCreateFutureSelfTask(skinInput, mode, {
              ...options,
              glowUpStep: skinStep,
              stepIndex: stepPipeline.indexOf(skinStep) >= 0 ? stepPipeline.indexOf(skinStep) + 1 : stepPipeline.length,
              stepTotal: stepPipeline.length,
              marksRetry: true,
            })
            const retryEnvelope = await falWaitForTaskResult(retryCreated, {
              maxMs: retryWaitMs,
              pollMs: 400,
            })
            const retryUrls = retryEnvelope?.data?.resultUrls || []
            if (retryUrls.length) {
              urls = retryUrls
              activeCreated = retryCreated
              marksRetry = true
            }
          }
        } else {
        const retryCreated = await falCreateFutureSelfTask(imageBase64, mode, {
          ...options,
          marksRetry: true,
        })
        const retryEnvelope = await falWaitForTaskResult(retryCreated, {
          maxMs: retryWaitMs,
          pollMs: 400,
        })
        const retryUrls = retryEnvelope?.data?.resultUrls || []
        if (retryUrls.length) {
          urls = retryUrls
          activeCreated = retryCreated
          marksRetry = true
        }
        }
      } catch (retryErr) {
        console.warn('glow-up marks retry failed', retryErr?.message || retryErr)
      }
    }
  }

  return { urls, created: activeCreated, marksQa, marksRetry, deBloatQa, deBloatRetry, secondPass, stepPipeline }
}

function falQueuePathCandidates(requestId, suffix = '') {
  const id = encodeURIComponent(String(requestId || '').trim())
  const submitModel = falGlowUpEditSubmitModel()
  const queueModel = falGlowUpEditQueueModel()
  const submitBase = modelSubmitPath(submitModel)
  const queueBase = modelQueuePath(queueModel)
  const tail = suffix ? `/${suffix.replace(/^\/+/, '')}` : ''
  // Prefer full submit path (…/edit) — parent queue path often 405/422 for sub-path models.
  const paths = [
    `${submitBase}/requests/${id}${tail}`,
  ]
  if (queueBase !== submitBase) {
    paths.push(`${queueBase}/requests/${id}${tail}`)
  }
  return [...new Set(paths)]
}

async function falGetRequestStatusWithFallbacks(requestId, statusUrl) {
  const id = encodeURIComponent(String(requestId || '').trim())
  if (!id) throw new Error('missing_fal_request_id')

  const absolute = pickFalUrl(statusUrl)
  if (absolute) {
    const { response, data } = await falFetchAbsolute(absolute)
    if (response.ok) return data
    if (response.status !== 404 && response.status !== 405) {
      console.warn('fal status absolute failed', { status: response.status, url: absolute })
    }
  }

  let lastDetail = null
  for (const path of falQueuePathCandidates(requestId, 'status')) {
    const { response, data } = await falQueueFetch(path)
    if (response.ok) return data
    lastDetail = { status: response.status, body: data, path }
    if (response.status === 404 || response.status === 405) continue
  }

  throw falHttpError('fal_status_failed', lastDetail, lastDetail?.status)
}

async function falGetRequestResultWithFallbacks(requestId, responseUrl) {
  const id = encodeURIComponent(String(requestId || '').trim())
  if (!id) throw new Error('missing_fal_request_id')

  const absolute = pickFalUrl(responseUrl)
  if (absolute) {
    const { response, data } = await falFetchAbsolute(absolute, {}, 45_000)
    if (response.ok) return data
    if (response.status !== 404 && response.status !== 405) {
      console.warn('fal result absolute failed', { status: response.status, url: absolute })
    }
  }

  const suffixes = ['', 'response']
  let lastDetail = null
  for (const suffix of suffixes) {
    for (const path of falQueuePathCandidates(requestId, suffix)) {
      const { response, data } = await falQueueFetch(path)
      if (response.ok) return data
      lastDetail = { status: response.status, body: data, path }
      if (response.status === 404 || response.status === 405) continue
    }
  }

  throw falHttpError('fal_result_failed', lastDetail, lastDetail?.status)
}

/** Map Fal queue lifecycle → Kie-shaped envelope for the iOS client. */
export async function falTaskEnvelopeForClient(taskId, options = {}) {
  const requestId = String(taskId || '').replace(/^fal:/, '')
  const meta = resolveFalTaskMeta(requestId, options)
  const statusUrl = meta.statusUrl
  const responseUrl = meta.responseUrl
  const cacheKey = falStatusCacheKey(requestId, statusUrl, responseUrl)
  const cached = readFalStatusCache(cacheKey)
  if (cached) return cached

  let envelope
  try {
    envelope = await falTaskEnvelopeForClientUncached(requestId, { statusUrl, responseUrl })
  } catch (err) {
    throw err
  }
  writeFalStatusCache(cacheKey, envelope)
  return envelope
}

async function falTaskEnvelopeForClientUncached(requestId, { statusUrl, responseUrl } = {}) {
  let statusData
  try {
    statusData = await falGetRequestStatusWithFallbacks(requestId, statusUrl)
  } catch (err) {
    const httpStatus = err?.status ?? err?.detail?.status
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError'
    if (isTransientFalHttpStatus(httpStatus) || timedOut) {
      return processingFalEnvelope(requestId, 'IN_PROGRESS', { transient: true })
    }
    throw err
  }
  const status = String(statusData?.status || '').toUpperCase()

  if (status === 'COMPLETED') {
    if (statusData?.error) {
      return {
        code: 200,
        msg: 'success',
        data: {
          taskId: toFalTaskId(requestId),
          state: 'fail',
          failMsg: String(statusData.error),
        },
      }
    }

    let resultData
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        resultData = await falGetRequestResultWithFallbacks(
          requestId,
          pickFalUrl(statusData?.response_url, responseUrl)
        )
        break
      } catch (err) {
        const httpStatus = err?.status ?? err?.detail?.status
        if (attempt >= 4 || (!isTransientFalHttpStatus(httpStatus) && httpStatus !== 404 && httpStatus !== 405)) {
          throw err
        }
        await sleep(400 * (attempt + 1))
      }
    }
    let urls = extractImageUrls(resultData)
    if (!urls.length) urls = extractImageUrls(statusData)
    if (!urls.length) {
      return {
        code: 200,
        msg: 'success',
        data: {
          taskId: toFalTaskId(requestId),
          state: 'fail',
          failMsg: 'no_result_image',
        },
      }
    }

    const inputMeta = resolveFalTaskMetaInput(requestId)
    if (inputMeta?.inputWidth && inputMeta?.inputHeight) {
      try {
        const published = await publishAlignedGlowUpResult(null, {
          imageWidth: inputMeta.inputWidth,
          imageHeight: inputMeta.inputHeight,
        }, urls)
        const next = published?.urls?.[0]
        if (next && String(next).startsWith('http')) urls = published.urls
      } catch (alignErr) {
        console.warn('glow-up poll align failed', alignErr?.message || alignErr)
      }
    }

    const description = String(resultData?.description || '').trim() || null
    return {
      code: 200,
      msg: 'success',
      data: {
        taskId: toFalTaskId(requestId),
        state: 'success',
        resultUrls: urls,
        resultJson: JSON.stringify({ resultUrls: urls, description }),
        description,
      },
    }
  }

  if (status === 'IN_QUEUE' || status === 'IN_PROGRESS') {
    return {
      code: 200,
      msg: 'success',
      data: {
        taskId: toFalTaskId(requestId),
        state: 'processing',
        status,
        queuePosition: statusData?.queue_position ?? null,
      },
    }
  }

  if (status === 'FAILED' || status === 'CANCELLED') {
    return {
      code: 200,
      msg: 'success',
      data: {
        taskId: toFalTaskId(requestId),
        state: 'fail',
        failMsg: formatFalErrorMessage(statusData?.error)
          || String(statusData?.error || statusData?.message || status || 'Generation failed'),
      },
    }
  }

  return {
    code: 200,
    msg: 'success',
    data: {
      taskId: toFalTaskId(requestId),
      state: 'processing',
      status: status || 'unknown',
    },
  }
}

function extractImageUrls(resultData) {
  if (!resultData || typeof resultData !== 'object') return []
  const buckets = [
    resultData,
    resultData.data,
    resultData.response,
    resultData.output,
    resultData.payload,
  ].filter(Boolean)
  for (const bucket of buckets) {
    const images = bucket?.images
    if (Array.isArray(images)) {
      const urls = images.map((img) => img?.url || img?.uri).filter(Boolean)
      if (urls.length) return urls
    }
    if (typeof bucket?.url === 'string' && bucket.url.startsWith('http')) return [bucket.url]
  }
  return []
}

export { NANO_BANANA2_DEFAULT, GPT_IMAGE2_DEFAULT, glowUpVisionEnabled }
export { glowUpVisionRequired } from './glow-up-vision.mjs'
