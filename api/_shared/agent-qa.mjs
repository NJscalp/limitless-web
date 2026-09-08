// api/_shared/agent-qa.mjs
//
// Realism-QA-Agent — der zweite, spezialisierte Agent. Bekommt das/die ORIGINAL-
// Foto(s) + das gerenderte ERGEBNIS und benotet streng:
//   1. IDENTITY  — bei echter Person: gleiches Gesicht?
//   2. REALISM   — wirkt es wie ein echtes Handyfoto (kein Plastik/CGI)?
//   3. DEFECTS   — verformte Hände/Finger, extra Gliedmaßen, Fake-Logos/Text?
//   4. BRIEF     — wurde der Edit-Wunsch erfüllt?
// Bei Problemen liefert er einen korrigierten Prompt zurück → die App rendert
// EINMAL neu. Als _shared-Modul (kein extra Function-Slot), aufgerufen von
// api/gpt-image/[action].mjs bei action === "qa".
//
// Rückgabe: { status, json:{ ok, issues, correctedPrompt } }

import { anthropicKey, detectMediaType, parseJSONObjectFromText } from './anthropic.mjs'
// Dasselbe Modell wie der Director — sonst urteilt die Kontrolle nach
// anderen Maßstäben als die Instanz, die den Prompt geschrieben hat.
import { brainModel as agentModel } from './director-core.mjs'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

const SYSTEM = `You are a strict quality-control reviewer for AI luxury "LARP" photo edits (rich-lifestyle flexing that must look 100% real). You are shown the ORIGINAL photo(s) first, then the EDITED RESULT last. Judge ONLY the result:

1. IDENTITY — if an original shows a real person, is the result unmistakably the SAME person: same face, bone structure, features, skin tone, hairline? ANY noticeable change to the face = fail.
2. REALISM — does it look like a real photo shot on a phone? Plastic/airbrushed/waxy skin, CGI or illustration look, impossible lighting = fail.
3. DEFECTS — warped or extra hands/fingers, extra/missing limbs, GARBLED/warped/misspelled text or logos, melted or duplicated objects = fail. NOTE: real, correctly-rendered brand logos/badges (cars, watches, fashion) are FINE and expected — do NOT fail for the mere presence of a real brand logo; only fail if the text/logo looks garbled or wrong.
4. BRIEF — did it actually perform the requested edit?

Be strict but fair: tiny imperfections are fine, only fail on clearly visible problems. Weight IDENTITY and DEFECTS highest.

Reply with ONLY a JSON object, no prose:
{"ok": true|false, "issues": ["short issue", ...], "correctedPrompt": "..."|null}
If ok is true, issues is [] and correctedPrompt is null.
If ok is false, write correctedPrompt as a full, self-contained edit prompt to RE-RUN on the ORIGINAL photo(s): it MUST open by locking the person's identity ("Keep the exact same person from the photo — identical face, features, bone structure, skin tone and hair — do not change, beautify or redraw the face"), then re-describe the intended scene while explicitly fixing every issue you listed (e.g. "render natural non-plastic skin with real texture", "correct, natural hands with five fingers", "render the badge and dial text crisp and correctly spelled"). NEVER remove a real brand in the corrected prompt — keep the named car, watch or label and fix HOW it renders, e.g. show the badge at an angle or slightly out of focus rather than dropping it.`

function clampText(s, max = 4000) {
  const t = String(s == null ? '' : s)
  return t.length > max ? t.slice(0, max) : t
}

export async function runQA(body) {
  const apiKey = anthropicKey()
  if (!apiKey) return { status: 500, json: { error: 'server_misconfigured_missing_anthropic_key' } }

  const prompt = clampText(body?.prompt || '')
  const originals = Array.isArray(body?.images)
    ? body.images.filter((x) => typeof x === 'string' && x.length > 32).slice(0, 3)
    : []
  const result = typeof body?.result === 'string' && body.result.length > 32 ? body.result : ''

  if (!result || originals.length === 0) {
    // Ohne Vergleichsmaterial kein Urteil → als "ok" behandeln (kein Re-Render).
    return { status: 200, json: { ok: true, issues: [], correctedPrompt: null } }
  }

  const content = []
  originals.forEach((b64, i) => {
    content.push({ type: 'text', text: `Original photo ${i + 1}:` })
    content.push({ type: 'image', source: { type: 'base64', media_type: detectMediaType(b64), data: b64 } })
  })
  content.push({ type: 'text', text: 'Edited RESULT to review:' })
  content.push({ type: 'image', source: { type: 'base64', media_type: detectMediaType(result), data: result } })
  content.push({ type: 'text', text: `The requested/used edit was: "${prompt}". Review the RESULT now and reply with the JSON only.` })

  const model = agentModel()
  const payload = {
    model,
    // Sonnet 5 denkt standardmäßig, und max_tokens deckelt Denken + Antwort
    // gemeinsam — mit 900 wäre das JSON-Urteil oft abgeschnitten worden.
    max_tokens: 3000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    system: SYSTEM,
    messages: [{ role: 'user', content }],
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 50_000)
  let r
  try {
    r = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    // QA darf den Flow nie blockieren → im Zweifel "ok".
    return { status: 200, json: { ok: true, issues: [], correctedPrompt: null, softFail: String(err?.message || err) } }
  }
  clearTimeout(timeout)

  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    return { status: 200, json: { ok: true, issues: [], correctedPrompt: null, softFail: 'anthropic_http' } }
  }

  const textBlock = Array.isArray(data?.content) ? data.content.find((c) => c.type === 'text') : null
  const parsed = textBlock?.text ? parseJSONObjectFromText(textBlock.text) : null
  if (!parsed || typeof parsed.ok !== 'boolean') {
    return { status: 200, json: { ok: true, issues: [], correctedPrompt: null, softFail: 'parse' } }
  }

  const ok = parsed.ok === true
  const issues = Array.isArray(parsed.issues) ? parsed.issues.map((s) => clampText(s, 200)).slice(0, 6) : []
  const correctedPrompt = ok ? null : (typeof parsed.correctedPrompt === 'string' ? clampText(parsed.correctedPrompt, 6000) : null)

  return { status: 200, json: { ok, issues, correctedPrompt } }
}
