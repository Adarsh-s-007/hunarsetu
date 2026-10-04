import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, Mic, Send, Headset, FileText, RotateCcw, BadgeCheck, TriangleAlert, ThumbsUp, Coins, Footprints, PhoneCall, Route, TrendingUp, TrendingDown,
} from 'lucide-react'
import { useApp } from '../AppContext'
import { DISTRICTS, getDistrict } from '../data/districts'
import { EDUCATION, MARKS, INCOME, eligibleTrades, getTrade } from '../data/trades'
import { STORIES } from '../data/stories.js'
import { MANDALS, MANDAL_LOCAL } from '../data/admin.js'
import { ROLES, ROLE_KEYS, stanceLabel } from '../engine/roles'
import { OBJECTIONS, OBJECTION_KEYS } from '../engine/taxonomy'
import { greeting, newFamily, convictionDelta, recommendTrade, providerById, caseSummary, ESCALATION_REASONS } from '../engine/counsel.js'
import { askCounsellor, trackSession, postEscalation, lookupPin, requestStatus } from '../lib/api.js'
import { getRecognizer } from '../lib/speech'
import { inr } from '../lib/format'
import Icon from '../components/Icon'
import SpeakButton from '../components/SpeakButton'
import CareerStaircase from '../components/CareerStaircase'
import { EvidenceCard, DemoNote } from '../components/Trust'
import EngineBadge from '../components/EngineBadge'
import { ReadAloudToggle, useAutoRead, HowToUse, useSlow } from '../components/ReadAloud'

/* ---------------- Setup wizard ---------------- */

function Q({ title, children }) {
  return (
    <fieldset className="q">
      <legend className="q-title">
        <span>{title}</span>
        <SpeakButton text={title} label={false} />
      </legend>
      {children}
    </fieldset>
  )
}

// Optional: a PIN code fills in the district and mandal (India Post, free) and the map point.
function PinFinder({ onFound }) {
  const { t, L } = useApp()
  const [pin, setPin] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const find = async (e) => {
    e.preventDefault()
    if (!/^[1-9]\d{5}$/.test(pin)) return
    setBusy(true)
    try {
      const r = await lookupPin(pin)
      if (!r.found) setMsg({ kind: 'warn', text: t('pin.notFound') })
      else if (!r.districtId) setMsg({ kind: 'warn', text: t('pin.outside', { district: r.district }) })
      else {
        onFound(r)
        setMsg({ kind: 'ok', text: t('pin.found', { place: r.mandal ?? r.block ?? r.places[0], district: L(getDistrict(r.districtId).name) }) })
      }
    } catch {
      setMsg({ kind: 'warn', text: t('pin.error') })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Q title={t('pin.label')}>
      <p className="q-hint">{t('pin.hint')}</p>
      <form className="pin-form" onSubmit={find}>
        <input
          inputMode="numeric"
          autoComplete="postal-code"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="506001"
          aria-label={t('pin.label')}
        />
        <button type="submit" className="btn btn-outline" disabled={pin.length !== 6 || busy}>
          {t('pin.find')}
        </button>
      </form>
      {msg && <p className={`pin-msg is-${msg.kind}`}>{msg.text}</p>}
    </Q>
  )
}

function Setup({ onStart }) {
  const { t, L, lang } = useApp()
  const [step, setStep] = useState(0)
  const [p, setP] = useState({ members: ['learner', 'mother', 'father'], gender: 'f', district: 'hanumakonda', income: '10to25', edu: 'class10', marks: 'mid', trade: 'unsure' })
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }))
  const toggleMember = (r) => set('members', p.members.includes(r) ? p.members.filter((m) => m !== r) : [...p.members, r])
  const trades = eligibleTrades(p.edu)
  useEffect(() => {
    if (p.trade !== 'unsure' && !trades.some((x) => x.id === p.trade)) set('trade', 'unsure')
  }, [p.edu]) // eslint-disable-line react-hooks/exhaustive-deps

  const steps = [
    <>
      <Q title={t('setup.who')}>
        <div className="tile-grid">
          {ROLE_KEYS.map((r) => (
            <button key={r} type="button" className={`tile tile-role ${p.members.includes(r) ? 'is-on' : ''}`} aria-pressed={p.members.includes(r)} onClick={() => toggleMember(r)} style={{ '--c': ROLES[r].color }}>
              <span className="tile-avatar">
                <Icon name={ROLES[r].icon} size={28} />
              </span>
              <span className="tile-label">{L(ROLES[r].label)}</span>
              {p.members.includes(r) && <Check className="tile-check" size={18} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </Q>
      <Q title={t('setup.gender')}>
        <div className="seg">
          {[
            ['f', t('setup.girl')],
            ['m', t('setup.boy')],
          ].map(([v, label]) => (
            <button key={v} type="button" className={p.gender === v ? 'is-on' : ''} aria-pressed={p.gender === v} onClick={() => set('gender', v)}>
              {label}
            </button>
          ))}
        </div>
      </Q>
    </>,
    <>
      <PinFinder onFound={(r) => setP((x) => ({ ...x, district: r.districtId, mandal: r.mandal, pin: r.pin, point: r.point }))} />
      <Q title={t('setup.district')}>
        <div className="chip-grid">
          {DISTRICTS.map((d) => (
            <button key={d.id} type="button" className={`chip-lg ${p.district === d.id ? 'is-on' : ''}`} aria-pressed={p.district === d.id} onClick={() => setP((x) => ({ ...x, district: d.id, mandal: null, point: x.district === d.id ? x.point : null }))}>
              <Icon name="MapPin" size={18} /> {L(d.name)}
            </button>
          ))}
        </div>
      </Q>
      {MANDALS.some((m) => m.district === p.district) && (
        <Q title={t('setup.mandal')}>
          <div className="chip-grid">
            {MANDALS.filter((m) => m.district === p.district).map((m) => (
              <button key={m.id} type="button" className={`chip-lg chip-sm ${p.mandal === m.name ? 'is-on' : ''}`} aria-pressed={p.mandal === m.name} onClick={() => set('mandal', p.mandal === m.name ? null : m.name)}>
                {lang === 'en' ? m.name : (MANDAL_LOCAL[m.id]?.[lang] ?? m.name)}
              </button>
            ))}
          </div>
        </Q>
      )}
      <Q title={t('setup.income')}>
        <div className="chip-grid">
          {INCOME.map((x) => (
            <button key={x.id} type="button" className={`chip-lg ${p.income === x.id ? 'is-on' : ''}`} aria-pressed={p.income === x.id} onClick={() => set('income', x.id)}>
              <span className="coins" aria-hidden="true">
                {Array.from({ length: x.coins }, (_, i) => (
                  <Coins key={i} size={16} />
                ))}
              </span>
              {L(x.label)}
            </button>
          ))}
        </div>
      </Q>
      <Q title={t('setup.edu')}>
        <div className="chip-grid">
          {EDUCATION.map((x) => (
            <button key={x.id} type="button" className={`chip-lg ${p.edu === x.id ? 'is-on' : ''}`} aria-pressed={p.edu === x.id} onClick={() => set('edu', x.id)}>
              <Icon name="GraduationCap" size={18} /> {L(x.label)}
            </button>
          ))}
        </div>
      </Q>
      <Q title={t('setup.marks')}>
        <div className="seg">
          {MARKS.map((x) => (
            <button key={x.id} type="button" className={p.marks === x.id ? 'is-on' : ''} aria-pressed={p.marks === x.id} onClick={() => set('marks', x.id)}>
              {L(x.label)}
            </button>
          ))}
        </div>
      </Q>
    </>,
    <Q title={t('setup.trade')}>
      <div className="tile-grid tile-grid-trades">
        <button type="button" className={`tile ${p.trade === 'unsure' ? 'is-on' : ''}`} aria-pressed={p.trade === 'unsure'} onClick={() => set('trade', 'unsure')}>
          <span className="tile-avatar tile-avatar-q">?</span>
          <span className="tile-label">{t('setup.unsure')}</span>
        </button>
        {trades.map((tr) => (
          <button key={tr.id} type="button" className={`tile ${p.trade === tr.id ? 'is-on' : ''}`} aria-pressed={p.trade === tr.id} onClick={() => set('trade', tr.id)}>
            <span className="tile-avatar">
              <Icon name={tr.icon} size={26} />
            </span>
            <span className="tile-label">{L(tr.name)}</span>
            {p.trade === tr.id && <Check className="tile-check" size={18} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </Q>,
  ]

  const canNext = p.members.length > 0
  const last = step === steps.length - 1
  const go = (n) => {
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  return (
    <div className="container setup">
      <div className="setup-head">
        <span className="eyebrow">{t('nav.counsel')}</span>
        <h1>{t('setup.title')}</h1>
        <p className="lead">{t('setup.sub')}</p>
        <div className="setup-progress" aria-label={`${t('setup.step')} ${step + 1} ${t('setup.of')} ${steps.length}`}>
          {steps.map((_, i) => (
            <span key={i} className={i <= step ? 'is-on' : ''} />
          ))}
        </div>
      </div>
      <div className="setup-body" key={step}>
        {steps[step]}
      </div>
      {!canNext && <p className="form-error">{t('setup.needMember')}</p>}
      <div className="setup-actions">
        {step > 0 ? (
          <button type="button" className="btn btn-outline btn-lg" onClick={() => go(step - 1)}>
            <ArrowLeft size={18} aria-hidden="true" /> {t('c.back')}
          </button>
        ) : (
          <span />
        )}
        {last ? (
          <button type="button" className="btn btn-primary btn-lg" disabled={!canNext} onClick={() => onStart(p, lang)}>
            {t('setup.go')} <ArrowRight size={18} aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className="btn btn-primary btn-lg" disabled={!canNext} onClick={() => go(step + 1)}>
            {t('c.next')} <ArrowRight size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------------- Chat pieces ---------------- */

function StoryCard({ id }) {
  const { L, t } = useApp()
  const s = STORIES.find((x) => x.id === id)
  if (!s) return null
  const q = L(s.quote)
  return (
    <figure className="story">
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
      <blockquote>“{q}”</blockquote>
      <figcaption>
        <span>{s.parent}</span>
        <SpeakButton text={q} />
      </figcaption>
    </figure>
  )
}

function Guard({ guard }) {
  const { t } = useApp()
  if (!guard || (!guard.checked && !guard.blocked)) return null
  if (guard.blocked)
    return (
      <div className="guard-line is-bad">
        <TriangleAlert size={14} aria-hidden="true" /> {guard.blocked} {t('chat.guardBlocked')}
      </div>
    )
  return (
    <div className="guard-line">
      <BadgeCheck size={14} aria-hidden="true" /> {guard.checked} {t('chat.guardOk')}
    </div>
  )
}

function BotMessage({ m, profile, onFollowup, onAction }) {
  const { t, L, lang } = useApp()
  // The welcome message follows the site's language, even after the language is changed.
  const text = m.kind === 'greeting' ? greeting(m.tradeId === recommendTrade(profile) ? profile : { ...profile, trade: m.tradeId }, lang).text : m.text
  const [showStairs, setShowStairs] = useState(!!m.staircase)
  const trade = getTrade(m.tradeId)
  return (
    <div className="msg msg-bot">
      <span className="msg-avatar" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="22" height="22">
          <path d="M10 44c6-14 14-21 22-21s16 7 22 21" fill="none" stroke="#F2A23A" strokeWidth="6" strokeLinecap="round" />
          <path d="M18 44V34M32 44V27M46 44V34" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        </svg>
      </span>
      <div className="msg-body">
        {m.replyTo?.role && (
          <div className="msg-replyto">
            {t('chat.replyTo')} <span className="dot" style={{ background: ROLES[m.replyTo.role].color }} /> {L(ROLES[m.replyTo.role].label)}
            {m.replyTo.key && (
              <span className="msg-topic">
                <Icon name={OBJECTIONS[m.replyTo.key].icon} size={13} /> {L(OBJECTIONS[m.replyTo.key].label)}
              </span>
            )}
          </div>
        )}
        {m.kind === 'greeting' && (
          <div className="msg-trade">
            <span className="msg-trade-icon">
              <Icon name={trade.icon} size={20} />
            </span>
            <div>
              <strong>{L(trade.name)}</strong>
              <span>
                {trade.months} {t('c.months')} · {L(providerById(m.providerId)?.name)}
              </span>
            </div>
          </div>
        )}
        <p className="msg-text">{text}</p>
        <div className="msg-tools">
          <SpeakButton text={text} />
          <Guard guard={m.guard} />
        </div>
        {m.evidence?.length > 0 && (
          <>
            <div className="evidence-grid">
              {m.evidence.map((e, i) => (
                <EvidenceCard key={i} item={e} />
              ))}
            </div>
            <details className="sources">
              <summary>{t('chat.sources')}</summary>
              <ul>
                {[...new Set(m.evidence.map((e) => `${e.source} · ${e.date}`))].map((src) => (
                  <li key={src}>{src}</li>
                ))}
              </ul>
              <Link to="/numbers" className="text-link">
                {t('num.seeAll')} →
              </Link>
            </details>
          </>
        )}
        {m.story && (
          <div className="msg-block">
            <span className="msg-block-title">{t('chat.story')}</span>
            <StoryCard id={m.story} />
          </div>
        )}
        {showStairs && (
          <div className="msg-block">
            <span className="msg-block-title">{t('tr.staircase')}</span>
            <CareerStaircase trade={trade} districtId={profile.district} compact />
          </div>
        )}
        {m.escalate && <EscalateCard esc={m.escalate} onAction={onAction} />}
        {(m.followups?.length > 0 || m.actions?.length > 0 || (!showStairs && m.kind === 'answer')) && (
          <div className="followups">
            <span className="followups-label">{t('chat.alsoAsk')}</span>
            {m.followups?.map((k) => (
              <button key={k} type="button" className="followup" onClick={() => onFollowup(k)}>
                <Icon name={OBJECTIONS[k].icon} size={14} /> {L(OBJECTIONS[k].label)}
              </button>
            ))}
            {!showStairs && (m.kind === 'answer' || m.actions?.includes('staircase')) && (
              <button type="button" className="followup is-action" onClick={() => setShowStairs(true)}>
                <Footprints size={14} aria-hidden="true" /> {t('chat.staircase')}
              </button>
            )}
            {m.actions?.includes('pact') && (
              <button type="button" className="followup is-action" onClick={() => onAction('pact')}>
                <FileText size={14} aria-hidden="true" /> {t('chat.makePact')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Hand-over to a real person, inside the chat: leave a number and get a request number.
function EscalateCard({ esc, onAction }) {
  const { t, L, lang, session, setSession, setRequests } = useApp()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const sentId = session?.callId
  const submit = async (e) => {
    e.preventDefault()
    const clean = phone.replace(/\s/g, '')
    if (!/^[6-9]\d{9}$/.test(clean)) {
      setError(t('cs.phoneError'))
      return
    }
    setError('')
    setSending(true)
    try {
      const { profile, family } = session
      const topics = [...new Set(family.concerns.filter((c) => c.status !== 'resolved').map((c) => c.key))]
      const { id } = await postEscalation({
        kind: 'call',
        sessionId: session.id,
        district: profile.district,
        mandal: profile.mandal,
        lang,
        reasons: esc.reasons,
        woman: esc.woman,
        phone: clean,
        topics,
        summary: caseSummary(profile, family),
      })
      setSession((s) => (s ? { ...s, escalationId: id, callId: id } : s))
      setRequests((r) => [{ id, mode: 'call', lang, woman: esc.woman, at: Date.now() }, ...r].slice(0, 20))
    } catch (err) {
      setError(t('esc.failed'))
    } finally {
      setSending(false)
    }
  }
  return (
    <div className={`escalate ${esc.urgent ? 'is-urgent' : ''}`}>
      <div className="escalate-head">
        <Headset size={20} aria-hidden="true" />
        <strong>{t('chat.escalateTitle')}</strong>
      </div>
      <div className="escalate-reasons">
        {esc.reasons.map((r) => (
          <span key={r}>{L(ESCALATION_REASONS[r])}</span>
        ))}
        {esc.woman && <span className="is-woman">{t('chat.woman')}</span>}
      </div>
      {esc.urgent && (
        <a className="btn btn-outline escalate-urgent" href="tel:14416">
          <PhoneCall size={16} aria-hidden="true" /> Tele-MANAS 14416
        </a>
      )}
      {sentId ? (
        <div className="escalate-done">
          <Check size={18} aria-hidden="true" />
          <span>{t('esc.sent', { id: sentId })}</span>
          <Link to={`/counsellor?ticket=${sentId}`} className="text-link">
            {t('esc.check')} →
          </Link>
        </div>
      ) : (
        <form className="escalate-form" onSubmit={submit} noValidate>
          <label className="field">
            <span>{t('esc.leave')}</span>
            <span className="escalate-row">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" autoComplete="tel-national" placeholder={t('cs.phone')} aria-invalid={!!error} maxLength={14} />
              <button type="submit" className="btn btn-primary" disabled={sending}>
                <PhoneCall size={16} aria-hidden="true" /> {t('chat.escalateBtn')}
              </button>
            </span>
          </label>
          {error && <p className="form-error">{error}</p>}
          <small className="escalate-free">{t('esc.free')}</small>
        </form>
      )}
      <button type="button" className="btn btn-text btn-sm" onClick={() => onAction('counsellor')}>
        {t('esc.more')} →
      </button>
    </div>
  )
}

// Status of this family's request, shown under the chat.
function RequestLine({ id }) {
  const { t } = useApp()
  const [status, setStatus] = useState(null)
  useEffect(() => {
    let on = true
    const load = () =>
      requestStatus(id)
        .then((r) => on && setStatus(r.status))
        .catch((err) => on && err.status === 404 && setStatus('missing'))
    load()
    const timer = setInterval(load, 30000)
    return () => {
      on = false
      clearInterval(timer)
    }
  }, [id])
  const key = { Waiting: 'cs.statusWaiting', Called: 'cs.statusCalled', Resolved: 'cs.statusResolved' }[status]
  if (status === 'missing') return null
  return (
    <div className="request-line">
      <Headset size={18} aria-hidden="true" />
      <span>
        {t('esc.yourReq')} <strong>{id}</strong>
        {key && <> · {t(key)}</>}
      </span>
      <Link to={`/counsellor?ticket=${id}`} className="text-link">
        {t('esc.check')} →
      </Link>
    </div>
  )
}

function UserMessage({ m }) {
  const { L } = useApp()
  const r = ROLES[m.role]
  return (
    <div className="msg msg-user" style={{ '--c': r.color }}>
      <div className="msg-body">
        <span className="msg-who">
          <span className="dot" /> {L(r.label)}
        </span>
        <p className="msg-text">{m.text}</p>
      </div>
    </div>
  )
}

function StanceMeter({ start, now }) {
  const { t } = useApp()
  const pos = (v) => `${((v + 1) / 2) * 100}%`
  const left = Math.min(0, now)
  const width = Math.abs(now)
  return (
    <div className="stance" role="img" aria-label={`Stance ${now.toFixed(2)} (started at ${start.toFixed(2)})`}>
      <div className="stance-track">
        <span className="stance-mid" />
        <span className={`stance-fill ${now < 0 ? 'is-neg' : 'is-pos'}`} style={{ left: pos(left), width: `${(width / 2) * 100}%` }} />
        <span className="stance-start" style={{ left: pos(start) }} title="Start" />
        <span className="stance-now" style={{ left: pos(now) }} />
      </div>
      <div className="stance-ends" aria-hidden="true">
        <span>{t('stance.against')}</span>
        <span>{t('stance.for')}</span>
      </div>
    </div>
  )
}

function ConcernMap({ profile, family, onAction }) {
  const { t, L, session } = useApp()
  const delta = convictionDelta(family)
  return (
    <aside className="concern-map" aria-label={t('chat.family')}>
      <div className="cm-head">
        <h2>{t('chat.family')}</h2>
        <div className={`cm-delta ${delta > 0.04 ? 'is-up' : delta < -0.04 ? 'is-down' : ''}`} title={`Conviction Delta ${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(2)}`}>
          <span className="cm-delta-label">{t('chat.conviction')}</span>
          <span className="cm-delta-text">
            {delta > 0.04 ? <TrendingUp size={18} aria-hidden="true" /> : delta < -0.04 ? <TrendingDown size={18} aria-hidden="true" /> : null}
            {t(delta > 0.04 ? 'chat.moreSure' : delta < -0.04 ? 'chat.lessSure' : 'chat.noChange')}
          </span>
        </div>
      </div>
      <ul className="cm-members">
        {profile.members.map((r) => {
          const st = family.stance[r]
          const lab = stanceLabel(st.now)
          const concerns = family.concerns.filter((c) => c.role === r)
          return (
            <li key={r} className="cm-member">
              <div className="cm-member-top">
                <span className="cm-avatar" style={{ '--c': ROLES[r].color }}>
                  <Icon name={ROLES[r].icon} size={16} />
                </span>
                <strong>{L(ROLES[r].label)}</strong>
                <span className={`cm-stance cm-stance-${lab.key}`}>{L(lab)}</span>
              </div>
              <StanceMeter start={st.start} now={st.now} />
              <div className="cm-concerns">
                {concerns.length === 0 && <span className="cm-empty">{t('chat.noConcerns')}</span>}
                {concerns.map((c) => (
                  <span key={c.key} className={`cm-chip is-${c.status}`} title={t(`chat.status.${c.status}`)}>
                    <Icon name={OBJECTIONS[c.key].icon} size={12} />
                    {L(OBJECTIONS[c.key].label)}
                    {c.count > 1 && <em>×{c.count}</em>}
                    <span className="cm-chip-status">{t(`chat.status.${c.status}`)}</span>
                  </span>
                ))}
              </div>
            </li>
          )
        })}
      </ul>
      {session?.escalationId && <RequestLine id={session.escalationId} />}
      <div className="cm-actions">
        <button type="button" className="btn btn-primary" onClick={() => onAction('pact')}>
          <FileText size={16} aria-hidden="true" /> {t('chat.makePact')}
        </button>
        <button type="button" className="btn btn-outline" onClick={() => onAction('path')}>
          <Route size={16} aria-hidden="true" /> {t('nav.pathShort')}
        </button>
        <button type="button" className="btn btn-outline" onClick={() => onAction('counsellor')}>
          <Headset size={16} aria-hidden="true" /> {t('chat.toCounsellor')}
        </button>
        <button type="button" className="btn btn-text" onClick={() => onAction('restart')}>
          <RotateCcw size={15} aria-hidden="true" /> {t('chat.restart')}
        </button>
      </div>
    </aside>
  )
}

export const newSessionId = () => `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/* ---------------- Chat ---------------- */

function Chat() {
  const { t, L, lang, session, setSession, backend } = useApp()
  const navigate = useNavigate()
  const { profile, family, messages } = session
  const [speaker, setSpeaker] = useState(profile.members.includes('father') ? 'father' : profile.members[0])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [listening, setListening] = useState(false)
  const [micError, setMicError] = useState(false)
  const recRef = useRef(null)
  const tradeId = recommendTrade(profile)
  const tradeOptions = useMemo(() => eligibleTrades(profile.edu), [profile.edu])

  // Scroll inside the chat box only (never the page), and open each new answer at its start.
  const scrollRef = useRef(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const last = [...el.querySelectorAll('.msg')].at(-1)
    const top = !typing && last?.classList.contains('msg-bot') && messages.length > 1 ? last.offsetTop - 8 : el.scrollHeight
    el.scrollTo({ top, behavior: messages.length > 1 ? 'smooth' : 'auto' })
  }, [messages.length, typing])
  useAutoRead(messages)
  const slow = useSlow(typing)

  const busy = useRef(false)
  const send = async (text, role = speaker) => {
    const clean = text.trim()
    if (!clean || busy.current) return
    busy.current = true
    const userMsg = { id: `u${Date.now()}`, from: 'user', role, text: clean }
    setSession((s) => ({ ...s, messages: [...s.messages, userMsg] }))
    setInput('')
    setTyping(true)
    try {
      const started = Date.now()
      const out = await askCounsellor({ text: clean, role, profile, family, lang, messages: [...messages, userMsg] })
      // Keep a short pause on the instant offline engine so replies don't feel abrupt.
      if (out.engine === 'offline') await new Promise((r) => setTimeout(r, Math.max(0, 600 - (Date.now() - started))))
      const next = { ...session, engine: out.engine, family: out.family, messages: [...messages, userMsg, out.reply] }
      setSession(next)
      trackSession(next, lang)
      // A hand-over (not just an offer) goes straight into the counsellors' queue, once per session.
      if (out.reply.escalate && out.reply.escalate.reasons.some((r) => r !== 'sensitive') && !session.escalationId) {
        postEscalation({
          kind: 'chat',
          sessionId: session.id,
          district: profile.district,
          mandal: profile.mandal,
          lang,
          who: role,
          woman: out.reply.escalate.woman,
          reasons: out.reply.escalate.reasons,
          summary: caseSummary(profile, out.family),
        })
          .then(({ id }) => setSession((s) => (s ? { ...s, escalationId: id } : s)))
          .catch(() => {})
      }
    } finally {
      busy.current = false
      setTyping(false)
    }
  }

  const askWorry = (key) => send(L(OBJECTIONS[key].ask))
  const sayOk = () => send({ en: 'OK, that answers it. Thank you.', hi: 'ठीक है, समझ गए। धन्यवाद।', te: 'సరే, అర్థమైంది. ధన్యవాదాలు.' }[lang])

  const onAction = (a) => {
    if (a === 'pact') navigate('/pact')
    else if (a === 'path') navigate('/path')
    else if (a === 'counsellor') navigate('/counsellor')
    else if (a === 'restart') setSession(null)
  }

  const changeTrade = (id) => {
    setSession((s) => {
      const p = { ...s.profile, trade: id }
      return { ...s, profile: p, messages: [...s.messages, greeting(p, lang)] }
    })
  }

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop()
      return
    }
    const r = getRecognizer(lang)
    if (!r) {
      setMicError(true)
      return
    }
    setMicError(false)
    let finalText = ''
    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const tx = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += tx
        else interim += tx
      }
      setInput((finalText + interim).trim())
    }
    r.onerror = () => setListening(false)
    r.onend = () => {
      setListening(false)
      if (finalText.trim()) send(finalText)
    }
    recRef.current = r
    setListening(true)
    r.start()
  }

  return (
    <div className="container chat-page">
      <HowToUse />
      <div className="chat-layout">
        <section className="chat" aria-label="Counselling conversation">
          <div className="chat-bar">
            <div className="chat-family">
              {profile.members.map((r) => (
                <span key={r} className="chat-family-chip" style={{ '--c': ROLES[r].color }}>
                  <span className="dot" /> {L(ROLES[r].label)}
                </span>
              ))}
              <span className="chat-family-chip is-place">
                <Icon name="MapPin" size={13} /> {L(getDistrict(profile.district).name)}
              </span>
            </div>
            <EngineBadge engine={session.engine} />
            <ReadAloudToggle />
            <label className="chat-trade">
              <span>{t('chat.trade')}</span>
              <select value={tradeId} onChange={(e) => changeTrade(e.target.value)}>
                {tradeOptions.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {L(tr.name)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="chat-scroll" aria-live="polite" ref={scrollRef}>
            {messages.map((m) =>
              m.from === 'bot' ? <BotMessage key={m.id} m={m} profile={profile} onFollowup={askWorry} onAction={onAction} /> : <UserMessage key={m.id} m={m} />,
            )}
            {typing && (
              <div className="msg msg-bot">
                <span className="msg-avatar" aria-hidden="true" />
                <div className="msg-body typing-dots" aria-label="HunarSetu is typing">
                  <span />
                  <span />
                  <span />
                  {backend?.llm && <em>{t(slow ? 'chat.slow' : 'chat.checking')}</em>}
                </div>
              </div>
            )}
          </div>

          <div className="composer">
            <div className="composer-row">
              <span className="composer-label">{t('chat.speaking')}</span>
              <div className="speakers" role="radiogroup" aria-label={t('chat.speaking')}>
                {profile.members.map((r) => (
                  <button key={r} type="button" role="radio" aria-checked={speaker === r} className={`speaker ${speaker === r ? 'is-on' : ''}`} style={{ '--c': ROLES[r].color }} onClick={() => setSpeaker(r)}>
                    <span className="speaker-avatar">
                      <Icon name={ROLES[r].icon} size={16} />
                    </span>
                    {L(ROLES[r].label)}
                  </button>
                ))}
              </div>
            </div>
            <div className="composer-row">
              <span className="composer-label">{t('chat.worries')}</span>
              <div className="worries">
                {OBJECTION_KEYS.map((k) => (
                  <button key={k} type="button" className="worry" onClick={() => askWorry(k)} disabled={typing}>
                    <Icon name={OBJECTIONS[k].icon} size={18} />
                    <span>{L(OBJECTIONS[k].label)}</span>
                  </button>
                ))}
                <button type="button" className="worry is-ok" onClick={sayOk} disabled={typing} title={t('chat.convinced')}>
                  <ThumbsUp size={18} aria-hidden="true" />
                  <span>{t('chat.ok')}</span>
                </button>
              </div>
            </div>
            <form
              className="composer-input"
              onSubmit={(e) => {
                e.preventDefault()
                send(input)
              }}
            >
              <button type="button" className={`mic ${listening ? 'is-on' : ''}`} onClick={toggleMic} aria-label={listening ? t('chat.listening') : 'Speak'}>
                <Mic size={22} aria-hidden="true" />
              </button>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? t('chat.listening') : t('chat.placeholder')} aria-label={t('chat.placeholder')} lang={lang} />
              <button type="submit" className="send" disabled={!input.trim() || typing} aria-label={t('chat.send')}>
                <Send size={20} aria-hidden="true" />
              </button>
            </form>
            {micError && <p className="form-error">{t('chat.noMic')}</p>}
          </div>
        </section>
        <ConcernMap profile={profile} family={family} onAction={onAction} />
      </div>
      <DemoNote />
    </div>
  )
}

export default function Counsel() {
  const { session, setSession } = useApp()
  const start = (profile, lang) => {
    const p = { ...profile, trade: profile.trade }
    setSession({ id: newSessionId(), profile: p, family: newFamily(p), messages: [greeting(p, lang)], startedAt: Date.now(), engine: 'offline' })
    window.scrollTo(0, 0)
  }
  if (!session?.profile) return <Setup onStart={start} />
  return <Chat />
}

