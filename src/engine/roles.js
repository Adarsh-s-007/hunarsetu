// Family members. Colours are categorical chart slots 1–5 (validated order) so a role
// looks the same in the chat, the concern map and the admin charts.
export const ROLES = {
  father: { label: { en: 'Father', hi: 'पिता', te: 'నాన్న' }, color: '#2a78d6', icon: 'UserRound', start: -0.45 },
  mother: { label: { en: 'Mother', hi: 'माँ', te: 'అమ్మ' }, color: '#eb6834', icon: 'UserRound', start: -0.35 },
  learner: { label: { en: 'Learner', hi: 'विद्यार्थी', te: 'విద్యార్థి' }, color: '#1baf7a', icon: 'Backpack', start: 0.1 },
  grandparent: { label: { en: 'Grandparent', hi: 'दादा-दादी', te: 'తాత/నానమ్మ' }, color: '#eda100', icon: 'UserRound', start: -0.55 },
  guardian: { label: { en: 'Guardian', hi: 'अभिभावक', te: 'సంరక్షకులు' }, color: '#e87ba4', icon: 'UserRound', start: -0.3 },
}

export const ROLE_KEYS = ['learner', 'mother', 'father', 'grandparent', 'guardian']

export function stanceLabel(v) {
  if (v <= -0.33) return { key: 'opposed', en: 'Against', hi: 'ख़िलाफ़', te: 'వ్యతిరేకం' }
  if (v < 0.33) return { key: 'unsure', en: 'Not sure', hi: 'तय नहीं', te: 'ఖచ్చితంగా లేదు' }
  return { key: 'supportive', en: 'In favour', hi: 'पक्ष में', te: 'అనుకూలం' }
}
