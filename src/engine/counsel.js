// Agentic counselling core (prototype). Pipeline per turn:
//   tag (objection / intent / sentiment)  ->  evidence retrieval  ->  response composer
//   ->  "No Source, No Number" guardrail  ->  escalation router  ->  concern-map update.
// Swap `counsel()` for a call to the real orchestrator; the UI only depends on its output shape.
import { getDistrict, TOWNS } from '../data/districts.js'
import { getTrade, eligibleTrades, EDUCATION, MARKS, INCOME } from '../data/trades.js'
import { bestProvider, providersFor, vacancies, PROVIDERS, SOURCES } from '../data/outcomes.js'
import { matchStory } from '../data/stories.js'
import { simulate } from '../lib/simulate.js'
import { inr, inrRange, pick, fill, num } from '../lib/format.js'
import { tag, OBJECTIONS } from './taxonomy.js'
import { ROLES } from './roles.js'

const L = (en, hi, te) => ({ en, hi, te })
const YES = L('Yes', 'हाँ', 'అవును')
const NO = L('No', 'नहीं', 'లేదు')
const KM = { en: 'km', hi: 'किमी', te: 'కి.మీ' }
const LAKH = { en: 'lakh', hi: 'लाख', te: 'లక్షలు' }

const km = (n, lang) => `${n} ${KM[lang]}`
const lakh = (n, lang) => (Math.abs(n) >= 100000 ? `${n < 0 ? '−' : ''}₹${(Math.abs(n) / 100000).toFixed(1)} ${LAKH[lang]}` : inr(n))
const andJoin = (arr, lang) => {
  const and = { en: 'and', hi: 'और', te: 'మరియు' }[lang]
  return arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} ${and} ${arr.at(-1)}`
}

let seq = 0
const uid = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`

// ---------- Session setup ----------

export function recommendTrade(profile) {
  if (profile.trade && profile.trade !== 'unsure') return profile.trade
  const list = eligibleTrades(profile.edu)
  return [...list].sort((a, b) => bestProvider(profile.district, b.id).placement - bestProvider(profile.district, a.id).placement)[0].id
}

export function newFamily(profile) {
  const stance = {}
  for (const r of profile.members) {
    const s = r === 'learner' && profile.trade && profile.trade !== 'unsure' ? 0.25 : ROLES[r].start
    stance[r] = { start: s, now: s }
  }
  return { stance, concerns: [], unknownStreak: 0, escalation: null, turns: 0 }
}

export function convictionDelta(family) {
  const vals = Object.values(family.stance)
  if (!vals.length) return 0
  return vals.reduce((a, v) => a + (v.now - v.start), 0) / vals.length
}

// ---------- Evidence helpers ----------

function ctx(profile, lang) {
  const tradeId = recommendTrade(profile)
  const trade = getTrade(tradeId)
  const district = getDistrict(profile.district)
  const prov = bestProvider(district.id, trade.id)
  return { trade, district, prov, lang, girl: profile.gender === 'f', tradeName: pick(trade.name, lang), districtName: pick(district.name, lang), provName: pick(prov.name, lang) }
}

const ev = (label, value, badge, source, date) => ({ label, value, badge, source, date })

function evEarnings(c) {
  const { prov } = c
  return ev(L('Pay in first job', 'पहली नौकरी में वेतन', 'మొదటి ఉద్యోగంలో జీతం'), `${inrRange(prov.earnLow, prov.earnHigh)}`, prov.earnBadge, prov.source, prov.verifiedOn)
}
function evYear3(c) {
  return ev(L('Pay after 3 years', '3 साल बाद वेतन', '3 సంవత్సరాల తర్వాత జీతం'), inr(c.prov.year3), 'estimated', SOURCES.plfs, '2023-24')
}
function evPlacement(c) {
  return ev(L('Got a job within 6 months', '6 महीने में नौकरी मिली', '6 నెలల్లో ఉద్యోగం వచ్చింది'), `${c.prov.placement}%`, c.prov.placeBadge, `${SOURCES.tracer} · ${pick(c.prov.name, 'en')}`, c.prov.verifiedOn)
}
function evRetention(c) {
  return ev(L('Still working after 1 year', '1 साल बाद भी काम पर', '1 సంవత్సరం తర్వాత కూడా పనిలో'), `${c.prov.retention}%`, c.prov.placeBadge, `${SOURCES.tracer} (12 mo)`, c.prov.verifiedOn)
}
function evDistance(c, p = c.prov) {
  return ev(L('Distance from town', 'शहर से दूरी', 'పట్టణం నుండి దూరం'), km(p.km, c.lang), 'verified', 'GIS · centre location', 'Mar 2026')
}

// ---------- Guardrail ----------

// School classes ("Class 10", "10वीं", "10వ తరగతి") and ordinals are not statistics.
const NOT_A_STAT = /(?:class\s?\d{1,2}|\d{1,2}\s?(?:वीं|వ\s?తరగతి|th|nd|rd|st)\b)/i
const NUM_TOKEN = /(?:class\s?\d{1,2}|\d{1,2}\s?(?:वीं|వ\s?తరగతి|th|nd|rd|st)\b)|₹\s?[\d,]+(?:\.\d+)?|\d+(?:\.\d+)?\s?%|\d{2,}(?:,\d{2,3})*(?:\.\d+)?/gi
const toNum = (s) => parseFloat(s.replace(/[₹,%\s]/g, ''))

// Devanagari (०-९) and Telugu (౦-౯) digits are checked like ASCII digits.
export const asciiDigits = (s) =>
  String(s).replace(/[०-९౦-౯]/g, (d) => String(d.charCodeAt(0) - (d.charCodeAt(0) >= 0x0c66 ? 0x0c66 : 0x0966)))

const numbersIn = (s) => (asciiDigits(s).match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map(toNum)

// "No Source, No Number": every statistic in the reply must be traceable to an evidence
// record (or, on the Claude path, to this turn's tool results or the family's own words).
// Anything else is replaced with [—] before the family sees it.
export function guardrail(text, evidence, alsoAllowed = '') {
  const allowed = new Set([...evidence.flatMap((e) => numbersIn(e.value)), ...numbersIn(alsoAllowed)])
  let checked = 0
  let blocked = 0
  const safe = asciiDigits(text).replace(NUM_TOKEN, (tok) => {
    if (NOT_A_STAT.test(tok)) return tok
    checked++
    if (allowed.has(toNum(tok))) return tok
    blocked++
    return '[—]'
  })
  return { text: safe, checked, blocked }
}

// ---------- Composer ----------

const T = {
  income: {
    body: L(
      'In {district}, students of {trade} at {provider} earned {e1} a month in their first job. With about 3 years of experience, this usually grows to around {e3} a month.',
      '{district} में {provider} से {trade} की ट्रेनिंग लेने वालों ने पहली नौकरी में हर महीने {e1} कमाए। लगभग 3 साल के अनुभव के बाद यह आमतौर पर {e3} महीना तक पहुँच जाता है।',
      '{district}లో {provider} నుండి {trade} శిక్షణ పొందినవారు మొదటి ఉద్యోగంలో నెలకు {e1} సంపాదించారు. సుమారు 3 సంవత్సరాల అనుభవం తర్వాత ఇది సాధారణంగా నెలకు {e3} వరకు పెరుగుతుంది.',
    ),
    verified: L(
      ' We got these numbers by phoning past students, not from advertisements.',
      ' ये आंकड़े पुराने विद्यार्थियों को किए गए फ़ोन कॉल से हैं, विज्ञापनों से नहीं।',
      ' ఈ సంఖ్యలు పాత విద్యార్థులకు చేసిన ఫోన్ కాల్స్ నుండి వచ్చాయి, ప్రకటనల నుండి కాదు.',
    ),
    provider: L(
      ' This centre reported these figures; we have not yet confirmed them by calling past trainees.',
      ' ये आंकड़े संस्थान ने बताए हैं; हमने अभी पुराने विद्यार्थियों को फ़ोन करके इनकी पुष्टि नहीं की है।',
      ' ఈ సంఖ్యలను సంస్థ తెలిపింది; పాత విద్యార్థులకు ఫోన్ చేసి ఇంకా నిర్ధారించలేదు.',
    ),
  },
  job: L(
    '{pl} of {trade} students from {provider} got a job within 6 months, and {ret} were still working after 1 year. Right now {vac} jobs for this work are open in and around {district}.',
    '{provider} के {trade} विद्यार्थियों में से {pl} को कोर्स के 6 महीने के अंदर नौकरी मिली, और {ret} एक साल बाद भी काम कर रहे थे। अभी {district} और आसपास इस ट्रेड की {vac} नौकरियाँ खाली हैं।',
    '{provider}లో {trade} శిక్షణ పొందినవారిలో {pl} మందికి కోర్సు ముగిసిన 6 నెలల్లో ఉద్యోగం వచ్చింది, {ret} మంది ఒక సంవత్సరం తర్వాత కూడా పని చేస్తున్నారు. ప్రస్తుతం {district} చుట్టుపక్కల ఈ వృత్తికి {vac} ఖాళీలు ఉన్నాయి.',
  ),
  social: L(
    'Many families in {district} felt the same way at first. {story} trained in {storyTrade} and now earns {storyEarn} a month, and the family is proud today. Last year {alumni} young people from {district} chose this course at {provider}. You can also talk to a Parent Ambassador: a parent like you whose child is already working.',
    '{district} में कई परिवारों को शुरू में ऐसा ही लगा था। {story} ने {storyTrade} की ट्रेनिंग ली और आज हर महीने {storyEarn} कमाते हैं — पूरा परिवार गर्व करता है। पिछले साल {district} से {alumni} युवाओं ने {provider} में यही ट्रेड चुना। आप एक पेरेंट एंबेसडर से भी बात कर सकते हैं — आपके जैसे माता-पिता, जिनका बच्चा आज काम कर रहा है।',
    '{district}లో చాలా కుటుంబాలకు మొదట్లో ఇలాగే అనిపించింది. {story} {storyTrade} శిక్షణ తీసుకుని ఇప్పుడు నెలకు {storyEarn} సంపాదిస్తున్నారు — వారి కుటుంబం గర్వపడుతోంది. గత ఏడాది {district} నుండి {alumni} మంది యువత {provider}లో ఇదే వృత్తిని ఎంచుకున్నారు. మీలాంటి తల్లిదండ్రులతో, అంటే పిల్లలు ఇప్పటికే పని చేస్తున్న పేరెంట్ అంబాసిడర్‌తో కూడా మాట్లాడవచ్చు.',
  ),
  safety: {
    body: L(
      'Safety is checked for every centre, not assumed. Every {trade} course includes workplace safety, first aid and the correct use of safety gear.',
      'हर सेंटर की सुरक्षा जाँची जाती है, मान नहीं ली जाती। हर {trade} कोर्स में कार्यस्थल सुरक्षा, प्राथमिक चिकित्सा और सुरक्षा उपकरणों का सही इस्तेमाल सिखाया जाता है।',
      'ప్రతి సెంటర్ భద్రతను తనిఖీ చేస్తాం, ఊహించుకోము. ప్రతి {trade} కోర్సులో పని ప్రదేశ భద్రత, ప్రథమ చికిత్స, భద్రతా పరికరాల సరైన వాడకం నేర్పిస్తారు.',
    ),
    girl: L(
      ' At {provider}, {women} of the class are girls and women, and there are women teachers ({wi}). You can ask for a woman counsellor at any time.',
      ' {provider} में {women} प्रशिक्षु महिलाएँ हैं और {wi} महिला प्रशिक्षक हैं। आप कभी भी महिला काउंसलर से बात करने के लिए कह सकते हैं।',
      ' {provider}లో {women} శిక్షణార్థులు మహిళలు, {wi} మంది మహిళా శిక్షకులు ఉన్నారు. ఎప్పుడైనా మహిళా కౌన్సెలర్‌తో మాట్లాడమని అడగవచ్చు.',
    ),
    boy: L(
      ' Students practise with a teacher before they work on real sites.',
      ' असली काम पर जाने से पहले विद्यार्थी प्रशिक्षक की देखरेख में अभ्यास करते हैं।',
      ' నిజమైన పనికి వెళ్లే ముందు శిక్షకుడి పర్యవేక్షణలో సాధన చేస్తారు.',
    ),
  },
  distance: {
    body: L('{provider} is {km} from {town} town.', '{provider} {town} शहर से {km} दूर है।', '{provider} {town} పట్టణం నుండి {km} దూరంలో ఉంది.'),
    bus: L(' A student bus pass covers this route.', ' इस रूट पर स्टूडेंट बस पास मिलता है।', ' ఈ మార్గంలో విద్యార్థి బస్ పాస్ వర్తిస్తుంది.'),
    noBus: L(
      ' There is no student bus pass on this route yet; a skill officer can help arrange transport.',
      ' इस रूट पर अभी स्टूडेंट बस पास नहीं है; कौशल अधिकारी आने-जाने का इंतज़ाम करने में मदद कर सकते हैं।',
      ' ఈ మార్గంలో ఇంకా విద్యార్థి బస్ పాస్ లేదు; రవాణా ఏర్పాటుకు నైపుణ్య అధికారి సహాయం చేస్తారు.',
    ),
    hostel: L(' A hostel is available, so daily travel is not needed.', ' हॉस्टल उपलब्ध है, इसलिए रोज़ आना-जाना ज़रूरी नहीं।', ' హాస్టల్ ఉంది, కాబట్టి రోజూ ప్రయాణం అవసరం లేదు.'),
    alt: L(
      ' Another option is {alt}, {altKm} away.',
      ' दूसरा विकल्प {alt} है, जो {altKm} दूर है।',
      ' మరో ఎంపిక {alt}, {altKm} దూరంలో ఉంది.',
    ),
  },
  cost: {
    body: L('The course fee at {provider} is {fee}.', '{provider} में कोर्स फीस {fee} है।', '{provider}లో కోర్సు ఫీజు {fee}.'),
    free: L('free (government-funded)', 'मुफ़्त (सरकारी खर्च पर)', 'ఉచితం (ప్రభుత్వ నిధులతో)'),
    perYear: L('{amt} a year', '{amt} प्रति वर्ष', 'సంవత్సరానికి {amt}'),
    likely: L(
      ' With your household income, you are likely eligible for fee reimbursement and a free hostel seat under state welfare schemes. A counsellor can help with the forms.',
      ' आपकी पारिवारिक आय के हिसाब से आप राज्य कल्याण योजनाओं में फीस प्रतिपूर्ति और मुफ़्त हॉस्टल सीट के पात्र हो सकते हैं। काउंसलर फ़ॉर्म भरने में मदद करेंगे।',
      ' మీ కుటుంబ ఆదాయం ప్రకారం రాష్ట్ర సంక్షేమ పథకాల కింద ఫీజు రీయింబర్స్‌మెంట్, ఉచిత హాస్టల్ సీటుకు అర్హులు కావచ్చు. దరఖాస్తులకు కౌన్సెలర్ సహాయం చేస్తారు.',
    ),
    possible: L(
      ' You may be eligible for partial fee support; we will check this with you.',
      ' आप आंशिक फीस सहायता के पात्र हो सकते हैं; हम आपके साथ इसकी जाँच करेंगे।',
      ' మీకు పాక్షిక ఫీజు సహాయం లభించవచ్చు; మీతో కలిసి దీన్ని తనిఖీ చేస్తాం.',
    ),
    stipend: L(
      ' During the paid training year (apprenticeship), students get {stipend} a month, so the family gets support back quickly.',
      ' अप्रेंटिसशिप के साल में विद्यार्थियों को हर महीने {stipend} स्टाइपेंड मिलता है, इसलिए परिवार को जल्दी सहारा मिलता है।',
      ' అప్రెంటిస్‌షిప్ సంవత్సరంలో శిక్షణార్థులకు నెలకు {stipend} స్టైపెండ్ ఇస్తారు, కాబట్టి కుటుంబానికి త్వరగా ఆసరా అందుతుంది.',
    ),
  },
  marriage: L(
    'This is a common worry, and it deserves a careful answer. Students who finished {trade} at {provider} had steady work: {ret} were still employed after a year, earning {e1} a month at the start. In many families, a steady, skilled income is seen as a strength. If you would like to talk about this privately, a counsellor (a woman, if you prefer) can call you.',
    'यह एक आम चिंता है, और इसका सोच-समझकर जवाब देना ज़रूरी है। {provider} से {trade} पूरा करने वालों को स्थिर काम मिला: {ret} एक साल बाद भी नौकरी में थे, और शुरुआत में हर महीने {e1} कमा रहे थे। कई परिवारों में हुनर वाली स्थिर कमाई को ताक़त माना जाता है। अगर आप इस पर अकेले में बात करना चाहें, तो एक काउंसलर (चाहें तो महिला) आपको फ़ोन कर सकती हैं।',
    'ఇది సాధారణ సందేహం, దీనికి జాగ్రత్తగా సమాధానం ఇవ్వాలి. {provider}లో {trade} పూర్తి చేసినవారికి స్థిరమైన పని దొరికింది: {ret} మంది ఒక సంవత్సరం తర్వాత కూడా ఉద్యోగంలో ఉన్నారు, మొదట్లో నెలకు {e1} సంపాదించారు. చాలా కుటుంబాల్లో నైపుణ్యంతో వచ్చే స్థిరమైన ఆదాయాన్ని బలంగా చూస్తారు. దీని గురించి వ్యక్తిగతంగా మాట్లాడాలనుకుంటే, కౌన్సెలర్ (కావాలంటే మహిళా కౌన్సెలర్) మీకు ఫోన్ చేస్తారు.',
  ),
  degree: {
    body: L(
      'It doesn’t have to be either-or. Over the next 5 years, the {trade} path is expected to bring in about {tradeTotal} in {district}, compared with about {degreeTotal} for a general degree first.',
      'यह “या तो यह, या वह” का सवाल नहीं है। अगले 5 साल में {district} में {trade} का रास्ता कुल लगभग {tradeTotal} की कमाई देता है, जबकि पहले सामान्य डिग्री करने पर लगभग {degreeTotal}।',
      'ఇది “ఇదా అదా” అనే ప్రశ్న కాదు. వచ్చే 5 సంవత్సరాల్లో {district}లో {trade} మార్గంలో మొత్తం సుమారు {tradeTotal} సంపాదన రావచ్చు, ముందుగా సాధారణ డిగ్రీ చేస్తే సుమారు {degreeTotal}.',
    ),
    stillStudying: L(
      'It doesn’t have to be either-or. Over the next 5 years, the {trade} path is expected to bring in about {tradeTotal} in {district}. Inter plus a general degree takes 5 years after Class 10, so that path would still be at the fees stage: about {degreeCost} spent, with earnings only after that.',
      'यह “या तो यह, या वह” का सवाल नहीं है। अगले 5 साल में {district} में {trade} का रास्ता कुल लगभग {tradeTotal} की कमाई देता है। 10वीं के बाद इंटर और सामान्य डिग्री में 5 साल लगते हैं, इसलिए उस रास्ते पर अभी भी फीस का दौर होगा: लगभग {degreeCost} खर्च, कमाई उसके बाद।',
      'ఇది “ఇదా అదా” అనే ప్రశ్న కాదు. వచ్చే 5 సంవత్సరాల్లో {district}లో {trade} మార్గంలో మొత్తం సుమారు {tradeTotal} సంపాదన రావచ్చు. 10వ తరగతి తర్వాత ఇంటర్, సాధారణ డిగ్రీకి 5 సంవత్సరాలు పడుతుంది, కాబట్టి ఆ మార్గంలో ఇంకా ఫీజుల దశలోనే ఉంటారు: సుమారు {degreeCost} ఖర్చు, సంపాదన ఆ తర్వాతే.',
    ),
    climb: L(
      ' Skills and studies can go together: the Career Staircase below shows how your child can keep climbing, including further study.',
      ' हुनर और पढ़ाई साथ चल सकते हैं: नीचे दी गई करियर सीढ़ी दिखाती है कि आपका बच्चा आगे कैसे बढ़ सकता है, आगे की पढ़ाई समेत।',
      ' నైపుణ్యం, చదువు కలిసి సాగవచ్చు: కింద ఉన్న కెరీర్ మెట్లు మీ పిల్లలు పై చదువులతో సహా ఎలా ఎదగవచ్చో చూపిస్తాయి.',
    ),
    lateral: L(
      ' After ITI, they can join a diploma straight into the 2nd year.',
      ' ITI के बाद सीधे डिप्लोमा के दूसरे साल में दाख़िला (लैटरल एंट्री) मिल सकता है।',
      ' ITI తర్వాత నేరుగా డిప్లొమా రెండో సంవత్సరంలో చేరవచ్చు (లేటరల్ ఎంట్రీ).',
    ),
  },
  greet: L(
    'Namaste! I’m HunarSetu. Today I’m talking with {members}. Let’s look at {trade} together. Ask me anything about earnings, safety, respect, distance or cost. Tap who is speaking before you ask, so I can answer each of you.',
    'नमस्ते! मैं हुनरसेतु हूँ। आज मैं {members} से बात कर रहा हूँ। आइए साथ मिलकर {trade} को समझें। कमाई, सुरक्षा, इज़्ज़त, दूरी या खर्च के बारे में कुछ भी पूछिए। सवाल पूछने से पहले बताइए कि कौन बोल रहा है, ताकि मैं हर किसी को जवाब दे सकूँ।',
    'నమస్కారం! నేను హునర్‌సేతు. ఈరోజు నేను {members}తో మాట్లాడుతున్నాను. కలిసి {trade} గురించి తెలుసుకుందాం. సంపాదన, భద్రత, గౌరవం, దూరం లేదా ఖర్చు గురించి ఏదైనా అడగండి. ప్రశ్న అడిగే ముందు ఎవరు మాట్లాడుతున్నారో నొక్కండి, అప్పుడు ప్రతి ఒక్కరికీ సమాధానం ఇవ్వగలను.',
  ),
  recommended: L(
    ' Since you are not sure yet, I picked the trade with the best verified placement in {district} for your child’s schooling.',
    ' क्योंकि आपने अभी तय नहीं किया है, मैंने {district} में आपके बच्चे की पढ़ाई के हिसाब से सबसे अच्छे सत्यापित प्लेसमेंट वाला ट्रेड चुना है।',
    ' మీరు ఇంకా నిర్ణయించుకోలేదు కాబట్టి, మీ పిల్లల చదువుకు తగిన, {district}లో ఉత్తమ ధృవీకరించిన ప్లేస్‌మెంట్ ఉన్న వృత్తిని ఎంచుకున్నాను.',
  ),
  thanks: L(
    'Thank you. I’ve marked this worry as resolved. Would you like to see the Career Staircase, or create your Family Career Pact with next steps?',
    'धन्यवाद। मैंने यह चिंता सुलझी हुई मान ली है। क्या आप करियर सीढ़ी देखना चाहेंगे, या अगले कदमों के साथ अपना परिवार करियर संकल्प बनाना चाहेंगे?',
    'ధన్యవాదాలు. ఈ సందేహం తీరిందని గుర్తించాను. కెరీర్ మెట్లు చూడాలనుకుంటున్నారా, లేదా తదుపరి దశలతో మీ కుటుంబ కెరీర్ ఒప్పందం తయారు చేద్దామా?',
  ),
  thanksPlain: L(
    'Thank you! Ask me anything else, or tap a worry below.',
    'धन्यवाद! कुछ और पूछना हो तो पूछिए, या नीचे किसी चिंता पर टैप कीजिए।',
    'ధన్యవాదాలు! ఇంకేమైనా అడగండి, లేదా కింద ఉన్న సందేహాన్ని నొక్కండి.',
  ),
  hello: L(
    'Namaste! Ask me anything about this course: pay, a sure job, safety, respect, distance, fees or marriage. You can also tap a worry below.',
    'नमस्ते! इस कोर्स के बारे में कुछ भी पूछें: कमाई, पक्की नौकरी, सुरक्षा, इज़्ज़त, दूरी, फ़ीस या शादी। आप नीचे किसी चिंता पर टैप भी कर सकते हैं।',
    'నమస్తే! ఈ కోర్సు గురించి ఏదైనా అడగండి: జీతం, ఖాయమైన ఉద్యోగం, భద్రత, గౌరవం, దూరం, ఫీజు లేదా పెళ్లి. కింద ఏదైనా సందేహాన్ని కూడా నొక్కవచ్చు.',
  ),
  unknown: L(
    'I’m not sure I understood that. You can tap one of the worries below, or say it in your own words, for example “How much will she earn?”',
    'मैं ठीक से समझ नहीं पाया। नीचे दी गई किसी चिंता पर टैप करें, या अपने शब्दों में पूछें, जैसे “वह कितना कमाएगी?”',
    'నాకు సరిగ్గా అర్థం కాలేదు. కింద ఉన్న ఏదైనా సందేహాన్ని నొక్కండి, లేదా మీ మాటల్లో అడగండి, ఉదాహరణకు “ఎంత సంపాదిస్తారు?”',
  ),
  escalate: L(
    'I want to make sure you get the right answer. I can connect you to a live counsellor now, and I’ll share a short summary so you don’t have to repeat yourselves.',
    'मैं चाहता हूँ कि आपको सही जवाब मिले। मैं आपको अभी किसी काउंसलर से जोड़ सकता हूँ, और एक छोटा सारांश भेज दूँगा ताकि आपको बात दोहरानी न पड़े।',
    'మీకు సరైన సమాధానం అందాలి. ఇప్పుడే మిమ్మల్ని కౌన్సెలర్‌తో కలుపుతాను, మీరు మళ్లీ చెప్పనవసరం లేకుండా చిన్న సారాంశం పంపుతాను.',
  ),
  distress: L(
    'I’m sorry you are going through this. You don’t have to handle it alone. I’m asking a counsellor to call you now. If anyone feels unsafe or overwhelmed, please call Tele-MANAS on 14416. It is free and open day and night.',
    'मुझे दुख है कि आप इससे गुज़र रहे हैं। आपको यह अकेले नहीं संभालना है। मैं अभी एक काउंसलर से आपको फ़ोन करवाता हूँ। अगर कोई असुरक्षित या बहुत परेशान महसूस करे, तो Tele-MANAS को 14416 पर फ़ोन करें। यह मुफ़्त है और दिन-रात खुला है।',
    'మీరు ఈ కష్టంలో ఉన్నందుకు బాధగా ఉంది. మీరు ఒంటరిగా భరించనవసరం లేదు. ఇప్పుడే కౌన్సెలర్ మీకు ఫోన్ చేసేలా చూస్తాను. ఎవరికైనా అసురక్షితంగా లేదా చాలా ఒత్తిడిగా అనిపిస్తే, Tele-MANAS కి 14416 నంబర్‌కు ఫోన్ చేయండి. ఇది ఉచితం, రాత్రింబవళ్ళు అందుబాటులో ఉంటుంది.',
  ),
}

export const ESCALATION_REASONS = {
  distress: L('Someone may be upset', 'कोई परेशान लग रहा है', 'ఎవరో బాధలో ఉన్నట్టున్నారు'),
  lowConfidence: L('We did not understand well', 'हम ठीक से समझ नहीं पाए', 'మాకు సరిగ్గా అర్థం కాలేదు'),
  unresolved: L('The same worry came up again', 'वही चिंता फिर से आई', 'అదే సందేహం మళ్లీ వచ్చింది'),
  sensitive: L('A private topic', 'एक निजी विषय', 'ఒక వ్యక్తిగత విషయం'),
  requested: L('The family asked for a person', 'परिवार ने व्यक्ति से बात माँगी', 'కుటుంబం వ్యక్తిని కోరింది'),
}

function composeObjection(key, profile, c) {
  const { lang, prov, trade } = c
  const base = { district: c.districtName, trade: c.tradeName, provider: c.provName }
  const evidence = []
  let text = ''
  let story = null
  let staircase = false

  if (key === 'income') {
    evidence.push(evEarnings(c), evYear3(c), evPlacement(c))
    text = fill(pick(T.income.body, lang), { ...base, e1: inrRange(prov.earnLow, prov.earnHigh), e3: inr(prov.year3) })
    text += pick(prov.earnBadge === 'verified' ? T.income.verified : T.income.provider, lang)
  } else if (key === 'job') {
    const vac = vacancies(c.district.id, trade.id)
    evidence.push(evPlacement(c), evRetention(c), ev(L('Jobs open nearby', 'आसपास खाली नौकरियाँ', 'దగ్గర్లో ఖాళీ ఉద్యోగాలు'), num(vac), 'verified', SOURCES.ncs, 'Sep 2026'))
    text = fill(pick(T.job, lang), { ...base, pl: `${prov.placement}%`, ret: `${prov.retention}%`, vac: num(vac) })
  } else if (key === 'social') {
    story = matchStory({ tradeId: trade.id, gender: profile.gender, districtId: c.district.id })
    const storyTrade = pick(getTrade(story.tradeId).name, lang)
    evidence.push(
      ev(L(`${story.name} earns today`, `${story.name} की आज की कमाई`, `${story.name} ఈరోజు సంపాదన`), inr(story.earn), 'verified', `${SOURCES.tracer} (consented story)`, 'Aug 2026'),
      ev(L('Joined this course last year', 'पिछले साल यह कोर्स चुना', 'గత ఏడాది ఈ కోర్సులో చేరినవారు'), num(prov.alumni), 'provider', SOURCES.mis, prov.verifiedOn),
      evPlacement(c),
    )
    text = fill(pick(T.social, lang), { ...base, story: story.name, storyTrade, storyEarn: inr(story.earn), alumni: num(prov.alumni) })
  } else if (key === 'safety') {
    text = fill(pick(T.safety.body, lang), base)
    if (c.girl) {
      evidence.push(
        ev(L('Girls & women in class', 'कक्षा में लड़कियाँ/महिलाएँ', 'తరగతిలో అమ్మాయిలు/మహిళలు'), `${prov.women}%`, 'provider', SOURCES.mis, prov.verifiedOn),
        ev(L('Girls’ hostel', 'लड़कियों का हॉस्टल', 'బాలికల హాస్టల్'), pick(prov.girlsHostel ? YES : NO, lang), 'verified', SOURCES.inspection, prov.verifiedOn),
        ev(L('Women teachers', 'महिला शिक्षक', 'మహిళా ఉపాధ్యాయులు'), String(prov.womenInstructors), 'provider', SOURCES.mis, prov.verifiedOn),
      )
      text += fill(pick(T.safety.girl, lang), { ...base, women: `${prov.women}%`, wi: prov.womenInstructors })
      story = matchStory({ tradeId: trade.id, gender: 'f', districtId: c.district.id })
    } else {
      text += pick(T.safety.boy, lang)
    }
    evidence.push(ev(L('CCTV & grievance cell', 'CCTV और शिकायत सेल', 'CCTV & ఫిర్యాదుల విభాగం'), pick(prov.cctv && prov.grievanceCell ? YES : NO, lang), 'verified', SOURCES.inspection, prov.verifiedOn))
  } else if (key === 'distance') {
    const others = providersFor(c.district.id, trade.id).filter((p) => p.id !== prov.id)
    const alt = others.sort((a, b) => a.km - b.km)[0]
    const hostel = c.girl ? prov.girlsHostel : prov.boysHostel
    evidence.push(evDistance(c), ev(L('Student bus pass route', 'स्टूडेंट बस पास रूट', 'విద్యార్థి బస్ పాస్ మార్గం'), pick(prov.busPass ? YES : NO, lang), 'verified', 'State transport route list', 'Jul 2026'))
    evidence.push(ev(L('Hostel', 'हॉस्टल', 'హాస్టల్'), pick(hostel ? YES : NO, lang), 'verified', SOURCES.inspection, prov.verifiedOn))
    text = fill(pick(T.distance.body, lang), { ...base, km: km(prov.km, lang), town: pick(TOWNS[prov.town], lang) })
    text += pick(prov.busPass ? T.distance.bus : T.distance.noBus, lang)
    if (hostel) text += pick(T.distance.hostel, lang)
    if (alt) {
      evidence.push(evDistance(c, alt))
      evidence.at(-1).label = L(`Distance: ${pick(alt.name, 'en')}`, `दूरी: ${pick(alt.name, 'hi')}`, `దూరం: ${pick(alt.name, 'te')}`)
      text += fill(pick(T.distance.alt, lang), { alt: pick(alt.name, lang), altKm: km(alt.km, lang) })
    }
  } else if (key === 'cost') {
    const feeStr = prov.fee === 0 ? pick(T.cost.free, lang) : fill(pick(T.cost.perYear, lang), { amt: inr(prov.fee) })
    evidence.push(ev(L('Fee per year', 'फीस प्रति वर्ष', 'సంవత్సరానికి ఫీజు'), prov.fee === 0 ? pick(T.cost.free, lang) : inr(prov.fee), 'provider', SOURCES.mis, prov.verifiedOn))
    text = fill(pick(T.cost.body, lang), { ...base, fee: feeStr })
    const low = profile.income === 'lt10' || profile.income === '10to25'
    const mid = profile.income === '25to50'
    if (low || mid) {
      text += pick(low ? T.cost.likely : T.cost.possible, lang)
      evidence.push(ev(L('Help with fees', 'फीस में मदद', 'ఫీజులో సహాయం'), pick(low ? L('Likely', 'संभावित', 'అవకాశం ఎక్కువ') : L('Possible', 'हो सकता है', 'అవకాశం ఉంది'), lang), 'estimated', 'State welfare rules (sample)', '2026'))
    }
    if (trade.staircase.some((s) => s.stipend)) {
      evidence.push(ev(L('Paid while training', 'ट्रेनिंग के दौरान वेतन', 'శిక్షణలో జీతం'), `${inr(prov.stipend)}`, 'verified', 'Apprenticeship portal (NAPS) rate', '2026'))
      text += fill(pick(T.cost.stipend, lang), { stipend: inr(prov.stipend) })
    }
  } else if (key === 'marriage') {
    evidence.push(evRetention(c), evEarnings(c))
    text = fill(pick(T.marriage, lang), { ...base, ret: `${prov.retention}%`, e1: inrRange(prov.earnLow, prov.earnHigh) })
    story = matchStory({ tradeId: 'sewing', gender: 'f', districtId: c.district.id })
  } else if (key === 'degree') {
    const sim = simulate({ tradeId: trade.id, districtId: c.district.id, edu: profile.edu })
    const tradeTotal = lakh(sim.totals.trade, lang)
    evidence.push(ev(L(`5-year earnings: ${pick(trade.name, 'en')}`, `5 साल की कमाई: ${pick(trade.name, 'hi')}`, `5 ఏళ్ల సంపాదన: ${pick(trade.name, 'te')}`), tradeTotal, 'estimated', 'HunarSetu simulator · ' + SOURCES.plfs, '2026'))
    if (sim.totals.degree > 0) {
      const degreeTotal = lakh(sim.totals.degree, lang)
      evidence.push(ev(L('5-year earnings: degree first', '5 साल की कमाई: पहले डिग्री', '5 ఏళ్ల సంపాదన: ముందు డిగ్రీ'), degreeTotal, 'estimated', 'HunarSetu simulator · ' + SOURCES.plfs, '2026'))
      text = fill(pick(T.degree.body, lang), { ...base, tradeTotal, degreeTotal })
    } else {
      const degreeCost = lakh(-sim.totals.degree, lang)
      evidence.push(ev(L('5-year fees: Inter + degree', '5 साल की फीस: इंटर + डिग्री', '5 ఏళ్ల ఫీజులు: ఇంటర్ + డిగ్రీ'), degreeCost, 'estimated', 'Govt college fee schedule (sample)', '2026'))
      text = fill(pick(T.degree.stillStudying, lang), { ...base, tradeTotal, degreeCost })
    }
    text += pick(T.degree.climb, lang)
    if (trade.staircase.some((s) => /lateral/i.test(s.title))) {
      text += pick(T.degree.lateral, lang)
      evidence.push(ev(L('Can join diploma in 2nd year', 'डिप्लोमा के दूसरे साल में दाख़िला', 'డిప్లొమా 2వ సంవత్సరంలో చేరవచ్చు'), pick(L('Yes, 2nd year', 'हाँ, दूसरे साल में', 'అవును, 2వ సంవత్సరం'), lang), 'verified', SOURCES.nqr, '2026'))
    }
    staircase = true
  }
  return { text, evidence, story, staircase }
}

// ---------- Main entry ----------

export function greeting(profile, lang) {
  const c = ctx(profile, lang)
  const members = andJoin(profile.members.map((r) => pick(ROLES[r].label, lang)), lang)
  let text = fill(pick(T.greet, lang), { members, trade: c.tradeName })
  if (!profile.trade || profile.trade === 'unsure') text += fill(pick(T.recommended, lang), { district: c.districtName })
  const evidence = [evEarnings(c), evPlacement(c), evDistance(c)]
  return {
    id: uid(),
    from: 'bot',
    kind: 'greeting',
    text,
    evidence,
    tradeId: c.trade.id,
    providerId: c.prov.id,
    guard: guardrail(text, evidence),
    followups: ['income', 'safety', 'social', 'degree'],
  }
}

const clamp = (v) => Math.max(-1, Math.min(1, v))

// Update the family concern map from one turn's signals. Used by the offline rule
// engine and by the Claude path (src/lib/api.js), so both track stance the same way.
// Returns the new family state plus the escalation reasons the turn triggered.
export function applyTurn(family, { role, objections = [], acknowledged = false, sentiment = 0, distress = false, understood = true }) {
  const fam = structuredClone(family)
  fam.turns += 1
  const st = fam.stance[role] ?? (fam.stance[role] = { start: ROLES[role]?.start ?? 0, now: ROLES[role]?.start ?? 0 })
  st.now = clamp(st.now + sentiment * 0.05)
  const reasons = []
  let key = null
  let resolved = 0

  if (distress) {
    fam.unknownStreak = 0
    reasons.push('distress')
  } else if (objections.length) {
    fam.unknownStreak = 0
    key = objections[0]
    let concern = fam.concerns.find((x) => x.role === role && x.key === key)
    if (concern) {
      concern.count += 1
      if (concern.status === 'answered' && concern.count >= 2) reasons.push('unresolved')
      concern.status = 'answered'
    } else {
      fam.concerns.push({ role, key, status: 'answered', count: 1 })
    }
    // Raising a new worry means earlier answers landed somewhat.
    fam.concerns.filter((x) => x.role === role && x.key !== key && x.status === 'answered').forEach(() => (st.now = clamp(st.now + 0.03)))
    st.now = clamp(st.now + 0.04)
    for (const extra of objections.slice(1, 3)) {
      if (!fam.concerns.some((x) => x.role === role && x.key === extra)) fam.concerns.push({ role, key: extra, status: 'open', count: 1 })
    }
  } else if (acknowledged) {
    fam.unknownStreak = 0
    const open = fam.concerns.filter((x) => x.role === role && (x.status === 'answered' || x.status === 'open'))
    open.forEach((x) => (x.status = 'resolved'))
    resolved = open.length
    st.now = clamp(st.now + (open.length ? 0.18 + 0.05 * open.length : 0.05))
  } else if (!understood) {
    fam.unknownStreak += 1
    if (fam.unknownStreak >= 2) reasons.push('lowConfidence')
  } else {
    fam.unknownStreak = 0
  }
  return { family: fam, reasons, key, resolved }
}

// Record a hand-over on the family state. "Sensitive" only offers a counsellor; the
// other reasons hand the case over and mark the worry as being with a counsellor.
export function markEscalation(family, reasons, role, key) {
  const unique = [...new Set(reasons)]
  const hard = unique.some((r) => r !== 'sensitive')
  if (hard) {
    family.escalation = { reasons: unique, at: Date.now() }
    family.concerns.filter((x) => x.role === role && x.key === key).forEach((x) => (x.status = 'escalated'))
  }
  return { reasons: unique, hard }
}

export const helplineEvidence = () =>
  ev(L('Tele-MANAS helpline (free, 24×7)', 'Tele-MANAS हेल्पलाइन (मुफ़्त, 24×7)', 'Tele-MANAS హెల్ప్‌లైన్ (ఉచితం, 24×7)'), '14416', 'verified', 'Ministry of Health & Family Welfare', '2026')

export const freshFollowups = (family, already = []) => {
  const raised = new Set(family.concerns.map((x) => x.key))
  return [...already, ...Object.keys(OBJECTIONS).filter((k) => !raised.has(k) && !already.includes(k))].slice(0, 3)
}

// Offline rule engine: keyword tagging + templated answers from the outcome records.
export function counsel({ text, role, profile, family, lang }) {
  const tags = tag(text)
  const c = ctx(profile, lang)
  const turn = applyTurn(family, {
    role,
    objections: tags.objections,
    acknowledged: tags.positive,
    sentiment: tags.sentiment,
    distress: tags.distress,
    understood: tags.confidence > 0.5,
  })
  const fam = turn.family
  const reasons = [...turn.reasons]
  const reply = { id: uid(), from: 'bot', engine: 'offline', replyTo: { role }, evidence: [], followups: [], tradeId: c.trade.id }

  if (tags.distress) {
    reply.kind = 'distress'
    reply.text = pick(T.distress, lang)
    reply.evidence = [helplineEvidence()]
  } else if (turn.key) {
    reply.replyTo.key = turn.key
    const out = composeObjection(turn.key, profile, c)
    reply.kind = 'answer'
    reply.text = out.text
    reply.evidence = out.evidence
    reply.story = out.story?.id ?? null
    reply.staircase = out.staircase
    if (turn.key === 'marriage' || (turn.key === 'safety' && c.girl)) reasons.push('sensitive')
    // A second detected worry becomes a follow-up chip rather than a wall of text.
    reply.followups = tags.objections.slice(1, 2)
  } else if (tags.greeting) {
    reply.kind = 'hello'
    reply.text = pick(T.hello, lang)
  } else if (tags.positive) {
    reply.kind = 'thanks'
    reply.text = pick(turn.resolved ? T.thanks : T.thanksPlain, lang)
    reply.actions = turn.resolved ? ['staircase', 'pact'] : []
  } else {
    reply.kind = 'unknown'
    reply.text = pick(T.unknown, lang)
  }

  reply.followups = freshFollowups(fam, reply.followups)

  if (reasons.length) {
    const { reasons: r, hard } = markEscalation(fam, reasons, role, turn.key)
    if (hard && reply.kind !== 'distress') reply.text += ' ' + pick(T.escalate, lang)
    reply.escalate = { reasons: r, woman: r.includes('sensitive') || c.girl, urgent: r.includes('distress') }
  }

  reply.guard = guardrail(reply.text, reply.evidence)
  reply.text = reply.guard.text
  return { reply, family: fam }
}

// Short handover note for the live counsellor.
export function caseSummary(profile, family, lang = 'en') {
  if (!profile) return null
  const c = ctx(profile, lang)
  const lines = []
  lines.push({ k: 'Family', v: profile.members.map((r) => pick(ROLES[r].label, 'en')).join(', ') })
  const label = (list, id) => pick(list.find((x) => x.id === id)?.label, 'en')
  lines.push({ k: 'Learner', v: `${profile.gender === 'f' ? 'Girl' : 'Boy'}, ${label(EDUCATION, profile.edu)}, marks ${label(MARKS, profile.marks)}` })
  lines.push({ k: 'Place', v: `${pick(c.district.name, 'en')} · family income ${label(INCOME, profile.income)}` })
  lines.push({ k: 'Trade discussed', v: `${pick(c.trade.name, 'en')} at ${pick(c.prov.name, 'en')}` })
  const open = family?.concerns.filter((x) => x.status !== 'resolved') ?? []
  lines.push({
    k: 'Open worries',
    v: open.length ? open.map((x) => `${pick(ROLES[x.role].label, 'en')}: ${pick(OBJECTIONS[x.key].label, 'en')}${x.count > 1 ? ` (×${x.count})` : ''}`).join('; ') : 'None',
  })
  if (family) {
    lines.push({
      k: 'Stance',
      v: Object.entries(family.stance)
        .map(([r, s]) => `${pick(ROLES[r].label, 'en')} ${s.start.toFixed(2)} → ${s.now.toFixed(2)}`)
        .join(' · '),
    })
  }
  if (family?.escalation) lines.push({ k: 'Escalated because', v: family.escalation.reasons.map((r) => pick(ESCALATION_REASONS[r], 'en')).join(', ') })
  return lines
}

export const providerById = (id) => PROVIDERS.find((p) => p.id === id)
