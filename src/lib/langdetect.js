// Which language should the answer be in? The language the person just wrote in.
// Used by the server (to instruct and check the AI) and by the offline engine in the browser.
//   Telugu script -> Telugu, Devanagari -> Hindi,
//   English letters -> English, or romanised Hindi / Telugu when the words say so,
//   very short or number-only messages ("ok", "500") -> the language chosen on the site.

const HI_ROMAN = new Set(
  ('kya kyaa hai hain nahi nahin kaise kitna kitni kitne mera meri mere beti beta ladki ladka paisa paise naukri kaam shaadi shadi ' +
    'ghar kyun kyon aur bhi toh hoga hogi hoge milega milegi milenge chahiye karna karegi karega padhai suraksha kab kahan kaha accha ' +
    'achha theek thik hum humko mujhe mujhko aap aapka unka uska yeh woh wahan yahan sakta sakti sakte lagega kharcha ka ki ke se ko').split(' '),
)
const TE_ROMAN = new Set(
  ('enti emiti ela entha enta ledu ledhu undi unda undha ammayi abbayi pelli udyogam jeetham jitam chaduvu emi kavali cheyali ekkada ' +
    'enduku bagundi naku naaku maa mana vastundi vasthundi ostundi istaru chestaru chesthe kani inka meeru memu vallu ikkada akkada ' +
    'avunu kadu sare chala baga dabbu kharchu bhayam bayam lo ante eppudu evaru emaina').split(' '),
)
// Words that are English in any case, so one stray "ka" or "maa" does not flip an English sentence.
const EN_COMMON = new Set(
  'the a an is are was will would can could should what how much many when where why who does do did she he her his my our your their this that it of to for in on and or not with after course job pay salary safe safety marriage fees cost far near hostel training'.split(
    ' ',
  ),
)

const count = (s, re) => (s.match(re) || []).length

export function detectLang(text, fallback = 'en') {
  const s = String(text ?? '')
  const deva = count(s, /[ऀ-ॿ]/g)
  const telu = count(s, /[ఀ-౿]/g)
  const latin = count(s, /[A-Za-z]/g)
  if (telu && telu >= deva && telu * 3 >= latin) return { lang: 'te', roman: false }
  if (deva && deva * 3 >= latin) return { lang: 'hi', roman: false }
  const words = s.toLowerCase().match(/[a-z]+/g) ?? []
  if (words.length < 3) return { lang: fallback, roman: false }
  const hi = words.filter((w) => HI_ROMAN.has(w)).length
  const te = words.filter((w) => TE_ROMAN.has(w)).length
  const en = words.filter((w) => EN_COMMON.has(w)).length
  if (te >= 2 && te > hi && te > en) return { lang: 'te', roman: true }
  if (hi >= 2 && hi > te && hi > en) return { lang: 'hi', roman: true }
  return { lang: 'en', roman: false }
}

// Which language a reply is actually written in (for checking the AI).
export function scriptOf(text) {
  const s = String(text ?? '')
  const deva = count(s, /[ऀ-ॿ]/g)
  const telu = count(s, /[ఀ-౿]/g)
  const latin = count(s, /[A-Za-z]/g)
  const total = deva + telu + latin || 1
  if (telu / total > 0.5) return 'te'
  if (deva / total > 0.5) return 'hi'
  return 'latin'
}

// Does this reply match the language we asked for?
export function replyMatches(reply, want) {
  const got = scriptOf(reply)
  if (want.roman || want.lang === 'en') return got === 'latin'
  return got === want.lang
}

export const LANG_LABEL = { en: 'English', hi: 'Hindi', te: 'Telugu' }
