# Migration: DigitalOcean → Vercel

Die **App-API** (Face-Rating, ARKit-Mesh, Kie.ai, TikTok-Proxy) läuft jetzt auf **Vercel** statt auf dem Droplet `104.248.137.75:3000`.

## Was migriert wurde

| Funktion | Vercel-Pfad | Alt (DO) |
|----------|-------------|----------|
| Health | `GET /health` | `GET /health` |
| Face Rating | `POST /v1/face-analyze-full` | gleich |
| Face Refine | `POST /v1/face-refine` | gleich |
| ARKit Mesh lesen | `GET /v1/arkit-mesh.json` | gleich |
| ARKit Mesh Upload | `POST /v1/arkit-mesh` | gleich (→ Vercel Blob) |
| Kie Image-to-Image | `POST /v1/kie/image-to-image` | gleich |
| Kie Task Status | `GET /v1/kie/tasks/:taskId` | gleich |
| TikTok CAPI Test | `POST /v1/tiktok/test-event` | gleich |

**App-Backend-URL:** `https://limitless-web-beryl.vercel.app`

Die iOS-App nutzt dieselben `/v1/...`-Pfade (via `vercel.json` Rewrites).

## Was **nicht** auf Vercel läuft

### Discord-Bot
Der Discord-Bot braucht eine **dauerhafte WebSocket-Verbindung** — das geht nicht auf Vercel Serverless.

Optionen:
1. **Discord deaktivieren** und Droplet abschalten
2. **Nur den Bot** weiter auf DO/Railway/Fly.io laufen lassen (`server/index.mjs` oder später `server/discord-bot.mjs` splitten)

## Schritt 1 — Daten vom Droplet (bereits erledigt)

Das ARKit-Mesh wurde von DO nach `public/arkit-mesh.json` kopiert (~104 KB).

Manuell erneut ausführen:

```bash
cd limitless-web
node scripts/pull-from-droplet.mjs
```

## Schritt 2 — Vercel Environment Variables

In **Vercel → Project → Settings → Environment Variables** eintragen:

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| `ANTHROPIC_API_KEY` | ✅ | Opus-Key (von DO `.env` kopieren) |
| `KIE_API_KEY` | optional | Kie.ai |
| `TIKTOK_ACCESS_TOKEN` | optional | TikTok CAPI |
| `TIKTOK_PIXEL_CODE` | optional | TikTok Pixel |
| `TIKTOK_TEST_EVENT_CODE` | optional | z. B. `TEST12846` |
| `APP_SHARED_SECRET` | optional | Nur wenn App Secret nutzt |
| `MODEL` | optional | Default `claude-opus-4-6` |
| `BLOB_READ_WRITE_TOKEN` | optional | Für ARKit-Mesh-Uploads (Vercel Blob) |
| `SITE_URL` | optional | `https://limitless-web-beryl.vercel.app` |

**Wichtig:** `FACE_BACKEND_URL` auf Vercel **entfernen** oder leer lassen — sonst proxyt die Website noch zum alten Droplet.

## Schritt 3 — Vercel Blob (optional, für Mesh-Uploads)

1. Vercel Dashboard → Storage → **Blob** erstellen
2. `BLOB_READ_WRITE_TOKEN` wird automatisch gesetzt
3. Ohne Blob: statisches `/arkit-mesh.json` aus dem Repo funktioniert weiter

## Schritt 4 — Deploy

```bash
cd limitless-web
npm install
git add -A && git commit -m "Migrate Day One API from DigitalOcean to Vercel"
git push
```

Vercel baut automatisch. Test:

```bash
curl https://limitless-web-beryl.vercel.app/health
```

Erwartung: `"anthropicConfigured": true`, `"platform": "vercel"`.

## Schritt 5 — App testen

1. Xcode: Backend zeigt auf `https://limitless-web-beryl.vercel.app`
2. Face-Tab: Scan → KI-Rating muss funktionieren
3. Optional: ARKit-Mesh-Upload (nur mit Blob)

## Schritt 6 — DigitalOcean abschalten

Erst wenn Health + Face-Rating + Website OK:

```bash
# Auf dem Droplet
sudo systemctl stop day-one-face-api
sudo systemctl disable day-one-face-api
```

Dann Droplet in DigitalOcean **Power Off** oder löschen.

## Checkliste

- [ ] `ANTHROPIC_API_KEY` in Vercel gesetzt
- [ ] `KIE_API_KEY` in Vercel gesetzt (falls Kie genutzt)
- [ ] `FACE_BACKEND_URL` in Vercel **nicht** mehr auf DO
- [ ] Deploy erfolgreich
- [ ] `/health` → `kieConfigured` / `anthropicConfigured` true
- [ ] App Face-Rating getestet
- [ ] Discord-Entscheidung getroffen (abschalten oder separat hosten)
- [ ] DO Droplet gestoppt
