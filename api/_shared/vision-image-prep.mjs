import sharp from 'sharp'
import { decodeBase64ImageBytes } from './image-dimensions.mjs'

const VISION_MAX_EDGE = Number(process.env.FUTURE_SELF_GLOW_UP_VISION_MAX_EDGE) || 640

/**
 * Smaller image for Claude Vision — faster + fits Vercel 60s budget with Fal edit.
 * Fal still receives the full-res upload.
 */
export async function downscaleBase64ForVision(imageBase64, maxEdge = VISION_MAX_EDGE) {
  if (!imageBase64 || typeof imageBase64 !== 'string') return imageBase64
  try {
    const { bytes } = decodeBase64ImageBytes(imageBase64)
    if (!bytes?.length) return imageBase64
    const out = await sharp(bytes)
      .rotate()
      .resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 74, mozjpeg: true })
      .toBuffer()
    return out.toString('base64')
  } catch (err) {
    console.warn('vision image downscale failed', String(err?.message || err))
    return imageBase64
  }
}
