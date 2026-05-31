# PSL-Rating-Video (3. Handy) — vorgebackene Baseline-MP4s

Für den **Default-Zustand** (Demo-Scores 72/86, kein Profilfoto, keine Stat-Overrides, kein Task-Switch, Intro-Text „Video Verify Now“, Titel LIMITLESS) kannst du **fertige MP4-Dateien** in diesen Ordner legen. Die Seite nutzt sie dann **statt** des langsamen `toCanvas`-Frame-Renderings (also kein 60× Rasterize im Browser) — inkl. **Draft-** und **Panel-Export** über dieselbe `pslObtainOrBakeVideoBlob`-Logik.

## Dateinamen (müssen exakt so heißen)

| Ziel-Profil | Datei | Wann genutzt |
| --- | --- | --- |
| Mobil-UA (alle Handys/Tablets inkl. iPad) | `psl-rating-baseline-v12-720-18f.mp4` | `isMobileUA()` — Export 720p, 18 fps |
| Schmales Desktop-Fenster (≤ 1200 px), kein Mobil-UA | `psl-rating-baseline-v12-720-20f.mp4` | 720p, 20 fps |

**Hinweis:** Breiter Desktop-Export (1080p) hat **keine** vorgebackene Datei; dort bleibt die Live-Pipeline aktiv.

Falls eine Datei **fehlt** (404), fällt die Seite **automatisch** auf die bisherige Live-Bake-Logik zurück — kein Bruch.

## Wie erzeugen

1. Seite in **Genau dem Zustand** öffnen, der oben „Baseline“ ist (z. B. frische Demo, kein Foto, keine Edits in Ratings/Task).
2. Den **PSL-Video-Export** einmal laufen lassen (Browser-Dialog fertigstellen). Die entstandene `limitless-rating-*.mp4` umbenennen in den passenden Dateinamen aus der Tabelle.
3. Datei **hier** ablegen, committen, deployen.

`v12` muss mit dem **Cache-/Pipeline-Version**-Feld in `shield-lock-screen.html` (Konstante `PSL_BAKED_BASELINE_V` / `v` im PSL-Key) übereinstimmen. Nach Layout-/Timing-Änderungen am Phone-3-Export: Version hochziehen, **neu** baken, Dateinamen anpassen.

## Nicht-Default: „Nur Edits“ neu rendern (Roadmap)

Echtes **partielles** Re-Render (feste Intro-/Grid-Animation als statischer Layer, nur Text/Avatar/Scores darüber) würde eine **zweigeteilte DOM-Schicht** erfordern (z. B. Zeitachse: Basis-Frame-Paket + transparenter Text-/Avatar-Layer derselben Dauer) und pro Frame **Compositing** im Canvas. Das ist **nicht** in dieser Version umgesetzt; die MP4s oben sind vollständige Ersatzclips für den **Baseline-Content** — sobald der User etwas ändert, greift die **volle** Live-Pipeline (weiterhin mit IndexedDB-Cache für Wiederholungen).
