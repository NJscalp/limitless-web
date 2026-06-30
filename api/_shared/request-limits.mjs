/** Max base64 length for image uploads (~2.5 MB raw JPEG + JSON overhead). */
export const MAX_IMAGE_BASE64_LENGTH = 3_400_000

/** Max combined base64 length for all images in one Seedance request. */
export const MAX_IMAGES_TOTAL_BASE64_LENGTH = 2_800_000

/**
 * @param {string} imageBase64
 * @returns {{ ok: true } | { ok: false, status: 413, error: string, message: string }}
 */
export function validateImageBase64Length(imageBase64) {
  if (typeof imageBase64 !== 'string' || !imageBase64.length) {
    return { ok: false, status: 400, error: 'missing_image_base64', message: 'Image data is required.' }
  }
  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    return {
      ok: false,
      status: 413,
      error: 'image_too_large',
      message: 'Photo is too large for upload. Use a closer crop or lower resolution.',
    }
  }
  return { ok: true }
}

/**
 * @param {unknown[]} images
 * @returns {{ ok: true } | { ok: false, status: number, error: string, message: string }}
 */
export function validateImagesPayload(images) {
  if (!Array.isArray(images) || !images.length) return { ok: true }
  let total = 0
  for (const img of images) {
    const check = validateImageBase64Length(String(img || ''))
    if (!check.ok) return check
    total += String(img || '').length
  }
  if (total > MAX_IMAGES_TOTAL_BASE64_LENGTH) {
    return {
      ok: false,
      status: 413,
      error: 'images_too_large',
      message: 'Photos are too large for upload. Try fewer or smaller images.',
    }
  }
  return { ok: true }
}
