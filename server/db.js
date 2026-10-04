// SQLite store for the Verified Outcome Data Engine and the live analytics feed.
// Uses Node's built-in node:sqlite (Node 22.13+), so there is nothing to install.
// The pilot spec targets PostgreSQL + PostGIS; the schema below maps across directly.
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildRawSources, verifyOutcomes, RULES } from '../src/data/outcomes.js'

const here = path.dirname(fileURLToPath(import.meta.url))
// Vercel only allows writing to /tmp (temporary); everywhere else the file sits next to the server.
const DATA_DIR = process.env.HUNARSETU_DATA_DIR ?? (process.env.VERCEL ? '/tmp/hunarsetu' : path.join(here, '.data'))
const SEED_VERSION = '2026-10-04.1'

let db

export function getDb() {
  if (db) return db
  mkdirSync(DATA_DIR, { recursive: true })
  db = new DatabaseSync(path.join(DATA_DIR, 'hunarsetu.db'))
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS centres (id TEXT PRIMARY KEY, district_id TEXT, trade_id TEXT, type TEXT, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS claims (centre_id TEXT PRIMARY KEY, placement INTEGER, earn_low INTEGER, earn_high INTEGER,
      women INTEGER, alumni INTEGER, reported_on TEXT);
    CREATE TABLE IF NOT EXISTS tracers (centre_id TEXT PRIMARY KEY, respondents INTEGER, placed6 INTEGER, employed12 INTEGER,
      earn_p25 INTEGER, earn_p75 INTEGER, called_on TEXT);
    CREATE TABLE IF NOT EXISTS published (centre_id TEXT PRIMARY KEY, district_id TEXT, trade_id TEXT, badge TEXT, flagged INTEGER,
      data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS anomalies (centre_id TEXT PRIMARY KEY, district_id TEXT, trade_id TEXT, claimed INTEGER, traced INTEGER, gap INTEGER);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, started_at INTEGER, updated_at INTEGER, district TEXT, mandal TEXT,
      lang TEXT, engine TEXT, trade TEXT, members TEXT, concerns TEXT, stance TEXT, conviction REAL, escalated INTEGER, turns INTEGER);
    CREATE TABLE IF NOT EXISTS escalations (id TEXT PRIMARY KEY, created_at INTEGER, session_id TEXT, kind TEXT, district TEXT, mandal TEXT,
      lang TEXT, reasons TEXT, who TEXT, woman INTEGER, status TEXT, contact TEXT, preferred_time TEXT, topics TEXT, summary TEXT);
    CREATE TABLE IF NOT EXISTS geo_cache (key TEXT PRIMARY KEY, value TEXT, fetched_at INTEGER);
  `)
  // Columns added after the first release: add them to older databases.
  for (const col of ['note TEXT', 'updated_at INTEGER']) {
    try {
      db.exec(`ALTER TABLE escalations ADD COLUMN ${col}`)
    } catch {
      /* already there */
    }
  }
  const v = db.prepare('SELECT value FROM meta WHERE key = ?').get('seed_version')
  if (v?.value !== SEED_VERSION) seed()
  return db
}

// Load raw source records (centre inspections, MIS claims, tracer calls), then publish.
function seed() {
  const raw = buildRawSources()
  db.exec('BEGIN')
  try {
    db.exec('DELETE FROM centres; DELETE FROM claims; DELETE FROM tracers;')
    const c = db.prepare('INSERT INTO centres (id, district_id, trade_id, type, data) VALUES (?, ?, ?, ?, ?)')
    for (const x of raw.centres) c.run(x.id, x.districtId, x.tradeId, x.type, JSON.stringify(x))
    const cl = db.prepare('INSERT INTO claims VALUES (?, ?, ?, ?, ?, ?, ?)')
    for (const x of raw.claims) cl.run(x.centreId, x.placement, x.earnLow, x.earnHigh, x.women, x.alumni, x.reportedOn)
    const tr = db.prepare('INSERT INTO tracers VALUES (?, ?, ?, ?, ?, ?, ?)')
    for (const x of raw.tracers) tr.run(x.centreId, x.respondents, x.placed6, x.employed12, x.earnP25, x.earnP75, x.calledOn)
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('seed_version', SEED_VERSION)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  runVerification()
}

// Cross-check MIS claims against tracer calls, straight from the stored rows.
export function runVerification() {
  const d = getDb()
  const centres = d.prepare('SELECT data FROM centres').all().map((r) => JSON.parse(r.data))
  const claims = d.prepare('SELECT * FROM claims').all().map((r) => ({
    centreId: r.centre_id, placement: r.placement, earnLow: r.earn_low, earnHigh: r.earn_high, women: r.women, alumni: r.alumni, reportedOn: r.reported_on,
  }))
  const tracers = d.prepare('SELECT * FROM tracers').all().map((r) => ({
    centreId: r.centre_id, respondents: r.respondents, placed6: r.placed6, employed12: r.employed12, earnP25: r.earn_p25, earnP75: r.earn_p75, calledOn: r.called_on,
  }))
  const result = verifyOutcomes({ centres, claims, tracers })
  d.exec('BEGIN')
  try {
    d.exec('DELETE FROM published; DELETE FROM anomalies;')
    const p = d.prepare('INSERT INTO published VALUES (?, ?, ?, ?, ?, ?)')
    for (const x of result.published) p.run(x.id, x.districtId, x.tradeId, x.earnBadge, x.flagged ? 1 : 0, JSON.stringify(x))
    const a = d.prepare('INSERT INTO anomalies VALUES (?, ?, ?, ?, ?, ?)')
    for (const x of result.anomalies) a.run(x.centreId, x.districtId, x.tradeId, x.claimed, x.traced, x.gap)
    d.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('verified_at', new Date().toISOString())
    d.exec('COMMIT')
  } catch (err) {
    d.exec('ROLLBACK')
    throw err
  }
  return result.stats
}

export function publishedPayload() {
  const d = getDb()
  const published = d.prepare('SELECT data FROM published').all().map((r) => JSON.parse(r.data))
  const anomalies = d.prepare('SELECT * FROM anomalies ORDER BY gap DESC').all().map((r) => ({
    centreId: r.centre_id, districtId: r.district_id, tradeId: r.trade_id, claimed: r.claimed, traced: r.traced, gap: r.gap,
  }))
  const tracerCalls = d.prepare('SELECT COALESCE(SUM(respondents), 0) AS n FROM tracers').get().n
  const verified = published.filter((p) => p.earnBadge === 'verified').length
  return {
    published,
    anomalies,
    stats: { records: published.length, verified, providerReported: published.length - verified, flagged: anomalies.length, tracerCalls },
    rules: RULES,
    verifiedAt: d.prepare('SELECT value FROM meta WHERE key = ?').get('verified_at')?.value ?? null,
  }
}

export function publishedFor(districtId, tradeId) {
  return getDb()
    .prepare('SELECT data FROM published WHERE district_id = ? AND trade_id = ?')
    .all(districtId, tradeId)
    .map((r) => JSON.parse(r.data))
    .sort((a, b) => (a.earnBadge === b.earnBadge ? b.placement - a.placement : a.earnBadge === 'verified' ? -1 : 1))
}

export function provenance(centreId) {
  const d = getDb()
  const centre = d.prepare('SELECT data FROM centres WHERE id = ?').get(centreId)
  if (!centre) return null
  const pub = d.prepare('SELECT data FROM published WHERE centre_id = ?').get(centreId)
  return {
    centre: JSON.parse(centre.data),
    claim: d.prepare('SELECT * FROM claims WHERE centre_id = ?').get(centreId) ?? null,
    tracer: d.prepare('SELECT * FROM tracers WHERE centre_id = ?').get(centreId) ?? null,
    published: pub ? JSON.parse(pub.data) : null,
  }
}

// ---------- Live sessions (anonymised: no names, no phone numbers, no message text) ----------

export function upsertSession(s) {
  const now = Date.now()
  getDb()
    .prepare(
      `INSERT INTO sessions (id, started_at, updated_at, district, mandal, lang, engine, trade, members, concerns, stance, conviction, escalated, turns)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, lang = excluded.lang, engine = excluded.engine, trade = excluded.trade,
         concerns = excluded.concerns, stance = excluded.stance, conviction = excluded.conviction, escalated = excluded.escalated, turns = excluded.turns`,
    )
    .run(
      s.id, s.startedAt ?? now, now, s.district ?? null, s.mandal ?? null, s.lang ?? null, s.engine ?? null, s.trade ?? null,
      JSON.stringify(s.members ?? []), JSON.stringify(s.concerns ?? []), JSON.stringify(s.stance ?? {}), Number(s.conviction ?? 0),
      s.escalated ? 1 : 0, Number(s.turns ?? 0),
    )
}

export function liveAnalytics() {
  const rows = getDb()
    .prepare('SELECT * FROM sessions ORDER BY updated_at DESC LIMIT 2000')
    .all()
    .map((r) => ({ ...r, members: JSON.parse(r.members), concerns: JSON.parse(r.concerns), stance: JSON.parse(r.stance) }))
  return summariseSessions(rows)
}

// Dashboard figures from session rows (newest first). Shared with the Redis store (store.js).
export function summariseSessions(rows) {
  const byMandal = {}
  const objectionsByRole = {}
  const stanceByRole = {}
  for (const r of rows) {
    const k = r.mandal || r.district || 'unknown'
    const m = (byMandal[k] ??= { key: k, sessions: 0, convictionSum: 0, objections: {} })
    m.sessions += 1
    m.convictionSum += r.conviction
    for (const c of r.concerns) {
      m.objections[c.key] = (m.objections[c.key] ?? 0) + 1
      objectionsByRole[c.key] ??= {}
      objectionsByRole[c.key][c.role] = (objectionsByRole[c.key][c.role] ?? 0) + 1
    }
    for (const [role, st] of Object.entries(r.stance)) {
      const s = (stanceByRole[role] ??= { role, n: 0, start: 0, end: 0 })
      s.n += 1
      s.start += st.start
      s.end += st.now
    }
  }
  const dayAgo = Date.now() - 864e5
  return {
    sessions: rows.length,
    today: rows.filter((r) => r.updated_at > dayAgo).length,
    avgConviction: rows.length ? rows.reduce((a, r) => a + r.conviction, 0) / rows.length : 0,
    escalated: rows.filter((r) => r.escalated).length,
    byMandal: Object.values(byMandal).map((m) => ({
      key: m.key,
      sessions: m.sessions,
      avgConviction: m.convictionSum / m.sessions,
      top: Object.entries(m.objections).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    })),
    objectionsByRole,
    stanceByRole: Object.values(stanceByRole).map((s) => ({ role: s.role, start: s.start / s.n, end: s.end / s.n, n: s.n })),
    recent: rows.slice(0, 8).map((r) => ({
      id: r.id.slice(-6),
      at: r.updated_at,
      place: r.mandal || r.district,
      lang: r.lang,
      engine: r.engine,
      members: r.members,
      worries: [...new Set(r.concerns.map((c) => c.key))],
      conviction: r.conviction,
      escalated: !!r.escalated,
      turns: r.turns,
    })),
  }
}

// ---------- Escalations ----------

// Phone numbers are kept only while a call is pending: masked once the request is Resolved
// (data minimisation, DPDP Act). Only signed-in counsellors can read them.
export const maskPhone = (p) => (p ? String(p).replace(/\D/g, '').replace(/^(\d{2})\d+(\d{4})$/, '$1xxxx$2') : null)

// Short ticket numbers families can read out on the phone (no 0/O or 1/I mix-ups).
const TICKET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const newTicket = () => `HS-${Array.from({ length: 6 }, () => TICKET[Math.floor(Math.random() * TICKET.length)]).join('')}`

export function addEscalation(e) {
  const d = getDb()
  // One request per chat: a number left after the chat's hand-over joins that request
  // (session ids are random, so only the same browser can do this).
  if (e.sessionId) {
    const open = d
      .prepare("SELECT * FROM escalations WHERE session_id = ? AND status != 'Resolved' ORDER BY created_at DESC LIMIT 1")
      .get(e.sessionId)
    if (open && e.kind === 'chat') return open.id
    if (open && open.kind === 'chat' && !open.contact) {
      const topics = [...new Set([...JSON.parse(open.topics || '[]'), ...(e.topics ?? [])])]
      d.prepare(
        `UPDATE escalations SET kind = ?, contact = ?, preferred_time = ?, woman = ?, lang = ?, topics = ?, summary = COALESCE(?, summary),
           status = 'Waiting', updated_at = ? WHERE id = ?`,
      ).run(e.kind ?? 'call', e.phone ? String(e.phone).replace(/\D/g, '') : null, e.time ?? null, e.woman || open.woman ? 1 : 0, e.lang ?? open.lang,
        JSON.stringify(topics), e.summary ? JSON.stringify(e.summary) : null, Date.now(), open.id)
      return open.id
    }
  }
  const id = newTicket()
  d
    .prepare(
      `INSERT INTO escalations (id, created_at, session_id, kind, district, mandal, lang, reasons, who, woman, status, contact, preferred_time, topics, summary, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id, Date.now(), e.sessionId ?? null, e.kind ?? 'call', e.district ?? null, e.mandal ?? null, e.lang ?? null,
      JSON.stringify(e.reasons ?? []), e.who ?? null, e.woman ? 1 : 0, 'Waiting', e.phone ? String(e.phone).replace(/\D/g, '') : null, e.time ?? null,
      JSON.stringify(e.topics ?? []), JSON.stringify(e.summary ?? null), Date.now(),
    )
  return id
}

export const ESCALATION_STATUSES = ['Waiting', 'Called', 'Resolved']

export function updateEscalation(id, { status, note }) {
  const d = getDb()
  const r = d
    .prepare('UPDATE escalations SET status = COALESCE(?, status), note = COALESCE(?, note), updated_at = ? WHERE id = ?')
    .run(status ?? null, note ?? null, Date.now(), id)
  if (r.changes && status === 'Resolved') {
    const row = d.prepare('SELECT contact FROM escalations WHERE id = ?').get(id)
    d.prepare('UPDATE escalations SET contact = ? WHERE id = ?').run(maskPhone(row?.contact), id)
  }
  return r.changes > 0
}

// What a family may see about its own request: the status only.
export function escalationStatus(id) {
  const r = getDb().prepare('SELECT id, status, created_at, updated_at FROM escalations WHERE id = ?').get(id)
  return r ? { id: r.id, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at } : null
}

// ---------- Cache for the free location services ----------

export function getCache(key, maxAgeMs) {
  const r = getDb().prepare('SELECT value, fetched_at FROM geo_cache WHERE key = ?').get(key)
  if (!r || Date.now() - r.fetched_at > maxAgeMs) return null
  return JSON.parse(r.value)
}

export function setCache(key, value) {
  getDb().prepare('INSERT OR REPLACE INTO geo_cache (key, value, fetched_at) VALUES (?, ?, ?)').run(key, JSON.stringify(value), Date.now())
}

export function listEscalations(limit = 20) {
  return getDb()
    .prepare('SELECT * FROM escalations ORDER BY created_at DESC LIMIT ?')
    .all(limit)
    .map((r) => ({ ...r, reasons: JSON.parse(r.reasons), topics: JSON.parse(r.topics), summary: JSON.parse(r.summary), woman: !!r.woman }))
}
