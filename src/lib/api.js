// Browser side of the HunarSetu API (server/app.js). Every call degrades gracefully:
// with no backend (e.g. a static deploy) the site keeps working on bundled data and
// the offline counselling engine.
import { setPublished } from '../data/outcomes.js'
import { counsel, applyTurn, markEscalation, freshFollowups, recommendTrade } from '../engine/counsel.js'
import { detectLang } from './langdetect.js'

async function call(path, body, method, timeoutMs) {
  const init = body === undefined && !method ? {} : { method: method ?? 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }
  const ac = timeoutMs ? new AbortController() : null
  const timer = ac && setTimeout(() => ac.abort(), timeoutMs)
  let res
  try {
    res = await fetch(`/api${path}`, { ...init, signal: ac?.signal })
  } catch (err) {
    if (err.name === 'AbortError') throw Object.assign(new Error('timeout'), { status: 504, data: { reason: 'timeout' } })
    throw err
  } finally {
    clearTimeout(timer)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error ?? data.reason ?? `HTTP ${res.status}`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

// Backend status + verified outcome records. Returns null when there is no backend.
export async function connectBackend() {
  try {
    const [health, outcomes] = await Promise.all([call('/health'), call('/outcomes')])
    setPublished(outcomes)
    return {
      online: true,
      llm: health.llm,
      provider: health.provider,
      providerLabel: health.providerLabel,
      model: health.model,
      adminProtected: health.adminProtected,
      stats: outcomes.stats,
      verifiedAt: outcomes.verifiedAt,
    }
  } catch {
    return null
  }
}

let llmAvailable = true

// One counselling turn: Claude (via the API) when available, otherwise the offline engine.
// Both paths update the family concern map through the same applyTurn().
export async function askCounsellor({ text, role, profile, family, lang, messages = [] }) {
  // Answer in the language this person just wrote in; the site's language is only the default.
  const replyLang = detectLang(text, lang).lang
  if (llmAvailable) {
    try {
      const history = messages
        .filter((m) => m.from === 'user' || m.kind !== 'greeting')
        .slice(-8)
        .map((m) => ({ from: m.from, role: m.role, text: m.text }))
      const res = await call('/counsel', { text, role, profile, family, lang, history }, 'POST', 100_000)
      const turn = applyTurn(family, { role, ...res.signals })
      const reasons = [...turn.reasons, ...res.signals.reasons]
      const reply = {
        ...res.reply,
        lang: res.reply.lang ?? replyLang,
        id: `c${Date.now().toString(36)}`,
        from: 'bot',
        engine: res.engine,
        model: res.model,
        tradeId: recommendTrade(profile),
      }
      if (!reply.followups?.length) reply.followups = freshFollowups(turn.family)
      if (res.signals.acknowledged && turn.resolved) reply.actions = ['staircase', 'pact']
      if (reasons.length) {
        const r = markEscalation(turn.family, reasons, role, turn.key).reasons
        reply.escalate = { reasons: r, woman: res.signals.woman || r.includes('sensitive') || profile.gender === 'f', urgent: r.includes('distress') }
      }
      return { reply, family: turn.family, engine: res.engine }
    } catch (err) {
      // No backend or no AI configured: stop asking for this page load.
      // Temporary problems (busy free tier, rate limit): try the AI again next turn.
      if (err.status === 404 || err.status === undefined || err.data?.reason === 'no_ai') llmAvailable = false
    }
  }
  const out = counsel({ text, role, profile, family, lang: replyLang })
  return { ...out, reply: { ...out.reply, lang: replyLang }, engine: 'offline' }
}

export function resetLlm(available) {
  llmAvailable = available
}

// Anonymised engagement & sentiment signal for the administrators' dashboard.
export function trackSession(session, lang) {
  if (!session?.id) return
  call('/sessions', {
    id: session.id,
    startedAt: session.startedAt,
    profile: session.profile,
    family: { stance: session.family.stance, concerns: session.family.concerns },
    lang,
    engine: session.engine ?? 'offline',
    escalated: !!session.family.escalation,
    turns: session.family.turns,
  }).catch(() => {})
}

export const postEscalation = (payload) => call('/escalations', payload)
export const fetchLive = () => Promise.all([call('/analytics/live'), call('/escalations')])
export const fetchProvenance = (centreId) => call(`/outcomes/${encodeURIComponent(centreId)}/provenance`)

// ---------- Free location services (through our API, cached on the server) ----------
export const lookupPin = (pin) => call(`/location/pin/${encodeURIComponent(pin)}`)
export const nearbyPlaces = (district, point) =>
  call(`/places/training?district=${encodeURIComponent(district)}${point ? `&lat=${point.lat}&lon=${point.lon}` : ''}`)

// ---------- Counsellor requests ----------
export const requestStatus = (id) => call(`/escalations/${encodeURIComponent(id)}/status`)
export const updateEscalation = (id, patch) => call(`/escalations/${encodeURIComponent(id)}`, patch, 'PATCH')

// ---------- Admin sign-in ----------
export const adminMe = () => call('/admin/me')
export const adminLogin = (password) => call('/admin/login', { password })
export const adminLogout = () => call('/admin/logout', {})
