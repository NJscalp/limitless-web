/**
 * director-looks.mjs — der Katalog der Kamera-Looks.
 *
 * Die IDs sind identisch mit `DigiCamStyles.swift` in der App. Das ist der
 * ganze Vertrag zwischen beiden: das Backend nennt eine `id`, die App findet
 * darüber Vorschaubild und Titel. Früher wurden dafür Label-TEXTE verglichen —
 * daran ist jede Umbenennung und jeder Tippfehler zerbrochen.
 *
 * Diese Looks ändern Motiv, Pose, Bildaufbau, Identität, Kleidung und Ort
 * NICHT. Sie legen eine echte fotografische Anmutung darüber. Das ist der
 * Modus `preserve_photo` und der Normalfall der App.
 */

/** Steht über jedem Rezept. Identität und Bildaufbau sind unantastbar. */
export const KEEP_RULE = `Keep the exact same person: same face and every feature of it, same hair, same skin tone and real skin texture, same build and body proportions, same age, same outfit. Do NOT beautify, slim, smooth, retouch or redraw them. Keep the exact same pose, framing, composition and scene - change ONLY the photographic look and lighting grade.`

/** Steht unter jedem Rezept. Kamera-Look, kein Plastikfilter. */
export const GRADE_RULE = `Skin keeps visible pores, natural highlights and real texture - this is a colour grade, not a retouch. The grade covers the whole frame, person and background equally. Photorealistic, looks like a real photograph straight out of a camera. No text, no logos, no watermark.`

/**
 * ZWEI FELDER, UND DIE REIHENFOLGE IST DER GANZE PUNKT.
 *
 * `realizes` sagt, welche fotografische VISION dieses Rezept technisch
 * umsetzen kann. Das ist die Frage, die der Director stellt, nachdem er
 * entschieden hat, was aus dem Bild werden soll: „Kann eines meiner Rezepte
 * das bauen?"
 *
 * `requires` ist nachrangig: die technischen Voraussetzungen, ohne die das
 * Rezept nicht traegt. **Eine erfuellte Voraussetzung ist NIE fuer sich
 * genommen ein Grund, den Look zu empfehlen.**
 *
 * Hier stand vorher `fits: 'Nachts draussen, Strasse, Bar …'` und davor im
 * Prompt „Passt zu:". Das war eine NACHSCHLAGETABELLE Ort → Stil, und sie
 * kehrte die Richtung um: nicht „welches Rezept baut meine Vision", sondern
 * „welche Vision passt zu meinen Rezepten". Zwei voellig verschiedene
 * Nachtfotos bekamen deshalb dieselbe Antwort.
 *
 * Der Katalog ist eine AUSFUEHRUNGSBIBLIOTHEK, keine Entscheidungsbibliothek.
 */
export const LOOKS = [
  {
    id: 'g7xflash',
    title: 'G7X Flash',
    caption: 'Crisp Xenon flash & warm skin',
    family: 'Flash',
    realizes: 'Einem Motiv den Eindruck geben, es sei absichtlich beleuchtet worden — es loest sich vom Raum, statt in ihm unterzugehen; aus einem Schnappschuss wird etwas Gemachtes.',
    requires: 'Das Motiv ist nah genug, dass ein Blitz es physisch erreichen wuerde, und das vorhandene Licht traegt die Aufnahme nicht selbst.',
    recipe: `Authentic Canon G7X direct on-camera flash: crisp natural skin, bright but controlled flash highlights on face and outfit, softly darker room ambience behind, warm-neutral skin around 5200K, a short hard shadow just behind the subject, slight falloff toward the frame edges.`,
  },
  {
    id: 'sunsetbeach',
    title: 'Sunset Beach',
    caption: 'Pink dusk sky & golden rim glow',
    family: 'Glow',
    realizes: 'Waerme und eine goldene Kante um das Motiv; einem gewoehnlichen Aussenmoment das Gefuehl vom Ende eines guten Tages geben.',
    requires: 'Offener Himmel im Bild und eine tief stehende oder rueckwaertige Lichtquelle, an die sich anknuepfen laesst.',
    recipe: `Late golden hour at the coast: warm pink-to-amber sky gradient, low sun behind the subject giving a golden rim along hair and shoulders, gently lifted warm shadows, soft haze in the distance, sand-and-sky colour cast across the whole frame.`,
  },
  {
    id: 'y2kdigicam',
    title: 'Y2K Digicam',
    caption: 'Cyber pop colors & CCD contrast',
    family: 'Vintage',
    realizes: 'Verspielte, ueberzeichnete Farbe; ein Bild wie ein Andenken wirken lassen statt wie eine Fotografie.',
    requires: 'Das Bild vertraegt harte Farbe — es lebt nicht von zarten Hauttoenen oder ruhiger Stimmung.',
    recipe: `Early-2000s CCD compact camera: punchy saturated colour with a cyan-magenta lean, crunchy contrast, slightly clipped highlights, visible sensor noise in the shadows, a touch of chromatic fringing at high-contrast edges, small on-camera flash falloff.`,
  },
  {
    id: 'sunlitglow',
    title: 'Sunlit Glow',
    caption: 'Warm window rays & lush tones',
    family: 'Glow',
    realizes: 'Eine vorhandene Lichtquelle zum eigentlichen Motiv machen; Tiefe und Waerme aus Richtung statt aus Saettigung.',
    requires: 'Es gibt bereits EINE klare, seitliche Lichtquelle, die sich verstaerken laesst — kein flaches Deckenlicht.',
    recipe: `Warm afternoon window light: a soft directional key from one side, visible gentle light shafts, creamy highlight rolloff on skin, deep but not black shadows, lush warm midtones, dust catching the light.`,
  },
  {
    id: 'cleangirl',
    title: 'Clean Girl',
    caption: 'Pure natural daylight & texture',
    family: 'Daylight',
    realizes: 'Ruhige, ehrliche Neutralitaet, in der Haut und Textur das Bild tragen; jeden Filtercharakter entfernen.',
    requires: 'Das vorhandene Licht ist weich genug, dass Neutralitaet eine Verbesserung und keine Verflachung ist.',
    recipe: `Clean overcast daylight: neutral white balance, very soft even key with no visible shadow direction, true skin texture with pores and fine hair kept, restrained contrast, quiet desaturated background, nothing warm and nothing blue.`,
  },
  {
    id: 'nightflash',
    title: 'Night Flash',
    caption: 'Late-night candid & city bokeh',
    family: 'Flash',
    realizes: 'Ein Motiv hart von einer dunklen Umgebung trennen und die vorhandenen Lichter dahinter absichtlich wirken lassen.',
    requires: 'Punktfoermige Lichter hinter dem Motiv und eine Umgebung, die dunkel genug fuer Blitzabfall ist.',
    recipe: `Late-night phone flash candid: hard close flash on the subject, deep dark surroundings, city lights behind rendered as soft round bokeh, cool blue ambient against warm flash skin, slight motion blur at the frame edges, honest grain.`,
  },
  {
    id: 'monomono',
    title: '35mm Mono',
    caption: 'High-contrast vintage B&W',
    family: 'B&W',
    realizes: 'Form, Tonwert und Geste zum ganzen Bild machen, wenn die Farbe gegen es arbeitet.',
    requires: 'Form und Tonwertumfang tragen das Bild auch ohne Farbe.',
    recipe: `Classic 35mm black and white film: deep blacks with detail held, bright separated highlights, strong tonal contrast, visible silver grain, slightly soft corners, no colour cast whatsoever.`,
  },
]

/** Vollständiger, selbsttragender Prompt für einen Look. */
export function lookPrompt(look) {
  return `${KEEP_RULE}\n\n${look.recipe}\n\n${GRADE_RULE}`
}

/** Kompakte Fassung für die Wissensbasis im Systemprompt. */
export function looksForPrompt() {
  return LOOKS.map((l) =>
    `### ${l.title}  (id: ${l.id}, ${l.family})\n${l.caption}\nCan realize: ${l.realizes}\nRequires: ${l.requires}\nRecipe: ${l.recipe}`
  ).join('\n\n')
}
