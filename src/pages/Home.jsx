import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, MessageCircle, Users, Lock, BadgeCheck, Ban, Mic, Headset, LayoutDashboard, Pause, Play, Send, Route, BriefcaseBusiness, ChevronDown, Minus, X, Check, Volume2, Pointer, ALargeSmall,
} from 'lucide-react'
import { useApp } from '../AppContext'
import { bestProvider, VERIFICATION } from '../data/outcomes.js'
import { ROLES } from '../engine/roles.js'
import { OBJECTIONS, OBJECTION_KEYS } from '../engine/taxonomy.js'
import { inrRange, num } from '../lib/format.js'
import { TrustBadge } from '../components/Trust'
import Icon from '../components/Icon'
import { LangSwitch } from '../components/Navbar'
import EngineBadge from '../components/EngineBadge'
import { ReadAloudToggle, useAutoRead, useSlow } from '../components/ReadAloud'
import { askCounsellor, trackSession } from '../lib/api.js'
import { newFamily, greeting } from '../engine/counsel.js'
import { newSessionId } from './Counsel'

const img = (id, w = 1920) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`

/* ---------------- Hero background video ---------------- */

const PX = 'https://videos.pexels.com/video-files'
const PXI = 'https://images.pexels.com/videos'

// Looping hero footage (Pexels, free licence). 540p on phones and slow links, 720p on wide screens.
const CLIPS = [
  {
    id: 'welding',
    sd: `${PX}/34771890/14742065_960_540_32fps.mp4`,
    hd: `${PX}/34771890/14742065_960_540_32fps.mp4`,
    poster: `${PXI}/34771890/grinder-grinding-rtc-rtctagoloan-34771890.jpeg?auto=compress&w=1280`,
    caption: { en: 'Welder', hi: 'वेल्डर', te: 'వెల్డర్' },
  },
  {
    id: 'sewing',
    sd: `${PX}/31359192/13382162_960_540_50fps.mp4`,
    hd: `${PX}/31359192/13382163_1280_720_50fps.mp4`,
    poster: `${PXI}/31359192/blue-collar-workers-blue-collar-workers-factory-worker-indian-blue-collar-workers-31359192.jpeg?auto=compress&w=1280`,
    caption: { en: 'Tailoring', hi: 'सिलाई', te: 'కుట్టుపని' },
  },
  {
    id: 'panel',
    sd: `${PX}/28886877/12504679_960_540_30fps.mp4`,
    hd: `${PX}/28886877/12504680_1280_720_30fps.mp4`,
    poster: `${PXI}/28886877/electrical-panel-28886877.jpeg?auto=compress&w=1280`,
    caption: { en: 'Electrician', hi: 'इलेक्ट्रीशियन', te: 'ఎలక్ట్రీషియన్' },
  },
  {
    id: 'grid',
    sd: `${PX}/10223794/10223794-sd_960_540_30fps.mp4`,
    hd: `${PX}/10223794/10223794-hd_1280_720_30fps.mp4`,
    poster: `${PXI}/10223794/pexels-photo-10223794.jpeg?auto=compress&w=1280`,
    caption: { en: 'Power line work', hi: 'बिजली लाइन का काम', te: 'విద్యుత్ లైన్ పని' },
  },
]
const CLIP_MS = 8000

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const saveData = () =>
  typeof navigator !== 'undefined' && Boolean(navigator.connection?.saveData || /(^|-)2g$/.test(navigator.connection?.effectiveType ?? ''))

function HeroMedia() {
  const { L } = useApp()
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(() => !reducedMotion())
  // Still photos for reduced motion, data-saver / 2G, or if the video CDN can't be reached.
  const [still, setStill] = useState(() => reducedMotion() || saveData())
  const [wanted, setWanted] = useState(() => new Set([0, 1]))
  const refs = useRef([])
  const hd = useMemo(() => typeof window !== 'undefined' && window.innerWidth >= 1100, [])

  const go = (i) => {
    setIdx(i)
    setWanted((w) => new Set([...w, i, (i + 1) % CLIPS.length]))
  }

  useEffect(() => {
    if (!playing) return
    const id = setTimeout(() => go((idx + 1) % CLIPS.length), CLIP_MS)
    return () => clearTimeout(id)
  }, [idx, playing])

  useEffect(() => {
    if (still) return
    refs.current.forEach((v, i) => {
      if (!v) return
      if (i === idx && playing) {
        v.play().catch(() => {})
      } else {
        v.pause()
        if (i !== idx) v.currentTime = 0
      }
    })
  }, [idx, playing, still, wanted])

  // Browsers pause background media in hidden tabs; resume when the page is visible again.
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && playing && refs.current[idx]?.play().catch(() => {})
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [idx, playing])

  return (
    <>
      <div className="hero-slides" aria-hidden="true">
        {CLIPS.map((c, i) =>
          still ? (
            <div key={c.id} className={`hero-slide ${i === idx ? 'is-active' : ''} ${playing ? '' : 'is-still'}`} style={{ backgroundImage: `url(${c.poster})` }} />
          ) : (
            <video
              key={c.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              className={`hero-video ${i === idx ? 'is-active' : ''}`}
              src={wanted.has(i) ? (hd ? c.hd : c.sd) : undefined}
              poster={c.poster}
              muted
              playsInline
              loop
              preload={wanted.has(i) ? 'auto' : 'none'}
              autoPlay={i === 0 && playing}
              onCanPlay={(e) => i === idx && playing && e.currentTarget.play().catch(() => {})}
              onError={() => i === idx && setStill(true)}
            />
          ),
        )}
      </div>
      <div className="hero-shade" aria-hidden="true" />
      <div className="hero-slide-ui">
        <span className="hero-caption" key={idx}>
          {L(CLIPS[idx].caption)}
        </span>
        <div className="hero-dots">
          {CLIPS.map((c, i) => (
            <button key={c.id} type="button" className={i === idx ? 'is-active' : ''} onClick={() => go(i)} aria-label={L(c.caption)}>
              {i === idx && playing && <span className="hero-dot-fill" key={idx} style={{ animationDuration: `${CLIP_MS}ms` }} />}
            </button>
          ))}
          <button type="button" className="hero-play" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause background video' : 'Play background video'}>
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
        </div>
      </div>
    </>
  )
}

/* ---------------- Chat (docked in the hero, minimised, or floating) ---------------- */

const DEMO_PROFILE = { members: ['learner', 'mother', 'father'], gender: 'f', district: 'hanumakonda', mandal: null, income: '10to25', edu: 'class10', marks: 'mid', trade: 'electrician' }
const HERO_GREETING = {
  en: 'Namaste! Ask any worry about the ITI Electrician course in Hanumakonda: pay, safety, respect or fees. First tap who is asking.',
  hi: 'नमस्ते! हनुमकोंडा में ITI इलेक्ट्रीशियन कोर्स के बारे में कोई भी चिंता पूछिए: कमाई, सुरक्षा, इज़्ज़त या फीस। पहले बताइए कौन पूछ रहा है।',
  te: 'నమస్కారం! హనుమకొండలో ITI ఎలక్ట్రీషియన్ కోర్సు గురించి ఏ సందేహమైనా అడగండి: జీతం, భద్రత, గౌరవం లేదా ఫీజు. ముందు ఎవరు అడుగుతున్నారో నొక్కండి.',
}
const HERO_ROLES = ['father', 'mother', 'learner']

function readChatMode() {
  try {
    return localStorage.getItem('hs.chatMode') === 'min' ? 'min' : 'docked'
  } catch {
    return 'docked'
  }
}

// The real counsellor: Claude through the API (offline engine without a key).
// mode: 'docked' (in the hero) | 'min' (small button, bottom right) | 'float' (window, bottom right).
function HeroLiveChat({ mode, setMode, askRef }) {
  const { lang, t, L, setSession } = useApp()
  const navigate = useNavigate()
  const [speaker, setSpeaker] = useState('father')
  const [family, setFamily] = useState(() => newFamily(DEMO_PROFILE))
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [engine, setEngine] = useState('offline')
  const [startedAt] = useState(() => Date.now())
  const bodyRef = useRef(null)
  const inputRef = useRef(null)

  // Show the start of each new answer (long replies would otherwise open at their evidence).
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const last = el.lastElementChild
    el.scrollTop = last && last.classList.contains('hc-bot') && !busy ? last.offsetTop - 8 : el.scrollHeight
  }, [msgs.length, busy, mode])

  useEffect(() => {
    if (mode === 'float') inputRef.current?.focus()
  }, [mode])
  useAutoRead(msgs)
  const slow = useSlow(busy)

  const send = async (text) => {
    const clean = text.trim()
    if (!clean || busy) return
    const user = { id: `u${Date.now()}`, from: 'user', role: speaker, text: clean }
    setMsgs((m) => [...m, user])
    setInput('')
    setBusy(true)
    try {
      const out = await askCounsellor({ text: clean, role: speaker, profile: DEMO_PROFILE, family, lang, messages: [...msgs, user] })
      setFamily(out.family)
      setEngine(out.engine)
      setMsgs((m) => [...m, out.reply])
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    askRef.current = send
  })

  const continueInFull = () => {
    const session = { id: newSessionId(), profile: DEMO_PROFILE, family, messages: [greeting(DEMO_PROFILE, lang), ...msgs], startedAt, engine }
    setSession(session)
    if (msgs.length) trackSession(session, lang)
    navigate('/counsel')
  }

  if (mode === 'min') {
    return (
      <button type="button" className="chat-launcher" onClick={() => setMode('float')}>
        <MessageCircle size={22} aria-hidden="true" />
        <span>{t('chat.open')}</span>
        {msgs.length > 0 && <span className="chat-launcher-count">{msgs.filter((m) => m.from === 'bot').length}</span>}
      </button>
    )
  }

  return (
    <div
      className={`hero-chat ${mode === 'float' ? 'is-float' : ''}`}
      role={mode === 'float' ? 'dialog' : 'region'}
      aria-label={t('chat.open')}
      onKeyDown={(e) => mode === 'float' && e.key === 'Escape' && setMode('min')}
    >
      <div className="hero-chat-head">
        <span className="live-dot" aria-hidden="true" />
        <span className="hero-chat-title">{t('hero.ask')}</span>
        <EngineBadge />
        <ReadAloudToggle compact />
        <button type="button" className="chat-min" onClick={() => setMode('min')} aria-label={t('chat.min')} title={t('chat.min')}>
          {mode === 'float' ? <X size={18} /> : <Minus size={18} />}
        </button>
      </div>
      <div className="hero-chat-body" ref={bodyRef}>
        <div className="hc-msg hc-bot">
          <p>{L(HERO_GREETING)}</p>
          {msgs.length === 0 && (
            <div className="hc-starters">
              {['income', 'safety', 'social', 'degree'].map((k) => (
                <button key={k} type="button" onClick={() => send(L(OBJECTIONS[k].ask))} disabled={busy}>
                  <Icon name={OBJECTIONS[k].icon} size={14} /> {L(OBJECTIONS[k].label)}
                </button>
              ))}
            </div>
          )}
        </div>
        {msgs.map((m) =>
          m.from === 'bot' ? (
            <div key={m.id} className="hc-msg hc-bot">
              <p>{m.text}</p>
              {m.evidence?.slice(0, 2).map((e, i) => (
                <div key={i} className="hc-evidence">
                  <strong>{e.value}</strong>
                  <TrustBadge kind={e.badge} small />
                  <span>{L(e.label)}</span>
                </div>
              ))}
              {m.escalate && (
                <Link to="/counsellor" className="hc-escalate">
                  <Headset size={14} aria-hidden="true" /> {t('chat.escalateBtn')}
                </Link>
              )}
            </div>
          ) : (
            <div key={m.id} className="hc-msg hc-user">
              <span className="hc-who">
                <span className="dot" style={{ background: ROLES[m.role].color }} />
                {L(ROLES[m.role].label)}
              </span>
              <p>{m.text}</p>
            </div>
          ),
        )}
        {busy && (
          <div className="hc-msg hc-bot hc-typing" aria-label="HunarSetu is typing">
            <span />
            <span />
            <span />
            <em>{t(slow ? 'chat.slow' : 'chat.checking')}</em>
          </div>
        )}
      </div>
      <div className="hero-chat-tools">
        <div className="hc-speakers" role="radiogroup" aria-label={t('chat.speaking')}>
          <span className="hc-label">{t('chat.speaking')}</span>
          {HERO_ROLES.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={speaker === r} className={speaker === r ? 'is-on' : ''} style={{ '--c': ROLES[r].color }} onClick={() => setSpeaker(r)}>
              <span className="dot" /> {L(ROLES[r].label)}
            </button>
          ))}
        </div>
        <form
          className="hc-input"
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
        >
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('hero.askPlaceholder')} aria-label={t('hero.askPlaceholder')} lang={lang} />
          <button type="submit" disabled={!input.trim() || busy} aria-label={t('chat.send')}>
            <Send size={17} aria-hidden="true" />
          </button>
        </form>
      </div>
      <button type="button" className="hero-chat-foot" onClick={continueInFull}>
        <Users size={16} aria-hidden="true" />
        <span>{t('hero.continue')}</span>
        <ArrowRight size={15} aria-hidden="true" />
      </button>
    </div>
  )
}

/* ---------------- For officials, judges and partners (collapsed by default) ---------------- */

function Officials() {
  const { backend } = useApp()
  const s = VERIFICATION.stats
  const brief = [
    {
      icon: Users,
      need: 'Conversational counselling for learners and parents, in a regional language plus English',
      how: `Family Mode: tap who is speaking, type or talk in Telugu, Hindi or English. Answers come from ${backend?.llm ? `${backend.providerLabel}, using facts from the outcome database` : 'the built-in offline engine (the AI service is not reachable)'}. Free AI works with no key; Groq, Gemini or Claude keys are optional.`,
      to: '/counsel',
    },
    {
      icon: BadgeCheck,
      need: 'A verified outcome-data backend the tool draws on',
      how: `${s.records} centre records; ${s.verified} verified against ${num(s.tracerCalls)} alumni tracer calls; ${s.flagged} centres flagged for over-reporting. Every figure in a reply must trace back to it.`,
      to: '/numbers',
    },
    {
      icon: Route,
      need: "A low-jargon explainer tailored to the family's place, income and schooling",
      how: '“Your path”: eligibility, fees and support for this income, the nearest centre, then each step from course to job to further study, with read-aloud and a glossary.',
      to: '/path',
    },
    {
      icon: LayoutDashboard,
      need: 'A dashboard showing where and why family resistance is concentrated',
      how: 'Seven plain sections: where families say no (mandal map), why (top worries and what to do there), calls to make, whether families are getting more sure, what answers work, live families, and the number checks.',
      to: '/admin',
    },
    {
      icon: Mic,
      need: 'Design for low-literacy and low-digital-familiarity users',
      how: 'Talk instead of type (mic), a “Read answers aloud” switch, a 3-picture “How to use” strip above the chat, picture buttons for worries and setup, a bigger-text button, and short everyday words in Telugu, Hindi and English. Missed-call and WhatsApp channels are planned.',
      to: '/counsel',
    },
    {
      icon: Headset,
      need: 'A clear escalation path to human counsellors',
      how: 'The chat hands over when the AI is unsure, a worry comes back, someone seems upset (Tele-MANAS 14416 shown) or a topic is private. The family leaves a number right in the chat and gets a request number to check; counsellors see a call list with a short note, and mark it Called or Resolved.',
      to: '/counsellor',
    },
  ]
  return (
    <section className="section officials-section">
      <div className="container">
        <details className="officials">
          <summary>
            <span>
              <strong>For officials, judges and partners</strong>
              <small>The problem, how HunarSetu meets problem statement SIH26241, the dashboard and the roadmap</small>
            </span>
            <ChevronDown size={22} aria-hidden="true" />
          </summary>
          <div className="officials-body">
            <div className="stats-grid stats-grid-flat">
              <div className="stat">
                <span className="stat-value">4.1%</span>
                <span className="stat-label">of Indians aged 15–59 have formal vocational training</span>
                <span className="stat-src">PLFS 2023-24</span>
              </div>
              <div className="stat">
                <span className="stat-value">5.6%</span>
                <span className="stat-label">of rural youth are in any vocational course, flat since 2017</span>
                <span className="stat-src">ASER 2023</span>
              </div>
              <div className="stat">
                <span className="stat-value">&lt;15%</span>
                <span className="stat-label">of ITI trainees are women</span>
                <span className="stat-src">NITI Aayog 2023</span>
              </div>
              <div className="stat">
                <span className="stat-value">&lt;₹10</span>
                <span className="stat-label">estimated cost per family session, vs ₹200+ in person</span>
                <span className="stat-src">HunarSetu estimate</span>
              </div>
            </div>

            <h3>How HunarSetu meets the brief</h3>
            <ol className="brief">
              {brief.map((r) => (
                <li key={r.need} className="brief-row">
                  <span className="brief-icon">
                    <r.icon size={20} aria-hidden="true" />
                  </span>
                  <div className="brief-text">
                    <strong>{r.need}</strong>
                    <p>{r.how}</p>
                  </div>
                  <Link to={r.to} className="btn btn-outline btn-sm">
                    Open <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ol>

            <div className="officials-cols">
              <div>
                <h3>Admin dashboard</h3>
                <p className="muted">
                  Where and why families say no, the families waiting for a call, and the number checks. Officials sign in with the admin password.
                </p>
                <Link to="/admin" className="btn btn-dark btn-sm">
                  <Lock size={14} aria-hidden="true" /> Open the admin dashboard
                </Link>
              </div>
              <div>
                <h3>Pilot targets and roadmap</h3>
                <p className="muted">+25% family consent · −20% mid-course dropout</p>
                <ol className="roadmap-compact">
                  <li>
                    <strong>0–6 months · District pilot.</strong> 1 district, Telugu + Hindi, 5 trades, IVR + WhatsApp.
                  </li>
                  <li>
                    <strong>6–18 months · State.</strong> 10 languages, every ITI/PMKVY centre, EPFO-linked tracer, counsellor copilot.
                  </li>
                  <li>
                    <strong>18–36 months · National.</strong> SIDH integration, 22 languages, Class 9–10 guidance, DigiLocker links.
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </details>
      </div>
    </section>
  )
}

/* ---------------- Page ---------------- */

export default function Home() {
  const { t, L, easy, setEasy, autoRead, setAutoRead } = useApp()
  const [chatMode, setChatModeState] = useState(readChatMode)
  const askRef = useRef(null)
  const setChatMode = (m) => {
    setChatModeState(m)
    try {
      localStorage.setItem('hs.chatMode', m === 'docked' ? 'docked' : 'min')
    } catch {
      /* storage unavailable */
    }
  }
  const askNow = (text) => {
    if (chatMode === 'docked') window.scrollTo({ top: 0, behavior: 'smooth' })
    else setChatMode('float')
    askRef.current?.(text)
  }
  const p = bestProvider('hanumakonda', 'electrician')

  const doCards = [
    { icon: MessageCircle, title: t('home.askTitle'), text: t('home.askText'), to: '/counsel' },
    { icon: BriefcaseBusiness, title: t('nav.trades'), text: t('home.coursesText'), to: '/trades' },
    { icon: Route, title: t('nav.pathShort'), text: t('home.pathText'), to: '/path' },
    { icon: Headset, title: t('nav.counsellor'), text: t('home.personText'), to: '/counsellor' },
  ]

  return (
    <>
      <section className="hero">
        <HeroMedia />
        <div className={`container hero-grid ${chatMode === 'docked' ? '' : 'is-solo'}`}>
          <div className="hero-copy">
            <h1>
              {t('hero.title1')} <span className="hl">{t('hero.title2')}</span>
            </h1>
            <p className="hero-sub">{t('hero.sub')}</p>
            <div className="hero-ctas">
              <Link to="/counsel" className="btn btn-primary btn-lg">
                {t('cta.start')} <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link to="/trades" className="btn btn-ghost-light btn-lg">
                {t('cta.trades')}
              </Link>
            </div>
            <div className="hero-langs">
              <LangSwitch />
            </div>
          </div>
          <HeroLiveChat mode={chatMode} setMode={setChatMode} askRef={askRef} />
        </div>
      </section>

      <section className="section section-tight">
        <div className="container">
          <h2 className="center">{t('home.doTitle')}</h2>
          <div className="do-grid">
            {doCards.map((c) => (
              <Link key={c.to} to={c.to} className="do-card">
                <span className="do-icon">
                  <c.icon size={28} aria-hidden="true" />
                </span>
                <strong>{c.title}</strong>
                <span>{c.text}</span>
                <ArrowRight className="do-arrow" size={18} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-tint section-tight">
        <div className="container">
          <h2 className="center">{t('home.worriesTitle')}</h2>
          <p className="center muted">{t('home.worriesSub')}</p>
          <div className="worry-grid">
            {OBJECTION_KEYS.map((k) => (
              <button key={k} type="button" className="worry-tile" onClick={() => askNow(L(OBJECTIONS[k].ask))}>
                <span className="worry-icon">
                  <Icon name={OBJECTIONS[k].icon} size={24} />
                </span>
                <strong>{L(OBJECTIONS[k].label)}</strong>
                <span>{L(OBJECTIONS[k].ask)}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-tight">
        <div className="container how">
          <div>
            <h2>{t('home.howTitle')}</h2>
            <ol className="how-steps">
              {[1, 2, 3].map((n) => (
                <li key={n}>
                  <span className="how-num">{n}</span>
                  <div>
                    <strong>{t(`home.step${n}`)}</strong>
                    <p>{t(`home.step${n}Text`)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link to="/counsel" className="btn btn-primary">
              {t('cta.start')} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="media-frame how-photo">
            <img src={img('1739109136649-8ebdddc2a6c9', 900)} alt="A woman sewing at a machine in a tailoring workshop" loading="lazy" />
          </div>
        </div>
      </section>

      <section className="section section-tight easy-section">
        <div className="container">
          <h2 className="center">{t('easy.title')}</h2>
          <p className="center muted">{t('easy.sub')}</p>
          <div className="easy-grid">
            {[
              [Mic, t('easy.talk'), t('easy.talkText')],
              [Volume2, t('easy.listen'), t('easy.listenText'), autoRead, () => setAutoRead(!autoRead)],
              [Pointer, t('easy.pictures'), t('easy.picturesText')],
              [ALargeSmall, t('easy.big'), t('easy.bigText'), easy, () => setEasy(!easy)],
            ].map(([I, title, text, on, toggle]) => {
              const inner = (
                <>
                  <span className="easy-icon">
                    <I size={30} aria-hidden="true" />
                  </span>
                  <strong>{title}</strong>
                  <span>{text}</span>
                  {toggle && <span className={`easy-state ${on ? 'is-on' : ''}`}>{t(on ? 'easy.onLabel' : 'easy.offLabel')}</span>}
                </>
              )
              return toggle ? (
                <button key={title} type="button" className={`easy-tile is-switch ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={toggle}>
                  {inner}
                </button>
              ) : (
                <div key={title} className="easy-tile">
                  {inner}
                </div>
              )
            })}
          </div>
          <div className="head-actions center">
            <Link to="/counsel" className="btn btn-primary">
              {t('easy.try')} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-tint section-tight">
        <div className="container trust-simple">
          <div>
            <h2>{t('home.trustTitle')}</h2>
            <p className="lead">{t('home.trustText')}</p>
            <ul className="badge-meanings">
              <li>
                <TrustBadge kind="verified" /> <span>{t('home.checkedText')}</span>
              </li>
              <li>
                <TrustBadge kind="provider" /> <span>{t('home.centreText')}</span>
              </li>
              <li>
                <TrustBadge kind="estimated" /> <span>{t('home.estimateText')}</span>
              </li>
            </ul>
            <Link to="/numbers" className="btn btn-outline">
              {t('num.seeAll')} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="compare">
            <div className="compare-card is-bad">
              <span className="compare-who">{t('home.otherApps')}</span>
              <p>{t('home.otherClaim')}</p>
              <span className="compare-verdict">
                <Ban size={16} aria-hidden="true" /> {t('home.noProof')}
              </span>
            </div>
            <div className="compare-card is-good">
              <span className="compare-who">HunarSetu</span>
              <p>
                {t('c.firstJob')}: <strong>{inrRange(p.earnLow, p.earnHigh)}</strong>
              </p>
              <span className="compare-verdict">
                <Check size={16} aria-hidden="true" /> <TrustBadge kind={p.earnBadge} small /> {t('home.checkedText')}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-band" style={{ backgroundImage: `url(${img('1784815052574-77e1115e303a', 1800)})` }}>
        <div className="cta-shade" aria-hidden="true" />
        <div className="container cta-inner">
          <h2>{t('home.finalTitle')}</h2>
          <p>{t('home.finalText')}</p>
          <div className="hero-ctas">
            <Link to="/counsel" className="btn btn-primary btn-lg">
              {t('cta.start')} <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link to="/counsellor" className="btn btn-ghost-light btn-lg">
              {t('nav.counsellor')}
            </Link>
          </div>
        </div>
      </section>

      <Officials />
    </>
  )
}
