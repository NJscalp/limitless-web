# Limitless Web (Clipper / Demo)

Vite + React. Deploy auf **Vercel**, Code auf **GitHub**.

## Clipper-Tools (nach Deploy)

- **`/`** → leitet auf **`/face-video-tab.html`** (Promo-Video, Download).
- **Tasks videos:** [`/tasks-videos.html`](/tasks-videos.html) — 7 Task-Clips (~1,5–1,6 s) streamen und als MOV herunterladen.
- **`/lookscroll-rating.html`**, **`/focus-marketing-template.html`** und **`/cortisol-marketing-template.html`** leiten auf Tasks videos weiter.
- **Face Rating Template** (`face-muscle-scale.html` + `face-muscle-scale.js`) ist **nicht** mehr öffentlich; vollständiger Snapshot zum Wiederherstellen: **`_archive/face-rating-template/`** (siehe `RESTORE.md` dort).

## Lokal

```bash
npm install
npm run build
npm run dev
```

Statische Seiten liegen unter `public/` und werden nach `dist/` kopiert (z. B. `face-video-tab.html`, `media/`).

## Deployment

Siehe **[DEPLOY_SCHRITTE.md](./DEPLOY_SCHRITTE.md)** (Schritt-für-Schritt auf Deutsch).

Für **KI-Scores wie in der App**: in Vercel **`ANTHROPIC_API_KEY`** setzen (direkt Anthropic, kein Droplet mehr).

Migration von DigitalOcean: siehe **[MIGRATION_VERCEL.md](./MIGRATION_VERCEL.md)**.
