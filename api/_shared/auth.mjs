/** Optional shared secret — same as `APP_SHARED_SECRET` on the old droplet. */
export function isAuthorized(req) {
  const secret = (process.env.APP_SHARED_SECRET || process.env.DAYONE_BACKEND_SECRET || '').trim()
  if (!secret) return true
  const auth = req.headers.authorization || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const header = (req.headers['x-dayone-secret'] || '').trim()
  return (bearer || header) === secret
}

export function rejectUnauthorized(res) {
  return res.status(401).json({ error: 'unauthorized' })
}
