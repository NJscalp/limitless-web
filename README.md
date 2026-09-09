# limitless-web

Das gemeinsame KI-Backend. Vite + React für die statischen Seiten, dazu die
API unter `api/`, die von der Clavic-iOS-App und von clavic-web benutzt wird.

**Läuft auf Railway:** https://clavic-backend-production.up.railway.app
**Einrichtung und Betrieb:** siehe **[RAILWAY.md](./RAILWAY.md)**

Jeder Push auf `main` baut automatisch neu.

## Was die API bedient

Die öffentlichen Pfade stehen in `vercel.json` — die Datei heißt aus
historischen Gründen so, ist aber die Routentabelle für den Server in
`server.mjs`. Wer dort einen Pfad ergänzt, bekommt ihn automatisch.

Grob: Director (Bildlesung, Chat, Trends), Bildbearbeitung über WaveSpeed,
Seedance-Videos, Upscale und Lipsync, Face-Analyse, ARKit-Mesh.

## Clipper-Tools

- **`/`** → leitet auf **`/face-video-tab.html`** (Promo-Video, Download).
- **Tasks videos:** [`/tasks-videos.html`](/tasks-videos.html) — 7 Task-Clips (~1,5–1,6 s) streamen und als MOV herunterladen.
- **`/lookscroll-rating.html`**, **`/focus-marketing-template.html`** und **`/cortisol-marketing-template.html`** leiten auf Tasks videos weiter.
- **Face Rating Template** (`face-muscle-scale.html` + `face-muscle-scale.js`) ist **nicht** mehr öffentlich; vollständiger Snapshot zum Wiederherstellen: **`_archive/face-rating-template/`** (siehe `RESTORE.md` dort).

## Lokal

```bash
npm install
npm run build
BLOB_DIR=/tmp/blob PUBLIC_BASE_URL=http://127.0.0.1:3000 npm start
```

Statische Seiten liegen unter `public/` und werden nach `dist/` kopiert.

## Vorgeschichte

Dieser Dienst lief nacheinander auf einem DigitalOcean-Droplet, dann auf
Vercel, seit dem 09.09.2026 auf Railway. Die alten Anleitungen dazu sind
bewusst entfernt — sie beschrieben Zustände, die es nicht mehr gibt, und wer
sie fand, richtete sich nach dem falschen Ort. In der Git-Historie stehen sie
weiterhin.
