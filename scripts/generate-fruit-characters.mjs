// Generiert die 10 festen "AI Fruit Story"-Charakter-Referenzbilder (+ Preview-
// Kachel) über das LIVE-Backend (GPT Image 2 via kie) und legt sie direkt als
// PNGs in den Clavic-Asset-Katalog. Einmal ausführen – danach hat das
// Fruit-Story-Template die volle Charakter-Auswahl wie bei Zyvo.
//
// Nutzung:
//   APP_SHARED_SECRET=<dein-secret> node scripts/generate-fruit-characters.mjs
//
// Optional:
//   FRUIT_BACKEND_BASE   (Default: https://limitless-web-beryl.vercel.app)
//   FRUIT_ASSETS_DIR     (Default: ../../Clavic/Clavic/Clavic/Assets.xcassets)
//   FRUIT_QUALITY        1K|2K (Default: 2K – schärfere Referenzen)
//
// Hinweis: verbraucht kie-Credits (GPT Image 2). 11 Bilder ≈ wenige Cent.

import { writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))

const BASE = (process.env.FRUIT_BACKEND_BASE || 'https://limitless-web-beryl.vercel.app').replace(/\/$/, '')
const SECRET = (process.env.APP_SHARED_SECRET || process.env.DAYONE_BACKEND_SECRET || '').trim()
const QUALITY = (process.env.FRUIT_QUALITY || '1K').trim()
const CONCURRENCY = Math.max(1, Number(process.env.FRUIT_CONCURRENCY) || 4)
const ASSETS_DIR = process.env.FRUIT_ASSETS_DIR
  || path.resolve(process.env.HOME || '', 'Desktop/Clavic/Clavic/Clavic/Assets.xcassets')

// 1024×1024 graue Leinwand als Seed (GPT Image 2 ist image-to-image; wir malen
// die Figur auf die leere Leinwand – das ist ein harmloser Edit, den die
// OpenAI-Moderation akzeptiert, anders als „ignore the input image").
const SEED_PNG_B64 = (await readFile(path.join(SCRIPT_DIR, 'seed-gray.png'))).toString('base64')

const STYLE = 'Wholesome family-friendly Pixar-style 3D cartoon render, polished and glossy, big cute expressive face, standing upright facing the camera, centered full-body, on a plain light-gray studio background, soft studio lighting, no text, no watermark, no logo.'

// asset = Name der .imageset (ohne Endung), prompt = Charakterbeschreibung.
const CHARACTERS = [
  { asset: 'fruit_char_orangemom',     who: 'a warm, motherly adult anthropomorphic ORANGE character (a round orange as the head/body), caring expressive eyes, simple casual outfit' },
  { asset: 'fruit_char_banana',        who: 'a sly adult male anthropomorphic BANANA character (a banana body), confident smug expression, casual jacket' },
  { asset: 'fruit_char_strawberrymom', who: 'an emotional adult anthropomorphic STRAWBERRY character (a strawberry as head/body), sweet expressive face, casual dress' },
  { asset: 'fruit_char_hotpeach',      who: 'a stylish, popular adult anthropomorphic PEACH character (a peach as head/body), trendy attractive look, fashionable modern outfit' },
  { asset: 'fruit_char_bossmango',     who: 'an authoritative adult anthropomorphic MANGO character (a mango as head/body), serious boss vibe, neat business suit' },
  { asset: 'fruit_char_ananasgirl',    who: 'a stylish adult anthropomorphic PINEAPPLE character (a pineapple as head/body with green leaf crown), fashionable trendy outfit' },
  { asset: 'fruit_char_appleson',      who: 'a young teenage anthropomorphic APPLE character (a red apple as head/body), friendly cheerful face, casual hoodie' },
  { asset: 'fruit_char_lemonkid',      who: 'a cute small anthropomorphic LEMON CHILD character (a lemon as head/body), big adorable eyes, child proportions' },
  { asset: 'fruit_char_orangekid',     who: 'a cute innocent small anthropomorphic ORANGE CHILD character (an orange as head/body), big adorable eyes, child proportions' },
  { asset: 'fruit_char_brokkoliboss',  who: 'a funny but strict adult anthropomorphic BROCCOLI character (a broccoli as head/body), stern boss expression, simple shirt' },
]

const PREVIEW = {
  asset: 'preview_fruit_story',
  ratio: '9:16',
  prompt: `${STYLE} Cinematic vertical 9:16 dramatic scene: a glossy 3D anthropomorphic orange-mom fruit character confronting a banana fruit character indoors, strong emotional expressions, premium short-form drama lighting. No text, no captions.`,
}

function authHeaders() {
  const h = { 'Content-Type': 'application/json' }
  if (SECRET) h.Authorization = `Bearer ${SECRET}`
  return h
}

async function submit(prompt, ratio) {
  const r = await fetch(`${BASE}/v1/gpt-image/edit`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      prompt: `Paint a clean, wholesome character illustration onto this plain light-gray studio canvas: ${prompt}`,
      images: [SEED_PNG_B64],
      resolution: QUALITY,
      aspectRatio: ratio,
      provider: 'kie',
    }),
  })
  const j = await r.json().catch(() => ({}))
  const taskId = j?.data?.taskId || j?.data?.task_id
  if (!r.ok || !taskId) throw new Error(`submit failed (${r.status}): ${JSON.stringify(j).slice(0, 200)}`)
  return taskId
}

async function poll(taskId) {
  const deadline = Date.now() + 600_000
  while (Date.now() < deadline) {
    await new Promise((res) => setTimeout(res, 5000))
    const r = await fetch(`${BASE}/v1/gpt-image/status`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ taskId, provider: 'kie' }),
    })
    const j = await r.json().catch(() => ({}))
    const d = j?.data || {}
    const state = String(d.state || '').toLowerCase()
    if (state === 'succeeded') {
      if (d.imageUrl) return d.imageUrl
      throw new Error('no image url in result')
    }
    if (state === 'failed') throw new Error(d.failMsg || 'generation failed')
  }
  throw new Error('timed out')
}

async function generate(asset, prompt, ratio) {
  const dir = path.join(ASSETS_DIR, `${asset}.imageset`)
  if (!existsSync(dir)) throw new Error(`missing imageset folder: ${dir}`)
  process.stdout.write(`• ${asset} … `)
  const taskId = await submit(prompt, ratio)
  const url = await poll(taskId)
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(path.join(dir, `${asset}.png`), buf)
  console.log(`done (${(buf.length / 1024).toFixed(0)} KB)`)
}

// GPT-Image-2-Moderation kann sporadisch zuschlagen → bis zu 3 Versuche.
async function withRetry(asset, fn, attempts = 3) {
  for (let i = 1; i <= attempts; i += 1) {
    try { await fn(); return }
    catch (e) {
      const last = i === attempts
      console.log(`  ${asset} attempt ${i}/${attempts} failed: ${e.message}${last ? ' — GIVING UP' : ' — retrying'}`)
      if (!last) await new Promise((r) => setTimeout(r, 2000))
    }
  }
}

async function main() {
  console.log(`Backend: ${BASE}`)
  console.log(`Assets:  ${ASSETS_DIR}`)
  if (!SECRET) console.log('⚠️  APP_SHARED_SECRET not set – sending unauthenticated (only works if the backend has no secret).')
  // Alle Jobs (Charaktere + Preview) parallel in einem Pool mit fester Breite.
  const jobs = [
    ...CHARACTERS.map((c) => ({ asset: c.asset, run: () => generate(c.asset, `${c.who}. ${STYLE}`, '1:1') })),
    { asset: PREVIEW.asset, run: () => generate(PREVIEW.asset, PREVIEW.prompt, PREVIEW.ratio) },
  ]
  console.log(`Generating ${jobs.length} images, ${CONCURRENCY} at a time, quality ${QUALITY}…`)
  let next = 0
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++]
      await withRetry(job.asset, job.run)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log('\nDone. Open Xcode (the asset catalog refreshes automatically) and the Fruit Story cast will show real characters.')
}

main()
