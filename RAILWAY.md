# limitless-web auf Railway

Ersetzt das Vercel-Deployment (`limitless-web-beryl.vercel.app`).

## Was sich geändert hat

| Vorher (Vercel) | Jetzt (Railway) |
|---|---|
| Jede Datei unter `api/` war eine eigene Serverless Function | Ein Node-Prozess, `server.mjs`, der dieselben Pfade bedient |
| `vercel.json` → Rewrites | `server.mjs` **liest dieselbe `vercel.json`** und baut die Routen daraus |
| `@vercel/blob` | `api/_shared/blob-store.mjs` auf einem Railway-Volume, öffentlich unter `/_blob/...` |
| `maxDuration` bis 300 s | Keine Obergrenze mehr |
| Gateway-Limit ~4,5 MB pro Request | 25 MB (die App-seitigen Prüfungen in `_shared/request-limits.mjs` gelten weiter) |

Die Handler selbst sind **unverändert**. Express liefert `req.body`, `req.query`,
`req.headers`, `res.status().json()` und `res.setHeader` mit derselben Bedeutung
wie Vercels Node-Runtime.

`vercel.json` bleibt absichtlich liegen: sie ist jetzt die Routentabelle für
Railway. Wer dort einen Pfad ergänzt, bekommt ihn automatisch — es gibt keine
zweite Liste, die veralten kann.

## Einrichtung

**1. Dienst anlegen**

Railway → New Project → Deploy from GitHub repo → dieses Repo.
Railway findet das `Dockerfile` von selbst.

**2. Volume anhängen** (für die Dateiablage)

Service → Settings → Volumes → Add Volume, Mount path: `/data`

Ohne Volume läuft alles weiter, nur `arkit-mesh-upload` antwortet mit 501 und die
Glow-up-Ausrichtung fällt auf die Original-URL zurück — genau wie vorher ohne
Blob-Token.

**3. Variablen setzen**

Pflicht:

```
ANTHROPIC_API_KEY=sk-ant-...
WAVESPEED_API_KEY=...
FAL_KEY=...
KIE_API_KEY=...
BLOB_DIR=/data/blob
```

`PUBLIC_BASE_URL` musst du **nicht** setzen — Railway liefert
`RAILWAY_PUBLIC_DOMAIN`, und die Ablage baut ihre URLs daraus. Setz es nur, wenn
eine eigene Domain davor liegt.

Optional, gleiche Bedeutung wie vorher: `MODEL`, `DIRECTOR_MODEL`,
`DIRECTOR_VISION_MODEL`, `APP_SHARED_SECRET`, `TIKTOK_ACCESS_TOKEN`,
`TIKTOK_PIXEL_CODE`, sämtliche `FUTURE_SELF_*`-Stellschrauben.

Nicht mehr nötig: `BLOB_READ_WRITE_TOKEN`, `VERCEL_*`.

**4. Prüfen**

```bash
curl https://<dein-service>.up.railway.app/health
```

Erwartet: `"platform":"railway"`, und `wavespeedConfigured`, `falConfigured`,
`kieConfigured`, `anthropicConfigured` alle `true`. `blobConfigured` ist `true`,
sobald das Volume hängt.

## Umschalten

Drei Stellen zeigen auf die alte Vercel-URL. Alle drei müssen umgestellt sein,
**bevor** das Vercel-Projekt abgeschaltet wird:

1. `Clavic/Clavic/SeedanceAPI.swift:19` — `baseURL`. Braucht einen App-Release.
2. `clavic-web/lib/backend.ts:4` — Rückfallwert, bzw. `CLAVIC_BACKEND` in Railway setzen.
3. `SITE_URL` in den Variablen dieses Dienstes.

**Zur iOS-App:** Die URL ist fest einkompiliert. Jede installierte Kopie ohne
Update spricht weiter mit Vercel. Wird Vercel abgeschaltet, brechen diese
Installationen sofort — jede Generierung schlägt fehl. Das ist die bewusste
Entscheidung für den harten Umzug; wer das später doch abfedern will, lässt das
Vercel-Projekt als reine Weiterleitung stehen (kostet auf dem Gratis-Tarif
nichts).

## Lokal starten

```bash
npm install
npm run build
BLOB_DIR=/tmp/blob PUBLIC_BASE_URL=http://127.0.0.1:3000 npm start
```
