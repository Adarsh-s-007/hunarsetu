import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PhoneCall, HandHeart, MapPin, CircleCheck, ClipboardList, ArrowLeft, Clock, Phone, Search } from 'lucide-react'
import { useApp } from '../AppContext'
import { getDistrict } from '../data/districts'
import { getTrade } from '../data/trades'
import { providersFor } from '../data/outcomes'
import { caseSummary, recommendTrade } from '../engine/counsel.js'
import { postEscalation, requestStatus } from '../lib/api.js'
import { OBJECTIONS, OBJECTION_KEYS } from '../engine/taxonomy'
import { LANGS } from '../i18n/strings'
import Icon from '../components/Icon'

const STATUS_KEY = { Waiting: 'cs.statusWaiting', Called: 'cs.statusCalled', Resolved: 'cs.statusResolved' }

// A family can check its own request by number (status only).
function RequestStatus({ initialId = '' }) {
  const { t } = useApp()
  const [id, setId] = useState(initialId)
  const [state, setState] = useState(null)
  const check = async (e) => {
    e?.preventDefault()
    const clean = id.trim().toUpperCase()
    if (!clean) return
    setState({ loading: true })
    try {
      const r = await requestStatus(clean)
      setState({ status: r.status })
    } catch (err) {
      setState({ error: err.status === 404 ? t('cs.notFound') : t('esc.failed') })
    }
  }
  useEffect(() => {
    if (initialId) check()
  }, [initialId]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form className="status-check" onSubmit={check}>
      <label className="field">
        <span>{t('cs.ticket')}</span>
        <input value={id} onChange={(e) => setId(e.target.value)} placeholder="HS-ABC123" autoCapitalize="characters" />
      </label>
      <button type="submit" className="btn btn-outline" disabled={!id.trim() || state?.loading}>
        {initialId ? t('cs.checkAgain') : t('cs.check')}
      </button>
      {state?.status && (
        <p className={`status-line status-${state.status.toLowerCase()}`}>
          {t('cs.status')}: <strong>{t(STATUS_KEY[state.status] ?? 'cs.statusWaiting')}</strong>
        </p>
      )}
      {state?.error && <p className="form-error">{state.error}</p>}
    </form>
  )
}

function NextSteps() {
  const { t } = useApp()
  return (
    <section className="next-steps" aria-label={t('cs.nextTitle')}>
      <h2>{t('cs.nextTitle')}</h2>
      <ol>
        {[
          [Phone, t('cs.next1'), t('cs.next1t')],
          [PhoneCall, t('cs.next2'), t('cs.next2t')],
          [Search, t('cs.next3'), t('cs.next3t')],
        ].map(([I, title, text], i) => (
          <li key={i}>
            <span className="next-pic">
              <I size={22} aria-hidden="true" />
              <b>{i + 1}</b>
            </span>
            <strong>{title}</strong>
            <span>{text}</span>
          </li>
        ))}
      </ol>
      <p className="next-free">{t('esc.free')}</p>
    </section>
  )
}

const AMBASSADORS = [
  { id: 'a1', name: 'Venkatamma', of: 'Mother of Lakshmi (Electrician → Solar technician)', place: 'Hanumakonda', langs: 'Telugu' },
  { id: 'a2', name: 'Ramesh', of: 'Father of Ravi (Welder)', place: 'Karimnagar', langs: 'Telugu, Hindi' },
  { id: 'a3', name: 'Saroja', of: 'Mother of Anjali (Hospital Assistant)', place: 'Hyderabad', langs: 'Hindi, Telugu' },
]

export default function Counsellor() {
  const { t, L, lang, session, setRequests } = useApp()
  const [params] = useSearchParams()
  const ticket = (params.get('ticket') ?? '').toUpperCase().slice(0, 12)
  const checkRef = useRef(null)
  useEffect(() => {
    if (ticket) checkRef.current?.scrollIntoView({ block: 'center' })
  }, [ticket])
  const profile = session?.profile
  const summary = useMemo(() => caseSummary(profile, session?.family), [profile, session?.family])
  const openKeys = [...new Set(session?.family?.concerns.filter((c) => c.status !== 'resolved').map((c) => c.key) ?? [])]

  const [mode, setMode] = useState('call')
  const [form, setForm] = useState({ name: '', phone: '', lang, time: 'evening', woman: profile?.gender === 'f', topics: openKeys, ambassador: '' })
  const [done, setDone] = useState(null)
  const [error, setError] = useState('')
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const toggleTopic = (k) => set('topics', form.topics.includes(k) ? form.topics.filter((x) => x !== k) : [...form.topics, k])

  const districtId = profile?.district ?? 'hanumakonda'
  const trade = getTrade(profile ? recommendTrade(profile) : 'electrician')
  const centres = providersFor(districtId, trade.id).sort((a, b) => a.km - b.km)

  const [sending, setSending] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    const phone = form.phone.replace(/\s/g, '')
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError(t('cs.phoneError'))
      return
    }
    setError('')
    setSending(true)
    let id
    try {
      // Goes into the counsellors' queue (admin dashboard). The number is hidden once the request is resolved.
      ;({ id } = await postEscalation({
        kind: mode === 'ambassador' ? 'ambassador' : 'call',
        sessionId: session?.id,
        district: districtId,
        mandal: profile?.mandal,
        lang: form.lang,
        reasons: ['requested'],
        woman: form.woman,
        phone,
        time: form.time,
        topics: form.topics,
        summary,
      }))
    } catch {
      id = `HS-${2052 + Math.floor(Math.random() * 40)}` // no backend: keep the request on this device
    } finally {
      setSending(false)
    }
    const req = { id, ...form, phone: undefined, mode, at: Date.now() }
    setRequests((r) => [req, ...r].slice(0, 20))
    setDone(req)
  }

  if (done) {
    return (
      <div className="page">
        <div className="container narrow">
          <div className="confirm">
            <CircleCheck size={48} aria-hidden="true" />
            <h1>{t('cs.received', { id: done.id })}</h1>
            <p className="lead">
              {t('cs.willCall', {
                who: t(done.mode === 'ambassador' ? 'cs.whoAmb' : done.woman ? 'cs.whoWoman' : 'cs.whoAny'),
                time: t(`cs.${done.time}`),
                lang: LANGS.find((l) => l.id === done.lang)?.label,
              })}{' '}
              {t('cs.summaryNote')}
            </p>
            <p className="lead">{t('cs.keepNumber')}</p>
            <RequestStatus initialId={done.id} />
            <div className="head-actions center">
              <Link to="/counsel" className="btn btn-primary">
                <ArrowLeft size={16} aria-hidden="true" /> {t('nav.counsel')}
              </Link>
              <button type="button" className="btn btn-outline" onClick={() => setDone(null)}>
                {t('cs.newReq')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">{t('cs.eyebrow')}</span>
          <h1>{t('cs.title')}</h1>
          <p className="lead">{t('cs.sub')}</p>
        </div>
      </section>
      <div className="container">
        <NextSteps />
      </div>
      <div className="container detail-grid">
        <section className="panel span-2">
          <div className="mode-tabs" role="tablist">
            {[
              ['call', PhoneCall, t('cs.call'), t('cs.callSub')],
              ['ambassador', HandHeart, t('cs.amb'), t('cs.ambSub')],
              ['visit', MapPin, t('cs.visit'), t('cs.visitSub')],
            ].map(([k, I, title, sub]) => (
              <button key={k} type="button" role="tab" aria-selected={mode === k} className={`mode-tab ${mode === k ? 'is-on' : ''}`} onClick={() => setMode(k)}>
                <I size={22} aria-hidden="true" />
                <span>
                  <strong>{title}</strong>
                  <small>{sub}</small>
                </span>
              </button>
            ))}
          </div>

          {mode === 'visit' ? (
            <div className="centres">
              {centres.map((c) => (
                <div key={c.id} className="centre">
                  <Icon name={trade.icon} size={20} />
                  <div>
                    <strong>{L(c.name)}</strong>
                    <span>{t('cs.visitLine', { km: c.km, n: c.womenInstructors })}</span>
                  </div>
                  <a className="btn btn-outline btn-sm" href={`https://www.google.com/maps/search/${encodeURIComponent(c.name.en + ' Telangana')}`} target="_blank" rel="noreferrer">
                    {t('cs.directions')}
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <form className="callback" onSubmit={submit} noValidate>
              {mode === 'ambassador' && (
                <div className="ambassadors">
                  {AMBASSADORS.map((a) => (
                    <button key={a.id} type="button" className={`ambassador ${form.ambassador === a.id ? 'is-on' : ''}`} aria-pressed={form.ambassador === a.id} onClick={() => set('ambassador', a.id)}>
                      <span className="story-avatar" aria-hidden="true">
                        {a.name[0]}
                      </span>
                      <span>
                        <strong>{a.name}</strong>
                        <small>{a.of}</small>
                        <small>
                          {a.place} · {a.langs}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className="form-grid">
                <label className="field">
                  <span>{t('cs.name')}</span>
                  <input value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" />
                </label>
                <label className="field">
                  <span>{t('cs.phone')}</span>
                  <input value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="numeric" autoComplete="tel-national" placeholder={t('cs.tenDigits')} aria-invalid={!!error} />
                </label>
                <label className="field">
                  <span>{t('cs.lang')}</span>
                  <select value={form.lang} onChange={(e) => set('lang', e.target.value)}>
                    {LANGS.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="field">
                  <span>
                    <Clock size={14} aria-hidden="true" /> {t('cs.time')}
                  </span>
                  <div className="seg seg-sm">
                    {['morning', 'afternoon', 'evening'].map((x) => (
                      <button key={x} type="button" className={form.time === x ? 'is-on' : ''} aria-pressed={form.time === x} onClick={() => set('time', x)}>
                        {t(`cs.${x}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="field">
                <span>{t('cs.topics')}</span>
                <div className="followups">
                  {OBJECTION_KEYS.map((k) => (
                    <button key={k} type="button" className={`followup ${form.topics.includes(k) ? 'is-on' : ''}`} aria-pressed={form.topics.includes(k)} onClick={() => toggleTopic(k)}>
                      <Icon name={OBJECTIONS[k].icon} size={14} /> {L(OBJECTIONS[k].label)}
                    </button>
                  ))}
                </div>
              </div>
              {mode === 'call' && (
                <label className="check">
                  <input type="checkbox" checked={form.woman} onChange={(e) => set('woman', e.target.checked)} />
                  <span>{t('cs.woman')}</span>
                </label>
              )}
              {error && <p className="form-error">{error}</p>}
              <button type="submit" className="btn btn-primary btn-lg" disabled={sending}>
                <PhoneCall size={18} aria-hidden="true" /> {t('cs.submit')}
              </button>
            </form>
          )}
        </section>

        <aside className="panel">
          <div className="panel-head">
            <h2>
              <ClipboardList size={18} aria-hidden="true" /> {t('cs.summaryTitle')}
            </h2>
          </div>
          {summary ? (
            <>
              <p className="panel-note">{t('cs.summaryNote')}</p>
              <dl className="summary">
                {summary.map((l) => (
                  <div key={l.k}>
                    <dt>{l.k}</dt>
                    <dd>{l.v}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="panel-note">
              <Link to="/counsel">{t('cs.noSummary')}</Link>
            </p>
          )}
          <div className="escalation-rules">
            <h3>{t('cs.whenTitle')}</h3>
            <ul>
              {[1, 2, 3, 4].map((n) => (
                <li key={n}>{t(`cs.when${n}`)}</li>
              ))}
            </ul>
          </div>
          <p className="panel-note">
            {t('cs.district')}: {L(getDistrict(districtId).name)}
          </p>
        </aside>

        <section className="panel" ref={checkRef} id="check">
          <div className="panel-head">
            <h2>{t('cs.checkTitle')}</h2>
          </div>
          <RequestStatus key={ticket} initialId={ticket} />
        </section>
      </div>
    </div>
  )
}
