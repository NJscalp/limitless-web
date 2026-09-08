/**
 * director-wavespeed.mjs — derselbe Director über WaveSpeed statt direkt.
 *
 * WOZU EIN ZWEITER WEG:
 * WaveSpeed führt Sprach-, Bild- und Videomodelle unter EINEM Schlüssel und
 * EINER Abrechnung — und zwar zu denselben Preisen wie die Anbieter direkt
 * (`anthropic/claude-opus-5` $5/$25, `google/gemini-3.5-flash` $1,50/$9).
 * Damit fallen der fal/OpenRouter-Umweg für Gemini und der separate
 * Anthropic-Schlüssel weg.
 *
 * WAS DIESER WEG NICHT KANN, und warum er deshalb nicht der Standard ist:
 * Er spricht das OpenAI-Protokoll. Darin gibt es `thinking: {type:"adaptive"}`
 * und `output_config: {effort}` nicht. Ohne eingeschaltetes Denken greift
 * Opus 5 messbar seltener zu Werkzeugen und schreibt einen Aufruf gelegentlich
 * als sichtbaren TEXT statt als Aufruf — der Zug wirkt dann erfolgreich, der
 * Aufruf läuft nie, und in der App bleiben die Karten aus. Genau dieser Fehler
 * hat den alten Agenten wertlos gemacht.
 *
 * Deshalb: umschaltbar über `DIRECTOR_PROVIDER`, und die Entscheidung fällt
 * durch Messung — wie oft feuert `offer_options` hier gegenüber direkt.
 */

const LLM_URL = 'https://llm.wavespeed.ai/v1/chat/completions'

const key = () => (process.env.WAVESPEED_API_KEY || process.env.WAVESPEED || '').trim()

/** Modell-IDs tragen hier ein Anbieter-Präfix. */
export function wavespeedModel(model) {
  if (model.includes('/')) return model
  if (model.startsWith('claude-')) return `anthropic/${model}`
  if (model.startsWith('gpt-')) return `openai/${model}`
  if (model.startsWith('grok-')) return `x-ai/${model}`
  return model
}

/** Anthropic-Blöcke → OpenAI-Teile. */
function toOpenAIContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map((b) => {
    if (b?.type === 'image' && b?.source?.type === 'base64') {
      return { type: 'image_url', image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } }
    }
    return { type: 'text', text: String(b?.text ?? '') }
  })
}

/**
 * Führt einen Director-Zug über WaveSpeed aus.
 * Nimmt und liefert die ANTHROPIC-Form, damit `director-core` nur an einer
 * Stelle verzweigen muss und der Rest identisch bleibt.
 */
export async function callWaveSpeed({ model, system, messages, tools = null, maxTokens = 4000 }) {
  const apiKey = key()
  if (!apiKey) return { ok: false, status: 503, error: 'missing_wavespeed_key' }

  const body = {
    model: wavespeedModel(model),
    max_tokens: maxTokens,
    // Der Systemprompt wird zur ersten Nachricht. Die Trend-Systemnachricht
    // mitten im Verlauf bleibt, wo sie ist — das OpenAI-Protokoll erlaubt
    // `role: "system"` an jeder Stelle.
    messages: [
      { role: 'system', content: system },
      ...messages.map((m) => ({ role: m.role, content: toOpenAIContent(m.content) })),
    ],
  }

  // Werkzeuge sind OPTIONAL. Bildlesung und Ergebnispruefung wollen reinen
  // JSON-Text; schickt man ihnen eine leere Werkzeugliste mit, lehnen manche
  // Modelle den Aufruf ab.
  if (Array.isArray(tools) && tools.length) {
    body.tools = tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }))
    body.tool_choice = 'auto'
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 50_000)
  let r
  try {
    r = await fetch(LLM_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    return { ok: false, status: 502, error: err?.name === 'AbortError' ? 'director_timeout' : 'director_unreachable' }
  }
  clearTimeout(timeout)

  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    console.error('director wavespeed failed', {
      status: r.status, model: body.model,
      message: data?.error?.message || data?.message || null,
    })
    return { ok: false, status: 502, error: `director_http_${r.status}`, detail: data?.error?.message || null }
  }

  const msg = data?.choices?.[0]?.message || {}
  const call = Array.isArray(msg.tool_calls) && msg.tool_calls[0] ? msg.tool_calls[0] : null

  let input = null
  if (call?.function?.arguments) {
    // Immer parsen, nie auf der Zeichenkette suchen — die Maskierung
    // unterscheidet sich zwischen Anbietern.
    try { input = JSON.parse(call.function.arguments) } catch { input = null }
  }

  return {
    ok: true,
    text: String(msg.content || '').trim(),
    call: call && input ? { name: call.function.name, input } : null,
    usage: {
      in: data?.usage?.prompt_tokens ?? 0,
      cache_read: data?.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      cache_write: 0,
      out: data?.usage?.completion_tokens ?? 0,
    },
  }
}
