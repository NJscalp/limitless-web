/**
 * Serves the neutral ARKit face mesh JSON (Blob → static fallback).
 * Replaces the old DigitalOcean proxy.
 */
import { fetchStoredArkitMeshJson } from './_shared/arkit-mesh-store.mjs'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  try {
    const json = await fetchStoredArkitMeshJson()
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(200).send(JSON.stringify(json))
  } catch (err) {
    const status = err?.status === 404 ? 404 : 502
    return res.status(status).json({
      error: 'mesh_unavailable',
      message: String(err?.message || err),
    })
  }
}
