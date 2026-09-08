// Wan 2.7 Reference-to-Video (kie.ai, model wan/2-7-r2v).

import { kieApiKey, kieApiFetch } from './kie.mjs'
import { kieUploadBase64 } from './kie-seedance.mjs'

const WAN_R2V_MODEL = 'wan/2-7-r2v'

function kieError(code, detail, status) {
  const err = new Error(code)
  err.detail = detail
  err.status = status
  return err
}

async function resolveImageUrls(images, imageUrls) {
  const urls = []
  if (Array.isArray(imageUrls)) {
    for (const u of imageUrls) {
      const url = String(u || '').trim()
      if (url.startsWith('http')) urls.push(url)
    }
  }
  if (Array.isArray(images)) {
    let i = 0
    for (const b of images) {
      const raw = String(b || '').trim()
      if (!raw) continue
      const up = await kieUploadBase64(raw, `wan-img-${Date.now()}-${i++}.jpg`, {
        uploadPath: 'clavic/wan',
      })
      urls.push(up)
    }
  }
  return urls
}

/**
 * @param {{ prompt: string, images?: string[], imageUrls?: string[], videoUrls?: string[], resolution?: string, aspectRatio?: string, duration?: number, negativePrompt?: string, nsfwChecker?: boolean }} input
 */
export async function kieWanR2vCreateTask(input = {}) {
  if (!kieApiKey()) throw kieError('server_misconfigured_missing_kie_key', null, 500)

  const prompt = String(input.prompt || '').trim()
  if (!prompt) throw kieError('missing_prompt', null, 400)

  const reference_image = await resolveImageUrls(input.images, input.imageUrls)
  const reference_video = []
  if (Array.isArray(input.videoUrls)) {
    for (const u of input.videoUrls) {
      const url = String(u || '').trim()
      if (url.startsWith('http')) reference_video.push(url)
    }
  }
  if (!reference_image.length && !reference_video.length) {
    throw kieError('missing_reference', null, 400)
  }
  if (reference_image.length + reference_video.length > 5) {
    throw kieError('too_many_references', null, 400)
  }

  const res = String(input.resolution || '720p').trim().toLowerCase()
  const resolution = res === '1080p' ? '1080p' : '720p'
  const ratio = String(input.aspectRatio || input.aspect_ratio || '16:9').trim()
  const allowed = new Set(['16:9', '9:16', '1:1', '4:3', '3:4'])
  const aspect_ratio = allowed.has(ratio) ? ratio : '16:9'
  let duration = Math.round(Number(input.duration || 5))
  if (!Number.isFinite(duration)) duration = 5
  duration = Math.min(10, Math.max(2, duration))

  const apiInput = {
    prompt,
    reference_image: reference_image.slice(0, 5),
    reference_video: reference_video.slice(0, 5),
    resolution,
    aspect_ratio,
    duration,
    prompt_extend: input.promptExtend !== false,
    watermark: false,
  }
  const neg = String(input.negativePrompt || input.negative_prompt || '').trim()
  if (neg) apiInput.negative_prompt = neg.slice(0, 500)
  if (input.nsfwChecker === false) apiInput.nsfw_checker = false

  const { response, data } = await kieApiFetch('/api/v1/jobs/createTask', {
    method: 'POST',
    body: { model: WAN_R2V_MODEL, input: apiInput },
  })
  if (!response.ok) {
    throw kieError(data?.msg || data?.message || 'kie_wan_submit_failed', data, response.status)
  }
  const taskId = data?.data?.taskId || data?.data?.task_id
  if (!taskId) throw kieError('kie_missing_task_id', data, response.status)
  return { taskId: String(taskId), model: WAN_R2V_MODEL }
}

export { WAN_R2V_MODEL }
