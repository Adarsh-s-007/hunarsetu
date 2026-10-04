// Verified Outcome Data Engine (shared by the browser and the server).
//
// Raw inputs, as the engine receives them:
//   centres  - centre attributes from skill-officer inspections (hostel, CCTV, distance ...)
//   claims   - what each centre self-reports in its MIS (placement %, earnings)
//   tracers  - consented alumni IVR tracer calls at 6 and 12 months
// verifyOutcomes() cross-checks claims against tracer calls, publishes one record per
// trade × centre × district with a trust badge, and flags centres that over-report.
//
// The server seeds these into SQLite (server/db.js) and serves the published records;
// the browser builds the same records locally as an offline fallback. All values are
// generated deterministically: they are illustrative sample data, not real outcomes.
import { DISTRICTS, TOWNS } from './districts.js'
import { TRADES } from './trades.js'

function rand(seed) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 13
  h = Math.imul(h, 0x5bd1e995)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}
const between = (seed, lo, hi) => lo + rand(seed) * (hi - lo)
const round500 = (n) => Math.round(n / 500) * 500
const clampPct = (n) => Math.round(Math.min(95, Math.max(35, n)))

export const PROVIDER_TYPES = {
  govt: { en: 'Govt ITI', hi: 'सरकारी ITI', te: 'ప్రభుత్వ ITI' },
  private: { en: 'Private ITI', hi: 'निजी ITI', te: 'ప్రైవేట్ ITI' },
  pmkvy: { en: 'PMKVY Skill Centre', hi: 'PMKVY कौशल केंद्र', te: 'PMKVY నైపుణ్య కేంద్రం' },
}

export const SOURCES = {
  tracer: 'Alumni IVR tracer calls',
  plfs: 'PLFS 2023-24 wage estimates (Telangana)',
  ncs: 'National Career Service portal snapshot',
  nqr: 'NCVET National Qualification Register',
  mis: 'Provider MIS',
  inspection: 'Skill officer inspection',
}

// Verification rules (also shown on the admin dashboard).
export const RULES = {
  minRespondents: 25, // tracer sample needed before a number is "verified"
  overReportGap: 10, // claim − tracer placement, in percentage points, that raises a flag
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']

export function buildRawSources() {
  const centres = []
  const claims = []
  const tracers = []
  for (const d of DISTRICTS) {
    for (const t of TRADES) {
      const types = t.kind === 'ITI' ? ['govt', 'private'] : ['pmkvy', 'pmkvy']
      types.forEach((type, idx) => {
        const town = type === 'govt' ? d.towns[0] : d.towns[1 + ((idx + t.id.length) % 2)]
        const s = `${d.id}|${t.id}|${type}|${idx}`
        const id = `${d.id}-${t.id}-${type}-${idx}`

        // What really happens to trainees (only observable through tracer calls).
        const typeBoost = type === 'govt' ? 4 : type === 'private' ? -3 : -6
        const truePlacement = clampPct(t.placement + typeBoost + between(s + 'p', -6, 6))
        const trueRetention = Math.round(truePlacement - between(s + 'r', 7, 14))
        const factor = d.wage * (type === 'govt' ? 1.0 : type === 'private' ? 0.97 : 0.95) * between(s + 'w', 0.96, 1.05)
        const trueLow = round500(t.earn[0] * factor)
        const trueHigh = round500(t.earn[1] * factor)

        centres.push({
          id,
          districtId: d.id,
          tradeId: t.id,
          type,
          town,
          km: type === 'govt' ? Math.round(between(s + 'k', 2, 8)) : Math.round(between(s + 'k', 9, 34)),
          seats: type === 'pmkvy' ? 30 : Math.round(between(s + 'se', 2, 5)) * 20,
          fee: type === 'pmkvy' ? 0 : type === 'govt' ? round500(between(s + 'fee', 900, 2400)) : round500(between(s + 'fee', 14000, 24000)),
          stipend: round500(between(s + 'st', 8500, 10000) * (d.wage > 1.1 ? 1.08 : 1)),
          girlsHostel: type === 'govt' ? rand(s + 'gh') > 0.25 : rand(s + 'gh') > 0.6,
          boysHostel: rand(s + 'bh') > 0.35,
          womenInstructors: Math.max(1, Math.round(between(s + 'wi', 1, t.women > 40 ? 9 : 4))),
          cctv: rand(s + 'cc') > 0.15,
          grievanceCell: type !== 'pmkvy' || rand(s + 'gc') > 0.3,
          busPass: rand(s + 'bp') > 0.3,
          inspectedOn: `${MONTHS[Math.floor(rand(s + 'i') * MONTHS.length)]} 2026`,
        })

        // Self-reported MIS figures: private and short-term centres tend to round up.
        const inflate = type === 'govt' ? between(s + 'ci', 0, 4) : type === 'private' ? between(s + 'ci', 1, 16) : between(s + 'ci', 4, 24)
        const earnInflate = type === 'govt' ? 1 : 1 + between(s + 'ce', 0, 0.12)
        claims.push({
          centreId: id,
          placement: clampPct(truePlacement + inflate),
          earnLow: round500(trueLow * earnInflate),
          earnHigh: round500(trueHigh * earnInflate),
          women: Math.round(Math.max(2, t.women + between(s + 'f', -5, 7))),
          alumni: Math.round(between(s + 'a', 38, 160)),
          reportedOn: `${MONTHS[Math.floor(rand(s + 'cr') * MONTHS.length)]} 2026`,
        })

        // Tracer calls: every Govt ITI, most private ITIs, about half the short-term centres.
        const hasTracer = type === 'govt' || rand(s + 'th') < (type === 'private' ? 0.75 : 0.55)
        if (hasTracer) {
          const respondents = Math.round(type === 'govt' ? between(s + 'n', 40, 120) : between(s + 'n', 14, 90))
          tracers.push({
            centreId: id,
            respondents,
            placed6: Math.round((respondents * truePlacement) / 100),
            employed12: Math.round((respondents * trueRetention) / 100),
            earnP25: trueLow,
            earnP75: trueHigh,
            calledOn: `${MONTHS[Math.floor(rand(s + 'm') * MONTHS.length)]} 2026`,
          })
        }
      })
    }
  }
  return { centres, claims, tracers }
}

export function verifyOutcomes({ centres, claims, tracers }) {
  const claimBy = new Map(claims.map((c) => [c.centreId, c]))
  const tracerBy = new Map(tracers.map((t) => [t.centreId, t]))
  const published = []
  const anomalies = []

  for (const c of centres) {
    const claim = claimBy.get(c.id)
    const tracer = tracerBy.get(c.id)
    const usable = tracer && tracer.respondents >= RULES.minRespondents

    let placement, retention, earnLow, earnHigh, badge, source, verifiedOn, rule
    if (usable) {
      placement = Math.round((tracer.placed6 / tracer.respondents) * 100)
      retention = Math.round((tracer.employed12 / tracer.respondents) * 100)
      earnLow = tracer.earnP25
      earnHigh = tracer.earnP75
      badge = 'verified'
      source = `${SOURCES.tracer} (n=${tracer.respondents}) + DGT-ITI MIS`
      verifiedOn = tracer.calledOn
      rule = `Tracer sample n=${tracer.respondents} ≥ ${RULES.minRespondents}: published tracer figures`
      const gap = claim.placement - placement
      if (gap > RULES.overReportGap) {
        anomalies.push({ centreId: c.id, districtId: c.districtId, tradeId: c.tradeId, claimed: claim.placement, traced: placement, gap })
        rule += `; centre claimed ${claim.placement}% (over-reported by ${gap} pts)`
      }
    } else {
      placement = claim.placement
      retention = Math.max(30, claim.placement - 9)
      earnLow = claim.earnLow
      earnHigh = claim.earnHigh
      badge = 'provider'
      source = tracer
        ? `${SOURCES.mis} (tracer sample n=${tracer.respondents} too small to verify)`
        : `${SOURCES.mis} (self-reported, tracer calls pending)`
      verifiedOn = claim.reportedOn
      rule = tracer ? `Tracer sample n=${tracer.respondents} < ${RULES.minRespondents}: showing centre's claim` : 'No tracer calls yet: showing centre claim'
    }

    published.push({
      ...c,
      name: {
        en: `${PROVIDER_TYPES[c.type].en}, ${TOWNS[c.town].en}`,
        hi: `${PROVIDER_TYPES[c.type].hi}, ${TOWNS[c.town].hi}`,
        te: `${PROVIDER_TYPES[c.type].te}, ${TOWNS[c.town].te}`,
      },
      placement,
      retention,
      earnLow,
      earnHigh,
      year3: round500(((earnLow + earnHigh) / 2) * between(c.id + 'y', 1.32, 1.45)),
      women: claim.women,
      alumni: claim.alumni,
      earnBadge: badge,
      placeBadge: badge,
      source,
      verifiedOn,
      rule,
      claimPlacement: claim.placement,
      tracerRespondents: tracer?.respondents ?? 0,
      flagged: anomalies.some((a) => a.centreId === c.id),
    })
  }

  const verified = published.filter((p) => p.earnBadge === 'verified').length
  return {
    published,
    anomalies,
    stats: { records: published.length, verified, providerReported: published.length - verified, flagged: anomalies.length, tracerCalls: tracers.reduce((a, t) => a + t.respondents, 0) },
  }
}

// Published records in use by the UI. Start from the local build; replaced in place
// by the server's records when the outcome API is reachable (see src/lib/api.js).
const initial = verifyOutcomes(buildRawSources())
export const PROVIDERS = initial.published
export const VERIFICATION = { anomalies: initial.anomalies, stats: initial.stats, source: 'bundled' }

export function setPublished(payload) {
  PROVIDERS.splice(0, PROVIDERS.length, ...payload.published)
  VERIFICATION.anomalies = payload.anomalies
  VERIFICATION.stats = payload.stats
  VERIFICATION.source = 'server'
}

export const providersFor = (districtId, tradeId) =>
  PROVIDERS.filter((p) => p.districtId === districtId && p.tradeId === tradeId).sort((a, b) => b.placement - a.placement)

// Best centre: verified records first, then highest placement.
export const bestProvider = (districtId, tradeId) => {
  const list = providersFor(districtId, tradeId)
  return list.find((p) => p.earnBadge === 'verified') ?? list[0]
}

// Open vacancies (National Career Service snapshot) for a trade in a district.
export const vacancies = (districtId, tradeId) => {
  const d = DISTRICTS.find((x) => x.id === districtId)
  return Math.round(between(`${districtId}|${tradeId}|vac`, 60, 340) * (d?.wage ?? 1))
}
