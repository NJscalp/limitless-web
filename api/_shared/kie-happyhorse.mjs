// HappyHorse 1.1 Reference-to-Video (kie.ai, model happyhorse-1-1/reference-to-video).

import { kieApiKey, kieApiFetch } from './kie.mjs'
import { kieUploadBase64 } from './kie-seedance.mjs'

const HH_R2V_MODEL = 'happyhorse-1-1/reference-to-video'

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
      const up = await kieUploadBase64(raw, `hh-img-${Date.now()}-${i++}.jpg`, {
        uploadPath: 'clavic/happyhorse',
      })
      urls.push(up)
    }
  }
  return urls
}

/**
 * @param {{ prompt: string, images?: string[], imageUrls?: string[], resolution?: string, aspectRatio?: string, duration?: number, seed?: number }} input
 */
export async function kieHappyHorseR2vCreateTask(input = {}) {
  if (!kieApiKey()) throw kieError('server_misconfigured_missing_kie_key', null, 500)

  const prompt = String(input.prompt || '').trim()
  if (!prompt) throw kieError('missing_prompt', null, 400)

  const reference_image = await resolveImageUrls(input.images, input.imageUrls)
  if (!reference_image.length) throw kieError('missing_reference_image', null, 400)

  const res = String(input.resolution || '720p').trim().toLowerCase()
  const resolution = res === '1080p' ? '1080p' : '720p'
  const ratio = String(input.aspectRatio || input.aspect_ratio || '16:9').trim()
  const allowed = new Set(['16:9', '9:16', '1:1', '4:3', '3:4', '4:5', '5:4', '9:21', '21:9'])
  const aspect_ratio = allowed.has(ratio) ? ratio : '16:9'
  let duration = Math.round(Number(input.duration || 5))
  if (!Number.isFinite(duration)) duration = 5
  duration = Math.min(15, Math.max(3, duration))

  const apiInput = {
    prompt,
    reference_image: reference_image.slice(0, 9),
    resolution,
    aspect_ratio,
    duration,
  }
  if (Number.isFinite(Number(input.seed))) apiInput.seed = Math.round(Number(input.seed))

  const { response, data } = await kieApiFetch('/api/v1/jobs/createTask', {
    method: 'POST',
    body: { model: HH_R2V_MODEL, input: apiInput },
  })
  if (!response.ok) {
    throw kieError(data?.msg || data?.message || 'kie_happyhorse_submit_failed', data, response.status)
  }
  const taskId = data?.data?.taskId || data?.data?.task_id
  if (!taskId) throw kieError('kie_missing_task_id', data, response.status)
  return { taskId: String(taskId), model: HH_R2V_MODEL }
}

export { HH_R2V_MODEL }
