/**
 * Einheitliche Pixelbasis für MediaPipe + unser Cover-Mapping:
 * tf.js `getImageSize` / FromPixels nutzen bei HTMLImageElement `width`/`height`,
 * oft identisch mit natural* — aber nicht garantiert. Wir zeichnen auf ein Canvas
 * mit exakt naturalWidth × naturalHeight, damit Keypoints und Mapping 1:1 sind.
 */

/** Canvas im Bildpixelraum (wie Swift normalisiertes CGImage) */
export async function createDetectionCanvas(img: HTMLImageElement): Promise<HTMLCanvasElement | null> {
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (!nw || !nh) return null

  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(img, {
        imageOrientation: 'from-image',
      } as Parameters<typeof createImageBitmap>[1])
      const canvas = document.createElement('canvas')
      canvas.width = bmp.width
      canvas.height = bmp.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        bmp.close()
        return null
      }
      ctx.drawImage(bmp, 0, 0)
      bmp.close()
      return canvas
    } catch {
      /* ältere Browser: weiter mit drawImage */
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = nw
  canvas.height = nh
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, nw, nh)
  return canvas
}
