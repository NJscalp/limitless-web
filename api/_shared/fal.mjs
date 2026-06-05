import {
  buildGlowUpPrompt,
  normalizeFutureSelfMode,
  toFalTaskId,
} from './future-self-prompts.mjs'
import { resolveFalGlowUpImageSize } from './image-dimensions.mjs'

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
  const raw = (process.env.FUTURE_SELF_FAL_RESOLUTION || '1K').trim()
  const allowed = new Set(['0.5K', '1K', '2K', '4K'])
  return allowed.has(raw) ? raw : '1K'
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
  const n = Number(process.env.FUTURE_SELF_FAL_SAFETY_TOLERANCE ?? 4)
  if (Number.isFinite(n) && n >= 1 && n <= 6) return String(Math.round(n))
  return '4'
}

export function falGlowUpLimitGenerations() {
  const raw = String(process.env.FUTURE_SELF_FAL_LIMIT_GENERATIONS ?? '1').trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'no') return false
  return true
}

export function falGlowUpThinkingLevel() {
  const raw = String(process.env.FUTURE_SELF_FAL_THINKING_LEVEL || 'minimal').trim().toLowerCase()
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

/** Short-lived cache so 100 concurrent app polls don't hammer Fal for the same task. */
const falStatusCache = new Map()

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
  const ttl = state === 'success' || state === 'fail' || state === 'failed'
    ? Math.max(FAL_STATUS_CACHE_TTL_MS, 30_000)
    : FAL_STATUS_CACHE_TTL_MS
  if (falStatusCache.size >= FAL_STATUS_CACHE_MAX) {
    const oldest = falStatusCache.keys().next().value
    if (oldest) falStatusCache.delete(oldest)
  }
  falStatusCache.set(key, { envelope, expiresAt: Date.now() + ttl })
}

function fetchWithTimeout(url, options = {}, timeoutMs = FAL_FETCH_TIMEOUT_MS) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  })
}

function buildNanoBanana2Payload(prompt, imageDataUri) {
  const payload = {
    prompt,
    image_urls: [imageDataUri],
    num_images: 1,
    aspect_ratio: falGlowUpAspectRatio(),
    output_format: falGlowUpOutputFormat(),
    resolution: falGlowUpResolution(),
    safety_tolerance: falGlowUpSafetyTolerance(),
    limit_generations: falGlowUpLimitGenerations(),
    system_prompt: glowUpSystemPrompt(),
  }

  const thinking = falGlowUpThinkingLevel()
  if (thinking) payload.thinking_level = thinking

  return payload
}

const DEFAULT_GLOW_UP_SYSTEM_PROMPT = `You are an expert portrait retoucher. EDIT the input photo so the face looks visibly fresher — never return the same image unchanged.

ALLOWED (glow-up only — on existing face):
- Reduce facial puffiness / water retention (cheeks, mid-face, under-eyes)
- Clear minor blemishes/redness; keep pores, freckles, moles, texture
- Fresher under-eyes; same eye shape and iris color

FORBIDDEN (automatic failure):
- Inventing beard, stubble, mustache, scruff, or 5-o'clock shadow on clean-shaven faces
- Removing existing beard/stubble; darkening jaw/chin to simulate hair
- Adding makeup, contour, fake tan, or changing nose/lips/eyes/bones
- Relighting, recoloring, or changing background/clothing/hair

Same person, same grooming, same bone outline — only fresher and less puffy.
If output adds facial hair or new features → you failed. If nearly identical to input → push de-bloat harder without breaking constraints.`

function glowUpSystemPrompt() {
  const custom = String(process.env.FUTURE_SELF_FAL_SYSTEM_PROMPT || '').trim()
  return custom || DEFAULT_GLOW_UP_SYSTEM_PROMPT
}

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

function buildFutureSelfPayload(imageBase64, mode, options = {}) {
  const imageDataUri = base64ToDataUri(imageBase64)
  const key = normalizeFutureSelfMode(mode)
  const promptStyle = isNanoBananaEditModel(falGlowUpEditSubmitModel()) ? 'concise' : 'hybrid'
  const prompt = buildGlowUpPrompt(key, options.metrics, options.faceProfile, promptStyle)
  const submitModel = falGlowUpEditSubmitModel()

  if (isNanoBananaEditModel(submitModel)) {
    const payload = buildNanoBanana2Payload(prompt, imageDataUri)
    return {
      payload,
      imageSize: {
        aspect_ratio: payload.aspect_ratio,
        resolution: payload.resolution,
      },
      mode: key,
      promptAdaptive: Boolean(options.metrics),
      compositionAdaptive: Boolean(options.metrics || options.faceProfile),
      modelFamily: 'nano-banana-2',
      promptStyle,
      promptLength: prompt.length,
    }
  }

  const { payload, imageSize } = buildGptImage2Payload(prompt, imageDataUri, imageBase64, options)
  return {
    payload,
    imageSize,
    mode: key,
    promptAdaptive: Boolean(options.metrics),
    compositionAdaptive: Boolean(options.metrics || options.faceProfile),
    modelFamily: 'gpt-image-2',
    promptStyle: 'hybrid',
    promptLength: prompt.length,
  }
}

function glowUpQualityMeta(modelFamily) {
  if (modelFamily === 'nano-banana-2') return falGlowUpResolution()
  return falGlowUpQuality()
}

/** Submit Future Self glow-up to Fal queue (Nano Banana 2 edit by default). */
export async function falCreateFutureSelfTask(imageBase64, mode = 'front', options = {}) {
  const submitModel = falGlowUpEditSubmitModel()
  const built = buildFutureSelfPayload(imageBase64, mode, options)
  const { payload, imageSize, modelFamily } = built

  const { response, data } = await falQueueFetch(modelSubmitPath(submitModel), {
    method: 'POST',
    body: payload,
  })

  if (!response.ok) {
    const msg = formatFalErrorMessage(data) || 'fal_submit_failed'
    throw falHttpError(msg, data, response.status)
  }

  const requestId = data?.request_id
  if (!requestId) {
    throw falHttpError('fal_missing_request_id', data, response.status)
  }

  return {
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
  }
}

/**
 * Submit once, wait on the server — app gets the finished image in one HTTP response.
 * Avoids dozens of App ↔ Vercel poll round-trips.
 */
export async function falCreateAndWaitFutureSelf(imageBase64, mode = 'front', options = {}) {
  const waitBudgetMs = Number(process.env.FUTURE_SELF_FAL_WAIT_MS) || 52_000
  const useSync = String(process.env.FUTURE_SELF_FAL_SYNC || '').trim() === '1'

  if (useSync) {
    const submitModel = falGlowUpEditSubmitModel()
    const built = buildFutureSelfPayload(imageBase64, mode, options)
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
  const envelope = await falWaitForTaskResult(created, { maxMs: waitBudgetMs, pollMs: 650 })
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
export async function falWaitForTaskResult(created, { maxMs = 52_000, pollMs = 650 } = {}) {
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

async function falGetRequestStatusWithFallbacks(requestId, statusUrl) {
  const id = encodeURIComponent(String(requestId || '').trim())
  if (!id) throw new Error('missing_fal_request_id')

  const absolute = pickFalUrl(statusUrl)
  if (absolute) {
    const { response, data } = await falFetchAbsolute(absolute)
    if (response.ok) return data
    if (response.status !== 404) {
      throw falHttpError('fal_status_failed', { status: response.status, body: data, url: absolute }, response.status)
    }
  }

  const queueModel = falGlowUpEditQueueModel()
  const submitModel = falGlowUpEditSubmitModel()
  const pathCandidates = [
    `${modelQueuePath(queueModel)}/requests/${id}/status`,
    `${modelSubmitPath(submitModel)}/requests/${id}/status`,
  ]

  let lastDetail = null
  for (const path of [...new Set(pathCandidates)]) {
    const { response, data } = await falQueueFetch(path)
    if (response.ok) return data
    lastDetail = { status: response.status, body: data, path }
    if (response.status !== 404) break
  }

  throw falHttpError('fal_status_failed', lastDetail, lastDetail?.status)
}

async function falGetRequestResultWithFallbacks(requestId, responseUrl) {
  const id = encodeURIComponent(String(requestId || '').trim())
  if (!id) throw new Error('missing_fal_request_id')

  const absolute = pickFalUrl(responseUrl)
  if (absolute) {
    const { response, data } = await falFetchAbsolute(absolute)
    if (response.ok) return data
    if (response.status !== 404) {
      throw falHttpError('fal_result_failed', { status: response.status, body: data, url: absolute }, response.status)
    }
  }

  const queueModel = falGlowUpEditQueueModel()
  const submitModel = falGlowUpEditSubmitModel()
  const pathCandidates = [
    `${modelQueuePath(queueModel)}/requests/${id}`,
    `${modelQueuePath(queueModel)}/requests/${id}/response`,
    `${modelSubmitPath(submitModel)}/requests/${id}`,
    `${modelSubmitPath(submitModel)}/requests/${id}/response`,
  ]

  let lastDetail = null
  for (const path of [...new Set(pathCandidates)]) {
    const { response, data } = await falQueueFetch(path)
    if (response.ok) return data
    lastDetail = { status: response.status, body: data, path }
    if (response.status !== 404) break
  }

  throw falHttpError('fal_result_failed', lastDetail, lastDetail?.status)
}

/** Map Fal queue lifecycle → Kie-shaped envelope for the iOS client. */
export async function falTaskEnvelopeForClient(taskId, options = {}) {
  const requestId = String(taskId || '').replace(/^fal:/, '')
  const statusUrl = options.statusUrl || options.status_url
  const responseUrl = options.responseUrl || options.response_url
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
        if (!isTransientFalHttpStatus(httpStatus) || attempt >= 4) {
          throw err
        }
        await sleep(400 * (attempt + 1))
      }
    }
    const urls = extractImageUrls(resultData)
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
  const images = resultData?.images
  if (!Array.isArray(images)) return []
  return images.map((img) => img?.url).filter(Boolean)
}

export { NANO_BANANA2_DEFAULT, GPT_IMAGE2_DEFAULT }
