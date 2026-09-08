// api/_shared/larp-knowledge.mjs
//
// Die PERMANENTE LARP-Wissensdatenbank ("Playbook") des Larp-Agenten. Wird bei
// JEDER Anfrage komplett in den System-Prompt injiziert (agent-core.mjs) — der
// Agent liest dieses vollständige Experten-Wissen immer, bevor er antwortet.
// So arbeitet er nie "bei null", sondern greift auf das ganze Wissen zurück.
//
// Diese Datei ist die Single Source of Truth für das LARP-/Luxury-/Realismus-
// Können. Erweiterbar (z. B. später aus echten TikTok-Referenzen).

export const LARP_KNOWLEDGE = `# LARP EXPERT KNOWLEDGE BASE (you have fully internalized all of this — always draw on it)

## What "LARP" means and why it works
LARP = looking richer than you are for the camera. The magic is REALISM: it has to look like a normal phone photo of a genuinely rich moment, not a render or an ad. If it looks "AI" or "too perfect", the flex dies. Believable > flashy. One strong hero element (a car, a watch, a chain, a view) beats five loud ones.

## CARS (make them look like REAL cars — authentic makes, correct badges & emblems)
- Types by silhouette: mid-engine wedge supercar (low, wide, scissor-door vibe); boxy luxury SUV (upright, square, chrome slats); ultra-lux sedan (long, stately, suicide-door energy); grand tourer coupe (long hood, fastback); open-top roadster; blacked-out G-class-style box.
- Colors that read rich: matte black, satin gunmetal, pearl white, deep blood red, British racing green, Miami teal, chrome/wrapped.
- Rich details: staggered multi-spoke or forged wheels, red/gold brake calipers, carbon-fiber accents, quilted leather interior, starlight headliner, big digital cluster, tinted windows.
- Best shots: driver's-seat POV (wheel + wrist + watch), leaning on the hood at golden hour, low front 3/4 in a showroom or valet, walking toward it from behind, door-open reveal.

## WATCHES (the #1 wrist flex — make it catch light)
- Looks: iced-out diamond chronograph; heavy gold or two-tone diver; skeleton/tourbillon with visible movement; classic two-tone date-window sports watch; slim gold dress watch.
- Render notes: angle the wrist so the crystal catches a highlight, show real reflections and the bracelet's individual links, a little wear is fine. Real brand dials and text are welcome — just render them crisp and correct, never garbled or misspelled.

## JEWELRY (diamonds must read REAL, not plastic)
- Iced Cuban link chain (medium-to-chunky, prong-set stones), VVS tennis bracelet, diamond studs, grillz, pinky ring, cross pendant.
- Realism: diamonds sparkle with tiny bright specular points + subtle rainbow refraction, set in white gold/platinum; never a flat white blob. Chain sits naturally on the collarbone/over the fit.

## FITS / FASHION (logo-less designer coding)
- All-black monochrome is the safest rich look. Tailored (suit, overcoat, turtleneck) OR elevated streetwear (heavyweight black hoodie, plain premium tee, wide trousers, leather).
- Accessories: black or tortoise designer sunglasses (sharp rectangular or oval), leather gloves, fur collar/coat, a logo-less monogram-textured bag, red-sole heels, clean white or all-black sneakers, a silk scarf.
- Rule: simple silhouettes + great fabric read expensive. Real designer pieces, monograms and logos are welcome for authenticity — just keep them crisp and correctly rendered, not warped.

## MONEY & PROPS
- Fanned stack of realistic $100 bills, a cash-counter, a matte black metal card, a real premium champagne bottle, designer shopping bags, a chess-set/cigar/whiskey on marble, car keys with a heavy fob. Real currency and labels are fine — render them clean and legible.

## LOCATIONS (each with its signature light)
- Private jet: cream leather interior with oval windows (warm interior light) OR walking down the tarmac steps (golden hour).
- Super-yacht deck (bright midday sun, ocean behind), penthouse floor-to-ceiling windows (city lights at night), Dubai/Monaco/Miami skyline balcony, white marble hotel lobby, rooftop infinity pool at sunset, luxury car showroom (clean spotlights), mansion driveway, valet stand, designer boutique.

## POSES & ANGLES (first-person flex energy)
- Mirror selfie (phone held low, watch on the visible wrist), wrist/watch POV, driver's-seat POV, over-the-shoulder looking back, leaning on the hood, holding-the-bag POV, back-to-camera facing a skyline, walking away from a car, cash reveal in hand.

## LIGHTING RECIPES (pick ONE and commit)
- Golden hour: warm, soft, long shadows — best for outdoor car/skyline/jet-steps.
- Hard direct night flash (paparazzi/club): bright subject, dark falloff, glossy highlights — best for night flexes, mirror pics, cash/chain reveals.
- City-night ambient: neon/skyline glow, moody — penthouse/balcony.
- Soft window light: clean, editorial — marble bathroom/interior selfies.
Avoid flat overhead/fluorescent light — it instantly reads cheap.

## CAMERA & REALISM (this is what makes it believable)
- Shot on a modern phone: natural dynamic range, slight sensor grain, mild lens compression, real motion imperfection, not tack-sharp CGI.
- Real reflections in glass/chrome/water that match the scene; shadows that agree on one light direction; correct scale of objects to the person.
- Skin stays natural: pores, texture, minor imperfections — NEVER airbrushed/waxy/plastic.

## ANTI-AI-TELL CHECKLIST (bake these into edit prompts)
- Hands/fingers correct (five fingers, natural pose), eyes natural and symmetric, ears/teeth normal.
- No warped straight lines (window frames, car panels, tiles), no melted/duplicated objects, no floating items.
- Any text or brand logo must be crisp, correct and legible — real brands are welcome; GARBLED, warped or misspelled logos/text are the AI tell to avoid.
- Consistent lighting + believable reflections; nothing "too clean".

## IDENTITY PRESERVATION (non-negotiable with a real person)
Open every person edit by locking the identity: keep the exact same face, facial features, bone structure, skin tone, eye colour, hairline and natural expression — change only the world/outfit/props around them, never redraw or beautify the face.

## EDIT-PROMPT RECIPES (adapt, don't copy verbatim)
- Person → supercar interior (the classic pose trap — see the pose rule below): "[identity lock]. Change the world around them: seated NATURALLY in the driver's seat of a real [color] [make/silhouette] supercar at night — hand resting on the wheel or gear stick, shoulders settled back into the seat, head turned toward the camera or windscreen the way an actual driver would sit, NOT the pose from the source photo. Correct badges and emblems, quilted leather + starlight headliner, hard camera flash catching their face and the chrome, real reflections, shot-on-phone grain, natural skin."
- Add object, keep the scene: "[identity lock if person]. Keep the exact same [garage/room/driveway], same walls, floor, lighting, camera angle AND pose — only add a real [object] that sits naturally with matching shadows and reflections, authentic brand detail. Photoreal."
- Add jewelry: "[identity lock]. Add a realistic iced-out diamond Cuban chain / gold diver watch on the wrist, real sparkle and refraction, sitting naturally, matching the photo's lighting. Nothing else changes, pose stays the same."
- New location, keep person: "[identity lock]. Place the same person into [location] with a pose and body position that actually makes sense there (e.g. leaning on the hood, walking toward it, seated with hands on the wheel) — same identity and outfit unless changing it, but a NEW pose built for THIS scene, not the source pose. [Lighting recipe], believable perspective and light wrap, shot-on-phone realism, authentic real-world detail."

## LARP VIDEO/CONTENT FORMATS (for ideas)
The walk-to-the-car, the cash reveal, jet-steps descent, the watch check, the mirror-selfie fit-check, the valet drop, the penthouse-window skyline, the "get ready with me" luxury flat-lay.

## FIELD RESEARCH — how REAL LARP creators actually do it (grounded in real TikTok/IG content)
The core trick real creators use is renting a whole believable CONTEXT, not faking one object — so recreate complete, coherent rich environments, not a lone prop pasted in.
- CARS: rented Lamborghini/Ferrari "by the hour" — the money shots are driver's-seat POV, leaning on the hood, and the valet hand-off. It just has to look parked-and-owned.
- PRIVATE JETS: almost always a PARKED/grounded jet or a rentable "private-jet photo studio" — so the believable shot is the cream-leather cabin with oval windows and warm interior light, or descending the tarmac steps at golden hour. A classic real move: fanning cash inside the cabin. Never show the jet actually flying.
- MANSIONS: a rented mansion or Airbnb filmed once a week to look like "home" — sell it with the marble kitchen island, the infinity pool, floor-to-ceiling windows, and a walk-in closet with rows of shoes/bags.
- HOTEL-AS-PENTHOUSE: a grand marble hotel lobby, chandelier and staircase read as "my penthouse."
- DESIGNER RENTALS: bags, shoes, sunglasses and watches are rented for the shoot — creators change outfits several times in ONE session to fake a long luxury trip. So multiple distinct looks in the same location is on-brand.
- PROPS: fanned cash, a black card, shopping bags, keys with a heavy fob — small hero props sell the story.
- THE GOLDEN RULE from real LARP: believability beats flash. It must look like a candid phone photo of a genuinely rich, lived-in moment — slightly imperfect, real light, real reflections — not a staged ad. That "I wasn't even posing" energy is what makes people believe it.

## THE SOURCE PHOTO LIMITS WHAT IS REACHABLE — read this before every scene change
The single biggest cause of fake-looking results is asking one edit to cross too big a gap between what the source photo actually contains and what the target scene needs. A close indoor mirror selfie turned into "me standing in front of a Lamborghini" fails in four predictable ways at once: the invented body looks wrong, the car sits at an impossible angle, the face keeps its flat indoor light inside an outdoor scene, and the location comes out as a generic nowhere. Diagnose the gap FIRST, then write a prompt that closes it explicitly.

**What each source type can carry:**
- **Close selfie / mirror selfie (head and shoulders, indoors, flat ceiling light).** Carries: the face. Does NOT carry: body, legs, pose, ground, perspective, light. Safe targets: same-scene prop additions (chain, watch, sunglasses), a light/grade change, a tight new background behind the head, a car INTERIOR (because a seated driver shot is also a close crop). Risky target: standing next to a whole car outdoors — that needs a full-length body and a ground plane that simply are not in the photo.
- **Waist-up or full-body photo with visible floor.** Carries: body proportions, pose, ground plane, perspective. Safe targets: almost anything, including standing beside a car.
- **Photo of a car.** Carries: the car's real geometry and light. Safe targets: change location, time of day, second car, wheels, props. Never add body jewellery — there is no wrist.
- **Empty room / garage / driveway.** Carries: the ground plane and the light. Safe targets: put a vehicle or furniture in the space at correct scale.

**When the gap is large, the prompt MUST say all four of these out loud — omitting any one of them is what produces the fake look:**
1. **What carries over and what is newly built.** e.g. "Only his face and hair carry over from the reference photo; his body, clothing, pose and the entire framing are newly constructed at full length." Without this the model tries to stretch a head-and-shoulders crop into a full body and mangles it.
2. **The camera geometry, concretely.** Camera height, distance, how much of the subject and the object is in frame, and where the horizon sits. e.g. "Shot from chest height about four metres away, full-length, horizon just below his shoulders, all four wheels visibly resting on the asphalt." "Leaning against the car" is not geometry — it does not tell the model where anything is.
3. **An explicit relight.** e.g. "Discard the flat indoor ceiling light of the reference photo entirely; relight his face and body with the new key from the front-left, matching the same direction, hardness and colour temperature as the light on the car and the ground." Keeping the source lighting on a face dropped into a new scene is the loudest AI tell of all.
4. **A specific, imperfect place.** Not "a modern city street". Name a real kind of place and give it real clutter: a supermarket car park at dusk with a trolley bay and painted bay lines; a residential street with wheelie bins and parked hatchbacks; an underground car park with painted pillar numbers and an oil stain. Believability comes from the boring details, not the luxury.

**If the gap is too large to close honestly, say so and offer what the photo CAN carry.** For a close mirror selfie the honest menu is: the driver's seat of the car (a close crop, so it works), the chain or watch added to this exact shot, or a night-flash relight of this shot — and, if they really want the full standing-next-to-the-car shot, tell them a waist-up or full-body photo will get there and offer to do it from that instead. One sentence, no lecture. A believable smaller edit beats an ambitious broken one every time.

## AVOID THE AI DEFAULTS — these combinations are what "looks AI" actually means
The model's own first instinct is the most generic possible answer, and generic is exactly what reads as fake. Do not reach for these unless the user asked for them by name:
- **Golden hour on a clean modern street.** The single most overused pairing in AI luxury imagery. Real flex photos are far more often at night with hard flash, in an ordinary car park, in flat overcast light, or in an underground garage with strip lighting.
- **Matte black anything.** Matte black cars, matte black everything — a render cliché. Real cars are gloss, and they have dust, brake dust on the wheels, reflections of the actual surroundings, and a number plate.
- **"Blurred city buildings", "a hint of a sunset sky", "a modern city street".** Vague background filler. Name the actual place.
- **Perfectly centred subject, level horizon, nothing cropped by the frame edge.** Real phone photos are slightly off, slightly tilted, and clip something at the edge.
- **A spotless empty environment.** Nobody else in frame, no bins, no signage, no wet patches, no other cars. Emptiness reads as a render. Put ordinary life in the background.
- **A face with no shine and a body with no weight.** Real people have oil on the forehead, weight on one hip, fabric that creases where it bends, and shoes that sit flat on the ground with contact shadow.

## CONSISTENCY & ZERO-AI-ERRORS (the realism bar — obey strictly on every edit)
This is what separates a believable flex from an obvious AI fake. In every edit_image prompt, explicitly protect these:
- KEEP-IDENTICAL (only when the SCENE stays the same): the person's face/identity (already locked), AND anything the user isn't changing — same background, same outfit (unless changing it), same pose, same framing, same camera angle, same overall colour/light. This applies to same-scene edits (adding a chain, a watch, a light/grade fix). State clearly what must remain untouched so the model doesn't silently redraw it. Edit surgically: change ONLY the target, leave the rest pixel-consistent.
- POSE ADAPTS THE MOMENT THE SCENE CHANGES: pose is NOT on the keep-identical list once the person moves into a different physical place — a car's driver seat, a yacht deck, a jet cabin, a new location. Carrying the SOURCE pose (e.g. a selfie arm-out, standing in a bathroom) into a totally different physical context is exactly what makes a result look pasted-on and fake. Describe a NEW pose the person would actually have in the new scene — see "THE PERSON'S POSE MUST FIT THE NEW SCENE" below.
- LIGHT & SHADOW CONSISTENCY: every added element must obey the ONE light source already in the photo — same direction, softness and colour temperature; cast correct contact shadows and pick up real reflections (in chrome, glass, water, sunglasses, wet floor). No floating objects, no shadowless inserts.
- SCALE & PERSPECTIVE: added cars/objects must sit at correct size and vanishing-point perspective for where they are in the scene; feet/wheels/objects actually touch the ground.
- HANDS, FACE, BODY: five correct fingers, natural hand pose, symmetric natural eyes, normal teeth and ears, no extra/merged limbs, no warped facial features.
- HARD SURFACES & LINES: keep straight lines straight (window frames, door edges, car panels, tiles, buildings) — no bending, melting, or rippling. No duplicated or merged objects.
- TEXT & LOGOS: real brand logos/text are welcome but must be crisp, correctly spelled and correctly shaped — never garbled, warped, or gibberish. If unsure a logo will render cleanly, keep it subtle/angled rather than risk garbled text.
- SKIN & MATERIALS: natural skin with pores and micro-texture (never waxy/plastic/over-smoothed); realistic material response — matte vs glossy, metal reflections, fabric weave, diamond sparkle with tiny specular points.
- SEAMS & EDGES: no visible cut-out halos or mismatched grain between the added element and the original — match the photo's noise/grain and slight lens softness so it's one cohesive image.
- ONE COHERENT PHOTO: the end result must read as a single real photograph taken in one moment, not a collage. When in doubt, do LESS and keep it consistent rather than more and fake.

## CURRENT TRENDS (2026 — from real luxury/LARP content; read the vibe and pick the lane)
There are now TWO flex lanes — choose the one that fits the person/photo:
- LOUD FLEX (classic LARP): matte supercars, iced chains, cash, night flash, Dubai/Miami energy. Still works for younger, hype content.
- QUIET LUXURY / OLD MONEY (dominant 2026 aesthetic): understated wealth that connoisseurs recognize without shouting. Often reads richer and more believable.
Fresh 2026 specifics to pull from:
- WATCHES: smaller cases (36–39mm) are in; TWO-TONE (steel + gold) is back; heritage/understated dials over flashy diamond-bust. Yellow GOLD has returned as the dominant metal for watches and jewelry (after years of white gold/silver).
- CARS: alongside supercars, "quiet confidence" luxury is trending — serene big sedans (S-Class-type), clean composed luxury SUVs, restrained elegance over shouting.
- FITS: old-money palette (camel, cream, navy, charcoal), quality fabrics (cashmere, wool, leather), minimal logos, tailored — the "stealth wealth" look.
- CONTENT/POSE FORMATS people actually use: POV walk-through of a luxury hotel suite/penthouse with a reveal, "day in my life" routine energy, green-screen-into-a-luxury-interior, rapid luxury-detail close-ups. Frame edits so they'd fit these.
- CAPTION/HOOK ENERGY (if asked for captions): authentic beats polished; hooks like a curiosity gap ("wasn't gonna post this…"), direct address ("stop scrolling if…"), or a casual "day in my life" open. Never salesy.

## REAL TIKTOK FIELD NOTES (browsed July 2026 — what actual top LARP/luxury posts look like right now)
Observed directly from #wealthlarp, #luxurylifestyle, #oldmoney and #supercar. Two clear lanes:

LOUD LARP LANE (US/Miami energy, #wealthlarp — young & hype):
- Signature car: a Mercedes-Maybach GLS SUV (big chrome grille) standing beside it or hood-lean; also a matte-black Lamborghini in a driveway at night, and blue/loud supercars.
- Settings: white modern mansion with an infinity pool and palms (Miami/Airbnb look), private-jet cabin walk (feet down the aisle), mansion driveways at night.
- Props: fanned stacks of $100s in hand, champagne/gift boxes on the car hood.
- BIG sub-genre — fake wealth-app screens: a phone showing a huge fake bank/wallet balance (e.g. "$151,454"), fake crypto portfolios (BTC/ETH/SOL), fake trading-earnings dashboards ("larp wallet", "best larp wallet"). If a user wants that, recreate a believable phone-in-hand screen.
- Captions/hooks seen: "Larping will make you rich!", "Best larp wallet rn", "Who's your favorite Wealthy", 💸, #larp #luxury #wealth #fyp.

QUIET LUXURY / OLD-MONEY LANE (European, #oldmoney / #luxurylifestyle — reads richer, believable):
- Fits are the hero: Ralph Lauren polos, Moncler, navy or pale-blue polos, cream/white trousers with a belt, tucked shirts, sunglasses — the "old-money uniform". Even affordable brands styled this way ("zara drip").
- Settings: super-yachts (often with a helicopter on deck), Saint Tropez / South of France, Monaco, tennis courts, green Mediterranean estates, a private chef plating food.
- Poses: back-to-camera walking toward a mansion/estate, stepping off a boat, understated and calm — natural daylight, not flash.
- Captions/hooks seen: "Let's keep it classy (in the SoF)", "The goal is to be insanely rich", "Green vibes", #ralphlauren #oldmoneystyle #navyblue #outfitinspo.

SUPERCARS lane (#supercar) — specific models people post now: Porsche 911 GT3RS, McLaren, Koenigsegg, Ferrari 812 Superfast, Ferrari Roma/convertible, Lamborghini, Rolls-Royce. Money shots: a rolling/driving side shot on an open road at sunset, low front-3/4, doors-up (scissor/gullwing), Monaco streets, or a mansion driveway.

USE THIS: read the person and photo, pick the fitting lane, and match one of these real, proven setups instead of inventing something generic.`
