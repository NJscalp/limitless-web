// Railway-Server für limitless-web.
//
// Auf Vercel war jede Datei unter `api/` eine eigene Serverless Function, und
// `vercel.json` hat die öffentlichen `/v1/...`-Pfade darauf umgeschrieben.
// Railway hat das nicht — dort läuft EIN Node-Prozess. Diese Datei stellt
// dieselbe Oberfläche her:
//
//   • Die Rewrites werden zur Laufzeit aus `vercel.json` gelesen, damit es nur
//     EINE Quelle für die Routen gibt. Wer dort einen Pfad ergänzt, bekommt ihn
//     hier automatisch — es gibt keine zweite Liste, die veralten kann.
//   • Dynamische Dateien (`[action].mjs`, `[taskId].mjs`) werden aufgelöst wie
//     bei Vercel, und der Wert landet in `req.query`, weil die Handler ihn
//     genau dort erwarten.
//   • Die Handler bleiben unverändert: Express liefert `req.body`, `req.query`,
//     `req.headers`, `res.status().json()` und `res.setHeader` mit derselben
//     Bedeutung wie die Node-Runtime von Vercel.
//
// Der Body-Grenzwert ist bewusst großzügig: auf Vercel war bei ~4,5 MB das
// Gateway die Grenze, nicht die Anwendung — genau daran sind große Uploads mit
// einem 413 gestorben. Auf Railway gibt es dieses Gateway nicht mehr.

import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API_DIR = path.join(__dirname, 'api')
const DIST_DIR = path.join(__dirname, 'dist')
const PUBLIC_DIR = path.join(__dirname, 'public')

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', true)

// 25 MB: deckt den größten Fall (vier hochauflösende Referenzbilder als Base64)
// mit Reserve ab. Der eigentliche Schutz sind die Prüfungen in
// `api/_shared/request-limits.mjs` — die geben dem Client eine verständliche
// Meldung, während ein Gateway-Fehler nur „doesn't work" bedeutet hätte.
app.use(express.json({ limit: '25mb' }))
app.use(express.urlencoded({ extended: true, limit: '25mb' }))

// ---------------------------------------------------------------------------
// Handler-Auflösung
// ---------------------------------------------------------------------------

/**
 * Findet zu einem Vercel-Zielpfad die Handler-Datei.
 *
 * `/api/gpt-image/director` gibt es als Datei nicht — bei Vercel greift dort
 * `api/gpt-image/[action].mjs` mit `action = "director"`. Diese Funktion macht
 * dieselbe Auflösung: erst die exakte Datei, sonst die eckige Klammer.
 *
 * @param {string[]} segments Pfadsegmente ohne führendes `api`
 * @returns {{ file: string, params: Record<string,string> } | null}
 */
function resolveHandlerFile(segments) {
  let dir = API_DIR
  const params = {}

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const isLast = i === segments.length - 1

    if (isLast) {
      const exact = path.join(dir, `${segment}.mjs`)
      if (fs.existsSync(exact)) return { file: exact, params }

      // Keine exakte Datei → dynamische Datei im selben Ordner suchen.
      const dynamic = findDynamicFile(dir)
      if (dynamic) {
        params[dynamic.name] = segment
        return { file: dynamic.file, params }
      }
      return null
    }

    const nextDir = path.join(dir, segment)
    if (fs.existsSync(nextDir) && fs.statSync(nextDir).isDirectory()) {
      dir = nextDir
      continue
    }
    return null
  }
  return null
}

/** Sucht `[name].mjs` in einem Ordner. */
function findDynamicFile(dir) {
  if (!fs.existsSync(dir)) return null
  for (const entry of fs.readdirSync(dir)) {
    const match = /^\[(.+)\]\.mjs$/.exec(entry)
    if (match) return { name: match[1], file: path.join(dir, entry) }
  }
  return null
}

/** Lädt einen Handler einmal und merkt ihn sich. */
const handlerCache = new Map()
async function loadHandler(file) {
  if (handlerCache.has(file)) return handlerCache.get(file)
  const mod = await import(pathToFileURL(file).href)
  const handler = mod.default
  if (typeof handler !== 'function') {
    throw new Error(`Handler ohne default export: ${file}`)
  }
  handlerCache.set(file, handler)
  return handler
}

/**
 * Führt den Handler aus, der zu `destination` gehört.
 *
 * `destination` darf `:param`-Platzhalter enthalten (aus den Rewrites). Deren
 * Werte kommen aus `req.params` und wandern zusätzlich nach `req.query`, weil
 * die Handler sie dort lesen.
 */
function dispatch(destination) {
  return async (req, res, next) => {
    try {
      const rawSegments = destination.replace(/^\/+/, '').split('/')
      if (rawSegments[0] !== 'api') return next()

      const segments = []
      for (const segment of rawSegments.slice(1)) {
        if (segment.startsWith(':')) {
          const name = segment.slice(1)
          const value = req.params[name]
          if (value == null) return next()
          req.query[name] = value
          segments.push(String(value))
        } else {
          segments.push(segment)
        }
      }

      const resolved = resolveHandlerFile(segments)
      if (!resolved) return next()

      // Der Wert aus der eckigen Klammer muss in `req.query` stehen — genau so
      // liest ihn jeder Handler (`req.query?.action`).
      for (const [name, value] of Object.entries(resolved.params)) {
        if (req.query[name] == null) req.query[name] = value
      }

      const handler = await loadHandler(resolved.file)
      await handler(req, res)
    } catch (err) {
      console.error('handler error', destination, err)
      if (!res.headersSent) {
        res.status(500).json({ error: 'server_error', message: String(err?.message || err) })
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Routen aus vercel.json
// ---------------------------------------------------------------------------

function loadRewrites() {
  const file = path.join(__dirname, 'vercel.json')
  if (!fs.existsSync(file)) return []
  try {
    const config = JSON.parse(fs.readFileSync(file, 'utf8'))
    return Array.isArray(config.rewrites) ? config.rewrites : []
  } catch (err) {
    console.error('vercel.json nicht lesbar', err)
    return []
  }
}

const rewrites = loadRewrites()
for (const rewrite of rewrites) {
  if (!rewrite?.source || !rewrite?.destination) continue
  app.all(rewrite.source, dispatch(rewrite.destination))
}
console.log(`[routes] ${rewrites.length} Rewrites aus vercel.json übernommen`)

// Direktzugriff auf `/api/...` — auf Vercel ging das ohne Rewrite, also hier
// auch. Sonst brechen Aufrufe, die den internen Pfad benutzen.
app.all(/^\/api\/(.+)$/, (req, res, next) => {
  const suffix = req.params[0]
  return dispatch(`/api/${suffix}`)(req, res, next)
})

// ---------------------------------------------------------------------------
// Dateiablage (Ersatz für Vercel Blob)
// ---------------------------------------------------------------------------

// Der Ordner wird hier ANGELEGT, nicht nur geprüft. Das Volume bringt nur
// `/data` mit; `/data/blob` entsteht sonst erst beim ersten Schreibzugriff —
// also nach dem Start. Eine Prüfung allein hätte die Auslieferung dauerhaft
// übersprungen, und abgelegte Dateien wären trotz erfolgreichem Upload mit 404
// beantwortet worden.
const BLOB_DIR = (process.env.BLOB_DIR || '/data/blob').trim()
try {
  fs.mkdirSync(BLOB_DIR, { recursive: true })
  app.use('/_blob', express.static(BLOB_DIR, { maxAge: '1h', fallthrough: false }))
  console.log(`[blob] Ablage unter ${BLOB_DIR}, öffentlich als /_blob`)
} catch (err) {
  // Kein beschreibbarer Ort → die Aufrufer prüfen `blobConfigured()` und
  // greifen auf ihre Rückfallwege zurück. Kein Grund, den Dienst zu stoppen.
  console.log(`[blob] ${BLOB_DIR} nicht nutzbar (${String(err?.message || err)}) — Ablage deaktiviert`)
}

// ---------------------------------------------------------------------------
// Statische Dateien und SPA
// ---------------------------------------------------------------------------

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { maxAge: '1h', index: false }))
} else if (fs.existsSync(PUBLIC_DIR)) {
  // Ohne Build wenigstens die statischen Dateien ausliefern — `arkit-mesh.json`
  // ist der Rückfallweg, wenn die Ablage nichts hergibt.
  app.use(express.static(PUBLIC_DIR, { maxAge: '1h', index: false }))
}

app.get(/^\/(?!api\/|_blob\/).*/, (req, res, next) => {
  const indexFile = path.join(DIST_DIR, 'index.html')
  if (fs.existsSync(indexFile)) return res.sendFile(indexFile)
  return next()
})

app.use((req, res) => {
  res.status(404).json({ error: 'not_found', path: req.path })
})

const port = Number(process.env.PORT || 3000)
app.listen(port, '0.0.0.0', () => {
  console.log(`[server] limitless-web hört auf :${port}`)
})
