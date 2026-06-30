// AI Fruit Story – Drehbuch-Planner (Claude). Schreibt aus Preset + Cast +
// Stil jedes Mal ein NEUES szenenweises Drehbuch (Titel, Bild-Prompt, Dialog,
// Action je Szene). Gegenstück zu Zyvos "fruit-story-planner".
//
// Liegt als _shared-Modul (zählt nicht als eigene Serverless Function) und wird
// aus der seedance-Route (action "fruitplan") aufgerufen → Hobby-Funktionslimit
// bleibt eingehalten.

import { anthropicKey, anthropicModel, parseJSONObjectFromText } from './anthropic.mjs'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

// Master-Regeln (sinngemäß wie Zyvos visual/storytelling/consistency/scene/
// negative rules, eigene Formulierung).
const STORY_SYSTEM = `You are a viral short-form video screenwriter for a "3D AI fruit story" TikTok series.
You write punchy, emotional fruit-drama mini-series where anthropomorphic 3D fruit characters act out a story across a few cinematic vertical (9:16) scenes.

You will receive: a story premise, the cast (fruit characters with names and roles), the number of scenes, and a visual style. Write a fresh, original story that fits the premise.

HARD RULES:
- Output ONLY valid JSON, no commentary, in exactly this shape:
  {"title": string, "scenes": [{"title": string, "characters": [string], "image": string, "dialogue": string, "action": string}]}
- Produce EXACTLY the requested number of scenes.
- "characters" must be a subset of the provided cast names (use the names verbatim).
- "image": a vivid description of THIS scene's single cinematic key-frame — who is in frame, their expression/emotion, the setting, framing and lighting. Describe them as polished anthropomorphic 3D fruit characters. Do NOT mention any on-screen text, captions, logos or watermarks.
- "dialogue": the short spoken line(s) the characters SAY out loud in this scene (this becomes real spoken audio). Keep it natural, dramatic and specific to the reveal — at most 1-2 short lines, format like 'Orange Mom: "..."'. May be empty for a pure-reaction beat.
- "action": one clear thing that visibly happens + one camera move, so the beat reads instantly in a few seconds.
- Story craft: every scene must escalate, reveal, confront or resolve — no filler. Build a clear arc (hook → rising tension → twist → payoff) across the scenes. Strong, readable emotions.
- Keep each character's identity consistent and never swap one character into another.
- Make it genuinely DIFFERENT every time, even for the same premise.`

export async function planFruitStory(input = {}) {
  const apiKey = anthropicKey()
  if (!apiKey) {
    const err = new Error('server_misconfigured_missing_anthropic_key'); err.status = 500; throw err
  }

  const sceneCount = Math.max(3, Math.min(8, Math.round(Number(input.sceneCount) || 5)))
  const cast = Array.isArray(input.characters) ? input.characters : []
  const castText = cast.length
    ? cast.map((c) => `- ${c.name || c}${c.role ? ` (${c.role})` : ''}`).join('\n')
    : '- Orange Mom (emotional lead)\n- Banana (rival)'
  const style = String(input.style || 'Cinematic 3D').trim()
  const premise = String(input.storyIdea || '').trim()
    || 'A dramatic everyday fruit-family moment that spirals into a shocking twist.'

  const userText = `PREMISE:\n${premise}\n\nCAST (use these exact names):\n${castText}\n\nNUMBER OF SCENES: ${sceneCount}\nVISUAL STYLE: ${style}\n\nWrite the story now as JSON.`

  const model = (process.env.FRUIT_STORY_MODEL || '').trim() || anthropicModel()
  const payload = {
    model,
    max_tokens: 2200,
    temperature: 1.0,
    system: STORY_SYSTEM,
    messages: [{ role: 'user', content: [{ type: 'text', text: userText }] }],
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 55_000)
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
  } finally {
    clearTimeout(timeout)
  }

  const data = await r.json().catch(() => ({}))
  if (!r.ok) { const err = new Error('anthropic_http'); err.status = r.status; err.detail = data; throw err }
  const textBlock = Array.isArray(data?.content) ? data.content.find((c) => c.type === 'text') : null
  const text = textBlock?.text
  if (!text) { const err = new Error('no_text_in_response'); err.detail = data; throw err }

  const parsed = parseJSONObjectFromText(text)
  let scenes = Array.isArray(parsed?.scenes) ? parsed.scenes : []
  scenes = scenes.slice(0, sceneCount).map((s, i) => ({
    title: String(s?.title || `Scene ${i + 1}`),
    characters: Array.isArray(s?.characters) ? s.characters.map(String) : [],
    image: String(s?.image || ''),
    dialogue: String(s?.dialogue || ''),
    action: String(s?.action || ''),
  })).filter((s) => s.image)
  if (!scenes.length) { const err = new Error('planner_returned_no_scenes'); err.status = 502; err.detail = parsed; throw err }

  return { title: String(parsed?.title || 'Fruit Story'), scenes }
}
