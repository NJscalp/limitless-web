import { put } from '@vercel/blob'
import sharp from 'sharp'
import { decodeBase64ImageBytes, readImageDimensionsFromBytes } from './image-dimensions.mjs'

const ALIGN_FETCH_TIMEOUT_MS = Number(process.env.FUTURE_SELF_GLOW_UP_ALIGN_FETCH_MS) || 20_000

/** Target pixel size of the uploaded selfie (exact canvas for before/after overlap). */
export function resolveGlowUpInputDimensions(imageBase64, options = {}) {
  const w = Number(options.imageWidth ?? options.width)
  const h = Number(options.imageHeight ?? options.height)
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    return { width: Math.round(w), height: Math.round(h) }
  }
  if (imageBase64) {
    const { bytes, mime } = decodeBase64ImageBytes(imageBase64)
    const dims = readImageDimensionsFromBytes(bytes, mime)
    if (dims) return dims
  }
  return null
}

/** Closest Fal Nano Banana aspect_ratio preset for the upload. */
export function closestNanoBananaAspectRatio(width, height) {
  const w = Number(width)
  const h = Number(height)
  if (!Number.isFinite(w) || !Number.isFinite(h) || h <= 0) return 'auto'
  const input = w / h
  const presets = [
    ['21:9', 21 / 9], ['16:9', 16 / 9], ['3:2', 3 / 2], ['4:3', 4 / 3],
    ['5:4', 5 / 4], ['1:1', 1], ['4:5', 4 / 5], ['3:4', 3 / 4],
    ['2:3', 2 / 3], ['9:16', 9 / 16],
  ]
  let best = 'auto'
  let bestDiff = Infinity
  for (const [label, ratio] of presets) {
    const diff = Math.abs(Math.log(input / ratio))
    if (diff < bestDiff) {
      bestDiff = diff
      best = label
    }
  }
  return bestDiff < 0.14 ? best : 'auto'
}

/** Pick Fal resolution tier closest to upload size (less upscaling = easier size match). */
export function nanoBananaResolutionForInput(width, height, fallback = '1K') {
  const maxEdge = Math.max(Number(width) || 0, Number(height) || 0)
  if (maxEdge <= 560) return '0.5K'
  if (maxEdge <= 1280) return '1K'
  if (maxEdge <= 2048) return '2K'
  return fallback
}

const RESOLUTION_TIERS = ['0.5K', '1K', '2K', '4K']

/** Never exceed env cap — e.g. cap=0.5K forces cheapest tier even on 1024px uploads. */
export function minResolutionTier(preferred, cap) {
  const a = RESOLUTION_TIERS.indexOf(String(preferred || '').trim())
  const b = RESOLUTION_TIERS.indexOf(String(cap || '').trim())
  if (a < 0 && b < 0) return '1K'
  if (a < 0) return cap
  if (b < 0) return preferred
  return RESOLUTION_TIERS[Math.min(a, b)]
}

/** Center-crop + resize Fal output to match input — same W×H as original upload. */
export async function alignGlowUpResultBytes(resultBytes, targetWidth, targetHeight) {
  const tw = Math.round(Number(targetWidth) || 0)
  const th = Math.round(Number(targetHeight) || 0)
  if (!resultBytes?.length || tw < 1 || th < 1) return null

  try {
    const meta = await sharp(resultBytes).metadata()
    if (meta.width === tw && meta.height === th) return resultBytes

    return sharp(resultBytes)
      .rotate()
      .resize(tw, th, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer()
  } catch (err) {
    console.warn('glow-up result align failed', String(err?.message || err))
    return null
  }
}

export async function fetchAndAlignGlowUpResult(url, targetWidth, targetHeight) {
  const raw = String(url || '').trim()
  if (!raw.startsWith('http')) return null
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ALIGN_FETCH_TIMEOUT_MS)
    const res = await fetch(raw, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return alignGlowUpResultBytes(buf, targetWidth, targetHeight)
  } catch (err) {
    console.warn('glow-up result fetch align failed', String(err?.message || err))
    return null
  }
}

async function publishAlignedBytesToBlob(aligned, dims) {
  const token = (process.env.BLOB_READ_WRITE_TOKEN || '').trim()
  if (!token) return null
  try {
    const blob = await put(
      `glow-up/aligned/${dims.width}x${dims.height}-${Date.now()}.jpg`,
      aligned,
      {
        access: 'public',
        addRandomSuffix: true,
        contentType: 'image/jpeg',
        token,
      },
    )
    return blob.url
  } catch (err) {
    console.warn('glow-up blob publish failed', String(err?.message || err))
    return null
  }
}

function isHttpsUrl(url) {
  return String(url || '').trim().startsWith('https://')
}

/**
 * Align Fal output to upload pixel size.
 * ONLY replaces resultUrls when a public https URL is available (Vercel Blob).
 * Never uses data: URLs — iOS URL(string:) rejects large data URLs → "No image returned".
 * On any failure, keeps the original Fal https URL so the live app always gets an image.
 */
export async function publishAlignedGlowUpResult(imageBase64, options, resultUrls) {
  const originalUrls = (Array.isArray(resultUrls) ? resultUrls : [])
    .map((u) => String(u || '').trim())
    .filter((u) => u.startsWith('http'))
  if (!originalUrls.length) return null

  const dims = resolveGlowUpInputDimensions(imageBase64, options)
  if (!dims) {
    return { urls: originalUrls, aligned: false }
  }

  const aligned = await fetchAndAlignGlowUpResult(originalUrls[0], dims.width, dims.height)
  if (!aligned?.length) {
    return { urls: originalUrls, aligned: false, resultWidth: dims.width, resultHeight: dims.height }
  }

  const blobUrl = await publishAlignedBytesToBlob(aligned, dims)
  if (isHttpsUrl(blobUrl)) {
    return {
      urls: [blobUrl],
      resultWidth: dims.width,
      resultHeight: dims.height,
      aligned: true,
    }
  }

  // No blob — return original Fal URL (download works; size may differ).
  return {
    urls: originalUrls,
    resultWidth: dims.width,
    resultHeight: dims.height,
    aligned: false,
  }
}

/** @deprecated use publishAlignedGlowUpResult */
export async function buildAlignedGlowUpResultMeta(imageBase64, options, resultUrls) {
  return publishAlignedGlowUpResult(imageBase64, options, resultUrls)
}
