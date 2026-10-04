// Pilot geography (Telangana). `wage` scales local earnings relative to Hanumakonda.
export const DISTRICTS = [
  {
    id: 'hanumakonda',
    center: [18.006, 79.558],
    bbox: [17.85, 79.25, 18.35, 79.95], // south, west, north, east
    name: { en: 'Hanumakonda', hi: 'हनुमकोंडा', te: 'హనుమకొండ' },
    wage: 1.0,
    towns: ['hanumakonda', 'kazipet', 'parkal'],
  },
  {
    id: 'warangal',
    center: [17.968, 79.594],
    bbox: [17.6, 79.45, 18.1, 80.15], // south, west, north, east
    name: { en: 'Warangal', hi: 'वरंगल', te: 'వరంగల్' },
    wage: 0.98,
    towns: ['warangal', 'narsampet', 'wardhannapet'],
  },
  {
    id: 'karimnagar',
    center: [18.439, 79.129],
    bbox: [18.15, 78.8, 18.75, 79.55], // south, west, north, east
    name: { en: 'Karimnagar', hi: 'करीमनगर', te: 'కరీంనగర్' },
    wage: 1.03,
    towns: ['karimnagar', 'huzurabad', 'jammikunta'],
  },
  {
    id: 'khammam',
    center: [17.247, 80.151],
    bbox: [16.95, 79.85, 17.65, 80.85], // south, west, north, east
    name: { en: 'Khammam', hi: 'खम्मम', te: 'ఖమ్మం' },
    wage: 0.97,
    towns: ['khammam', 'sathupalli', 'madhira'],
  },
  {
    id: 'hyderabad',
    center: [17.385, 78.487],
    bbox: [17.25, 78.3, 17.55, 78.65], // south, west, north, east
    name: { en: 'Hyderabad', hi: 'हैदराबाद', te: 'హైదరాబాద్' },
    wage: 1.22,
    towns: ['secunderabad', 'saidabad', 'uppal'],
  },
]

export const TOWNS = {
  hanumakonda: { en: 'Hanumakonda', hi: 'हनुमकोंडा', te: 'హనుమకొండ' },
  kazipet: { en: 'Kazipet', hi: 'काज़ीपेट', te: 'కాజీపేట' },
  parkal: { en: 'Parkal', hi: 'परकाल', te: 'పరకాల' },
  warangal: { en: 'Warangal', hi: 'वरंगल', te: 'వరంగల్' },
  narsampet: { en: 'Narsampet', hi: 'नरसमपेट', te: 'నర్సంపేట' },
  wardhannapet: { en: 'Wardhannapet', hi: 'वर्धन्नपेट', te: 'వర్ధన్నపేట' },
  karimnagar: { en: 'Karimnagar', hi: 'करीमनगर', te: 'కరీంనగర్' },
  huzurabad: { en: 'Huzurabad', hi: 'हुज़ूराबाद', te: 'హుజూరాబాద్' },
  jammikunta: { en: 'Jammikunta', hi: 'जम्मीकुंटा', te: 'జమ్మికుంట' },
  khammam: { en: 'Khammam', hi: 'खम्मम', te: 'ఖమ్మం' },
  sathupalli: { en: 'Sathupalli', hi: 'सत्तुपल्ली', te: 'సత్తుపల్లి' },
  madhira: { en: 'Madhira', hi: 'मधिरा', te: 'మధిర' },
  secunderabad: { en: 'Secunderabad', hi: 'सिकंदराबाद', te: 'సికింద్రాబాద్' },
  saidabad: { en: 'Saidabad', hi: 'सैदाबाद', te: 'సైదాబాద్' },
  uppal: { en: 'Uppal', hi: 'उप्पल', te: 'ఉప్పల్' },
}

export const getDistrict = (id) => DISTRICTS.find((d) => d.id === id) ?? DISTRICTS[0]
