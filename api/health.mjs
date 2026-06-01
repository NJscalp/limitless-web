import { isAuthorized, rejectUnauthorized } from '../_shared/auth.mjs'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  res.setHeader('Content-Type', 'application/json')
  return res.status(200).json({
    ok: true,
    service: 'day-one-face-api',
    platform: 'vercel',
    anthropicConfigured: Boolean((process.env.ANTHROPIC_API_KEY || '').trim()),
    kieConfigured: Boolean((process.env.KIE_API_KEY || '').trim()),
    tiktokConfigured:
      Boolean((process.env.TIKTOK_ACCESS_TOKEN || '').trim()) &&
      Boolean((process.env.TIKTOK_PIXEL_CODE || '').trim()),
    blobConfigured: Boolean((process.env.BLOB_READ_WRITE_TOKEN || '').trim()),
  })
}
