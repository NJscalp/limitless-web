import { list, blobConfigured } from './blob-store.mjs'

const BLOB_PATHNAME = 'day-one/arkit-mesh.json'

function productionSiteUrl() {
  const explicit = (process.env.PUBLIC_BASE_URL || '').trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const railway = (process.env.RAILWAY_PUBLIC_DOMAIN || '').trim()
  if (railway) return `https://${railway.replace(/^https?:\/\//, '')}`
  const site = (process.env.SITE_URL || 'http://127.0.0.1:3000').trim()
  return site.replace(/\/$/, '')
}

export async function fetchStoredArkitMeshJson() {
  try {
    if (blobConfigured()) {
      const { blobs } = await list({ prefix: BLOB_PATHNAME, limit: 1 })
      if (blobs.length > 0) {
        const r = await fetch(blobs[0].url, { cache: 'no-store' })
        if (r.ok) return r.json()
      }
    }
  } catch (err) {
    console.warn('arkit-mesh blob read failed', err)
  }

  const staticUrl = `${productionSiteUrl()}/arkit-mesh.json`
  const r = await fetch(staticUrl, { cache: 'no-store' })
  if (!r.ok) {
    const err = new Error('mesh_unavailable')
    err.status = r.status
    throw err
  }
  return r.json()
}

export { BLOB_PATHNAME }
