import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building, PhoneCall, BadgeCheck, ArrowRight, ChevronDown } from 'lucide-react'
import { useApp } from '../AppContext'
import { DISTRICTS } from '../data/districts.js'
import { TRADES, getTrade } from '../data/trades.js'
import { PROVIDERS, VERIFICATION } from '../data/outcomes.js'
import { inrRange, num } from '../lib/format.js'
import { TrustBadge } from '../components/Trust'

const L3 = (en, hi, te) => ({ en, hi, te })
const TXT = {
  title: L3('How we check the numbers', 'हम आंकड़े कैसे जाँचते हैं', 'సంఖ్యలను ఎలా తనిఖీ చేస్తాం'),
  sub: L3(
    'Every pay and job number in HunarSetu comes from this list. Nothing is made up.',
    'हुनरसेतु का हर वेतन और नौकरी का आंकड़ा इसी सूची से आता है। कुछ भी मनगढ़ंत नहीं।',
    'హునర్‌సేతులోని ప్రతి జీతం, ఉద్యోగ సంఖ్య ఈ జాబితా నుండే వస్తుంది. ఏదీ కల్పితం కాదు.',
  ),
  step1: L3('The centre tells us', 'सेंटर हमें बताता है', 'సెంటర్ మాకు చెబుతుంది'),
  step1t: L3('Each centre sends its own pay and job numbers.', 'हर सेंटर अपने वेतन और नौकरी के आंकड़े भेजता है।', 'ప్రతి సెంటర్ తన జీతం, ఉద్యోగ సంఖ్యలు పంపుతుంది.'),
  step2: L3('We phone past students', 'हम पुराने विद्यार्थियों को फ़ोन करते हैं', 'పాత విద్యార్థులకు ఫోన్ చేస్తాం'),
  step2t: L3('6 and 12 months after the course: did you get a job? What is your pay?', 'कोर्स के 6 और 12 महीने बाद: नौकरी मिली? वेतन कितना है?', 'కోర్సు తర్వాత 6, 12 నెలలకు: ఉద్యోగం వచ్చిందా? జీతం ఎంత?'),
  step3: L3('We show it with a label', 'हम निशान के साथ दिखाते हैं', 'గుర్తుతో చూపిస్తాం'),
  step3t: L3('“Checked” if enough students answered. Otherwise “Centre says”.', 'काफ़ी विद्यार्थियों ने जवाब दिया तो “जाँचा गया”, वरना “सेंटर के अनुसार”।', 'తగినంత మంది చెబితే “తనిఖీ చేశాం”, లేకపోతే “సెంటర్ చెప్పింది”.'),
  centres: L3('centres', 'सेंटर', 'సెంటర్లు'),
  checked: L3('checked by calls', 'फ़ोन से जाँचे गए', 'ఫోన్‌తో తనిఖీ'),
  calls: L3('phone calls to past students', 'पुराने विद्यार्थियों को फ़ोन', 'పాత విద్యార్థులకు ఫోన్లు'),
  flagged: L3('centres said more than their students did', 'सेंटरों ने विद्यार्थियों से ज़्यादा बताया', 'సెంటర్లు విద్యార్థుల కంటే ఎక్కువ చెప్పాయి'),
  list: L3('All centres', 'सभी सेंटर', 'అన్ని సెంటర్లు'),
  district: L3('District', 'ज़िला', 'జిల్లా'),
  course: L3('Course', 'कोर्स', 'కోర్సు'),
  all: L3('All', 'सभी', 'అన్నీ'),
  pay: L3('Pay in first job', 'पहली नौकरी में वेतन', 'మొదటి ఉద్యోగంలో జీతం'),
  job: L3('Got a job', 'नौकरी मिली', 'ఉద్యోగం వచ్చింది'),
  how: L3('How we checked', 'हमने कैसे जाँचा', 'ఎలా తనిఖీ చేశాం'),
  saidCentre: L3('The centre said', 'सेंटर ने कहा', 'సెంటర్ చెప్పింది'),
  saidStudents: L3('Past students said', 'पुराने विद्यार्थियों ने कहा', 'పాత విద్యార్థులు చెప్పారు'),
  weShow: L3('We show', 'हम दिखाते हैं', 'మేము చూపేది'),
  notYet: L3('not enough calls yet', 'अभी काफ़ी फ़ोन नहीं हुए', 'ఇంకా తగినన్ని ఫోన్లు కాలేదు'),
  callsN: L3('{n} calls', '{n} फ़ोन', '{n} ఫోన్లు'),
  live: L3('Live from the HunarSetu database', 'हुनरसेतु डेटाबेस से सीधे', 'హునర్‌సేతు డేటాబేస్ నుండి నేరుగా'),
  bundled: L3('Saved copy (server not reachable)', 'सहेजी हुई कॉपी (सर्वर उपलब्ध नहीं)', 'సేవ్ చేసిన కాపీ (సర్వర్ అందుబాటులో లేదు)'),
  sample: L3('Test version: these are example numbers, not real records.', 'टेस्ट संस्करण: ये उदाहरण आंकड़े हैं, असली रिकॉर्ड नहीं।', 'పరీక్ష వెర్షన్: ఇవి ఉదాహరణ సంఖ్యలు, నిజమైన రికార్డులు కావు.'),
  ask: L3('Ask about any of these', 'इनमें से किसी के बारे में पूछें', 'వీటిలో దేని గురించైనా అడగండి'),
}

function Row({ p }) {
  const { L, t } = useApp()
  const [open, setOpen] = useState(false)
  const traced = p.tracerRespondents >= 25
  return (
    <li className={`num-row ${open ? 'is-open' : ''}`}>
      <button type="button" className="num-main" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="num-name">
          <strong>{L(p.name)}</strong>
          <small>
            {L(getTrade(p.tradeId).name)} · {L(DISTRICTS.find((d) => d.id === p.districtId).name)}
          </small>
        </span>
        <span className="num-fig">
          <small>{L(TXT.pay)}</small>
          {inrRange(p.earnLow, p.earnHigh)}
        </span>
        <span className="num-fig">
          <small>{L(TXT.job)}</small>
          {p.placement}%
        </span>
        <TrustBadge kind={p.earnBadge} small />
        <ChevronDown className="num-chev" size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="num-detail">
          <div>
            <span>{L(TXT.saidCentre)}</span>
            <strong>{p.claimPlacement}%</strong>
          </div>
          <div>
            <span>{L(TXT.saidStudents)}</span>
            <strong>
              {traced ? `${p.placement}%` : '—'} <small>({p.tracerRespondents ? L(TXT.callsN).replace('{n}', p.tracerRespondents) : L(TXT.notYet)})</small>
            </strong>
          </div>
          <div>
            <span>{L(TXT.weShow)}</span>
            <strong>
              {p.placement}% <TrustBadge kind={p.placeBadge} small />
            </strong>
          </div>
          {p.flagged && <p className="num-flag">{t('num.flagged', { gap: p.claimPlacement - p.placement })}</p>}
        </div>
      )}
    </li>
  )
}

export default function Numbers() {
  const { L, session } = useApp()
  const [district, setDistrict] = useState(session?.profile?.district ?? 'all')
  const [trade, setTrade] = useState('all')
  const s = VERIFICATION.stats
  const rows = useMemo(
    () =>
      PROVIDERS.filter((p) => (district === 'all' || p.districtId === district) && (trade === 'all' || p.tradeId === trade)).sort(
        (a, b) => a.districtId.localeCompare(b.districtId) || a.tradeId.localeCompare(b.tradeId) || b.placement - a.placement,
      ),
    [district, trade, VERIFICATION.source],
  )

  return (
    <div className="page">
      <section className="page-head">
        <div className="container">
          <h1>{L(TXT.title)}</h1>
          <p className="lead">{L(TXT.sub)}</p>
        </div>
      </section>
      <div className="container">
        <ol className="check-steps">
          {[
            [Building, TXT.step1, TXT.step1t],
            [PhoneCall, TXT.step2, TXT.step2t],
            [BadgeCheck, TXT.step3, TXT.step3t],
          ].map(([I, title, text], i) => (
            <li key={i}>
              <span className="check-step-icon">
                <I size={24} aria-hidden="true" />
              </span>
              <span className="check-step-num">{i + 1}</span>
              <strong>{L(title)}</strong>
              <span>{L(text)}</span>
            </li>
          ))}
        </ol>

        <div className="num-stats">
          <div>
            <strong>{s.records}</strong>
            <span>{L(TXT.centres)}</span>
          </div>
          <div>
            <strong>{s.verified}</strong>
            <span>{L(TXT.checked)}</span>
          </div>
          <div>
            <strong>{num(s.tracerCalls)}</strong>
            <span>{L(TXT.calls)}</span>
          </div>
          <div className="is-flag">
            <strong>{s.flagged}</strong>
            <span>{L(TXT.flagged)}</span>
          </div>
        </div>
        <p className="num-source">
          <span className={`live-dot ${VERIFICATION.source === 'server' ? '' : 'is-off'}`} aria-hidden="true" />
          {L(VERIFICATION.source === 'server' ? TXT.live : TXT.bundled)}
        </p>

        <section className="panel">
          <div className="panel-head">
            <h2>{L(TXT.list)}</h2>
            <div className="num-filters">
              <label className="field">
                <span>{L(TXT.district)}</span>
                <select value={district} onChange={(e) => setDistrict(e.target.value)}>
                  <option value="all">{L(TXT.all)}</option>
                  {DISTRICTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {L(d.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{L(TXT.course)}</span>
                <select value={trade} onChange={(e) => setTrade(e.target.value)}>
                  <option value="all">{L(TXT.all)}</option>
                  {TRADES.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {L(tr.name)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <ul className="num-list">
            {rows.map((p) => (
              <Row key={p.id} p={p} />
            ))}
          </ul>
        </section>

        <div className="head-actions">
          <Link to="/counsel" className="btn btn-primary">
            {L(TXT.ask)} <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <p className="demo-note">{L(TXT.sample)}</p>
      </div>
    </div>
  )
}
