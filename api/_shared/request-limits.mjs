/** Max base64 length for image uploads (~2.5 MB raw JPEG + JSON overhead). */
export const MAX_IMAGE_BASE64_LENGTH = 3_400_000

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
