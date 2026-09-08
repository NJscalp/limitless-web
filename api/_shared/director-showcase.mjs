/**
 * director-showcase.mjs — die drei Karten, die das Chamäleon beim Start wirft.
 *
 * Sie zeigten bisher die sieben Digicam-Filter aus der App. Das ist aus zwei
 * Gründen falsch: sie sind fest im Binary, also nur mit einem App-Update
 * änderbar — und sie sind das Langweiligste, was der Director kann. Ein
 * Farbfilter ist kein Grund, die App zu öffnen.
 *
 * Stattdessen kommen sie vom Server und mischen zwei Sorten:
 *
 *   kind: "trend"  — was gerade läuft. Kommt aus derselben Quelle wie die
 *                    Trends im Gespräch, ist also mit einem Eintrag im
 *                    Datensatz austauschbar, ohne Deploy und ohne App-Update.
 *   kind: "skill"  — was der Director kann, das niemand erwartet: Störendes
 *                    entfernen, überglättete Haut zurückholen, ein Gesicht aus
 *                    dem Schatten holen. Das sind die Karten, die erklären,
 *                    wofür die App da ist.
 *
 * Die Trends stehen vorn — sie sind das Aktuelle. Reichen sie nicht für drei,
 * füllen die Fähigkeiten auf.
 *
 * WICHTIG: diese Karten sind eine EINLADUNG, kein Auftrag. Sie tragen keinen
 * fertigen Prompt, denn ohne Foto gibt es nichts zu bearbeiten. Wer eine
 * antippt, sagt dem Director nur, worauf er hinauswill — das Foto kommt danach.
 */

import { loadTrends } from './director-trends.mjs'

/** Wie viele Karten geworfen werden. */
const COUNT = 3

/**
 * Die Fähigkeiten-Karten. Über `SHOWCASE_SKILLS` (JSON) austauschbar, ohne
 * dass jemand Code anfassen muss.
 */
const DEFAULT_SKILLS = [
  {
    id: 'skill_declutter',
    label: 'Clean it up',
    caption: 'Remove what ruins the shot',
    icon: 'wand.and.sparkles',
    ask: 'Look at my photo and remove whatever is ruining it.',
  },
  {
    id: 'skill_reallight',
    label: 'Rescue the light',
    caption: 'Faces out of shadow, blown windows tamed',
    icon: 'sun.max',
    ask: 'The light in my photo is bad. Fix it without making it look edited.',
  },
  {
    id: 'skill_realskin',
    label: 'Real skin back',
    caption: 'Undo the over-smoothed look',
    icon: 'face.smiling',
    ask: 'Bring the real skin texture back into my photo.',
  },
  {
    id: 'skill_postable',
    label: 'Make it postable',
    caption: 'One clear subject, light that flatters',
    icon: 'square.and.arrow.up',
    ask: 'Make my photo postable.',
  },
]

function skills() {
  const raw = (process.env.SHOWCASE_SKILLS || '').trim()
  if (raw) {
    try {
      const list = JSON.parse(raw)
      if (Array.isArray(list) && list.length) return list
    } catch { /* kaputtes JSON → Vorgabe */ }
  }
  return DEFAULT_SKILLS
}

function card(o, kind) {
  const id = String(o?.id || '').trim()
  const label = String(o?.label || o?.name || '').trim()
  if (!id || !label) return null
  return {
    id,
    label: label.slice(0, 28),
    caption: String(o?.caption || o?.spot || '').trim().slice(0, 60),
    kind,
    preview: String(o?.preview || '').trim() || null,
    // Fähigkeiten haben kein Vorschaufoto — sie zeigen ein Zeichen. Ohne das
    // stünde dort eine leere graue Fläche, und genau so sah es im Simulator
    // auch aus.
    icon: String(o?.icon || '').trim() || (kind === 'trend' ? 'flame' : 'sparkles'),
    // Was beim Antippen an den Director geht — eine Absicht, kein Bild-Prompt.
    ask: String(o?.ask || `I want the ${label} look on my photo.`).trim(),
  }
}

/** Wirft nie — im Zweifel die Fähigkeiten allein. */
export async function loadShowcase() {
  const trends = await loadTrends().catch(() => [])
  const fromTrends = trends.map((t) => card(t, 'trend')).filter(Boolean)
  const fromSkills = skills().map((s) => card(s, 'skill')).filter(Boolean)

  // Höchstens zwei Trends, damit immer mindestens eine Fähigkeit dabei ist —
  // sonst sieht die App an einem trendreichen Tag aus wie eine Trendliste und
  // niemand erfährt, dass sie auch aufräumen kann.
  const picked = [...fromTrends.slice(0, 2)]
  for (const s of fromSkills) {
    if (picked.length >= COUNT) break
    picked.push(s)
  }
  return picked.slice(0, COUNT)
}
