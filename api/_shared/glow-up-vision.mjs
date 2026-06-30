import {
  anthropicKey,
  anthropicVisionJSON,
} from './anthropic.mjs'
import {
  GLOW_UP_VISION_SYSTEM_PROMPT,
  GLOW_UP_VISION_SYSTEM_PROMPT_CORE,
  GLOW_UP_VISION_USER_PROMPT_FRONT,
  GLOW_UP_VISION_USER_PROMPT_FRONT_CORE,
  GLOW_UP_VISION_USER_PROMPT_SIDE,
  GLOW_UP_VISION_USER_PROMPT_SIDE_CORE,
} from './glow-up-vision-prompts.mjs'
import { deriveGlowUpVisionFlags } from './glow-up-vision-utils.mjs'
import { normalizeFutureSelfMode } from './future-self-prompts.mjs'
import { downscaleBase64ForVision } from './vision-image-prep.mjs'

const VISION_TIMEOUT_MS = Number(process.env.FUTURE_SELF_GLOW_UP_VISION_TIMEOUT_MS) || 40_000
const VISION_TIMEOUT_CORE_MS = Number(process.env.FUTURE_SELF_GLOW_UP_VISION_CORE_TIMEOUT_MS) || 16_000

/** Sonnet is fast enough for glow-up pipeline on Vercel (Opus often too slow / JSON quirks). */
const VISION_MODEL_DEFAULT = 'claude-sonnet-4-20250514'

/** @returns {boolean} */
export function glowUpVisionEnabled() {
  const raw = String(process.env.FUTURE_SELF_GLOW_UP_VISION ?? '1').trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false
  return Boolean(anthropicKey())
}

/** @returns {boolean} */
export function glowUpVisionRequired() {
  const raw = String(process.env.FUTURE_SELF_GLOW_UP_VISION_REQUIRED ?? '1').trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false
  return glowUpVisionEnabled()
}

export function glowUpVisionModel() {
  return (
    process.env.FUTURE_SELF_GLOW_UP_VISION_MODEL
    || VISION_MODEL_DEFAULT
  ).trim()
}

function clampStr(v, max = 240) {
  const s = String(v ?? '').trim()
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

function clampList(arr, maxItems = 8, maxLen = 120) {
  if (!Array.isArray(arr)) return []
  return arr
    .map((x) => clampStr(x, maxLen))
    .filter(Boolean)
    .slice(0, maxItems)
}

function clampPct(v, min, max) {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.max(min, Math.min(max, Math.round(n)))
}

function clampEnum(v, allowed, fallback = 'unknown') {
  const s = String(v ?? '').trim().toLowerCase()
  return allowed.includes(s) ? s : fallback
}

const INTERVENTION_CATEGORIES = ['skincare', 'training', 'lifestyle', 'nutrition', 'grooming', 'recovery', 'advanced']
const IMPACT_LEVELS = ['high', 'medium', 'low']
const EFFORT_LEVELS = ['easy', 'moderate', 'intensive']
const TIME_OF_DAY = ['morning', 'afternoon', 'evening', 'anytime']

function slugId(title, index) {
  const base = String(title || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return base || `intervention-${index + 1}`
}

function normalizeInterventions(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const title = clampStr(item.title, 80)
      if (!title) return null
      const weeks = Number(item.timeframeWeeks)
      return {
        id: clampStr(item.id, 48) || slugId(title, index),
        category: clampEnum(item.category, INTERVENTION_CATEGORIES, 'skincare'),
        title,
        description: clampStr(item.description, 280),
        impact: clampEnum(item.impact, IMPACT_LEVELS, 'medium'),
        effort: clampEnum(item.effort, EFFORT_LEVELS, 'moderate'),
        timeframeWeeks: Number.isFinite(weeks) ? Math.max(2, Math.min(24, Math.round(weeks))) : 8,
      }
    })
    .filter(Boolean)
    .slice(0, 10)
}

function normalizeRoutineItems(raw, withTimeOfDay = false) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const title = clampStr(item.title, 80)
      if (!title) return null
      const normalized = {
        title,
        description: clampStr(item.description, 280),
      }
      if (withTimeOfDay) {
        normalized.timeOfDay = clampEnum(item.timeOfDay, TIME_OF_DAY, 'anytime')
      }
      return normalized
    })
    .filter(Boolean)
    .slice(0, withTimeOfDay ? 8 : 5)
}

function extractCoachingPlan(normalized) {
  return {
    summary: normalized.glowUpSummary || '',
    imagePreviewChanges: normalized.imagePreviewChanges || [],
    potentialInterventions: normalized.potentialInterventions || [],
    routineDaily: normalized.routineDaily || [],
    routineWeekly: normalized.routineWeekly || [],
    routineMonthly: normalized.routineMonthly || [],
  }
}

function sanitizeMoleDetection(marksRaw) {
  let hasMoles = Boolean(marksRaw.hasMoles)
  let moleCount = Math.max(0, Math.min(20, Math.round(Number(marksRaw.moleCount) || 0)))
  const markNotes = clampStr(marksRaw.markNotes, 200)
  const notesLower = markNotes.toLowerCase()

  if (
    notesLower.includes('zero mole')
    || notesLower.includes('no mole')
    || notesLower.includes('confirmed zero')
    || notesLower.includes('none visible')
    || notesLower.includes('0 mole')
  ) {
    hasMoles = false
    moleCount = 0
  }

  if (hasMoles && moleCount <= 0) {
    const countMatch = notesLower.match(/(\d+)\s*mole/)
    if (countMatch) moleCount = Math.min(20, Number(countMatch[1]) || 0)
    else hasMoles = false
  }

  if (!hasMoles || moleCount <= 0) {
    hasMoles = false
    moleCount = 0
  }

  return { hasFreckles: Boolean(marksRaw.hasFreckles), hasMoles, moleCount, markNotes }
}

function inferPuffinessAreas(raw, waterRetentionLevel, buccalFatLevel) {
  const existing = clampList(raw.puffinessAreas, 8, 80)
  if (existing.length) return existing

  const zones = []
  if (waterRetentionLevel === 'heavy' || waterRetentionLevel === 'moderate') {
    zones.push('buccal cheeks', 'mid-face', 'under-eyes', 'jaw soft tissue')
  } else if (waterRetentionLevel === 'mild') {
    zones.push('cheeks', 'under-eyes')
  }
  if (buccalFatLevel === 'full') {
    if (!zones.includes('buccal cheeks')) zones.push('buccal cheeks')
    zones.push('jaw soft tissue')
  } else if (buccalFatLevel === 'moderate' && !zones.length) {
    zones.push('buccal cheeks', 'jaw soft tissue')
  }
  return zones.slice(0, 6)
}

export { deriveGlowUpVisionFlags } from './glow-up-vision-utils.mjs'

/**
 * Normalize Claude vision JSON for safe prompt injection.
 * @param {Record<string, unknown> | null | undefined} raw
 */
export function normalizeGlowUpVisionAnalysis(raw) {
  if (!raw || typeof raw !== 'object') return null

  const marksRaw = raw.skinMarks && typeof raw.skinMarks === 'object' ? raw.skinMarks : {}
  const confidence = Number(raw.confidence)
  const skinMarks = sanitizeMoleDetection(marksRaw)
  const waterRetentionLevel = clampEnum(
    raw.waterRetentionLevel,
    ['none', 'mild', 'moderate', 'heavy', 'unknown'],
  )
  const buccalFatLevel = clampEnum(
    raw.buccalFatLevel,
    ['lean', 'moderate', 'full', 'unknown'],
  )
  const jawDefinitionState = clampEnum(
    raw.jawDefinitionState,
    ['sharp', 'soft', 'hidden', 'unknown'],
  )

  const normalized = {
    skinTexture: clampStr(raw.skinTexture, 180),
    skinUndertone: clampStr(raw.skinUndertone, 32),
    blemishAreas: clampList(raw.blemishAreas, 6, 80),
    skinMarks,
    browShape: clampStr(raw.browShape, 120),
    browThickness: clampStr(raw.browThickness, 24),
    hairStructure: clampStr(raw.hairStructure, 120),
    facialHairState: clampStr(raw.facialHairState, 32),
    lightingNotes: clampStr(raw.lightingNotes, 160),
    symmetryNotes: clampStr(raw.symmetryNotes, 160),
    puffinessAreas: inferPuffinessAreas(raw, waterRetentionLevel, buccalFatLevel),
    waterRetentionLevel,
    buccalFatLevel,
    jawDefinitionState,
    jawDefinitionFocus: clampStr(raw.jawDefinitionFocus, 220),
    faceFullness: clampStr(raw.faceFullness, 32),
    realisticGoal: clampStr(raw.realisticGoal, 200),
    realismNotes: clampStr(raw.realismNotes, 200),
    waterDrainRealisticPct: clampPct(raw.waterDrainRealisticPct, 15, 98),
    fatReductionRealisticPct: clampPct(raw.fatReductionRealisticPct, 8, 88),
    waterDrainFocus: clampStr(raw.waterDrainFocus, 220),
    fatReductionFocus: clampStr(raw.fatReductionFocus, 220),
    skinImprovementFocus: clampStr(raw.skinImprovementFocus || raw.skinCleanupFocus, 220),
    skinCleanupFocus: clampStr(raw.skinCleanupFocus || raw.skinImprovementFocus, 220),
    eyeFocus: clampStr(raw.eyeFocus, 160),
    browFocus: clampStr(raw.browFocus, 160),
    personalizedEditPrompt: clampStr(raw.personalizedEditPrompt, 520),
    personalizedKeywords: clampList(raw.personalizedKeywords, 10, 100),
    priorityZones: clampList(raw.priorityZones, 6, 80),
    unrealisticAvoid: clampList(raw.unrealisticAvoid, 6, 100),
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.75,
    glowUpSummary: clampStr(raw.glowUpSummary, 320),
    imagePreviewChanges: clampList(raw.imagePreviewChanges, 8, 120),
    potentialInterventions: normalizeInterventions(raw.potentialInterventions),
    routineDaily: normalizeRoutineItems(raw.routineDaily, true),
    routineWeekly: normalizeRoutineItems(raw.routineWeekly, false),
    routineMonthly: normalizeRoutineItems(raw.routineMonthly, false),
  }

  if (!normalized.unrealisticAvoid.some((a) => /mole|muttermal|beauty mark|pigment spot/i.test(String(a)))) {
    if (!skinMarks.hasMoles) {
      normalized.unrealisticAvoid.unshift('add moles/Muttermale/beauty marks/pigment spots not in input')
    }
  }

  if (!normalized.personalizedEditPrompt && normalized.realisticGoal) {
    normalized.personalizedEditPrompt = normalized.realisticGoal
  }
  if (!normalized.personalizedKeywords.length && normalized.priorityZones.length) {
    normalized.personalizedKeywords = normalized.priorityZones
      .slice(0, 6)
      .map((z) => `Reduce ${z} puffiness`)
  }

  const hasContent = normalized.personalizedEditPrompt
    || normalized.personalizedKeywords.length > 0
    || normalized.waterDrainFocus
    || normalized.fatReductionFocus
    || normalized.jawDefinitionFocus
    || normalized.skinImprovementFocus
    || normalized.skinCleanupFocus
    || normalized.puffinessAreas.length > 0
    || normalized.blemishAreas.length > 0
    || normalized.skinTexture
    || normalized.browShape
    || normalized.priorityZones.length > 0
    || normalized.realisticGoal
    || normalized.glowUpSummary
    || normalized.potentialInterventions.length > 0

  return hasContent ? normalized : null
}

/** Coaching subset for API responses and client UI. */
export function extractGlowUpCoachingPlan(analysis) {
  if (!analysis || typeof analysis !== 'object') return null
  const plan = extractCoachingPlan(analysis)
  const hasContent = plan.summary
    || plan.imagePreviewChanges.length > 0
    || plan.potentialInterventions.length > 0
    || plan.routineDaily.length > 0
    || plan.routineWeekly.length > 0
    || plan.routineMonthly.length > 0
  return hasContent ? plan : null
}

function visionUserPrompt(mode, coreOnly = false) {
  const key = normalizeFutureSelfMode(mode)
  if (key === 'side') {
    return coreOnly ? GLOW_UP_VISION_USER_PROMPT_SIDE_CORE : GLOW_UP_VISION_USER_PROMPT_SIDE
  }
  return coreOnly ? GLOW_UP_VISION_USER_PROMPT_FRONT_CORE : GLOW_UP_VISION_USER_PROMPT_FRONT
}

function visionSystemPrompt(coreOnly = false) {
  return coreOnly ? GLOW_UP_VISION_SYSTEM_PROMPT_CORE : GLOW_UP_VISION_SYSTEM_PROMPT
}

function visionFailureReason(err) {
  if (!err) return 'unknown'
  const msg = String(err?.message || err)
  if (msg === 'glow_up_vision_timeout') return 'timeout'
  if (msg === 'anthropic_http') {
    const apiMsg = err?.detail?.error?.message || err?.detail?.message
    return apiMsg ? `anthropic_http:${apiMsg}` : `anthropic_http:${err.status || '?'}`
  }
  if (msg.includes('JSON')) return 'invalid_json'
  return msg.slice(0, 120)
}

async function fetchVisionOnce(imageBase64, mode, { coreOnly = false } = {}) {
  const apiKey = anthropicKey()
  if (!apiKey) return { analysis: null, error: 'missing_api_key' }

  const visionImage = await downscaleBase64ForVision(imageBase64)
  const timeoutMs = coreOnly ? VISION_TIMEOUT_CORE_MS : VISION_TIMEOUT_MS

  try {
    const raw = await anthropicVisionJSON({
      apiKey,
      model: glowUpVisionModel(),
      system: visionSystemPrompt(coreOnly),
      userText: visionUserPrompt(mode, coreOnly),
      imageBase64: visionImage,
      max_tokens: coreOnly ? 1800 : 4096,
      temperature: 0.12,
      timeoutMs: timeoutMs + 3_000,
    })
    const analysis = normalizeGlowUpVisionAnalysis(raw)
    if (!analysis) return { analysis: null, error: 'empty_analysis', coreOnly }
    return { analysis, error: null, coreOnly }
  } catch (err) {
    if (err?.name === 'AbortError' || err?.message === 'anthropic_timeout') {
      return { analysis: null, error: 'timeout', coreOnly }
    }
    return { analysis: null, error: visionFailureReason(err), coreOnly }
  }
}

async function fetchVisionWithTimeout(imageBase64, mode) {
  // Attempt 1 — full analysis with coaching (fits Vercel 60s budget)
  const result = await fetchVisionOnce(imageBase64, mode, { coreOnly: false })
  if (result.analysis) return result

  // Attempt 2 — core edit fields only so glow-up can still proceed
  console.warn('glow-up vision fallback core', { firstError: result.error })
  const core = await fetchVisionOnce(imageBase64, mode, { coreOnly: true })
  if (core.analysis) {
    return { ...core, coachingSkipped: true }
  }
  return core
}

/**
 * Step 1 — Claude Vision analyzes the glow-up source photo.
 * @returns {Promise<{ analysis: object, model: string, error?: string|null } | null>}
 */
export async function analyzeGlowUpImage(imageBase64, mode = 'front') {
  if (!glowUpVisionEnabled()) return null
  if (!imageBase64 || typeof imageBase64 !== 'string') return null

  const t0 = Date.now()
  const visionResult = await fetchVisionWithTimeout(imageBase64, mode)
  const { analysis, error } = visionResult
  const ms = Date.now() - t0

  if (!analysis) {
    console.warn('glow-up vision failed', { error, ms, model: glowUpVisionModel() })
    return { analysis: null, model: glowUpVisionModel(), error: error || 'failed' }
  }

  console.log('glow-up vision ok', {
    model: glowUpVisionModel(),
    ms,
    keywords: analysis.personalizedKeywords?.length ?? 0,
    zones: analysis.priorityZones,
    interventions: analysis.potentialInterventions?.length ?? 0,
    routineDaily: analysis.routineDaily?.length ?? 0,
    coachingSkipped: Boolean(visionResult?.coachingSkipped),
    confidence: analysis.confidence,
  })
  return { analysis, model: glowUpVisionModel(), error: null }
}
