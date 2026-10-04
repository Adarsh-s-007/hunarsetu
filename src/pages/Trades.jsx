import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, ArrowRight, BadgeCheck } from 'lucide-react'
import { useApp } from '../AppContext'
import { DISTRICTS } from '../data/districts'
import { TRADES } from '../data/trades'
import { bestProvider } from '../data/outcomes'
import { inrRange, courseLength } from '../lib/format.js'
import Icon from '../components/Icon'
import { TrustBadge, DemoNote } from '../components/Trust'

export function DistrictSelect({ value, onChange }) {
  const { t, L } = useApp()
  return (
    <label className="field">
      <span>{t('c.district')}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {DISTRICTS.map((d) => (
          <option key={d.id} value={d.id}>
            {L(d.name)}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function Trades() {
  const { t, L, lang, session } = useApp()
  const [params, setParams] = useSearchParams()
  const district = params.get('d') ?? session?.profile?.district ?? 'hanumakonda'
  const [kind, setKind] = useState('all')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return TRADES.filter((tr) => (kind === 'all' ? true : kind === 'iti' ? tr.kind === 'ITI' : tr.kind !== 'ITI')).filter((tr) =>
      needle ? Object.values(tr.name).some((n) => n.toLowerCase().includes(needle)) : true,
    )
  }, [kind, q])

  return (
    <div className="page">
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">{t('nav.trades')}</span>
          <h1>{t('tr.title')}</h1>
          <p className="lead">{t('tr.sub')}</p>
          <Link to="/numbers" className="text-link">
            <BadgeCheck size={16} aria-hidden="true" /> {t('num.seeAll')} <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <div className="container">
        <div className="filter-row">
          <DistrictSelect value={district} onChange={(d) => setParams({ d })} />
          <div className="seg seg-sm" role="group" aria-label="Course type">
            {[
              ['all', t('c.all')],
              ['iti', t('tr.long')],
              ['short', t('tr.short')],
            ].map(([v, label]) => (
              <button key={v} type="button" className={kind === v ? 'is-on' : ''} aria-pressed={kind === v} onClick={() => setKind(v)}>
                {label}
              </button>
            ))}
          </div>
          <label className="search">
            <Search size={18} aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('tr.search')} aria-label={t('tr.search')} />
          </label>
        </div>

        <div className="trade-grid">
          {list.map((tr) => {
            const p = bestProvider(district, tr.id)
            return (
              <Link key={tr.id} to={`/trades/${tr.id}?d=${district}`} className="trade-card">
                <div className="trade-card-top">
                  <span className="trade-icon">
                    <Icon name={tr.icon} size={26} />
                  </span>
                  <div>
                    <h3>{L(tr.name)}</h3>
                    <span className="trade-meta">
                      {courseLength(tr.months, lang)}
                      {tr.kind !== 'ITI' && ` · ${t('td.free')}`}
                    </span>
                  </div>
                </div>
                <p className="trade-blurb">{tr.blurb}</p>
                <dl className="trade-stats">
                  <div>
                    <dt>{t('c.firstJob')}</dt>
                    <dd>
                      {inrRange(p.earnLow, p.earnHigh)}
                      <small>{t('c.perMonth')}</small>
                    </dd>
                    <TrustBadge kind={p.earnBadge} small />
                  </div>
                  <div>
                    <dt>{t('c.placement')}</dt>
                    <dd>{p.placement}%</dd>
                    <TrustBadge kind={p.placeBadge} small />
                  </div>
                </dl>
                <span className="trade-cta">
                  {t('tr.view')} <ArrowRight size={16} aria-hidden="true" />
                </span>
              </Link>
            )
          })}
        </div>
        <DemoNote />
      </div>
    </div>
  )
}
