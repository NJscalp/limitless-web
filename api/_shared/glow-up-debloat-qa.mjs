import { anthropicKey, detectMediaType, parseJSONObjectFromText } from './anthropic.mjs'

const QA_TIMEOUT_MS = Number(process.env.FUTURE_SELF_GLOW_UP_DEBLOAT_QA_TIMEOUT_MS) || 14_000
const QA_MODEL = (process.env.FUTURE_SELF_GLOW_UP_DEBLOAT_QA_MODEL || 'claude-sonnet-4-20250514').trim()

export function glowUpDeBloatQaEnabled() {
  const raw = String(process.env.FUTURE_SELF_GLOW_UP_DEBLOAT_QA ?? '1').trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false
  return Boolean(anthropicKey())
}

async function fetchImageAsBase64(url) {
  const r = await fetch(String(url), { signal: AbortSignal.timeout(12_000) })
  if (!r.ok) return null
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf.length < 100) return null
  return buf.toString('base64')
}

export { fetchImageAsBase64 as fetchGlowUpOutputBase64 }

async function compareDeBloatWithVision(inputBase64, outputBase64) {
  const apiKey = anthropicKey()
  if (!apiKey) return null

  const system = 'You compare BEFORE/AFTER portrait glow-up edits. Output ONE minified JSON object only. No markdown.'
  const userText = `Image 1 = BEFORE (original selfie). Image 2 = AFTER (AI glow-up de-bloat edit).

Did AFTER show a CLEARLY VISIBLE reduction in BUCCAL CHEEK / MID-FACE puffiness vs BEFORE?
Check separately (cheeks are MOST important):
- buccal cheek roundness / mid-face fullness (MUST look SLIMMER — this is the primary pass/fail criterion)
- under-eye bags / infraorbital puffiness
- submental / under-chin soft tissue
- jaw-neck separation (soft tissue only — bone width unchanged)

If ONLY jaw/under-eye changed but buccal cheeks still look equally round/full → cheekPuffinessReduced=false, sufficientDeBloat=false.
If cheek/mid-face puffiness unchanged → sufficientDeBloat=false.

JSON keys:
sufficientDeBloat (boolean),
cheekPuffinessReduced (boolean),
underEyeReduced (boolean),
submentalReduced (boolean),
overallChangeVisible (boolean),
notes (string, max 120 chars).`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), QA_TIMEOUT_MS)

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: QA_MODEL,
        max_tokens: 280,
        temperature: 0,
        system,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: detectMediaType(inputBase64),
                data: inputBase64,
              },
            },
            { type: 'text', text: 'BEFORE ↑' },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: detectMediaType(outputBase64),
                data: outputBase64,
              },
            },
            { type: 'text', text: userText },
          ],
        }],
      }),
      signal: controller.signal,
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) return { error: 'anthropic_http', status: r.status }

    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
    const parsed = parseJSONObjectFromText(text)
    const sufficient = Boolean(parsed.sufficientDeBloat)
    const cheek = Boolean(parsed.cheekPuffinessReduced)
    const underEye = Boolean(parsed.underEyeReduced)
    const overall = Boolean(parsed.overallChangeVisible)
    const passed = cheek && (sufficient || overall)
    return {
      passed,
      sufficientDeBloat: sufficient,
      cheekPuffinessReduced: cheek,
      underEyeReduced: underEye,
      submentalReduced: Boolean(parsed.submentalReduced),
      overallChangeVisible: overall,
      notes: String(parsed.notes || '').slice(0, 200),
    }
  } catch (err) {
    return { error: err?.name === 'AbortError' ? 'timeout' : String(err?.message || err) }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Step 3 — compare input vs output for insufficient de-bloat / near-identical edit.
 */
export async function validateGlowUpDeBloatQa(inputBase64, outputUrl) {
  if (!glowUpDeBloatQaEnabled() || !inputBase64 || !outputUrl) {
    return { passed: true, skipped: true }
  }

  const outputBase64 = await fetchImageAsBase64(outputUrl)
  if (!outputBase64) {
    return { passed: true, skipped: true, error: 'output_fetch_failed' }
  }

  const result = await compareDeBloatWithVision(inputBase64, outputBase64)
  if (!result || result.error) {
    console.warn('glow-up debloat qa error', result?.error)
    return { passed: true, skipped: true, error: result?.error || 'qa_failed' }
  }

  console.log('glow-up debloat qa', { passed: result.passed, ...result })
  return result
}

export const DEBLOAT_RETRY_PROMPT_SUFFIX = `
CHEEK RETRY — buccal cheeks/mid-face still too round. MANDATORY: cheeks visibly SLIMMER than input. Do NOT only edit jaw/under-eye. Bones frozen.`

export const SECOND_PASS_SYSTEM_SUFFIX = `
CHEEK-ONLY PASS: buccal cheeks + mid-face must look significantly slimmer than THIS input. Do NOT only sharpen jaw/under-eye while cheeks stay round. Bones frozen.`

export const DEBLOAT_RETRY_SYSTEM_SUFFIX = `
RETRY — last output only defined jaw/under-eye but buccal cheeks still round. Maximum cheek/mid-face slimming — bones frozen.`
