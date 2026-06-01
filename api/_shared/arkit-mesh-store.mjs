import { list } from '@vercel/blob'

const BLOB_PATHNAME = 'day-one/arkit-mesh.json'

function productionSiteUrl() {
  const prod = (process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim()
  if (prod) return `https://${prod.replace(/^https?:\/\//, '')}`
  const site = (process.env.SITE_URL || 'https://limitless-web-beryl.vercel.app').trim()
  return site.replace(/\/$/, '')
}

export async function fetchStoredArkitMeshJson() {
  try {
    const token = (process.env.BLOB_READ_WRITE_TOKEN || '').trim()
    if (token) {
      const { blobs } = await list({ prefix: BLOB_PATHNAME, limit: 1, token })
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
