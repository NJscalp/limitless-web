import {
  assertFutureSelfGlowUpPrompt,
  normalizeFutureSelfMode,
  toFalTaskId,
} from './future-self-prompts.mjs'
import { falCustomImageSizeFromBase64 } from './image-dimensions.mjs'

const FAL_QUEUE_BASE = (process.env.FAL_QUEUE_BASE || 'https://queue.fal.run').replace(/\/$/, '')

/** Fal.ai GPT Image 2 edit — submit endpoint includes `/edit`. */
export function falGptImage2EditSubmitModel() {
  return (process.env.FAL_GPT_IMAGE2_EDIT_MODEL || 'openai/gpt-image-2/edit').trim()
}

/** Status + result endpoints use the base model id (no `/edit` suffix). */
export function falGptImage2QueueModel() {
  const submit = falGptImage2EditSubmitModel()
  return submit.endsWith('/edit') ? submit.slice(0, -'/edit'.length) : submit
}

/** @deprecated alias */
export function falGptImage2EditModel() {
  return falGptImage2EditSubmitModel()
}

/** Vercel env: `FAL_KEY` (recommended) or `FAL_API_KEY`. */
export function falApiKey() {
  return (process.env.FAL_KEY || process.env.FAL_API_KEY || '').trim()
}

export async function falQueueFetch(modelPath, { method = 'GET', body } = {}) {
  const apiKey = falApiKey()
  if (!apiKey) throw new Error('missing_fal_key')

  const path = modelPath.startsWith('/') ? modelPath : `/${modelPath}`
  const response = await fetch(`${FAL_QUEUE_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
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

function modelSubmitPath(model = falGptImage2EditSubmitModel()) {
  return `/${model.replace(/^\/+/, '')}`
}

function modelQueuePath(model = falGptImage2QueueModel()) {
  return `/${model.replace(/^\/+/, '')}`
}

/** Submit Future Self glow-up to Fal GPT Image 2 edit queue. */
export async function falCreateFutureSelfTask(imageBase64, mode = 'front', options = {}) {
  const submitModel = falGptImage2EditSubmitModel()
  const imageDataUri = base64ToDataUri(imageBase64)
  const key = normalizeFutureSelfMode(mode)
  const prompt = assertFutureSelfGlowUpPrompt(key)
  const imageSize = falCustomImageSizeFromBase64(imageBase64, {
    width: options.imageWidth,
    height: options.imageHeight,
  })
  const payload = {
    prompt,
    image_urls: [imageDataUri],
    image_size: imageSize,
    quality: process.env.FUTURE_SELF_FAL_QUALITY || 'low',
    num_images: 1,
    output_format: process.env.FUTURE_SELF_FAL_OUTPUT_FORMAT || 'jpeg',
  }

  const { response, data } = await falQueueFetch(modelSubmitPath(submitModel), {
    method: 'POST',
    body: payload,
  })

  if (!response.ok) {
    const err = new Error('fal_submit_failed')
    err.detail = data
    err.status = response.status
    throw err
  }

  const requestId = data?.request_id
  if (!requestId) {
    const err = new Error('fal_missing_request_id')
    err.detail = data
    throw err
  }

  return {
    taskId: toFalTaskId(requestId),
    requestId: String(requestId),
    model: submitModel,
    provider: 'fal',
    imageSize,
  }
}

export async function falGetRequestStatus(requestId) {
  const queueModel = falGptImage2QueueModel()
  const { response, data } = await falQueueFetch(
    `${modelQueuePath(queueModel)}/requests/${encodeURIComponent(requestId)}/status`
  )
  if (!response.ok) {
    const err = new Error('fal_status_failed')
    err.detail = { status: response.status, body: data }
    err.status = response.status
    throw err
  }
  return data
}

export async function falGetRequestResult(requestId) {
  const queueModel = falGptImage2QueueModel()
  const { response, data } = await falQueueFetch(
    `${modelQueuePath(queueModel)}/requests/${encodeURIComponent(requestId)}`
  )
  if (!response.ok) {
    const err = new Error('fal_result_failed')
    err.detail = { status: response.status, body: data }
    err.status = response.status
    throw err
  }
  return data
}

/** Map Fal queue lifecycle → Kie-shaped envelope for the iOS client. */
export async function falTaskEnvelopeForClient(taskId) {
  const requestId = String(taskId || '').replace(/^fal:/, '')
  const statusData = await falGetRequestStatus(requestId)
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

    const resultData = await falGetRequestResult(requestId)
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

    return {
      code: 200,
      msg: 'success',
      data: {
        taskId: toFalTaskId(requestId),
        state: 'success',
        resultUrls: urls,
        resultJson: JSON.stringify({ resultUrls: urls }),
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
