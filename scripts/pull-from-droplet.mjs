#!/usr/bin/env node
/**
 * Pulls static assets from the legacy DigitalOcean droplet into limitless-web.
 * Usage: node scripts/pull-from-droplet.mjs [baseUrl]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const BASE = (process.argv[2] || 'http://104.248.137.75:3000').replace(/\/$/, '')

async function pull(name, urlPath, outRel) {
  const url = `${BASE}${urlPath}`
  console.log(`Fetching ${url} …`)
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`)
  const text = await r.text()
  const out = path.join(ROOT, outRel)
  fs.writeFileSync(out, text)
  console.log(`  → ${outRel} (${text.length} bytes)`)
}

async function main() {
  await pull('arkit-mesh', '/v1/arkit-mesh.json', 'public/arkit-mesh.json')
  const health = await fetch(`${BASE}/health`).then((r) => r.json())
  console.log('Health:', health)
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
