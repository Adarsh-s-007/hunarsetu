// Objection taxonomy shared by the counsellor, the concern map and the admin dashboard.
// Latin keywords match whole words ("earn*" = prefix); Indic keywords match as substrings,
// which handles Telugu/Hindi suffixes (సంపాది -> సంపాదిస్తాడు).
// "~word" counts half: it says who the worry is about (a daughter), not what the worry is.

export const OBJECTIONS = {
  income: {
    icon: 'IndianRupee',
    label: { en: 'Pay', hi: 'कमाई', te: 'జీతం' },
    ask: {
      en: 'How much will they earn after this course?',
      hi: 'इस कोर्स के बाद कितना कमाएगा?',
      te: 'ఈ కోర్సు తర్వాత ఎంత సంపాదిస్తారు?',
    },
    keys: ['earn*', 'salary', 'income', 'money', 'pay', 'wage*', 'kamai', 'kamay*', 'kamae*', 'paisa', 'paise', 'tankh*', 'kitna', 'jeetham', 'sampadana',
      'कमा', 'तनख्वाह', 'तनख़्वाह', 'वेतन', 'पैसा', 'कितना', 'సంపాద', 'జీతం', 'ఆదాయం', 'ఎంత'],
  },
  job: {
    icon: 'BriefcaseBusiness',
    label: { en: 'Sure job?', hi: 'पक्की नौकरी?', te: 'ఉద్యోగం ఖాయమా?' },
    ask: {
      en: 'Is there a sure job after training?',
      hi: 'ट्रेनिंग के बाद पक्की नौकरी मिलेगी?',
      te: 'శిక్షణ తర్వాత ఖచ్చితంగా ఉద్యోగం వస్తుందా?',
    },
    keys: ['job*', 'naukri', 'placement*', 'permanent', 'pakki', 'secure', 'security', 'employ*', 'vacanc*', 'udyogam',
      'नौकरी', 'पक्की', 'रोज़गार', 'रोजगार', 'ఉద్యోగ', 'పని దొరు', 'ఖచ్చితంగా'],
  },
  social: {
    icon: 'Users',
    label: { en: 'Respect', hi: 'इज़्ज़त', te: 'గౌరవం' },
    ask: {
      en: 'What will people say? Isn’t this a low job?',
      hi: 'लोग क्या कहेंगे? यह छोटा काम नहीं है?',
      te: 'జనం ఏమంటారు? ఇది చిన్న పని కాదా?',
    },
    keys: ['people say', 'log kya', 'society', 'respect', 'izzat', 'status', 'shame', 'low job', 'chhota', 'relatives', 'neighbo*', 'samajam', 'gouravam',
      'लोग क्या', 'समाज', 'इज़्ज़त', 'इज्जत', 'छोटा काम', 'रिश्तेदार', 'జనం', 'గౌరవ', 'చిన్న పని', 'పరువు', 'బంధువు', 'ఏమంటారు'],
  },
  safety: {
    icon: 'ShieldCheck',
    label: { en: 'Safety', hi: 'सुरक्षा', te: 'భద్రత' },
    ask: {
      en: 'Is it safe, especially for a girl?',
      hi: 'क्या यह सुरक्षित है, खासकर लड़की के लिए?',
      te: 'ఇది సురక్షితమేనా, ముఖ్యంగా అమ్మాయికి?',
    },
    keys: ['safe*', 'danger*', 'harass*', 'risk*', 'accident*', 'hostel', '~beti', '~ladki', '~daughter', '~girl', '~ammayi', 'suraksha', 'surakshit', 'bhadrata',
      'सुरक्षित', 'सुरक्षा', 'खतरा', 'ख़तरा', '~बेटी', '~लड़की', 'हॉस्टल', 'సురక్షిత', 'భద్రత', 'ప్రమాద', '~అమ్మాయి', 'హాస్టల్'],
  },
  distance: {
    icon: 'MapPin',
    label: { en: 'Distance', hi: 'दूरी', te: 'దూరం' },
    ask: {
      en: 'The centre is too far from home.',
      hi: 'सेंटर घर से बहुत दूर है।',
      te: 'సెంటర్ ఇంటి నుండి చాలా దూరం.',
    },
    keys: ['far', 'distance', 'travel*', 'bus', 'door', 'commute', 'dooram', 'दूर', 'दूरी', 'बस', 'దూరం', 'బస్సు', 'ప్రయాణ'],
  },
  cost: {
    icon: 'Wallet',
    label: { en: 'Fees', hi: 'फीस', te: 'ఫీజు' },
    ask: {
      en: 'Who will pay the fees? We cannot afford it.',
      hi: 'फीस कौन देगा? हमारे पास पैसे नहीं हैं।',
      te: 'ఫీజు ఎవరు కడతారు? మాకు అంత డబ్బు లేదు.',
    },
    keys: ['fee', 'fees', 'cost', 'costs', 'afford*', 'expensive', 'kharcha', 'loan', 'scholarship', 'stipend', 'kharch',
      'खर्च', 'फीस', 'लोन', 'छात्रवृत्ति', 'పైసలు లేవు', 'ఫీజు', 'ఖర్చు', 'డబ్బు లేదు', 'స్కాలర్'],
  },
  marriage: {
    icon: 'HeartHandshake',
    label: { en: 'Marriage', hi: 'शादी', te: 'పెళ్లి' },
    ask: {
      en: 'Will this affect marriage prospects?',
      hi: 'क्या इससे शादी में दिक्कत होगी?',
      te: 'దీని వల్ల పెళ్లికి ఇబ్బంది అవుతుందా?',
    },
    keys: ['marriage', 'marry', 'married', 'shaadi', 'shadi', 'rishta', 'wedding', 'pelli', 'शादी', 'रिश्ता', 'ब्याह', 'పెళ్లి', 'పెళ్ళి', 'సంబంధం'],
  },
  degree: {
    icon: 'GraduationCap',
    label: { en: 'Degree or skill?', hi: 'डिग्री या हुनर?', te: 'డిగ్రీయా నైపుణ్యమా?' },
    ask: {
      en: 'Isn’t a college degree better?',
      hi: 'क्या कॉलेज की डिग्री बेहतर नहीं है?',
      te: 'కాలేజీ డిగ్రీ మంచిది కాదా?',
    },
    keys: ['degree', 'college', 'graduat*', 'b.com', 'bcom', 'b.a', 'engineering', 'study more', 'padhai', 'डिग्री', 'कॉलेज', 'पढ़ाई', 'ग्रेजुएशन', 'డిగ్రీ', 'కాలేజీ', 'చదువు'],
  },
}

export const OBJECTION_KEYS = Object.keys(OBJECTIONS)

export const POSITIVE_KEYS = ['ok', 'okay', 'fine', 'good', 'great', 'convinced', 'agree*', 'yes', 'sure', 'thank*', 'understood', 'makes sense',
  'theek', 'thik', 'accha', 'achha', 'haan', 'sahi', 'sare', 'manchidi', 'avunu', 'ardhamaindi',
  'ठीक', 'अच्छा', 'हाँ', 'हां', 'सही', 'समझ गए', 'समझ गया', 'धन्यवाद', 'सरे', 'సరే', 'మంచిది', 'అవును', 'అర్థమైంది', 'ధన్యవాద']

export const DISTRESS_KEYS = ['suicide', 'kill myself', 'end my life', 'want to die', 'hopeless', 'depressed', 'beat me', 'beats me', 'forced', 'force me', 'run away',
  'आत्महत्या', 'मर जा', 'मरना चाह', 'मारते हैं', 'ज़बरदस्ती', 'जबरदस्ती', 'ఆత్మహత్య', 'చచ్చిపో', 'చనిపో', 'కొడతారు', 'బలవంతం']

export const NEGATIVE_KEYS = ['no', 'not', 'never', 'won’t', "won't", 'nahi', 'nahin', 'worried', 'scared', 'afraid', 'नहीं', 'डर', 'चिंता', 'వద్దు', 'లేదు', 'భయం', 'కాదు']

function toMatcher(k) {
  if (/^[\x00-\x7F’]+$/.test(k)) {
    const esc = k.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    const body = esc.endsWith('*') ? esc.slice(0, -1) + '\\w*' : esc
    const re = new RegExp(`(^|[^\\w])${body}(?=$|[^\\w])`, 'i')
    return (text) => re.test(text)
  }
  return (text) => text.includes(k)
}

const compile = (keys) => keys.map((k) => ({ test: toMatcher(k.replace(/^~/, '')), w: k.startsWith('~') ? 0.5 : 1 }))
const MATCHERS = Object.fromEntries(OBJECTION_KEYS.map((k) => [k, compile(OBJECTIONS[k].keys)]))
const POS = compile(POSITIVE_KEYS)
const NEG = compile(NEGATIVE_KEYS)
const DISTRESS = compile(DISTRESS_KEYS)
const count = (ms, text) => ms.reduce((n, m) => n + (m.test(text) ? m.w : 0), 0)
const GREET = compile(['hi', 'hii', 'hello', 'hey', 'namaste', 'namaskar', 'namaskaram', 'good morning', 'good evening', 'नमस्ते', 'नमस्कार', 'प्रणाम', 'హలో', 'నమస్తే', 'నమస్కారం'])

// Objection, intent & sentiment tagger (stand-in for the MuRIL classifier).
export function tag(raw) {
  const text = ` ${raw.toLowerCase()} `
  const scores = OBJECTION_KEYS.map((k) => ({ key: k, score: count(MATCHERS[k], text) })).filter((s) => s.score > 0)
  // "money" with "no / can't afford" is a cost worry, not an earnings question.
  const hasCostCue = /(afford|\bfees?\b|पैसे नहीं|फीस|డబ్బు లేదు|ఫీజు)/i.test(raw)
  if (hasCostCue) scores.forEach((s) => s.key === 'income' && (s.score -= 1))
  scores.sort((a, b) => b.score - a.score)
  const objections = scores.filter((s) => s.score > 0).map((s) => s.key)
  const positive = count(POS, text)
  const negative = count(NEG, text)
  const distress = count(DISTRESS, text) > 0
  const greeting = !objections.length && count(GREET, text) > 0
  return {
    objections,
    greeting,
    positive: positive > 0 && objections.length === 0,
    sentiment: Math.max(-1, Math.min(1, (positive - negative) * 0.35)),
    distress,
    confidence: objections.length || positive || distress || greeting ? 0.85 : 0.2,
  }
}
