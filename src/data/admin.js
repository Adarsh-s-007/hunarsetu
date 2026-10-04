// Scheme-administrator analytics for the pilot (Hanumakonda + Warangal mandals).
// Session signals are anonymised: stance, objections and outcomes only. Sample data.

export const ROLE_ORDER = ['father', 'mother', 'learner', 'grandparent', 'guardian']
export const OBJECTION_ORDER = ['social', 'income', 'safety', 'marriage', 'degree', 'job', 'distance', 'cost']

// Approximate mandal centroids.
// Mandal names in Hindi and Telugu script, for the family setup screen.
export const MANDAL_LOCAL = {
  hanumakonda: { hi: 'हनुमकोंडा', te: 'హనుమకొండ' },
  kazipet: { hi: 'काज़ीपेट', te: 'కాజీపేట' },
  hasanparthy: { hi: 'हसनपर्ती', te: 'హసన్‌పర్తి' },
  dharmasagar: { hi: 'धर्मसागर', te: 'ధర్మసాగర్' },
  elkathurthy: { hi: 'एल्कतुर्ती', te: 'ఎల్కతుర్తి' },
  bheemadevarpalle: { hi: 'भीमदेवरपल्ले', te: 'భీమదేవరపల్లె' },
  kamalapur: { hi: 'कमलापुर', te: 'కమలాపూర్' },
  parkal: { hi: 'परकाल', te: 'పరకాల' },
  atmakur: { hi: 'आत्मकूर', te: 'ఆత్మకూరు' },
  damera: { hi: 'दामेरा', te: 'దామెర' },
  shayampet: { hi: 'शायमपेट', te: 'శాయంపేట' },
  nadikuda: { hi: 'नडिकुडा', te: 'నడికూడ' },
  warangal: { hi: 'वरंगल', te: 'వరంగల్' },
  geesugonda: { hi: 'गीसुगोंडा', te: 'గీసుగొండ' },
  sangem: { hi: 'संगेम', te: 'సంగెం' },
  wardhannapet: { hi: 'वर्धन्नपेट', te: 'వర్ధన్నపేట' },
  raiparthy: { hi: 'रायपर्ती', te: 'రాయపర్తి' },
  narsampet: { hi: 'नरसमपेट', te: 'నర్సంపేట' },
  chennaraopet: { hi: 'चेन्नारावपेट', te: 'చెన్నారావుపేట' },
  nekkonda: { hi: 'नेक्कोंडा', te: 'నెక్కొండ' },
  khanapur: { hi: 'खानापुर', te: 'ఖానాపూర్' },
  duggondi: { hi: 'दुग्गोंडी', te: 'దుగ్గొండి' },
}

export const MANDALS = [
  { id: 'hanumakonda', district: 'hanumakonda', name: 'Hanumakonda', lat: 18.006, lng: 79.558, sessions: 312, resistance: 31, consent: 72, top: 'cost', girlsShare: 44 },
  { id: 'kazipet', district: 'hanumakonda', name: 'Kazipet', lat: 17.973, lng: 79.503, sessions: 188, resistance: 34, consent: 69, top: 'distance', girlsShare: 41 },
  { id: 'hasanparthy', district: 'hanumakonda', name: 'Hasanparthy', lat: 18.073, lng: 79.513, sessions: 121, resistance: 52, consent: 58, top: 'social', girlsShare: 36 },
  { id: 'dharmasagar', district: 'hanumakonda', name: 'Dharmasagar', lat: 17.993, lng: 79.436, sessions: 96, resistance: 58, consent: 54, top: 'safety', girlsShare: 29 },
  { id: 'elkathurthy', district: 'hanumakonda', name: 'Elkathurthy', lat: 18.098, lng: 79.375, sessions: 84, resistance: 74, consent: 41, top: 'marriage', girlsShare: 22 },
  { id: 'bheemadevarpalle', district: 'hanumakonda', name: 'Bheemadevarpalle', lat: 18.17, lng: 79.33, sessions: 77, resistance: 71, consent: 43, top: 'social', girlsShare: 24 },
  { id: 'kamalapur', district: 'hanumakonda', name: 'Kamalapur', lat: 18.165, lng: 79.535, sessions: 102, resistance: 55, consent: 57, top: 'income', girlsShare: 33 },
  { id: 'parkal', district: 'hanumakonda', name: 'Parkal', lat: 18.2, lng: 79.7, sessions: 143, resistance: 47, consent: 61, top: 'degree', girlsShare: 35 },
  { id: 'atmakur', district: 'hanumakonda', name: 'Atmakur', lat: 18.03, lng: 79.72, sessions: 89, resistance: 62, consent: 51, top: 'safety', girlsShare: 27 },
  { id: 'damera', district: 'hanumakonda', name: 'Damera', lat: 18.13, lng: 79.79, sessions: 68, resistance: 66, consent: 47, top: 'distance', girlsShare: 26 },
  { id: 'shayampet', district: 'hanumakonda', name: 'Shayampet', lat: 18.1, lng: 79.88, sessions: 59, resistance: 69, consent: 45, top: 'social', girlsShare: 25 },
  { id: 'nadikuda', district: 'hanumakonda', name: 'Nadikuda', lat: 18.27, lng: 79.78, sessions: 54, resistance: 78, consent: 38, top: 'marriage', girlsShare: 19 },
  { id: 'warangal', district: 'warangal', name: 'Warangal', lat: 17.968, lng: 79.594, sessions: 274, resistance: 29, consent: 74, top: 'income', girlsShare: 46 },
  { id: 'geesugonda', district: 'warangal', name: 'Geesugonda', lat: 17.93, lng: 79.68, sessions: 92, resistance: 49, consent: 60, top: 'job', girlsShare: 34 },
  { id: 'sangem', district: 'warangal', name: 'Sangem', lat: 17.87, lng: 79.75, sessions: 71, resistance: 63, consent: 50, top: 'degree', girlsShare: 30 },
  { id: 'wardhannapet', district: 'warangal', name: 'Wardhannapet', lat: 17.77, lng: 79.57, sessions: 118, resistance: 45, consent: 62, top: 'income', girlsShare: 37 },
  { id: 'raiparthy', district: 'warangal', name: 'Raiparthy', lat: 17.7, lng: 79.62, sessions: 64, resistance: 67, consent: 46, top: 'safety', girlsShare: 23 },
  { id: 'narsampet', district: 'warangal', name: 'Narsampet', lat: 17.928, lng: 79.894, sessions: 156, resistance: 43, consent: 63, top: 'job', girlsShare: 38 },
  { id: 'chennaraopet', district: 'warangal', name: 'Chennaraopet', lat: 17.96, lng: 79.98, sessions: 61, resistance: 76, consent: 39, top: 'social', girlsShare: 21 },
  { id: 'nekkonda', district: 'warangal', name: 'Nekkonda', lat: 17.76, lng: 79.79, sessions: 83, resistance: 60, consent: 52, top: 'cost', girlsShare: 28 },
  { id: 'khanapur', district: 'warangal', name: 'Khanapur', lat: 17.9, lng: 80.05, sessions: 49, resistance: 72, consent: 42, top: 'distance', girlsShare: 20 },
  { id: 'duggondi', district: 'warangal', name: 'Duggondi', lat: 17.99, lng: 79.83, sessions: 66, resistance: 57, consent: 55, top: 'marriage', girlsShare: 27 },
]

// Per-mandal objection mix (share of sessions raising each), derived from the top objection.
export function mandalMix(m) {
  const base = { social: 22, income: 20, safety: 14, marriage: 9, degree: 11, job: 9, distance: 8, cost: 7 }
  const mix = { ...base }
  mix[m.top] += 18
  if (m.girlsShare < 26) {
    mix.safety += 6
    mix.marriage += 5
  }
  const total = Object.values(mix).reduce((a, b) => a + b, 0)
  return OBJECTION_ORDER.map((k) => ({ key: k, share: Math.round((mix[k] / total) * 100) }))
}

// Objections raised, by who raised them (last 90 days).
export const OBJECTIONS_BY_ROLE = {
  social: { father: 412, mother: 238, learner: 61, grandparent: 197, guardian: 34 },
  income: { father: 455, mother: 214, learner: 132, grandparent: 58, guardian: 41 },
  safety: { father: 168, mother: 371, learner: 44, grandparent: 93, guardian: 22 },
  marriage: { father: 121, mother: 246, learner: 18, grandparent: 152, guardian: 19 },
  degree: { father: 233, mother: 119, learner: 97, grandparent: 71, guardian: 26 },
  job: { father: 201, mother: 132, learner: 88, grandparent: 39, guardian: 21 },
  distance: { father: 96, mother: 178, learner: 52, grandparent: 31, guardian: 12 },
  cost: { father: 142, mother: 97, learner: 35, grandparent: 18, guardian: 15 },
}

// Mean stance (−1 opposed … +1 supportive) at the start and end of a session.
export const STANCE_SHIFT = [
  { role: 'father', start: -0.48, end: 0.06 },
  { role: 'mother', start: -0.34, end: 0.21 },
  { role: 'learner', start: 0.12, end: 0.46 },
  { role: 'grandparent', start: -0.55, end: -0.18 },
  { role: 'guardian', start: -0.22, end: 0.17 },
]

// Weekly average Conviction Delta (end stance − start stance, family mean).
export const CONVICTION_TREND = [
  { week: 'W1', value: 0.18 },
  { week: 'W2', value: 0.21 },
  { week: 'W3', value: 0.2 },
  { week: 'W4', value: 0.26 },
  { week: 'W5', value: 0.29 },
  { week: 'W6', value: 0.27 },
  { week: 'W7', value: 0.33 },
  { week: 'W8', value: 0.35 },
  { week: 'W9', value: 0.34 },
  { week: 'W10', value: 0.38 },
  { week: 'W11', value: 0.4 },
  { week: 'W12', value: 0.41 },
]

// Share of objections marked resolved, by the kind of answer given.
export const PLAYBOOK = {
  columns: ['Checked numbers', 'Past student’s story', 'Talk with a parent', 'Call with a counsellor'],
  rows: {
    income: [71, 58, 63, 77],
    job: [66, 52, 57, 74],
    social: [31, 64, 72, 69],
    safety: [44, 61, 68, 81],
    marriage: [22, 49, 66, 78],
    degree: [62, 55, 59, 70],
    distance: [57, 38, 41, 72],
    cost: [74, 36, 42, 79],
  },
}

export const FUNNEL = [
  { stage: 'Talked with us', value: 2418 },
  { stage: 'Family said yes', value: 1475 },
  { stage: 'Joined a course', value: 1062 },
  { stage: 'Still going after 3 months', value: 948 },
]

export const KPIS = {
  sessions: 2418,
  sessionsDelta: 0.18,
  consent: 61,
  consentBaseline: 47,
  conviction: 0.41,
  convictionPrev: 0.35,
  escalations: 174,
  escalationRate: 7.2,
  dropoutAlerts: 38,
  medianMinutes: 11,
}

export const ESCALATIONS = [
  { id: 'HS-2051', ago: '4 min', mandal: 'Nadikuda', lang: 'Telugu', reason: 'Same worry came back · Marriage', who: 'Grandparent', status: 'Waiting', woman: true },
  { id: 'HS-2050', ago: '11 min', mandal: 'Elkathurthy', lang: 'Telugu', reason: 'Private topic · Safety', who: 'Mother', status: 'Called', woman: true },
  { id: 'HS-2049', ago: '26 min', mandal: 'Kazipet', lang: 'Hindi', reason: 'AI did not understand', who: 'Father', status: 'Called', woman: false },
  { id: 'HS-2048', ago: '41 min', mandal: 'Chennaraopet', lang: 'Telugu', reason: 'Someone may be upset', who: 'Learner', status: 'Resolved', woman: false },
  { id: 'HS-2047', ago: '1 h', mandal: 'Parkal', lang: 'English', reason: 'Same worry came back · Degree', who: 'Father', status: 'Resolved', woman: false },
  { id: 'HS-2046', ago: '2 h', mandal: 'Raiparthy', lang: 'Telugu', reason: 'Private topic · Safety', who: 'Mother', status: 'Resolved', woman: true },
]

export const SUGGESTED_ACTION = {
  social: 'Hold a meeting where parents of working past students speak',
  income: 'Bring local employers to show real, checked pay',
  safety: 'Hostel visit day for girls and parents, with women counsellors',
  marriage: 'Home visits by women counsellors',
  degree: 'Explain how a course can lead on to a diploma or degree',
  job: 'Job fair with real openings (NCS)',
  distance: 'Arrange transport, or send the mobile kiosk',
  cost: 'Help families sign up for scholarships and stipends',
}
