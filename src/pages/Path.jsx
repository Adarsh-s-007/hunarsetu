import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, Wallet, MapPin, ShieldCheck, CircleCheck, CircleAlert, FileText, Calculator, Headset, BookOpen } from 'lucide-react'
import { useApp } from '../AppContext'
import { DISTRICTS, getDistrict } from '../data/districts.js'
import { TRADES, EDUCATION, INCOME, getTrade, eligibleTrades } from '../data/trades.js'
import { providersFor, bestProvider } from '../data/outcomes.js'
import { recommendTrade } from '../engine/counsel.js'
import { inr, inrRange, fill } from '../lib/format.js'
import Icon from '../components/Icon'
import SpeakButton from '../components/SpeakButton'
import { TrustBadge, DemoNote } from '../components/Trust'
import NearbyPlaces from '../components/NearbyPlaces'

const L3 = (en, hi, te) => ({ en, hi, te })

const TXT = {
  title: L3('Your path, explained in simple words', 'आपका रास्ता, आसान शब्दों में', 'మీ దారి, సులభమైన మాటల్లో'),
  sub: L3(
    'What this course means for your family: can you join, what it costs, how far it is, and where it leads.',
    'यह कोर्स आपके परिवार के लिए क्या मायने रखता है: क्या दाख़िला मिलेगा, कितना खर्च होगा, कितनी दूर है, और आगे कहाँ ले जाता है।',
    'ఈ కోర్సు మీ కుటుంబానికి ఏమిటి: చేరగలరా, ఎంత ఖర్చు, ఎంత దూరం, ఎక్కడికి తీసుకెళ్తుంది.',
  ),
  checks: L3('Can we do this?', 'क्या हम यह कर सकते हैं?', 'మనం ఇది చేయగలమా?'),
  steps: L3('The path, step by step', 'रास्ता, एक-एक कदम', 'దారి, ఒక్కో అడుగు'),
  words: L3('Words you may hear', 'शब्द जो आप सुनेंगे', 'మీరు వినే మాటలు'),
  schooling: L3('Schooling', 'पढ़ाई', 'చదువు'),
  money: L3('Money', 'पैसा', 'డబ్బు'),
  place: L3('Place', 'जगह', 'ప్రదేశం'),
  safety: L3('Safety', 'सुरक्षा', 'భద్రత'),
  learner: L3('Learner', 'विद्यार्थी', 'విద్యార్థి'),
  girl: L3('Girl', 'लड़की', 'అమ్మాయి'),
  boy: L3('Boy', 'लड़का', 'అబ్బాయి'),
  eduOk: L3('Class {cls} pass is enough to join {trade}.', '{trade} में दाख़िले के लिए {cls}वीं पास काफ़ी है।', '{trade}లో చేరడానికి {cls}వ తరగతి పాస్ సరిపోతుంది.'),
  eduNo: L3(
    '{trade} needs Class 10 pass. With this schooling, these courses are open: {list}.',
    '{trade} के लिए 10वीं पास होना ज़रूरी है। इस पढ़ाई के साथ ये कोर्स खुले हैं: {list}।',
    '{trade}కి 10వ తరగతి పాస్ అవసరం. ఈ చదువుతో ఈ కోర్సులు చేయవచ్చు: {list}.',
  ),
  free: L3('The course at {centre} is free (government-funded).', '{centre} में यह कोर्स मुफ़्त है (सरकारी खर्च पर)।', '{centre}లో ఈ కోర్సు ఉచితం (ప్రభుత్వ నిధులతో).'),
  fee: L3('The fee at {centre} is {fee} a year.', '{centre} में फीस {fee} प्रति वर्ष है।', '{centre}లో ఫీజు సంవత్సరానికి {fee}.'),
  likely: L3(
    ' With your family income, fee reimbursement and a free hostel seat are likely.',
    ' आपकी पारिवारिक आय के हिसाब से फीस प्रतिपूर्ति और मुफ़्त हॉस्टल सीट मिलने की संभावना है।',
    ' మీ కుటుంబ ఆదాయం ప్రకారం ఫీజు రీయింబర్స్‌మెంట్, ఉచిత హాస్టల్ సీటు వచ్చే అవకాశం ఉంది.',
  ),
  possible: L3(' Partial fee support may be possible.', ' आंशिक फीस सहायता मिल सकती है।', ' పాక్షిక ఫీజు సహాయం లభించవచ్చు.'),
  unlikely: L3(' Fee support is unlikely at your income.', ' आपकी आय पर फीस सहायता की संभावना कम है।', ' మీ ఆదాయంలో ఫీజు సహాయం వచ్చే అవకాశం తక్కువ.'),
  stipend: L3(
    ' During the apprenticeship year the learner earns a stipend of {stipend} a month.',
    ' अप्रेंटिसशिप के साल में हर महीने {stipend} स्टाइपेंड मिलता है।',
    ' అప్రెంటిస్‌షిప్ సంవత్సరంలో నెలకు {stipend} స్టైపెండ్ వస్తుంది.',
  ),
  near: L3('The nearest centre, {centre}, is {km} km from town.', 'सबसे पास का सेंटर, {centre}, शहर से {km} किमी दूर है।', 'దగ్గర్లోని సెంటర్, {centre}, పట్టణం నుండి {km} కి.మీ దూరంలో ఉంది.'),
  bus: L3(' A student bus pass covers the route.', ' इस रूट पर स्टूडेंट बस पास मिलता है।', ' ఈ మార్గంలో విద్యార్థి బస్ పాస్ వర్తిస్తుంది.'),
  noBus: L3(' There is no bus-pass route yet.', ' अभी बस पास रूट नहीं है।', ' ఇంకా బస్ పాస్ మార్గం లేదు.'),
  hostel: L3(' A hostel is available.', ' हॉस्टल उपलब्ध है।', ' హాస్టల్ ఉంది.'),
  safeGirl: L3(
    '{women}% of trainees are women. Women instructors: {wi}. Girls’ hostel: {yn}.',
    '{women}% प्रशिक्षु महिलाएँ हैं, {wi} महिला प्रशिक्षक हैं। लड़कियों का हॉस्टल: {yn}।',
    '{women}% శిక్షణార్థులు మహిళలు, {wi} మంది మహిళా శిక్షకులు ఉన్నారు. బాలికల హాస్టల్: {yn}.',
  ),
  safeBoy: L3(
    'Every course teaches workplace safety, first aid and the right use of safety gear.',
    'हर कोर्स में कार्यस्थल सुरक्षा, प्राथमिक चिकित्सा और सुरक्षा उपकरणों का सही इस्तेमाल सिखाया जाता है।',
    'ప్రతి కోర్సులో పని ప్రదేశ భద్రత, ప్రథమ చికిత్స, భద్రతా పరికరాల సరైన వాడకం నేర్పిస్తారు.',
  ),
  yes: L3('yes', 'हाँ', 'ఉంది'),
  no: L3('no', 'नहीं', 'లేదు'),
  learn: L3(
    'Learn the skill at {centre}: {months} months, mostly hands-on practice in a workshop.',
    '{centre} में हुनर सीखें: {months} महीने, ज़्यादातर वर्कशॉप में हाथ से अभ्यास।',
    '{centre}లో నైపుణ్యం నేర్చుకోండి: {months} నెలలు, ఎక్కువగా వర్క్‌షాప్‌లో చేతితో సాధన.',
  ),
  firstJob: L3('First job: {earn} a month.', 'पहली नौकरी: हर महीने {earn}।', 'మొదటి ఉద్యోగం: నెలకు {earn}.'),
  checked: L3(' Checked by calling past trainees.', ' पुराने विद्यार्थियों को फ़ोन करके जाँचा गया।', ' పాత విద్యార్థులకు ఫోన్ చేసి తనిఖీ చేశాం.'),
  claimed: L3(' Reported by the centre, not yet checked.', ' सेंटर द्वारा बताया गया, अभी जाँचा नहीं गया।', ' సెంటర్ తెలిపినది, ఇంకా తనిఖీ చేయలేదు.'),
  apprentice: L3('Earn while you learn: a year of paid training inside a real company.', 'सीखते हुए कमाएँ: किसी असली कंपनी में एक साल की पेड ट्रेनिंग।', 'నేర్చుకుంటూ సంపాదించండి: నిజమైన కంపెనీలో ఒక సంవత్సరం జీతంతో శిక్షణ.'),
  grow: L3('With experience and a certificate, move up to: {role}.', 'अनुभव और प्रमाण पत्र के साथ आगे बढ़ें: {role}।', 'అనుభవం, సర్టిఫికెట్‌తో ఎదగండి: {role}.'),
  study: L3(
    'Want to study more? After the course, join further study such as a diploma (straight into the 2nd year after ITI). A degree is still possible later.',
    'और पढ़ना है? कोर्स के बाद आगे की पढ़ाई करें, जैसे डिप्लोमा (ITI के बाद सीधे दूसरे साल में)। डिग्री बाद में भी हो सकती है।',
    'ఇంకా చదవాలా? కోర్సు తర్వాత డిప్లొమా వంటి పై చదువులు చదవండి (ITI తర్వాత నేరుగా రెండో సంవత్సరంలో). డిగ్రీ తర్వాత కూడా చేయవచ్చు.',
  ),
  own: L3('Many start their own work, like a repair service or a boutique.', 'कई लोग अपना काम शुरू करते हैं, जैसे रिपेयर सर्विस या बुटीक।', 'చాలామంది సొంత పని మొదలుపెడతారు, రిపేర్ సర్వీస్ లేదా బొటిక్ లాంటివి.'),
  perMonth: L3('a month', 'प्रति माह', 'నెలకు'),
  level: L3('Level', 'स्तर', 'స్థాయి'),
  pact: L3('Make our Family Career Pact', 'परिवार करियर संकल्प बनाएँ', 'కుటుంబ కెరీర్ ఒప్పందం చేయండి'),
  simulate: L3('Compare 5-year earnings', '5 साल की कमाई की तुलना करें', '5 ఏళ్ల సంపాదన పోల్చండి'),
  person: L3('Talk to a person', 'किसी से बात करें', 'వ్యక్తితో మాట్లాడండి'),
}

const GLOSSARY = [
  {
    term: L3('ITI', 'ITI', 'ITI'),
    means: L3(
      'Industrial Training Institute. A recognised institute where you learn a trade by doing it, in 1 or 2 years.',
      'औद्योगिक प्रशिक्षण संस्थान। एक मान्यता प्राप्त संस्थान जहाँ 1 या 2 साल में काम करके हुनर सीखा जाता है।',
      'పారిశ్రామిక శిక్షణ సంస్థ. 1 లేదా 2 సంవత్సరాల్లో పని చేస్తూ వృత్తి నేర్చుకునే గుర్తింపు పొందిన సంస్థ.',
    ),
  },
  {
    term: L3('NSQF level', 'NSQF स्तर', 'NSQF స్థాయి'),
    means: L3(
      'A national ladder of skill levels. A higher level means more skill and better pay, and it can count towards further study.',
      'हुनर के स्तरों की एक राष्ट्रीय सीढ़ी। ऊँचा स्तर यानी ज़्यादा हुनर और बेहतर वेतन, और यह आगे की पढ़ाई में भी गिना जाता है।',
      'నైపుణ్య స్థాయిల జాతీయ నిచ్చెన. స్థాయి ఎక్కువైతే నైపుణ్యం, జీతం ఎక్కువ; పై చదువులకూ లెక్కలోకి వస్తుంది.',
    ),
  },
  {
    term: L3('PMKVY', 'PMKVY', 'PMKVY'),
    means: L3(
      'Free short skill courses of a few months, paid for by the government, with a certificate.',
      'सरकार द्वारा मुफ़्त चलाए जाने वाले कुछ महीनों के छोटे कौशल कोर्स, प्रमाण पत्र के साथ।',
      'ప్రభుత్వం ఉచితంగా అందించే కొన్ని నెలల చిన్న నైపుణ్య కోర్సులు, సర్టిఫికెట్‌తో.',
    ),
  },
  {
    term: L3('Apprenticeship', 'अप्रेंटिसशिप', 'అప్రెంటిస్‌షిప్'),
    means: L3(
      'Training on the job inside a real company, usually for a year, with a monthly stipend.',
      'किसी असली कंपनी में काम करते हुए ट्रेनिंग, आमतौर पर एक साल, हर महीने स्टाइपेंड के साथ।',
      'నిజమైన కంపెనీలో పని చేస్తూ శిక్షణ, సాధారణంగా ఒక సంవత్సరం, నెలవారీ స్టైపెండ్‌తో.',
    ),
  },
  {
    term: L3('Stipend', 'स्टाइपेंड', 'స్టైపెండ్'),
    means: L3('Money paid to a trainee every month while they are still learning.', 'सीखते समय प्रशिक्षु को हर महीने मिलने वाला पैसा।', 'నేర్చుకుంటున్నప్పుడే శిక్షణార్థికి ప్రతి నెలా ఇచ్చే డబ్బు.'),
  },
  {
    term: L3('Placement', 'प्लेसमेंट', 'ప్లేస్‌మెంట్'),
    means: L3('Getting a job after finishing the course.', 'कोर्स पूरा करने के बाद नौकरी मिलना।', 'కోర్సు పూర్తయ్యాక ఉద్యోగం రావడం.'),
  },
  {
    term: L3('Lateral entry', 'लैटरल एंट्री', 'లేటరల్ ఎంట్రీ'),
    means: L3(
      'After ITI, joining a diploma directly in the 2nd year, so the learner does not start from zero.',
      'ITI के बाद सीधे डिप्लोमा के दूसरे साल में दाख़िला, ताकि शुरुआत शून्य से न करनी पड़े।',
      'ITI తర్వాత నేరుగా డిప్లొమా రెండో సంవత్సరంలో చేరడం, మొదటి నుండి మొదలుపెట్టనవసరం లేదు.',
    ),
  },
  {
    term: L3('Tracer call', 'ट्रेसर कॉल', 'ట్రేసర్ కాల్'),
    means: L3(
      'We phone past trainees 6 and 12 months after the course to check whether they really got jobs and what they earn.',
      'हम पुराने विद्यार्थियों को कोर्स के 6 और 12 महीने बाद फ़ोन करके जाँचते हैं कि उन्हें सच में नौकरी मिली या नहीं और वे कितना कमाते हैं।',
      'కోర్సు తర్వాత 6, 12 నెలలకు పాత విద్యార్థులకు ఫోన్ చేసి, నిజంగా ఉద్యోగం వచ్చిందా, ఎంత సంపాదిస్తున్నారో తనిఖీ చేస్తాం.',
    ),
  },
]

const round500 = (n) => Math.round(n / 500) * 500

export default function Path() {
  const { t, L, session } = useApp()
  const sp = session?.profile
  const [p, setP] = useState(() => ({
    trade: sp ? recommendTrade(sp) : 'electrician',
    district: sp?.district ?? 'hanumakonda',
    edu: sp?.edu ?? 'class10',
    income: sp?.income ?? '10to25',
    gender: sp?.gender ?? 'f',
  }))
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }))

  const trade = getTrade(p.trade)
  const district = getDistrict(p.district)
  const prov = bestProvider(district.id, trade.id)
  const nearest = [...providersFor(district.id, trade.id)].sort((a, b) => a.km - b.km)[0]
  const eligible = eligibleTrades(p.edu).some((x) => x.id === trade.id)
  const hasStipend = trade.staircase.some((s) => s.stipend)
  const support = p.income === 'lt10' || p.income === '10to25' ? 'likely' : p.income === '25to50' ? 'possible' : 'unlikely'
  const tradeName = L(trade.name)

  const checks = useMemo(() => {
    const centre = L(prov.name)
    const money =
      (prov.fee === 0 ? fill(L(TXT.free), { centre }) : fill(L(TXT.fee), { centre, fee: inr(prov.fee) })) +
      (prov.fee === 0 ? '' : L(TXT[support])) +
      (hasStipend ? fill(L(TXT.stipend), { stipend: inr(prov.stipend) }) : '')
    const hostel = p.gender === 'f' ? nearest.girlsHostel : nearest.boysHostel
    return [
      {
        key: 'schooling',
        icon: GraduationCap,
        ok: eligible,
        text: eligible
          ? fill(L(TXT.eduOk), { cls: trade.minEdu === 'class8' ? 8 : 10, trade: tradeName })
          : fill(L(TXT.eduNo), { trade: tradeName, list: eligibleTrades(p.edu).map((x) => L(x.name)).join(', ') }),
      },
      { key: 'money', icon: Wallet, ok: prov.fee === 0 || support !== 'unlikely' || prov.fee < 5000, text: money, badge: 'provider' },
      {
        key: 'place',
        icon: MapPin,
        ok: nearest.km <= 15 || hostel || nearest.busPass,
        text: fill(L(TXT.near), { centre: L(nearest.name), km: nearest.km }) + L(nearest.busPass ? TXT.bus : TXT.noBus) + (hostel ? L(TXT.hostel) : ''),
        badge: 'verified',
      },
      {
        key: 'safety',
        icon: ShieldCheck,
        ok: p.gender === 'f' ? prov.girlsHostel || prov.women >= 20 : true,
        text: p.gender === 'f' ? fill(L(TXT.safeGirl), { women: prov.women, wi: prov.womenInstructors, yn: L(prov.girlsHostel ? TXT.yes : TXT.no) }) : L(TXT.safeBoy),
        badge: 'verified',
      },
    ]
  }, [L, prov, nearest, eligible, support, hasStipend, p.gender, p.edu, trade, tradeName])

  const steps = useMemo(() => {
    const out = [
      { icon: 'GraduationCap', title: trade.staircase[0].title, text: fill(L(TXT.learn), { centre: L(prov.name), months: trade.months }), meta: `${L(TXT.level)} ${trade.nsqf}` },
    ]
    const app = trade.staircase.find((s) => s.stipend)
    if (app) out.push({ icon: 'Wallet', title: app.title, text: L(TXT.apprentice), pay: inr(prov.stipend), badge: 'verified', meta: app.time })
    out.push({
      icon: 'BriefcaseBusiness',
      title: trade.staircase[0].role,
      text: fill(L(TXT.firstJob), { earn: inrRange(prov.earnLow, prov.earnHigh) }) + L(prov.earnBadge === 'verified' ? TXT.checked : TXT.claimed),
      pay: inrRange(prov.earnLow, prov.earnHigh),
      badge: prov.earnBadge,
    })
    for (const s of trade.staircase.slice(1)) {
      if (s.stipend) continue
      const kind = /lateral|diploma|degree|ANM|GNM|course|open-university/i.test(s.title) ? 'study' : /own|entrepreneur/i.test(`${s.title} ${s.role}`) ? 'own' : 'grow'
      out.push({
        icon: kind === 'study' ? 'GraduationCap' : kind === 'own' ? 'Users' : 'Zap',
        title: s.title,
        text: kind === 'grow' ? fill(L(TXT.grow), { role: s.role }) : L(TXT[kind]),
        pay: inrRange(round500(s.pay[0] * district.wage), round500(s.pay[1] * district.wage)),
        badge: 'estimated',
        meta: `${L(TXT.level)} ${s.nsqf} · ${s.time}`,
      })
    }
    return out
  }, [L, prov, trade, district])

  const readAll = [L(TXT.title), ...checks.map((c) => c.text), ...steps.map((s) => s.text)].join(' ')

  return (
    <div className="page">
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">{t('nav.path')}</span>
          <h1>{L(TXT.title)}</h1>
          <p className="lead">{L(TXT.sub)}</p>
          <div className="head-actions">
            <SpeakButton text={readAll} />
          </div>
        </div>
      </section>
      <div className="container">
        <div className="filter-row">
          <label className="field">
            <span>{t('c.trade')}</span>
            <select value={p.trade} onChange={(e) => set('trade', e.target.value)}>
              {TRADES.map((x) => (
                <option key={x.id} value={x.id}>
                  {L(x.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('c.district')}</span>
            <select value={p.district} onChange={(e) => set('district', e.target.value)}>
              {DISTRICTS.map((x) => (
                <option key={x.id} value={x.id}>
                  {L(x.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('setup.edu')}</span>
            <select value={p.edu} onChange={(e) => set('edu', e.target.value)}>
              {EDUCATION.map((x) => (
                <option key={x.id} value={x.id}>
                  {L(x.label)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('setup.income')}</span>
            <select value={p.income} onChange={(e) => set('income', e.target.value)}>
              {INCOME.map((x) => (
                <option key={x.id} value={x.id}>
                  {L(x.label)}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>{L(TXT.learner)}</span>
            <div className="seg seg-sm">
              {['f', 'm'].map((g) => (
                <button key={g} type="button" className={p.gender === g ? 'is-on' : ''} aria-pressed={p.gender === g} onClick={() => set('gender', g)}>
                  {L(g === 'f' ? TXT.girl : TXT.boy)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <section className="panel">
          <div className="panel-head">
            <h2>{L(TXT.checks)}</h2>
          </div>
          <div className="checks">
            {checks.map((c) => (
              <div key={c.key} className={`check-card ${c.ok ? 'is-ok' : 'is-warn'}`}>
                <div className="check-top">
                  <span className="check-icon">
                    <c.icon size={22} aria-hidden="true" />
                  </span>
                  <strong>{L(TXT[c.key])}</strong>
                  {c.ok ? <CircleCheck className="check-state" size={20} aria-label="OK" /> : <CircleAlert className="check-state" size={20} aria-label="Needs attention" />}
                </div>
                <p>{c.text}</p>
                <div className="check-foot">
                  {c.badge && <TrustBadge kind={c.badge} small />}
                  <SpeakButton text={c.text} label={false} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <NearbyPlaces districtId={p.district} point={sp?.district === p.district ? sp.point : null} />

        <section className="panel">
          <div className="panel-head">
            <h2>
              {L(TXT.steps)}: {tradeName}
            </h2>
          </div>
          <ol className="path-steps">
            {steps.map((s, i) => (
              <li key={i} className="path-step">
                <span className="path-num" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="path-body">
                  <div className="path-head">
                    <span className="path-icon">
                      <Icon name={s.icon} size={18} />
                    </span>
                    <strong>{s.title}</strong>
                    {s.meta && <span className="path-meta">{s.meta}</span>}
                  </div>
                  <p>{s.text}</p>
                  <div className="path-foot">
                    {s.pay && (
                      <span className="path-pay">
                        {s.pay} <small>{L(TXT.perMonth)}</small>
                      </span>
                    )}
                    {s.badge && <TrustBadge kind={s.badge} small />}
                    <SpeakButton text={s.text} label={false} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>
              <BookOpen size={20} aria-hidden="true" /> {L(TXT.words)}
            </h2>
          </div>
          <dl className="glossary">
            {GLOSSARY.map((g) => (
              <div key={g.term.en} className="gloss">
                <dt>
                  {L(g.term)}
                  <SpeakButton text={`${L(g.term)}. ${L(g.means)}`} label={false} />
                </dt>
                <dd>{L(g.means)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="head-actions">
          <Link to="/pact" className="btn btn-primary">
            <FileText size={16} aria-hidden="true" /> {L(TXT.pact)}
          </Link>
          <Link to={`/simulator?t=${trade.id}&d=${district.id}`} className="btn btn-outline">
            <Calculator size={16} aria-hidden="true" /> {L(TXT.simulate)}
          </Link>
          <Link to="/counsellor" className="btn btn-outline">
            <Headset size={16} aria-hidden="true" /> {L(TXT.person)}
          </Link>
        </div>
        <DemoNote />
      </div>
    </div>
  )
}

