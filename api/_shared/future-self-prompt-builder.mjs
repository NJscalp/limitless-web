/** Highest-priority — facial hair must match input exactly (never add, never remove). */
const FACIAL_HAIR_PIXEL_LOCK = `[FACIAL HAIR PIXEL LOCK — ABSOLUTE, NON-NEGOTIABLE]
Before editing, detect whether the input has visible beard, stubble, mustache, or is clean-shaven.
The output facial-hair state MUST match the input EXACTLY — same presence, same absence, same coverage.

IF INPUT IS CLEAN-SHAVEN (no beard, no stubble, no mustache):
- Output MUST remain clean-shaven. Do NOT add, draw, paint, generate, or imply any beard, stubble, shadow-beard, 5-o-clock shadow, or fuzz where none exists in the input pixels.
- Do NOT masculinize the lower face with fake stubble or dark jaw shading.

IF INPUT HAS BEARD / STUBBLE / MUSTACHE:
- Preserve the EXACT same facial hair — same coverage area, density, length, color, and edge lines as the input.
- Do NOT shave, remove, fade out, or clean up the beard. Do NOT reduce stubble to smooth skin.
- Do NOT redesign, reshape, or extend the beard beyond what is visible in the input.
- When editing jaw/chin skin: de-bloat ONLY the skin visible between hair strands — never delete the hair itself.

FOR ALL INPUTS:
- Copy facial-hair pixels from the input wherever hair exists. Treat facial hair as a frozen layer like the background.
- Eyebrows follow eyebrow rules only — never confuse brow grooming with adding/removing beard.`

/** Cheeks = primary sculpt target via soft tissue; jaw/mandible/chin bones never grow or get invented. */
const CHEEK_DEFINITION_FOCUS = `[CHEEK / WANG DEFINITION — PRIMARY GOAL, SOFT TISSUE ONLY]
#1 PRIORITY: make the CHEEKS (buccal / mid-face / Wangen) clearly more defined — fresher, leaner, less bloated.
- Reduce buccal puffiness and water retention until the cheek area reads noticeably sculpted through VOLUME REMOVAL only.
- Cheekbones may look slightly clearer because overlying soft tissue is reduced — same zygomatic bone position and width as input.
- Match this person's native cheek shape — no generic model hollows, no carved cheekbone points that are not in the input.
- The glow-up should read as "defined cheeks / less mid-face bloat" — NOT as "new jaw" or "sharper mandible".

JAW / MANDIBLE / CHIN BONES — ABSOLUTE BAN (DO NOT ENLARGE OR INVENT):
- Do NOT make jaw bones, mandible, chin bone, gonial angles, or jaw corners bigger, wider, sharper, squarer, longer, or more prominent.
- Do NOT invent bone structure, bone edges, skeletal angles, or a "chiseled" mandible that is not in the input silhouette.
- Do NOT simulate a larger mandible with shadow, contour, relighting, or under-jaw darkening.
- If the input has a soft/round jaw bone, keep that exact bone shape — only remove puffiness on top.
- Jaw looking "leaner" is allowed ONLY from removing soft tissue/fluid over the EXACT same bone outline — never from new or enlarged bone geometry.
- When in doubt: prioritize cheek de-bloat; leave jaw bone edges closer to the input rather than sharper.`

/** Glow-up = retouch existing face only. Never add new features, hair, makeup, or accessories. */
const GLOW_UP_ONLY_NO_INVENTION = `[GLOW-UP ONLY — DO NOT INVENT ANYTHING NEW]
You are retouching the EXISTING photo — NOT generating a new person or new features.

ONLY ALLOWED EDITS (on pixels that already exist):
- Reduce facial puffiness / water retention (cheeks, mid-face, under-eyes, jaw SOFT tissue)
- Clear minor skin blemishes, acne, redness — keep pores, freckles, moles, texture
- Slightly fresher under-eyes; optional minimal brow cleanup (same shape only)

ABSOLUTELY FORBIDDEN — automatic failure if any appear:
- Inventing beard, stubble, mustache, scruff, 5-o'clock shadow, or dark jaw fuzz where none exists
- Removing beard/stubble that IS in the input
- Adding makeup, eyeliner, mascara, lipstick, contour, blush, fake tan, or beauty-filter gloss
- Changing nose shape/size, lip shape/size, eye shape, iris color, or ear shape
- Adding accessories (glasses, piercings, hats) or removing existing ones
- Inventing new bone structure, sharper jaw, or new cheekbone edges
- Relighting, recoloring skin, changing background/clothing/hair color
- Plastic/airbrushed skin, porcelain filter, or "different person" look

Rule: output = same person, same face, same grooming state — just fresher, less puffy, cleaner skin.`

/** Short hard stop for concise prompts — jaw bones must never be invented. */
const JAW_BONE_INVENTION_BAN = `[JAW BONE — NEVER INVENT OR ENLARGE]
The mandible, chin bone, gonial angle, and jaw corners in the output must overlay the input bone outline exactly.
Forbidden: squarer jaw, wider mandible, sharper jaw corners, longer chin, new bone mass, or shadow-painted "jaw sculpt".
Allowed: remove cheek/mid-face and under-jaw SOFT tissue only — bones stay pixel-identical.`

/** Reinforces that definition = de-bloat only; the model must not invent bone structure. */
const REALISTIC_BONE_ENFORCEMENT = `[REALISTIC BONE ENFORCEMENT — NO INVENTED STRUCTURE]
This edit is ONLY soft-tissue de-bloating and minor skin cleanup. You are NOT a face sculptor.

MANDIBLE / JAW / CHIN BONES:
- The jaw bone outline in the output must overlay the input jaw bone outline exactly — same width, same angles, same chin tip, same gonial corners.
- "More defined jaw" means LESS puffiness over the SAME bone — NOT a new sharper, squarer, narrower, or wider mandible.
- Do NOT invent cheekbone points, jaw corners, or chin projection that are not in the input silhouette.
- Do NOT use shadow painting, contour makeup, or relighting to fake a sharper bone edge.

CHEEKBONES:
- Define cheeks through buccal de-bloat ONLY — leaner, fresher cheek area; zygomatic bone position and width stay identical.
- Do NOT enlarge cheekbones, extend zygomatic width, or invent new cheekbone points or angular bone edges.
- Do NOT carve harsh hollows — definition = reduced puffiness over the same native structure.

REALISM TEST:
- If the jaw/chin/cheekbone BONE silhouette looks different from the input → you failed. Revert bone edges to match input exactly.
- Visible soft-tissue de-bloat is REQUIRED — the before/after must look clearly different, but bones and facial hair stay identical.`

/** Lighting/color/identity permanence — realistic de-bloat only (no razor-sharp / surgical language). */
const CRITICAL_LIGHTING_COLOR_IDENTITY_LOCK = `[CRITICAL LOCK: 100% LIGHTING, COLOR, AND IDENTITY PERMANENCE]
Modify ONLY soft-tissue de-bloating (reduce water retention / puffiness) and clear minor skin blemishes on the exact person from the input. Freeze exact ambient lighting, brightness, shadow mapping, and native skin color. No artificial lighting shifts.

1. STRICT COLOR, LIGHTING & SHADOW LOCK:
- Retain the precise native skin undertone and complexion. No tanning, graying, or color shifts.
- Match the exact brightness, low-light environment, and existing shadows of the source. Do NOT add new light sources, highlights, or artificial contour shadows.

2. VISIBLE LOWER-FACE DE-BLOAT (SOFT TISSUE ONLY — BONES FROZEN):
- Clearly reduce lower-face puffiness and water retention — jaw reads noticeably leaner through soft-tissue removal; mandible and chin BONE outline pixel-identical.
- Skin hugs the same native bone architecture; remove puffiness visibly. Never alter, widen, sharpen, or mutate bone structure.

3. VISIBLE MID-FACE DE-BLOAT (SOFT TISSUE ONLY):
- Strong buccal de-bloat — cheeks clearly less bloated; native cheekbones noticeably clearer through tissue reduction, not carving or hollow sculpting.
- No artificial dark shading or makeup. Definition from volume removal interacting with original lighting only.

4. AWAKE EYE AREA & CLEAR SKIN:
- Reduce under-eye bags and morning swelling. Same eye shape, iris color, and gaze. Eyebrows: beautify only — same shape, arch, thickness, position.
- Reduce minor blemishes/acne/redness. Preserve raw skin texture, micro-pores, grain, and existing stubble/beard exactly as in input. No airbrush.

5. FRAMING & BACKGROUND LOCK:
- Background, framing, crop, clothing, and camera depth 100% identical to source.`

/** Always appended — strongest guardrails for identity + scene lock. */
const SCENE_AND_IDENTITY_LOCK = `[EDIT REGION — FACE + GROOMING]
- You may edit: facial skin and soft tissue from the frontal hairline down to the jaw/chin (cheeks, jaw, chin, under-eyes, upper/lower eyelids, eyebrows, brow area, nose surface, forehead skin, lips surface) — but NOT facial hair coverage (beard/stubble/mustache pixels are frozen).
- Hair at the temples and frontal hairline: styling/grooming only — same person, same length/color.
- You must NOT edit: hat, cap, beanie, hood, headband, ears, neck, shirt, jacket, background, walls, or any object/accessory.
- Treat hat, clothing, and background pixels as a frozen layer — copy them exactly from the input.

[ABSOLUTE COLOR LOCK — ZERO DRIFT]
- Every non-face pixel must keep the EXACT same RGB hue, saturation, and brightness as the input — especially hat/headwear, clothing, and background.
- Hat/cap/beanie: identical color, fabric texture, logos, folds, and shadows — no recolor, no desaturation, no warming/cooling.
- Clothing: identical color and fabric; no shirt/jacket/hoodie color shift.
- Hair: same color and general length as input — but allow a cleaner, intentionally styled softmaxxing look at temples and hairline (more polished, better framing of face). No dramatic color change or completely different haircut.
- Background & environment: pixel-stable — no relighting, no color grade, no contrast change outside the face.
- Global white balance, exposure, and color grading of the full image must stay identical to the input.

[LIGHTING & EXPOSURE LOCK — MATCH INPUT EXACTLY]
- This is a moody, low-light photo. Keep the EXACT same global exposure, contrast, gamma, black levels, and color temperature as the input.
- Do NOT relight the face. Do NOT add studio lighting, fill flash, beauty lighting, or HDR.
- Preserve the same shadow placement: nose shadow, under-chin shadow, cheek shadows, eye socket depth — only refine soft-tissue within those existing shadows.
- Face skin luminance and undertone must match the neck, ears, and visible chest skin in the input — use those as the color reference.
- Do NOT brighten, warm, cool, or saturate the face globally. No "healthy glow" color shift.

[FACE SKIN TONE & TYPE LOCK]
- Structural glow-up only: leaner cheeks, less puffiness — achieved by reducing soft-tissue volume, NOT by changing skin color, brightness, or skin type.
- Keep the EXACT native skin undertone, melanin level, and warmth/coolness as the input. Match face luminance to neck/ears — no global brightening or tanning.
- Preserve skin TYPE: same pore density pattern, same oily/dry/matte character, same fine lines and expression creases — do NOT convert to smooth porcelain or beauty-filter skin.
- Cleaner skin means ONLY: reduce active blemishes, pimples, and localized redness; soften minor uneven texture — NOT removal of freckles, moles, beauty marks, or natural skin grain.
- Preserve every mole, freckle, and skin mark in the same position and density.
- Keep natural micro-pores, skin grain, and peach fuzz visible at camera resolution. Facial hair state must match input exactly — never add, never remove. No airbrush, no wax figure, no plastic skin, no makeup overlay.
- Preserve identity: same bone structure, nose, lips, eye shape and iris color.
- Preserve identical crop, framing, head position, scale, and camera perspective.

[BONE LOCK — JAW, CHIN & CHEEKBONE GEOMETRY FROZEN — HIGHEST PRIORITY]
- Mandible, chin bone, gonial angle, jaw width, chin projection, chin tip, and jaw CORNER position must stay PIXEL-IDENTICAL to the input — front view and side profile.
- The jawline BONE silhouette is a frozen outline — trace it exactly from the input. Do NOT sharpen, straighten, square, narrow, widen, or extend the mandible edge.
- Cheekbone position, zygomatic width, and malar bone outline must stay IDENTICAL — do NOT sharpen, extend, or angularize cheekbones beyond this person's native structure.
- Do NOT reshape, extend, shorten, narrow, or widen the jaw or chin. No V-line surgery, no chin advancement/recession, no gonial rotation, no "chiseled model jaw" effect.
- Jawline looking "more defined" = ONLY from removing soft tissue and water retention ON TOP of the same bone — never from moving or reshaping the bone edge or deepening shadows to fake a sharper jaw.
- De-bloat must match THIS face's proportions — soft curves stay soft; do not force a generic model cheek hollow or harsh angular contour.
- If unsure, keep the jaw bone outline closer to the input rather than sharper.

[FACIAL HAIR LOCK — NEVER INVENT, NEVER REMOVE]
- Clean-shaven input → clean-shaven output. Zero invented stubble, shadow-beard, or fuzz.
- Bearded/stubbled input → same beard/stubble in output. Do NOT shave, fade, or remove facial hair.
- Copy facial-hair pixels exactly from input. Never generate new hair density or erase existing hair.
- Jaw de-bloat edits skin between hairs only — facial hair coverage unchanged.

[EYEBROW LOCK — BEAUTIFY ONLY, DO NOT RESHAPE]
- Eyebrows: beautify ONLY — cleaner groomed edges, remove stray hairs, slightly neater appearance.
- Keep the EXACT same brow shape, arch height, arch curve, thickness, length, density, and position as the input.
- Do NOT reshape the arch, do NOT lift or lower the brow, do NOT make brows fuller/thinner, do NOT change brow color.
- Do NOT move brow bone position or skull ridge.

[EYE LOCK]
- Eyes: reduce periorbital/under-eye puffiness and upper-lid heaviness; eyes look more open and awake — iris color, eye size, and eye shape unchanged.
- Do NOT apply heavy eye makeup, false lashes, or change eyelid crease structure.`

const FORBIDDEN_CHANGES = `[FORBIDDEN — DO NOT DO THESE]
- Inventing ANY new facial feature, grooming, or accessory not present in the input.
- Inventing, adding, or drawing beard, stubble, mustache, scruff, or 5-o-clock shadow where none exists in the input.
- Darkening the chin/jaw/upper lip to simulate beard, stubble, or masculinization.
- Removing, shaving, fading, or erasing beard/stubble that IS visible in the input.
- Adding makeup, eyeliner, mascara, lipstick, contour, blush, or fake tan.
- Reshaping jaw bones, chin bone, mandible width, gonial angle, chin projection, or chin length (front or side).
- Enlarging, widening, lengthening, or making jaw/mandible/chin bones more prominent than in the input.
- Inventing jaw bones, mandible corners, chin bone mass, or cheekbone bone structure not present in the input.
- Inventing sharper/square/wider/narrower jaw or cheekbone BONE geometry — even if it looks "better".
- Moving the jaw corner, chin tip, or profile jaw line — bone silhouette must match input exactly.
- Deepening jaw or under-chin shadows to simulate a sharper mandible — shadows must match input placement.
- Brightening, warming, or recoloring the face or the full image.
- Relighting or changing shadow direction anywhere in the frame.
- Recoloring hat, cap, headwear, or clothing (tank top, shirt, hoodie).
- Changing hair color or the dark moody background/window.
- Global contrast, saturation, or white-balance shifts.
- Making skin look "radiant", "glowing", or studio-lit.
- Changing skin color, undertone, tan level, or skin type (oily/dry/matte/dewy character).
- Removing freckles, moles, or permanent skin marks.
- Airbrushing, blurring, or plasticizing skin texture.
- Masculinizing a female face (squarer jaw, wider mandible, heavier lower face) or feminizing a male face.
- Reshaping eyebrows — changing arch, thickness, length, lift, or position.
- Over-sharpening or angularizing cheekbones beyond this person's natural facial structure.
- Forcing harsh cheek hollows or generic model contours that do not match this specific face.
- Any "razor-sharp", surgical, or model-grade jaw sculpt — this is a realistic de-bloat edit only.`

const REALISTIC_GLOW_UP_RANGE = `[REALISTIC GLOW-UP CALIBRATION — VISIBLE BUT BELIEVABLE]
This is a REAL-WORLD softmaxxing preview — months of skincare, sleep, hydration, and lower facial puffiness. NOT surgery. NOT a different face.
The before/after MUST look clearly different at first glance — same person, visibly fresher and less puffy.

VISIBLE & REQUIRED (soft tissue + grooming only):
- Clearly less water retention and facial puffiness — face reads noticeably fresher and leaner.
- Clearly cleaner, smoother skin (retinol/vitamin-C level) — same color and skin type.
- Clearly fresher under-eyes, less periorbital puffiness.
- Eyebrows slightly neater (beautify only — same shape).
- Cheeks clearly less bloated — existing bone structure more visible through reduced soft tissue.

BONE-SAFE (soft tissue only):
- Jawline: visible soft-tissue de-puff; mandible BONE outline unchanged — never a new sharp/square jaw bone.
- Chin/submental: clear soft-tissue reduction under the same chin bone.
- Cheekbones: clearly clearer through de-bloat — not carved model hollows.

Someone who knows this person should say: "You look way fresher / less puffy" — not "You got surgery."`

const SOFTMAXXING_GUIDE = `[SOFTMAXXING GLOW-UP — REALISTIC, FACE-MATCHED]
Simulate believable months of real softmaxxing — NOT surgery. Before/after should show clear but REALISTIC improvements for THIS face.

1. WATER RETENTION / PUFFINESS (top priority — soft tissue only):
   - Reduce facial puffiness and water retention — cheeks and mid-face look fresher and less bloated.
   - Existing cheekbones slightly more visible through de-bloat — matched to their native shape; no harsh hollows.

2. SKINCARE (Retinol + Vitamin C — color/type unchanged):
   - Clearly cleaner, smoother, more even skin — keep pores, grain, freckles, moles, same undertone.

3. EYES — reduce under-eye bags and puffiness; more open, rested look (iris/eye shape unchanged).

4. EYEBROWS — beautify only (same shape): cleaner edges, stray hairs removed.

5. JAW / SUBMENTAL — gentle to moderate soft-tissue de-puff ONLY; mandible and chin BONE outline pixel-identical; never invent beard.

The viewer should notice: fresher, less puffy, cleaner skin, better-rested eyes — same person, realistic glow-up range.`
const STRUCTURAL_METHOD = `[HOW TO CREATE DEFINITION — REALISTIC SOFT TISSUE ONLY, BONES FROZEN]
Facial DEFINITION = reduce puffiness and water retention that blur THIS person's natural features. Do NOT move bones or create a sharper jaw than the input.

- Cheeks / mid-face: reduce buccal puffiness — face reads fresher and slightly leaner; cheekbones gently clearer (same bone positions).
- Jaw area: ONLY remove overlying puffiness/fluid — the mandible BONE edge must trace the input exactly; never sharpen or square the jaw bone.
- Submental: moderate reduction of pad under chin — chin bone tip and profile unchanged.
- Under-eyes: reduce bags and puffiness — rested, open look.
- Eyebrows: beautify only — same shape, arch, thickness, position.
- Skin: retinol/vitamin-C clarity — cleaner; same color, undertone, skin type.
- No relighting, no shadow manipulation on jaw — definition from realistic volume removal only.`

const DEFINITION_TARGET = `[DEFINITION TARGET — CLEARLY VISIBLE, SAME PERSON]
The result = same person after a believable glow-up: noticeably less puffiness/water retention, clearly cleaner skin, fresher eyes, neater brows — jaw and chin BONES unchanged.
Before/after must be OBVIOUS side-by-side — not subtle, not invisible. Plausible but clearly improved.
Priority: water retention ↓↓, skin ↑↑, eyes ↑↑, cheeks (de-bloat) ↑↑, brows (beautify) ↑. Jaw bone silhouette = identical to input.`

const REALISM_CAP = `[VISIBILITY TARGET — STRONG GLOW-UP, ZERO BONE CHANGE]
The glow-up MUST be clearly visible in before/after — noticeably less puffy, clearly cleaner skin, fresher eyes.
If trade-off between "invisible/subtle edit" and "visible de-puff" — always choose VISIBLE soft-tissue improvement.
If trade-off between "more defined jaw bone" and "realistic same person" — keep bones identical; achieve definition through soft-tissue removal only.
Never invent facial hair. Never reshape eyebrows. Hat, clothing, background, and lighting stay identical.`

const SOFT_TISSUE_PUSH = `[PRIMARY TARGETS — VISIBLE FACE-MATCHED GLOW-UP]
1. Water retention / puffiness — TOP priority. Reduce bloating until face reads CLEARLY fresher and leaner (bones unmoved).
2. Skin — strong retinol/vitamin-C clarity improvement; same undertone and skin type.
3. Eyes & under-eyes — clearly de-puff; open, rested look (iris unchanged).
4. Eyebrows — beautify ONLY; same shape, arch, thickness, position, color.
5. Cheeks / buccal — strong de-bloat; clearly leaner; cheekbones noticeably clearer in their natural shape.
6. Submental / jaw SOFT tissue — LIGHT de-puff only if needed; mandible and chin BONE outline FROZEN; never invent beard or bone.
Definition = visible cheek/mid-face refinement for THIS face. NOT jaw surgery. NOT bone reshaping. NOT invented mandible.`

const VISIBLE_GLOW_UP_TARGET = `[⚠️ VISIBILITY REQUIREMENT — BEFORE/AFTER MUST DIFFER]
This is NOT a subtle filter. The output must show a CLEAR, NOTICEABLE glow-up:
- Face clearly less puffy / bloated (especially cheeks, mid-face, under-eyes).
- Skin clearly cleaner and more even (blemishes reduced).
- Eyes clearly more open and rested.
Same person, same bones, same facial hair — but the improvement must be obvious when comparing before vs after.
If the result looks nearly identical to the input, the edit FAILED — push de-bloat and skin clarity harder (bones still frozen).`

const SKIN_REALISM_GUIDE = `[SKIN — RETINOL + VITAMIN C CLARITY (NO COLOR/TYPE CHANGE)]
Goal: skin looks like 6+ months of retinol + vitamin C — clearly cleaner, smoother, more even — NOT a beauty filter or makeup.
DO:
- Visibly reduce pimples, acne, active blemishes, and localized redness.
- Smooth rough texture and uneven patches (retinol effect) while keeping real micro-pores and skin grain.
- Even out tone blotches (vitamin C effect) while keeping natural skin variation, freckles, and moles.
- Match face skin color exactly to neck, ears, and visible chest — same undertone, no brightening.
- Preserve freckles, moles, beauty marks, and natural melanin pattern.
DO NOT:
- Change skin color, undertone, tan level, or overall brightness.
- Change skin type (do not turn oily skin into matte porcelain or dry skin into dewy glass).
- Remove freckles, moles, or permanent skin marks.
- Apply foundation, concealer, or heavy makeup look.
- Airbrush, blur, or plasticize the skin.`

function normalizeFutureSelfMode(raw) {
  const m = String(raw || 'front').trim().toLowerCase()
  if (m === 'side' || m === 'side_profile' || m === 'sideprofile') return 'side'
  return 'front'
}

const FRONT_TASK = `[TASK: VISIBLE NATURAL GLOW-UP — DEFINED CHEEKS + STRONG DE-BLOAT]
Same person, same bones, same facial hair. Apply a CLEARLY VISIBLE glow-up: defined leaner cheeks (buccal de-bloat), strong water-retention reduction, cleaner skin, fresher eyes — mandible/chin/cheekbone BONE geometry pixel-identical; never enlarged or invented. Before/after must look obviously different.`

const SIDE_TASK = `[TASK: SIDE-PROFILE VISIBLE GLOW-UP — STRONG DE-BLOAT]
Clear submental/cheek soft-tissue de-puff — jaw/chin BONE profile identical to input. Facial hair unchanged. Zero lighting/color drift. Before/after clearly different.`

const ZONE_LABELS = {
  jawline: 'Jawline (soft tissue only — mandible bone frozen)',
  cheekbones: 'Cheek / buccal area',
  chinNeck: 'Chin & submental (under-chin) area',
  eyeArea: 'Eyes, under-eyes & upper eyelids',
  eyebrows: 'Eyebrows (beautify only — same shape)',
  skin: 'Skin clarity (realistic cleanup — color & type unchanged)',
  symmetry: 'Left–right facial balance',
  waterRetention: 'Facial puffiness / water retention',
  facialDefinition: 'Overall facial leanness & edge clarity',
  midfaceFullness: 'Midface balance',
}

const INTENSITY_ORDER = ['skip', 'minimal', 'light', 'moderate', 'strong']

/** @param {Record<string, unknown> | null | undefined} raw */
export function parseGlowUpMetrics(raw) {
  if (!raw || typeof raw !== 'object') return null
  const aliases = {
    jawline: ['jawline', 'jawlineDefinition', 'jaw'],
    cheekbones: ['cheekbones', 'cheekboneDefinition', 'cheeks'],
    chinNeck: ['chinNeck', 'chinNeckDefinition', 'chin', 'submental'],
    eyeArea: ['eyeArea', 'eyes', 'underEye'],
    brows: ['brows', 'eyebrows', 'browArea'],
    skin: ['skin', 'skinQuality', 'skinQuality30to90'],
    forehead: ['foreheadSmoothness', 'forehead'],
    symmetry: ['symmetry', 'facialSymmetry'],
    waterRetention: ['waterRetention', 'bloat', 'puffiness'],
    facialDefinition: ['facialDefinition', 'definition', 'faceDefinition'],
    midfaceFullness: ['midfaceFullness', 'midface'],
    overall: ['overall', 'overallScore'],
    potential: ['potential', 'potentialScore'],
    bloatSeverity: ['bloatSeverity', 'bloatSeverity0to100'],
    nose: ['nose', 'noseScore'],
    lips: ['lips', 'lipScore'],
  }

  const out = {}
  for (const [canonical, keys] of Object.entries(aliases)) {
    for (const key of keys) {
      const n = Number(raw[key])
      if (Number.isFinite(n) && n > 0) {
        out[canonical] = Math.min(100, Math.round(n))
        break
      }
    }
  }
  return Object.keys(out).length ? out : null
}

/** @param {Record<string, unknown> | null | undefined} raw */
export function parseFaceProfile(raw) {
  if (!raw || typeof raw !== 'object') return null
  const out = {}
  const level = String(raw.definitionLevel || raw.definition_level || '').trim()
  if (level) out.definitionLevel = level
  const harmony = String(raw.looksmaxHarmony || raw.harmony || '').trim()
  if (harmony) out.looksmaxHarmony = harmony
  const jaw = String(raw.looksmaxJaw || raw.jaw_psl || '').trim()
  if (jaw) out.looksmaxJaw = jaw
  const bloat = Number(raw.bloatSeverity ?? raw.bloatSeverity0to100)
  if (Number.isFinite(bloat) && bloat >= 0) out.bloatSeverity = Math.min(100, Math.round(bloat))
  const gender = String(raw.gender || raw.genderRaw || '').trim().toLowerCase()
  if (gender === 'female' || gender === 'male') out.gender = gender
  const facialHair = String(raw.facialHair || raw.facial_hair || '').trim().toLowerCase()
  if (facialHair === 'none' || facialHair === 'stubble' || facialHair === 'beard') {
    out.facialHair = facialHair
  }
  return Object.keys(out).length ? out : null
}

function normalizeGender(profile) {
  const g = String(profile?.gender || profile?.genderRaw || '').trim().toLowerCase()
  if (g === 'female' || g === 'f') return 'female'
  if (g === 'male' || g === 'm') return 'male'
  return 'unspecified'
}

/** Explicit mandatory block from app-detected facial hair state — placed first in prompt. */
function buildFacialHairMandatoryBlock(profile) {
  const hair = String(profile?.facialHair || profile?.facial_hair || '').trim().toLowerCase()
  const gender = normalizeGender(profile)

  if (gender === 'female' || hair === 'none') {
    return `[⚠️ MANDATORY RULE #1 — CLEAN-SHAVEN / NO FACIAL HAIR IN INPUT]
The input has NO beard and NO stubble. Output MUST stay 100% clean-shaven on chin, jaw, upper lip, and cheeks.
FORBIDDEN (automatic failure): inventing beard, stubble, scruff, 5-o-clock shadow, dark jaw fuzz, or beard-shaped shading.
Do NOT darken the lower face to simulate hair. Do NOT add texture that reads as facial hair.
Visible soft-tissue de-puff on cheeks, under-eyes, and jaw is ALLOWED — but chin/jaw skin must stay smooth and hair-free (no invented stubble).
Natural glow-up = clearly less puffiness + cleaner skin — lower face stays clean-shaven like the input.`
  }

  if (hair === 'stubble') {
    return `[⚠️ MANDATORY RULE #1 — STUBBLE PRESENT IN INPUT]
The input has visible STUBBLE. Preserve the EXACT same stubble coverage, density, and color in the output.
FORBIDDEN: shaving smooth, removing stubble, fading stubble away, or inventing a full beard.
FORBIDDEN: adding stubble to areas that were smooth in the input.
Copy stubble pixels from the input — treat stubble as a frozen layer.`
  }

  if (hair === 'beard') {
    return `[⚠️ MANDATORY RULE #1 — BEARD PRESENT IN INPUT]
The input has a visible BEARD. Preserve the EXACT same beard shape, coverage, density, length, and color.
FORBIDDEN: shaving, trimming away, fading, or cleaning up the beard. Do NOT remove facial hair.
FORBIDDEN: changing beard style or extending beard beyond input boundaries.
Copy beard pixels from the input — treat beard as a frozen layer.`
  }

  return `[⚠️ MANDATORY RULE #1 — FACIAL HAIR MUST MATCH INPUT EXACTLY]
Default assumption: the input face is CLEAN-SHAVEN unless you clearly see beard or stubble pixels.
- If smooth/clean-shaven → output stays 100% clean-shaven. ZERO invented stubble, beard, scruff, shadow-beard, or dark jaw fuzz.
- If stubble or beard visible → output keeps identical facial hair (never shave, fade, or remove).
- Do NOT darken chin/jaw skin to simulate hair. Do NOT add texture that reads as facial hair.
Never invent facial hair. Never remove facial hair. Glow-up = de-bloat + skin cleanup only.`
}

function buildGenderGuidance(profile) {
  const gender = normalizeGender(profile)
  if (gender === 'female') {
    return `[FEMALE GLOW-UP — REALISTIC, PRESERVE FEMININITY & JAW BONE]
- Reduce puffiness/water retention — fresher, slightly leaner cheeks; her natural soft bone structure unchanged.
- Cleaner skin, fresher under-eyes, neater brows (same shape) — same woman, realistic glow-up.
- Jaw/chin/cheekbone bones PIXEL-IDENTICAL — no squarer or sharper mandible. No invented facial hair.`
  }
  if (gender === 'male') {
    return `[MALE GLOW-UP — REALISTIC, JAW BONE PIXEL-LOCKED, FACIAL HAIR UNCHANGED]
- Reduce puffiness/water retention — fresher face, slightly leaner cheeks; mandible outline identical to input.
- FACIAL HAIR: if clean-shaven in input → stay clean-shaven (zero invented stubble). If beard/stubble visible → keep exact same coverage — never shave or remove.
- Brows: beautify only (same shape). Chin/jaw/cheekbone bones must not move.`
  }
  return `[REALISTIC GLOW-UP — FACE-MATCHED]
- Believable de-puff and skin/eye/brow improvement. Jaw bones pixel-identical. Facial hair unchanged — never invent, never remove.`
}

function normalizeDefinitionLevel(raw) {
  const s = String(raw || '').trim().toLowerCase()
  if (s.startsWith('lean')) return 'lean'
  if (s.startsWith('bloat')) return 'bloated'
  if (s.startsWith('avg')) return 'average'
  return s || null
}

function metricAvg(values) {
  const nums = values.filter((v) => Number.isFinite(v))
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/**
 * Distinguish water-retention puffiness vs adipose fullness vs already-lean.
 * @returns {{ type: string, strategy: string, label: string }}
 */
export function classifyFacialComposition(metrics, profile) {
  const defLevel = normalizeDefinitionLevel(profile?.definitionLevel)
  const water = metrics?.waterRetention
  const faceDef = metrics?.facialDefinition
  const jaw = metrics?.jawline
  const chin = metrics?.chinNeck
  const cheek = metrics?.cheekbones
  const overall = metrics?.overall
  const potential = metrics?.potential
  const bloatSeverity = metrics?.bloatSeverity
    ?? profile?.bloatSeverity
    ?? (Number.isFinite(water) ? 100 - water : null)

  const boneAvg = metricAvg([jaw, cheek, chin])
  const headroom = Number.isFinite(overall) && Number.isFinite(potential)
    ? potential - overall
    : 0
  const puffinessHigh = Number.isFinite(water) && water < 56
  const puffinessModerate = Number.isFinite(water) && water < 68
  const leanWater = Number.isFinite(water) && water >= 72
  const strongDef = Number.isFinite(faceDef) && faceDef >= 68
  const uniformlySoft = Number.isFinite(jaw) && jaw < 52
    && Number.isFinite(chin) && chin < 52
    && Number.isFinite(faceDef) && faceDef < 54
  const strongBone = boneAvg != null && boneAvg >= 58

  if (defLevel === 'lean' || (leanWater && strongDef)) {
    return {
      type: 'lean',
      strategy: 'definition_polish',
      label: 'already lean — definition polish only',
    }
  }

  if (uniformlySoft && (puffinessModerate || (Number.isFinite(bloatSeverity) && bloatSeverity >= 42))) {
    return {
      type: 'adipose',
      strategy: 'structural_sculpt',
      label: 'adipose / soft-tissue fullness — realistic facial leanness',
    }
  }

  if (puffinessHigh && (strongBone || headroom >= 10 || defLevel === 'bloated')) {
    return {
      type: 'water_retention',
      strategy: 'de_puff',
      label: 'water-retention bloat — face-adapted de-puff',
    }
  }

  if (puffinessModerate && strongBone) {
    return {
      type: 'water_retention',
      strategy: 'de_puff',
      label: 'moderate puffiness with good bone — de-puff and sharpen',
    }
  }

  return {
    type: 'mixed',
    strategy: 'balanced_sculpt',
    label: 'mixed soft tissue — balanced sculpt and de-puff',
  }
}

function compositionBoost(composition) {
  if (composition.type === 'water_retention') return 3
  if (composition.type === 'mixed') return 2
  if (composition.type === 'adipose') return 2
  return 1
}

function buildDiagnosisSection(metrics, profile, composition) {
  const lines = []
  lines.push('[PRE-EDIT ANALYSIS — READ ALL METRICS BEFORE EDITING]')
  lines.push('Step 1: Study the input face — jaw contour, cheek fullness, under-chin, under-eyes, midface, skin.')
  lines.push(`Step 2: Scan diagnosis — ${composition.label}.`)

  if (metrics) {
    const parts = []
    if (metrics.jawline != null) parts.push(`jaw ${metrics.jawline}/100`)
    if (metrics.cheekbones != null) parts.push(`cheeks ${metrics.cheekbones}/100`)
    if (metrics.chinNeck != null) parts.push(`chin/neck ${metrics.chinNeck}/100`)
    if (metrics.waterRetention != null) parts.push(`anti-bloat ${metrics.waterRetention}/100`)
    if (metrics.facialDefinition != null) parts.push(`definition ${metrics.facialDefinition}/100`)
    if (metrics.overall != null && metrics.potential != null) {
      parts.push(`headroom ${metrics.potential - metrics.overall} pts`)
    }
    if (parts.length) lines.push(`Step 3: Personalized metrics — ${parts.join(', ')}.`)
  }

  if (profile?.definitionLevel) {
    lines.push(`Definition tier from scan: ${profile.definitionLevel}.`)
  }

  lines.push('Step 4: Apply ONLY the glow-up strategy below — match edit type to diagnosis.')

  if (composition.type === 'water_retention') {
    lines.push(`[DIAGNOSIS: WATER RETENTION / PUFFINESS]
- Primary target: reduce facial water retention and puffiness — fresher, less bloated; jaw bone unchanged.
- Mandible/chin bone stay fixed — remove soft tissue/fluid only, never reshape jaw edge.`)
  } else if (composition.type === 'adipose') {
    lines.push(`[DIAGNOSIS: SOFT-TISSUE FULLNESS]
- Gently lean buccal/submental soft tissue — realistic de-bloat for this face; cheekbones slightly clearer; jaw bone frozen.`)
  } else if (composition.type === 'lean') {
    lines.push(`[DIAGNOSIS: LEAN FACE — SKIN/EYES/BROWS POLISH]
- Focus on skin clarity, under-eye refresh, brow beautify (same shape); minimal jaw/chin change.`)
  } else {
    lines.push(`[DIAGNOSIS: MIXED — BALANCED REALISTIC GLOW-UP]
- Balanced de-puff + skin/eye improvement; jaw and chin bone locked.`)
  }

  return lines.join('\n')
}

/** Headroom between current overall and potential → push intensity up. */
function globalIntensityBoost(metrics) {
  const overall = metrics?.overall
  const potential = metrics?.potential
  let boost = 2
  if (Number.isFinite(overall) && Number.isFinite(potential)) {
    const gap = potential - overall
    if (gap >= 8) boost += 2
    else if (gap >= 4) boost += 1
  }
  return boost
}

/** Gender-aware jaw/chin soft-tissue caps (bones always frozen — keep jaw edits minimal). */
function jawSoftTissueLimits(profile) {
  const gender = normalizeGender(profile)
  if (gender === 'female') {
    return { ceiling: 'light', floor: 'minimal' }
  }
  return { ceiling: 'light', floor: 'minimal' }
}

/** Gender-aware boost for cheek/skin zones. */
function boneAdjacentLimits(profile) {
  const gender = normalizeGender(profile)
  if (gender === 'female') {
    return { cheekExtra: 2, skinFloor: 'strong' }
  }
  if (gender === 'male') {
    return { cheekExtra: 2, skinFloor: 'strong' }
  }
  return { cheekExtra: 1, skinFloor: 'strong' }
}

/** Never go below this level for a zone (after boost). */
function intensityFloor(level, floor) {
  const a = INTENSITY_ORDER.indexOf(level)
  const b = INTENSITY_ORDER.indexOf(floor)
  if (a < 0 || b < 0) return level
  return INTENSITY_ORDER[Math.max(a, b)]
}

/** Never exceed this level for a zone (bone-adjacent caps). */
function capIntensity(level, ceiling) {
  const a = INTENSITY_ORDER.indexOf(level)
  const b = INTENSITY_ORDER.indexOf(ceiling)
  if (a < 0 || b < 0) return level
  return INTENSITY_ORDER[Math.min(a, b)]
}

/** Jaw/chin soft-tissue — moderate for male, light for female; bones stay frozen. */
const BONE_ADJACENT_CEILING_DEFAULT = 'moderate'

/**
 * Lower score → stronger edit. Higher score → skip or lighter touch.
 * @returns {'skip' | 'minimal' | 'light' | 'moderate' | 'strong'}
 */
function zoneIntensity(score, boost = 0) {
  let level
  if (!Number.isFinite(score)) {
    level = 'strong'
  } else if (score >= 92) {
    level = 'skip'
  } else if (score >= 80) {
    level = 'minimal'
  } else if (score >= 64) {
    level = 'light'
  } else if (score >= 48) {
    level = 'moderate'
  } else {
    level = 'strong'
  }

  if (level !== 'skip' && boost > 0) {
    const idx = INTENSITY_ORDER.indexOf(level)
    level = INTENSITY_ORDER[Math.min(INTENSITY_ORDER.length - 1, idx + boost)]
  }
  return level
}

/** Eyebrows never exceed moderate — beautify only, no reshape. */
const BROW_CEILING = 'moderate'

const INTENSITY_INSTRUCTIONS = {
  skip: 'SKIP — tiny polish only; still slightly fresher if possible.',
  minimal: 'MINIMAL — subtle but visible refinement in before/after.',
  light: 'LIGHT — clear de-puff; noticeably fresher face; jaw/chin BONE unchanged.',
  moderate: 'MODERATE — strong soft-tissue de-puff on cheeks/eyes/skin; mandible bone identical to input.',
  strong: 'STRONG — maximum water-retention reduction; clearly leaner face; jaw/chin BONE pixel-identical — never sharper mandible bone.',
}

function zoneLine(label, intensity, extra = '') {
  const instr = INTENSITY_INSTRUCTIONS[intensity]
  return `- ${label}: ${instr}${extra ? ` ${extra}` : ''}`
}

/** Score for brow zone — uses brows metric or falls back to eyeArea. */
function browScore(metrics) {
  if (Number.isFinite(metrics?.brows)) return metrics.brows
  if (Number.isFinite(metrics?.eyeArea)) return metrics.eyeArea
  if (Number.isFinite(metrics?.forehead)) return metrics.forehead
  return undefined
}

/** Score for skin — forehead can inform brow but skin uses skin/forehead. */
function skinScore(metrics) {
  if (Number.isFinite(metrics?.skin)) return metrics.skin
  if (Number.isFinite(metrics?.forehead)) return metrics.forehead
  return undefined
}

function buildFrontFocus(metrics, composition, profile) {
  const boost = globalIntensityBoost(metrics) + compositionBoost(composition)
  const limits = boneAdjacentLimits(profile)
  const jawLimits = jawSoftTissueLimits(profile)
  const gender = normalizeGender(profile)
  const softFloor = 'moderate'
  const lines = []
  lines.push(`[PERSONALIZED FOCUS — VISIBLE de-bloat${gender === 'female' ? ', feminine jaw bone preserved' : ', jaw bone pixel-locked, facial hair unchanged'}]`)

  const bloatBoost = boost + (composition.type === 'water_retention' ? 2 : 1)
  lines.push(zoneLine(
    ZONE_LABELS.waterRetention,
    intensityFloor(zoneIntensity(metrics.waterRetention, bloatBoost), softFloor),
    gender === 'female'
      ? 'Strong water-retention reduction — clearly fresher, less puffy cheeks/mid-face; mandible bone unchanged.'
      : 'Strong water-retention reduction — clearly less bloated face; mandible bone outline identical to input.',
  ))

  lines.push(zoneLine(
    ZONE_LABELS.cheekbones,
    intensityFloor(zoneIntensity(metrics.cheekbones, boost + 1 + limits.cheekExtra), softFloor),
    gender === 'female'
      ? 'Strong buccal de-bloat — clearly leaner cheeks, cheekbones noticeably clearer; jaw bone FROZEN.'
      : 'Strong buccal de-bloat — clearly leaner cheeks; mandible BONE edge must not move or sharpen.',
  ))

  if (metrics.midfaceFullness != null) {
    lines.push(zoneLine(
      ZONE_LABELS.midfaceFullness,
      intensityFloor(zoneIntensity(metrics.midfaceFullness, boost + 1), softFloor),
      gender === 'female'
        ? 'Moderate mid-face de-puff — fresher; jaw bone unchanged.'
        : 'Moderate mid-face de-puff — fresher; mandible bone unchanged.',
    ))
  }

  lines.push(zoneLine(
    ZONE_LABELS.eyeArea,
    intensityFloor(zoneIntensity(metrics.eyeArea, boost + 2), 'strong'),
    'Clearly de-puff under-eyes and upper lids — open, rested, awake look; same iris color and eye shape.',
  ))

  lines.push(zoneLine(
    ZONE_LABELS.eyebrows,
    capIntensity(
      intensityFloor(zoneIntensity(browScore(metrics), boost), 'light'),
      BROW_CEILING,
    ),
    'Beautify ONLY — cleaner edges, remove stray hairs, neater groomed look; EXACT same shape, arch, thickness, position, and color as input.',
  ))

  lines.push(zoneLine(
    ZONE_LABELS.jawline,
    intensityFloor(
      capIntensity(zoneIntensity(metrics.jawline, boost), jawLimits.ceiling),
      jawLimits.floor,
    ),
    gender === 'female'
      ? 'Minimal jaw soft-tissue de-puff ONLY if needed; mandible BONE outline pixel-identical; do NOT square, sharpen, or invent jaw bone.'
      : 'Minimal jaw soft-tissue de-puff ONLY if needed — mandible BONE outline pixel-identical; NEVER sharpen, square, widen, or invent jaw/mandible bone.',
  ))

  lines.push(zoneLine(
    ZONE_LABELS.chinNeck,
    intensityFloor(
      capIntensity(zoneIntensity(metrics.chinNeck, boost), jawLimits.ceiling),
      jawLimits.floor,
    ),
    gender === 'female'
      ? 'Minimal submental soft-tissue de-puff if needed — chin bone and profile FROZEN; never invent jaw/chin bone.'
      : 'Minimal submental soft-tissue de-puff if needed — chin projection/length/tip FROZEN; never invent sharper chin or mandible bone.',
  ))

  if (metrics.facialDefinition != null) {
    lines.push(zoneLine(
      ZONE_LABELS.facialDefinition,
      intensityFloor(zoneIntensity(metrics.facialDefinition, boost + 2), softFloor),
      'Realistic overall freshness — less puffiness; jaw/chin bones unchanged.',
    ))
  }

  lines.push(zoneLine(
    ZONE_LABELS.skin,
    intensityFloor(zoneIntensity(skinScore(metrics), boost + 1), limits.skinFloor),
    'Retinol + vitamin C clarity — clearly cleaner, smoother skin; keep pores, freckles, moles; same luminance, undertone, and skin type.',
  ))

  if (gender === 'male' || gender === 'female') {
    lines.push('- Facial hair: match input exactly — clean-shaven stays clean-shaven (no invented stubble); existing beard/stubble stays with same coverage (never shaved off). Copy hair pixels from input.')
  }

  if (metrics.symmetry != null && metrics.symmetry < 68) {
    lines.push(zoneLine(
      ZONE_LABELS.symmetry,
      zoneIntensity(metrics.symmetry, boost),
      'Subtle left–right balance polish — no structural changes.',
    ))
  }

  lines.push('- Nose & lips: SKIP — do not alter size, shape, or profile.')

  return lines.join('\n')
}

function buildSideFocus(metrics, composition, profile) {
  const boost = globalIntensityBoost(metrics) + compositionBoost(composition)
  const limits = boneAdjacentLimits(profile)
  const jawLimits = jawSoftTissueLimits(profile)
  const gender = normalizeGender(profile)
  const softFloor = 'moderate'
  const lines = []
  lines.push(`[PERSONALIZED FOCUS — VISIBLE side de-bloat${gender === 'female' ? ', jaw profile pixel-locked' : ''}]`)

  lines.push(zoneLine(
    ZONE_LABELS.cheekbones,
    intensityFloor(zoneIntensity(metrics.cheekbones, boost + 2 + limits.cheekExtra), softFloor),
    gender === 'female'
      ? 'Strong cheek de-bloat; feminine profile bone curve unchanged.'
      : 'Strong cheek de-bloat from side; mandible profile bone unchanged.',
  ))

  lines.push(zoneLine(
    ZONE_LABELS.eyeArea,
    intensityFloor(zoneIntensity(metrics.eyeArea, boost + 2), 'strong'),
    'Clearly de-puff lateral under-eye and upper lid — rested, awake look.',
  ))

  lines.push(zoneLine(
    ZONE_LABELS.eyebrows,
    capIntensity(
      intensityFloor(zoneIntensity(browScore(metrics), boost), 'light'),
      BROW_CEILING,
    ),
    'Beautify ONLY from side — same shape, arch, thickness, position, color.',
  ))

  lines.push(zoneLine(
    ZONE_LABELS.chinNeck,
    intensityFloor(
      capIntensity(zoneIntensity(metrics.chinNeck, boost + 1), jawLimits.ceiling),
      jawLimits.floor,
    ),
    gender === 'female'
      ? 'Clear submental soft tissue; chin profile bone FROZEN.'
      : 'Clear submental soft tissue; chin/jaw profile bone pixel-identical.',
  ))

  lines.push(zoneLine(
    ZONE_LABELS.jawline,
    intensityFloor(
      capIntensity(zoneIntensity(metrics.jawline, boost + 1), jawLimits.ceiling),
      jawLimits.floor,
    ),
    'Clear jaw soft-tissue de-puff; mandible profile outline must match input exactly.',
  ))

  lines.push('- Nose, lips, forehead profile: SKIP — do not alter profile silhouette.')

  lines.push(zoneLine(
    ZONE_LABELS.skin,
    intensityFloor(zoneIntensity(skinScore(metrics), boost + 1), 'strong'),
    'Retinol + vitamin C clarity from side; same color and skin type.',
  ))

  if (gender === 'male' || gender === 'female') {
    lines.push('- Facial hair (side): match input exactly — never invent stubble, never remove existing beard/stubble.')
  }

  return lines.join('\n')
}

function buildDefaultFocus(mode, profile) {
  const gender = normalizeGender(profile)
  if (mode === 'side') {
    if (gender === 'female') {
      return `[PERSONALIZED FOCUS — female, VISIBLE glow-up]
- Water retention: STRONG — clearly fresher, less puffy; jaw bone frozen.
- Cheeks: STRONG — clearly leaner; feminine profile unchanged.
- Eyes: STRONG — clear under-eye de-puff.
- Eyebrows: MODERATE — beautify only; same shape.
- Chin & submental: MODERATE — clear soft tissue de-puff; chin bone FROZEN.
- Jawline (side): LIGHT — soft tissue de-puff; mandible profile identical to input.
- Skin: STRONG — retinol/vitamin-C clarity.
- Nose/lips/forehead profile: SKIP.`
    }
    return `[PERSONALIZED FOCUS — VISIBLE side glow-up, jaw bone pixel-locked]
- Cheeks (side): STRONG — clear de-bloat; bone curve unchanged.
- Eyes: STRONG — under-eye de-puff.
- Eyebrows: MODERATE — beautify only.
- Chin & submental: MODERATE — clear soft tissue; chin/jaw profile FROZEN.
- Jawline (side): MINIMAL — soft tissue de-puff only if needed; mandible outline identical to input.
- Skin: STRONG — retinol/vitamin-C clarity.
- Facial hair: match input exactly.
- Nose/lips/forehead profile: SKIP.`
  }
  if (gender === 'female') {
    return `[PERSONALIZED FOCUS — female, VISIBLE glow-up]
- Water retention: STRONG — clearly fresher, less puffy face; bones frozen.
- Cheeks: STRONG — clearly leaner; no harsh sculpting.
- Eyes: STRONG — clear under-eye de-puff.
- Eyebrows: MODERATE — beautify only; same shape.
- Jawline: LIGHT — soft tissue de-puff; mandible bone FROZEN.
- Under-chin: LIGHT — submental soft tissue only.
- Skin: STRONG — retinol/vitamin-C clarity; same tone and skin type.`
  }
  return `[PERSONALIZED FOCUS — VISIBLE glow-up, jaw bone pixel-locked]
- Water retention: STRONG — clearly fresher, less bloated; mandible unchanged.
- Cheeks: STRONG — clearly leaner, more defined; primary sculpt target.
- Eyes: STRONG — clear under-eye de-puff.
- Eyebrows: MODERATE — beautify only; same shape.
- Jawline: MINIMAL — only light soft-tissue if needed; mandible bone identical to input; never invent bone.
- Under-chin: MINIMAL — submental soft tissue only; chin bone FROZEN.
- Skin: STRONG — retinol/vitamin-C clarity; same tone and skin type.`
}

/**
 * Hybrid prompt: analysis-first diagnosis + scene lock + metric-driven focus.
 * @param {string} mode
 * @param {Record<string, unknown> | null | undefined} metricsRaw
 * @param {Record<string, unknown> | null | undefined} [faceProfileRaw]
 */
export function buildHybridGlowUpPrompt(mode = 'front', metricsRaw = null, faceProfileRaw = null) {
  const key = normalizeFutureSelfMode(mode)
  const metrics = parseGlowUpMetrics(metricsRaw)
  const profile = parseFaceProfile(faceProfileRaw)
  const composition = classifyFacialComposition(metrics || {}, profile || {})
  const task = key === 'side' ? SIDE_TASK : FRONT_TASK
  const diagnosis = metrics ? buildDiagnosisSection(metrics, profile, composition) : null
  const genderGuide = buildGenderGuidance(profile)
  const focus = metrics
    ? (key === 'side' ? buildSideFocus(metrics, composition, profile) : buildFrontFocus(metrics, composition, profile))
    : buildDefaultFocus(key, profile)

  const facialHairMandatory = buildFacialHairMandatoryBlock(profile)
  const parts = [facialHairMandatory, GLOW_UP_ONLY_NO_INVENTION, CHEEK_DEFINITION_FOCUS, JAW_BONE_INVENTION_BAN, task, VISIBLE_GLOW_UP_TARGET]
  if (diagnosis) parts.push(diagnosis)
  parts.push(
    FACIAL_HAIR_PIXEL_LOCK,
    REALISTIC_BONE_ENFORCEMENT,
    CHEEK_DEFINITION_FOCUS,
    CRITICAL_LIGHTING_COLOR_IDENTITY_LOCK,
    genderGuide,
    REALISTIC_GLOW_UP_RANGE,
    SOFTMAXXING_GUIDE,
    SCENE_AND_IDENTITY_LOCK,
    SKIN_REALISM_GUIDE,
    FORBIDDEN_CHANGES,
    STRUCTURAL_METHOD,
    DEFINITION_TARGET,
    SOFT_TISSUE_PUSH,
    REALISM_CAP,
    focus,
  )
  return parts.join('\n\n')
}

function buildConciseFacialHairLine(profile) {
  const gender = normalizeGender(profile)
  const hair = String(profile?.facialHair || profile?.facial_hair || '').trim().toLowerCase()
  if (gender === 'female' || hair === 'none') {
    return 'Facial hair: input is clean-shaven — output MUST stay 100% clean-shaven. NEVER add stubble, beard, scruff, shadow-beard, or dark jaw fuzz.'
  }
  if (hair === 'beard') {
    return 'Facial hair: beard in input — copy exact same beard pixels (never shave, trim away, or remove).'
  }
  if (hair === 'stubble') {
    return 'Facial hair: stubble in input — copy exact same stubble (never shave smooth or add full beard).'
  }
  return 'Facial hair: if input is smooth → stay clean-shaven (zero invented stubble). If beard/stubble visible → keep identical — never invent, never remove.'
}

function conciseIntensityWord(level) {
  if (level === 'strong') return 'strongly'
  if (level === 'moderate') return 'clearly'
  if (level === 'light') return 'noticeably'
  if (level === 'minimal') return 'subtly but visibly'
  return 'lightly'
}

/** 1–3 short lines derived from scan metrics (keeps concise prompt under ~1.2k chars). */
function buildConciseMetricsFocus(metricsRaw, profileRaw, mode = 'front') {
  const metrics = parseGlowUpMetrics(metricsRaw)
  if (!metrics) return ''
  const profile = parseFaceProfile(profileRaw)
  const composition = classifyFacialComposition(metrics, profile)
  const boost = compositionBoost(composition)
  const lines = []

  const waterLevel = intensityFloor(zoneIntensity(metrics.waterRetention, boost + 1), 'moderate')
  if (waterLevel !== 'skip') {
    const adv = conciseIntensityWord(waterLevel)
    lines.push(
      mode === 'side'
        ? `De-bloat ${adv}: reduce submental/chin pad and cheek puffiness (water retention ${metrics.waterRetention ?? '?'}/100).`
        : `De-bloat ${adv}: PRIMARY = defined leaner cheeks (buccal/mid-face); also under-eyes — water retention ${metrics.waterRetention ?? '?'}/100. Jaw/chin bones must stay identical; do not invent mandible.`,
    )
  }

  const skinLevel = intensityFloor(zoneIntensity(skinScore(metrics), boost), 'moderate')
  if (skinLevel !== 'skip') {
    lines.push(`Skin cleanup ${conciseIntensityWord(skinLevel)}: fewer blemishes/redness, smoother even tone — keep pores and texture.`)
  }

  const eyeLevel = intensityFloor(zoneIntensity(metrics.eyeArea, boost + 1), 'light')
  if (eyeLevel !== 'skip') {
    lines.push(`Eyes ${conciseIntensityWord(eyeLevel)}: less under-eye bags, more rested and open.`)
  }

  if (composition.type === 'lean') {
    lines.push('Face already lean — prioritize skin/eyes/brows; minimal jaw change.')
  }

  if (!lines.length) return ''
  return `\n\nPersonalized focus for this face:\n${lines.map((l) => `- ${l}`).join('\n')}`
}

/**
 * Short, actionable edit prompt for Nano Banana 2 (~500–900 chars).
 * Long hybrid prompts (~20k chars) cause the model to return nearly identical images.
 */
export function buildConciseGlowUpPrompt(mode = 'front', metricsRaw = null, faceProfileRaw = null) {
  const key = normalizeFutureSelfMode(mode)
  const profile = parseFaceProfile(faceProfileRaw)
  const facialHairMandatory = buildFacialHairMandatoryBlock(profile)
  const hairLine = buildConciseFacialHairLine(profile)
  const metricsFocus = buildConciseMetricsFocus(metricsRaw, faceProfileRaw, key)

  const dePuff = key === 'side'
    ? 'Side profile: defined leaner cheeks and submental/chin pad — same bone profile line, no invented or enlarged jaw/chin bones.'
    : 'Front: PRIMARY = clearly defined leaner cheeks (buccal/mid-face de-bloat) and fresher under-eyes — jaw/chin BONE silhouette pixel-identical to input.'

  return `${facialHairMandatory}

${GLOW_UP_ONLY_NO_INVENTION}

Retouch this portrait photo. Apply a clearly visible natural glow-up — same person, same pose, same grooming.

${JAW_BONE_INVENTION_BAN}

Edits (must be obvious in before/after):
- ${dePuff}
- Cheeks (TOP PRIORITY): reduce buccal puffiness until cheeks look more defined — soft tissue only; same cheekbone bone width/position.
- Cleaner skin — fewer blemishes, acne, and redness; smoother tone; keep real pores, freckles, moles, and texture.
- Fresher eyes — less under-eye puffiness; same eye shape and iris color.
- Eyebrows — same shape only; optional light cleanup of stray hairs; do NOT reshape or thicken.

Constraints: ${hairLine} NEVER add makeup, new facial hair, accessories, or bone changes. Keep lighting, colors, background, clothing, crop, and hair color identical.${metricsFocus}

If output adds beard/stubble, makeup, or new features → FAILED — revert to input grooming and retry glow-up only.
If nearly identical to input, push cheek de-bloat and skin cleanup harder while keeping bones and facial hair identical.`
}

/** Pick prompt strategy: concise (Nano Banana) or hybrid (legacy/GPT). */
export function buildGlowUpPrompt(mode = 'front', metricsRaw = null, faceProfileRaw = null, style = 'auto') {
  const resolved = String(style || process.env.FUTURE_SELF_GLOW_UP_PROMPT_STYLE || 'auto').trim().toLowerCase()
  if (resolved === 'hybrid') {
    return buildHybridGlowUpPrompt(mode, metricsRaw, faceProfileRaw)
  }
  if (resolved === 'concise') {
    return buildConciseGlowUpPrompt(mode, metricsRaw, faceProfileRaw)
  }
  // auto: concise for production (Nano Banana); hybrid available via env override
  return buildConciseGlowUpPrompt(mode, metricsRaw, faceProfileRaw)
}

export function glowUpPromptMeta(mode = 'front', metricsRaw = null, faceProfileRaw = null) {
  const metrics = parseGlowUpMetrics(metricsRaw)
  const profile = parseFaceProfile(faceProfileRaw)
  const composition = classifyFacialComposition(metrics || {}, profile || {})
  return {
    mode: normalizeFutureSelfMode(mode),
    adaptive: Boolean(metrics),
    metricsUsed: metrics ? Object.keys(metrics) : [],
    compositionType: metrics ? composition.type : null,
    compositionStrategy: metrics ? composition.strategy : null,
    gender: normalizeGender(profile),
    facialHair: profile?.facialHair ?? null,
    promptStyle: String(process.env.FUTURE_SELF_GLOW_UP_PROMPT_STYLE || 'concise').trim().toLowerCase(),
  }
}
