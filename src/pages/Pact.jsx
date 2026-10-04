import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Printer, Share2, ArrowLeft, CalendarDays, ListChecks, PhoneCall, Stamp, Check } from 'lucide-react'
import { useApp } from '../AppContext'
import { getDistrict } from '../data/districts'
import { getTrade } from '../data/trades'
import { bestProvider } from '../data/outcomes'
import { ROLES } from '../engine/roles'
import { recommendTrade, convictionDelta } from '../engine/counsel'
import { OBJECTIONS } from '../engine/taxonomy'
import { inr, inrRange } from '../lib/format'
import Icon from '../components/Icon'
import { TrustBadge } from '../components/Trust'
import { Wordmark } from '../components/Logo'

const DEFAULT_PROFILE = { members: ['learner', 'mother', 'father'], gender: 'f', district: 'hanumakonda', income: '10to25', edu: 'class10', marks: 'mid', trade: 'electrician' }

const PARENT_PROMISES = [
  { en: 'Support travel or hostel stay', hi: 'आने-जाने या हॉस्टल में रहने में साथ देंगे', te: 'ప్రయాణం లేదా హాస్టల్ ఖర్చులో తోడుంటాం' },
  { en: 'Join the monthly Parent Connect call', hi: 'हर महीने पेरेंट कनेक्ट कॉल में जुड़ेंगे', te: 'ప్రతి నెలా పేరెంట్ కనెక్ట్ కాల్‌లో పాల్గొంటాం' },
]
const COMMITMENTS = {
  learner: [
    { en: 'Attend at least 80% of classes and practicals', hi: 'कम से कम 80% कक्षाओं और प्रैक्टिकल में आऊँगा/आऊँगी', te: 'కనీసం 80% తరగతులు, ప్రాక్టికల్స్‌కు హాజరవుతాను' },
    { en: 'Tell my family early if anything worries me at the centre', hi: 'सेंटर पर कोई परेशानी हो तो परिवार को जल्दी बताऊँगा/बताऊँगी', te: 'సెంటర్‌లో ఏ ఇబ్బంది ఉన్నా వెంటనే కుటుంబానికి చెబుతాను' },
  ],
  mother: PARENT_PROMISES,
  father: PARENT_PROMISES,
  guardian: PARENT_PROMISES,
  grandparent: [
    { en: 'Encourage the learner at home', hi: 'घर पर विद्यार्थी का हौसला बढ़ाएँगे', te: 'ఇంట్లో విద్యార్థిని ప్రోత్సహిస్తాం' },
    { en: 'Meet a Parent Ambassador family', hi: 'एक पेरेंट एंबेसडर परिवार से मिलेंगे', te: 'ఒక పేరెంట్ అంబాసిడర్ కుటుంబాన్ని కలుస్తాం' },
  ],
}
const CENTRE_PROMISES = [
  { en: 'Share attendance and progress with the family every month', hi: 'हर महीने परिवार को हाज़िरी और प्रगति बताएँगे', te: 'ప్రతి నెలా హాజరు, ప్రగతి కుటుంబానికి తెలియజేస్తాం' },
  { en: 'Placement support and apprenticeship matching', hi: 'प्लेसमेंट और अप्रेंटिसशिप में मदद', te: 'ప్లేస్‌మెంట్, అప్రెంటిస్‌షిప్‌లో సహాయం' },
  { en: 'Alert the family early if attendance drops', hi: 'हाज़िरी घटे तो परिवार को जल्दी सूचना', te: 'హాజరు తగ్గితే కుటుంబానికి ముందే సమాచారం' },
]

const fmtDate = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export default function Pact() {
  const { t, L, session } = useApp()
  const profile = session?.profile ?? DEFAULT_PROFILE
  const trade = getTrade(recommendTrade(profile))
  const district = getDistrict(profile.district)
  const prov = bestProvider(district.id, trade.id)
  const [connect, setConnect] = useState(true)
  const today = useMemo(() => new Date(), [])
  const pactId = useMemo(() => `HS-PACT-${(session?.startedAt ?? 20260001).toString(36).slice(-5).toUpperCase()}`, [session?.startedAt])
  const visitBy = new Date(today.getTime() + 7 * 864e5)
  const intake = trade.kind === 'ITI' ? `August ${today.getMonth() >= 7 ? today.getFullYear() + 1 : today.getFullYear()} (ITI admissions)` : `${new Date(today.getFullYear(), today.getMonth() + 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} batch`
  const resolved = session?.family?.concerns.filter((c) => c.status === 'resolved') ?? []
  const delta = session?.family ? convictionDelta(session.family) : null

  const shareText = [
    `HunarSetu Family Career Pact (${pactId})`,
    `Trade: ${L(trade.name)} (NSQF ${trade.nsqf}, ${trade.months} months)`,
    `Centre: ${L(prov.name)}, ${prov.km} km`,
    `Starts: ${intake}`,
    `Fee: ${prov.fee === 0 ? 'Free' : inr(prov.fee) + '/year'}`,
    `Next step: visit the centre by ${fmtDate(visitBy)}`,
  ].join('\n')

  return (
    <div className="page">
      <section className="page-head no-print">
        <div className="container">
          {session ? (
            <Link to="/counsel" className="back-link">
              <ArrowLeft size={16} aria-hidden="true" /> {t('nav.counsel')}
            </Link>
          ) : (
            <p className="notice">
              {t('pact.example')} <Link to="/counsel">{t('pact.makeOwn')}</Link>
            </p>
          )}
          <h1>{t('pact.title')}</h1>
          <p className="lead">{t('pact.sub')}</p>
          <div className="head-actions">
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={16} aria-hidden="true" /> {t('c.print')}
            </button>
            <a className="btn btn-outline" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
              <Share2 size={16} aria-hidden="true" /> {t('c.share')}
            </a>
          </div>
        </div>
      </section>

      <div className="container">
        <article className="pact">
          <header className="pact-head">
            <Wordmark />
            <div className="pact-id">
              <strong>{pactId}</strong>
              <span>{fmtDate(today)}</span>
            </div>
          </header>

          <section className="pact-decision">
            <span className="pact-trade-icon">
              <Icon name={trade.icon} size={34} />
            </span>
            <div>
              <span className="eyebrow">{t('pact.decided')}</span>
              <h2>
                {L(trade.name)} · {L(prov.name)}
              </h2>
              <p>
                NSQF {trade.nsqf} · {trade.months} {t('c.months')} · {prov.km} km · {t('pact.starts')}: {intake}
              </p>
            </div>
          </section>

          <section className="pact-facts">
            <div>
              <span>{t('c.firstJob')}</span>
              <strong>
                {inrRange(prov.earnLow, prov.earnHigh)} {t('c.perMonth')}
              </strong>
              <TrustBadge kind={prov.earnBadge} small />
            </div>
            <div>
              <span>{t('pact.placed')}</span>
              <strong>{prov.placement}%</strong>
              <TrustBadge kind={prov.placeBadge} small />
            </div>
            <div>
              <span>{t('pact.fee')}</span>
              <strong>{prov.fee === 0 ? t('td.free') : `${inr(prov.fee)} / ${t('c.year').toLowerCase()}`}</strong>
              <TrustBadge kind="provider" small />
            </div>
            {trade.staircase.some((s) => s.stipend) && (
              <div>
                <span>{t('pact.stipend')}</span>
                <strong>
                  {inr(prov.stipend)} {t('c.perMonth')}
                </strong>
                <TrustBadge kind="verified" small />
              </div>
            )}
          </section>

          {resolved.length > 0 && (
            <section className="pact-resolved">
              <h3>{t('pact.talked')}</h3>
              <div className="pact-chips">
                {resolved.map((c) => (
                  <span key={c.role + c.key} className="cm-chip is-resolved">
                    <Check size={12} aria-hidden="true" /> {L(ROLES[c.role].label)}: {L(OBJECTIONS[c.key].label)}
                  </span>
                ))}
                {delta != null && <span className="pact-delta">Conviction Delta {delta >= 0 ? '+' : '−'}{Math.abs(delta).toFixed(2)}</span>}
              </div>
            </section>
          )}

          <section>
            <h3>{t('pact.promises')}</h3>
            <div className="pact-members">
              {profile.members.map((r) => (
                <div key={r} className="pact-member" style={{ '--c': ROLES[r].color }}>
                  <div className="pact-member-head">
                    <span className="cm-avatar">
                      <Icon name={ROLES[r].icon} size={16} />
                    </span>
                    <strong>{L(ROLES[r].label)}</strong>
                  </div>
                  <ul>
                    {COMMITMENTS[r].map((c) => (
                      <li key={c.en}>{L(c)}</li>
                    ))}
                  </ul>
                  <div className="sign-box">
                    <span>{t('pact.sign')}</span>
                  </div>
                </div>
              ))}
              <div className="pact-member" style={{ '--c': '#0E3B3C' }}>
                <div className="pact-member-head">
                  <span className="cm-avatar">
                    <Stamp size={16} aria-hidden="true" />
                  </span>
                  <strong>{t('pact.centre')}</strong>
                </div>
                <ul>
                  {CENTRE_PROMISES.map((c) => (
                    <li key={c.en}>{L(c)}</li>
                  ))}
                </ul>
                <div className="sign-box">
                  <span>{t('pact.seal')}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="pact-next">
            <h3>
              <ListChecks size={18} aria-hidden="true" /> {t('pact.next')}
            </h3>
            <ol>
              <li>
                <CalendarDays size={16} aria-hidden="true" /> {t('pact.visit', { centre: L(prov.name), date: fmtDate(visitBy) })}
              </li>
              <li>{t('pact.bring', { cls: profile.edu === 'class8' ? '8' : '10' })}</li>
              <li>{t('pact.apply')}</li>
              {(profile.income === 'lt10' || profile.income === '10to25') && <li>{t('pact.form')}</li>}
            </ol>
          </section>

          <section className="pact-connect no-print-bg">
            <label className="check">
              <input type="checkbox" checked={connect} onChange={(e) => setConnect(e.target.checked)} />
              <span>{t('pact.connect')}</span>
            </label>
            <span className="pact-help">
              <PhoneCall size={16} aria-hidden="true" /> {t('pact.help')}
            </span>
          </section>
        </article>
      </div>
    </div>
  )
}
