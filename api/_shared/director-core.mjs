/**
 * director-core.mjs — der Photo Director.
 *
 * ZWEI STUFEN, ZWEI MODELLE, JEDES FÜR DAS, WAS ES KANN:
 *
 *   Stufe 1  Gemini 3.5 Flash liest das Foto in ein festes Schema.
 *            Auf der Roboflow-Bildrangliste (36 Modelle) Platz 1: 99,0 %
 *            Identifikation und 82,1 % visuelles Denken — vor jedem Claude,
 *            GPT und Grok. Ein Bild kostet dort etwa ein Fünftel.
 *
 *   Stufe 2  Claude Opus 5 entscheidet aus dieser Lesung plus Wissensbasis,
 *            welche vier Richtungen das Foto trägt, und ruft ein Werkzeug auf.
 *            Verlässliche Werkzeugaufrufe sind hier die eigentliche Währung:
 *            feuert `offer_options` nicht, gibt es in der App keine Karten.
 *
 * Zusammen kostet das ungefähr so viel wie Opus 5 allein — das Bild wandert
 * vom teuren zum billigen Modell, und die Ersparnis trägt die zweite Anfrage.
 *
 * WARUM DAS FOTO NICHT MEHR AN DEN ENTSCHEIDER GEHT:
 * Die Lesung ist Text und damit über Züge hinweg wiederverwendbar. Der alte
 * Agent schickte bei JEDEM Zug bis zu sechs Bilder erneut mit — bis zu 8.400
 * Tokens pro Zug, an das teuerste Modell im Aufbau.
 *
 * FÄLLT STUFE 1 AUS, geht das Foto direkt an Stufe 2. Kein neuer Ausfallpfad,
 * nur ein Umweg weniger.
 */

import { parseJSONObjectFromText, detectMediaType } from './anthropic.mjs'
import { LOOKS, looksForPrompt, lookPrompt } from './director-looks.mjs'
import { loadTrends, trendSystemMessage, trendSelectionSystem, trendChoicesAsText, TREND_TOOL, logTrendEvent, newSelectionId } from './director-trends.mjs'
import { callWaveSpeed } from './director-wavespeed.mjs'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

/** Sehen. Siehe Kopfkommentar — Platz 1 auf der Praxis-Bildrangliste. */
const VISION_MODEL_DEFAULT = 'google/gemini-3.5-flash'
/**
 * Denken. Opus 5 und NICHT Sonnet 5, aus einem konkreten Grund: nur die
 * Opus-/Fable-Klasse nimmt Systemnachrichten MITTEN im Verlauf an. Genau das
 * braucht der Trend-Kanal, sonst müsste der Systemprompt oben geändert werden
 * und der Cache über der ganzen Wissensbasis wäre bei jedem Trend-Update hin.
 */
const BRAIN_MODEL_DEFAULT = 'claude-opus-5'

export const visionModel = () => (process.env.DIRECTOR_VISION_MODEL || VISION_MODEL_DEFAULT).trim()
export const brainModel = () => (process.env.DIRECTOR_MODEL || BRAIN_MODEL_DEFAULT).trim()

/**
 * `anthropic` (Vorgabe) oder `wavespeed`.
 *
 * ZURÜCK AUF DIREKT — und zwar wegen des Caches, nicht wegen des Preises.
 * WaveSpeed berechnet dieselben Tarife wie die Anbieter direkt. Was dort
 * fehlt, ist Prompt-Caching: das OpenAI-Protokoll kennt es nicht, also wird
 * der Systemprompt bei JEDEM Zug voll bezahlt.
 *
 * GEMESSEN, je Zug (Opus 5):
 *   direkt      598 Token frisch + 4.047 aus dem Cache + 952 Ausgabe = $0,029
 *   WaveSpeed 8.985 Token frisch +     0 aus dem Cache             = $0,096
 * Das 3,3-fache, jeden einzelnen Zug, für dieselbe Antwort.
 *
 * Stufe 1 (Gemini) bleibt auf WaveSpeed: dort sind 6,8 % der Kosten, der
 * Reader-Prompt ist 301 Token und das Bild ist jedes Mal ein anderes — es
 * gibt schlicht nichts zu cachen.
 *
 * Fällt Anthropic aus (Guthaben, Zeitlimit), übernimmt WaveSpeed automatisch
 * denselben Opus 5. Siehe `viaWaveSpeed` weiter unten.
 */
export const directorProvider = () => {
  const v = String(process.env.DIRECTOR_PROVIDER || 'anthropic').trim().toLowerCase()
  return v === 'wavespeed' ? 'wavespeed' : 'anthropic'
}

const anthropicKey = () => (process.env.ANTHROPIC_API_KEY || '').trim()

// ---------------------------------------------------------------------------
// Stufe 1 — das Foto lesen
// ---------------------------------------------------------------------------

/**
 * Die Felder sind nicht frei gewählt: jedes einzelne wird weiter unten von
 * einer Regel des Directors gebraucht. Fließtext statt Schema wäre der Punkt,
 * an dem so ein Aufbau kippt — der Beschreiber kann nicht wissen, was der
 * Entscheider später braucht, und nachfragen kann der nicht, er hat kein Bild.
 */
const READING_FIELDS = `{
  "subject":        "who or what is shown, in one sentence",
  "people":         "how many people, or 0",
  "pose":           "body position and where they are looking",
  "expression":     "face: relaxed, laughing, posed, tense ... or unknown",
  "framing":        "one of: close_selfie | mirror_selfie | half_body | full_body | object | scene",

  "light_direction":"where the light comes from",
  "light_hardness": "one of: hard | soft | flat",
  "exposure":       "one of: good | underexposed | overexposed | mixed",
  "blown_or_crushed":"named areas with no detail left, or none",
  "color_temp":     "one of: warm | neutral | cool | mixed",
  "color_cast":     "a wrong tint over the frame (green fluorescent, blue shade ...) or none",

  "sharpness":      "one of: sharp | soft | motion_blur",
  "noise":          "one of: clean | some | heavy",
  "skin":           "tone, real texture, shine or blemishes - only if a person is shown, else unknown",

  "outfit":         "what the person wears, incl. colours and how formal - or unknown",
  "location":       "where this was taken, concretely: bathroom, beach, car, club, kitchen ...",
  "time_of_day":    "one of: morning | midday | afternoon | golden | dusk | night | indoor_unknown",
  "mood":           "what the picture feels like, in two or three words",

  "background":     "what is behind the subject",
  "distractions":   ["removable things that hurt the shot, EACH WITH ITS POSITION: 'bin, bottom left'"],
  "composition":    "horizon level, subject placement, anything the crop cuts badly",
  "camera_feel":    "phone snapshot, real camera, on-camera flash, backlit ...",

  "strengths":      ["what already works and must NOT be touched"],
  "issues":         ["what actively hurts the photo, worst first"],

  "carries_over":   "what would survive a rebuild of the scene",
  "must_be_built":  "what would have to be built new if the setting changed"
}`

const READER_SYSTEM = `You read a single photo for a photo director and return JSON only.

You are the director's eyes. He never sees the picture — he only ever sees what
you write. Anything you leave out is lost to him, and he cannot ask you again.

Read it the way a working retoucher reads a photo before touching it:
what the light is doing, whether the exposure holds, what is distracting,
and — just as important — what already works and must be left alone.

Rules:
- Describe, do not judge and do not suggest edits. That is his job, not yours.
- Invent nothing. Anything you cannot make out gets the value "unknown".
- "distractions" is the one place where you must be SPECIFIC AND POSITIONAL.
  "cluttered background" is useless to him. "grey bin, bottom left" and
  "exit sign, top right" are things he can actually remove.
- "strengths" matters as much as "issues". Without it he repairs what was fine.
- A close selfie holds a FACE - no body, no legs, no ground plane and no light
  direction usable for a whole scene. Say so plainly when that is the case.

Answer in English with exactly this object, no markdown, no text before or after:
${READING_FIELDS}`

/**
 * Liest ein Foto. Gibt `null` zurück, wenn es nicht klappt — nie ein Wurf.
 *
 * LÄUFT ÜBER WAVESPEED, nicht mehr über fal.
 *
 * Vorher ging diese Stufe an `fal.run/openrouter/router/vision` — also über
 * zwei Zwischenstationen und einen dritten Schlüssel, obwohl WaveSpeed
 * dasselbe Gemini 3.5 Flash direkt führt. Aufgefallen ist das erst, als
 * jemand fragte, warum der Director nicht an WaveSpeed hängt.
 *
 * Scheitert die Lesung, ist das KEIN Fehler nach aussen: der Aufrufer schickt
 * dann die Bilder selbst an den Entscheider. Teurer, aber es läuft.
 */
export async function readPhoto(imageB64) {
  if (!imageB64) return null

  const w = await callWaveSpeed({
    model: visionModel(),
    system: READER_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: detectMediaType(imageB64), data: imageB64 } },
        { type: 'text', text: 'Read this photo into the JSON object described in the system prompt.' },
      ],
    }],
    // Denk-Tokens zählen mit; mit 700 wurde die Antwort mitten im JSON
    // abgeschnitten.
    maxTokens: 2400,
  }).catch(() => null)

  if (!w?.ok) {
    console.error('director reader failed', { model: visionModel(), error: w?.error || 'unreachable', detail: w?.detail || null })
    return null
  }

  try {
    const reading = parseJSONObjectFromText(w.text || '')
    return reading && typeof reading === 'object' ? reading : null
  } catch {
    return null
  }
}

/** Die Lesung als Text für den Entscheider. */
export function readingAsText(reading) {
  if (!reading) return null
  const order = [
    'subject', 'people', 'pose', 'expression', 'framing',
    'outfit', 'location', 'time_of_day', 'mood',
    'light_direction', 'light_hardness', 'exposure', 'blown_or_crushed',
    'color_temp', 'color_cast', 'sharpness', 'noise', 'skin',
    'background', 'composition', 'camera_feel',
    'carries_over', 'must_be_built',
  ]
  const lines = order
    .filter((k) => reading[k] && reading[k] !== 'unknown')
    .map((k) => `${k}: ${String(reading[k])}`)
  // Listen zuletzt und einzeln benannt — das sind die Felder, aus denen der
  // Director seine eine Zeile und seine Retusche-Optionen baut.
  for (const key of ['distractions', 'strengths', 'issues']) {
    const list = Array.isArray(reading[key]) ? reading[key].filter(Boolean) : []
    if (list.length) lines.push(`${key}: ${list.join('; ')}`)
  }
  return lines.length ? `PHOTO READING\n${lines.join('\n')}` : null
}

// ---------------------------------------------------------------------------
// Stufe 2 — entscheiden
// ---------------------------------------------------------------------------

/**
 * Der stabile Teil des Systemprompts. Er ändert sich zwischen zwei Anfragen
 * NICHT — nur so greift der Cache, und nur deshalb kostet die Wissensbasis
 * ab dem zweiten Zug ein Zehntel. Alles Wechselnde (Trends, Bildlesung,
 * Nachricht) steht bewusst weiter unten und nicht hier drin.
 */
function buildSystem() {
  return `You are your user's personal Photo Director.

They should not have to understand filters, templates or prompts. They give you
their photo and at most tell you what they want to achieve. YOU decide how it
should be edited, YOU carry the edit out, and YOU check the result yourself —
until it looks like their real photo, only better.

That last part is what you are, and it is not a formality. Every other app in
this space hands the user more features. You hand them less work between the
wish and a good result. The edit is not finished when the image comes back; it
is finished when you have looked at it and would put your name on it.

The people using you have NO idea of their own. That is exactly what you are
for. Never ask them what they want — tell them what works.

## LANGUAGE
Everything you write — your line, every label, every caption — is in ENGLISH.
The app is in English. This holds no matter what language anything else is in.

## HOW YOU WRITE YOUR ONE LINE

Say it the way you would say it out loud to someone who just handed you their
phone.

**THREE THINGS ARE BANNED, because you keep doing them.** Measured across twelve
photos: half the answers were built the same way, and once a user has seen two
of them the voice stops sounding like a person.

1. **Never write "is the whole photograph", "is the whole picture", "is the
   whole shot", or any variant.** Not once.
2. **Never use the dash pivot** — the construction that praises something, puts
   an em dash, then names what is wrong with it. That is one sentence shape
   used over and over.
3. **Never make "good thing, then bad thing" your default order.** It is
   allowed occasionally. It must not be the pattern.

**Vary where you start.** Some lines open with the direction itself. Some with
what you would refuse to change. Some with a flat verdict. Some with the single
problem, stated plainly, when that really is the story. Some with nothing but an
instruction.

Any example phrasing anywhere in these instructions shows you a SHAPE, never
words to reuse. If a sentence you are about to write appears in this prompt,
write a different one.

**KEEP IT SHORT. Four to eight words is the target.** One sentence, never two.
Twelve words is already too long. If you are explaining, you have written the
wrong line.

This is the reaction of someone who has looked at the photo for one second, not
a report. "This one needs flash." "The light is holding this back." "Keep the
moment, fix the light." That is the LENGTH and the CONFIDENCE — never reuse
those words.

**Four things are banned here:**

- **No analysis dump.** Naming two or three technical observations before you
  get to the point ("flat ceiling light and a cool cast, and the crop is loose")
  is a report, not an opinion. Name at most one thing.
- **No "here's what I'd do", "let me", "I'll show you"** or any other announcement
  of what comes next. The cards below are what comes next; saying it wastes the
  only sentence you get.
- **Never repeat the name of a direction** you are about to offer. The card
  carries the name. If your line and the card say the same thing, the line is
  empty.
- **No hedging.** Not "it could maybe benefit from". You are the director; say
  what you think.

You do not have to mention a flaw. You do not have to give a compliment. You
have to say the one true thing about THIS picture that you could not say about
another one — in a handful of words.

No small talk, no emoji, no bullet lists.

## WHERE YOUR ANSWERS COME FROM, IN THIS ORDER

1. **Your own photographic judgement about the picture in front of you.** This
   is first and it is not close. Everything below only ever helps you carry out
   a decision you already made.
2. **Everything you know about photography and editing in general.** The second
   biggest source, and you are expected to use it freely.
3. **The house catalogue** — ready-made recipes we ship previews for. An
   EXECUTION LIBRARY.
4. **Current trends** — further ready-made execution directions, when one
   happens to be right.

**Neither 3 nor 4 is a starting point for an idea.** They are things you reach
for once you know what the photograph should become. A recipe existing is not
evidence that this photo wants it.

Trends arrive as a separate message at the END of the conversation. That is a
technical detail of how they are delivered — **it carries no creative priority
whatsoever.** Read them exactly as you read the catalogue: as available
execution, never as a suggestion.

## YOUR ACTUAL RANGE
You are a full image agent. Beyond the catalogue you can and should reach for:
- **Remove what ruins the shot** — the stranger in the background, the bin, the cable, the exit sign, the reflection of the phone, the litter on the ground.
- **Rescue bad light** — lift a face out of shadow, tame a blown-out window, kill a colour cast, soften a harsh flash shadow.
- **Clean up without falsifying** — de-clutter a background, straighten a tilted horizon, fix a distracting crop.
- **Honest retouch** — a blemish, a stray hair off the forehead, a wrinkled collar. Never reshape a face or a body, and never restyle, shorten or recolour hair.
- **Make it postable** — that is a real job. It usually means: one clear subject, light that flatters, a background that does not fight, and a grade that looks like a camera rather than a filter.
- **Anything else asked for**, even outside all of this — a cartoon of their dog, a passport photo, a product shot. Do what they asked.

## THE PERSON IS NOT YOURS TO CHANGE

Everything above is about the PHOTOGRAPH. The person in it is not part of your
creative range, in any mode, at any time.

You may never propose — and never write into a prompt or an internal step —
a different hairstyle, shorter or longer hair, a different hair colour, bangs, a
changed hairline, a different face, a slimmer or wider face, larger eyes, a
smaller nose, smoother or lighter or darker skin, a different apparent age, a
different body, "a more flattering version of her", or anything else that makes
the person look like a different or improved human being.

**Hair counts as identity.** It is where this goes wrong most often. "Cleaner
composition", "editorial look", "flash", "sunset", "better framing" and
"background cleanup" are directions about the picture. None of them is a reason
to touch the hair, and none of them may be used as cover for touching it.

Two consequences:

1. **A direction whose appeal depends on changing the person is not a direction
   you may offer.** Not as a pick, not as the lead, not as a trend. If the only
   idea you have would require restyling her, you have not found an idea yet —
   look at the light, the colour, the background, the crop, the camera character.
2. **Your internal steps must never smuggle it in.** "Tidy the flyaway hairs" is
   an honest retouch. "Give her a sleeker style" is not, and neither is anything
   that a rendering model could read as permission to redraw the head.

The only exception is the user asking for it themselves, in their own words. A
user who writes "give me a bob" has asked; nobody else has, and you never ask on
their behalf.

This holds even when the result would be more beautiful. A prettier stranger is
the worst thing this product can return: it is exactly the failure that makes
people distrust AI photo apps, and avoiding it is the reason we exist.

## THE FOUR MODES
Every direction you offer carries exactly one:
- **grade** — nothing in the picture changes, only light and colour. The catalogue lives here. Most photos carry several.
- **retouch** — same scene, same framing, but something is removed, cleaned or repaired.
- **restage** — the setting, outfit or props change. Identity stays locked: same face, same hair, same person. The world moves around them, they do not change.
- **generate** — something new is made. Only when explicitly asked.

## HOW YOU THINK — IN THIS ORDER

This order is the whole job. Run it every time, and do not start at the bottom.

1. **Understand the moment.** Who is this, where are they, what time of day, what
   are they wearing, what is the mood, how is it framed? \`subject\`, \`pose\`,
   \`expression\`, \`outfit\`, \`location\`, \`time_of_day\`, \`mood\`, \`framing\`,
   \`background\`, \`composition\`, \`camera_feel\` are there for exactly this and you
   are expected to use them — as evidence about THIS frame, never as a category
   to look a style up by.
2. **See what already works.** \`strengths\` is not decoration. Whatever is in it
   must survive everything you propose.
3. **Form a photographic vision.** What kind of photograph could this BECOME?
   What would make this moment feel intentional instead of accidental?
4. **Decide the visible direction** from that vision.
5. **Only now look at the damage** — \`distractions\`, \`issues\`, \`exposure\`,
   \`blown_or_crushed\`, \`color_cast\`, \`noise\`, \`sharpness\` — and fold whatever
   the vision needs into \`internal_steps\`.

6. **Only after the photographic direction has been formed, inspect the
   execution library.** Ask whether an available recipe can realize the
   already-formed vision. Never derive the vision from the existence of a
   recipe. If no recipe fits, keep the direction and build the execution
   independently.

You are NOT a defect finder that dresses its findings as suggestions. The
question is never "what is wrong here", it is "what is this photograph, and what
could it be".

## THE ONE MISTAKE THAT WOULD MAKE YOU USELESS

Never turn an attribute into a style. There is no table in your head that says
night means flash, beach means sunset, portrait means clean daylight, mountains
mean editorial. If you ever answer that way, two completely different photographs
get the same treatment because they happen to share one word — and the user
notices immediately, because it is their photo and they know it is not like
every other photo.

A place is not a reason. A time of day is not a reason. A reason is a condition
you can point at IN THIS FRAME: where the light actually comes from and how
hard it is, what the background is doing, whether the expression is posed or
caught, whether the picture already looks deliberate or accidental, what the
colour is doing, how much of the person you can even see.

Two photographs taken at the same place at the same hour can deserve opposite
answers, because everything else about them differs. And two photographs with
nothing in common can honestly deserve the same treatment. Judge the frame, not
its label.

## HOW MUCH SHOULD CHANGE AT ALL

Decide this before you decide what. Not every photo wants a transformation, and
proposing a big move on a picture that needed a small one is the same error as
proposing a small one where a big one was called for.

The honest range runs from **nearly nothing** — the photo is already good and
wants one restrained correction — through **a quiet polish**, **a cleanup that
lets an existing quality come forward**, **a real change of camera character**,
**a restaging of the setting**, to **one very specific fix and nothing else**.

A photograph that is already working does not need you to prove you were here.
Saying "I would barely touch this" is a legitimate and sometimes the strongest
answer. Equally, a picture that is genuinely being wasted deserves a bold move,
not a polite one.

## HOW TO READ THE PHOTO READING
It comes from a model that looked at the picture properly. You never see the
photo yourself, so this is all you get — and it is more than it looks:

- **strengths** is what already works. Do NOT touch these. An option that undoes a strength is a worse photo, however good the look.
- **distractions** names removable things WITH THEIR POSITION ("grey bin, bottom left"). This is EXECUTION detail: it belongs in \`internal_steps\`, not on a card of its own. Clearing a bin is not a photographic direction.
- **issues** is ordered worst first. Use it to make the result good — not to decide what to call the direction.
- **exposure**, **blown_or_crushed**, **color_cast** decide whether a \`grade\` is a rescue or just a mood. Say which.
- **skin** tells you if the photo was already over-smoothed. If it reads as heavily smoothed with no pores, bringing texture BACK is a real and unexpected improvement.
- **carries_over** / **must_be_built** decide whether a \`restage\` is even honest.
- **mood**, **location**, **time_of_day**, **outfit** are EVIDENCE, not selectors. They tell you what is in front of you so you can reason about it. They never map to a look on their own — see the rule below.

## FIRST DECIDE WHAT KIND OF DECISION THIS PHOTO NEEDS

Before you name a single direction, answer one question: **what shape of answer
does this photograph deserve?** Set \`decision_shape\` to it, and only then write
the picks.

- **\`single\`** — there is one clearly strongest way to go. Either the photo has
  an obvious best direction, or it is already good and wants one restrained
  move. → exactly 1 pick.
- **\`alternatives\`** — there are genuinely two different, roughly equally strong
  readings of this picture, and you would not want to choose for the user.
  → exactly 2 picks.
- **\`explore\`** — the photograph is unusually open and honestly carries three
  different strong directions. → exactly 3 picks.

**Two is not the safe middle.** If you find yourself reaching for
\`alternatives\` because it feels balanced, you have not decided — you have
defaulted. Ask instead: would I actually be torn between these two? If one is
plainly better, the answer is \`single\` and you say so with one pick. Padding a
strong single answer with a weaker second is not generosity, it is hedging.

Equally: do not force \`single\` to look decisive. If two directions really are
different and really are both good, offer both.

The number is a creative judgement about the photograph. It is never about what
fills a row nicely.

Rules, and the first is the one that is easy to get wrong:

1. **THEY MUST DIFFER IN KIND, NOT IN FLAVOUR.** Two camera looks is one idea offered twice, however different the looks feel to you. Pair a grade with a retouch, a rescue with a mood, a safe improvement with a bolder move. If the user hates the first, does the next give them a genuinely different answer? If not, drop it and hand back one.
2. **THEY MUST COME OUT OF THE READING.** Every pick has to trace back to something named in the photo reading — the light that is actually there, the outfit, the location, the time of day, the mood, the pose, what the reading calls a strength. A pick you could have made without seeing this photo is the wrong pick.
3. **NAME THE DIRECTION FOR THIS PHOTOGRAPH.** The catalogue ids and the current trends exist and you should use them when they genuinely fit. You may also name a direction that has never existed, as long as it comes out of this picture — then give it your own short lowercase slug as its id.

   But do NOT chase novelty. A plain, accurate name is better than an invented one: if the answer really is a clean natural portrait, call it that. You do not become a better director by making every answer sound unusual — you become one by being right about the photo in front of you. An exotic name on an ordinary decision is a costume.

   The four you will reach for out of habit are G7X Flash, golden hour, sunset and digicam. Reaching for one is right when the photo calls for it. Reaching for one because it is nearest on the shelf is the failure.

4. **JUDGE THIS PHOTO ON ITS OWN.** You see one photograph at a time and you have no memory of the last one. So do not try to be different from anything — just be right about this one.

   Two photographs CAN deserve the same direction. If flash is genuinely the answer for both, say flash for both; withholding the right answer to look varied is a worse mistake than repeating yourself. What must never happen is the lazy version: naming a direction you could have named without looking. The test is not "have I said this before" — it is "can I point at what in THIS photo made me say it". If you can, repeat away.

## THE EXECUTION LIBRARY (mode: grade)

You are reading this AFTER you formed a direction, and that is deliberate. These
are not ideas. They are recipes we already ship previews for, and the only
question you ask of them is: **can one of these realize the vision I just
decided on?**

Read each entry's **Can realize** first — that is what the recipe is capable of
building. **Requires** is secondary and technical: what the frame must contain
for the recipe to hold up at all. **A satisfied Requires is never on its own a
reason to recommend a look.** If your vision needs something none of these
build, keep your direction and write the execution yourself.

Use the \`id\` exactly as written — that is how the app finds the matching preview.

${looksForPrompt()}

## WHAT THE USER SEES AND WHAT YOU DO QUIETLY

Every direction has two layers, and confusing them is the mistake that makes a
photo app feel like a repair shop.

**\`label\` and \`caption\` are the VISIBLE layer** — a photographic vision, named
in a way the user can want. At most four words.

**THE LABEL NAMES THE RESULT, NEVER THE OPERATION.** This is the rule people get
wrong most often, so read it twice. The user is choosing a finished photograph,
not booking a repair. "Remove flare", "Clear her eyes", "Fix the corner" are
handgrips — nobody wants a handgrip, they want the picture that comes out of it.

Never begin a label with a verb. If your label describes what YOU do rather than
what THEY get, rewrite it.

**This holds even when the repair IS the whole direction.** A bin ruining a good
photo is a legitimate lead — and its name is still the outcome: "Just Her And
The Alley", not "Remove the man". The removal goes in \`internal_steps\` where it
belongs.

## SAY IT THE WAY A NORMAL PERSON WOULD

The user is not a photographer. He is someone with a photo on his phone.
Everything he READS — your line, every label, every caption — has to land
without him having to work it out.

**Banned: photographer's shop talk.** Words like *reads*, *holds*, *carries*,
*separation*, *negative space*, *falls off*, *crushed*, *blown*, *flat* (about
light), *frame* (meaning composition), *grade*. You may THINK in them. You must
not write them. Say what a person would say: the sky is white and empty, the
bench is messy, her face is dark.

**Banned: pretty writing.** No metaphors, no "turns into clean bright air", no
"the laugh deserves a cleaner frame". If it sounds like a caption in a magazine,
write it again plainer.

**The test, and it is a hard one:** could someone who has never edited a photo
read this and know what they are getting? If any word makes them pause, it is
the wrong word.

Plain beats clever every time. "Just her, no clutter on the bench." "Black and
white, so the empty sky stops mattering." That is the register — never reuse
those exact words.

**\`internal_steps\` is the QUIET layer** — the technical work that vision needs.
Short imperative lines, one job each, and the user never reads them:
\`recover the face from backlight\` · \`remove the black corner\` · \`reduce the
orange flare\` · \`keep the face and eye colour exactly\` · \`keep the outfit\` ·
\`hold the natural forest greens\` · \`separate her from the background\`

Rules for the two layers:
- **A distraction is almost never a direction.** "Remove the bin" is a step, not
  a vision. Put it in \`internal_steps\` of whichever direction you are offering.
- **An empty \`internal_steps\` is a correct answer.** If a photo is already clean
  and the direction is purely a look, there is nothing to list — say nothing.
  Inventing steps so the array is not empty is padding, and padding in the quiet
  layer is worse than in the visible one because nobody is there to catch it.
  The test is only this: would leaving it out visibly hurt this direction? If
  the reading names a real problem that would show through the look you are
  proposing, it belongs here. Otherwise it does not.
- Every direction that touches a photo with a person carries an identity step.
- **The \`prompt\` must stay COMPLETE ON ITS OWN.** It is what the image model
  receives, and that model never sees \`internal_steps\`. Write the full
  instruction there — the look AND everything the steps demand. The steps are
  your checklist, not a place to move the work to. A two-line \`prompt\` with a
  rich step list is a broken answer.
- A visible pick whose ONLY content is a repair is allowed — but only when the
  repair genuinely is the photograph's whole problem. A small defect must not
  take over the creative direction.

## WHICH ONE IS THE LEAD

Ask yourself exactly this: **"If I could show the user only ONE finished version
of this photo, which one would I choose?"** That is \`lead\`.

Not the safest. Not the one that fixes the most. The one you would put your name
on. A cleanup can absolutely be the lead — when a great photo is being ruined by
something in it. A small blemish must never be.

**trends — RANKED BY FIT, AND HONESTLY.** The user is asking "which of the current trends suits MY photo" — he must not have to search a gallery himself. Order them best-first and include only the ones this photograph can actually carry. Mark the single best one with \`fit: "best"\` when one genuinely stands out; everything else is \`"good"\`. A sunset trend on an indoor bathroom selfie is worse than no suggestion. **An empty list is a valid answer** — say so in your line rather than forcing one.

**A TREND IS EXECUTION, NOT A SUGGESTION.** A trend is something you may use to
realize or complement a direction you have ALREADY formed. Its existence is not
evidence that this photo should use it, and its late position in the
conversation gives it no priority. Read it the way you read the execution
library.

**That said, a trend can be a pick and even the lead** — when it genuinely is
the strongest way to build the direction you arrived at yourself. Then put it in
\`picks\` with its own id and make it the \`lead\`. The user should feel that you
chose it for their photo, not that they found it in a library.

**ONE EXCEPTION, and only when the user asks for it.** If the user's message
explicitly asks for a trend — they want to know which current trend suits their
photo — then that IS the task, and the ranking flips: your job becomes finding
the best trend for this picture among the ones available, and saying honestly if
none of them fits. Absent such a request, the order above holds.

## WHAT MAKES ANY DIRECTION GOOD
- It acts on something REALLY THERE — a named distraction, a named issue, the light in the frame. A look fighting the existing light reads as fake.
- **Name the flaw when there is one.** If the reading lists a harsh chin shadow, a blown background or crushed shadows, say so in your one line. That is more useful than a compliment.
- Never answer with a category. "A different look" is not a direction; "Y2K Digicam" is.
- The \`prompt\` stands alone. It goes to the image model unchanged, and that model has not seen this conversation.

## WHEN THE PHOTO CANNOT CARRY IT
A close selfie holds a face — no body, no ground, no light direction for a whole scene. Do not ask such a picture for what it cannot give. Say in half a sentence what it CAN carry, and offer that.

## FOR restage YOU MUST PUT FOUR THINGS IN THE PROMPT
Leave one out and the result looks pasted on:
1. What carries over and what is newly built ("only face and hair carry over; body, clothing, pose and the full framing are newly constructed").
2. Concrete camera geometry — height, distance, how much is in frame, where the horizon sits, feet or wheels visibly touching the ground.
3. An explicit relight — discard the old light by name, then state direction, hardness and colour temperature of the new one, matched across person, object and ground.
4. A specific location with ordinary clutter. Never "a modern street", never "blurred city".

## BRANDS
Real names are allowed and wanted, spelled correctly. Do not invent logos onto surfaces where none belong. If a logo would render badly, keep it angled or distant — but keep the brand.

## TOOLS
- \`offer_directions\` — your default. Whenever a photo is present and the exact edit was not spelled out.
- \`edit_image\` — only when someone names one complete, unambiguous result and there is nothing left to decide.
When in doubt, offer directions. Nothing is rendered until the user picks — so a wrong guess by you costs them a wasted image.`
}

const TOOLS = [
  {
    name: 'offer_directions',
    description: 'Show the user what this photo can become: as many strong ideas as it deserves (one, two or three), plus the trends that genuinely fit. Your default.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        decision_shape: {
          type: 'string',
          enum: ['single', 'alternatives', 'explore'],
          description: 'DECIDE THIS FIRST, before writing any pick. single = one clearly strongest direction (1 pick). alternatives = two genuinely different, equally strong readings (2 picks). explore = the photo honestly carries three (3 picks). Never pick "alternatives" because it feels balanced.',
        },
        message: {
          type: 'string',
          description: 'Your one line, and it must be SHORT: four to eight words, one sentence, never two, never more than twelve words. An instant opinion about THIS photo, not an analysis and not an announcement of what you will do. Never name a direction you are also offering as a pick. See the system prompt.',
        },
        picks: {
          type: 'array',
          minItems: 1,
          maxItems: 3,
          description: 'Exactly as many as decision_shape says: single=1, alternatives=2, explore=3.',
          items: { $ref: '#/$defs/direction' },
        },
        lead: {
          type: 'string',
          description: 'The id of the pick you would choose yourself, when one is clearly ahead. Omit when they are peers.',
        },
        trends: {
          type: 'array',
          minItems: 0,
          maxItems: 4,
          description: 'Only trends this photo can actually carry, best first. Leave empty if none fit.',
          items: { $ref: '#/$defs/direction' },
        },
      },
      required: ['decision_shape', 'message', 'picks'],
      $defs: {
        direction: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: {
              type: 'string',
              description: 'For a catalogue look its id, for a trend its id, otherwise a short lowercase slug you choose.',
            },
            label: {
              type: 'string',
              description: 'At most four words, and it MUST NAME THE FINISHED PHOTOGRAPH, never the operation. "Late-Night Street Flash", "Quiet Morning Light", "Just Her And The Alley" — not "Remove flare", "Clear her eyes", "Fix the corner". Never start with a verb. Even when the whole point of this direction is a repair, the name says what the user gets, not what you do; the doing belongs in internal_steps.',
            },
            caption: { type: 'string', description: 'A short half-sentence saying why this one, in PLAIN EVERYDAY WORDS. No photographer jargon (reads, holds, separation, blown, flat, grade, frame), no metaphors, no pretty writing. Someone who has never edited a photo must understand it instantly. See the system prompt.' },
            mode: { type: 'string', enum: ['grade', 'retouch', 'restage', 'generate'] },
            prompt: { type: 'string', description: 'A complete, self-contained image prompt.' },
            internal_steps: {
              type: 'array',
              maxItems: 8,
              description: 'The quiet layer: short imperative technical jobs THIS direction actually needs — remove the flare, recover the face from backlight, keep the face and eye colour. NEVER shown to the user; distractions and defects belong HERE, not in the label. LEAVE IT EMPTY when the direction needs no extra technical work — an empty array is a correct answer and padding it with invented steps is worse than leaving it out.',
              items: { type: 'string' },
            },
            fit: {
              type: 'string',
              enum: ['best', 'good'],
              description: 'Trends only: "best" for the single trend that genuinely stands out for this photo.',
            },
          },
          required: ['id', 'label', 'caption', 'mode', 'prompt'],
        },
      },
    },
  },
  {
    name: 'edit_image',
    description: 'Only when one complete, unambiguous result was named.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        message: { type: 'string' },
        mode: { type: 'string', enum: ['grade', 'retouch', 'restage', 'generate'] },
        prompt: { type: 'string' },
        quality: { type: 'string', enum: ['low', 'medium', 'high'] },
      },
      required: ['message', 'mode', 'prompt'],
    },
  },
]

const MODES = ['grade', 'retouch', 'restage', 'generate']
const KNOWN_LOOK_IDS = new Set(LOOKS.map((l) => l.id))

/**
 * Kürzt auf eine Wortgrenze statt mitten im Wort.
 *
 * GESEHEN im Testlauf: „…without touching their skin textu" und „…makes the
 * eye contact the whole pictu". Ein hartes `slice` schneidet dort, wo das
 * Zeichen zufällig liegt — und in einer Bildunterschrift, die der Nutzer LIEST,
 * sieht das nach kaputter Software aus, nicht nach einer Kürzung.
 */
function cut(value, max) {
  const text = String(value || '').trim()
  if (text.length <= max) return text
  const hard = text.slice(0, max)
  const space = hard.lastIndexOf(' ')
  // Nur zurückgehen, wenn dabei noch genug übrig bleibt — sonst verliert ein
  // einzelnes langes Wort die halbe Zeile.
  const kept = space > max * 0.6 ? hard.slice(0, space) : hard
  return kept.replace(/[\s,;:.\-–—]+$/, '') + '…'
}

/** Räumt auf, was das Modell geliefert hat. Nie darauf vertrauen, dass es passt. */
function cleanOptions(list) {
  if (!Array.isArray(list)) return []
  const seen = new Set()
  return list.map((o) => {
    const id = String(o?.id || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (!id || seen.has(id)) return null
    let prompt = String(o?.prompt || '').trim()
    const steps = Array.isArray(o?.internal_steps)
      ? o.internal_steps.map((x) => cut(x, 120)).filter(Boolean).slice(0, 8)
      : []

    // RETTEN STATT VERWERFEN.
    //
    // Die 40-Zeichen-Schranke soll Schrott aussortieren. Seit es
    // `internal_steps` gibt, legt das Modell die Substanz aber manchmal dorthin
    // und laesst den Prompt kurz — und dann warf diese Zeile eine vollstaendig
    // durchdachte Richtung weg. GEMESSEN: ein Foto von zwoelf kam mit NULL
    // Vorschlaegen zurueck, obwohl das Modell sauber geantwortet hatte.
    //
    // Ein kurzer Prompt mit Schritten ist kein Schrott, sondern eine anders
    // aufgeteilte Antwort. Also zusammensetzen, statt sie zu verlieren.
    if (prompt.length < 40 && steps.length) {
      prompt = [prompt, ...steps].filter(Boolean).join('. ')
    }
    if (prompt.length < 40) return null
    seen.add(id)
    return {
      id,
      label: cut(o?.label, 40) || id,
      caption: cut(o?.caption, 90),
      mode: MODES.includes(o?.mode) ? o.mode : 'grade',
      prompt,
      // Nur bekannte Looks haben ein Vorschaubild in der App.
      preview: KNOWN_LOOK_IDS.has(id) ? `card_look_${id}` : null,
      // Die leise Ebene. Kurz halten und nie leer durchlassen — eine leere
      // Zeichenkette im Schritt-Array liest sich beim Zusammenbauen des
      // Prompts wie ein vergessener Auftrag.
      internal_steps: steps,
      fit: o?.fit === 'best' ? 'best' : 'good',
    }
  }).filter(Boolean).slice(0, 4)
}

const clamp = (s, n) => String(s || '').slice(0, n)

/**
 * Ein Zug des Directors.
 *
 * `reading` ist die Lesung aus Stufe 1. Fehlt sie, gehen die Bilder direkt
 * mit — dann sieht Opus selbst, nur teurer und etwas schlechter.
 */
/**
 * Absicht „Trend-Auswahl" — ein EIGENER Zug, nicht der normale Director.
 *
 * Warum getrennt und nicht ein Schalter im grossen Prompt: der normale
 * Director soll seine Vision selbst bilden und Trends erst danach als
 * Ausfuehrung pruefen. Gaebe man ihm hier dieselbe Anleitung mit einem
 * zusaetzlichen „aber jetzt Trends", wuerde er anfangen, Trends generell zu
 * bevorzugen. Zwei Aufgaben, zwei Prompts.
 *
 * KOSTET NUR TEXT. Es geht kein Bild mit — die Lesung liegt vor und beantwortet
 * die Frage vollstaendig. Und es wird NICHTS gerendert: der Nutzer bekommt eine
 * Empfehlung und entscheidet selbst.
 */
export async function runTrendSelection({ reading = null, offered = [], provider = null }) {
  const choices = Array.isArray(offered)
    ? offered.filter((o) => o && typeof o.id === 'string' && o.id.trim()).slice(0, 24)
    : []
  if (!choices.length) {
    return { status: 200, json: { verdict: 'none_fit', why: 'No trends are available right now.', bestId: null, alsoIds: [], selectionId: null } }
  }
  const selectionId = newSelectionId()

  const known = await loadTrends().catch(() => [])
  const content = []
  const readingText = readingAsText(reading)
  if (readingText) content.push({ type: 'text', text: readingText })
  const trendText = trendChoicesAsText(choices, known)
  if (trendText) content.push({ type: 'text', text: trendText })
  content.push({ type: 'text', text: 'Which of these fits this photo best? Use the tool.' })

  const system = trendSelectionSystem()
  const messages = [{ role: 'user', content }]
  const route = provider === 'wavespeed' || provider === 'anthropic' ? provider : directorProvider()

  let call = null
  if (route === 'anthropic' && anthropicKey()) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 40_000)
    try {
      const r = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey(), 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: brainModel(), max_tokens: 1200,
          thinking: { type: 'adaptive' }, output_config: { effort: 'low' },
          system, tools: [TREND_TOOL], messages,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const data = await r.json().catch(() => ({}))
      if (r.ok) {
        const b = (Array.isArray(data?.content) ? data.content : []).find((x) => x?.type === 'tool_use')
        if (b) call = { name: b.name, input: b.input || {} }
      } else {
        console.error('trend selection failed', { status: r.status, message: data?.error?.message || null })
      }
    } catch { clearTimeout(timeout) }
  }
  if (!call) {
    const w = await callWaveSpeed({ model: brainModel(), system, messages, tools: [TREND_TOOL], maxTokens: 1200 }).catch(() => null)
    if (w?.ok && w.call) call = w.call
  }

  // Kein Urteil ist kein Fehler: dann zeigt die App die Liste wie bisher.
  if (!call) {
    logTrendEvent({ id: selectionId, phase: 'ranked', verdict: 'no_answer',
                    model: brainModel(), route, offered: choices.map((c) => c.id), reading })
    return { status: 200, json: { verdict: 'none_fit', why: '', bestId: null, alsoIds: [], selectionId } }
  }

  const ids = new Set(choices.map((c) => c.id))
  const best = String(call.input?.best_id || '').trim()
  const also = (Array.isArray(call.input?.also_ids) ? call.input.also_ids : [])
    .map((x) => String(x || '').trim()).filter((x) => ids.has(x) && x !== best).slice(0, 2)
  const fits = call.input?.verdict === 'one_fits' && ids.has(best)

  const why = clamp(call.input?.why, 200)
  // Alles, was ein spaeterer Vergleich braucht — in EINER Zeile, ohne
  // zusaetzlichen Modellaufruf.
  logTrendEvent({
    id: selectionId, phase: 'ranked',
    verdict: fits ? 'one_fits' : 'none_fit',
    bestId: fits ? best : null,
    alsoIds: fits ? also : [],
    why,
    model: brainModel(), route,
    offered: choices.map((c) => c.id),
    reading,
  })

  return {
    status: 200,
    json: {
      verdict: fits ? 'one_fits' : 'none_fit',
      bestId: fits ? best : null,
      why,
      alsoIds: fits ? also : [],
      model: brainModel(),
      selectionId,
    },
  }
}

/**
 * Was der Nutzer TATSAECHLICH gewaehlt hat.
 *
 * Ohne dieses zweite Ereignis liesse sich nie beantworten, ob eine Empfehlung
 * etwas taugte: man saehe nur, was der Director gesagt hat, nie ob jemand ihm
 * gefolgt ist. `followed` ist die eine Zahl, an der sich die Qualitaet spaeter
 * ablesen laesst.
 *
 * Kein Modellaufruf, keine Antwort ausser einer Bestaetigung.
 */
export function recordTrendChoice({ selectionId = null, chosenId = null, bestId = null, source = null }) {
  logTrendEvent({
    id: selectionId, phase: 'chosen',
    chosenId, bestId,
    followed: Boolean(chosenId && bestId && chosenId === bestId),
    // Kein Vorschlag dagewesen? Dann ist „ignoriert" die falsche Frage.
    hadRecommendation: Boolean(bestId),
    source,
  })
  return { status: 200, json: { ok: true } }
}

export async function runDirector({ message = '', history = [], images = [], reading = null, provider = null, debug = false }) {
  const route = provider === 'wavespeed' || provider === 'anthropic' ? provider : directorProvider()
  if (route === 'anthropic' && !anthropicKey()) {
    return { status: 503, json: { error: 'missing_anthropic_key' } }
  }

  const turns = (Array.isArray(history) ? history : []).slice(-10).map((h) => ({
    role: h?.role === 'assistant' ? 'assistant' : 'user',
    content: clamp(h?.text, 1500),
  })).filter((t) => t.content)

  // Der aktuelle Zug. Bilder NUR, wenn die Lesung fehlt — sonst reicht Text,
  // und Text ist über Züge hinweg wiederverwendbar und billiger.
  const content = []
  if (!reading) {
    images.slice(0, 4).forEach((b64) => {
      content.push({ type: 'image', source: { type: 'base64', media_type: detectMediaType(b64), data: b64 } })
    })
  } else {
    const text = readingAsText(reading)
    if (text) content.push({ type: 'text', text })
  }
  content.push({ type: 'text', text: clamp(message, 3000) || 'Look at this photo and tell me what to do with it.' })

  const messages = [...turns, { role: 'user', content }]

  // Trends als Systemnachricht MITTEN im Verlauf: lässt den gecachten Präfix
  // unberührt und läuft über den Betreiber-Kanal statt als Nutzertext.
  // Muss auf eine Nutzernachricht folgen und darf zuletzt stehen — genau hier.
  const trends = await loadTrends().catch(() => [])
  const trendMsg = trendSystemMessage(trends)
  if (trendMsg) messages.push(trendMsg)

  const system = buildSystem()

  // Ab hier ist der Weg austauschbar. Beide Anbieter liefern dasselbe
  // Dreigespann zurück — Text, Werkzeugaufruf, Verbrauch —, damit alles
  // darunter identisch bleibt.
  let text = ''
  let call = null
  let usage = { in: 0, cache_read: 0, cache_write: 0, out: 0 }
  // Welcher Weg AM ENDE geantwortet hat. Kann vom gewuenschten abweichen,
  // wenn ausgewichen wurde — und dann soll die Antwort das auch sagen.
  let usedRoute = route
  /// Das Modell, das die API tatsaechlich gemeldet hat.
  let servedModel = brainModel()

  /**
   * Derselbe Zug ueber WaveSpeed. Gibt `null` zurueck, wenn auch das nicht
   * geht — dann bleibt es beim urspruenglichen Fehler.
   */
  const viaWaveSpeed = async ({ system, messages, reason }) => {
    const w = await callWaveSpeed({ model: brainModel(), system, messages, tools: TOOLS }).catch(() => null)
    if (!w?.ok) return null
    console.warn('director fell back to wavespeed', { reason })
    return { text: w.text, call: w.call, usage: w.usage }
  }

  if (route === 'wavespeed') {
    const w = await callWaveSpeed({ model: brainModel(), system, messages, tools: TOOLS })
    if (!w.ok) return { status: w.status, json: { error: w.error, detail: w.detail || null } }
    text = w.text
    call = w.call
    usage = w.usage
  } else {
    const payload = {
      model: brainModel(),
      max_tokens: 4000,
      // Adaptiv, weil Opus 5 mit abgeschaltetem Denken deutlich seltener zu
      // Werkzeugen greift — und ohne Werkzeugaufruf gibt es keine Karten.
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      // Der Cache-Punkt sitzt hinter der stabilen Wissensbasis. Alles
      // Wechselnde steht danach, damit ein Trend-Update nicht den ganzen
      // Präfix wegwirft.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      // Auch die WERKZEUGE cachen. Das Schema ist rund 2.000 Token und ändert
      // sich zwischen zwei Zügen nie — ohne diese Markierung wird es trotzdem
      // jedes Mal voll berechnet. Der Marker gehört auf das LETZTE Werkzeug;
      // er cacht den ganzen Block davor.
      tools: TOOLS.map((t, i) =>
        i === TOOLS.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t
      ),
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
          'x-api-key': anthropicKey(),
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timeout)
      const fallback = await viaWaveSpeed({ system, messages, reason: err?.name === 'AbortError' ? 'timeout' : 'unreachable' })
      if (fallback) { ({ text, call, usage } = fallback); usedRoute = 'wavespeed' }
      else return { status: 502, json: { error: err?.name === 'AbortError' ? 'director_timeout' : 'director_unreachable' } }
    }
    clearTimeout(timeout)

    const data = r ? await r.json().catch(() => ({})) : null
    if (r && !r.ok) {
      console.error('director request failed', {
        status: r.status, model: brainModel(),
        type: data?.error?.type || null, message: data?.error?.message || null,
      })
      // AUSWEICHEN STATT AUSFALLEN.
      //
      // Gemessen am 04.09.2026: der Anthropic-Zugang lief leer
      // („credit balance is too low"), und JEDER Zug endete mit 502 — die App
      // zeigte nur noch einen Fehler. Dabei liegt derselbe Opus 5 ueber
      // WaveSpeed bereit, mit eigenem Guthaben und eigenem Schluessel.
      //
      // Ein Ausfall des einen Zugangs darf den Director nicht anhalten. Der
      // direkte Weg bleibt die Vorgabe (nur dort gibt es `thinking` und
      // `effort`, und mit denen faellt die Zahl der Vorschlaege sichtbar
      // vielfaeltiger aus — gemessen 1 bis 3 statt fast immer 2). Aber
      // schlechter waehlen ist besser als gar nicht antworten.
      const fallback = await viaWaveSpeed({ system, messages, reason: `http_${r.status}` })
      if (fallback) { ({ text, call, usage } = fallback); usedRoute = 'wavespeed' }
      else return { status: 502, json: { error: `director_http_${r.status}`, detail: data?.error?.message || null } }
    }

    // Sicherheitsklassifikatoren können ablehnen — das kommt als HTTP 200.
    if (data?.stop_reason === 'refusal') {
      return { status: 200, json: { message: "I can't do that with this photo. Try another one.", picks: [], trends: [], options: [], action: null, refused: true } }
    }

    // Nur auswerten, wenn Anthropic wirklich geantwortet hat. Wurde oben
    // ausgewichen, stehen `text`, `call` und `usage` bereits.
    if (usedRoute !== 'wavespeed') {
      // Was die API SELBST sagt, nicht was wir konfiguriert haben. Ohne das
      // liesse sich nie pruefen, ob wirklich Opus 5 geantwortet hat.
      if (data?.model) servedModel = String(data.model)
      const blocks = Array.isArray(data?.content) ? data.content : []
      text = blocks.filter((b) => b?.type === 'text').map((b) => b.text).join('\n').trim()
      const toolBlock = blocks.find((b) => b?.type === 'tool_use')
      call = toolBlock ? { name: toolBlock.name, input: toolBlock.input || {} } : null
      usage = {
        in: data?.usage?.input_tokens ?? 0,
        cache_read: data?.usage?.cache_read_input_tokens ?? 0,
        cache_write: data?.usage?.cache_creation_input_tokens ?? 0,
        out: data?.usage?.output_tokens ?? 0,
      }
    }
  }

  // Nur fuer die Fehlersuche und nur auf ausdrueckliche Anfrage: was das
  // Modell WIRKLICH geschickt hat, bevor `cleanOptions` daran war. Ohne das
  // ist ein leeres Ergebnis nicht von einem verworfenen zu unterscheiden.
  const debugRaw = debug ? { toolName: call?.name || null, rawInput: call?.input ?? null, text } : null

  // EIN leeres Ergebnis ist in der App ein toter Bildschirm: Foto und
  // Maskottchen stehen da, darunter nichts. GEMESSEN: dasselbe Foto lieferte
  // zweimal null Vorschlaege und beim dritten Mal zwei — das Modell laesst
  // `picks` ueber das OpenAI-Protokoll gelegentlich einfach weg, weil dort
  // `required` nicht erzwungen wird.
  //
  // Deshalb GENAU EIN zweiter Anlauf, und nur in diesem Fall. Er kostet nur
  // dann etwas, wenn ohne ihn ohnehin nichts angekommen waere.
  if (call?.name === 'offer_directions' && cleanOptions(call.input?.picks).length === 0) {
    const retry = await callWaveSpeed({ model: brainModel(), system, messages, tools: TOOLS }).catch(() => null)
    if (retry?.ok && retry.call?.name === 'offer_directions'
        && cleanOptions(retry.call.input?.picks).length > 0) {
      console.warn('director retried after empty picks')
      call = retry.call
      text = retry.text || text
      usedRoute = 'wavespeed'
    }
  }

  if (call?.name === 'offer_directions') {
    // Bis zu DREI. Der Deckel bei zwei war die Stelle, an der aus einem
    // Urteil eine Layout-Regel wurde.
    let picks = cleanOptions(call.input.picks).slice(0, 3)
    // `lead` nur behalten, wenn es wirklich auf einen der Picks zeigt.
    const leadRaw = String(call.input.lead || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    let lead = picks.some((p) => p.id === leadRaw) ? leadRaw
      : (picks.length === 1 ? picks[0].id : null)

    // FORM UND ANZAHL IN EINKLANG BRINGEN.
    //
    // `decision_shape` wird VOR den Picks gesetzt — es ist die eigentliche
    // Entscheidung, die Picks sind ihre Ausfuehrung. Weichen beide
    // voneinander ab, gilt: die erklaerte Absicht schlaegt die Ausfuehrung,
    // solange sich das ohne Erfinden herstellen laesst.
    //
    // Zu VIELE Picks: auf die erklaerte Zahl kuerzen, den Lead zuerst — er ist
    // die Wahl des Directors und darf nie der sein, der wegfaellt.
    // Zu WENIGE: es liesse sich nur durch Erfinden auffuellen, und ein
    // erfundener dritter Vorschlag ist genau das Fuellmaterial, das hier weg
    // soll. Dann folgt die Form der Wirklichkeit.
    const SHAPE_COUNT = { single: 1, alternatives: 2, explore: 3 }
    const COUNT_SHAPE = { 1: 'single', 2: 'alternatives', 3: 'explore' }
    let shape = SHAPE_COUNT[call.input.decision_shape] ? call.input.decision_shape : null

    if (shape && picks.length) {
      const want = SHAPE_COUNT[shape]
      if (picks.length > want) {
        const leadPick = picks.find((p) => p.id === lead)
        picks = [leadPick, ...picks.filter((p) => p !== leadPick)].filter(Boolean).slice(0, want)
        console.warn('director shape trim', { shape, from: cleanOptions(call.input.picks).length, to: picks.length })
      } else if (picks.length < want) {
        console.warn('director shape relabel', { declared: shape, actual: picks.length })
        shape = COUNT_SHAPE[picks.length] || shape
      }
    }
    if (!shape) shape = COUNT_SHAPE[picks.length] || null
    // Nach dem Kuerzen kann der Lead der einzige Verbliebene sein.
    if (picks.length === 1) lead = picks[0].id
    else if (!picks.some((p) => p.id === lead)) lead = null
    const trends = cleanOptions(call.input.trends)
    return {
      status: 200,
      json: {
        message: clamp(call.input.message, 300) || text || '',
        picks,
        lead,
        decisionShape: shape,
        trends,
        // Alte Clients lesen `options` — sie bekommen die Picks.
        options: picks,
        action: null,
        reading: reading || null,
        model: servedModel,
        provider: usedRoute,
        usage,
        ...(debugRaw ? { debug: debugRaw } : {}),
      },
    }
  }

  if (call?.name === 'edit_image') {
    const prompt = String(call.input.prompt || '').trim()
    return {
      status: 200,
      json: {
        message: clamp(call.input.message, 300) || text || 'Mach ich.',
        picks: [],
        trends: [],
        options: [],
        action: prompt ? {
          prompt,
          mode: MODES.includes(call.input.mode) ? call.input.mode : 'grade',
          quality: ['low', 'medium', 'high'].includes(call.input.quality) ? call.input.quality : 'medium',
        } : null,
        reading: reading || null,
        model: servedModel,
        provider: usedRoute,
        usage,
      },
    }
  }

  // Reine Textantwort — zulässig, etwa auf eine Rückfrage ohne Foto.
  return {
    status: 200,
    json: { message: text || 'Send me a photo and I\'ll take it from there.', picks: [], trends: [], options: [], action: null, reading: reading || null, model: brainModel(), usage },
  }
}

/** Voller Prompt zu einer Look-id — falls die App ihn selbst braucht. */
export { lookPrompt, LOOKS }
