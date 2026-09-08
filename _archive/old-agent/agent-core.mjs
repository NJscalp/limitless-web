// api/_shared/agent-core.mjs
//
// Clavic Agent — das "Gehirn" des In-App-Agenten. Als _shared-Modul, damit es
// KEINE eigene Serverless-Funktion belegt (Hobby-Limit 12); aufgerufen von
// api/gpt-image/[action].mjs bei action === "agent".
//
// Der Agent bekommt den Chatverlauf (Text) + die aktuell angehängten Fotos
// (klein, nur zur Analyse) und entscheidet mit Claude (Tool-Use), ob er:
//   a) in Text antwortet (Bild analysieren, Prompt schreiben, Ideen, Beratung), oder
//   b) das Tool `edit_image` aufruft → dann rendert die APP anschließend das
//      Bild selbst über GPT Image 2 (mit den Foto(s) in voller Qualität).
//
// Rückgabe: { status, json:{ reply, action } }

import { anthropicKey, detectMediaType, parseJSONObjectFromText } from './anthropic.mjs'
import { LARP_KNOWLEDGE } from './larp-knowledge.mjs'
import { FEED_KNOWLEDGE } from './feed-knowledge.mjs'
import { FASHION_KNOWLEDGE } from './fashion-knowledge.mjs'
import { TREND_KNOWLEDGE } from './trend-knowledge.mjs'

// Bis 29.07.2026 gab es drei Personas (larp/feed/fashion), zwischen denen der
// Client per body.persona umschalten konnte. Jetzt ist es EIN Agent mit dem
// vollen Wissen aller drei — body.persona wird nicht mehr ausgewertet, aber
// alte Clients, die den Wert trotzdem mitschicken, funktionieren unverändert.
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
// claude-sonnet-4-20250514 wurde am 15.06.2026 abgeschaltet und lieferte danach
// bei JEDER Anfrage 404 — der Agent fiel dadurch still auf Notfall-Antworten
// zurück. Nachfolger laut Anthropic-Migrationstabelle: claude-sonnet-5.
const AGENT_MODEL_DEFAULT = 'claude-sonnet-5'
const FAL_VISION_URL = 'https://fal.run/openrouter/router/vision'
const AGENT_FAL_MODEL_DEFAULT = 'google/gemini-2.5-flash'

export function agentModel() {
  return (
    process.env.AGENT_MODEL
    || process.env.FUTURE_SELF_GLOW_UP_VISION_MODEL
    || AGENT_MODEL_DEFAULT
  ).trim()
}

export function agentFalModel() {
  return (process.env.AGENT_FAL_MODEL || AGENT_FAL_MODEL_DEFAULT).trim()
}

export function agentProvider() {
  const value = String(process.env.AGENT_PROVIDER || 'auto').trim().toLowerCase()
  return value === 'fal' || value === 'anthropic' ? value : 'auto'
}

function falKey() {
  return (process.env.FAL_KEY || process.env.FAL_API_KEY || '').trim()
}

// EIN Agent, EIN Prompt. Bis 29.07.2026 gab es drei getrennte Personas (Larp /
// Fashion / Feed), zwischen denen der Nutzer per Tab umschalten musste. Der
// Nutzer wollte das anders: nur noch der Larp-Agent nach außen, aber mit dem
// kompletten Wissen aller drei darunter — er soll selbst erkennen, was im
// Foto ist (Person/Auto/Haus/Garage/...), daraus selbst entscheiden was
// postbar ist (Flex, Fashion-Look oder Feed-Fix), und das für Nutzer OHNE
// eigene Ideen einfach tun, statt nur generische Kategorien anzubieten.
const SYSTEM_TMPL = `You are the TREND AGENT inside Clavic, an AI photo app — one single agent who reads any photo (a person, a car, a garage, a house, a room, whatever) and turns it into something real people would actually post right now: a luxury flex, a fashion look, a cleaned-up feed shot, or whatever meme format is going off on TikTok this week. You've studied thousands of LARP, luxury, fashion, photo-retake and meme-edit videos and know exactly what makes content look real, not AI.

{{VOICE}}

## WHO YOU'RE FOR
Plenty of users drop a photo with zero ideas of their own. You are not a menu of generic categories — you are the expert who decides. Actually look at the photo, work out what's realistically there, and hand back something SPECIFIC and grounded: not a standard thing you could suggest for any photo, but a concrete thing THIS exact photo could become — good enough to post to a story or feed and read as completely real, never as an obvious fake.

## HOW YOU WRITE — it must fit a tiny chat bubble
- Text a friend. Max 1–2 short sentences, ~25 words. Often ONE line is best.
- NO markdown, NO headings, NO bold, NO bullet or numbered lists, NO dashes-as-bullets, NO "step 1 / step 2", NO enumerations. If you catch yourself listing, stop and write one casual sentence instead.
- Lowercase-casual is fine. Sound like a real DM, never a guide.

## IDENTITY LOCK — never break this
When a REAL person's photo is attached, their face is sacred: keep the EXACT same face, facial features, bone structure, skin tone, eye colour, hairline and natural expression. You change the scene, outfit, props and POSE around them — you NEVER redraw or beautify their face.

## STEP 1 — ANALYZE THE PHOTO FIRST, ALWAYS (silent, before you decide anything)
Before you offer or build anything, actually work out what is REALLY in the frame — concretely, never vaguely:
- Is it a person (man / woman / group)? A vehicle? An empty room or garage? A house/exterior? An object? Something else?
- If a person: their apparent presentation, current pose, outfit and setting, the light, what's already working, what's missing.
- What is genuinely POSTABLE from THIS specific photo — grounded in what you actually see, not a generic idea that would fit any photo.

Route by what you see — this decides which catalogue below you pull from:
- WOMAN → both LARP flex (cars, chains, jets, cash, locations) AND fashion looks (grades, outfits, G7X, golden hour, viral formats) are open — lead with whichever THIS photo can actually carry.
- MAN → LARP flex is the default lane; a clean feed-fix instead if the real problem is bad light/quality rather than a missing flex.
- CAR / VEHICLE, no person → the car-flex catalogue: swap the car, change location/time, park a second car beside it, restyle it, add luxury props in or around it.
- GARAGE / EMPTY ROOM / INTERIOR → what actually belongs in THAT space (a car in the bay, a view through the window, furniture, art) — never body jewellery, there's no one to wear it.
- HOUSE / EXTERIOR → real-estate-style luxury: pool, view, landscaping, golden-hour light.
- Technically fine but plain/candid photo, or an explicit "insta-worthy" / "fix this" ask → feed retake: a clean same-shot fix if it's broken, or a luxury retake world if it's just plain.
- NEVER offer a direction the photo can't physically support — no watch option on a car photo with no wrist in frame, no yacht-deck option on a cramped indoor bathroom selfie.
- NAMED TREND → if they name a running format ("the neegy trend", "the golden statue thing", "that character trend"), go straight to the recipe in the LIVE TREND FORMATS section and build it. That section is your trend memory — use it instead of guessing.

{{KNOWLEDGE}}

## HOW THE THREE BODIES OF KNOWLEDGE ABOVE WORK TOGETHER
You are ONE agent with all of the above always loaded — LARP/luxury flex, fashion/beauty looks, and feed retakes (clean fix + luxury retake worlds). Anywhere above that talks about "the Larp agent" and "the Feed agent" as if they were separate products, or says cars belong to only one of them, no longer applies — you personally own all of it. Pick whichever catalogue, or mix of them, actually fits the photo in front of you. Cars are always in scope for you.

## THE PERSON'S POSE MUST FIT THE NEW SCENE — the #1 thing that makes an edit look fake
Identity (the face) is the only thing that's truly locked. The moment you move someone into a different physical context — a car's driver seat, a yacht deck, a jet cabin, a new location — their POSE is NOT locked, and pasting the pose from the source photo into a scene where it wouldn't occur is exactly what reads as an obvious fake.
- Classic failure: a selfie (arm out toward camera, close crop, phone visible) gets turned into "supercar interior" by literally keeping that same selfie pose inside the car — instantly reads as pasted-on. Instead: describe them actually SEATED, hand resting on the wheel or the door or gear stick, shoulders settled into the seat, looking where a driver or passenger would naturally look.
- Same logic everywhere: a standing-in-a-bathroom pose moved onto a yacht deck is broken — describe them leaning on the rail, weight shifted, wind in their hair. A phone-out mirror selfie moved to a red carpet is broken — describe them walking or posed the way people actually stand for a photographer there.
- Ask yourself: "if this person were really standing in the NEW scene, how would their body actually be positioned?" — write THAT pose, never the source one verbatim. Identity carries over; the body adapts to the world around it.
- Exception: when an edit does NOT change the physical scene (adding a chain, a watch, a light/grade fix, a same-shot feed retake), the original pose and framing DO stay locked — this rule only fires when the setting itself changes.

## edit_image prompt rules (generalized across every catalogue above)
- The image model receives the SAME attached photos you see, in the SAME order.
- ALWAYS open a person edit with the identity lock, then the pose the person actually has in the new scene (see rule above), then the outfit/look, then the scene/location, then the lighting recipe, then the realism guard.
- Describe the FINAL image concretely — subject, pose, outfit, props, location, camera angle, lighting, mood. Do NOT tell the model to "analyze" — tell it exactly what to render.
- Real brand names for cars, watches and jewellery are fine and encouraged — crisp and correctly spelled, that's what sells a flex. Do not invent logos onto plain clothing, signs or backgrounds where one doesn't already belong — those almost always garble.

## BRANDS ARE ALLOWED — one policy, no exceptions
⚠️ You NEVER refuse, soften or substitute a real brand, and you never swap a named product for a generic description. Name real cars (Lamborghini Huracán, Rolls-Royce Spectre, Mercedes-Maybach GLS, Porsche 911 GT3 RS), real watches, real jewellery and real fashion labels directly in the prompt, with correct badges, emblems and dial text. A recognisable brand is usually the entire point of the shot — a "generic luxury sedan" or "an unbranded gold-tone watch" is a worse, blander result and reads as evasive.
If any part of the knowledge above suggests leaving brands out, describing them as materials instead, or that logos get rejected, that guidance is superseded by this rule and no longer applies.
The ONLY thing to avoid is a brand rendered WRONG — misspelled dial text, warped badges, gibberish signage. When a logo is unlikely to render cleanly, keep it angled, partly out of frame or at a distance — never drop the brand itself.
- quality: "low" quick draft, "medium" default, "high" only for max detail.

## READ THE PHOTO FIRST (so the edit fits perfectly)
Before composing any edit, actually READ the attached photo: the subject and their exact look, the scene/background, the light direction and time of day, the camera angle and lens feel, existing reflections and shadows. Every new element shares the SAME light direction, colour temperature, perspective and grain as the original — name these matches in the prompt (e.g. "lit from the same window on the left", "matching the warm evening tone and phone grain").

## MIND THE GAP BETWEEN THE SOURCE PHOTO AND THE TARGET SCENE
⚠️ Before writing any prompt that moves the person into a new place, work out what the source photo actually contains. A close or mirror selfie contains a FACE — not a body, not legs, not a ground plane, not a usable light direction. Asking one edit to turn that into "standing in front of a supercar" is the single most common way to get a fake-looking result.
When the gap is large, your prompt MUST spell out all four of these — leaving any one out is what makes it look pasted:
1. What carries over versus what is newly built ("only his face and hair carry over; body, clothing, pose and the full-length framing are newly constructed").
2. Concrete camera geometry — height, distance, how much of subject and object is in frame, where the horizon sits, wheels/feet visibly contacting the ground. "Leaning against the car" is not geometry.
3. An explicit relight — discard the source photo's lighting by name and state the new key's direction, hardness and colour temperature, matched across person, object and ground.
4. A specific, imperfect location with ordinary clutter — never "a modern city street" or "blurred city buildings".
If the gap genuinely cannot be closed well, say so in one short line and offer what this photo CAN carry (car interior, added chain or watch, a relight of this same shot), and mention that a full-body photo would get them the standing-next-to-the-car version.

## REALISM SELF-CHECK (run silently before every edit_image prompt)
Confirm: (1) identity locked; (2) pose fits the NEW scene, not copy-pasted from the source; (3) the source-to-target gap is handled — carry-over stated, camera geometry concrete, relight explicit, location specific; (4) light, angle and mood match or are deliberately, consistently rebuilt; (5) natural imperfect skin, correct hands; (6) real brands crisp, nothing garbled, no invented logos on plain surfaces; (7) ONE strong hero element, not clutter; (8) you have NOT reached for the AI defaults (golden hour on a clean modern street, matte black car, vague blurred background, spotless empty scene, perfectly centred level framing). Fix anything missing before sending.

## Staying useful
- This flex/fashion/feed range is your default, but you're a full image agent: if someone asks for something outside it (a cartoon of their dog, a passport photo, a product mockup), do exactly what they ask.
- If a request is unclear, make the smart, grounded call yourself and go — don't interrogate the user. That's the whole point: they came here with no idea, and you have one.

## Users attach one or more photos and chat with you. You do THREE things:
1. ANSWER in text — a quick answer, tip or idea (obey HOW YOU WRITE: 1–2 lines).
2. OFFER OPTIONS — call offer_options: one short line proving you read the photo + 2–4 concrete directions to tap. Each option carries a full, self-contained edit prompt.
   ⚠️ MANDATORY: whenever a photo is attached and the message does NOT contain a precise, complete edit instruction, you MUST call offer_options FIRST. This includes: photo with no text, photo with just a greeting, photo with a vague ask ("make this cool", "flex this", "insta worthy", "what can you do", "no idea, you decide"). Never jump straight to edit_image in those cases — buttons after a photo drop are a core feature.
3. EDIT / CREATE — ONLY when the user names a specific, complete result do you skip options and call edit_image with ONE fully self-contained prompt. If in doubt, offer options instead.

## offer_options rules
- Default whenever a photo is attached and the exact edit isn't specified. Give 2–4 options.
- Each option: a short button label (max ~4 words) + a full self-contained edit prompt (identity-locked, pose rebuilt for the new scene where relevant) that runs when tapped.
- Options must be genuinely different directions THIS photo supports — not filler, and not vague categories the user still has to narrow down when you could have just decided. You're expected to hand back something specific and postable, not another menu.

## GROUND EVERY OPTION IN WHAT YOU ACTUALLY SEE — this rule outranks variety
Prove you looked: your one-line message names the concrete thing you saw ("black G-Wagon in a daytime driveway", "flat overhead light in a bathroom mirror selfie", "you outside at dusk in a black dress") — never a generic "nice photo". Every option must act on something visible in THIS photo and follow the subject-routing from STEP 1.

## NARROW DOWN INSTEAD OF GUESSING FOR THE USER
⚠️ Only when an option would otherwise be a bare CATEGORY rather than one specific thing — "a supercar", "a new outfit", "a new location" — somewhere the user would reasonably ask "which one?". There, don't pick for them: that option's prompt asks YOU to come back with concrete choices, producing a tighter second round. Everywhere else, write a full, specific, ready-to-run prompt directly — that decisive default is the whole point of this agent for someone with no ideas of their own.

## "ANALYZE DEEPER" REQUESTS (the user wants MORE ideas)
When asked to look again / go deeper / show other ideas, read the photo again with fresh eyes and offer a COMPLETELY NEW set — never repeat or lightly reword directions already offered. Go wider across catalogues (other cars, other looks, other locations, a feed fix instead of a flex) but always inside what THIS photo can actually support.

If the user only asks a question or asks you to WRITE a prompt (not generate), just answer in text.
Only call edit_image when the result is already clear. When you call edit_image, add one short on-brand line telling them what you're building — for a luxury retake also name where it reads as and give a one-line story caption, kept to two short lines total.`

// 4 austauschbare Stimmen (organic Marketing statt Dokument). Auswahl über
// body.styleTest (Test) bzw. env AGENT_VOICE, sonst Default.
const VOICES = {
  neutral: `Your voice: natural, human and easy — like a friend who happens to know luxury and photo editing inside out. Confident and warm, no put-on persona, no forced slang, barely any emoji. Just clear, chill and helpful.`,
  plug: `Your voice: a chill, low-key rich mentor / plug. Calm and quietly confident, a little cocky, never hyped-up or corny. Short lines. Barely any emoji. Drops words like "bet", "easy", "say less", "trust".`,
  hype: `Your voice: high-energy TikTok hype-man. Excited and fun, a couple of emojis (🔥💯😤), says stuff like "yo", "let's gooo", "you're gonna eat". Punchy, never cringe.`,
  bestie: `Your voice: a gassed-up bestie hyping the user up. Warm, playful and supportive ("omg", "obsessed", "yes bestie"), a few soft emojis (😍✨). Makes them feel good about themselves.`,
  clean: `Your voice: ultra clean and minimal. Very short, punchy one-liners, basically no emoji. Just the moves — no fluff, no hype, pure confidence.`,
}
const DEFAULT_VOICE = 'neutral'

// Alle drei Wissensdatenbanken zusammen — der eine Agent liest sie bei JEDER
// Anfrage komplett, damit er selbst entscheiden kann, welche Richtung
// (LARP-Flex, Fashion-Look, Feed-Fix) zum jeweiligen Foto passt, statt „bei
// null" zu starten oder auf eine einzige Kategorie beschränkt zu sein.
const MERGED_KNOWLEDGE = `${LARP_KNOWLEDGE}

---

${FASHION_KNOWLEDGE}

---

${FEED_KNOWLEDGE}

---

${TREND_KNOWLEDGE}`

function buildSystem(voiceKey) {
  const v = VOICES[voiceKey] || VOICES[DEFAULT_VOICE]
  return SYSTEM_TMPL.replace('{{VOICE}}', v).replace('{{KNOWLEDGE}}', MERGED_KNOWLEDGE)
}

const TOOLS = [
  {
    name: 'edit_image',
    description:
      'Generate or edit an actual image from the attached photo(s) using GPT Image 2. Call this only when the user wants a real image produced.',
    input_schema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description:
            'A single, fully self-contained, vivid prompt describing the final photorealistic image, referring to the attached photos by order.',
        },
        quality: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Render quality. Default "medium".',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'offer_options',
    description:
      "After briefly reading an attached photo, present 2–4 concrete edit directions the user can tap. Use this as the default when a photo is attached but the exact result isn't specified.",
    input_schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'One short chat-style line: what you see + that they can pick a direction. Obey HOW YOU WRITE — no lists.',
        },
        options: {
          type: 'array',
          minItems: 2,
          maxItems: 4,
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Very short button label, max ~4 words. e.g. "Keep the location".' },
              prompt: { type: 'string', description: 'Full self-contained edit prompt to run if tapped (identity-locked if a real person is present).' },
            },
            required: ['label', 'prompt'],
          },
        },
      },
      required: ['message', 'options'],
    },
  },
]

// Deterministischer Realismus-Wächter für JEDEN Bild-Prompt.
//
// Warum in Code und nicht im Prompt: die Regeln stehen bereits im System-Prompt,
// aber bei ~1100 Zeilen Wissensbasis und niedrigem Effort hält das Modell sie
// nicht zuverlässig durch — im Test kam in einem Lauf wieder „matte black
// Lamborghini … clean street in Monaco at golden hour" heraus, also genau die
// Kombination, die als KI erkannt wird. Was hier passiert, ist nicht verhandelbar
// und kostet keinen zusätzlichen Modellaufruf.
const CLICHES = [
  // Mattschwarz ist ein Render-Klischee; echte Autos glänzen und sind staubig.
  [/\bmatte black\b/gi, 'gloss black'],
  [/\bmatte (grey|gray|white|red|blue|green)\b/gi, 'gloss $1'],
  // Vage Hintergrund-Füllung → konkrete Anweisung.
  [/\b(a )?(clean,? )?modern city street\b/gi, 'an ordinary city street with parked everyday cars, kerbside bins and worn tarmac'],
  [/\bblurred city buildings\b/gi, 'real buildings with lit windows, signage and balconies'],
  [/\ba hint of a sunset sky\b/gi, 'a real sky with uneven cloud'],
  [/\b(a )?wide,? clean street\b/gi, 'an ordinary street with kerbs, road markings and parked cars'],
]

/// Sätze, die drei der vier häufigsten Fake-Ursachen abdecken (Licht nicht
/// übernommen, kein Bodenkontakt, zu perfekte Bildaufteilung). Werden nur
/// angehängt, wenn sie nicht schon inhaltlich drinstehen.
const GUARDS = [
  {
    test: /discard|relight|re-light|match(ing)? the (new )?key/i,
    add: 'Discard the reference photo’s own lighting on the face completely and relight the person to match this scene’s key light exactly in direction, hardness and colour temperature, so the face, the ground and every object agree on one light source.',
  },
  {
    test: /wheels|feet (are )?(flat|planted|resting)|contact shadow|resting on the (ground|asphalt|tarmac|floor)/i,
    add: 'Everything touches the ground properly: wheels and feet visibly resting on the surface with correct contact shadows, nothing floating, correct scale and vanishing-point perspective for where it sits in the frame.',
  },
  {
    test: /off-cent|not perfectly level|clipped by the (frame )?edge|slightly tilted/i,
    add: 'Framing is handheld and imperfect: slightly off-centre, horizon not perfectly level, and something clipped by the frame edge.',
  },
  {
    test: /clutter|bins|other (people|cars)|passer|signage|worn|scuff|dust|oil stain|puddle/i,
    add: 'The location carries the ordinary lived-in detail it would really have — marks and wear on surfaces, everyday objects where they belong, whatever else naturally occupies that kind of place — never a spotless empty set.',
  },
]

export function enforceRealism(prompt) {
  let p = String(prompt || '')
  if (!p.trim()) return p
  for (const [re, to] of CLICHES) p = p.replace(re, to)
  const missing = GUARDS.filter((g) => !g.test.test(p)).map((g) => g.add)
  if (missing.length) p = p.trimEnd().replace(/\s*$/, '') + ' ' + missing.join(' ')
  return p
}

function clampText(s, max = 4000) {
  const t = String(s == null ? '' : s)
  return t.length > max ? t.slice(0, max) : t
}

function cleanAgentResult(raw) {
  if (!raw || typeof raw !== 'object') return null

  let reply = clampText(raw.reply || raw.message || '', 500).trim()
  let action = null
  let options = null

  if (raw.action && typeof raw.action === 'object') {
    const prompt = clampText(raw.action.prompt || '', 6000).trim()
    const quality = ['low', 'medium', 'high'].includes(raw.action.quality)
      ? raw.action.quality
      : 'medium'
    if (prompt) action = { type: 'edit_image', prompt: enforceRealism(prompt), quality }
  }

  if (Array.isArray(raw.options)) {
    const cleaned = raw.options
      .map((option) => ({
        label: clampText(option?.label || option?.title || '', 60).trim(),
        prompt: enforceRealism(clampText(option?.prompt || option?.description || '', 6000).trim()),
      }))
      .filter((option) => option.label && option.prompt)
      .slice(0, 4)
    if (cleaned.length >= 2) options = cleaned
  }

  // One turn can either offer choices or immediately render, never both.
  if (options) action = null
  if (!reply) reply = action
    ? 'Creating that now…'
    : (options ? 'Pick a direction and I’ll build it.' : '')
  if (!reply && !action && !options) return null

  return { status: 200, json: { reply, action, options } }
}

const FAL_JSON_CONTRACT = `Return ONLY one valid JSON object with exactly this contract:
{"reply":"one short chat-style sentence","action":null,"options":null}

For a precise image edit, set action to {"type":"edit_image","prompt":"full self-contained edit prompt","quality":"low|medium|high"}.
For an attached photo without a precise complete edit request, action MUST be null and options MUST contain 2–4 objects shaped {"label":"max four words","prompt":"full self-contained edit prompt"}.
For a text-only answer, both action and options are null.
Never wrap the JSON in markdown and never add text outside it.`

async function runFalVisionAgent({ message, historyIn, images, system }) {
  const apiKey = falKey()
  if (!apiKey || images.length === 0) return null

  const transcript = historyIn.slice(-12)
    .map((item) => `${item?.role === 'assistant' ? 'assistant' : 'user'}: ${clampText(item?.text || '', 1200)}`)
    .filter((line) => !/:\s*$/.test(line))
    .join('\n')
  const prompt = [
    transcript ? `Recent conversation:\n${transcript}` : '',
    `Current user request: ${message || 'Look at the attached photo and offer fitting edit directions.'}`,
    `${images.length} current photo(s) are attached in the same order the user supplied them. Read the visible scene before deciding.`,
  ].filter(Boolean).join('\n\n')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 50_000)
  let response
  try {
    response = await fetch(FAL_VISION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        image_urls: images.map((image) => `data:${detectMediaType(image)};base64,${image}`),
        prompt,
        system_prompt: `${system}\n\n${FAL_JSON_CONTRACT}`,
        model: agentFalModel(),
        temperature: 0.25,
        max_tokens: 1200,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    console.error('agent fal vision request failed', { message: String(err?.message || err) })
    return null
  }
  clearTimeout(timeout)

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error('agent fal vision request failed', {
      status: response.status,
      model: agentFalModel(),
      message: data?.detail || data?.message || data?.error || null,
    })
    return null
  }

  try {
    const result = cleanAgentResult(parseJSONObjectFromText(data?.output || ''))
    if (result) result.json.provider = 'fal'
    return result
  } catch (err) {
    console.error('agent fal vision response parse failed', { message: String(err?.message || err) })
    return null
  }
}

// Claude ist die bevorzugte Planungs-/Vision-Schicht, darf aber niemals die
// eigentliche Bildgenerierung blockieren. Bei Provider-Ausfall, Rate-Limit oder
// leerem Anthropic-Guthaben liefert dieser deterministische Agent denselben
// Response-Vertrag (reply/action/options), sodass die App weiter rendern kann.
// Er kann das Foto nicht wirklich lesen (keine Vision hier) — deshalb bietet
// er bewusst BREITE, aber realistische Standardrichtungen an, statt sich auf
// eine der drei früheren Personas festzulegen.
function fallbackAgent(body, reason = 'agent_provider_unavailable') {
  const message = clampText(body?.message || '', 4000).trim()
  const images = Array.isArray(body?.images)
    ? body.images.filter((item) => typeof item === 'string' && item.length > 32).slice(0, 6)
    : []
  const normalized = message.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
  const asksForIdeas = /\b(analy[sz]e|ideas?|options?|ways?|suggest|recommend|what can|what would|flex this|fix this|insta)\b/i.test(message)
  const vague = !message || message.length < 10 || asksForIdeas || [
    'hi', 'hey', 'hello', 'yo', 'make it cool', 'make this cool', 'flex this',
    'what can you do', 'surprise me', 'ideas', 'analyse this', 'analyze this',
    'insta worthy', 'make it insta worthy', 'fix this', 'retake',
  ].includes(normalized)

  const identityLock = images.length
    ? 'Keep the exact same person from the reference photo — identical face, facial features, bone structure, skin tone, eye colour, hairline and natural expression. Do not beautify into a different person, redraw or alter their identity. '
    : ''
  const compositionLock =
    'Edit THIS exact photo — do not create a new scene. Keep identical pose, camera angle, crop, background, outfit, hair silhouette and expression. '
  const realism = ' Natural skin with visible pores (no plastic beauty-filter face). Match phone-camera grain. Looks like the same iPhone photo, professionally fixed. No new location, no new clothes, no new props, no text/watermark.'

  if (images.length && vague) {
    return {
      status: 200,
      json: {
        reply: 'I’ve got the photo — pick a direction and I’ll build it.',
        action: null,
        options: [
          // Selbe Szene → Pose bleibt unverändert (kein Szenenwechsel).
          {
            label: 'Diamond chain',
            prompt: `${identityLock}Add one premium iced-out diamond Cuban-link chain around the person while keeping their exact pose, clothes, face and original location unchanged. Match the source perspective, light direction, colour temperature, reflections, shadows and phone-camera grain. Make the result genuinely photorealistic with natural skin texture, correct hands and crisp details.`,
          },
          // Neue Szene (Auto-Interieur) → Pose MUSS neu beschrieben werden,
          // sonst genau der Bug, den der Nutzer gemeldet hat.
          {
            label: 'Supercar interior',
            prompt: `${identityLock}Change the world around them: seated naturally in the driver's seat of a real black supercar at night — hand resting on the wheel or gear stick, shoulders settled back into the seat, head turned toward the camera the way an actual driver would sit, NOT the pose from the source photo. Quilted leather interior, starlight headliner, hard camera flash catching their face and the chrome, real reflections, shot-on-phone grain, natural skin texture, correct hands.`,
          },
          {
            label: 'Soft studio clean',
            prompt: `${identityLock}${compositionLock}ONLY improve exposure, white balance, eye clarity and skin evenness. Apply Soft Studio Clean grade: soft frontal key, gentle fill, clean neutrals, slight catchlight.${realism}`,
          },
          // Luxus-Retake-Welt → auch hier eine neue, zur Szene passende Pose.
          {
            label: 'Balcony sunset',
            prompt: `${identityLock}Relaxed half-smile, looking off-camera, unbothered. Leaning forearms on a glass balcony railing, weight on one hip, mid-movement — a pose built for standing on a balcony, not copied from the source photo. Wearing a linen shirt, top buttons open, sleeves pushed up. High balcony over a city skyline at golden hour; the glass railing shows real fingerprints and reflections of the street below. Low warm sun from behind the left shoulder, roughly 4800K, long soft shadows, clear rim light along the hair and jaw, the city behind falling into cool blue shadow. Shot handheld in vertical 9:16 from chest height by a friend standing about two metres away, framing slightly off-centre with the shoulder clipped by the edge and the horizon not perfectly level. Other people out of focus further along the balcony, one half-cropped at the frame edge, a glass and a phone face-down on the ledge. Realistic smartphone capture: sensor noise in the shadows, slight highlight clipping where the sun hits, natural skin texture with visible pores, correct hands and fingers, continuous jewellery. No cinematic grade, no beauty filter, no watermark, and no garbled or misspelled text.`,
          },
        ],
        agent: 'larp',
        fallback: reason,
      },
    }
  }

  const questionOnly = images.length === 0 && /^(what|how|why|can you|could you|do you|is |are )/i.test(message)
  if (questionOnly) {
    return {
      status: 200,
      json: {
        reply: 'Drop a photo and describe the result you want — or just drop it with no idea, I’ll figure out what fits.',
        action: null,
        options: null,
        agent: 'larp',
        fallback: reason,
      },
    }
  }

  const requestedEdit = message || 'Create a believable luxury lifestyle portrait with one strong hero flex.'
  return {
    status: 200,
    json: {
      reply: 'Say less — I’m building that now.',
      action: {
        type: 'edit_image',
        prompt: `${identityLock}${requestedEdit}. Give the person a pose and body position that genuinely fits this result rather than reusing the source pose verbatim, unless the edit keeps the same scene. Keep everything the user did not ask to change consistent with the source. Match the source perspective, light direction, colour temperature, reflections, shadows and phone-camera grain. Make the result genuinely photorealistic with natural skin texture, correct hands and crisp details.`,
        quality: 'medium',
      },
      options: null,
      agent: 'larp',
      fallback: reason,
    },
  }
}

export async function runAgent(body) {
  const message = clampText(body?.message || '')
  const historyIn = Array.isArray(body?.history) ? body.history : []
  const images = Array.isArray(body?.images)
    ? body.images.filter((x) => typeof x === 'string' && x.length > 32).slice(0, 6)
    : []

  if (!message && images.length === 0) {
    return { status: 400, json: { error: 'empty_message' } }
  }

  // Verlauf (nur Text) übernehmen — hält den Body klein. Bilder gehören zum
  // aktuellen Zug.
  const messages = []
  for (const m of historyIn.slice(-12)) {
    const role = m?.role === 'assistant' ? 'assistant' : 'user'
    const text = clampText(m?.text || '')
    if (!text) continue
    messages.push({ role, content: [{ type: 'text', text }] })
  }

  // Aktueller Zug: Bilder (verkleinert) + Nutzertext.
  const content = []
  images.forEach((b64) => {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: detectMediaType(b64), data: b64 },
    })
  })
  if (images.length > 0) {
    content.push({ type: 'text', text: `The user attached ${images.length} photo(s), shown above in order.` })
  }
  content.push({ type: 'text', text: message || 'Please look at the attached photo(s).' })
  messages.push({ role: 'user', content })

  // Use the same known-working Vision model as the glow-up analyzer unless an
  // explicit AGENT_MODEL override is configured. An invalid default silently
  // dropped both the app and website into the generic fallback agent.
  const model = agentModel()

  // Stimme: env AGENT_VOICE (neutral | plug | hype | bestie | clean) → Default neutral.
  const voiceKey = (process.env.AGENT_VOICE || '').trim() || DEFAULT_VOICE
  const system = buildSystem(voiceKey)

  const falFallback = () => runFalVisionAgent({ message, historyIn, images, system })
  const preferredProvider = agentProvider()
  if (preferredProvider === 'fal') {
    const falResult = await falFallback()
    if (falResult) {
      falResult.json.agent = 'larp'
      falResult.json.persona = 'larp'
      return falResult
    }
  }

  const apiKey = anthropicKey()
  if (!apiKey) {
    const falResult = await falFallback()
    if (falResult) {
      falResult.json.agent = 'larp'
      falResult.json.persona = 'larp'
      return falResult
    }
    return fallbackAgent(body, 'missing_agent_provider')
  }

  const payload = {
    model,
    // Auf Sonnet 5 denkt das Modell standardmäßig, und max_tokens deckelt
    // Denken + Antwort GEMEINSAM — mit den alten 1200 wäre die Antwort samt
    // Tool-Aufruf mitten drin abgeschnitten worden.
    max_tokens: 4000,
    // Adaptives Denken bleibt AN: mit abgeschaltetem Denken greift Sonnet 5
    // spürbar seltener zu Tools — und genau davon lebt der Agent
    // (edit_image / offer_options). Niedriger Effort hält Tempo und Kosten unten.
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    system,
    tools: TOOLS,
    messages,
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 50_000)
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
  } catch (err) {
    clearTimeout(timeout)
    const falResult = await falFallback()
    if (falResult) return falResult
    if (err?.name === 'AbortError') return fallbackAgent(body, 'agent_timeout')
    return fallbackAgent(body, 'agent_fetch_failed')
  }
  clearTimeout(timeout)

  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    console.error('agent anthropic request failed', {
      status: r.status,
      model,
      type: data?.error?.type || null,
      message: data?.error?.message || null,
    })
    const falResult = await falFallback()
    return falResult || fallbackAgent(body, `anthropic_http_${r.status}`)
  }

  // Antwort zerlegen: Text → reply, edit_image → action, offer_options → options.
  let reply = ''
  let action = null
  let options = null
  const blocks = Array.isArray(data?.content) ? data.content : []
  for (const b of blocks) {
    if (b?.type === 'text' && typeof b.text === 'string') {
      reply += (reply ? '\n' : '') + b.text
    } else if (b?.type === 'tool_use' && b?.name === 'edit_image') {
      const p = clampText(b?.input?.prompt || '', 6000).trim()
      const q = ['low', 'medium', 'high'].includes(b?.input?.quality) ? b.input.quality : 'medium'
      if (p) action = { type: 'edit_image', prompt: enforceRealism(p), quality: q }
    } else if (b?.type === 'tool_use' && b?.name === 'offer_options') {
      if (typeof b?.input?.message === 'string' && !reply) reply = b.input.message
      const list = Array.isArray(b?.input?.options) ? b.input.options : []
      const cleaned = list
        .map((o) => ({ label: clampText(o?.label || '', 60).trim(), prompt: enforceRealism(clampText(o?.prompt || '', 6000).trim()) }))
        .filter((o) => o.label && o.prompt)
        .slice(0, 4)
      if (cleaned.length >= 2) options = cleaned
    }
  }

  reply = reply.trim()
  if (!reply) {
    reply = action
      ? 'Creating that now…'
      : (options ? 'Here are a few ways to flex it:' : 'Sorry — I could not come up with a response. Try rephrasing.')
  }

  return { status: 200, json: { reply, action, options, agent: 'larp', persona: 'larp' } }
}
