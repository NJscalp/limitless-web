/**
 * director-review.mjs — der Director prüft sein eigenes Ergebnis.
 *
 * DAS IST DER KERN DES PRODUKTS, nicht ein Anhängsel. Der Unterschied zu jeder
 * anderen Foto-App ist nicht die Zahl der Filter, sondern dass hier jemand die
 * VERANTWORTUNG für das Ergebnis übernimmt:
 *
 *   Foto → Ziel verstehen → bearbeiten → EIGENES Ergebnis prüfen →
 *   notfalls korrigieren → fertiges Bild
 *
 * WAS DIE ALTE PRÜFUNG FALSCH MACHTE:
 * Sie war für „AI luxury LARP edits" geschrieben und vor allem MODUSBLIND —
 * dieselben Regeln für ein Farbgrading wie für einen kompletten Szenenwechsel.
 * Bei einem `grade` MUSS Pose, Kleidung und Ort identisch bleiben; bei einem
 * `restage` sollen sie sich gerade ändern. Eine Prüfung, die das nicht
 * unterscheidet, winkt entweder echte Fehler durch oder verwirft korrekte
 * Ergebnisse.
 *
 * Die Prüfung bekommt deshalb den Modus mit und misst gegen die Regeln, die
 * für DIESEN Auftrag gelten.
 */

import { anthropicKey, detectMediaType, parseJSONObjectFromText } from './anthropic.mjs'
import { callWaveSpeed } from './director-wavespeed.mjs'
import { brainModel, directorProvider } from './director-core.mjs'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

/**
 * Ein Urteil ueber zwei Bilder — direkt bei Anthropic, mit Cache auf dem
 * Regelwerk. Gibt `null` zurueck, wenn es nicht geht; dann uebernimmt
 * WaveSpeed.
 *
 * `thinking` und `effort` gibt es NUR hier. Fuer eine Pruefung ist das kein
 * Beiwerk: sie muss zwei Bilder vergleichen und entscheiden, ob dieselbe
 * Person zu sehen ist.
 */
async function viaAnthropic({ system, content }) {
  const apiKey = anthropicKey()
  if (!apiKey) return null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 50_000)
  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: brainModel(),
        max_tokens: 3000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'low' },
        // Das Regelwerk ist je Modus gleich und wiederholt sich bei jedem
        // Ergebnis — genau der Fall, fuer den es den Cache gibt.
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content }],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      console.error('director review anthropic failed', { status: r.status, message: data?.error?.message || null })
      return null
    }
    const text = (Array.isArray(data?.content) ? data.content : [])
      .filter((b) => b?.type === 'text').map((b) => b.text).join('\n')
    return { text, model: data?.model || brainModel() }
  } catch {
    clearTimeout(timeout)
    return null
  }
}


/** Gilt immer, egal welcher Auftrag. */
const ALWAYS = `1. IDENTITY — if a person is shown, is the result unmistakably the SAME person: same face, bone structure, features, eyes and EYE COLOUR, nose, mouth, jawline, skin tone and complexion, apparent age? Any noticeable change to the face is a fail. This is the single most important check.
1b. HAIR IS PART OF IDENTITY, and it is checked separately because it is where this fails most often. Same hairstyle, same length, same volume, same texture, same parting, same hairline, same colour. Hair that was shortened, lengthened, restyled, straightened, curled, recoloured, given bangs, cropped out of frame or simply removed is a FAIL — even when the rest of the face is perfect, even when the new hair looks better. The only exception is when the requested edit itself asked for that exact change to the hair.
2. HANDS AND DEFECTS — warped or extra fingers, extra or missing limbs, melted or duplicated objects, garbled or misspelled text and logos. A correctly rendered real brand is fine and expected; only garbled rendering fails.
3. NOT A NEW PICTURE — does this still read as the SAME PHOTOGRAPH, treated? Or does it read as a fresh AI image that merely resembles it? Plastic or waxy skin with no pores, illustration or CGI feel, light that could not physically occur in that room, a subject that looks re-drawn rather than re-lit — all fail. This is the check people notice without being able to name it.`

/** Was zusätzlich gilt, je nach Auftrag. */
const BY_MODE = {
  grade: `4. NOTHING BUT LIGHT AND COLOUR MAY HAVE CHANGED. Pose, framing, crop, camera angle, clothing, hair silhouette, background, location, every object and every person must be pixel-for-pixel the same scene. If the subject moved, the crop shifted, an object appeared or vanished, or the outfit changed in any way — fail, however good it looks.
5. DID THE LOOK ACTUALLY LAND? A grade that changed nothing perceptible is also a fail. The requested camera character must be visibly present.`,

  retouch: `4. ONLY THE NAMED THING MAY BE GONE. Whatever was to be removed or repaired is handled — and NOTHING ELSE changed. Pose, framing, clothing, light, background and all remaining objects stay exactly as they were.
5. THE REPAIR MUST BE INVISIBLE. Where something was removed, the surface behind it must be plausible: continuous texture, correct perspective, matching grain and light. Smears, blur patches, repeated patterns or a suspiciously clean area are fails.`,

  restage: `4. IDENTITY CARRIES OVER, THE WORLD DOES NOT. Face, hair (style, length and colour) and skin tone stay exactly; pose, clothing, location and framing are allowed and expected to change. Creative freedom here is about the world around the person, never about the person.
5. IS IT PHYSICALLY COHERENT? One light direction across person, objects and ground. Shadows fall the same way. Feet or wheels actually contact the ground. Scale is believable. The person is not visibly pasted onto a background — mismatched edges, a halo, or a subject sharper than everything around them are fails.`,

  generate: `4. DID IT BUILD WHAT WAS ASKED FOR? Judge against the brief, not against an original.
5. IS IT COHERENT? Consistent light, believable anatomy, no melted or duplicated detail.`,
}

const MODES = Object.keys(BY_MODE)

function buildSystem(mode) {
  return `You are the Photo Director reviewing YOUR OWN work before anyone sees it. You are shown the ORIGINAL photo(s) first, then your EDITED RESULT last. Judge only the result.

The job for this edit was: ${mode.toUpperCase()}.

${ALWAYS}
${BY_MODE[mode]}

Be strict but fair: tiny imperfections are fine, fail only on what a person would actually notice. Weight IDENTITY and NOT-A-NEW-PICTURE highest.

Reply with ONLY this JSON object, no prose:
{"ok": true|false, "issues": ["short issue", ...], "severity": "minor"|"look"|"major", "correctedPrompt": "..."|null}

THREE KINDS OF FAILURE, and they are not the same thing:
- **"major"** — identity, hair, hands or the not-a-new-picture check failed. The person is no longer themselves, their hair changed, anatomy is broken, or it reads as a fresh AI image. Worst, and always worth another attempt.

ANY drift in checks 1 or 1b is ALWAYS "major". Never "look", never "minor", no matter how small it seems and no matter how attractive the result is. A prettier person who is not the same person is the worst outcome this pipeline can produce — worse than doing nothing at all.
- **"look"** — technically clean and still WRONG: the direction that was asked for did not land. The grade is barely there, the flash reads as ambient light, the mood asked for is absent, the result is simply the original with a tint. Nothing is broken — it just is not the photograph that was promised. This is a real failure and gets ONE more attempt.
- **"minor"** — everything else. Small imperfections a person would not notice. No retry.

Do not inflate "look": use it when the requested photographic direction is genuinely absent or unrecognisable, not when it is merely subtler than you would have made it.

If ok is false, write correctedPrompt as a full, self-contained prompt to RE-RUN on the ORIGINAL photo(s). It must open by locking identity ("Keep the exact same person — identical face, features, bone structure, eye colour, skin tone, and identical hair: same style, length, parting, hairline and colour; do not beautify, restyle or redraw"), then NAME what drifted ("the previous result changed the subject's hairstyle and face shape"), then restate the intended edit while explicitly repairing every issue you listed. Never drop a real brand to fix a rendering problem — keep it and change how it is shown.`
}

const clamp = (s, n = 4000) => String(s ?? '').slice(0, n)

/** Woran man eine Identitaets- oder Haar-Beanstandung erkennt. */
/** Wörter, die NUR bei echtem Identitätsverlust vorkommen können.
 *
 * DIE ERSTE FASSUNG WAR ZU BREIT UND HAT EIN GUTES BILD WEGGEWORFEN.
 * Sie enthielt `face`, `eyes`, `skin tone`, `complexion`, `age`, `lips`,
 * `cheek`, `chin`. Genau diese Wörter benutzt ein Prüfer aber auch, wenn eine
 * FARBKORREKTUR ihre Arbeit tut: „skin tone is warmer", „softer around the
 * eyes", „slightly brighter face". Ein G7X-Blitz-Grade ist deshalb als
 * Identitätsverlust eingestuft und verworfen worden — der Nutzer bekam nichts,
 * obwohl das Bild in Ordnung war.
 *
 * Was hier steht, kann eine Farbkorrektur nicht auslösen: eine andere Person,
 * eine veränderte Kopfform, andere Haare. Alles, was eine Belichtung ebenfalls
 * verschieben würde, ist raus.
 */
const IDENTITAET_WOERTER = [
  // Die Person selbst ist eine andere.
  'identity', 'different person', 'another person', 'not the same person',
  'looks like someone else', 'different woman', 'different man', 'new person',
  'lookalike', 'look-alike',
  // Die Kopfform wurde verändert — keine Frage der Belichtung.
  'face shape', 'facial structure', 'facial geometry', 'bone structure',
  'jawline', 'jaw shape', 'nose shape', 'different nose', 'reshaped',
  'eye colour', 'eye color',
  // Haare. Ein Grade ändert keine Frisur.
  'hair', 'hairstyle', 'hairline', 'bangs', 'fringe', 'ponytail', 'braid', 'wig',
]

/** Bringt die Antwort des Modells in die Form, die die App bekommt.
 *
 * Herausgeloest, damit die Identitaetssperre pruefbar ist, ohne ein Modell zu
 * fragen — sie ist die eine Regel hier, die niemals still nachgeben darf.
 */
export function formeUrteil(verdict, mode) {
  const corrected = typeof verdict.correctedPrompt === 'string' ? verdict.correctedPrompt.trim() : ''
  const issues = Array.isArray(verdict.issues) ? verdict.issues.map(String).slice(0, 6) : []

  let severity = verdict.severity === 'major' ? 'major'
    : verdict.severity === 'look' ? 'look' : 'minor'
  let ok = verdict.ok !== false

  // IDENTITAETSDRIFT WIRD NICHT VERHANDELT.
  //
  // Der Prompt sagt bereits, dass Gesicht und Haare immer „major" sind. Auf
  // eine Prompt-Regel allein darf das aber nicht ankommen: sie ist genau die
  // Art Anweisung, die ein Modell unter Druck weicher auslegt („die Haare sind
  // nur etwas kuerzer, also eher look"). Sobald eine gemeldete Beanstandung von
  // Gesicht oder Haaren spricht, wird die Einstufung im CODE auf „major"
  // gezogen und das Ergebnis abgelehnt.
  //
  // WIR ERFINDEN KEINE FEHLER, DIE DAS MODELL NICHT GEMELDET HAT.
  //
  // Die erste Fassung stufte auch dann hoch, wenn das Modell `ok: true`
  // gesagt hatte — eine beiläufige Bemerkung reichte. Damit konnte ein
  // einwandfreies Ergebnis an einer Formulierung scheitern. Die Sperre greift
  // jetzt nur noch dort, wo das Modell selbst einen Fehler sieht; sie
  // verschärft dessen Einstufung, sie ersetzt sie nicht.
  //
  // Falsch-negative bleiben teurer als falsch-positive — aber ein
  // Falsch-positiv, das dem Nutzer sein fertiges Bild wegnimmt, ist kein
  // billiger Fehler mehr.
  if (ok === false && issues.some(nenntIdentitaet)) {
    if (severity !== 'major' || ok) {
      console.warn('director review identity override', { war: verdict.severity, warOk: verdict.ok, issues })
    }
    severity = 'major'
    ok = false
  }

  return { ok, issues, severity, correctedPrompt: corrected || null, mode }
}

export function nenntIdentitaet(issue) {
  const t = String(issue || '').toLowerCase()
  return IDENTITAET_WOERTER.some((w) => t.includes(w))
}

export async function runReview(body) {
  const mode = MODES.includes(body?.mode) ? body.mode : 'grade'
  const prompt = clamp(body?.prompt || '')
  const originals = Array.isArray(body?.images)
    ? body.images.filter((x) => typeof x === 'string' && x.length > 32).slice(0, 3)
    : []
  const result = typeof body?.result === 'string' && body.result.length > 32 ? body.result : ''

  // Ohne Vergleichsmaterial kein Urteil — dann lieber durchwinken als raten.
  if (!result || (originals.length === 0 && mode !== 'generate')) {
    return { status: 200, json: { ok: true, issues: [], severity: 'minor', correctedPrompt: null } }
  }

  const content = []
  originals.forEach((b64, i) => {
    content.push({ type: 'text', text: `Original photo ${i + 1}:` })
    content.push({ type: 'image', source: { type: 'base64', media_type: detectMediaType(b64), data: b64 } })
  })
  content.push({ type: 'text', text: 'Your edited RESULT to review:' })
  content.push({ type: 'image', source: { type: 'base64', media_type: detectMediaType(result), data: result } })
  content.push({ type: 'text', text: `The edit you ran was: "${prompt}". Review the RESULT now and reply with the JSON only.` })

  // Derselbe Weg wie die Entscheidung: direkt, mit Cache — und WaveSpeed als
  // Netz, falls der Zugang ausfaellt. Beide fahren `claude-opus-5`.
  const system = buildSystem(mode)
  let text = ''
  if (directorProvider() === 'anthropic') {
    const a = await viaAnthropic({ system, content })
    if (a) text = a.text
  }
  if (!text) {
    const w = await callWaveSpeed({
      model: brainModel(), system,
      messages: [{ role: 'user', content }], maxTokens: 3000,
    }).catch(() => null)
    // Eine gescheiterte Prüfung darf ein gutes Bild nicht aufhalten.
    if (!w?.ok) {
      console.error('director review failed', { error: w?.error || 'unreachable', detail: w?.detail || null })
      return { status: 200, json: { ok: true, issues: [], severity: 'minor', correctedPrompt: null } }
    }
    text = w.text || ''
  }

  let verdict
  try { verdict = parseJSONObjectFromText(text) } catch { verdict = null }
  if (!verdict || typeof verdict !== 'object') {
    return { status: 200, json: { ok: true, issues: [], severity: 'minor', correctedPrompt: null } }
  }

  return { status: 200, json: formeUrteil(verdict, mode) }
}
