import { Link } from 'react-router-dom'
import { useApp } from '../AppContext'
import { Wordmark } from './Logo'

export default function Footer() {
  const { t } = useApp()
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Wordmark light />
          <p className="footer-tag">
            Family-first AI counselling for vocational career pathways. Learners and parents decide together, with verified local evidence.
          </p>
        </div>
        <div>
          <h4>Pages</h4>
          <Link to="/counsel">{t('nav.counsel')}</Link>
          <Link to="/trades">{t('nav.trades')}</Link>
          <Link to="/path">{t('nav.pathShort')}</Link>
          <Link to="/numbers">{t('nav.numbers')}</Link>
          <Link to="/simulator">{t('nav.simulator')}</Link>
          <Link to="/pact">{t('nav.pact')}</Link>
          <Link to="/counsellor">{t('nav.counsellor')}</Link>
          <Link to="/admin">{t('nav.admin')}</Link>
        </div>
        <div>
          <h4>Built on</h4>
          <span>Bhashini · IndicTrans2 · IndicVoices</span>
          <span>SIDH · NCVET NQR · DGT-ITI MIS</span>
          <span>PLFS wages · National Career Service</span>
          <span>Free AI: Pollinations, Groq or Gemini (Claude optional)</span>
          <span>India Post PIN API · OpenStreetMap</span>
          <span>DPDP Act 2023 consent-first design</span>
        </div>
        <div>
          <h4>Smart India Hackathon 2026</h4>
          <span>Problem statement SIH26241</span>
          <span>Theme: Smart Education</span>
          <span>Team Bloch ’n roll_A0 · ID 177014</span>
        </div>
      </div>
      <div className="container footer-base">
        <span>{t('c.demo')}</span>
        <span>
          Videos:{' '}
          <a href="https://www.pexels.com" target="_blank" rel="noreferrer">
            Pexels
          </a>{' '}
          · Photos:{' '}
          <a href="https://unsplash.com" target="_blank" rel="noreferrer">
            Unsplash
          </a>{' '}
          · Map ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>{' '}
          contributors
        </span>
      </div>
    </footer>
  )
}
