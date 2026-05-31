import crypto from 'node:crypto'

const CACHE_TTL_MS = 1000 * 60 * 60 * 24
const CACHE = globalThis.__pslRenderCache || (globalThis.__pslRenderCache = new Map())

export default async function handler(req, res) {
  try {
    if (req.method === 'GET' && String(req.query?.mode || '') === 'download') {
      return await proxyRenderedDownload(req, res)
    }
    if (req.method === 'POST') return await createRenderJob(req, res)
    if (req.method === 'GET') return await getRenderJobStatus(req, res)
    res.setHeader('Allow', 'POST, GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (e) {
    console.error('render-psl-video', e)
    return res.status(500).json({ error: 'internal_error', message: String(e?.message || e) })
  }
}

async function createRenderJob(req, res) {
  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {})
  const template = body?.template || {}
  const renderKey = (body?.renderKey && String(body.renderKey).trim()) || computeRenderKey(template)
  pruneCache()

  const cached = CACHE.get(renderKey)
  if (cached && cached.expiresAt > Date.now()) {
    return res.status(200).json({
      status: 'completed',
      source: 'cache',
      renderKey,
      downloadUrl: cached.downloadUrl,
      downloadProxyUrl: buildProxyDownloadUrl({ renderKey, filename: 'limitless-rating.mp4' }),
      mimeType: cached.mimeType || 'video/mp4',
    })
  }

  const backendBase = (process.env.PSL_RENDER_BACKEND_URL || '').replace(/\/$/, '')
  if (!backendBase) {
    return res.status(501).json({
      status: 'failed',
      error: 'render_backend_not_configured',
      message: 'Set PSL_RENDER_BACKEND_URL to an FFmpeg/renderer backend.',
    })
  }

  const headers = { 'Content-Type': 'application/json' }
  const secret = (process.env.PSL_RENDER_BACKEND_SECRET || '').trim()
  if (secret) headers.Authorization = `Bearer ${secret}`

  const createPath = process.env.PSL_RENDER_CREATE_PATH || '/v1/psl-video/render'
  const payload = {
    renderKey,
    template,
    output: {
      format: 'mp4',
      width: template?.export?.width || 648,
      height: template?.export?.height || 1152,
      fps: template?.export?.fps || 16,
      durationMs: template?.export?.durationMs || 3500,
    },
  }

  const rr = await fetch(`${backendBase}${createPath}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  const data = await rr.json().catch(() => ({}))
  if (!rr.ok) {
    return res.status(502).json({
      status: 'failed',
      error: 'backend_create_failed',
      detail: data,
    })
  }

  const normalized = normalizeRemoteRenderResponse(data)
  if (normalized.status === 'completed' && normalized.downloadUrl) {
    CACHE.set(renderKey, {
      downloadUrl: normalized.downloadUrl,
      mimeType: normalized.mimeType || 'video/mp4',
      expiresAt: Date.now() + CACHE_TTL_MS,
    })
  }

  return res.status(200).json({
    status: normalized.status,
    renderKey,
    remoteJobId: normalized.remoteJobId || null,
    downloadUrl: normalized.downloadUrl || null,
    downloadProxyUrl: normalized.downloadUrl
      ? buildProxyDownloadUrl({ renderKey, remoteJobId: normalized.remoteJobId || null, filename: 'limitless-rating.mp4' })
      : null,
    mimeType: normalized.mimeType || null,
  })
}

async function getRenderJobStatus(req, res) {
  pruneCache()
  const renderKey = String(req.query?.renderKey || '').trim()
  if (renderKey) {
    const cached = CACHE.get(renderKey)
    if (cached && cached.expiresAt > Date.now()) {
      return res.status(200).json({
        status: 'completed',
        renderKey,
        source: 'cache',
        downloadUrl: cached.downloadUrl,
        downloadProxyUrl: buildProxyDownloadUrl({ renderKey, filename: 'limitless-rating.mp4' }),
        mimeType: cached.mimeType || 'video/mp4',
      })
    }
  }

  const remoteJobId = String(req.query?.remoteJobId || '').trim()
  if (!remoteJobId) {
    return res.status(400).json({ error: 'missing_remoteJobId_or_renderKey' })
  }

  const backendBase = (process.env.PSL_RENDER_BACKEND_URL || '').replace(/\/$/, '')
  if (!backendBase) {
    return res.status(501).json({
      status: 'failed',
      error: 'render_backend_not_configured',
      message: 'Set PSL_RENDER_BACKEND_URL to an FFmpeg/renderer backend.',
    })
  }

  const headers = {}
  const secret = (process.env.PSL_RENDER_BACKEND_SECRET || '').trim()
  if (secret) headers.Authorization = `Bearer ${secret}`

  const statusTpl = process.env.PSL_RENDER_STATUS_PATH || '/v1/psl-video/render/:jobId'
  const statusPath = statusTpl.replace(':jobId', encodeURIComponent(remoteJobId))
  const rr = await fetch(`${backendBase}${statusPath}`, {
    method: 'GET',
    headers,
  })
  const data = await rr.json().catch(() => ({}))
  if (!rr.ok) {
    return res.status(502).json({
      status: 'failed',
      error: 'backend_status_failed',
      detail: data,
    })
  }

  const normalized = normalizeRemoteRenderResponse(data)
  if (normalized.status === 'completed' && normalized.downloadUrl && renderKey) {
    CACHE.set(renderKey, {
      downloadUrl: normalized.downloadUrl,
      mimeType: normalized.mimeType || 'video/mp4',
      expiresAt: Date.now() + CACHE_TTL_MS,
    })
  }

  return res.status(200).json({
    status: normalized.status,
    remoteJobId,
    renderKey: renderKey || null,
    downloadUrl: normalized.downloadUrl || null,
    downloadProxyUrl: normalized.downloadUrl
      ? buildProxyDownloadUrl({ renderKey: renderKey || null, remoteJobId, filename: 'limitless-rating.mp4' })
      : null,
    mimeType: normalized.mimeType || null,
    detail: normalized.detail || null,
  })
}

async function proxyRenderedDownload(req, res) {
  pruneCache()
  const renderKey = String(req.query?.renderKey || '').trim()
  const remoteJobId = String(req.query?.remoteJobId || '').trim()
  const filename = sanitizeFilename(String(req.query?.filename || 'limitless-rating.mp4'))

  let downloadUrl = ''
  let mimeType = 'video/mp4'

  if (renderKey) {
    const cached = CACHE.get(renderKey)
    if (cached && cached.expiresAt > Date.now() && cached.downloadUrl) {
      downloadUrl = cached.downloadUrl
      mimeType = cached.mimeType || mimeType
    }
  }

  if (!downloadUrl && remoteJobId) {
    const status = await queryBackendStatus(remoteJobId)
    if (status?.downloadUrl) {
      downloadUrl = status.downloadUrl
      mimeType = status.mimeType || mimeType
      if (renderKey) {
        CACHE.set(renderKey, {
          downloadUrl,
          mimeType,
          expiresAt: Date.now() + CACHE_TTL_MS,
        })
      }
    }
  }

  if (!downloadUrl) {
    return res.status(404).json({
      error: 'download_not_ready',
      message: 'Rendered video is not ready yet.',
    })
  }

  const upstream = await fetch(downloadUrl, { method: 'GET' })
  if (!upstream.ok) {
    return res.status(502).json({
      error: 'download_fetch_failed',
      status: upstream.status,
      statusText: upstream.statusText,
    })
  }

  const arr = await upstream.arrayBuffer()
  const body = Buffer.from(arr)
  const upMime = upstream.headers.get('content-type') || mimeType || 'video/mp4'
  res.setHeader('Content-Type', upMime)
  res.setHeader('Content-Length', String(body.byteLength))
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  return res.status(200).send(body)
}

async function queryBackendStatus(remoteJobId) {
  const backendBase = (process.env.PSL_RENDER_BACKEND_URL || '').replace(/\/$/, '')
  if (!backendBase) return null

  const headers = {}
  const secret = (process.env.PSL_RENDER_BACKEND_SECRET || '').trim()
  if (secret) headers.Authorization = `Bearer ${secret}`

  const statusTpl = process.env.PSL_RENDER_STATUS_PATH || '/v1/psl-video/render/:jobId'
  const statusPath = statusTpl.replace(':jobId', encodeURIComponent(remoteJobId))
  const rr = await fetch(`${backendBase}${statusPath}`, {
    method: 'GET',
    headers,
  })
  if (!rr.ok) return null
  const data = await rr.json().catch(() => ({}))
  const normalized = normalizeRemoteRenderResponse(data)
  if (normalized.status !== 'completed' || !normalized.downloadUrl) return null
  return normalized
}

function sanitizeFilename(name) {
  const out = (name || 'download.mp4').replace(/[^a-zA-Z0-9._-]+/g, '-')
  return out || 'download.mp4'
}

function buildProxyDownloadUrl({ renderKey, remoteJobId, filename }) {
  const qs = new URLSearchParams()
  qs.set('mode', 'download')
  if (renderKey) qs.set('renderKey', String(renderKey))
  if (remoteJobId) qs.set('remoteJobId', String(remoteJobId))
  if (filename) qs.set('filename', String(filename))
  return `/api/render-psl-video?${qs.toString()}`
}

function normalizeRemoteRenderResponse(data) {
  const statusRaw = String(data?.status || data?.state || '').toLowerCase()
  const status =
    statusRaw === 'done' || statusRaw === 'finished' || statusRaw === 'completed'
      ? 'completed'
      : statusRaw === 'failed' || statusRaw === 'error'
      ? 'failed'
      : statusRaw === 'rendering' || statusRaw === 'processing' || statusRaw === 'running'
      ? 'rendering'
      : 'queued'

  return {
    status,
    remoteJobId: data?.jobId || data?.id || data?.renderId || null,
    downloadUrl: data?.downloadUrl || data?.url || data?.outputUrl || null,
    mimeType: data?.mimeType || data?.contentType || null,
    detail: data?.detail || data?.message || null,
  }
}

function computeRenderKey(template) {
  const json = JSON.stringify(template || {})
  return 'psl-server-' + crypto.createHash('sha256').update(json).digest('hex').slice(0, 32)
}

function pruneCache() {
  const now = Date.now()
  for (const [k, v] of CACHE) {
    if (!v || v.expiresAt <= now) CACHE.delete(k)
  }
}

function safeJson(s) {
  try { return JSON.parse(s) } catch (_) { return {} }
}
