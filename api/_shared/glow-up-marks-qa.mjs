import { anthropicKey, detectMediaType, parseJSONObjectFromText } from './anthropic.mjs'

const QA_TIMEOUT_MS = Number(process.env.FUTURE_SELF_GLOW_UP_MARKS_QA_TIMEOUT_MS) || 14_000
const QA_MODEL = (process.env.FUTURE_SELF_GLOW_UP_MARKS_QA_MODEL || 'claude-sonnet-4-20250514').trim()

export function glowUpMarksQaEnabled() {
  const raw = String(process.env.FUTURE_SELF_GLOW_UP_MARKS_QA ?? '0').trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false
  return Boolean(anthropicKey())
}

function inputHadNoPermanentMarks(vision) {
  const marks = vision?.skinMarks
  const hasMoles = Boolean(marks?.hasMoles) && (marks?.moleCount ?? 0) > 0
  return !hasMoles && !marks?.hasFreckles
}

async function fetchImageAsBase64(url) {
  const r = await fetch(String(url), { signal: AbortSignal.timeout(12_000) })
  if (!r.ok) return null
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf.length < 100) return null
  return buf.toString('base64')
}

async function compareMarksWithVision(inputBase64, outputBase64, vision) {
  const apiKey = anthropicKey()
  if (!apiKey) return null

  const marks = vision?.skinMarks || {}
  const system = 'You compare BEFORE/AFTER portrait edits. Output ONE minified JSON object only. No markdown.'
  const userText = `Image 1 = BEFORE (original selfie). Image 2 = AFTER (AI glow-up).

BEFORE marks: hasMoles=${Boolean(marks.hasMoles)}, moleCount=${marks.moleCount || 0}, hasFreckles=${Boolean(marks.hasFreckles)}.

Did AFTER add NEW permanent pigment marks (moles/Muttermale, freckles, beauty marks, dark brown spots) that were NOT in BEFORE?
- Fading acne/redness is OK.
- Pores are NOT marks.
- If BEFORE had zero moles and AFTER has any mole/Muttermal → inventedMoles=true, passed=false.

JSON keys: passed (boolean), inventedMoles (boolean), inventedFreckles (boolean), inventedCount (number), notes (string).`

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
    return {
      passed: Boolean(parsed.passed),
      inventedMoles: Boolean(parsed.inventedMoles),
      inventedFreckles: Boolean(parsed.inventedFreckles),
      inventedCount: Number(parsed.inventedCount) || 0,
      notes: String(parsed.notes || '').slice(0, 200),
    }
  } catch (err) {
    return { error: err?.name === 'AbortError' ? 'timeout' : String(err?.message || err) }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Step 3 — compare input vs output for invented moles/freckles.
 * @returns {Promise<{ passed: boolean, skipped?: boolean, inventedMoles?: boolean, notes?: string, error?: string }>}
 */
export async function validateGlowUpMarksQa(inputBase64, outputUrl, vision) {
  if (!glowUpMarksQaEnabled() || !inputBase64 || !outputUrl || !vision) {
    return { passed: true, skipped: true }
  }
  if (!inputHadNoPermanentMarks(vision)) {
    return { passed: true, skipped: true, reason: 'input_has_marks' }
  }

  const outputBase64 = await fetchImageAsBase64(outputUrl)
  if (!outputBase64) {
    return { passed: true, skipped: true, error: 'output_fetch_failed' }
  }

  const result = await compareMarksWithVision(inputBase64, outputBase64, vision)
  if (!result || result.error) {
    console.warn('glow-up marks qa error', result?.error)
    return { passed: true, skipped: true, error: result?.error || 'qa_failed' }
  }

  const failed = result.inventedMoles || result.inventedFreckles || result.passed === false
  console.log('glow-up marks qa', { passed: !failed, ...result })
  return {
    passed: !failed,
    inventedMoles: result.inventedMoles,
    inventedFreckles: result.inventedFreckles,
    inventedCount: result.inventedCount,
    notes: result.notes,
  }
}

export const MARKS_RETRY_PROMPT_SUFFIX = `
MARKS RETRY — previous edit INVENTED moles/Muttermale. FORBIDDEN to add ANY new pigment mark.
Output skin marks MUST match input EXACTLY: ZERO moles, ZERO Muttermale, ZERO freckles, ZERO beauty marks.
Fade active acne/redness ONLY — do NOT repaint skin texture or add brown/dark spots for realism.`

export const MARKS_RETRY_SYSTEM_SUFFIX = `
RETRY — last output added forbidden moles/Muttermale. This attempt: if input had ZERO moles → output MUST have ZERO moles. Copy input skin pigment pixel-for-pixel except fading active pimples.`
