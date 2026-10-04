// HunarSetu API. Mounted at /api by the Vite dev server (vite.config.js) and by server/index.js.
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { publishedPayload, provenance, runVerification, ESCALATION_STATUSES, maskPhone } from './db.js'
import { upsertSession, liveAnalytics, addEscalation, listEscalations, updateEscalation, escalationStatus, storageKind } from './store.js'
import { counselWithClaude, claudeConfigured, LlmUnavailable, MODEL, ALLOWED } from './llm.js'
import { counselWithFreeAI, freeProviderOrder, FREE_PROVIDERS } from './llm-free.js'
import { detectLang } from '../src/lib/langdetect.js'
import { lookupPin, trainingPlaces } from './geo.js'
import { OBJECTION_KEYS } from '../src/engine/taxonomy.js'

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback)

function cleanProfile(p = {}) {
  return {
    members: Array.isArray(p.members) ? p.members.filter((m) => ALLOWED.ROLE_KEYS.includes(m)).slice(0, 5) : ['learner'],
    gender: p.gender === 'f' ? 'f' : 'm',
    district: oneOf(p.district, ALLOWED.DISTRICT_IDS, 'hanumakonda'),
    mandal: str(p.mandal, 40) || null,
    income: oneOf(p.income, ALLOWED.INCOME_IDS, '10to25'),
    edu: oneOf(p.edu, ALLOWED.EDU_IDS, 'class10'),
    marks: oneOf(p.marks, ALLOWED.MARK_IDS, 'mid'),
    trade: p.trade === 'unsure' ? 'unsure' : oneOf(p.trade, ALLOWED.TRADE_IDS, 'unsure'),
  }
}

function cleanFamily(f) {
  if (!f || typeof f !== 'object') return null
  const stance = {}
  for (const [r, s] of Object.entries(f.stance ?? {})) {
    if (ALLOWED.ROLE_KEYS.includes(r) && s && typeof s.start === 'number' && typeof s.now === 'number') stance[r] = { start: s.start, now: s.now }
  }
  const concerns = (Array.isArray(f.concerns) ? f.concerns : [])
    .filter((c) => ALLOWED.ROLE_KEYS.includes(c?.role) && OBJECTION_KEYS.includes(c?.key))
    .slice(0, 40)
    .map((c) => ({ role: c.role, key: c.key, status: str(c.status, 12), count: Number(c.count) || 1 }))
  return { stance, concerns }
}

// ---------- Which AI answers ----------
// LLM_PROVIDER = claude | groq | gemini | pollinations | free | offline (optional; default: best available)
export function aiStatus() {
  const forced = process.env.LLM_PROVIDER
  if (forced === 'offline') return { on: false }
  const free = freeProviderOrder()
  if (claudeConfigured() && (!forced || forced === 'claude')) {
    return { on: true, provider: 'claude', label: 'Claude (Anthropic)', model: MODEL, backups: free }
  }
  if (free.length) return { on: true, provider: free[0], label: FREE_PROVIDERS[free[0]].label, model: FREE_PROVIDERS[free[0]].model(), backups: free.slice(1) }
  return { on: false }
}

// ---------- Small in-memory rate limiter (per IP and route) ----------
function limit(max, windowMs) {
  const hits = new Map()
  return (req, res, next) => {
    const key = req.ip ?? req.socket?.remoteAddress ?? 'x'
    const now = Date.now()
    const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
    if (list.length >= max) {
      res.set('retry-after', String(Math.ceil(windowMs / 1000)))
      return res.status(429).json({ error: 'too_many_requests' })
    }
    list.push(now)
    hits.set(key, list)
    if (hits.size > 5000) hits.clear()
    next()
  }
}

export function createApp() {
  const app = express()
  // Behind Vercel's proxy, trust its forwarded IP (per-visitor rate limits).
  app.set('trust proxy', process.env.VERCEL ? true : 'loopback')
  app.use(express.json({ limit: '100kb' }))
  app.use((_req, res, next) => {
    res.set({ 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'cache-control': 'no-store' })
    next()
  })

  app.get('/health', (_req, res) => {
    const { stats, verifiedAt } = publishedPayload()
    const ai = aiStatus()
    res.json({
      ok: true,
      llm: ai.on,
      provider: ai.provider ?? 'offline',
      providerLabel: ai.label ?? 'Offline engine',
      model: ai.model ?? null,
      backups: ai.backups ?? [],
      outcomes: stats,
      verifiedAt,
      storage: storageKind,
    })
  })

  // ----- Verified outcome data -----
  app.get('/outcomes', (_req, res) => res.json(publishedPayload()))
  app.get('/outcomes/:centreId/provenance', (req, res) => {
    const p = provenance(str(req.params.centreId, 80))
    if (!p) return res.status(404).json({ error: 'not_found' })
    res.json(p)
  })
  app.post('/outcomes/verify', limit(5, 60_000), (_req, res) => res.json({ stats: runVerification() }))

  // ----- Counselling: Claude, else free AI, else 503 (the browser then uses its offline engine) -----
  app.post('/counsel', limit(30, 60_000), async (req, res) => {
    const ai = aiStatus()
    if (!ai.on) return res.status(503).json({ fallback: true, reason: 'no_ai' })
    const b = req.body ?? {}
    const text = str(b.text, 1000).trim()
    if (!text) return res.status(400).json({ error: 'empty_message' })
    const turn = {
      text,
      role: oneOf(b.role, ALLOWED.ROLE_KEYS, 'learner'),
      lang: oneOf(b.lang, ['en', 'hi', 'te'], 'en'),
      history: (Array.isArray(b.history) ? b.history : [])
        .slice(-8)
        .map((h) => ({ from: h?.from === 'bot' ? 'bot' : 'user', role: oneOf(h?.role, ALLOWED.ROLE_KEYS, undefined), text: str(h?.text, 700) }))
        .filter((h) => h.text),
      profile: cleanProfile(b.profile),
      family: cleanFamily(b.family),
    }
    // Answer in the language the family member just wrote in (not just the site's language).
    turn.replyLang = detectLang(text, turn.lang)
    if (ai.provider === 'claude') {
      try {
        return res.json({ ...(await counselWithClaude(turn)), providerLabel: ai.label })
      } catch (err) {
        if (err instanceof Anthropic.APIError) console.error('[claude] API error', err.status, err.message)
        else if (!(err instanceof LlmUnavailable)) console.error('[claude] unexpected error', err)
        if (!ai.backups.length) return res.status(503).json({ fallback: true, reason: 'claude_unavailable' })
        // fall through to the free providers
      }
    }
    try {
      res.json(await counselWithFreeAI(turn))
    } catch (err) {
      if (!(err instanceof LlmUnavailable)) console.error('[free-ai] unexpected error', err)
      res.status(503).json({ fallback: true, reason: 'ai_unavailable' })
    }
  })

  // ----- Location (free public APIs, cached) -----
  app.get('/location/pin/:pin', limit(20, 60_000), async (req, res) => {
    const pin = str(req.params.pin, 6)
    if (!/^[1-9]\d{5}$/.test(pin)) return res.status(400).json({ error: 'bad_pin' })
    try {
      res.json(await lookupPin(pin))
    } catch (err) {
      console.warn('[pin] lookup failed', err.message)
      res.status(502).json({ error: 'pin_service_unavailable' })
    }
  })
  app.get('/places/training', limit(30, 60_000), async (req, res) => {
    const district = oneOf(req.query.district, ALLOWED.DISTRICT_IDS, null)
    if (!district) return res.status(400).json({ error: 'bad_district' })
    const lat = Number(req.query.lat)
    const lon = Number(req.query.lon)
    const near = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null
    try {
      res.json(await trainingPlaces(district, near))
    } catch (err) {
      console.warn('[places] failed', err.message)
      res.json({ places: [], available: false, source: 'OpenStreetMap' })
    }
  })

  // ----- Engagement & sentiment tracking (anonymised) -----
  app.post('/sessions', limit(120, 60_000), async (req, res) => {
    const b = req.body ?? {}
    const id = str(b.id, 64)
    if (!/^[\w-]{8,64}$/.test(id)) return res.status(400).json({ error: 'bad_id' })
    const profile = cleanProfile(b.profile)
    const family = cleanFamily(b.family) ?? { stance: {}, concerns: [] }
    const vals = Object.values(family.stance)
    await upsertSession({
      id,
      startedAt: Number(b.startedAt) || Date.now(),
      district: profile.district,
      mandal: profile.mandal,
      lang: oneOf(b.lang, ['en', 'hi', 'te'], 'en'),
      engine: str(b.engine, 20) || 'offline',
      trade: profile.trade,
      members: profile.members,
      concerns: family.concerns,
      stance: family.stance,
      conviction: vals.length ? vals.reduce((a, s) => a + (s.now - s.start), 0) / vals.length : 0,
      escalated: !!b.escalated,
      turns: Math.min(500, Number(b.turns) || 0),
    })
    res.json({ ok: true })
  })
  app.get('/analytics/live', async (_req, res) => res.json(await liveAnalytics()))

  // ----- Human escalation -----
  app.post('/escalations', limit(8, 10 * 60_000), async (req, res) => {
    const b = req.body ?? {}
    const phone = str(b.phone, 20).replace(/\s/g, '')
    if (b.kind !== 'chat' && !/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ error: 'bad_phone' })
    const id = await addEscalation({
      sessionId: str(b.sessionId, 64) || null,
      kind: oneOf(b.kind, ['call', 'ambassador', 'chat'], 'call'),
      district: oneOf(b.district, ALLOWED.DISTRICT_IDS, null),
      mandal: str(b.mandal, 40) || null,
      lang: oneOf(b.lang, ['en', 'hi', 'te'], 'en'),
      reasons: (Array.isArray(b.reasons) ? b.reasons : []).map((r) => str(r, 30)).slice(0, 5),
      who: oneOf(b.who, ALLOWED.ROLE_KEYS, null),
      woman: !!b.woman,
      // The dashboard is open to everyone in this prototype, so only a hidden number is kept (98xxxx3210).
      phone: maskPhone(phone) || null,
      time: oneOf(b.time, ['morning', 'afternoon', 'evening'], null),
      topics: (Array.isArray(b.topics) ? b.topics : []).filter((t) => OBJECTION_KEYS.includes(t)),
      summary: Array.isArray(b.summary) ? b.summary.slice(0, 12).map((l) => ({ k: str(l?.k, 40), v: str(l?.v, 400) })) : null,
    })
    res.json({ id })
  })
  app.get('/escalations/:id/status', limit(30, 60_000), async (req, res) => {
    const s = await escalationStatus(str(req.params.id, 20))
    if (!s) return res.status(404).json({ error: 'not_found' })
    res.json(s)
  })
  app.get('/escalations', async (_req, res) => res.json(await listEscalations(50)))
  app.patch('/escalations/:id', limit(60, 60_000), async (req, res) => {
    const status = req.body?.status === undefined ? undefined : oneOf(req.body.status, ESCALATION_STATUSES, null)
    if (status === null) return res.status(400).json({ error: 'bad_status' })
    const ok = await updateEscalation(str(req.params.id, 20), { status, note: req.body?.note === undefined ? undefined : str(req.body.note, 500) })
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.json({ ok: true })
  })

  app.use((err, _req, res, _next) => {
    console.error('[api]', err)
    res.status(500).json({ error: 'server_error' })
  })
  return app
}
