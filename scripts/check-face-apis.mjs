#!/usr/bin/env node
/**
 * Prüft die Vercel-API-Routen /api/face-landmarks und /api/face-analyze.
 *
 * Usage:
 *   BASE_URL=https://dein-projekt.vercel.app node scripts/check-face-apis.mjs
 *   node scripts/check-face-apis.mjs https://dein-projekt.vercel.app
 *
 * Lokal nur mit `npx vercel dev` (Vite allein hat keine /api/*-Routes).
 */

const baseArg = process.env.BASE_URL || process.argv[2]
if (!baseArg) {
  console.error('Fehlt: Basis-URL.\n  BASE_URL=https://….vercel.app node scripts/check-face-apis.mjs')
  process.exit(1)
}

const base = String(baseArg).replace(/\/$/, '')

/** Minimal gültiges JPEG (1×1 Pixel) als Base64 — reicht zum Durchreichen an Upstream. */
const TINY_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDAQICAgICAgMDAwMEBAMFBQQFBQUGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k='

function ok(msg) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`)
}

function warn(msg) {
  console.log(`\x1b[33m⚠\x1b[0m ${msg}`)
}

function bad(msg) {
  console.log(`\x1b[31m✗\x1b[0m ${msg}`)
}

function looksLikeVisionOverlay(data) {
  if (!data || typeof data !== 'object') return false
  const r = data.faceRect
  if (!r || typeof r.x !== 'number' || typeof r.foreheadCenter === 'undefined') return false
  if (!Array.isArray(data.contours)) return false
  return true
}

async function main() {
  console.log(`Basis: ${base}\n`)

  // --- /api/face-landmarks ---
  try {
    const r = await fetch(`${base}/api/face-landmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: TINY_JPEG_B64,
        displayWidth: 260,
        displayHeight: 340,
      }),
    })
    const text = await r.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }

    if (r.status === 501) {
      warn(
        'POST /api/face-landmarks → 501 (Vision nicht angebunden). TensorFlow.js im Browser wird genutzt — 1:1 wie die iOS-App nur mit FACE_LANDMARKS_URL.',
      )
      if (data?.hint) console.log(`     ${data.hint}`)
    } else if (r.status === 200 && looksLikeVisionOverlay(data)) {
      ok('POST /api/face-landmarks → 200, JSON passt zu parseVisionOverlayPayload (App-Parität möglich).')
    } else if (r.status === 200) {
      warn('POST /api/face-landmarks → 200, aber JSON fehlt faceRect/foreheadCenter/contours — Backend prüfen.')
      console.log('     Antwort:', text.slice(0, 400))
    } else if (r.status === 401) {
      bad('POST /api/face-landmarks → 401 — Bearer/Secret (FACE_LANDMARKS_SECRET / FACE_BACKEND_SECRET) stimmt nicht.')
    } else if (r.status === 502) {
      bad('POST /api/face-landmarks → 502 — Upstream unter FACE_LANDMARKS_URL nicht erreichbar oder Fehler.')
      console.log('     ', text.slice(0, 300))
    } else {
      warn(`POST /api/face-landmarks → HTTP ${r.status}`)
      console.log('     ', text.slice(0, 400))
    }
  } catch (e) {
    bad(`POST /api/face-landmarks — Netzwerkfehler: ${e.message}`)
  }

  // --- /api/face-analyze (KI-Scores) ---
  try {
    const r = await fetch(`${base}/api/face-analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: TINY_JPEG_B64 }),
    })
    const text = await r.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }

    if (r.status === 501) {
      warn('POST /api/face-analyze → 501 — FACE_BACKEND_URL in Vercel fehlt (Demo-Scores im Frontend).')
      if (data?.hint) console.log(`     ${data.hint}`)
    } else if (r.status === 401) {
      bad('POST /api/face-analyze → 401 — FACE_BACKEND_SECRET passt nicht zum Server.')
    } else if (r.status >= 200 && r.status < 300) {
      ok(`POST /api/face-analyze → ${r.status} (Backend erreichbar).`)
    } else {
      warn(`POST /api/face-analyze → HTTP ${r.status}`)
      console.log('     ', text.slice(0, 300))
    }
  } catch (e) {
    bad(`POST /api/face-analyze — Netzwerkfehler: ${e.message}`)
  }

  console.log(
    '\nHinweis: Echte 1:1-Overlay-Daten wie in der App brauchen einen Dienst, der dieselbe Logik wie iOS `detectFaceForOverlay` liefert (Apple Vision), und in Vercel FACE_LANDMARKS_URL auf diese URL zeigt.',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
