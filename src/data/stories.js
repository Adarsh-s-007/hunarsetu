// Alumni & Parent Ambassador stories. In production these are consented voice notes,
// matched to a family by district, gender and trade. These are sample stories.
export const STORIES = [
  {
    id: 's1',
    name: 'Lakshmi P.',
    gender: 'f',
    age: 21,
    districtId: 'hanumakonda',
    trades: ['electrician', 'solar'],
    tradeId: 'electrician',
    earn: 16500,
    nowRole: 'Solar installation technician',
    parent: 'Venkatamma (mother)',
    quote: {
      en: 'I was scared she would climb poles. Now she trains the new boys, and the whole street calls her for wiring.',
      hi: 'मुझे डर था कि वह खंभों पर चढ़ेगी। अब वह नए लड़कों को सिखाती है, और पूरी गली उसे वायरिंग के लिए बुलाती है।',
      te: 'తను స్తంభాలు ఎక్కుతుందని భయపడ్డాను. ఇప్పుడు కొత్త అబ్బాయిలకు తనే నేర్పిస్తోంది, వీధి మొత్తం వైరింగ్‌కి తననే పిలుస్తారు.',
    },
  },
  {
    id: 's2',
    name: 'Ravi K.',
    gender: 'm',
    age: 22,
    districtId: 'karimnagar',
    trades: ['welder', 'fitter'],
    tradeId: 'welder',
    earn: 17000,
    nowRole: 'Fabrication welder',
    parent: 'Ramesh (father)',
    quote: {
      en: 'Relatives said a degree is better. Today Ravi earns more than his cousin with a B.Com, and he is building our new room.',
      hi: 'रिश्तेदार कहते थे डिग्री बेहतर है। आज रवि अपने B.Com वाले भाई से ज़्यादा कमाता है, और हमारा नया कमरा बनवा रहा है।',
      te: 'డిగ్రీ మేలని బంధువులు అన్నారు. ఈరోజు రవి B.Com చదివిన వాళ్ల అన్న కంటే ఎక్కువ సంపాదిస్తున్నాడు, మా కొత్త గది కట్టిస్తున్నాడు.',
    },
  },
  {
    id: 's3',
    name: 'Salma B.',
    gender: 'f',
    age: 20,
    districtId: 'khammam',
    trades: ['sewing'],
    tradeId: 'sewing',
    earn: 13500,
    nowRole: 'Runs a boutique from home',
    parent: 'Ayesha (mother)',
    quote: {
      en: 'People asked who would marry a working girl. Now families come to her for wedding blouses, and she has two helpers.',
      hi: 'लोग पूछते थे कि काम करने वाली लड़की से शादी कौन करेगा। अब शादी के ब्लाउज़ के लिए परिवार उसी के पास आते हैं, और उसके पास दो सहायक हैं।',
      te: 'పని చేసే అమ్మాయిని ఎవరు పెళ్లి చేసుకుంటారని జనం అడిగారు. ఇప్పుడు పెళ్లి బ్లౌజుల కోసం కుటుంబాలు తన దగ్గరికే వస్తున్నాయి, తనకు ఇద్దరు సహాయకులు ఉన్నారు.',
    },
  },
  {
    id: 's4',
    name: 'Suresh M.',
    gender: 'm',
    age: 23,
    districtId: 'warangal',
    trades: ['mmv', 'actech'],
    tradeId: 'mmv',
    earn: 15500,
    nowRole: 'Service advisor, two-wheeler dealership',
    parent: 'Kanakaiah (father)',
    quote: {
      en: 'I wanted him in an office. He wears a uniform with his name on it now, and customers ask for him by name.',
      hi: 'मैं चाहता था कि वह दफ़्तर में काम करे। अब वह अपने नाम वाली वर्दी पहनता है, और ग्राहक उसका नाम लेकर पूछते हैं।',
      te: 'వాడు ఆఫీసులో పని చేయాలనుకున్నాను. ఇప్పుడు పేరు ఉన్న యూనిఫాం వేసుకుంటాడు, కస్టమర్లు పేరు పెట్టి అడుగుతారు.',
    },
  },
  {
    id: 's5',
    name: 'Anjali R.',
    gender: 'f',
    age: 22,
    districtId: 'hyderabad',
    trades: ['gda', 'copa'],
    tradeId: 'gda',
    earn: 14500,
    nowRole: 'ICU assistant, private hospital',
    parent: 'Saroja (mother)',
    quote: {
      en: 'The hostel had a woman warden and a guard at night. I visited before saying yes. Now she sends money home every month.',
      hi: 'हॉस्टल में महिला वार्डन और रात में गार्ड था। हाँ कहने से पहले मैं खुद देखने गई। अब वह हर महीने घर पैसे भेजती है।',
      te: 'హాస్టల్‌లో మహిళా వార్డెన్, రాత్రి గార్డ్ ఉన్నారు. ఒప్పుకునే ముందు నేనే వెళ్లి చూశాను. ఇప్పుడు తను ప్రతి నెలా ఇంటికి డబ్బు పంపుతోంది.',
    },
  },
  {
    id: 's6',
    name: 'Naveen T.',
    gender: 'm',
    age: 22,
    districtId: 'hanumakonda',
    trades: ['actech', 'electrician', 'copa'],
    tradeId: 'actech',
    earn: 18000,
    nowRole: 'Runs his own AC repair service',
    parent: 'Yadagiri (father)',
    quote: {
      en: 'He dropped out once. The counsellor called us, not just him. He finished, and now in summer he cannot take all the calls.',
      hi: 'एक बार उसने पढ़ाई छोड़ दी थी। काउंसलर ने सिर्फ़ उसे नहीं, हमें भी फ़ोन किया। उसने कोर्स पूरा किया, और अब गर्मियों में वह सारे कॉल नहीं ले पाता।',
      te: 'ఒకసారి మధ్యలో మానేశాడు. కౌన్సెలర్ వాడికే కాదు, మాకూ ఫోన్ చేశారు. కోర్సు పూర్తి చేశాడు, ఇప్పుడు ఎండాకాలంలో అన్ని కాల్స్ తీసుకోలేకపోతున్నాడు.',
    },
  },
]

// Best match by trade, then gender, then district.
export function matchStory({ tradeId, gender, districtId }) {
  const score = (s) =>
    (s.trades.includes(tradeId) ? 4 : 0) + (s.gender === gender ? 2 : 0) + (s.districtId === districtId ? 1 : 0)
  return [...STORIES].sort((a, b) => score(b) - score(a))[0]
}
