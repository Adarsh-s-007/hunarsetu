// Where call-back requests and live sessions are kept.
//   Upstash Redis (free; add it in Vercel -> Storage), when its REST URL and token are set:
//     data survives restarts and is shared by every server copy. Needed on Vercel.
//   Otherwise the local SQLite file (server/db.js): fine on one long-running server
//     (npm start, Render), but temporary on Vercel.
// The course and pay data always stays in SQLite: it is rebuilt from source on every start.
import * as sql from './db.js'

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
const useRedis = !!(REDIS_URL && REDIS_TOKEN)

// 'redis' | 'disk' (one long-running server) | 'temporary' (Vercel without Redis)
export const storageKind = useRedis ? 'redis' : process.env.VERCEL ? 'temporary' : 'disk'

// ---------- Upstash REST (no extra package: one HTTPS call per pipeline) ----------
async function pipeline(commands) {
  const res = await fetch(`${REDIS_URL.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${REDIS_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(commands),
  })
  if (!res.ok) throw new Error(`redis HTTP ${res.status}`)
  const out = await res.json()
  return out.map((r) => {
    if (r.error) throw new Error(`redis: ${r.error}`)
    return r.result
  })
}
const one = async (...cmd) => (await pipeline([cmd]))[0]
const parse = (s) => (s ? JSON.parse(s) : null)
async function getMany(keys) {
  if (!keys.length) return []
  const rows = []
  for (let i = 0; i < keys.length; i += 200) rows.push(...(await one('MGET', ...keys.slice(i, i + 200))).map(parse))
  return rows.filter(Boolean)
}

const K = {
  sess: (id) => `hs:sess:${id}`,
  sessIdx: 'hs:sess:idx',
  esc: (id) => `hs:esc:${id}`,
  escIdx: 'hs:esc:idx',
  escBySession: (sid) => `hs:esc:session:${sid}`,
}
const KEEP_SECONDS = 180 * 86400 // anonymised sessions and requests are kept for 180 days

// ---------- Live sessions (anonymised) ----------
export async function upsertSession(s) {
  if (!useRedis) return sql.upsertSession(s)
  const now = Date.now()
  const old = parse(await one('GET', K.sess(s.id)))
  const row = {
    id: s.id,
    started_at: old?.started_at ?? s.startedAt ?? now,
    updated_at: now,
    district: old?.district ?? s.district ?? null,
    mandal: old?.mandal ?? s.mandal ?? null,
    members: old?.members ?? s.members ?? [],
    lang: s.lang ?? null,
    engine: s.engine ?? null,
    trade: s.trade ?? null,
    concerns: s.concerns ?? [],
    stance: s.stance ?? {},
    conviction: Number(s.conviction ?? 0),
    escalated: s.escalated ? 1 : 0,
    turns: Number(s.turns ?? 0),
  }
  await pipeline([
    ['SET', K.sess(s.id), JSON.stringify(row), 'EX', KEEP_SECONDS],
    ['ZADD', K.sessIdx, now, s.id],
    ['ZREMRANGEBYRANK', K.sessIdx, 0, -2001], // the dashboard looks at the latest 2,000
  ])
}

export async function liveAnalytics() {
  if (!useRedis) return sql.liveAnalytics()
  const ids = await one('ZREVRANGE', K.sessIdx, 0, 1999)
  return sql.summariseSessions(await getMany(ids.map(K.sess)))
}

// ---------- Call-back requests ----------
const clean = (phone) => (phone ? String(phone).replace(/\D/g, '') : null)

async function saveEscalation(row) {
  await one('SET', K.esc(row.id), JSON.stringify(row), 'EX', KEEP_SECONDS)
}

export async function addEscalation(e) {
  if (!useRedis) return sql.addEscalation(e)
  const now = Date.now()
  // One request per chat (same rule as the SQLite version).
  if (e.sessionId) {
    const openId = await one('GET', K.escBySession(e.sessionId))
    const open = openId ? parse(await one('GET', K.esc(openId))) : null
    if (open && open.status !== 'Resolved') {
      if (e.kind === 'chat') return open.id
      if (open.kind === 'chat' && !open.contact) {
        await saveEscalation({
          ...open,
          kind: e.kind ?? 'call',
          contact: clean(e.phone),
          preferred_time: e.time ?? null,
          woman: !!(e.woman || open.woman),
          lang: e.lang ?? open.lang,
          topics: [...new Set([...(open.topics ?? []), ...(e.topics ?? [])])],
          summary: e.summary ?? open.summary,
          status: 'Waiting',
          updated_at: now,
        })
        return open.id
      }
    }
  }
  let id = sql.newTicket()
  while (await one('EXISTS', K.esc(id))) id = sql.newTicket()
  const row = {
    id,
    created_at: now,
    updated_at: now,
    session_id: e.sessionId ?? null,
    kind: e.kind ?? 'call',
    district: e.district ?? null,
    mandal: e.mandal ?? null,
    lang: e.lang ?? null,
    reasons: e.reasons ?? [],
    who: e.who ?? null,
    woman: !!e.woman,
    status: 'Waiting',
    contact: clean(e.phone),
    preferred_time: e.time ?? null,
    topics: e.topics ?? [],
    summary: e.summary ?? null,
    note: null,
  }
  const cmds = [
    ['SET', K.esc(id), JSON.stringify(row), 'EX', KEEP_SECONDS],
    ['ZADD', K.escIdx, now, id],
  ]
  if (e.sessionId) cmds.push(['SET', K.escBySession(e.sessionId), id, 'EX', KEEP_SECONDS])
  await pipeline(cmds)
  return id
}

export async function updateEscalation(id, { status, note }) {
  if (!useRedis) return sql.updateEscalation(id, { status, note })
  const row = parse(await one('GET', K.esc(id)))
  if (!row) return false
  if (status) row.status = status
  if (note !== undefined && note !== null) row.note = note
  if (status === 'Resolved') row.contact = sql.maskPhone(row.contact) // keep the number only while a call is pending
  row.updated_at = Date.now()
  await saveEscalation(row)
  return true
}

export async function escalationStatus(id) {
  if (!useRedis) return sql.escalationStatus(id)
  const r = parse(await one('GET', K.esc(id)))
  return r ? { id: r.id, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at } : null
}

export async function listEscalations(limit = 20) {
  if (!useRedis) return sql.listEscalations(limit)
  const ids = await one('ZREVRANGE', K.escIdx, 0, limit - 1)
  return getMany(ids.map(K.esc))
}
