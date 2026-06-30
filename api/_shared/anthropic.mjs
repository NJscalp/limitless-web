const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

export function extractJSONObject(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return text
  return text.slice(start, end + 1)
}

/** Parse JSON from Claude text blocks — tolerates minor formatting issues. */
export function parseJSONObjectFromText(text) {
  let raw = String(text || '').trim()
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  raw = extractJSONObject(raw)
  try {
    return JSON.parse(raw)
  } catch {
    const cleaned = raw
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/[\u0000-\u001f]/g, ' ')
    try {
      return JSON.parse(cleaned)
    } catch {
      // Truncated JSON — close open strings/brackets heuristically
      let repaired = cleaned
      const openBraces = (repaired.match(/{/g) || []).length
      const closeBraces = (repaired.match(/}/g) || []).length
      const openBrackets = (repaired.match(/\[/g) || []).length
      const closeBrackets = (repaired.match(/]/g) || []).length
      if (openBraces > closeBraces || openBrackets > closeBrackets) {
        repaired = repaired.replace(/,\s*"[^"]*"?\s*:\s*"[^"]*"?$/, '')
        repaired = repaired.replace(/,\s*$/, '')
        for (let i = 0; i < openBrackets - closeBrackets; i += 1) repaired += ']'
        for (let i = 0; i < openBraces - closeBraces; i += 1) repaired += '}'
      }
      return JSON.parse(repaired)
    }
  }
}

export function detectMediaType(b64) {
  if (typeof b64 !== 'string' || b64.length < 16) return 'image/jpeg'
  const head = b64.slice(0, 16)
  if (head.startsWith('iVBOR')) return 'image/png'
  if (head.startsWith('/9j/')) return 'image/jpeg'
  if (head.startsWith('UklGR')) return 'image/webp'
  if (head.startsWith('R0lGO')) return 'image/gif'
  return 'image/jpeg'
}

export async function anthropicVisionJSON({
  apiKey,
  model,
  system,
  userText,
  imageBase64,
  mediaType,
  max_tokens = 2000,
  temperature = 0.22,
  timeoutMs = Number(process.env.ANTHROPIC_VISION_TIMEOUT_MS) || 52_000,
  signal: externalSignal,
}) {
  const payload = {
    model,
    max_tokens,
    temperature,
    system,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType || detectMediaType(imageBase64),
              data: imageBase64,
            },
          },
          { type: 'text', text: userText },
        ],
      },
    ],
  }

  const controller = new AbortController()
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null

  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  let r
  try {
    r = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (fetchErr) {
    if (fetchErr?.name === 'AbortError') {
      const err = new Error('anthropic_timeout')
      err.status = 504
      throw err
    }
    throw fetchErr
  } finally {
    if (timeout) clearTimeout(timeout)
  }

  const data = await r.json().catch(() => ({}))

  if (!r.ok) {
    const err = new Error('anthropic_http')
    err.status = r.status
    err.detail = data
    throw err
  }

  const textBlock = Array.isArray(data?.content) ? data.content.find((c) => c.type === 'text') : null
  const text = textBlock?.text
  if (!text) {
    const err = new Error('no_text_in_response')
    err.detail = data
    throw err
  }

  return parseJSONObjectFromText(text)
}

export function anthropicKey() {
  return (process.env.ANTHROPIC_API_KEY || '').trim()
}

export function anthropicModel() {
  return (process.env.MODEL || 'claude-opus-4-6').trim()
}
