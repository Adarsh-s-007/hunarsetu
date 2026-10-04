import { useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { TriangleAlert, Table2, ChartLine, MessageCircle } from 'lucide-react'
import { useApp } from '../AppContext'
import { DISTRICTS } from '../data/districts'
import { TRADES, EDUCATION, eligibleTrades } from '../data/trades'
import { simulate, ASSUMPTIONS } from '../lib/simulate'
import { inr, inrLakh } from '../lib/format'
import LineChart from '../components/LineChart'
import { TrustBadge, DemoNote } from '../components/Trust'
import Icon from '../components/Icon'

// Categorical slots 1–3 of the validated chart palette.
const COLORS = { trade: '#2a78d6', degree: '#eb6834', now: '#1baf7a' }

export default function Simulator() {
  const { t, L, session } = useApp()
  const [params, setParams] = useSearchParams()
  const tradeId = params.get('t') ?? (session?.profile?.trade && session.profile.trade !== 'unsure' ? session.profile.trade : 'electrician')
  const districtId = params.get('d') ?? session?.profile?.district ?? 'hanumakonda'
  const [edu, setEdu] = useState(session?.profile?.edu ?? 'class10')
  const [apprentice, setApprentice] = useState(true)
  const [years, setYears] = useState(5)
  const [table, setTable] = useState(false)

  const update = (k, v) => {
    const next = new URLSearchParams(params)
    next.set(k, v)
    if (!next.get('t')) next.set('t', tradeId)
    if (!next.get('d')) next.set('d', districtId)
    setParams(next, { replace: true })
  }

  const sim = useMemo(() => simulate({ tradeId, districtId, edu, apprenticeship: apprentice, years }), [tradeId, districtId, edu, apprentice, years])
  const eligible = eligibleTrades(edu).some((x) => x.id === tradeId)
  const tradeName = L(sim.trade.name)
  const hasApprentice = sim.trade.staircase.some((s) => s.stipend)

  const labels = { trade: `${t('sim.trade')}: ${tradeName}`, degree: t('sim.degree'), now: t('sim.now') }
  const series = ['trade', 'degree', 'now'].map((k) => ({ key: k, label: labels[k], color: COLORS[k], values: sim.monthly[k] }))

  const yearly = Array.from({ length: years }, (_, y) => ({
    year: y + 1,
    ...Object.fromEntries(['trade', 'degree', 'now'].map((k) => [k, sim.monthly[k].slice(y * 12, y * 12 + 12).reduce((a, b) => a + b, 0)])),
  }))
  const best = ['trade', 'degree', 'now'].reduce((a, b) => (sim.totals[b] > sim.totals[a] ? b : a))

  return (
    <div className="page">
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">{t('nav.simulator')}</span>
          <h1>{t('sim.title')}</h1>
          <p className="lead">{t('sim.sub')}</p>
        </div>
      </section>
      <div className="container">
        <div className="filter-row">
          <label className="field">
            <span>{t('c.trade')}</span>
            <select value={tradeId} onChange={(e) => update('t', e.target.value)}>
              {TRADES.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {L(tr.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('c.district')}</span>
            <select value={districtId} onChange={(e) => update('d', e.target.value)}>
              {DISTRICTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {L(d.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('setup.edu')}</span>
            <select value={edu} onChange={(e) => setEdu(e.target.value)}>
              {EDUCATION.map((x) => (
                <option key={x.id} value={x.id}>
                  {L(x.label)}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>{t('sim.years')}</span>
            <div className="seg seg-sm">
              {[5, 10].map((n) => (
                <button key={n} type="button" className={years === n ? 'is-on' : ''} aria-pressed={years === n} onClick={() => setYears(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          {hasApprentice && (
            <label className="check">
              <input type="checkbox" checked={apprentice} onChange={(e) => setApprentice(e.target.checked)} />
              <span>{t('sim.apprentice')}</span>
            </label>
          )}
        </div>

        {!eligible && (
          <div className="notice notice-warn">
            <TriangleAlert size={18} aria-hidden="true" />
            <span>
              {tradeName} needs Class 10. With {L(EDUCATION.find((x) => x.id === edu).label)}, consider:{' '}
              {eligibleTrades(edu)
                .map((x) => L(x.name))
                .join(', ')}
              .
            </span>
          </div>
        )}

        <div className="sim-tiles">
          {['trade', 'degree', 'now'].map((k) => (
            <div key={k} className={`sim-tile ${k === best ? 'is-best' : ''}`}>
              <span className="sim-tile-key">
                <span className="legend-line" style={{ background: COLORS[k] }} />
                {k === 'trade' ? (
                  <>
                    <Icon name={sim.trade.icon} size={16} /> {labels.trade}
                  </>
                ) : (
                  labels[k]
                )}
              </span>
              <span className="sim-tile-label">{t('sim.totalN', { n: years })}</span>
              <span className="sim-tile-value">{inrLakh(sim.totals[k])}</span>
              <span className="sim-tile-sub">
                {t('sim.monthlyEnd')}: <strong>{inr(sim.finalMonthly[k])}</strong>
              </span>
            </div>
          ))}
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2>
              {t('sim.expected')} · {L(sim.district.name)}
            </h2>
            <div className="seg seg-sm">
              <button type="button" className={!table ? 'is-on' : ''} aria-pressed={!table} onClick={() => setTable(false)}>
                <ChartLine size={15} aria-hidden="true" /> {t('c.chart')}
              </button>
              <button type="button" className={table ? 'is-on' : ''} aria-pressed={table} onClick={() => setTable(true)}>
                <Table2 size={15} aria-hidden="true" /> {t('c.table')}
              </button>
            </div>
          </div>
          {table ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('c.year')}</th>
                    {series.map((s) => (
                      <th key={s.key} className="num">
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {yearly.map((r) => (
                    <tr key={r.year}>
                      <td>
                        {t('c.year')} {r.year}
                      </td>
                      {series.map((s) => (
                        <td key={s.key} className="num">
                          {inr(r[s.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <LineChart
              series={series}
              height={340}
              xLabel={(i) => `${t('c.year')} ${Math.floor(i / 12) + 1} · ${(i % 12) + 1}/12`}
              yearLabel={t('c.year')}
              ariaLabel={`Expected monthly earnings over ${years} years for three paths`}
            />
          )}
          <p className="chart-note">
            Below zero means money spent on fees while studying.
          </p>
        </section>

        <section className="panel">
          <details className="assumptions-box">
            <summary>{t('sim.assumptions')}</summary>
            <ul className="assumptions">
            <li>
              <TrustBadge kind={sim.provider.earnBadge} small /> First-job pay {inr(sim.provider.earnLow)}–{inr(sim.provider.earnHigh)} a month at {L(sim.provider.name)}; grows{' '}
              {Math.round(ASSUMPTIONS.tradeGrowth * 100)}% a year.
            </li>
            <li>
              <TrustBadge kind={sim.provider.placeBadge} small /> {sim.provider.placement}% of trainees placed within 6 months; others earn unskilled wages.
            </li>
            {sim.usedApprenticeship && (
              <li>
                <TrustBadge kind="verified" small /> Apprenticeship stipend {inr(sim.provider.stipend)} a month for 12 months (NAPS rate).
              </li>
            )}
            <li>
              <TrustBadge kind="estimated" small /> Degree path: {sim.studyYears} years of study ({edu === 'class12' ? 'degree' : 'Inter + degree'}), then a graduate job at{' '}
              {inr(ASSUMPTIONS.gradStart * sim.district.wage)} a month with a {Math.round(ASSUMPTIONS.gradEmployment * 100)}% chance of employment (PLFS youth graduate
              employment).
            </li>
            <li>
              <TrustBadge kind="estimated" small /> Unskilled work: {inr(ASSUMPTIONS.unskilledStart * sim.district.wage)} a month when work is available (about 3 weeks in 4), growing{' '}
              {Math.round(ASSUMPTIONS.unskilledGrowth * 100)}% a year (PLFS casual wages, Telangana).
            </li>
          </ul>
          </details>
          <Link to="/counsel" className="btn btn-outline">
            <MessageCircle size={16} aria-hidden="true" /> {t('tr.ask')}
          </Link>
        </section>
        <DemoNote />
      </div>
    </div>
  )
}
