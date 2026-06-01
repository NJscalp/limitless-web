import { put } from '@vercel/blob'
import { isAuthorized, rejectUnauthorized } from './_shared/auth.mjs'
import { BLOB_PATHNAME } from './_shared/arkit-mesh-store.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!isAuthorized(req)) return rejectUnauthorized(res)

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  if (
    !body ||
    !Array.isArray(body.vertices) ||
    !Array.isArray(body.triangles) ||
    body.vertices.length < 9 ||
    body.triangles.length < 3
  ) {
    return res.status(400).json({ error: 'invalid_mesh_payload' })
  }

  const clean = {
    vertexCount: Number(body.vertexCount) || body.vertices.length / 3,
    triangleCount: Number(body.triangleCount) || body.triangles.length / 3,
    vertices: body.vertices,
    triangles: body.triangles,
    uploadedAt: new Date().toISOString(),
  }

  const token = (process.env.BLOB_READ_WRITE_TOKEN || '').trim()
  if (!token) {
    return res.status(501).json({
      error: 'blob_not_configured',
      hint: 'Enable Vercel Blob and set BLOB_READ_WRITE_TOKEN. Static mesh at /arkit-mesh.json still works.',
    })
  }

  try {
    const blob = await put(BLOB_PATHNAME, JSON.stringify(clean), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      token,
    })
    return res.status(200).json({
      ok: true,
      vertexCount: clean.vertexCount,
      triangleCount: clean.triangleCount,
      url: blob.url,
    })
  } catch (err) {
    console.error('arkit-mesh upload', err)
    return res.status(500).json({ error: 'upload_failed', message: String(err?.message || err) })
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
