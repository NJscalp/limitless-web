// api/_shared/trend-knowledge.mjs
//
// Laufende TREND-Wissensbasis des Trend-Agenten. Wird — wie die anderen
// Wissensbasen — bei JEDER Anfrage komplett in den System-Prompt injiziert.
//
// Zweck: der Agent soll benannte, gerade laufende TikTok-Formate auf Zuruf
// nachbauen können ("mach den Neegy-Trend"), nicht nur allgemeine Luxus-Edits.
// Diese Datei ist die Stelle, an der neue Trends nachgetragen werden — jeder
// Eintrag braucht: wie der Trend heißt und wie er noch geschrieben wird, was
// mechanisch passiert, und wie das Bild konkret gebaut wird.
//
// Recherchiert am 30.07.2026 direkt in der TikTok-Suche.

export const TREND_KNOWLEDGE = `# LIVE TREND FORMATS (named formats you can rebuild on request — always draw on this)

## How to use this section
When someone names a trend — "make the neegy trend", "do the golden statue thing", "that character trend" — you rebuild it from the recipe below instead of guessing. If they name a trend you do NOT have a recipe for, say so in one short line and ask what it looks like rather than inventing a wrong version. Never pretend to know a format you don't.
When someone drops a photo without naming anything, a currently-running trend is a legitimate option to offer alongside the flex/fashion/feed lanes — but only when the photo can actually carry it.

## THE CHARACTER-STATUE TREND (the format class) — currently the biggest AI photo trend
**Also written:** neegy · neggy · niggy · nezu golden. Tags: #neegy #neegymeme #neegytrend #capcut #capcutpioneer.
**What it is:** a life-size STATUE of a meme cartoon character, rendered in polished gold, standing in an ordinary real-world place next to a real person. The person poses with it as if it were genuinely installed there — leaning on it, gesturing at it, standing beside it looking at it. Observed on TikTok at 123.7K, 45.4K, 33.2K, 22.1K views on posts 1–3 days old, with "how to" tutorials already appearing — the format is running right now and people are struggling to make it, currently stitching it together in CapCut, Alight Motion and Cantina.
**Why it works:** the joke is the collision — an absurd cartoon figure rendered as a serious, expensive-looking public monument, dropped into a completely mundane real setting. The realism of the statue is what makes it funny. A cartoon-looking paste-in kills it.

**THE RECIPE — build the statue as a real physical object, not as a drawing:**
- **Material.** Polished cast gold or gilded bronze: a mirror-bright surface that REFLECTS the actual surroundings — the sky, the ground, the person's clothes, nearby buildings. Warm yellow-gold with darker recesses where the form curves away, bright specular hotspots on the raised edges, and slightly duller, hand-worn patches on the parts people would touch. Not flat yellow. Not glowing.
- **Scale and mass.** Life-size or slightly larger than the person, standing on its own feet or on a low plinth. It must look HEAVY: it sits into the ground, it doesn't hover, and the ground under it is unchanged.
- **The contact point is what sells it.** Feet or plinth visibly resting on the actual surface with a correct contact shadow that matches every other shadow in the photo — same direction, same softness, same length.
- **Light.** The statue takes the scene's existing light exactly: same direction, same hardness, same colour temperature. In overcast light it goes soft and low-contrast; in hard sun it gets a blown-out hotspot and a crisp shadow. Whatever the person's light is doing, the gold does the same.
- **The person.** Identity locked as always. Their pose is built for standing next to a statue — gesturing at it, hand resting on its shoulder or arm, looking at it rather than at the camera, or mock-posing alongside it. Never the source photo's pose carried over.
- **The place.** Deliberately ordinary and specific: a balcony with mountains behind, a garden path, a driveway, a supermarket car park, a school corridor, a living room. The mundane setting IS the joke — a luxury location ruins it.
- **The camera.** Ordinary handheld phone snapshot, slightly off-centre, horizon not perfectly level, the frame clipping something at an edge. It should look like someone genuinely photographed a statue that exists.

**If the user does not describe the character:** ask in one short line what it looks like, or work from the reference image if they attached one. Do NOT invent a specific named character's appearance you are unsure of — a wrong character is a failed trend. If they DO describe it, translate the description into sculptural terms: exaggerated proportions become exaggerated sculptural forms, and cartoon features become cast metal shapes with real thickness and edges.

**Variants of the same format that also work:** the statue in silver, chrome or marble instead of gold; a bronze plaque or park monument with the character on it; the character as a shop-window mannequin, a garden gnome, an inflatable, or a Lego-style figure on a shelf. Same rules every time — real material, real weight, real contact shadow, real light, mundane place.

## WHY THIS FORMAT CLASS MATTERS BEYOND ONE CHARACTER
"Insert an absurd object into a real photo as if it is genuinely there" is a whole family of trends that keeps coming back with different objects. The technique is identical to putting a car in a driveway: the object must obey the photo's light, sit on the ground, reflect its surroundings and be photographed like a snapshot rather than composed like a render. Whenever a new object trend appears, apply exactly these rules to it.
`;
