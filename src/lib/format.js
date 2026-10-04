const nf = new Intl.NumberFormat('en-IN')

export const num = (n) => nf.format(Math.round(n))
export const inr = (n) => `${n < 0 ? '−' : ''}₹${nf.format(Math.abs(Math.round(n)))}`
export const inrRange = (a, b) => `₹${nf.format(a)}–₹${nf.format(b)}`
export const pct = (n) => `${Math.round(n)}%`

// "₹6.4 lakh" style for big totals.
export function inrLakh(n) {
  if (Math.abs(n) >= 100000) return `${n < 0 ? '−' : ''}₹${(Math.abs(n) / 100000).toFixed(1)} lakh`
  return inr(n)
}

// Pick the current language's string from a { en, hi, te } object.
export const pick = (obj, lang) => (obj == null ? '' : typeof obj === 'string' ? obj : obj[lang] ?? obj.en)

// Replace {key} placeholders.
export const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`))

// "2-year course" / "3-month course" in the family's language.
export function courseLength(months, lang) {
  const years = months >= 12 && months % 12 === 0 ? months / 12 : null
  if (lang === 'hi') return years ? `${years} साल का कोर्स` : `${months} महीने का कोर्स`
  if (lang === 'te') return years ? `${years} సంవత్సరాల కోర్సు` : `${months} నెలల కోర్సు`
  return years ? `${years}-year course` : `${months}-month course`
}
