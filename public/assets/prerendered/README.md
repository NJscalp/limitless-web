# Prerendered Task Videos & Live Photos

Dieser Ordner enthält die **fertig aufgenommenen** MP4- und Live-Photo-ZIP-Dateien für alle 9 Unlock-Camera-Tasks. Wenn ein Besucher auf "Video · 10s" oder "Live Photo · 3s" klickt, wird zuerst geprüft, ob hier eine passende Datei liegt — falls ja, wird sie als statischer Download ausgeliefert (instant, funktioniert auf jedem Browser, keine Live-Capture nötig).

**PSL-Rating-Video (3. Handy, Default-Zustand):** siehe [README-psl-baseline.md](./README-psl-baseline.md).

## Dateinamen-Konvention

Genau so benennen — die Frontend-Logik baut die URL aus dem Task-Namen-Slug:

| Task                | Video-Datei               | Live-Photo-Datei          |
| ------------------- | ------------------------- | ------------------------- |
| Drink Water         | `drink-water-video.mp4`   | `drink-water-live.zip`    |
| Jaw Exercise        | `jaw-exercise-video.mp4`  | `jaw-exercise-live.zip`   |
| Eyebrow Raises      | `eyebrow-raises-video.mp4`| `eyebrow-raises-live.zip` |
| Neck Stretches      | `neck-stretches-video.mp4`| `neck-stretches-live.zip` |
| Fish Face           | `fish-face-video.mp4`     | `fish-face-live.zip`      |
| Cheek Lifts         | `cheek-lifts-video.mp4`   | `cheek-lifts-live.zip`    |
| Jaw Side-to-Side    | `jaw-side-to-side-video.mp4` | `jaw-side-to-side-live.zip` |
| Head Rotations      | `head-rotations-video.mp4`| `head-rotations-live.zip` |
| O-Shape Mouth       | `oshape-mouth-video.mp4`  | `oshape-mouth-live.zip`   |

## Erzeugen (One-Click-Bake)

1. In **Desktop-Chrome** (nicht Safari — Safari unterstützt `CropTarget` nicht) die deployte Seite mit dem Admin-Flag öffnen:

   ```
   https://limitless-web-beryl.vercel.app/shield-lock-screen.html?admin=bake
   ```

2. Auf **„Start Baking"** klicken.
3. Einmal **„Share this Tab"** bestätigen (Chrome fragt im Browser-Dialog).
4. Warten (~4 Minuten) — der Browser durchläuft automatisch alle 9 Tasks und lädt **18 Dateien** in deinen Downloads-Ordner:
   - `{slug}-video.mp4` × 9
   - `{slug}-live.zip` × 9
5. Die 18 Dateien **hierher** verschieben (`public/assets/prerendered/`).
6. Commit & Deploy:

   ```bash
   cd "/Users/normannjungbauer/Desktop/Day One/limitless-web"
   npm run build && vercel --prod
   ```

Ab dann klicken alle Besucher **instant Download** statt Live-Capture.

## Fallback-Verhalten

Falls eine Datei fehlt (z. B. noch nicht gebaked), greift automatisch die bisherige Live-Capture (native Tab-Capture oder html-to-image). Die Seite bleibt also immer funktional, auch während der Baking-Phase.

## Technische Specs

- **Video**: 10 s Loop, 30 fps, 12 Mbit/s, H.264 MP4 (in Safari), VP8/9 WebM (in Chrome bei fehlendem MP4-Support)
- **Live Photo**: 3 s MOV (H.264) + JPEG-Still mit matching Apple Content Identifier → iOS erkennt das ZIP nach dem Entpacken als echtes Live Photo
- **Größen erwartet**: ~3–5 MB pro Video, ~2–3 MB pro Live-Photo-ZIP
