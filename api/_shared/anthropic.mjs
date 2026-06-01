const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

export function extractJSONObject(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return text
  return text.slice(start, end + 1)
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

  const r = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(payload),
  })
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

  return JSON.parse(extractJSONObject(text))
}

export function anthropicKey() {
  return (process.env.ANTHROPIC_API_KEY || '').trim()
}

export function anthropicModel() {
  return (process.env.MODEL || 'claude-opus-4-6').trim()
}
