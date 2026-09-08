// Dateiablage auf Railway — Ersatz für Vercel Blob.
//
// Vercel Blob gibt es außerhalb von Vercel nicht. Gebraucht wird davon aber nur
// sehr wenig: eine Datei ablegen und eine öffentlich erreichbare https-URL
// zurückbekommen. Genau das macht diese Datei, mit einem Railway-Volume als
// Ablage und `/_blob/...` als öffentlichem Pfad (siehe `server.mjs`).
//
// Die Signaturen sind absichtlich identisch zu `put` und `list` aus
// `@vercel/blob`, damit an den Aufrufstellen nur der Import wechselt.
//
// WARUM ÖFFENTLICH ERREICHBAR: Die abgelegten Bilder werden nicht nur von der
// App geladen, sondern teilweise als URL an fremde Bild-APIs weitergereicht.
// Eine Datei, die nur der Server selbst lesen kann, wäre dort wertlos.

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import path from 'node:path'

const BLOB_DIR = (process.env.BLOB_DIR || '/data/blob').trim()

/**
 * Die öffentliche Adresse dieses Dienstes.
 *
 * Railway setzt `RAILWAY_PUBLIC_DOMAIN` selbst. `PUBLIC_BASE_URL` gewinnt
 * trotzdem, damit eine eigene Domain davor gesetzt werden kann, ohne hier
 * etwas zu ändern.
 */
function publicBaseUrl() {
  const explicit = (process.env.PUBLIC_BASE_URL || '').trim()
  if (explicit) return explicit.replace(/\/$/, '')

  const railway = (process.env.RAILWAY_PUBLIC_DOMAIN || '').trim()
  if (railway) return `https://${railway.replace(/^https?:\/\//, '')}`

  const site = (process.env.SITE_URL || '').trim()
  if (site) return site.replace(/\/$/, '')

  return ''
}

/**
 * Ist die Ablage nutzbar?
 *
 * Auf Vercel hing das an `BLOB_READ_WRITE_TOKEN`. Hier braucht es zwei Dinge:
 * einen beschreibbaren Ordner und eine öffentliche Adresse — ohne die zweite
 * wäre die zurückgegebene URL für niemanden erreichbar.
 */
export function blobConfigured() {
  if (!publicBaseUrl()) return false
  try {
    fsSync.mkdirSync(BLOB_DIR, { recursive: true })
    fsSync.accessSync(BLOB_DIR, fsSync.constants.W_OK)
    return true
  } catch {
    return false
  }
}

/** Verhindert, dass ein Pfad aus der Ablage herausführt. */
function safeJoin(pathname) {
  const clean = String(pathname || '')
    .replace(/^\/+/, '')
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/')
  if (!clean) throw new Error('blob_invalid_pathname')
  return { relative: clean, absolute: path.join(BLOB_DIR, clean) }
}

function withRandomSuffix(pathname) {
  const ext = path.extname(pathname)
  const base = ext ? pathname.slice(0, -ext.length) : pathname
  return `${base}-${crypto.randomBytes(8).toString('hex')}${ext}`
}

/**
 * Legt eine Datei ab und gibt ihre öffentliche URL zurück.
 *
 * @param {string} pathname Zielpfad, z. B. `glow-up/aligned/1024x1024-123.jpg`
 * @param {Buffer|Uint8Array|string} data
 * @param {{ addRandomSuffix?: boolean, allowOverwrite?: boolean, contentType?: string }} [options]
 * @returns {Promise<{ url: string, pathname: string, size: number, uploadedAt: string }>}
 */
export async function put(pathname, data, options = {}) {
  const base = publicBaseUrl()
  if (!base) throw new Error('blob_public_url_missing')

  const target = options.addRandomSuffix ? withRandomSuffix(pathname) : pathname
  const { relative, absolute } = safeJoin(target)

  if (!options.allowOverwrite && !options.addRandomSuffix) {
    try {
      await fs.access(absolute)
      throw new Error('blob_already_exists')
    } catch (err) {
      if (err?.message === 'blob_already_exists') throw err
      // sonst: Datei gibt es nicht — genau das ist der gewünschte Fall
    }
  }

  await fs.mkdir(path.dirname(absolute), { recursive: true })
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data)
  await fs.writeFile(absolute, payload)

  return {
    url: `${base}/_blob/${relative}`,
    pathname: relative,
    size: payload.length,
    uploadedAt: new Date().toISOString(),
  }
}

/**
 * Listet abgelegte Dateien, neueste zuerst.
 *
 * @param {{ prefix?: string, limit?: number }} [options]
 * @returns {Promise<{ blobs: Array<{ url: string, pathname: string, size: number, uploadedAt: string }> }>}
 */
export async function list(options = {}) {
  const base = publicBaseUrl()
  if (!base) return { blobs: [] }

  const prefix = String(options.prefix || '').replace(/^\/+/, '')
  const limit = Number(options.limit) > 0 ? Number(options.limit) : 1000
  const found = []

  async function walk(dir, relative) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), rel)
        continue
      }
      if (prefix && !rel.startsWith(prefix)) continue
      try {
        const stat = await fs.stat(path.join(dir, entry.name))
        found.push({
          url: `${base}/_blob/${rel}`,
          pathname: rel,
          size: stat.size,
          uploadedAt: stat.mtime.toISOString(),
        })
      } catch {
        // Datei ist zwischen readdir und stat verschwunden — überspringen
      }
    }
  }

  await walk(BLOB_DIR, '')
  found.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
  return { blobs: found.slice(0, limit) }
}
