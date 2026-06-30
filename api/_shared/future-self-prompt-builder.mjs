import { deriveGlowUpVisionFlags } from './glow-up-vision-utils.mjs'
import { buildGlowUpStepPrompt } from './glow-up-steps.mjs'

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

/** Scalp / head hair must match input exactly — no restyle, recolor, or volume change. */
const HEAD_HAIR_PIXEL_LOCK = `[HEAD HAIR PIXEL LOCK — ABSOLUTE, NON-NEGOTIABLE]
All scalp hair, hairline, temples, crown, and visible hair strands above the forehead are a FROZEN layer — copy from input exactly.

MUST STAY IDENTICAL TO INPUT:
- Hair color, highlights, gray strands, and tone
- Hair length, cut, style, parting, direction, and texture (straight/wavy/curly/coily)
- Hairline shape, temple recession, baby hairs, and edge placement
- Volume, density, frizz level, and flyaways

FORBIDDEN:
- New haircut, restyle, blowout, slick-back, fade, trim, or "cleaner groomed" hair look
- Darker/lighter hair, color refresh, dye, bleached ends, or saturation shift
- Added volume, thickness, shine boost, or hair-product gloss
- Moving, lowering, or reshaping the hairline; filling in temples or thinning areas
- Erasing, shortening, or replacing visible hair with skin

RULE: Treat head hair like the background — pixel-copy from input. Glow-up edits ONLY facial skin and soft tissue BELOW the hairline (forehead skin may be cleaned; hair pixels may NOT be touched).`

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

ONLY ALLOWED EDITS (realistic, achievable on THIS face — soft tissue + skin only):
- Reduce facial puffiness / water retention (cheeks, mid-face, under-eyes, submental soft fat)
- Fade dark circles / periorbital hyperpigmentation (same eye shape — under-eye zone only)
- De-puff under-eye bags and periorbital swelling — clearly rested, open eyes
- Clear active acne, pimples, redness, blotchy patches — keep pores, freckles, moles, texture
- Even minor skin tone unevenness — SAME undertone and melanin (no whitening/darkening)
- Healthier lip hydration / natural lip color (same lip shape and size — no filler)
- Subtle teeth brightness if teeth visible (same tooth shape)
- Slightly fuller/healthier brows — grooming only (same shape, arch, position, color)
- Reduce facial redness / rosacea flare areas
- Leaner buccal cheeks and cleaner jaw-neck soft tissue line

ABSOLUTELY FORBIDDEN — automatic failure if any appear:
- Inventing beard, stubble, mustache, scruff, 5-o'clock shadow, or dark jaw fuzz where none exists
- Removing beard/stubble that IS in the input
- Adding makeup, eyeliner, mascara, lipstick, contour, blush, fake tan, or beauty-filter gloss
- Changing nose shape/size, lip shape/size, eye shape, iris color, or ear shape
- Adding accessories (glasses, piercings, hats) or removing existing ones
- Inventing new bone structure, sharper jaw, or new cheekbone edges
- Relighting, recoloring skin, changing background/clothing, or changing ANY hair (scalp or facial)
- Changing hairstyle, haircut, hair length, hair color, hairline, or hair volume
- Making the face look like a different person, face swap, or beauty-filter identity change
- Plastic/airbrushed skin, porcelain filter, or "different person" look
- Adding NEW freckles, moles, beauty marks, birthmarks, sun spots, or pigment dots not in the input
- Removing, fading, or relocating EXISTING freckles, moles, or permanent skin marks

Rule: output = same person, same face, same bone structure — dramatically fresher, leaner soft tissue, cleaner skin, rested eyes. Skin marks = copy from input exactly.`

const REALISTIC_ACHIEVABLE_FACE_EDITS = `[REALISTIC ACHIEVABLE EDITS — APPLY ALL RELEVANT TO THIS FACE]
Maximize visible glow-up through achievable soft-tissue + skin improvements (NOT bone surgery, NOT face swap):
1) Strong buccal/mid-face de-bloat + water retention drain
2) Under-eye bag de-puff + dark circle fade (same eye shape/iris)
3) Active blemish + redness cleanup; even minor tone patchiness (undertone frozen)
4) Healthier lip hydration/color if lips visible (shape unchanged)
5) Subtle teeth brightness if smile shows teeth
6) Brow grooming — fuller/healthier look, exact same shape
7) Fresher, less tired overall appearance — unmistakable before/after on THIS person`

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
- Scalp hair, hairline, temples, and all hair strands above the forehead: FROZEN — copy input pixels exactly; no restyle, trim, recolor, or volume change.
- You must NOT edit: hat, cap, beanie, hood, headband, ears, neck, shirt, jacket, background, walls, or any object/accessory.
- Treat hat, clothing, and background pixels as a frozen layer — copy them exactly from the input.

[ABSOLUTE COLOR LOCK — ZERO DRIFT]
- Every non-face pixel must keep the EXACT same RGB hue, saturation, and brightness as the input — especially hat/headwear, clothing, and background.
- Hat/cap/beanie: identical color, fabric texture, logos, folds, and shadows — no recolor, no desaturation, no warming/cooling.
- Clothing: identical color and fabric; no shirt/jacket/hoodie color shift.
- Head hair: PIXEL-IDENTICAL to input — same color, length, style, texture, volume, and hairline. No restyle, trim, recolor, or "groomed" hair makeover.
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

[EYEBROW LOCK — FULLER LOOK, SAME SHAPE]
- Eyebrows may appear slightly fuller, healthier, and less sparse (rested/groomed look) — but EXACT same brow shape, arch height, arch curve, length, position, and color as input.
- Allowed: cleaner groomed edges, remove stray hairs, natural density refresh — brows look fuller WITHOUT redrawn or lifted arches.
- FORBIDDEN: reshape arch, lift or lower brow, block brows, lamination effect, thicker redrawn brows, change brow color.
- Do NOT move brow bone position or skull ridge.

[EYE LOCK — SAME EYES, OPEN RESTED LOOK]
- Eyes: reduce periorbital/under-eye fat and puffiness; eyes look more open, rested, alert — natural hunter-eye READ from de-bloat ONLY on THIS face.
- Same iris color, same eye size, same eye shape, same eyelid crease — do NOT change eye geometry.
- Do NOT apply heavy eye makeup, false lashes, or change eyelid crease structure.
- Do NOT lift or reshape eyebrows to fake hunter eyes — periorbital soft tissue reduction only.`

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
- Changing head hair color, length, style, texture, volume, or hairline shape.
- Restyling, trimming, recoloring, or adding shine/volume to scalp hair.
- Changing the dark moody background/window.
- Global contrast, saturation, or white-balance shifts.
- Making skin look "radiant", "glowing", or studio-lit.
- Changing skin color, undertone, tan level, or skin type (oily/dry/matte/dewy character).
- Adding NEW freckles, moles, beauty marks, birthmarks, sun spots, or skin pigment not present in the input.
- Removing, fading, relocating, or inventing freckles, moles, or permanent skin marks.
- Airbrushing, blurring, or plasticizing skin texture.
- Masculinizing a female face (squarer jaw, wider mandible, heavier lower face) or feminizing a male face.
- Reshaping eyebrows — changing arch, lift, position, or drawing thicker block brows.
- Copying an external reference face, model jaw, or celebrity template — edit THIS input person only.
- Over-sharpening or angularizing cheekbones beyond this person's natural facial structure.
- Forcing harsh cheek hollows or generic model contours that do not match this specific face.
- Any "razor-sharp", surgical, or model-grade jaw sculpt — this is a realistic de-bloat edit only.`

const REALISTIC_GLOW_UP_RANGE = `[REALISTIC GLOW-UP CALIBRATION — FAT LOSS + FACIAL TRAINING]
This is a REAL-WORLD preview of 8–12 weeks: lower body fat, facial training (chewing/mewing), sleep, hydration, skincare. NOT surgery. NOT a reference face. NOT a different person.
The before/after MUST look clearly different — same person, visibly leaner soft-tissue face.

VISIBLE & REQUIRED (soft tissue + grooming only):
- Leaner cheeks and mid-face — buccal soft fat visibly reduced; defined cheek area through tissue loss.
- Rested, open eyes — periorbital de-bloat; same eye shape; hunter-eye read from de-bloat only.
- Eyebrows slightly fuller/healthier looking — same shape, arch, position.
- Cleaner skin — same skin color, undertone, melanin.

BONE-SAFE (soft tissue only):
- Jawline/chin/cheekbones: bones PIXEL-IDENTICAL — never new sharp/square jaw bone.
- Definition = volume removal on THIS face only — not a copied ideal.

Someone who knows this person should say: "You look leaner and fresher" — not "You got surgery" or "You look like someone else."`

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
Never invent facial hair. Never change head hair (color/style/length/hairline). Never reshape eyebrows. Hat, clothing, background, and lighting stay identical.`

const SOFT_TISSUE_PUSH = `[PRIMARY TARGETS — VISIBLE FACE-MATCHED GLOW-UP]
1. Water retention / puffiness — TOP priority. Reduce bloating until face reads CLEARLY fresher and leaner (bones unmoved).
2. Skin — strong retinol/vitamin-C clarity improvement; same undertone and skin type.
3. Eyes & under-eyes — clearly de-puff; open, rested look (iris unchanged).
4. Eyebrows — beautify ONLY; same shape, arch, thickness, position, color.
5. Cheeks / buccal — strong de-bloat; clearly leaner; cheekbones noticeably clearer in their natural shape.
6. Submental / jaw SOFT tissue — LIGHT de-puff only if needed; mandible and chin BONE outline FROZEN; never invent beard or bone.
Definition = visible cheek/mid-face refinement for THIS face. NOT jaw surgery. NOT bone reshaping. NOT invented mandible.`

const VISIBLE_GLOW_UP_TARGET = `[⚠️ VISIBILITY REQUIREMENT — MAXIMUM GLOW-UP, SAME PERSON]
This is NOT a subtle filter. The output must show a DRAMATIC, UNMISTAKABLE glow-up on THIS exact person:
- Face dramatically less puffy — cheeks and mid-face visibly deflated like 12–16 weeks fat loss.
- Under-eyes dramatically de-puffed — clearly open, rested, brighter eyes.
- Skin dramatically cleaner — active blemishes mostly gone; same undertone.
Same person, same identity, same bones, same facial hair, same head hair — NEVER a different face.
Before/after side-by-side must shock you with the difference. If cheeks/eyes/skin look nearly identical → FAILED: push 2× harder (bones still frozen; never face swap).`

const SAME_PERSON_AMPLIFY = `[SAME PERSON — AMPLIFY GLOW-UP, NEVER SWAP IDENTITY]
Maximize visible improvement on THIS input face only. More glow-up = more soft-tissue de-bloat + clearer skin + fresher eyes — NOT a new person.
Forbidden: face swap, different person, model face, porcelain beauty filter, altered nose/lips/eye shape, or "better looking stranger".
Required: unmistakable before/after on cheeks, under-eyes, and skin while every bone edge and identity feature matches the input.`

const SKIN_MARKS_PRESERVATION_LOCK = `[SKIN MARKS — NEVER ADD, NEVER REMOVE, NEVER MOVE]
Permanent skin marks are NOT blemishes — treat them as frozen identity pixels. NEVER invent moles (Muttermale), freckles, or pigment.

IF INPUT HAS freckles, moles, beauty marks, birthmarks, or sun spots:
- Copy them EXACTLY — same count, size, color, and position on forehead, cheeks, nose, chin, jaw, neck.
- Do NOT fade, blur, airbrush, or relocate them while cleaning skin.

IF INPUT HAS NO freckles/moles/markings:
- Output MUST have ZERO new moles, Muttermale, freckles, beauty marks, birthmarks, sun spots, or pigment dots.
- Do NOT add "realistic" freckles, sun spots, beauty marks, or moles for texture — absolutely forbidden.

Active blemishes ONLY (temporary — safe to fade): pimples, whiteheads, blackheads, inflamed acne redness, active cystic spots, flaky patches, uneven red blotches.
NOT blemishes (never touch): freckles, moles, Muttermale, beauty marks, birthmarks, existing sun spots, permanent pigment.`

const SKIN_REALISM_GUIDE = `[SKIN — CLARITY UP, COLOR FROZEN (PHOTOREALISTIC)]
Goal: clearly PURER, CLEANER, more even-looking skin — same person, SAME skin color/undertone/pigmentation.
YOU MUST visibly clean active blemishes on every glow-up:
- Fade/remove visible pimples, acne, papules, whiteheads, blackheads, inflamed redness, blotchy red patches, flaky patches.
- Forehead, cheeks, nose, chin, jaw must look clearly reiner than input — obvious before/after on skin clarity.
COLOR & PIGMENTATION (non-negotiable):
- EXACT same skin color, undertone, melanin, warmth, tan level as input — match neck/ears.
- NO lightening, darkening, warming, cooling, color grade, or makeup/foundation look.
KEEP: micro-pores, skin grain, ALL freckles/moles/beauty marks exact, fine lines, oily/dry skin character.
FORBIDDEN: color shift, porcelain/airbrush, adding/removing pigment marks, regenerating skin tone.
FAILED if skin color changed OR blemishes look unchanged OR new marks appear.`

function normalizeFutureSelfMode(raw) {
  const m = String(raw || 'front').trim().toLowerCase()
  if (m === 'side' || m === 'side_profile' || m === 'sideprofile') return 'side'
  return 'front'
}

const FRONT_TASK = `[TASK: MAXIMUM VISIBLE GLOW-UP — SAME PERSON ONLY]
Same person, same bones, same facial hair, same head hair. Apply a DRAMATICALLY VISIBLE glow-up: aggressively leaner cheeks (buccal de-bloat), strong water-retention drain, clearly cleaner/brighter skin (active blemishes strongly faded — moles frozen), much fresher open eyes — mandible/chin/cheekbone BONE geometry pixel-identical; never enlarged or invented. Before/after must look obviously different — but still unmistakably THIS person.`

const SIDE_TASK = `[TASK: SIDE-PROFILE STRONG GLOW-UP — SAME PERSON]
Side view: strongly reduce cheek/jaw/submental soft fat + water bloat — clearly leaner profile, cleaner jaw-neck line, brighter skin. Mandible/chin BONE curve and chin projection pixel-identical. Nose/lip/forehead profile unchanged. Same person — never a different face.`

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
    skin: ['skin', 'skinQuality', 'skinQuality30to90', 'skinScore'],
    hair: ['hair', 'hairScore'],
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
  const deBloatPriority = String(raw.deBloatPriority || raw.de_bloat_priority || '').trim().toLowerCase()
  if (deBloatPriority) out.deBloatPriority = deBloatPriority
  const skinCleanupPriority = String(raw.skinCleanupPriority || raw.skin_cleanup_priority || '').trim().toLowerCase()
  if (skinCleanupPriority) out.skinCleanupPriority = skinCleanupPriority
  const glowUpIntensity = String(raw.glowUpIntensity || raw.glow_up_intensity || '').trim().toLowerCase()
  if (glowUpIntensity) out.glowUpIntensity = glowUpIntensity
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
  const puffinessHigh = Number.isFinite(water) && water < 68
  const puffinessModerate = Number.isFinite(water) && water < 80
  const leanWater = Number.isFinite(water) && water >= 84
  const strongDef = Number.isFinite(faceDef) && faceDef >= 72
  const softMidface = Number.isFinite(metrics?.midfaceFullness) && metrics.midfaceFullness < 55
  const uniformlySoft = (Number.isFinite(jaw) && jaw < 58)
    || (Number.isFinite(chin) && chin < 58)
    || (Number.isFinite(faceDef) && faceDef < 58)
    || softMidface
  const heavyBloat = Number.isFinite(bloatSeverity) && bloatSeverity >= 42
    || (Number.isFinite(water) && water < 58)

  if (defLevel === 'lean' || (leanWater && strongDef && !heavyBloat)) {
    return {
      type: 'lean',
      strategy: 'definition_polish',
      label: 'already lean — definition polish only',
    }
  }

  if (heavyBloat || (uniformlySoft && (puffinessModerate || (Number.isFinite(bloatSeverity) && bloatSeverity >= 35)))) {
    return {
      type: 'adipose',
      strategy: 'structural_sculpt',
      label: 'heavy facial fat / soft-tissue fullness — maximum realistic leanness',
    }
  }

  const strongBone = boneAvg != null && boneAvg >= 58

  if (puffinessHigh || defLevel === 'bloated' || (Number.isFinite(bloatSeverity) && bloatSeverity >= 40)) {
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

/** Face already lean/defined/good-looking — polish glow-up, not heavy de-bloat. */
function isAlreadyDefinedFace(metrics, profile) {
  return resolveGlowUpPlan(metrics, profile, 'front').tier === 'defined'
}

const COMPACT_BONE_FREEZE = `⛔ BONE FREEZE (HIGHEST PRIORITY): mandible, chin bone, gonial angle, jaw width, chin tip, cheekbone position = PIXEL-IDENTICAL to input. FORBIDDEN: squarer/sharper/longer/wider jaw, new chin mass, shadow-sculpted jawline. Real glow-up NEVER changes bone — only removes soft tissue OVER the same bones.`

const INFRAORBITAL_DEBLOAT = `INFRAORBITAL / UNDER-EYE (PRIMARY DEFINITION ZONE): aggressively drain tear trough, under-eye bags, lower eyelid fluid retention, periorbital puffiness — visibly flatter, more rested infraorbital region; same eye shape/iris; no bone change.`

const COMPACT_IDENTITY_LOCK = `LOCKS: same identity/pose/lighting. Bones frozen. No invented jaw/chin/cheekbone. No added beard/stubble.`

const BONE_SOFT_TISSUE_LOCK = `mandible/chin/cheekbone bones pixel-identical to input — NEVER invent, enlarge, sharpen, square, or extend bone`

const ZERO_INVENTION_LOCK = `⚠️ ZERO INVENTION (automatic fail): Do NOT add ANYTHING not in the input photo — no new moles, Muttermale, freckles, beauty marks, birthmarks, sun spots, scars, stubble, beard, pores-as-spots, or skin pigment. If the input has NO moles/freckles → output must have NONE. Existing marks → copy exact count, size, color, position. Never invent "realistic" skin texture marks.`

const SKIN_TONE_CLARITY_LOCK = `[SKIN — CLEARER BUT SAME COLOR (MANDATORY)]
Make skin visibly PURER and CLEANER — NOT a different skin color.
WHAT TO DO: fade ALL active pimples, acne, whiteheads, blackheads, inflamed redness, blotchy red patches until skin reads clearly reiner/even.
COLOR LOCK: EXACT same skin color, undertone, melanin as input — match neck/ears. NO lightening, darkening, warming, cooling, or tan shift.
MARKS LOCK: ZERO new moles/Muttermale/freckles; if none in input → none in output; existing marks copied exactly.`

/**
 * Adaptive glow-up intensity from scan metrics — every face gets a visible, tier-matched edit.
 * @returns {{ tier: 'heavy'|'balanced'|'defined', deBloatPct: number, skinFocus: string, eyeFocus: string, tierLabel: string, composition: object, metrics: object|null, profile: object|null, extreme: boolean, headroom: number, isSide: boolean, weakZones: string[] }}
 */
export function resolveGlowUpPlan(metricsRaw, profileRaw, mode = 'front') {
  const metrics = parseGlowUpMetrics(metricsRaw)
  const profile = parseFaceProfile(profileRaw)
  const composition = classifyFacialComposition(metrics || {}, profile || {})
  const isSide = normalizeFutureSelfMode(mode) === 'side'

  const gentle = profile?.glowUpIntensity === 'gentle'
    || profile?.deBloatPriority === 'minimal'
    || profile?.deBloatPriority === 'low'
  const extreme = !gentle

  const overall = metrics?.overall ?? null
  const potential = metrics?.potential ?? overall
  const headroom = Number.isFinite(overall) && Number.isFinite(potential)
    ? Math.max(0, potential - overall)
    : 8
  const water = metrics?.waterRetention ?? null
  const def = metrics?.facialDefinition ?? null
  const bloat = metrics?.bloatSeverity ?? profile?.bloatSeverity
    ?? (Number.isFinite(water) ? 100 - water : null)
  const midface = metrics?.midfaceFullness ?? null
  const skin = skinScore(metrics)

  const needsHeavyDeBloat = composition.type === 'adipose'
    || (Number.isFinite(bloat) && bloat >= 38)
    || (Number.isFinite(water) && water < 58)
    || (Number.isFinite(def) && def < 48)
    || (Number.isFinite(overall) && overall < 52)
    || (Number.isFinite(midface) && midface < 45)
    || (Number.isFinite(metrics?.jawline) && metrics.jawline < 48)
    || (Number.isFinite(metrics?.chinNeck) && metrics.chinNeck < 48)
    || (composition.type === 'water_retention'
      && ((Number.isFinite(water) && water < 64) || (Number.isFinite(bloat) && bloat >= 36)))

  const isDefined = !needsHeavyDeBloat && (
    composition.type === 'lean'
    || (Number.isFinite(overall) && overall >= 72
      && (!Number.isFinite(water) || water >= 74)
      && (!Number.isFinite(def) || def >= 64))
  )

  const forceMax = !gentle && (
    profile?.deBloatPriority === 'maximum'
    || profile?.deBloatPriority === 'max'
    || profile?.glowUpIntensity === 'extreme'
  )

  let tier = 'balanced'
  if (needsHeavyDeBloat || forceMax) tier = 'heavy'
  else if (isDefined) tier = 'defined'

  let deBloatPct
  let fatPct
  let skinFocus
  let eyeFocus
  let tierLabel

  if (tier === 'heavy') {
    fatPct = 82 + Math.min(6, Math.floor(headroom / 2))
    if (extreme) fatPct = Math.min(90, fatPct + 4)
    deBloatPct = fatPct
    skinFocus = 'strong'
    eyeFocus = 'strong'
    tierLabel = 'heavy face — maximum realistic leanness (soft tissue only)'
  } else if (tier === 'defined') {
    fatPct = extreme ? 76 : 66
    deBloatPct = fatPct
    skinFocus = 'premium'
    eyeFocus = 'strong'
    tierLabel = 'already defined — strong soft-tissue refresh (bones frozen)'
  } else {
    fatPct = 74 + Math.min(10, Math.floor(headroom / 2))
    if (extreme) fatPct = Math.min(86, fatPct + 4)
    deBloatPct = fatPct
    skinFocus = 'strong'
    eyeFocus = 'strong'
    tierLabel = 'balanced — very strong fat + water reduction (soft tissue only)'
  }

  if (!metrics) {
    fatPct = extreme ? 84 : 72
    deBloatPct = fatPct
    tier = extreme ? 'heavy' : 'balanced'
    tierLabel = extreme
      ? 'no scan — assume puffy face needing aggressive soft-tissue reduction'
      : 'no scan — balanced soft-tissue reduction'
    skinFocus = 'strong'
    eyeFocus = 'strong'
  }

  const waterDrainPct = Math.min(98, fatPct + (extreme ? 32 : 26))

  const weakZones = []
  if (Number.isFinite(water) && water < 72) weakZones.push(`water-bloat ${water}/100`)
  if (Number.isFinite(skin) && skin < 72) weakZones.push(`skin ${skin}/100`)
  if (Number.isFinite(metrics?.jawline) && metrics.jawline < 68) weakZones.push(`jaw ${metrics.jawline}/100`)
  if (Number.isFinite(metrics?.chinNeck) && metrics.chinNeck < 68) weakZones.push(`submental ${metrics.chinNeck}/100`)
  if (Number.isFinite(def) && def < 62) weakZones.push(`soft definition ${def}/100`)
  if (Number.isFinite(metrics?.eyeArea) && metrics.eyeArea < 72) weakZones.push(`eyes ${metrics.eyeArea}/100`)

  return {
    tier,
    deBloatPct,
    fatPct: fatPct ?? deBloatPct,
    waterDrainPct,
    skinFocus,
    eyeFocus,
    tierLabel,
    composition,
    metrics,
    profile,
    extreme,
    headroom,
    isSide,
    weakZones,
  }
}

function skinLineForPlan(_plan) {
  return 'STRONGLY fade ALL active pimples/acne/blackheads/inflamed redness until skin reads clearly CLEANER/reiner — SAME color/undertone; ZERO new moles/Muttermale/freckles (none in input = none in output); copy existing marks exact; keep pores+grain — no airbrush'
}

function skinBlockForPlan(_plan) {
  return `${skinLineForPlan(_plan)}. Must be obvious in before/after on forehead, cheeks, nose, chin.`
}

function waterLineForPlan(plan) {
  const pct = plan.waterDrainPct ?? plan.deBloatPct
  return `drain ~${pct}% facial water retention — infraorbital/under-eye bags, tear trough, cheeks, mid-face, nasal-labial area MUST look clearly less puffy (soft fluid ONLY; ${BONE_SOFT_TISSUE_LOCK})`
}

function fatLineForPlan(plan) {
  const pct = plan.fatPct ?? plan.deBloatPct
  if (plan.tier === 'defined') {
    return `reduce buccal/mid-face SOFT fat ~${pct}% — leaner cheeks; infraorbital region flatter; ${BONE_SOFT_TISSUE_LOCK}`
  }
  if (plan.isSide) {
    return `cut buccal/mid-face/submental SOFT fat ~${pct}% — leaner profile; mandible/chin BONE curve unchanged (${BONE_SOFT_TISSUE_LOCK})`
  }
  return `reduce buccal + mid-face SOFT fat ~${pct}% — clearly leaner cheeks; same mandible/chin bone outline (${BONE_SOFT_TISSUE_LOCK})`
}

function deBloatLineForPlan(plan) {
  return fatLineForPlan(plan)
}

function eyeLineForPlan(_plan) {
  return 'MAXIMUM infraorbital/under-eye de-puff — tear trough + lower eyelid bags clearly reduced; brighter, more open, rested eyes; same eye shape/iris'
}

function buildVisionMarksLine(marks) {
  if (!marks || typeof marks !== 'object') return null
  const parts = []
  if (marks.hasFreckles) parts.push('freckles present — copy exact count/position')
  else parts.push('NO freckles visible — output must have NONE')
  if (marks.hasMoles) {
    const n = Number.isFinite(marks.moleCount) && marks.moleCount > 0 ? marks.moleCount : 'visible'
    parts.push(`${n} mole(s) visible — copy exact size/color/position`)
  } else {
    parts.push('NO moles visible — never invent Muttermale')
  }
  if (marks.markNotes) parts.push(marks.markNotes)
  return parts.join('; ')
}

function unwrapVisionAnalysis(visionRaw) {
  if (!visionRaw || typeof visionRaw !== 'object') return null
  return visionRaw.analysis ?? visionRaw
}

function buildVisionFaceHeader(vision, mode) {
  if (!vision) return ''
  const lines = ['THIS FACE FROM PHOTO (edit ONLY what is described — bones frozen):']

  if (vision.skinTexture || vision.skinUndertone) {
    const parts = []
    if (vision.skinTexture) parts.push(vision.skinTexture)
    if (vision.skinUndertone && vision.skinUndertone !== 'unknown') {
      parts.push(`${vision.skinUndertone} undertone`)
    }
    lines.push(`- Skin: ${parts.join('; ')}`)
  }

  const marksLine = buildVisionMarksLine(vision.skinMarks)
  if (marksLine) lines.push(`- Marks: ${marksLine}`)

  if (vision.blemishAreas?.length) {
    lines.push(`- Blemishes to fade: ${vision.blemishAreas.join(', ')}`)
  }

  const puff = [
    vision.faceFullness && vision.faceFullness !== 'unknown' ? vision.faceFullness : null,
    ...(vision.puffinessAreas || []),
  ].filter(Boolean)
  if (puff.length) lines.push(`- Puffiness: ${puff.join(', ')}`)

  if (vision.browShape) {
    const brow = [vision.browShape, vision.browThickness !== 'unknown' ? vision.browThickness : null]
      .filter(Boolean)
      .join(', ')
    lines.push(`- Brows: ${brow}`)
  }

  if (vision.hairStructure) lines.push(`- Head hair (FROZEN — copy exactly, do NOT restyle/recolor): ${vision.hairStructure}`)
  if (vision.facialHairState && vision.facialHairState !== 'unknown') {
    lines.push(`- Facial hair: ${vision.facialHairState}`)
  }
  if (vision.lightingNotes) lines.push(`- Lighting: ${vision.lightingNotes} — preserve`)
  if (vision.symmetryNotes) lines.push(`- Symmetry: ${vision.symmetryNotes}`)

  if (vision.personalizedEditPrompt) {
    lines.push(`- Personalized edit: ${vision.personalizedEditPrompt}`)
  }
  if (vision.imagePreviewChanges?.length) {
    lines.push(`- Preview targets: ${vision.imagePreviewChanges.join('; ')}`)
  }
  if (vision.waterRetentionLevel && vision.waterRetentionLevel !== 'unknown') {
    lines.push(`- Water retention: ${vision.waterRetentionLevel}`)
  }
  if (vision.buccalFatLevel && vision.buccalFatLevel !== 'unknown') {
    lines.push(`- Buccal soft fat: ${vision.buccalFatLevel}`)
  }
  if (vision.jawDefinitionFocus) {
    lines.push(`- Jaw definition: ${vision.jawDefinitionFocus}`)
  }

  if (vision.priorityZones?.length) {
    lines.push(`- Priority zones: ${vision.priorityZones.join(', ')}`)
  }
  if (vision.personalizedKeywords?.length) {
    lines.push(`- Keywords: ${vision.personalizedKeywords.join('; ')}`)
  }

  return `\n\n${lines.join('\n')}`
}

function buildVisionWaterLine(plan, vision) {
  const { waterPct, needsDeBloat } = resolveRealisticDeBloatPct(plan, vision)
  const zones = vision.puffinessAreas?.length
    ? vision.puffinessAreas.join(', ')
    : 'cheeks, mid-face, under-eyes'
  return buildRealisticVisionWaterLine(waterPct, zones, vision.waterDrainFocus, needsDeBloat)
    + ` (${BONE_SOFT_TISSUE_LOCK})`
}

function buildVisionFatLine(plan, vision) {
  const { fatPct, needsDeBloat } = resolveRealisticDeBloatPct(plan, vision)
  const zones = vision.puffinessAreas?.length
    ? vision.puffinessAreas.filter((z) => !/under-eye|eye/i.test(z)).join(', ') || 'buccal cheeks, jaw soft tissue'
    : (plan.isSide ? 'cheek/jaw/submental' : 'buccal cheeks, mid-face')
  return buildRealisticVisionFatLine(fatPct, zones, vision.fatReductionFocus, plan.isSide, needsDeBloat, vision)
    + `; ${BONE_SOFT_TISSUE_LOCK}`
}

function buildVisionSkinLine(plan, vision) {
  return buildRealisticVisionSkinLine(vision, plan)
}

function buildVisionEyeLine(vision) {
  return vision.eyeFocus || eyeLineForPlan(null)
}

function buildVisionBrowLine(plan, vision) {
  if (vision.browFocus) {
    return `\n5) BROWS: ${vision.browFocus} — same shape/arch/color.`
  }
  if (plan.tier === 'defined' || plan.skinFocus === 'premium') {
    const shape = vision.browShape ? ` (${vision.browShape})` : ''
    return `\n5) BROWS: beautify only${shape} — cleaner edges; same shape/arch/color.`
  }
  return ''
}

function buildCompactTierHint(plan) {
  const water = plan.waterDrainPct ?? plan.deBloatPct
  const fat = plan.fatPct ?? plan.deBloatPct
  return `\nTier ${plan.tier}; water ~${water}%; fat ~${fat}% (soft tissue only).`
}

const VISION_COMPACT_ZERO = `ZERO INVENTION (automatic fail): never add moles, Muttermale, freckles, beauty marks, birthmarks, sun spots, stubble, or beard. Bones frozen; same identity/pose/lighting.`

function buildCompactVisionMarksLock(vision) {
  const marks = vision?.skinMarks
  const hasMoles = Boolean(marks?.hasMoles) && (marks?.moleCount ?? 0) > 0
  const hasFreckles = Boolean(marks?.hasFreckles)

  if (hasMoles) {
    const n = marks.moleCount || 'visible'
    return `MARKS LOCK: input has ${n} mole(s)/Muttermale — copy EXACT count, size, color, position. Never add, remove, fade, or move while cleaning skin.`
  }
  if (hasFreckles) {
    return `MARKS LOCK: input has freckles only — copy EXACT freckle positions. ZERO new moles/Muttermale/beauty marks allowed.`
  }
  return `MARKS LOCK (CRITICAL): input has ZERO moles/Muttermale/freckles/beauty marks → output MUST stay at ZERO. Fade pimples/acne ONLY — do NOT add brown/dark pigment spots for "realism". Any new mark = FAIL.`
}

function buildCompactVisionFaceSummary(vision) {
  const parts = []
  const marksLock = buildVisionMarksLine(vision.skinMarks)
  if (marksLock) parts.push(`marks: ${marksLock}`)
  if (vision.realisticGoal) parts.push(`goal: ${truncatePromptText(vision.realisticGoal, 100)}`)
  if (vision.faceFullness && vision.faceFullness !== 'unknown') parts.push(`fullness: ${vision.faceFullness}`)
  if (vision.waterRetentionLevel && vision.waterRetentionLevel !== 'unknown') {
    parts.push(`water: ${vision.waterRetentionLevel}`)
  }
  if (vision.buccalFatLevel && vision.buccalFatLevel !== 'unknown') {
    parts.push(`buccal fat: ${vision.buccalFatLevel}`)
  }
  if (vision.jawDefinitionState && vision.jawDefinitionState !== 'unknown') {
    parts.push(`jaw: ${vision.jawDefinitionState}`)
  }
  if (vision.blemishAreas?.length) parts.push(`blemishes: ${vision.blemishAreas.join(', ')}`)
  if (vision.skinTexture) parts.push(truncatePromptText(vision.skinTexture, 60))
  if (vision.puffinessAreas?.length) parts.push(`puff: ${vision.puffinessAreas.join(', ')}`)
  return parts.join(' | ')
}

function truncatePromptText(text, max = 160) {
  const s = String(text ?? '').trim()
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

function ensureVisionMarkAvoid(vision) {
  const avoid = [...(vision?.unrealisticAvoid || [])]
  const hasMoles = Boolean(vision?.skinMarks?.hasMoles) && (vision?.skinMarks?.moleCount ?? 0) > 0
  if (!hasMoles && !avoid.some((a) => /mole|muttermal|beauty mark|pigment spot/i.test(String(a)))) {
    avoid.unshift('add moles/Muttermale/beauty marks/pigment spots not in input')
  }
  if (!avoid.some((a) => /jaw|mandible|bone|chin bone/i.test(String(a)))) {
    avoid.unshift('invent/sharpen/extend jaw or chin bone')
  }
  return avoid.slice(0, 5)
}

const REALISTIC_FULLNESS_CAPS = {
  lean: { water: 94, fat: 80 },
  average: { water: 98, fat: 88 },
  puffy: { water: 98, fat: 90 },
  moon_face: { water: 98, fat: 92 },
}

/** Minimum de-bloat floors — visible fat-loss look (soft tissue only). */
const DEBLOAT_FLOOR = { water: 86, fat: 72 }
const DEBLOAT_FLOOR_EXTREME = { water: 92, fat: 78 }

function profileForcesAggressiveDeBloat(plan) {
  const p = plan?.profile
  if (!p) return Boolean(plan?.extreme) || plan?.tier === 'heavy'
  const prio = String(p.deBloatPriority || p.de_bloat_priority || '').toLowerCase()
  const intensity = String(p.glowUpIntensity || p.glow_up_intensity || '').toLowerCase()
  return prio === 'maximum' || prio === 'max'
    || intensity === 'extreme'
    || Boolean(plan?.extreme)
    || plan?.tier === 'heavy'
}

function metricsIndicateDeBloat(metrics) {
  if (!metrics) return false
  return (Number.isFinite(metrics.waterRetention) && metrics.waterRetention < 78)
    || (Number.isFinite(metrics.bloatSeverity) && metrics.bloatSeverity >= 28)
    || (Number.isFinite(metrics.facialDefinition) && metrics.facialDefinition < 68)
    || (Number.isFinite(metrics.jawline) && metrics.jawline < 70)
    || (Number.isFinite(metrics.midfaceFullness) && metrics.midfaceFullness < 52)
    || (Number.isFinite(metrics.chinNeck) && metrics.chinNeck < 70)
}

/** Reorder vision zones — buccal cheeks/mid-face MUST come before under-eye/jaw. */
function cheekFirstPriorityZones(zones) {
  const list = [...(zones || [])]
  const isCheek = (z) => /buccal|cheek|mid-face|midface|wang/i.test(String(z))
  const isJawBone = (z) => /jaw bone|mandible sculpt|chin bone|gonial/i.test(String(z))
  const cheeks = list.filter(isCheek)
  const rest = list.filter((z) => !isCheek(z) && !isJawBone(z))
  const defaults = ['buccal cheeks', 'mid-face', 'cheek fat pads', 'cheek water retention']
  for (const d of defaults) {
    if (!cheeks.some((c) => String(c).toLowerCase().includes(d.split(' ')[0]))) {
      cheeks.push(d)
    }
  }
  return [...cheeks.slice(0, 4), ...rest.slice(0, 3)].slice(0, 6)
}

/** Merge face-scan metrics into vision when Claude underestimates puffiness. */
function enrichVisionFromMetrics(vision, plan) {
  const base = vision || {}
  const metrics = plan?.metrics

  const puff = [...(base.puffinessAreas || [])]
  const defaultZones = ['buccal cheeks', 'mid-face', 'cheek fat pads', 'infraorbital region', 'under-eye bags', 'submental']
  for (const z of defaultZones) {
    if (!puff.some((p) => p.toLowerCase().includes(z.split(' ')[0]))) puff.push(z)
  }

  const water = metrics?.waterRetention
  let waterLevel = base.waterRetentionLevel
  if (!waterLevel || waterLevel === 'unknown' || waterLevel === 'none') {
    if (Number.isFinite(water) && water < 48) waterLevel = 'heavy'
    else if (Number.isFinite(water) && water < 62) waterLevel = 'moderate'
    else waterLevel = 'moderate'
  }

  let buccalLevel = base.buccalFatLevel
  if (!buccalLevel || buccalLevel === 'unknown' || buccalLevel === 'lean') {
    buccalLevel = (Number.isFinite(water) && water < 55) || plan?.tier === 'heavy'
      ? 'full'
      : 'moderate'
  }

  const visionWater = base.waterDrainRealisticPct ?? 0
  const visionFat = base.fatReductionRealisticPct ?? 0
  const metricWater = Number.isFinite(water)
    ? (water < 45 ? 98 : water < 58 ? 94 : water < 68 ? 90 : 86)
    : 92
  const metricFat = Number.isFinite(water)
    ? (water < 45 ? 88 : water < 58 ? 84 : water < 68 ? 80 : 76)
    : 82

  let faceFullness = base.faceFullness || 'average'
  if (faceFullness === 'lean' || faceFullness === 'unknown') faceFullness = 'average'

  return {
    ...base,
    skinMarks: { ...(base.skinMarks || {}) },
    puffinessAreas: puff.slice(0, 8),
    waterRetentionLevel: waterLevel,
    buccalFatLevel: buccalLevel,
    faceFullness,
    jawDefinitionState: base.jawDefinitionState === 'sharp' ? base.jawDefinitionState : 'soft',
    waterDrainRealisticPct: Math.max(visionWater, metricWater, plan?.waterDrainPct ?? 0),
    fatReductionRealisticPct: Math.max(visionFat, metricFat, plan?.fatPct ?? plan?.deBloatPct ?? 0),
    jawDefinitionFocus: base.jawDefinitionFocus
      || 'Do NOT sculpt jaw bone — slim buccal cheek soft tissue only; mandible edge traces input exactly',
    eyeFocus: base.eyeFocus
      || 'Reduce under-eye fat and periorbital water on THIS face — eyes more open/rested; hunter-eye read from de-bloat only; same iris/shape; do NOT reshape brows',
    browFocus: base.browFocus
      || 'Brows slightly fuller/healthier/groomed — EXACT same shape, arch, position, and color; no lift or redraw',
    fatReductionFocus: base.fatReductionFocus
      || 'Reduce buccal cheek and mid-face soft fat — leaner face like 8–12 weeks fat loss + facial training; same bones',
    waterDrainFocus: base.waterDrainFocus
      || 'Drain cheek and mid-face water retention — visibly leaner soft tissue on THIS face only',
    priorityZones: cheekFirstPriorityZones(base.priorityZones),
  }
}

function visionNeedsDeBloat(vision, plan = null) {
  if (plan && (profileForcesAggressiveDeBloat(plan) || metricsIndicateDeBloat(plan.metrics))) {
    return true
  }
  return deriveGlowUpVisionFlags(vision).needsDeBloat
}

/** When puffiness is visible OR profile/metrics demand it: take HIGHER of plan vs vision. */
function resolveRealisticDeBloatPct(plan, vision) {
  const enriched = enrichVisionFromMetrics(vision, plan)
  const fullness = String(enriched?.faceFullness || 'unknown').toLowerCase()
  const waterLevel = String(enriched?.waterRetentionLevel || 'unknown').toLowerCase()
  const caps = REALISTIC_FULLNESS_CAPS[fullness] || { water: 94, fat: 80 }
  const needsDeBloat = true
  const puffCount = enriched?.puffinessAreas?.length ?? 0

  let waterPct = plan.waterDrainPct ?? plan.deBloatPct
  let fatPct = plan.fatPct ?? plan.deBloatPct

  const visionWater = enriched?.waterDrainRealisticPct
  const visionFat = enriched?.fatReductionRealisticPct

  if (Number.isFinite(visionWater)) waterPct = Math.max(waterPct, visionWater)
  if (Number.isFinite(visionFat)) fatPct = Math.max(fatPct, visionFat)

  const floor = plan.extreme ? DEBLOAT_FLOOR_EXTREME : DEBLOAT_FLOOR
  waterPct = Math.max(waterPct, floor.water)
  fatPct = Math.max(fatPct, floor.fat)

  if (fullness === 'moon_face' || waterLevel === 'heavy' || puffCount >= 3) {
    waterPct = Math.max(waterPct, plan.extreme ? 98 : 94)
    fatPct = Math.max(fatPct, plan.extreme ? 90 : 84)
  } else if (fullness === 'puffy' || waterLevel === 'moderate' || puffCount >= 2) {
    waterPct = Math.max(waterPct, plan.extreme ? 96 : 92)
    fatPct = Math.max(fatPct, plan.extreme ? 86 : 80)
  } else if (fullness === 'average' || waterLevel === 'mild' || puffCount >= 1) {
    waterPct = Math.max(waterPct, plan.extreme ? 94 : 90)
    fatPct = Math.max(fatPct, plan.extreme ? 82 : 76)
  } else if (plan.extreme) {
    waterPct = Math.max(waterPct, 90)
    fatPct = Math.max(fatPct, 74)
  }

  if (plan.extreme) {
    waterPct = Math.min(caps.water, waterPct + 6)
    fatPct = Math.min(caps.fat, fatPct + 5)
  }

  waterPct = Math.min(caps.water, waterPct)
  fatPct = Math.min(caps.fat, fatPct)

  return { waterPct, fatPct, needsDeBloat, enrichedVision: enriched }
}

function buildRealisticVisionWaterLine(waterPct, zones, visionFocus, strong = true) {
  const core = strong
    ? `AGGRESSIVELY drain ~${waterPct}% water retention — infraorbital/under-eye bags, tear trough, ${zones}, cheeks, mid-face MUST look visibly DEFLATED vs input (soft tissue ONLY; mandible/chin/cheekbone bones UNCHANGED)`
    : `Drain ~${waterPct}% fluid from infraorbital region, under-eyes, ${zones} — less puffy (soft tissue only; bones frozen)`
  if (!visionFocus) return core
  return `${core}. ${truncatePromptText(visionFocus, 90)}`
}

function buildRealisticVisionFatLine(fatPct, zones, visionFocus, isSide, strong = true, vision = null) {
  const zoneLabel = isSide ? 'buccal/mid-face/submental' : zones
  const softTissueHint = vision?.eyeFocus
    ? truncatePromptText(vision.eyeFocus, 90)
    : 'Max infraorbital de-puff + buccal/mid-face soft fat reduction — mandible/chin bone overlay identical to input'
  const core = strong
    ? `AGGRESSIVELY reduce ~${fatPct}% buccal/mid-face SOFT facial fat in ${zoneLabel} — cheeks clearly SLIMMER; infraorbital region flatter; NO bone change`
    : `Reduce ~${fatPct}% buccal/mid-face SOFT fat in ${zoneLabel} — subtly leaner`
  return `${core}. ${softTissueHint}${visionFocus ? `. ${truncatePromptText(visionFocus, 90)}` : ''}`
}

function buildRealisticVisionSkinLine(vision, _plan) {
  const hasMoles = Boolean(vision?.skinMarks?.hasMoles) && (vision?.skinMarks?.moleCount ?? 0) > 0
  const blemishZones = vision.blemishAreas?.length
    ? vision.blemishAreas.join(', ')
    : 'visible breakout zones'
  const focus = vision.skinImprovementFocus
    || vision.skinCleanupFocus
    || `STRONGLY fade ALL active pimples/acne/blackheads/redness in ${blemishZones} until skin reads clearly cleaner at selfie distance`
  const undertone = vision.skinUndertone && vision.skinUndertone !== 'unknown'
    ? ` Keep ${vision.skinUndertone} undertone exact.`
    : ' Same skin color/undertone.'
  const noNewMarks = hasMoles
    ? ' Existing moles/Muttermale unchanged — never add new ones.'
    : ' ZERO moles/Muttermale in input — copy input skin pigment exactly; fade pimple REDNESS only; NEVER add brown/dark spots or "realistic" freckles/moles.'
  return `${focus}.${undertone}${noNewMarks} Keep pores+grain — no porcelain/airbrush/repaint.`
}

/** Ultra-short user prompt — visual targets, not percentages. */
export function buildShortDeBloatUserPrompt(mode, metricsRaw, faceProfileRaw, visionRaw = null) {
  const plan = resolveGlowUpPlan(metricsRaw, faceProfileRaw, mode)
  const vision = unwrapVisionAnalysis(visionRaw)
  const merged = enrichVisionFromMetrics(vision, plan)
  const view = plan.isSide ? 'Side profile' : 'Front'
  const { hasInputMoles } = deriveGlowUpVisionFlags(merged)
  const marksNote = hasInputMoles
    ? 'Keep existing moles exactly.'
    : 'No new moles — fade chin acne/redness only.'

  return `${view} — PERSONALIZED GLOW-UP (THIS FACE ONLY — NO REFERENCE TEMPLATE). Same person/pose/lighting.
⛔ HEAD HAIR FROZEN: copy exact same hair color, length, style, texture, volume, and hairline from input — zero hair changes.
⛔ SAME PERSON: amplify glow-up on THIS face — never face swap or different person.
⛔ NO external reference face. Edit ONLY this input person. Bones frozen (mandible/chin/cheekbone width unchanged).

Simulate 12–16 weeks fat loss + skincare + facial training on THIS face — STRONG visible before/after:

#1 LEANER CHEEKS + MID-FACE (most visible):
• Aggressively reduce buccal/mid-face soft fat — noticeably thinner face, defined cheek area
• Cheekbones much clearer through tissue loss — same bone position

#2 RESTED OPEN EYES (same eye shape):
• Strongly flatten under-eye bags/fat — eyes look clearly more open; hunter-eye from de-bloat ONLY
• Same iris, same eye size — brows may look slightly fuller/healthier, same shape

#3 CLEANER BRIGHTER SKIN — EXACT same skin color/undertone; strongly fade acne/redness/blackheads.
${marksNote} Keep pores+grain. Realistic — not surgery, not a new face.`
}

/**
 * Ein Fal-Lauf mit gleicher Absicht wie die 3-Step-Pipeline (midface → undereye → skin).
 * Kombiniert Kurz-Prompt + Vision-Zonen + De-Bloat-/Skin-Targets — kompakt für Nano Banana.
 */
export function buildUnifiedGlowUpUserPrompt(mode, metricsRaw, faceProfileRaw, visionRaw = null) {
  const plan = resolveGlowUpPlan(metricsRaw, faceProfileRaw, mode)
  const vision = unwrapVisionAnalysis(visionRaw)
  const merged = enrichVisionFromMetrics(vision, plan)
  const parts = []

  parts.push('⚠️ MANDATORY: MAXIMUM VISIBLE GLOW-UP on THIS face. Cheeks dramatically slimmer. Under-eyes deflated. Skin much cleaner. Same person — if before≈after on cheeks → FAILED.')
  parts.push('⛔ HEAD HAIR LOCK: scalp hair, hairline, and temples = pixel-copy from input. No restyle, trim, recolor, length change, or volume change.')
  parts.push('⛔ SAME PERSON LOCK: dramatically more glow-up on THIS face — never face swap, never a different person.')

  if (plan.tier === 'heavy') {
    parts.push('Intensity: MAXIMUM — dramatically leaner cheeks, strongly deflated under-eyes, much cleaner skin; mandible/chin bones pixel-identical; same person.')
  } else if (plan.tier === 'defined') {
    parts.push('Intensity: VERY STRONG — visible de-puff + skin clarity + rested eyes; clear before/after; bones frozen; same person.')
  } else {
    parts.push('Intensity: MAXIMUM — cheeks, under-eyes, and skin must ALL improve dramatically in this single edit; same person.')
  }

  const lead = buildGlowUpDeBloatPromptLead(mode, metricsRaw, faceProfileRaw, visionRaw)
  if (lead) parts.push(lead.trim())

  parts.push(buildShortDeBloatUserPrompt(mode, metricsRaw, faceProfileRaw, visionRaw))

  if (merged) {
    const { waterPct, fatPct, needsDeBloat } = resolveRealisticDeBloatPct(plan, merged)
    if (needsDeBloat) {
      const zones = merged.puffinessAreas?.slice(0, 4).join(', ')
        || merged.priorityZones?.slice(0, 4).join(', ')
        || 'buccal cheeks, mid-face, under-eyes'
      parts.push(
        `ALL-IN-ONE de-bloat (${zones}): drain ~${waterPct}% fluid + reduce ~${fatPct}% buccal/mid-face soft fat AND under-eye puffiness in this single edit — do not skip cheeks or eyes.`,
      )
    }
    const skinLine = buildRealisticVisionSkinLine(merged, plan)
    if (skinLine) parts.push(`Skin pass (same edit): ${skinLine}`)
    if (merged.personalizedEditPrompt) {
      parts.push(`Personalized: ${truncatePromptText(merged.personalizedEditPrompt, 220)}`)
    }
    if (merged.priorityZones?.length) {
      parts.push(`Apply in order: ${merged.priorityZones.slice(0, 5).join(' → ')} — all zones in ONE output.`)
    }
  }

  const unified = parts.filter(Boolean).join('\n\n')
  if (unified.length > 2800) {
    return `${unified.slice(0, 2780).trim()}…`
  }
  return unified
}

/** Pass 2 — cheek/mid-face ONLY (input often already has jaw/under-eye definition). */
export function buildSecondPassDeBloatUserPrompt(mode = 'front') {
  const view = String(mode).toLowerCase().includes('side') ? 'Side profile' : 'Front'
  return `${view} — CHEEK-ONLY de-bloat pass. THIS input may already have sharper jaw/under-eye.
⛔ BONE LOCK: cheekbone width + mandible width same as THIS input.

BUCCAL CHEEKS + MID-FACE still too round — fix THIS (80% of edit here):
• Buccal cheeks significantly SLIMMER vs this input — less cheek fullness, deeper cheek hollow
• Mid-face less wide/puffy — narrower soft-tissue cheek area
• Do NOT only edit jaw/chin/submental — WANGEN must change most

Leave under-eye/jaw as-is if already defined. Head hair frozen (same color/style/length/hairline). Same pose/lighting. No new moles.
FAILED if buccal cheeks still look equally round/full as this input.`
}

/** Retry when cheeks still puffy after pass 2. */
export function buildCheekFocusRetryUserPrompt(mode = 'front') {
  return `${buildSecondPassDeBloatUserPrompt(mode)}

RETRY — buccal cheeks STILL too round. Maximum cheek/mid-face slimming NOW — cheeks must look dramatically narrower than this input. Do NOT touch jaw bone.`
}

/** Stronger retry prompt when QA detects near-identical puffiness. */
export function buildDeBloatRetryUserPrompt(mode, metricsRaw, faceProfileRaw, visionRaw = null) {
  const base = buildShortDeBloatUserPrompt(mode, metricsRaw, faceProfileRaw, visionRaw)
  return `${base}

RETRY — last edit only defined jaw/under-eye but buccal cheeks still round. This attempt: buccal cheeks + mid-face MUST look dramatically slimmer — bones frozen.`
}

/** De-bloat percentages + enriched vision for Fal system_prompt extras. */
export function getGlowUpDeBloatTargets(mode, metricsRaw, faceProfileRaw, visionRaw = null) {
  const plan = resolveGlowUpPlan(metricsRaw, faceProfileRaw, mode)
  const vision = unwrapVisionAnalysis(visionRaw)
  const { waterPct, fatPct, needsDeBloat, enrichedVision } = resolveRealisticDeBloatPct(plan, vision)
  return { waterPct, fatPct, needsDeBloat, plan, vision: enrichedVision }
}

/** ~700–1200 chars — deprecated; use buildShortDeBloatUserPrompt for Nano Banana. */
function buildCompactVisionConcisePrompt(mode, metricsRaw, faceProfileRaw, vision) {
  return buildShortDeBloatUserPrompt(mode, metricsRaw, faceProfileRaw, vision)
}

/** Short lead injected into Fal user prompt so the image model prioritizes de-bloat. */
export function buildGlowUpDeBloatPromptLead(mode, metricsRaw, faceProfileRaw, visionRaw = null) {
  const plan = resolveGlowUpPlan(metricsRaw, faceProfileRaw, mode)
  const vision = unwrapVisionAnalysis(visionRaw)
  const { waterPct, fatPct, needsDeBloat } = resolveRealisticDeBloatPct(plan, vision)
  if (!needsDeBloat) return ''
  const merged = enrichVisionFromMetrics(vision, plan)
  const zones = merged?.puffinessAreas?.slice(0, 5).join(', ') || 'infraorbital, under-eye bags, cheeks, mid-face'
  return `MANDATORY FIRST: ${COMPACT_BONE_FREEZE} Drain ~${waterPct}% water + reduce ~${fatPct}% buccal/mid-face soft fat in ${zones} — cheeks and under-eyes MUST look dramatically less puffy vs input (same mandible/chin bones; same person). Then strong skin cleanup — zero new moles. Before/after must be obvious. `
}

/** Step 2 — inject Claude Vision observations into the concise template. */
export function buildVisionPersonalizationBlock(visionRaw, plan, mode = 'front') {
  const vision = unwrapVisionAnalysis(visionRaw)
  if (!vision) return ''
  return buildVisionFaceHeader(vision, mode)
}

function buildAdaptiveConcisePrompt(mode, metricsRaw, faceProfileRaw, visionRaw = null, options = {}) {
  if (options.glowUpStep) {
    return buildGlowUpStepPrompt(
      options.glowUpStep,
      mode,
      metricsRaw,
      faceProfileRaw,
      visionRaw,
      options.stepIndex ?? 1,
      options.stepTotal ?? 3,
    )
  }
  if (options.deBloatRetry && options.secondPass) {
    return buildCheekFocusRetryUserPrompt(mode)
  }
  if (options.secondPass) {
    return buildSecondPassDeBloatUserPrompt(mode)
  }
  if (options.deBloatRetry) {
    return buildDeBloatRetryUserPrompt(mode, metricsRaw, faceProfileRaw, visionRaw)
  }
  return buildUnifiedGlowUpUserPrompt(mode, metricsRaw, faceProfileRaw, visionRaw)
}

const ALREADY_LEAN_POLISH_GUIDE = `[ALREADY LEAN / DEFINED — STILL VISIBLE GLOW-UP REQUIRED]
This person already has a lean, defined face — NOT fat, NOT bloated. Subtle or skip edits = FAILED.
Do NOT skip the glow-up. Deliver a clear before/after through PREMIUM POLISH, not heavy de-bloat:

PRIORITY (all mandatory, clearly visible):
1) SKIN POLISH — retinol + vitamin-C level: smoother, more even, healthier-looking skin; fade active blemishes; keep ALL freckles/moles exact; NEVER add new skin marks; keep pores, grain, undertone.
2) EYES — brighter, rested, more open; reduce under-eye bags/tired look; same eye shape and iris.
3) EYEBROWS — beautify only: cleaner edges, stray hairs removed; same shape, arch, thickness, color.
4) DEFINITION REFRESH (~55–68% fluid + strong de-puff) — dramatically fresher, leaner mid-face; NO hollow cheeks, NO jaw sculpt, bones frozen.

The viewer must notice: dramatically fresher skin, rested open eyes, groomed brows, leaner mid-face — same person, premium softmaxxing glow-up.`

function compositionBoost(composition) {
  if (composition.type === 'water_retention') return 6
  if (composition.type === 'adipose') return 6
  if (composition.type === 'mixed') return 5
  return 3
}

/** Mandatory de-bloat block for puffy / heavier faces (works with or without scan metrics). */
function buildConciseBloatDirective(metricsRaw, profileRaw) {
  const metrics = parseGlowUpMetrics(metricsRaw)
  const profile = parseFaceProfile(profileRaw)
  const composition = classifyFacialComposition(metrics || {}, profile || {})
  const deBloatPriority = String(profile?.deBloatPriority || profile?.de_bloat_priority || '').toLowerCase()

  const bloatSeverity = metrics?.bloatSeverity ?? profile?.bloatSeverity
  const water = metrics?.waterRetention
  const forceMaximum = deBloatPriority === 'maximum' || deBloatPriority === 'max'
  const heavy = composition.type === 'adipose'
    || composition.type === 'water_retention'
    || forceMaximum
    || (Number.isFinite(bloatSeverity) && bloatSeverity >= 35)
    || (Number.isFinite(water) && water < 68)

  if (composition.type === 'lean' && !heavy && !forceMaximum) {
    return `\n\nDe-bloat level: MODERATE-STRONG (~45%) — even lean faces need visible cheek/under-eye de-puff + premium skin polish. Before/after must be obvious.`
  }

  if (composition.type === 'lean' && forceMaximum) {
    return `\n\n⚠️ MAXIMUM GLOW-UP (lean face — still push hard):
- Face reads lean but MUST still show DRAMATIC visible improvement — not subtle polish.
- Drain ALL residual cheek/mid-face/under-eye fluid — noticeably fresher, tighter soft tissue.
- Skin: retinol-level clarity — strongly fade every blemish; same undertone.
- Before/after side-by-side must look clearly different on cheeks, eyes, and skin.`
  }

  if (heavy || forceMaximum) {
    return `\n\n⚠️ MAXIMUM DE-BLOAT REQUIRED (facial fat + water retention):
- This face reads FULL / PUFFY / BLOATED — remove a LOT of soft tissue. The after photo must look DRAMATICALLY leaner and less swollen — obvious before/after difference.
- WATER RETENTION (#1): aggressively drain moon-face puffiness, chipmunk cheeks, puffy under-eyes, nasal-labial fluid bloat, morning/fluid retention — face must look clearly deflated, not subtly less puffy.
- FACIAL FAT (#2): strip buccal fat pads, mid-face fullness, and under-chin soft fat — cheeks and jaw area read noticeably slimmer; same bone outline.
- DEFINITION: cheekbones and jaw SOFT-tissue edge must read clearer through volume removal — realistic 3–6 month lean-face transformation, NOT surgery.
- If the person looks overweight in the face, the after must show a dramatically leaner face through volume removal ONLY — never new jaw/chin bones.`
  }

  return `\n\nDe-bloat level: STRONG — remove substantial facial fat AND water-retention puffiness from cheeks, mid-face, under-eyes, and under-chin. Clearly leaner, less moon-face — same bones. Not a subtle edit.`
}

/** Mandatory skin cleanup — model often skips skin when de-bloat dominates the prompt. */
function buildConciseSkinDirective(metricsRaw, profileRaw) {
  const metrics = parseGlowUpMetrics(metricsRaw)
  const profile = parseFaceProfile(profileRaw)
  const skin = skinScore(metrics)
  const priority = String(profile?.skinCleanupPriority || profile?.skin_cleanup_priority || 'always').toLowerCase()
  const forceStrong = priority === 'always' || priority === 'maximum' || priority === 'max'
    || !Number.isFinite(skin) || skin < 78

  let block = `\n\n⚠️ MANDATORY SKIN CLARITY (required — do NOT skip):
Inspect ALL face skin: forehead, temples, cheeks, nose, chin, jaw, between brows.
- Fade ALL active pimples, acne, papules, whiteheads, blackheads, inflamed redness, blotchy patches until skin reads clearly REINER/purer vs input — obvious before/after.
- COLOR FROZEN: EXACT same skin color, undertone, melanin, warmth as input — match neck/ears; NO lightening, darkening, warming, cooling, or tan shift.
- KEEP micro-pores, skin grain, ALL existing freckles/moles/beauty marks in exact positions — no porcelain filter, no makeup, no new pigment spots.`

  if (forceStrong) {
    block += `\n- Push until active blemishes are clearly reduced at selfie distance — skin looks cleaner but color identical; permanent marks untouched.`
  }
  if (Number.isFinite(skin) && skin < 72) {
    block += `\n- Scan skin clarity ${skin}/100 — heavy blemish removal on cheeks, forehead, nose, and chin.`
  }

  return block
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
    lines.push(`[DIAGNOSIS: LEAN / ALREADY DEFINED — PREMIUM POLISH GLOW-UP]
- Face is already lean and defined — still deliver CLEARLY VISIBLE glow-up (subtle = FAILED).
- Priority: skin polish, rested eyes, brow beautify; micro fluid drain (~10%) only if any puffiness visible.
- Minimal jaw/chin change — bones frozen; NO hollow cheeks or jaw sculpt.`)
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
  let boost = 3
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
    level = 'minimal'
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

/** Skin cleanup must be visible but never porcelain/airbrush level. */
const SKIN_INTENSITY_CEILING = 'strong'

const INTENSITY_INSTRUCTIONS = {
  skip: 'SKIP — still apply visible skin/eye/brow polish; no heavy de-bloat.',
  minimal: 'MINIMAL de-bloat — but skin/eyes/brows MUST show clear premium polish in before/after.',
  light: 'LIGHT — micro fluid drain + noticeable skin/eye refresh; jaw/chin BONE unchanged.',
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
  const isLean = composition.type === 'lean'
  const softFloor = isLean ? 'light' : 'moderate'
  const skinFloor = isLean ? 'strong' : limits.skinFloor
  const eyeFloor = 'strong'
  const lines = []
  lines.push(isLean
    ? `[PERSONALIZED FOCUS — PREMIUM POLISH on already lean/defined face${gender === 'female' ? ', feminine jaw bone preserved' : ', jaw bone pixel-locked'}]`
    : `[PERSONALIZED FOCUS — VISIBLE de-bloat${gender === 'female' ? ', feminine jaw bone preserved' : ', jaw bone pixel-locked, facial hair unchanged'}]`)

  const bloatBoost = boost + (composition.type === 'water_retention' ? 2 : 1)
  lines.push(zoneLine(
    ZONE_LABELS.waterRetention,
    intensityFloor(
      capIntensity(zoneIntensity(metrics.waterRetention, bloatBoost), isLean ? 'light' : 'strong'),
      isLean ? 'minimal' : softFloor,
    ),
    isLean
      ? 'Micro fluid drain only — fresher under-eyes; mandible bone unchanged.'
      : gender === 'female'
        ? 'Strong water-retention reduction — clearly fresher, less puffy cheeks/mid-face; mandible bone unchanged.'
        : 'Strong water-retention reduction — clearly less bloated face; mandible bone outline identical to input.',
  ))

  lines.push(zoneLine(
    ZONE_LABELS.cheekbones,
    intensityFloor(
      capIntensity(zoneIntensity(metrics.cheekbones, boost + 1 + limits.cheekExtra), isLean ? 'light' : 'strong'),
      isLean ? 'minimal' : softFloor,
    ),
    isLean
      ? 'Light cheek polish — slightly fresher through micro fluid only; jaw bone FROZEN.'
      : gender === 'female'
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
    intensityFloor(zoneIntensity(metrics.eyeArea, boost + 2), eyeFloor),
    'Clearly de-puff under-eyes and upper lids — open, rested, awake look; same iris color and eye shape.',
  ))

  lines.push(zoneLine(
    ZONE_LABELS.eyebrows,
    capIntensity(
      intensityFloor(zoneIntensity(browScore(metrics), boost), 'light'),
      BROW_CEILING,
    ),
    'Beautify ONLY — cleaner edges, remove stray hairs, neater groomed look; slightly fuller/healthier density; EXACT same shape, arch, thickness category, position, and color as input.',
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
    intensityFloor(zoneIntensity(skinScore(metrics), boost + (isLean ? 3 : 1)), skinFloor),
    isLean
      ? 'Premium retinol/vitamin-C polish — clearly smoother, healthier skin; keep freckles/moles exact; same undertone.'
      : 'Retinol + vitamin C clarity — clearly cleaner, smoother skin; keep pores, freckles, moles; same luminance, undertone, and skin type.',
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
  const isLean = composition.type === 'lean'
  const softFloor = isLean ? 'light' : 'moderate'
  const skinFloor = isLean ? 'strong' : limits.skinFloor
  const lines = []
  lines.push(isLean
    ? `[PERSONALIZED FOCUS — PREMIUM side polish on already lean/defined face${gender === 'female' ? ', jaw profile pixel-locked' : ''}]`
    : `[PERSONALIZED FOCUS — VISIBLE side de-bloat${gender === 'female' ? ', jaw profile pixel-locked' : ''}]`)

  lines.push(zoneLine(
    ZONE_LABELS.cheekbones,
    intensityFloor(
      capIntensity(zoneIntensity(metrics.cheekbones, boost + 2 + limits.cheekExtra), isLean ? 'light' : 'strong'),
      isLean ? 'minimal' : softFloor,
    ),
    isLean
      ? 'Light cheek polish from side — micro fluid only; profile bone curve unchanged.'
      : gender === 'female'
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
      capIntensity(zoneIntensity(metrics.chinNeck, boost + 2), isLean ? 'light' : jawLimits.ceiling),
      isLean ? 'minimal' : 'moderate',
    ),
    isLean
      ? 'Micro submental refresh only if puffiness visible — chin profile bone FROZEN.'
      : gender === 'female'
        ? 'Strong submental de-bloat — tighter under-chin, sharper jaw-neck line; chin profile bone FROZEN.'
        : 'Strong submental de-bloat — tighter under-jaw, leaner neck transition; chin/jaw profile bone pixel-identical.',
  ))

  lines.push(zoneLine(
    ZONE_LABELS.jawline,
    intensityFloor(
      capIntensity(zoneIntensity(metrics.jawline, boost + 2), isLean ? 'light' : 'moderate'),
      isLean ? 'minimal' : 'moderate',
    ),
    isLean
      ? 'Micro jaw soft-tissue polish only — mandible outline must match input exactly.'
      : 'Lean jaw soft tissue from side — cleaner profile edge; mandible outline must match input exactly.',
  ))

  lines.push('- Nose, lips, forehead profile: SKIP — do not alter profile silhouette.')

  lines.push(zoneLine(
    ZONE_LABELS.skin,
    intensityFloor(zoneIntensity(skinScore(metrics), boost + (isLean ? 3 : 1)), skinFloor),
    isLean
      ? 'Premium skin polish from side — clearly smoother, healthier; keep freckles/moles exact.'
      : 'Retinol + vitamin C clarity from side; same color and skin type.',
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
      return `[PERSONALIZED FOCUS — female, VISIBLE side glow-up]
- Water retention: STRONG — clearly fresher, less puffy; jaw bone frozen.
- Cheeks: STRONG — clearly leaner side profile; feminine bone curve unchanged.
- Eyes: STRONG — clear lateral under-eye de-puff.
- Eyebrows: MODERATE — beautify only; same shape.
- Chin & submental: STRONG — tighten under-chin; sharper jaw-neck line; chin bone FROZEN.
- Jawline (side): MODERATE — lean jaw soft tissue; mandible profile identical to input.
- Skin: STRONG — clarity on cheek/jaw/neck.
- Nose/lips/forehead profile: SKIP.`
    }
    return `[PERSONALIZED FOCUS — VISIBLE side glow-up, jaw bone pixel-locked]
- Cheeks (side): STRONG — clear de-bloat; bone curve unchanged.
- Eyes: STRONG — under-eye de-puff.
- Eyebrows: MODERATE — beautify only.
- Chin & submental: STRONG — tighten under-chin soft tissue; sharper jaw-neck line; chin/jaw profile BONE frozen.
- Jawline (side): MODERATE — lean jaw soft tissue from profile; mandible outline identical to input.
- Skin: STRONG — retinol/vitamin-C clarity on cheek/jaw/neck.
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
  const parts = [SAME_PERSON_AMPLIFY, HEAD_HAIR_PIXEL_LOCK, REALISTIC_ACHIEVABLE_FACE_EDITS, facialHairMandatory, ZERO_INVENTION_LOCK, GLOW_UP_ONLY_NO_INVENTION, SKIN_MARKS_PRESERVATION_LOCK, CHEEK_DEFINITION_FOCUS, JAW_BONE_INVENTION_BAN, task, VISIBLE_GLOW_UP_TARGET]
  if (diagnosis) parts.push(diagnosis)
  const plan = resolveGlowUpPlan(metricsRaw, faceProfileRaw, key)
  if (plan.tier === 'heavy') {
    parts.push(buildConciseBloatDirective(metricsRaw, faceProfileRaw))
    parts.push(buildConciseSkinDirective(metricsRaw, faceProfileRaw))
    parts.push(SKIN_TONE_CLARITY_LOCK)
  } else if (plan.tier === 'defined') {
    parts.push(ALREADY_LEAN_POLISH_GUIDE)
    parts.push(buildConciseSkinDirective(metricsRaw, faceProfileRaw))
    parts.push(SKIN_TONE_CLARITY_LOCK)
  } else {
    parts.push(buildConciseSkinDirective(metricsRaw, faceProfileRaw))
    parts.push(SKIN_TONE_CLARITY_LOCK)
  }
  parts.push(
    HEAD_HAIR_PIXEL_LOCK,
    FACIAL_HAIR_PIXEL_LOCK,
    REALISTIC_BONE_ENFORCEMENT,
    CHEEK_DEFINITION_FOCUS,
    CRITICAL_LIGHTING_COLOR_IDENTITY_LOCK,
    genderGuide,
    REALISTIC_GLOW_UP_RANGE,
    SOFTMAXXING_GUIDE,
    SCENE_AND_IDENTITY_LOCK,
    SKIN_MARKS_PRESERVATION_LOCK,
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

export function buildConciseHeadHairLine(vision) {
  const desc = String(vision?.hairStructure || '').trim()
  if (desc) {
    return `Head hair: FROZEN — keep EXACTLY "${desc}" — same color, length, style, texture, volume, hairline. No restyle or recolor.`
  }
  return 'Head hair: FROZEN — copy input pixels exactly (color, length, style, texture, volume, hairline). No restyle, trim, recolor, or volume change.'
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

/** 1–3 short lines derived from scan metrics (keeps concise prompt under ~1.5k chars). */
function buildConciseMetricsFocus(metricsRaw, profileRaw, mode = 'front') {
  const metrics = parseGlowUpMetrics(metricsRaw)
  const profile = parseFaceProfile(profileRaw)
  const composition = metrics
    ? classifyFacialComposition(metrics, profile || {})
    : { type: 'mixed' }
  const boost = compositionBoost(composition)
  const lines = []

  if (!metrics) {
    return `\n\nPersonalized focus for this face:
- Skin (mandatory): fade active pimples, acne, blackheads, redness — calmer skin; keep ALL existing freckles/moles; NEVER add new skin marks; keep pores, grain, texture.
- Water retention: drain cheek/mid-face/under-eye fluid bloat moderately — fresher, less puffy face.
- Facial fat: reduce buccal and under-chin soft fat moderately — slightly leaner face, same bones.`
  }

  const waterLevel = intensityFloor(zoneIntensity(metrics.waterRetention, boost + 5), 'strong')
  if (waterLevel !== 'skip') {
    const adv = conciseIntensityWord(waterLevel)
    lines.push(
      mode === 'side'
        ? `Water retention ${adv}: aggressively drain ALL puffy/fluid bloat from cheeks, under-eyes, submental — face dramatically less swollen; same bone line (anti-bloat ${metrics.waterRetention ?? '?'}/100).`
        : `Water retention ${adv}: aggressively drain fluid bloat from cheeks, mid-face, under-eyes, nasal area — dramatically deflated, much less moon-face (anti-bloat ${metrics.waterRetention ?? '?'}/100).`,
    )
    lines.push(
      mode === 'side'
        ? `Facial fat ${adv}: strip buccal/submental SOFT fat — dramatically leaner profile; mandible/chin BONE frozen.`
        : `Facial fat ${adv}: strip buccal/mid-face fat pads — dramatically leaner, hollower cheeks; jaw/chin/cheekbone BONES pixel-identical.`,
    )
  } else {
    lines.push('Water retention strongly: drain visible cheek/mid-face/under-eye fluid bloat — clearly deflated face.')
    lines.push('Facial fat strongly: strip buccal and under-chin soft fat — dramatically leaner, same bones.')
  }

  if (composition.type === 'adipose' || composition.type === 'water_retention') {
    lines.unshift('CRITICAL: maximum realistic de-bloat — this face needs dramatic fat + water-retention reduction while keeping the exact same bone structure.')
  }

  const defLevel = intensityFloor(zoneIntensity(metrics.facialDefinition, boost + 2), 'moderate')
  if (defLevel !== 'skip' && Number.isFinite(metrics.facialDefinition) && metrics.facialDefinition < 62) {
    lines.push(`Soft-tissue definition ${conciseIntensityWord(defLevel)}: reduce round/moon-face fullness until cheek and jaw SOFT tissue reads much leaner.`)
  }

  const midLevel = intensityFloor(zoneIntensity(metrics.midfaceFullness, boost + 2), 'moderate')
  if (midLevel !== 'skip' && Number.isFinite(metrics.midfaceFullness) && metrics.midfaceFullness < 58) {
    lines.push(`Mid-face ${conciseIntensityWord(midLevel)}: reduce mid-face puffiness and buccal roundness — leaner mid-face, same bone width.`)
  }

  const skinLevel = capIntensity(
    intensityFloor(zoneIntensity(skinScore(metrics), boost + 3), 'strong'),
    SKIN_INTENSITY_CEILING,
  )
  const skinWord = skinLevel === 'skip' ? 'strongly' : conciseIntensityWord(skinLevel)
  lines.unshift(`Skin ${skinWord} (mandatory): fade active pimples, acne, blackheads, redness — calmer skin; keep ALL existing freckles/moles in exact spots; NEVER add new freckles, moles, or skin marks; keep pores, grain, texture.`)

  const eyeLevel = intensityFloor(zoneIntensity(metrics.eyeArea, boost + 3), 'strong')
  if (eyeLevel !== 'skip') {
    lines.push(`Eyes ${conciseIntensityWord(eyeLevel)}: less under-eye bags, more rested and open.`)
  }

  if (composition.type === 'lean') {
    lines.push('Already lean/defined — push premium skin + eye + brow polish hard; minimal de-bloat only (~10% fluid). Glow-up must still be obvious.')
  }

  if (!lines.length) return ''
  return `\n\nPersonalized focus for this face:\n${lines.map((l) => `- ${l}`).join('\n')}`
}

function buildCompactScanHint(metricsRaw, profileRaw, mode = 'front', plan = null) {
  const resolvedPlan = plan || resolveGlowUpPlan(metricsRaw, profileRaw, mode)
  const metrics = resolvedPlan.metrics
  const hints = [`scan tier=${resolvedPlan.tier} water ~${resolvedPlan.waterDrainPct}% fat ~${resolvedPlan.fatPct ?? resolvedPlan.deBloatPct}% (soft tissue only, bones frozen)`]

  if (resolvedPlan.weakZones.length) {
    hints.push(`priority zones: ${resolvedPlan.weakZones.join(', ')}`)
  }

  if (resolvedPlan.tier === 'defined') {
    hints.push('push water drain + skin purity + definition refresh hard')
  } else if (resolvedPlan.tier === 'heavy') {
    hints.push('puffy face — maximum water drain + definition + skin purity until clearly transformed')
  } else {
    hints.push('push strong water + fat reduction — soft tissue only, bones must stay identical')
  }

  if (!metrics) {
    return `\n${hints.join('; ')}.`
  }

  return `\n${hints.join('; ')}.`
}

function buildConciseSideGlowUpPrompt(metricsRaw, faceProfileRaw) {
  return buildAdaptiveConcisePrompt('side', metricsRaw, faceProfileRaw)
}

/**
 * Short, actionable edit prompt for Nano Banana 2 (~600–1100 chars).
 * Long prompts (~3k+ chars) cause the model to return nearly identical images.
 */
export function buildConciseGlowUpPrompt(mode = 'front', metricsRaw = null, faceProfileRaw = null, visionRaw = null, options = {}) {
  return buildAdaptiveConcisePrompt(mode, metricsRaw, faceProfileRaw, visionRaw, options)
}

/** Pick prompt strategy: concise (Nano Banana) or hybrid (legacy/GPT). */
export function buildGlowUpPrompt(mode = 'front', metricsRaw = null, faceProfileRaw = null, style = 'auto', visionRaw = null, options = {}) {
  const resolved = String(style || process.env.FUTURE_SELF_GLOW_UP_PROMPT_STYLE || 'auto').trim().toLowerCase()
  if (resolved === 'hybrid' && !options.secondPass) {
    const base = buildHybridGlowUpPrompt(mode, metricsRaw, faceProfileRaw)
    const visionBlock = buildVisionPersonalizationBlock(visionRaw, resolveGlowUpPlan(metricsRaw, faceProfileRaw, mode), mode)
    return visionBlock ? `${base}\n\n${visionBlock.trim()}` : base
  }
  return buildConciseGlowUpPrompt(mode, metricsRaw, faceProfileRaw, visionRaw, options)
}

export function glowUpPromptMeta(mode = 'front', metricsRaw = null, faceProfileRaw = null, visionRaw = null) {
  const metrics = parseGlowUpMetrics(metricsRaw)
  const profile = parseFaceProfile(faceProfileRaw)
  const composition = classifyFacialComposition(metrics || {}, profile || {})
  const plan = resolveGlowUpPlan(metricsRaw, faceProfileRaw, mode)
  const vision = visionRaw?.analysis ?? visionRaw
  return {
    mode: normalizeFutureSelfMode(mode),
    adaptive: Boolean(metrics || vision),
    visionUsed: Boolean(vision),
    visionConfidence: vision?.confidence ?? null,
    visionPriorityZones: vision?.priorityZones ?? null,
    visionKeywords: vision?.personalizedKeywords ?? null,
    visionError: visionRaw?.error ?? null,
    metricsUsed: metrics ? Object.keys(metrics) : [],
    compositionType: metrics ? composition.type : null,
    compositionStrategy: metrics ? composition.strategy : null,
    glowUpTier: plan.tier,
    deBloatTargetPct: plan.deBloatPct,
    fatTargetPct: plan.fatPct ?? plan.deBloatPct,
    waterDrainTargetPct: plan.waterDrainPct,
    gender: normalizeGender(profile),
    facialHair: profile?.facialHair ?? null,
    promptStyle: String(process.env.FUTURE_SELF_GLOW_UP_PROMPT_STYLE || 'concise').trim().toLowerCase(),
  }
}
