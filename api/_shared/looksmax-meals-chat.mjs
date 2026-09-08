/**
 * Looksmax meal coach chat — text-only Anthropic for food / meal planning.
 * POST /v1/looksmax-meals/chat
 */
import { isAuthorized, rejectUnauthorized } from './_shared/auth.mjs'
import { anthropicKey, anthropicModel, parseJSONObjectFromText } from './_shared/anthropic.mjs'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

const SYSTEM = `You are Lookscroll's Looksmax Meal Coach inside a face-rating / glow app.
Your job: help men eat for looksmax outcomes — skin clarity, jaw fullness/definition, lean bulk, masculine hormones, anti-bloat.

VOICE
- Direct, chad, practical. Short paragraphs or tight bullets.
- Not a generic "healthy eating" dietitian. Prefer red meat, eggs, organ meats, bone broth, raw/A2 dairy (note legality), butter, honey, berries, sea salt, oysters, white rice/potatoes for bulk.
- Avoid seed-oil preaching walls; just steer away from junk quietly.
- No medical claims. Add one short disclaimer only if discussing raw dairy or supplements.
- If asked "healthiest foods", answer as looksmax-healthiest (skin/jaw/androgens), not USDA pyramid.

OUTPUT
Return ONLY a JSON object:
{
  "reply": "string — answer shown in chat (markdown ok: bullets, bold)",
  "goalHint": "skin" | "jaw" | "leanBulk" | null,
  "suggestions": [
    {
      "slot": "breakfast" | "lunch" | "dinner" | "snack1" | "snack2",
      "title": "short meal name",
      "foods": ["food1", "food2"],
      "why": "one line why looksmax",
      "benefitTag": "Skin" | "Jaw" | "Bulk" | "Collagen" | "Protein" | "Dairy"
    }
  ]
}
Rules:
- suggestions: 0–5 items. Include them when user asks for a plan, meals, day on a plate, what to eat, or similar. Otherwise [].
- goalHint: set when user implies a goal; else null.
- No markdown fences around the JSON.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (!isAuthorized(req)) return rejectUnauthorized(res)

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  const message = String(body?.message || '').trim()
  if (!message) return res.status(400).json({ error: 'missing_message' })
  if (message.length > 2000) return res.status(400).json({ error: 'message_too_long' })

  const goal = String(body?.goal || '').trim()
  const history = Array.isArray(body?.history) ? body.history.slice(-8) : []

  const apiKey = anthropicKey()
  if (!apiKey) {
    return res.status(501).json({
      error: 'ai_not_configured',
      hint: 'Set ANTHROPIC_API_KEY in Vercel project environment variables.',
    })
  }

  const messages = []
  for (const turn of history) {
    const role = turn?.role === 'assistant' ? 'assistant' : 'user'
    const content = String(turn?.content || '').trim()
    if (!content) continue
    messages.push({ role, content })
  }
  const goalLine = goal ? `\nCurrent planner goal in app: ${goal}.` : ''
  messages.push({
    role: 'user',
    content: `${message}${goalLine}`,
  })

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Number(process.env.LOOKSMAX_MEALS_TIMEOUT_MS) || 45_000)

    let r
    try {
      r = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: anthropicModel(),
          max_tokens: 1600,
          temperature: 0.35,
          system: SYSTEM,
          messages,
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      const status = r.status === 429 ? 429 : 502
      return res.status(status).json({
        error: 'anthropic_http',
        status: r.status,
        detail: data?.error || null,
      })
    }

    const textBlock = Array.isArray(data?.content) ? data.content.find((c) => c.type === 'text') : null
    const text = textBlock?.text
    if (!text) return res.status(502).json({ error: 'no_text_in_response' })

    let parsed
    try {
      parsed = parseJSONObjectFromText(text)
    } catch {
      return res.status(200).json({
        reply: String(text).trim(),
        goalHint: null,
        suggestions: [],
      })
    }

    return res.status(200).json({
      reply: String(parsed.reply || text).trim(),
      goalHint: normalizeGoal(parsed.goalHint),
      suggestions: normalizeSuggestions(parsed.suggestions),
    })
  } catch (err) {
    console.error('looksmax-meals-chat', err)
    if (err?.name === 'AbortError') {
      return res.status(504).json({ error: 'timeout' })
    }
    return res.status(500).json({ error: 'looksmax_meals_failed', message: String(err?.message || err) })
  }
}

function normalizeGoal(raw) {
  const g = String(raw || '').trim()
  if (g === 'skin' || g === 'jaw' || g === 'leanBulk') return g
  return null
}

function normalizeSuggestions(raw) {
  if (!Array.isArray(raw)) return []
  const slots = new Set(['breakfast', 'lunch', 'dinner', 'snack1', 'snack2'])
  return raw.slice(0, 5).map((s, i) => {
    const slot = slots.has(String(s?.slot || '')) ? String(s.slot) : 'lunch'
    const foods = Array.isArray(s?.foods)
      ? s.foods.map((f) => String(f).trim()).filter(Boolean).slice(0, 8)
      : []
    return {
      slot,
      title: String(s?.title || `Meal ${i + 1}`).slice(0, 80),
      foods,
      why: String(s?.why || '').slice(0, 220),
      benefitTag: String(s?.benefitTag || 'Protein').slice(0, 40),
    }
  }).filter((s) => s.foods.length > 0 || s.title.length > 0)
}

function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
