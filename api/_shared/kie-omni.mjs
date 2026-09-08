// Gemini Omni Video (kie.ai, model gemini-omni-video).
// Multimodales R2V: Prompt + Bilder + Referenzclip → Video @720p.

import { kieApiKey, kieApiFetch } from './kie.mjs'
import { kieUploadBase64 } from './kie-seedance.mjs'

const OMNI_VIDEO_MODEL = 'gemini-omni-video'

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
      const up = await kieUploadBase64(raw, `omni-img-${Date.now()}-${i++}.jpg`, {
        uploadPath: 'clavic/omni',
      })
      urls.push(up)
    }
  }
  return urls
}

function buildVideoList(input = {}) {
  if (Array.isArray(input.videoList) && input.videoList.length) {
    return input.videoList.slice(0, 1).map((item) => {
      const url = String(item?.url || '').trim()
      if (!url.startsWith('http')) return null
      const start = Math.max(0, Number(item.start ?? 0))
      let ends = Number(item.ends ?? item.end ?? 10)
      if (!Number.isFinite(ends) || ends <= start) ends = Math.min(10, start + 5)
      ends = Math.min(10, Math.max(start + 0.1, ends))
      return { url, start, ends }
    }).filter(Boolean)
  }

  const urls = []
  if (Array.isArray(input.videoUrls)) {
    for (const u of input.videoUrls) {
      const url = String(u || '').trim()
      if (url.startsWith('http')) urls.push(url)
    }
  }
  if (!urls.length) return []

  const start = Math.max(0, Number(input.videoStart ?? input.video_start ?? 0))
  let ends = Number(input.videoEnds ?? input.video_ends ?? 5)
  if (!Number.isFinite(ends) || ends <= start) ends = Math.min(10, start + 5)
  ends = Math.min(10, Math.max(start + 0.1, ends))
  return [{ url: urls[0], start, ends }]
}

/**
 * @param {{ prompt: string, images?: string[], imageUrls?: string[], videoUrls?: string[], videoList?: object[], aspectRatio?: string, duration?: string|number, videoStart?: number, videoEnds?: number }} input
 */
export async function kieOmniVideoCreateTask(input = {}) {
  if (!kieApiKey()) throw kieError('server_misconfigured_missing_kie_key', null, 500)

  const prompt = String(input.prompt || '').trim()
  if (!prompt) throw kieError('missing_prompt', null, 400)

  const image_urls = await resolveImageUrls(input.images, input.imageUrls)
  const video_list = buildVideoList(input)
  if (!image_urls.length && !video_list.length) {
    throw kieError('missing_reference', null, 400)
  }

  const quota = image_urls.length + video_list.length * 2
  if (quota > 7) throw kieError('too_many_references', null, 400)

  const ratio = String(input.aspectRatio || input.aspect_ratio || '16:9').trim()
  const aspect_ratio = ratio === '9:16' ? '9:16' : '16:9'

  let duration = String(input.duration ?? '8').trim()
  if (!['4', '6', '8', '10'].includes(duration)) duration = '8'

  const apiInput = {
    prompt,
    aspect_ratio,
    resolution: '720p',
    duration,
  }
  if (image_urls.length) apiInput.image_urls = image_urls.slice(0, 7)
  if (video_list.length) apiInput.video_list = video_list

  const { response, data } = await kieApiFetch('/api/v1/jobs/createTask', {
    method: 'POST',
    body: { model: OMNI_VIDEO_MODEL, input: apiInput },
  })
  if (!response.ok) {
    throw kieError(data?.msg || data?.message || 'kie_omni_submit_failed', data, response.status)
  }
  const taskId = data?.data?.taskId || data?.data?.task_id
  if (!taskId) throw kieError('kie_missing_task_id', data, response.status)
  return { taskId: String(taskId), model: OMNI_VIDEO_MODEL }
}

export { OMNI_VIDEO_MODEL }
