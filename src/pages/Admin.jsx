import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { ArrowUp, ArrowDown, Siren, Download, Flag, Radio, Info } from 'lucide-react'
import { useApp } from '../AppContext'
import {
  MANDALS, mandalMix, OBJECTIONS_BY_ROLE, OBJECTION_ORDER, ROLE_ORDER, STANCE_SHIFT, CONVICTION_TREND, PLAYBOOK, FUNNEL, KPIS, ESCALATIONS, SUGGESTED_ACTION,
} from '../data/admin'
import { ROLES } from '../engine/roles'
import { OBJECTIONS } from '../engine/taxonomy'
import { num } from '../lib/format.js'
import { fetchLive, updateEscalation } from '../lib/api.js'
import { VERIFICATION, PROVIDERS, RULES } from '../data/outcomes.js'
import { DISTRICTS } from '../data/districts.js'
import { getTrade } from '../data/trades.js'
import { TrustBadge } from '../components/Trust'
import Icon from '../components/Icon'

// Sequential ramps (one hue, light → dark).
const ORANGE = ['#fde0cf', '#f7b38f', '#ef8a5a', '#d9622f', '#a8441a']
const BLUE = ['#b7d3f6', '#86b6ef', '#3987e5', '#256abf', '#104281']
const step = (ramp, v, lo, hi) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(((v - lo) / (hi - lo)) * ramp.length)))]
const ink = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return l > 0.6 ? '#132424' : '#ffffff'
}

const METRICS = {
  resistance: { label: 'How often families say no', ramp: ORANGE, lo: 25, hi: 80, fmt: (v) => `${v} / 100`, legend: ['Rarely', 'Very often'] },
  consent: { label: 'Families who said yes', ramp: BLUE, lo: 35, hi: 75, fmt: (v) => `${v}%`, legend: ['35%', '75%'] },
}

function Kpi({ label, value, delta, good, sub }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {delta && (
        <span className={`kpi-delta ${good ? 'is-good' : 'is-bad'}`}>
          {delta.startsWith('−') || delta.startsWith('-') ? <ArrowDown size={13} aria-hidden="true" /> : <ArrowUp size={13} aria-hidden="true" />}
          {delta}
        </span>
      )}
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  )
}

function useTip() {
  const [tip, setTip] = useState(null)
  const show = (e, content) => {
    const host = e.currentTarget.closest('.viz')
    const r = host.getBoundingClientRect()
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, content })
  }
  const el = tip && (
    <div className="viz-tip" style={{ left: tip.x + 12, top: tip.y + 12 }}>
      {tip.content}
    </div>
  )
  return { show, hide: () => setTip(null), el }
}

function ObjectionBars({ scale }) {
  const { L } = useApp()
  const tip = useTip()
  const rows = OBJECTION_ORDER.map((k) => ({ key: k, parts: ROLE_ORDER.map((r) => ({ role: r, v: Math.round(OBJECTIONS_BY_ROLE[k][r] * scale) })) }))
  rows.forEach((r) => (r.total = r.parts.reduce((a, p) => a + p.v, 0)))
  rows.sort((a, b) => b.total - a.total)
  const max = Math.max(...rows.map((r) => r.total))
  return (
    <div className="viz">
      <div className="chart-legend">
        {ROLE_ORDER.map((r) => (
          <span key={r}>
            <span className="legend-swatch" style={{ background: ROLES[r].color }} />
            {ROLES[r].label.en}
          </span>
        ))}
      </div>
      <div className="hbars">
        {rows.map((row) => (
          <div key={row.key} className="hbar-row">
            <span className="hbar-label">
              <Icon name={OBJECTIONS[row.key].icon} size={14} /> {L(OBJECTIONS[row.key].label)}
            </span>
            <span className="hbar-track">
              <span className="hbar-stack" style={{ width: `${(row.total / max) * 100}%` }}>
                {row.parts.map((p) => (
                  <span
                    key={p.role}
                    className="hbar-seg"
                    tabIndex={0}
                    style={{ flexGrow: p.v, background: ROLES[p.role].color }}
                    onPointerMove={(e) =>
                      tip.show(
                        e,
                        <>
                          <strong>{num(p.v)}</strong> times, by {ROLES[p.role].label.en}
                          <br />
                          <span>{OBJECTIONS[row.key].label.en}</span>
                        </>,
                      )
                    }
                    onPointerLeave={tip.hide}
                    aria-label={`${OBJECTIONS[row.key].label.en}: ${p.v} raised by ${ROLES[p.role].label.en}`}
                  />
                ))}
              </span>
              <span className="hbar-value">{num(row.total)}</span>
            </span>
          </div>
        ))}
      </div>
      {tip.el}
    </div>
  )
}

function StanceDumbbell() {
  const W = 520
  const H = STANCE_SHIFT.length * 44 + 40
  const x = (v) => 110 + ((v + 1) / 2) * (W - 140)
  const tip = useTip()
  return (
    <div className="viz">
      <svg viewBox={`0 0 ${W} ${H}`} className="dumbbell" role="img" aria-label="Average stance at start and end of session by family role">
        {[-1, -0.5, 0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={14} y2={H - 26} className={v === 0 ? 'axis-base' : 'grid'} />
            <text x={x(v)} y={H - 8} textAnchor="middle" className="tick">
              {v === -1 ? 'Against' : v === 1 ? 'For it' : v === 0 ? 'Unsure' : ''}
            </text>
          </g>
        ))}
        {STANCE_SHIFT.map((s, i) => {
          const y = 34 + i * 44
          return (
            <g key={s.role} tabIndex={0} onPointerMove={(e) => tip.show(e, <><strong>{s.start.toFixed(2)} → {s.end.toFixed(2)}</strong><br /><span>{ROLES[s.role].label.en} · +{(s.end - s.start).toFixed(2)} more sure</span></>)} onPointerLeave={tip.hide}>
              <rect x={0} y={y - 18} width={W} height={36} fill="transparent" />
              <text x={0} y={y} dominantBaseline="middle" className="dumb-label">
                {ROLES[s.role].label.en}
              </text>
              <line x1={x(s.start)} x2={x(s.end)} y1={y} y2={y} stroke="#9bb3b0" strokeWidth="2" />
              <circle cx={x(s.start)} cy={y} r="6" fill="var(--chart-surface)" stroke="#7d8a89" strokeWidth="2" />
              <circle cx={x(s.end)} cy={y} r="6" fill="#2a78d6" stroke="var(--chart-surface)" strokeWidth="2" />
              <text x={x(s.end) + 12} y={y} dominantBaseline="middle" className="end-label">
                +{(s.end - s.start).toFixed(2)}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="chart-legend">
        <span>
          <span className="legend-dot is-hollow" /> Start of talk
        </span>
        <span>
          <span className="legend-dot" style={{ background: '#2a78d6' }} /> End of talk
        </span>
      </div>
      {tip.el}
    </div>
  )
}

function TrendChart() {
  const W = 520
  const H = 220
  const m = { l: 40, r: 44, t: 14, b: 28 }
  const n = CONVICTION_TREND.length
  const x = (i) => m.l + (i / (n - 1)) * (W - m.l - m.r)
  const y = (v) => m.t + (1 - v / 0.5) * (H - m.t - m.b)
  const [hover, setHover] = useState(null)
  const d = CONVICTION_TREND.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ')
  const area = `${d} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`
  const last = CONVICTION_TREND.at(-1)
  return (
    <div className="viz">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="trend"
        role="img"
        aria-label="Weekly average Conviction Delta"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          setHover(Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / (W - m.l - m.r)) * (n - 1)))))
        }}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 0.1, 0.2, 0.3, 0.4, 0.5].map((v) => (
          <g key={v}>
            <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'axis-base' : 'grid'} />
            <text x={m.l - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" className="tick">
              +{v.toFixed(1)}
            </text>
          </g>
        ))}
        {CONVICTION_TREND.map((p, i) =>
          i % 2 === 0 ? (
            <text key={p.week} x={x(i)} y={H - 8} textAnchor="middle" className="tick">
              {p.week}
            </text>
          ) : null,
        )}
        <path d={area} fill="#2a78d6" opacity="0.1" />
        <path d={d} fill="none" stroke="#2a78d6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(n - 1)} cy={y(last.value)} r="4.5" fill="#2a78d6" stroke="var(--chart-surface)" strokeWidth="2" />
        <text x={x(n - 1) + 8} y={y(last.value)} dominantBaseline="middle" className="end-label">
          +{last.value.toFixed(2)}
        </text>
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={H - m.b} className="crosshair" />
            <circle cx={x(hover)} cy={y(CONVICTION_TREND[hover].value)} r="4.5" fill="#2a78d6" stroke="var(--chart-surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="viz-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: 8 }}>
          <strong>+{CONVICTION_TREND[hover].value.toFixed(2)}</strong> <span>{CONVICTION_TREND[hover].week}</span>
        </div>
      )}
    </div>
  )
}

function Funnel({ scale }) {
  const max = FUNNEL[0].value * scale
  return (
    <div className="funnel">
      {FUNNEL.map((f, i) => {
        const v = Math.round(f.value * scale)
        return (
          <div key={f.stage} className="funnel-row">
            <span className="funnel-label">{f.stage}</span>
            <span className="funnel-track">
              <span className="funnel-bar" style={{ width: `${(v / max) * 100}%`, background: BLUE[4 - i] }} />
            </span>
            <span className="funnel-value">
              {num(v)}
              {i > 0 && <small>{Math.round((f.value / FUNNEL[i - 1].value) * 100)}%</small>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function Playbook() {
  const { L } = useApp()
  const tip = useTip()
  return (
    <div className="viz table-wrap">
      <table className="heat-table">
        <thead>
          <tr>
            <th>Worry</th>
            {PLAYBOOK.columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {OBJECTION_ORDER.map((k) => {
            const row = PLAYBOOK.rows[k]
            const best = Math.max(...row)
            return (
              <tr key={k}>
                <th scope="row">
                  <Icon name={OBJECTIONS[k].icon} size={14} /> {L(OBJECTIONS[k].label)}
                </th>
                {row.map((v, i) => {
                  const bg = step(BLUE, v, 20, 85)
                  return (
                    <td
                      key={i}
                      style={{ background: bg, color: ink(bg) }}
                      className={v === best ? 'is-best' : ''}
                      onPointerMove={(e) => tip.show(e, <><strong>{v}% of worries sorted</strong><br /><span>{OBJECTIONS[k].label.en} · {PLAYBOOK.columns[i]}</span></>)}
                      onPointerLeave={tip.hide}
                    >
                      {v}%
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      {tip.el}
    </div>
  )
}

const REASON_TEXT = { distress: 'Someone may be upset', lowConfidence: 'AI did not understand', unresolved: 'Same worry came back', sensitive: 'Private topic', requested: 'Asked for a person' }
const ENGINE_NAMES = { claude: 'Claude', pollinations: 'Free AI', groq: 'Groq (free)', gemini: 'Gemini (free)', offline: 'Offline' }

const ago = (ms) => {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000))
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`
}

// Real sessions recorded by this server (anonymised signals only: no names, numbers or messages).
function LiveFeed({ live }) {
  const { L } = useApp()
  if (live === null) return <p className="panel-note">Loading…</p>
  if (live === false)
    return (
      <p className="panel-note">
        The HunarSetu server is not reachable, so only example data is shown. Run <code>npm run dev</code> or <code>npm start</code> to see real families.
      </p>
    )
  const roles = Object.values(live.stanceByRole)
  return (
    <>
      <div className="live-kpis">
        <div>
          <span>Families so far</span>
          <strong>{num(live.sessions)}</strong>
        </div>
        <div>
          <span>Last 24 hours</span>
          <strong>{num(live.today)}</strong>
        </div>
        <div>
          <span>More sure after talking (average)</span>
          <strong>
            {live.avgConviction >= 0 ? '+' : '−'}
            {Math.abs(live.avgConviction).toFixed(2)}
          </strong>
        </div>
        <div>
          <span>Handed to a person</span>
          <strong>{num(live.escalated)}</strong>
        </div>
      </div>
      {live.recent.length === 0 ? (
        <p className="panel-note">No families yet. Start a chat in “Ask a question” and it shows here within seconds.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Place</th>
                <th>Family</th>
                <th>Worries</th>
                <th className="num">More sure?</th>
                <th>Answered by</th>
                <th>Needs a person</th>
              </tr>
            </thead>
            <tbody>
              {live.recent.map((r) => (
                <tr key={r.id + r.at}>
                  <td>{ago(r.at)}</td>
                  <td>
                    {r.place ? (DISTRICTS.find((d) => d.id === r.place)?.name.en ?? r.place) : '—'}
                    <span className="cell-sub">{({ en: 'English', hi: 'Hindi', te: 'Telugu' })[r.lang] ?? r.lang}</span>
                  </td>
                  <td>{r.members.map((m) => ROLES[m]?.label.en).join(', ')}</td>
                  <td>{r.worries.length ? r.worries.map((w) => OBJECTIONS[w]?.label.en).join(', ') : '—'}</td>
                  <td className="num">
                    {r.conviction >= 0 ? '+' : '−'}
                    {Math.abs(r.conviction).toFixed(2)}
                  </td>
                  <td>{ENGINE_NAMES[r.engine] ?? r.engine}</td>
                  <td>{r.escalated ? <span className="status status-waiting">Yes</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {roles.length > 0 && (
        <div className="live-roles">
          {roles.map((s) => (
            <span key={s.role} className="live-role">
              <span className="dot" style={{ background: ROLES[s.role]?.color }} />
              {L(ROLES[s.role]?.label)}: {s.start.toFixed(2)} → {s.end.toFixed(2)} <small>(n={s.n})</small>
            </span>
          ))}
        </div>
      )}
    </>
  )
}

// What the Verified Outcome Data Engine found when it cross-checked centres' claims.
function TrustPanel() {
  const { L } = useApp()
  const [open, setOpen] = useState(null)
  const s = VERIFICATION.stats
  const flagged = VERIFICATION.anomalies.slice(0, 6).map((a) => ({ ...a, p: PROVIDERS.find((x) => x.id === a.centreId) }))
  const pctVerified = Math.round((s.verified / s.records) * 100)
  return (
    <>
      <div className="trust-bar" role="img" aria-label={`${s.verified} of ${s.records} centres checked`}>
        <span className="trust-bar-verified" style={{ width: `${pctVerified}%` }} />
        <span className="trust-bar-provider" style={{ width: `${100 - pctVerified}%` }} />
      </div>
      <div className="trust-counts">
        <span>
          <TrustBadge kind="verified" small /> <strong>{s.verified}</strong> of {s.records} centres checked, using {num(s.tracerCalls)} calls to past students
        </span>
        <span>
          <TrustBadge kind="provider" small /> <strong>{s.providerReported}</strong> not checked yet (centre’s own numbers)
        </span>
        <span className="trust-flag">
          <Flag size={14} aria-hidden="true" /> <strong>{s.flagged}</strong> centres said their job rate was over {RULES.overReportGap} points higher than students told us
        </span>
      </div>
      <p className="panel-note">
        Rule: a number is marked “Checked” only when at least {RULES.minRespondents} past students answered our calls. Otherwise families see the centre’s own number,
        clearly labelled. Data: {VERIFICATION.source === 'server' ? 'live from the HunarSetu database' : 'saved copy'}.
      </p>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Centre</th>
              <th>Course</th>
              <th className="num">Centre said</th>
              <th className="num">Students said</th>
              <th className="num">Difference</th>
            </tr>
          </thead>
          <tbody>
            {flagged.map((a) => (
              <tr key={a.centreId}>
                <td>
                  <button type="button" className="link-btn" onClick={() => setOpen(open === a.centreId ? null : a.centreId)} aria-expanded={open === a.centreId}>
                    {a.p ? L(a.p.name) : a.centreId}
                  </button>
                  {open === a.centreId && a.p && <span className="cell-sub">{a.p.rule}</span>}
                </td>
                <td>{L(getTrade(a.tradeId).name)}</td>
                <td className="num">{a.claimed}%</td>
                <td className="num">{a.traced}%</td>
                <td className="num">
                  <strong>+{a.gap} pts</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function Admin() {
  const { L, backend } = useApp()
  const [period, setPeriod] = useState(90)
  const [metric, setMetric] = useState('resistance')
  const [selected, setSelected] = useState('nadikuda')
  const [live, setLive] = useState(null)
  const [liveEsc, setLiveEsc] = useState([])
  const [tick, setTick] = useState(0)
  const reload = () => setTick((n) => n + 1)
  useEffect(() => {
    let on = true
    const load = () =>
      fetchLive()
        .then(([a, e]) => {
          if (!on) return
          setLive(a)
          setLiveEsc(e)
        })
        .catch(() => on && setLive(false))
    load()
    const id = setInterval(load, 15000)
    return () => {
      on = false
      clearInterval(id)
    }
  }, [tick])
  const setStatus = async (id, status) => {
    await updateEscalation(id, { status }).catch(() => {})
    reload()
  }
  const liveByMandal = Object.fromEntries((live?.byMandal ?? []).map((m) => [m.key, m]))
  const scale = period / 90
  const M = METRICS[metric]
  const ranked = useMemo(() => [...MANDALS].sort((a, b) => b.resistance - a.resistance), [])
  const sel = MANDALS.find((m) => m.id === selected)
  const mix = mandalMix(sel)
  const maxSessions = Math.max(...MANDALS.map((m) => m.sessions))


  const exportCsv = () => {
    const rows = [['mandal', 'sessions', 'resistance_index', 'consent_pct', 'top_objection', 'girls_share_pct'], ...MANDALS.map((m) => [m.name, Math.round(m.sessions * scale), m.resistance, m.consent, m.top, m.girlsShare])]
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `hunarsetu-resistance-${period}d.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const waiting = liveEsc.filter((e) => e.status === 'Waiting').length
  const queue = [
    ...liveEsc.map((e) => ({
      id: e.id,
      ago: ago(e.created_at),
      place: e.mandal ?? DISTRICTS.find((d) => d.id === e.district)?.name.en ?? '—',
      lang: ({ en: 'English', hi: 'Hindi', te: 'Telugu' })[e.lang] ?? '—',
      about:
        e.kind === 'ambassador'
          ? 'Wants to talk to a Parent Ambassador'
          : e.topics.length
            ? e.topics.map((k) => OBJECTIONS[k]?.label.en).join(', ')
            : e.reasons.map((r) => REASON_TEXT[r] ?? r).join(', ') || 'General',
      who: e.who ? ROLES[e.who]?.label.en : 'Family',
      phone: e.contact,
      status: e.status,
      woman: e.woman,
      kind: e.kind,
      live: true,
    })),
    ...ESCALATIONS.map((e) => ({ ...e, ago: `${e.ago} ago`, place: e.mandal, about: e.reason })),
  ]

  return (
    <div className="page admin">
      <section className="page-head">
        <div className="container admin-head">
          <div>
            <span className="eyebrow">For officials · Hanumakonda & Warangal pilot</span>
            <h1>Where and why families say no</h1>
            <p className="lead">Use this to plan visits, camps and calls. No names or messages are shown.</p>
          </div>
          <div className="filter-row">
            <div className="field">
              <span>Period</span>
              <div className="seg seg-sm">
                {[30, 90].map((p) => (
                  <button key={p} type="button" className={period === p ? 'is-on' : ''} aria-pressed={period === p} onClick={() => setPeriod(p)}>
                    Last {p} days
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="btn btn-outline" onClick={exportCsv}>
              <Download size={16} aria-hidden="true" /> Download CSV
            </button>
          </div>
        </div>
      </section>

      <div className="container">
        <nav className="admin-nav" aria-label="Dashboard sections">
          {[
            ['where', '1. Where'],
            ['why', '2. Why'],
            ['calls', `3. Calls to make${waiting ? ` (${waiting})` : ''}`],
            ['better', '4. Getting better?'],
            ['works', '5. What works'],
            ['live', '6. Live sessions'],
            ['checks', '7. Number checks'],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>

        {backend?.storage === 'temporary' && (
          <p className="notice">
            <Info size={16} aria-hidden="true" /> Saved data on this server is temporary: call requests and live families can disappear when Vercel restarts it. To keep them,
            connect Upstash Redis in your Vercel project (Storage tab), then redeploy.
          </p>
        )}

        <div className="kpi-grid kpi-4">
          <Kpi label="Families helped" value={num(KPIS.sessions * scale)} delta={`${Math.round(KPIS.sessionsDelta * 100)}% more than before`} good />
          <Kpi label="Families who said yes" value={`${KPIS.consent}%`} delta={`up from ${KPIS.consentBaseline}%`} good />
          <Kpi label="More sure after talking" value={`+${KPIS.conviction.toFixed(2)}`} sub="Conviction Delta, average" />
          <Kpi label="Handed to a person" value={num(KPIS.escalations * scale)} sub={`${KPIS.escalationRate}% of families`} />
        </div>

        <section id="where" className="panel admin-section">
          <div className="panel-head">
            <h2>1. Where do families say no?</h2>
            <div className="seg seg-sm">
              {Object.entries(METRICS).map(([k, v]) => (
                <button key={k} type="button" className={metric === k ? 'is-on' : ''} aria-pressed={metric === k} onClick={() => setMetric(k)}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <p className="section-note">Each circle is a mandal. A bigger circle means more families talked to us; the colour key is under the map. Tap a circle to see why.</p>
          <div className="map-wrap">
            <MapContainer center={[18.0, 79.66]} zoom={10} scrollWheelZoom={false} className="map">
              {/* OpenStreetMap tiles need no API key; greyed in CSS so the data circles stand out. */}
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
              {MANDALS.map((m) => (
                <CircleMarker
                  key={`${m.id}-${metric}-${m.id === selected}`}
                  center={[m.lat, m.lng]}
                  radius={8 + 14 * Math.sqrt(m.sessions / maxSessions)}
                  pathOptions={{ color: m.id === selected ? '#132424' : '#ffffff', weight: m.id === selected ? 3 : 2, fillColor: step(M.ramp, m[metric], M.lo, M.hi), fillOpacity: 0.92 }}
                  eventHandlers={{ click: () => setSelected(m.id) }}
                >
                  <Tooltip direction="top" offset={[0, -6]}>
                    <strong>{m.name}</strong>
                    <br />
                    {M.label}: {M.fmt(m[metric])} · {num(m.sessions * scale)} families
                    <br />
                    Main worry: {OBJECTIONS[m.top].label.en}
                    {liveByMandal[m.name] && (
                      <>
                        <br />
                        Live sessions: {liveByMandal[m.name].sessions}
                      </>
                    )}
                  </Tooltip>
                </CircleMarker>
              ))}
            </MapContainer>
            <div className="map-legend">
              <span>{M.label}</span>
              <span className="ramp">
                {M.ramp.map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </span>
              <span className="ramp-ends">
                <small>{M.legend[0]}</small>
                <small>{M.legend[1]}</small>
              </span>
            </div>
          </div>
          <div className="rank">
            <span className="mix-title">Places where most families say no</span>
            <ol>
              {ranked.slice(0, 5).map((m) => (
                <li key={m.id}>
                  <button type="button" className={m.id === selected ? 'is-on' : ''} onClick={() => setSelected(m.id)}>
                    <span className="rank-name">{m.name}</span>
                    <span className="rank-bar">
                      <span style={{ width: `${m.resistance}%`, background: step(ORANGE, m.resistance, 25, 80) }} />
                    </span>
                    <span className="rank-val">{m.resistance}</span>
                    <span className="rank-why">{OBJECTIONS[m.top].label.en}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="why" className="panel admin-section">
          <div className="panel-head">
            <h2>2. Why do they say no?</h2>
          </div>
          <div className="why-place">
            <div className="why-head">
              <h3>{sel.name}</h3>
              <span>
                {sel.consent}% said yes · girls are {sel.girlsShare}% of learners here
              </span>
            </div>
            <div className="mix">
              {[...mix]
                .sort((a, b) => b.share - a.share)
                .slice(0, 4)
                .map((x) => (
                  <div key={x.key} className="mix-row">
                    <span>
                      <Icon name={OBJECTIONS[x.key].icon} size={13} /> {L(OBJECTIONS[x.key].label)}
                    </span>
                    <span className="mix-track">
                      <span style={{ width: `${x.share * 2.6}%` }} />
                    </span>
                    <span className="mix-val">{x.share}%</span>
                  </div>
                ))}
            </div>
            <div className="action-card">
              <Siren size={18} aria-hidden="true" />
              <div>
                <strong>What to do here</strong>
                <span>{SUGGESTED_ACTION[sel.top]}</span>
              </div>
            </div>
            <p className="section-note">Tap another place on the map or in the list above to see its reasons.</p>
          </div>
          <h3 className="sub-h">Across all places: who raises which worry</h3>
          <ObjectionBars scale={scale} />
        </section>

        <section id="calls" className="panel admin-section">
          <div className="panel-head">
            <h2>3. Calls to make</h2>
            {waiting > 0 && <span className="status status-waiting">{waiting} waiting</span>}
          </div>
          <p className="section-note">Families who asked to talk to a real person. Change the status after you call. This demo is open to everyone, so phone numbers are always shown hidden.</p>
          <ul className="call-list">
            {queue.map((e) => (
              <li key={e.id} className={`call-card ${e.status === 'Waiting' ? 'is-waiting' : ''}`}>
                <div className="call-top">
                  <strong>{e.id}</strong>
                  {e.live ? <span className="live-tag">live</span> : <span className="cell-sub">sample</span>}
                  <span className="call-ago">{e.ago}</span>
                </div>
                <p className="call-about">{e.about}</p>
                <p className="call-who">
                  {e.who} · {e.lang} · {e.place}
                  {e.woman && <span className="call-woman">Wants a woman counsellor</span>}
                </p>
                <div className="call-actions">
                  <span className="cell-sub">{!e.live ? 'Sample row' : e.phone ? `Phone: ${e.phone}` : e.kind === 'chat' ? 'No phone yet (asked in chat)' : 'No phone given'}</span>
                  {e.live ? (
                    <label className="call-status">
                      <span>Status</span>
                      <select className="status-select" value={e.status} onChange={(ev) => setStatus(e.id, ev.target.value)} aria-label={`Status of ${e.id}`}>
                        {['Waiting', 'Called', 'Resolved'].map((st) => (
                          <option key={st}>{st}</option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span className={`status status-${e.status.toLowerCase()}`}>{e.status}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section id="better" className="panel admin-section">
          <div className="panel-head">
            <h2>4. Are families getting more sure?</h2>
          </div>
          <p className="section-note">How each family member felt at the start and at the end of a talk.</p>
          <StanceDumbbell />
          <h3 className="sub-h">Week by week (Conviction Delta)</h3>
          <TrendChart />
          <h3 className="sub-h">From first talk to joining a course</h3>
          <Funnel scale={scale} />
        </section>

        <section id="works" className="panel admin-section">
          <div className="panel-head">
            <h2>5. What answers work?</h2>
          </div>
          <p className="section-note">Share of worries that were sorted, by the kind of answer given. The darker box in each row works best.</p>
          <Playbook />
        </section>

        <section id="live" className="panel admin-section live-panel">
          <div className="panel-head">
            <h2>
              <Radio size={18} aria-hidden="true" /> 6. Live sessions
            </h2>
          </div>
          <p className="section-note">Real families using HunarSetu right now. Updates every 15 seconds.</p>
          <LiveFeed live={live} />
        </section>

        <section id="checks" className="panel admin-section">
          <div className="panel-head">
            <h2>7. Are the numbers honest?</h2>
            <Link to="/numbers" className="btn btn-outline btn-sm">
              See every centre
            </Link>
          </div>
          <p className="section-note">What centres claimed, checked against phone calls to their past students.</p>
          <TrustPanel />
        </section>

        <p className="demo-note">Test version: the map, charts and rows marked “sample” use example data. Rows marked “live” are real.</p>
      </div>
    </div>
  )
}
