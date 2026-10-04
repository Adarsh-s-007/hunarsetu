import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Calculator, MessageCircle, Check, X, BusFront, Hotel, Cctv, Megaphone, UserRound } from 'lucide-react'
import { useApp } from '../AppContext'
import { getDistrict } from '../data/districts'
import { getTrade, EDUCATION } from '../data/trades'
import { providersFor, vacancies } from '../data/outcomes'
import { STORIES } from '../data/stories'
import { inr, inrRange, num, courseLength } from '../lib/format.js'
import Icon from '../components/Icon'
import CareerStaircase from '../components/CareerStaircase'
import SpeakButton from '../components/SpeakButton'
import { TrustBadge, DemoNote } from '../components/Trust'
import { DistrictSelect } from './Trades'
import NearbyPlaces from '../components/NearbyPlaces'

const YesNo = ({ v }) => (v ? <Check size={16} className="yes" aria-label="Yes" /> : <X size={16} className="no" aria-label="No" />)

export default function TradeDetail() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const { t, L, lang, session } = useApp()
  const trade = getTrade(id)
  const district = params.get('d') ?? session?.profile?.district ?? 'hanumakonda'
  const d = getDistrict(district)
  const providers = providersFor(district, trade.id)
  const stories = STORIES.filter((s) => s.trades.includes(trade.id))

  return (
    <div className="page">
      <section className="page-head trade-head">
        <div className="container">
          <Link to={`/trades?d=${district}`} className="back-link">
            <ArrowLeft size={16} aria-hidden="true" /> {t('nav.trades')}
          </Link>
          <div className="trade-head-row">
            <span className="trade-icon trade-icon-lg">
              <Icon name={trade.icon} size={36} />
            </span>
            <div>
              <h1>{L(trade.name)}</h1>
              <ul className="fact-chips">
                <li>
                  <span>{t('td.length')}</span>
                  <strong>{courseLength(trade.months, lang)}</strong>
                </li>
                <li>
                  <span>{t('td.whoCan')}</span>
                  <strong>{L(EDUCATION.find((e) => e.id === trade.minEdu).label)}</strong>
                </li>
                <li>
                  <span>{t('td.level')}</span>
                  <strong>{trade.nsqf} / 10</strong>
                </li>
                <li>
                  <span>{t('td.fee')}</span>
                  <strong>{trade.kind === 'ITI' ? t('td.lowFee') : t('td.free')}</strong>
                </li>
              </ul>
            </div>
            <SpeakButton text={`${L(trade.name)}. ${trade.blurb}`} />
          </div>
          <p className="lead">{trade.blurb}</p>
          <div className="head-actions">
            <DistrictSelect value={district} onChange={(v) => setParams({ d: v })} />
            <Link to={`/simulator?t=${trade.id}&d=${district}`} className="btn btn-primary">
              <Calculator size={16} aria-hidden="true" /> {t('tr.simulate')}
            </Link>
            <Link to="/counsel" className="btn btn-outline">
              <MessageCircle size={16} aria-hidden="true" /> {t('tr.ask')}
            </Link>
          </div>
        </div>
      </section>

      <div className="container detail-grid">
        <section className="panel span-2">
          <div className="panel-head">
            <h2>
              {t('tr.centres')}: {L(d.name)}
            </h2>
            <span className="panel-note">
              {num(vacancies(district, trade.id))} {t('td.vacancies')} · <TrustBadge kind="verified" small /> NCS snapshot, Sep 2026
            </span>
          </div>
          <div className="centre-cards">
            {providers.map((p) => (
              <article key={p.id} className="centre-card">
                <div className="centre-card-head">
                  <strong>{L(p.name)}</strong>
                  <span>
                    {p.km} km · {p.seats} {t('td.seats')}
                  </span>
                </div>
                <dl className="centre-facts">
                  <div className="is-main">
                    <dt>{t('c.firstJob')}</dt>
                    <dd>{inrRange(p.earnLow, p.earnHigh)}</dd>
                    <TrustBadge kind={p.earnBadge} small />
                  </div>
                  <div className="is-main">
                    <dt>{t('c.placement')}</dt>
                    <dd>{p.placement}%</dd>
                  </div>
                  <div>
                    <dt>{t('td.stillWorking')}</dt>
                    <dd>{p.retention}%</dd>
                  </div>
                  <div>
                    <dt>{t('td.fee')}</dt>
                    <dd>{p.fee === 0 ? t('td.free') : inr(p.fee)}</dd>
                  </div>
                </dl>
                <details className="sources">
                  <summary>{t('td.howChecked')}</summary>
                  <p>
                    {p.rule}. {p.source} · {p.verifiedOn}
                  </p>
                </details>
              </article>
            ))}
          </div>
        </section>

        <NearbyPlaces districtId={district} point={session?.profile?.district === district ? session.profile.point : null} />

        <section className="panel span-2">
          <div className="panel-head">
            <h2>{t('tr.staircase')}</h2>
          </div>
          <CareerStaircase trade={trade} districtId={district} />
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>{t('tr.safety')}</h2>
          </div>
          {providers.map((p) => (
            <div key={p.id} className="lens">
              <strong>{L(p.name)}</strong>
              <ul>
                <li>
                  <Hotel size={16} aria-hidden="true" /> {t('td.girlsHostel')} <YesNo v={p.girlsHostel} />
                </li>
                <li>
                  <Hotel size={16} aria-hidden="true" /> {t('td.boysHostel')} <YesNo v={p.boysHostel} />
                </li>
                <li>
                  <UserRound size={16} aria-hidden="true" /> {t('td.womenInstr')} <b>{p.womenInstructors}</b>
                </li>
                <li>
                  <Cctv size={16} aria-hidden="true" /> {t('td.cctv')} <YesNo v={p.cctv} />
                </li>
                <li>
                  <Megaphone size={16} aria-hidden="true" /> {t('td.grievance')} <YesNo v={p.grievanceCell} />
                </li>
                <li>
                  <BusFront size={16} aria-hidden="true" /> {t('td.busPass')} <YesNo v={p.busPass} />
                </li>
                <li>
                  <Icon name="Users" size={16} /> {t('c.women')} <b>{p.women}%</b>
                </li>
              </ul>
              <span className="lens-src">
                <TrustBadge kind="verified" small /> {t('td.inspection')}, {p.verifiedOn}
              </span>
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>{t('tr.employers')}</h2>
          </div>
          <ul className="employer-list">
            {trade.employers.map((e) => (
              <li key={e}>
                <Icon name="BriefcaseBusiness" size={16} /> {e}
              </li>
            ))}
          </ul>
          {stories.length > 0 && (
            <>
              <div className="panel-head panel-head-sub">
                <h2>{t('chat.story')}</h2>
              </div>
              {stories.map((s) => (
                <figure key={s.id} className="story story-flat">
                  <div className="story-top">
                    <span className="story-avatar" aria-hidden="true">
                      {s.name
                        .split(' ')
                        .map((w) => w[0])
                        .join('')}
                    </span>
                    <div>
                      <strong>
                        {s.name}, {s.age}
                      </strong>
                      <span>
                        {s.nowRole} · {inr(s.earn)} {t('c.perMonth')}
                      </span>
                    </div>
                    <span className="story-tag">{t('chat.sample')}</span>
                  </div>
                  <blockquote>“{L(s.quote)}”</blockquote>
                  <figcaption>
                    <span>{s.parent}</span>
                    <SpeakButton text={L(s.quote)} />
                  </figcaption>
                </figure>
              ))}
            </>
          )}
        </section>
      </div>
      <div className="container">
        <DemoNote />
      </div>
    </div>
  )
}
