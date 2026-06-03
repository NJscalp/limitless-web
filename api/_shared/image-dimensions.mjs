const MIN_PIXELS = 655_360
const MAX_PIXELS = 8_294_400
const MAX_EDGE = 3840
const MAX_ASPECT = 3

export function decodeBase64ImageBytes(base64Raw) {
  let trimmed = String(base64Raw || '').trim()
  let mime = 'image/jpeg'
  if (trimmed.startsWith('data:')) {
    const match = trimmed.match(/^data:([^;]+);base64,(.+)$/i)
    if (match) {
      mime = match[1].toLowerCase()
      trimmed = match[2]
    }
  }
  return { bytes: Buffer.from(trimmed, 'base64'), mime }
}

export function readImageDimensionsFromBytes(bytes, mime = '') {
  if (!bytes?.length) return null
  const png = readPngDimensions(bytes)
  if (png) return png
  const jpeg = readJpegDimensions(bytes)
  if (jpeg) return jpeg
  if (mime.includes('png')) return readPngDimensions(bytes)
  return readJpegDimensions(bytes)
}

function readPngDimensions(buf) {
  if (buf.length < 24) return null
  if (buf[0] !== 0x89 || buf.toString('ascii', 1, 4) !== 'PNG') return null
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

function readJpegDimensions(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null
  let i = 2
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1
      continue
    }
    const marker = buf[i + 1]
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = buf.readUInt16BE(i + 5)
      const width = buf.readUInt16BE(i + 7)
      if (width > 0 && height > 0) return { width, height }
      return null
    }
    if (i + 3 >= buf.length) break
    const segmentLength = buf.readUInt16BE(i + 2)
    if (segmentLength < 2) break
    i += 2 + segmentLength
  }
  return null
}

/** Fal custom size — multiples of 16, within GPT Image 2 limits. */
export function snapToFalCustomSize(width, height) {
  let w = Math.max(16, Math.round(Number(width) || 0))
  let h = Math.max(16, Math.round(Number(height) || 0))
  if (w < 16 || h < 16) return { width: 1024, height: 1024 }

  const edge = Math.max(w, h)
  if (edge > MAX_EDGE) {
    const scale = MAX_EDGE / edge
    w = Math.floor(w * scale)
    h = Math.floor(h * scale)
  }

  const aspect = Math.max(w / h, h / w)
  if (aspect > MAX_ASPECT) {
    if (w > h) w = Math.floor(h * MAX_ASPECT)
    else h = Math.floor(w * MAX_ASPECT)
  }

  w = Math.max(16, Math.floor(w / 16) * 16)
  h = Math.max(16, Math.floor(h / 16) * 16)

  if (w * h < MIN_PIXELS) {
    const scale = Math.sqrt(MIN_PIXELS / (w * h))
    w = Math.min(MAX_EDGE, Math.ceil((w * scale) / 16) * 16)
    h = Math.min(MAX_EDGE, Math.ceil((h * scale) / 16) * 16)
  }

  if (w * h > MAX_PIXELS) {
    const scale = Math.sqrt(MAX_PIXELS / (w * h))
    w = Math.max(16, Math.floor((w * scale) / 16) * 16)
    h = Math.max(16, Math.floor((h * scale) / 16) * 16)
  }

  return { width: w, height: h }
}

export function falCustomImageSizeFromBase64(base64Raw, overrides = {}) {
  const overrideW = Number(overrides.width)
  const overrideH = Number(overrides.height)
  if (Number.isFinite(overrideW) && Number.isFinite(overrideH) && overrideW > 0 && overrideH > 0) {
    return snapToFalCustomSize(overrideW, overrideH)
  }

  const { bytes, mime } = decodeBase64ImageBytes(base64Raw)
  const dims = readImageDimensionsFromBytes(bytes, mime)
  if (!dims) return snapToFalCustomSize(1024, 1024)
  return snapToFalCustomSize(dims.width, dims.height)
}
