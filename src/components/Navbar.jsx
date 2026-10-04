import { useEffect, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { Menu, X, Accessibility, LayoutDashboard } from 'lucide-react'
import { useApp } from '../AppContext'
import { LANGS } from '../i18n/strings'
import { Wordmark } from './Logo'

const LINKS = [
  ['/counsel', 'nav.counsel'],
  ['/trades', 'nav.trades'],
  ['/path', 'nav.pathShort'],
  ['/counsellor', 'nav.counsellor'],
]

export function LangSwitch({ compact = false }) {
  const { lang, setLang } = useApp()
  return (
    <div className={`lang-switch ${compact ? 'is-compact' : ''}`} role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button key={l.id} type="button" className={lang === l.id ? 'is-active' : ''} aria-pressed={lang === l.id} onClick={() => setLang(l.id)} lang={l.id}>
          {l.label}
        </button>
      ))}
    </div>
  )
}

export default function Navbar() {
  const { t, easy, setEasy } = useApp()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()
  const overHero = pathname === '/' && !scrolled

  useEffect(() => {
    setOpen(false)
  }, [pathname])
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  return (
    <header className={`nav ${overHero ? 'is-over-hero' : ''} ${open ? 'is-open' : ''}`}>
      <div className="nav-inner">
        <Link to="/" className="nav-brand" aria-label="HunarSetu home">
          <Wordmark light={overHero} />
        </Link>
        <nav className="nav-links" aria-label="Main">
          {LINKS.map(([to, key]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'is-active' : '')}>
              {t(key)}
            </NavLink>
          ))}
        </nav>
        <div className="nav-tools">
          <LangSwitch />
          <button type="button" className={`easy-toggle ${easy ? 'is-on' : ''}`} onClick={() => setEasy(!easy)} aria-pressed={easy} title={t('easy.on')}>
            <Accessibility size={18} aria-hidden="true" />
            <span>{t('easy.on')}</span>
          </button>
          <NavLink to="/admin" className={({ isActive }) => `admin-link ${isActive ? 'is-active' : ''}`} title={t('nav.adminHint')} aria-label={t('nav.adminHint')}>
            <LayoutDashboard size={15} aria-hidden="true" />
            <span>{t('nav.admin')}</span>
          </NavLink>
          <button type="button" className="nav-burger" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={t('nav.menu')}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="nav-drawer">
          {[['/', 'nav.home'], ...LINKS, ['/simulator', 'nav.simulator']].map(([to, key]) => (
            <NavLink key={to} to={to} end>
              {t(key)}
            </NavLink>
          ))}
          <LangSwitch />
        </div>
      )}
    </header>
  )
}
