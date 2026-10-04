// Family-mode counsellor on Claude. One family turn = one tool-runner loop:
//   Claude reads the family context -> calls outcome tools (backed by the SQLite outcome store)
//   -> returns a structured reply -> the "No Source, No Number" guardrail checks every figure
//   against this turn's tool results before the family sees it.
// The conversation so far is sent as a transcript inside a single user message, so each turn
// is a fresh, append-only request (no earlier thinking blocks are replayed or edited).
import Anthropic from '@anthropic-ai/sdk'
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema'
import { DISTRICTS, getDistrict, TOWNS } from '../src/data/districts.js'
import { TRADES, getTrade, eligibleTrades, EDUCATION, MARKS, INCOME } from '../src/data/trades.js'
import { vacancies, SOURCES } from '../src/data/outcomes.js'
import { STORIES, matchStory } from '../src/data/stories.js'
import { simulate } from '../src/lib/simulate.js'
import { inr, inrRange, num, pick } from '../src/lib/format.js'
import { OBJECTIONS, OBJECTION_KEYS, tag } from '../src/engine/taxonomy.js'
import { ROLES, ROLE_KEYS, stanceLabel } from '../src/engine/roles.js'
import { guardrail, helplineEvidence, recommendTrade } from '../src/engine/counsel.js'
import { publishedFor } from './db.js'

export const MODEL = process.env.HUNARSETU_MODEL || 'claude-opus-5-5'

// The SDK also accepts an `ant auth login` profile; set HUNARSETU_LLM=on to use one.
export const claudeConfigured = () =>
  Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.HUNARSETU_LLM === 'on')

let client
const getClient = () => (client ??= new Anthropic({ timeout: 90_000, maxRetries: 1 }))

const L = (en, hi, te) => ({ en, hi, te })
const LANG_NAME = { en: 'English', hi: 'Hindi (Devanagari script)', te: 'Telugu (Telugu script)' }

// The language instruction for this turn, e.g. "Telugu, in Telugu script".
export function replyLanguage(replyLang) {
  const { lang = 'en', roman = false } = replyLang ?? {}
  if (roman && lang === 'hi') return 'Hindi written in English letters (romanised Hindi), the way the speaker wrote'
  if (roman && lang === 'te') return 'Telugu written in English letters (romanised Telugu), the way the speaker wrote'
  return { en: 'English', hi: 'Hindi, in Devanagari script', te: 'Telugu, in Telugu script' }[lang] ?? 'English'
}
const DISTRICT_IDS = DISTRICTS.map((d) => d.id)
const TRADE_IDS = TRADES.map((t) => t.id)
const EDU_IDS = EDUCATION.map((e) => e.id)
const INCOME_IDS = INCOME.map((i) => i.id)
const YES = L('Yes', 'हाँ', 'అవును')
const NO = L('No', 'नहीं', 'లేదు')

export class LlmUnavailable extends Error {}

// ---------- System prompt (stable across requests, so it is prompt-cached) ----------

export const SYSTEM_PROMPT = `You are HunarSetu ("bridge of skills"), a counsellor that helps Indian families decide together about vocational training (ITI courses and short PMKVY courses) for a young learner. You talk to the whole family at once: the learner, parents and sometimes grandparents or a guardian. Every message tells you who is speaking. Many family members have little schooling and will hear your reply read aloud on a basic phone.

How to answer:
- Answer the speaker's actual worry first, directly and warmly, in plain everyday words a person with little schooling understands. Say "students" not "trainees", "got a job" not "placement", "paid training" not "apprenticeship". If you must use a term like ITI or NSQF level, explain it in a few simple words.
- Keep replies short: two to four sentences, under 90 words. No markdown, no bullet points, no headings, no emojis, because the text is read aloud.
- Write the reply in the language named on the last line of the message: the language the speaker just used. Do this even if earlier messages, the facts or the website use another language. In Hindi or Telugu, use simple everyday words and short sentences; well-known words like ITI or CCTV may stay in English. Always write numbers with Western digits 0-9.
- Respect every worry. Never dismiss parents, never pressure, never promise a job, never run down college degrees, and remember the decision belongs to the family. Parents' worries about a daughter's safety, marriage, or what relatives will say are serious and deserve a careful, factual answer.

No Source, No Number (strict):
- Never state any figure (money, percentages, counts, distances, durations of a job or course) unless it appears in a tool result from this turn, or the family said it themselves. Call the relevant tool before answering anything about earnings, job chances, safety, cost, distance, career growth or comparisons with a degree, even if you answered something similar earlier.
- Copy figures exactly as the tool wrote them, for example "₹13,500–₹17,000" or "74%". Do not round, convert or combine figures. Any figure that is not traceable is removed before the family sees it.
- Say how sure the figure is in plain words when it matters: "verified" figures come from calling past trainees; "provider-reported" figures are what the centre says and are not yet checked; "estimated" figures are calculated from government wage surveys.
- If no tool has what they asked, say you do not have checked information on that and offer a counsellor.

Choosing tools: get_outcomes for earnings, job chances, job security and comparing centres; get_centre_safety for safety, hostels, girls' safety and distance; get_costs for fees, stipends and money worries; get_career_path for how the course leads to jobs and further study; compare_paths when they ask whether a degree or starting work now is better; find_family_story when they worry about respect, status, marriage or what people will say; get_job_market for vacancies and employers; list_trades when the learner is unsure or asks about other courses. Use the IDs given in the family profile.

Hand over to a person (set escalate):
- distress: anyone mentions self-harm, being forced, violence, or severe stress. Do not counsel about the trade in that reply; respond with care and say a counsellor will call. The app also shows the Tele-MANAS helpline.
- unresolved: the same person raises the same worry again after it was answered, as shown in the concern map.
- sensitive: marriage, a daughter's safety, caste or family conflict. Answer gently with facts, and offer a woman counsellor.
- low_confidence: you could not understand the message; ask one short clarifying question.
- requested: they ask to talk to a person.

Signals you return:
- objections: the worries this speaker raised in this message, using only these keys: income (earnings), job (job security), social (respect, status, what people say), safety, distance, cost, marriage, degree (a degree is better). Empty if none.
- acknowledged: true only when the speaker says their worry is answered or agrees (for example "ok", "theek hai", "sare", "that makes sense").
- understood: false only when you could not tell what they meant.
- evidence_ids: the fact IDs from tool results that your reply relies on, most important first.
- show_career_path: true when you talked about how the learner can grow, study further, or when comparing with a degree.
- story_id: the id from find_family_story if you used that story, otherwise an empty string.
- followups: two or three other worry keys this family may want to discuss next.`

export const REPLY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'objections', 'acknowledged', 'sentiment', 'understood', 'escalate', 'evidence_ids', 'show_career_path', 'story_id', 'followups'],
  properties: {
    reply: { type: 'string', description: 'What HunarSetu says to the family, in plain words, under 90 words.' },
    objections: { type: 'array', items: { type: 'string', enum: OBJECTION_KEYS } },
    acknowledged: { type: 'boolean' },
    sentiment: { type: 'string', enum: ['negative', 'neutral', 'positive'] },
    understood: { type: 'boolean' },
    escalate: {
      type: 'object',
      additionalProperties: false,
      required: ['needed', 'reason', 'woman_counsellor'],
      properties: {
        needed: { type: 'boolean' },
        reason: { type: 'string', enum: ['none', 'distress', 'unresolved', 'low_confidence', 'sensitive', 'requested'] },
        woman_counsellor: { type: 'boolean' },
      },
    },
    evidence_ids: { type: 'array', items: { type: 'string' } },
    show_career_path: { type: 'boolean' },
    story_id: { type: 'string' },
    followups: { type: 'array', items: { type: 'string', enum: OBJECTION_KEYS } },
  },
}

// ---------- Tools (each call records the facts it returned, for evidence cards and the guardrail) ----------

const idSchema = (extra = {}) => ({
  type: 'object',
  additionalProperties: false,
  required: ['district_id', 'trade_id', ...Object.keys(extra)],
  properties: {
    district_id: { type: 'string', enum: DISTRICT_IDS, description: 'District id from the family profile' },
    trade_id: { type: 'string', enum: TRADE_IDS, description: 'Trade id from the family profile' },
    ...extra,
  },
})

export function buildTools(profile, collector) {
  const fact = (label, value, badge, source, date) => {
    const id = `F${collector.items.length + 1}`
    collector.items.push({ id, label, value: String(value), badge, source, date })
    return { fact_id: id, value: String(value), trust: badge }
  }
  const respond = (obj) => {
    const json = JSON.stringify(obj)
    collector.raw.push(json)
    return json
  }
  const district = (v) => (DISTRICT_IDS.includes(v) ? v : profile.district)
  const trade = (v) => (TRADE_IDS.includes(v) ? v : recommendTrade(profile))
  const gender = profile.gender === 'f' ? 'f' : 'm'

  const tools = [
    betaTool({
      name: 'get_outcomes',
      description:
        'Verified outcome records for every training centre that offers a trade in a district: first-job monthly earnings, share of trainees in a job within 6 months, share still employed after 12 months, and estimated monthly earnings after 3 years, each with trust level, source and date. Call this before saying anything about earnings, salary, job chances, job security, placement, or which centre is better.',
      inputSchema: idSchema(),
      run: ({ district_id, trade_id }) => {
        const d = district(district_id)
        const t = trade(trade_id)
        const rows = publishedFor(d, t)
        return respond({
          district: getDistrict(d).name.en,
          trade: getTrade(t).name.en,
          centres: rows.map((p, i) => ({
            centre: p.name.en,
            type: p.type,
            first_job_earnings_monthly: fact(L(`Pay in first job · ${p.name.en}`, `पहली नौकरी में वेतन · ${p.name.hi}`, `మొదటి ఉద్యోగంలో జీతం · ${p.name.te}`), inrRange(p.earnLow, p.earnHigh), p.earnBadge, p.source, p.verifiedOn),
            in_job_after_6_months: fact(L(`Got a job within 6 months · ${p.name.en}`, `6 महीने में नौकरी मिली · ${p.name.hi}`, `6 నెలల్లో ఉద్యోగం వచ్చింది · ${p.name.te}`), `${p.placement}%`, p.placeBadge, p.source, p.verifiedOn),
            ...(i === 0
              ? {
                  still_employed_after_12_months: fact(L('Still working after 1 year', '1 साल बाद भी काम पर', '1 సంవత్సరం తర్వాత కూడా పనిలో'), `${p.retention}%`, p.placeBadge, p.source, p.verifiedOn),
                  earnings_after_3_years_monthly: fact(L('Pay after 3 years', '3 साल बाद वेतन', '3 సంవత్సరాల తర్వాత జీతం'), inr(p.year3), 'estimated', SOURCES.plfs, '2023-24'),
                }
              : {}),
            how_checked: p.rule,
          })),
        })
      },
    }),
    betaTool({
      name: 'get_centre_safety',
      description:
        "Safety and access facts for the centres offering a trade in a district: share of women trainees, girls' and boys' hostel, number of women instructors, CCTV and grievance cell, distance from town, and student bus pass. Call this for any worry about safety, a daughter's safety, hostels, travel or distance.",
      inputSchema: idSchema(),
      run: ({ district_id, trade_id }) => {
        const d = district(district_id)
        const rows = publishedFor(d, trade(trade_id)).sort((a, b) => a.km - b.km)
        return respond({
          centres: rows.map((p) => ({
            centre: p.name.en,
            town: TOWNS[p.town].en,
            distance_from_town: fact(L(`Distance · ${p.name.en}`, `दूरी · ${p.name.hi}`, `దూరం · ${p.name.te}`), `${p.km} km`, 'verified', 'GIS · centre location', p.inspectedOn),
            women_trainees: fact(L('Girls & women in class', 'कक्षा में लड़कियाँ/महिलाएँ', 'తరగతిలో అమ్మాయిలు/మహిళలు'), `${p.women}%`, 'provider', SOURCES.mis, p.verifiedOn),
            girls_hostel: fact(L('Girls’ hostel', 'लड़कियों का हॉस्टल', 'బాలికల హాస్టల్'), pick(p.girlsHostel ? YES : NO, 'en'), 'verified', SOURCES.inspection, p.inspectedOn),
            boys_hostel: p.boysHostel ? 'yes' : 'no',
            women_instructors: fact(L('Women teachers', 'महिला शिक्षक', 'మహిళా ఉపాధ్యాయులు'), p.womenInstructors, 'provider', SOURCES.mis, p.verifiedOn),
            cctv_and_grievance_cell: p.cctv && p.grievanceCell ? 'yes' : 'partial',
            student_bus_pass_route: p.busPass ? 'yes' : 'no',
          })),
          note: 'Every course includes workplace safety, first aid and correct use of safety gear. A woman counsellor is available on request.',
        })
      },
    }),
    betaTool({
      name: 'get_costs',
      description:
        "Course fee per year, apprenticeship stipend, and whether the family is likely to get fee support given their household income bracket. Call this for worries about fees, cost, money, loans or 'we cannot afford it'.",
      inputSchema: idSchema({ income_bracket: { type: 'string', enum: INCOME_IDS, description: 'Household income bracket id from the family profile' } }),
      run: ({ district_id, trade_id, income_bracket }) => {
        const t = getTrade(trade(trade_id))
        const p = publishedFor(district(district_id), t.id)[0]
        const income = INCOME_IDS.includes(income_bracket) ? income_bracket : profile.income
        const support = income === 'lt10' || income === '10to25' ? 'likely' : income === '25to50' ? 'possible' : 'unlikely'
        return respond({
          centre: p.name.en,
          course_fee_per_year: fact(L('Fee per year', 'फीस प्रति वर्ष', 'సంవత్సరానికి ఫీజు'), p.fee === 0 ? 'Free (government-funded)' : inr(p.fee), 'provider', SOURCES.mis, p.verifiedOn),
          apprenticeship_stipend_monthly: t.staircase.some((s) => s.stipend)
            ? fact(L('Paid while training', 'ट्रेनिंग के दौरान वेतन', 'శిక్షణలో జీతం'), inr(p.stipend), 'verified', 'Apprenticeship portal (NAPS) rate', '2026')
            : 'not applicable for this short course',
          fee_support_for_this_income: fact(L('Help with fees', 'फीस में मदद', 'ఫీజులో సహాయం'), support, 'estimated', 'State welfare rules (sample)', '2026'),
          note: 'Fee reimbursement and free hostel seats come from state welfare schemes; a counsellor helps with the forms. PMKVY short courses are free.',
        })
      },
    }),
    betaTool({
      name: 'get_career_path',
      description:
        'The Career Staircase for a trade: each step from course to apprenticeship, first job, licence or promotion, and further study such as a diploma through lateral entry, with typical monthly pay and time, plus whether the learner is eligible with their schooling. Call this when the family asks what the course leads to, about growth, further study, or whether the learner can still get a degree later.',
      inputSchema: idSchema({ schooling: { type: 'string', enum: EDU_IDS, description: "Learner's schooling id from the family profile" } }),
      run: ({ district_id, trade_id, schooling }) => {
        const t = getTrade(trade(trade_id))
        const d = getDistrict(district(district_id))
        const edu = EDU_IDS.includes(schooling) ? schooling : profile.edu
        const eligible = eligibleTrades(edu).some((x) => x.id === t.id)
        const r500 = (n) => Math.round((n * d.wage) / 500) * 500
        return respond({
          trade: t.name.en,
          nsqf_level: t.nsqf,
          course_length: fact(L('Course length', 'कोर्स की अवधि', 'కోర్సు వ్యవధి'), `${t.months} months`, 'verified', SOURCES.nqr, '2026'),
          eligible_with_this_schooling: eligible,
          alternatives_if_not_eligible: eligible ? [] : eligibleTrades(edu).map((x) => x.name.en),
          steps: t.staircase.map((s, i) => ({
            step: i + 1,
            title: s.title,
            role: s.role,
            nsqf: s.nsqf,
            when: s.time,
            monthly_pay: fact(L(`Step ${i + 1}: ${s.title}`, `चरण ${i + 1}: ${s.title}`, `దశ ${i + 1}: ${s.title}`), inrRange(r500(s.pay[0]), r500(s.pay[1])), s.stipend ? 'verified' : 'estimated', s.stipend ? 'NAPS stipend rate' : SOURCES.plfs, '2026'),
          })),
          lateral_entry_to_diploma: t.staircase.some((s) => /lateral/i.test(s.title)) ? 'yes, directly into the 2nd year of a diploma after ITI' : 'not for this trade',
        })
      },
    }),
    betaTool({
      name: 'compare_paths',
      description:
        "Estimated total earnings over the next 5 years, and monthly earnings at the end, for three choices: learning this trade, doing a general degree first (Inter plus degree after Class 10), or starting unskilled work now. Call this when anyone says a degree is better, or asks whether training is worth it compared with working now.",
      inputSchema: idSchema({ schooling: { type: 'string', enum: EDU_IDS, description: "Learner's schooling id from the family profile" } }),
      run: ({ district_id, trade_id, schooling }) => {
        const sim = simulate({ tradeId: trade(trade_id), districtId: district(district_id), edu: EDU_IDS.includes(schooling) ? schooling : profile.edu, years: 5 })
        const lakh = (n) => (Math.abs(n) >= 100000 ? `${n < 0 ? '−' : ''}₹${(Math.abs(n) / 100000).toFixed(1)} lakh` : inr(n))
        const src = 'HunarSetu simulator · ' + SOURCES.plfs
        return respond({
          five_year_total: {
            learn_this_trade: fact(L(`5-year earnings: ${sim.trade.name.en}`, `5 साल की कमाई: ${sim.trade.name.hi}`, `5 ఏళ్ల సంపాదన: ${sim.trade.name.te}`), lakh(sim.totals.trade), 'estimated', src, '2026'),
            degree_first: fact(L('5-year earnings: degree first', '5 साल की कमाई: पहले डिग्री', '5 ఏళ్ల సంపాదన: ముందు డిగ్రీ'), lakh(sim.totals.degree), 'estimated', src, '2026'),
            unskilled_work_now: fact(L('5-year earnings: work now', '5 साल की कमाई: अभी काम', '5 ఏళ్ల సంపాదన: ఇప్పుడే పని'), lakh(sim.totals.now), 'estimated', src, '2026'),
          },
          monthly_after_5_years: {
            learn_this_trade: fact(L('Monthly after 5 years: trade', '5 साल बाद मासिक: हुनर', '5 ఏళ్ల తర్వాత నెలకు: వృత్తి'), inr(sim.finalMonthly.trade), 'estimated', src, '2026'),
            degree_first: inr(sim.finalMonthly.degree),
            unskilled_work_now: fact(L('Monthly after 5 years: work now', '5 साल बाद मासिक: अभी काम', '5 ఏళ్ల తర్వాత నెలకు: ఇప్పుడే పని'), inr(sim.finalMonthly.now), 'estimated', src, '2026'),
          },
          degree_years_of_study: sim.studyYears,
          note: 'Negative totals mean fees paid while studying. Trade earnings are weighted by the real placement rate. Skills and study can go together: after ITI a learner can join a diploma in the 2nd year.',
        })
      },
    }),
    betaTool({
      name: 'find_family_story',
      description:
        "A consented story from a past trainee's family matched by trade, the learner's gender and district: what the learner does now, monthly earnings, and a quote from a parent. Call this when someone worries about respect, status, what relatives will say, marriage, or whether 'people like us' succeed.",
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['trade_id', 'gender', 'district_id'],
        properties: {
          trade_id: { type: 'string', enum: TRADE_IDS },
          gender: { type: 'string', enum: ['f', 'm'], description: "Learner's gender from the family profile" },
          district_id: { type: 'string', enum: DISTRICT_IDS },
        },
      },
      run: ({ trade_id, gender: g, district_id }) => {
        const s = matchStory({ tradeId: trade(trade_id), gender: g === 'f' || g === 'm' ? g : gender, districtId: district(district_id) })
        return respond({
          story_id: s.id,
          name: s.name,
          age: s.age,
          trade: getTrade(s.tradeId).name.en,
          now_works_as: s.nowRole,
          earns_monthly: fact(L(`${s.name} earns today`, `${s.name} की आज की कमाई`, `${s.name} ఈరోజు సంపాదన`), inr(s.earn), 'verified', `${SOURCES.tracer} (consented story)`, 'Aug 2026'),
          parent: s.parent,
          parent_quote_in_family_language: pick(s.quote, profile.lang ?? 'en'),
          parent_ambassador_available: true,
        })
      },
    }),
    betaTool({
      name: 'get_job_market',
      description: 'Open vacancies for a trade in and around a district (National Career Service snapshot) and the kinds of employers who hire. Call this for questions about whether there are jobs nearby or who will hire.',
      inputSchema: idSchema(),
      run: ({ district_id, trade_id }) => {
        const d = district(district_id)
        const t = getTrade(trade(trade_id))
        return respond({
          open_vacancies_nearby: fact(L('Jobs open nearby', 'आसपास खाली नौकरियाँ', 'దగ్గర్లో ఖాళీ ఉద్యోగాలు'), num(vacancies(d, t.id)), 'verified', SOURCES.ncs, 'Sep 2026'),
          employers: t.employers,
        })
      },
    }),
    betaTool({
      name: 'list_trades',
      description: "Trades the learner can join with their schooling in a district, each with the best centre's first-job earnings and placement. Call this when the learner is unsure, asks about other courses, or a chosen trade needs more schooling.",
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['district_id', 'schooling'],
        properties: { district_id: { type: 'string', enum: DISTRICT_IDS }, schooling: { type: 'string', enum: EDU_IDS } },
      },
      run: ({ district_id, schooling }) => {
        const d = district(district_id)
        return respond({
          trades: eligibleTrades(EDU_IDS.includes(schooling) ? schooling : profile.edu).map((t) => {
            const p = publishedFor(d, t.id)[0]
            return {
              trade_id: t.id,
              trade: t.name.en,
              course: `${t.kind === 'ITI' ? 'ITI' : 'PMKVY short course'}, ${t.months} months`,
              first_job_earnings: fact(L(`Pay in first job · ${t.name.en}`, `पहली नौकरी में वेतन · ${t.name.hi}`, `మొదటి ఉద్యోగంలో జీతం · ${t.name.te}`), inrRange(p.earnLow, p.earnHigh), p.earnBadge, p.source, p.verifiedOn),
              placement: `${p.placement}%`,
              women_trainees: `${p.women}%`,
            }
          }),
        })
      },
    }),
  ]
  // strict: true keeps tool arguments schema-valid (tool_choice stays auto on this model).
  return tools.map((tool) => ({ ...tool, strict: true }))
}

// ---------- Turn context ----------

const label = (list, id) => pick(list.find((x) => x.id === id)?.label, 'en')

export function turnMessage({ text, role, profile, family, history, lang, replyLang }) {
  const trade = getTrade(recommendTrade(profile))
  const lines = [
    'Family profile:',
    `- District: ${getDistrict(profile.district).name.en} (district_id: ${profile.district})${profile.mandal ? `; mandal: ${profile.mandal}` : ''}`,
    `- Household income: ${label(INCOME, profile.income)} (income_bracket: ${profile.income})`,
    `- Learner: ${profile.gender === 'f' ? 'girl' : 'boy'} (gender: ${profile.gender}); schooling: ${label(EDUCATION, profile.edu)} (schooling: ${profile.edu}); marks: ${label(MARKS, profile.marks)}`,
    `- Trade being discussed: ${trade.name.en} (trade_id: ${trade.id})${!profile.trade || profile.trade === 'unsure' ? ' - the learner has not chosen yet' : ''}`,
    `- Family members present: ${profile.members.map((r) => ROLES[r].label.en).join(', ')}`,
    `- Language chosen on the website: ${LANG_NAME[lang] ?? 'English'}`,
    '',
    'Concern map so far:',
  ]
  for (const r of profile.members) {
    const st = family?.stance?.[r]
    const worries = (family?.concerns ?? []).filter((c) => c.role === r).map((c) => `${OBJECTIONS[c.key].label.en} (${c.status}${c.count > 1 ? `, raised ${c.count} times` : ''})`)
    lines.push(`- ${ROLES[r].label.en}: ${st ? stanceLabel(st.now).en.toLowerCase() : 'unknown'}; worries: ${worries.length ? worries.join(', ') : 'none yet'}`)
  }
  if (history.length) {
    lines.push('', 'Recent conversation (oldest first):')
    for (const h of history) lines.push(`[${h.from === 'bot' ? 'HunarSetu' : ROLES[h.role]?.label.en ?? 'Family'}] ${h.text}`)
  }
  lines.push('', `New message from ${ROLES[role].label.en}:`, '"""', text, '"""')
  lines.push('', `REPLY LANGUAGE: write the "reply" in ${replyLanguage(replyLang ?? { lang })} only.`)
  return lines.join('\n')
}

const REASON = { distress: 'distress', unresolved: 'unresolved', low_confidence: 'lowConfidence', sensitive: 'sensitive', requested: 'requested' }

// ---------- Main entry ----------

export async function counselWithClaude({ text, role, profile, family, history = [], lang = 'en', replyLang }) {
  const collector = { items: [], raw: [] }
  const userText = turnMessage({ text, role, profile: { ...profile, lang: replyLang?.lang ?? lang }, family, history, lang, replyLang })

  const runner = getClient().beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    max_iterations: 6,
    // Server-side fallback: if a safety classifier declines, the API retries on Anthropic's
    // recommended fallback model for that category instead of returning a refusal.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    // Chat route: low effort keeps replies quick; thinking stays adaptive (always on for this model).
    output_config: { effort: 'low', format: { type: 'json_schema', schema: REPLY_SCHEMA } },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: buildTools({ ...profile, lang: replyLang?.lang ?? lang }, collector),
    messages: [{ role: 'user', content: userText }],
  })

  const final = await runner
  if (final.stop_reason === 'refusal') throw new LlmUnavailable('refusal')
  if (final.stop_reason === 'max_tokens') throw new LlmUnavailable('max_tokens')
  const textBlock = final.content.find((b) => b.type === 'text')
  if (!textBlock) throw new LlmUnavailable('no_text')

  let out
  try {
    out = JSON.parse(textBlock.text)
  } catch {
    throw new LlmUnavailable('bad_json')
  }
  console.log(
    `[claude] ${final.model} stop=${final.stop_reason} tools=${collector.raw.length} in=${final.usage?.input_tokens} cache_read=${final.usage?.cache_read_input_tokens} out=${final.usage?.output_tokens}`,
  )
  return finishTurn({ out, text, role, collector, userText, engine: 'claude', model: final.model, girl: profile.gender === 'f', replyLang })
}

// Turn a model's structured reply into what the browser shows, for every provider:
// "No Source, No Number" guardrail, evidence cards, and the signals for the family concern map.
// Replies are read aloud and shown as plain text: drop markdown and math markup small models add.
export function plainText(s) {
  return String(s ?? '')
    .replace(/\$\s*([^$\n]{1,40}?)\s*\$/g, '$1') // $₹20,000$ -> ₹20,000
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\\n|\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function finishTurn({ out, text, role, collector, userText, engine, model, girl = false, replyLang }) {
  out = { ...out, reply: plainText(out.reply) }
  // The keyword tagger reads the family's own words reliably (every worry button, in every language),
  // so its topics come first; the model adds any it noticed beyond them.
  const objections = [...new Set([...tag(text).objections, ...(out.objections ?? [])])].filter((k) => OBJECTION_KEYS.includes(k))
  const distress = tag(text).distress || out.escalate?.reason === 'distress'

  // Figures may come only from this turn's facts, the family's own words,
  // or replies that already passed the guardrail earlier in the conversation.
  const alsoAllowed = [...collector.raw, userText].join('\n')
  const guard = guardrail(String(out.reply ?? ''), collector.items, alsoAllowed)

  // Evidence cards: facts the reply cites, plus any fact whose figure appears in the reply.
  // A fact is "mentioned" when its first figure appears in the reply (ignoring commas and spaces).
  const flat = guard.text.replace(/[,\s]/g, '')
  // A fact is shown only when every number in it is in the reply (a range needs both ends).
  const mentions = (value) => {
    const nums = String(value).replace(/[,\s]/g, '').match(/\d+(?:\.\d+)?/g)
    return nums ? nums.every((n) => flat.includes(n)) : true
  }
  const cited = (out.evidence_ids ?? []).map((id) => collector.items.find((f) => f.id === id)).filter(Boolean)
  const evidence = [...new Map(cited.map((f) => [f.id, f])).values()].filter((f) => mentions(f.value))
  for (const f of collector.items) {
    if (/\d/.test(f.value) && mentions(f.value) && !evidence.some((e) => e.value === f.value)) evidence.push(f)
  }
  evidence.splice(4)
  if (distress) evidence.unshift(helplineEvidence())

  const reasons = []
  if (distress) reasons.push('distress')
  if (out.escalate?.needed && REASON[out.escalate.reason]) reasons.push(REASON[out.escalate.reason])
  // Same rule as the offline engine: marriage, or a daughter's safety, always offers a (woman) counsellor.
  if (!reasons.includes('sensitive') && (objections.includes('marriage') || (girl && objections.includes('safety')))) reasons.push('sensitive')
  console.log(`[${engine}] guard checked=${guard.checked} blocked=${guard.blocked} evidence=${evidence.length}`)

  return {
    engine,
    model,
    reply: {
      text: guard.text,
      lang: replyLang?.lang ?? 'en',
      evidence,
      guard: { checked: guard.checked, blocked: guard.blocked },
      story: STORIES.some((s) => s.id === out.story_id) ? out.story_id : null,
      staircase: !!out.show_career_path,
      followups: (out.followups ?? []).filter((k) => OBJECTION_KEYS.includes(k)).slice(0, 3),
      replyTo: { role, key: objections[0] ?? null },
      kind: distress ? 'distress' : objections.length ? 'answer' : out.acknowledged ? 'thanks' : 'answer',
    },
    signals: {
      objections,
      acknowledged: !!out.acknowledged,
      sentiment: out.sentiment === 'positive' ? 1 : out.sentiment === 'negative' ? -1 : 0,
      understood: out.understood !== false,
      distress,
      reasons,
      woman: !!out.escalate?.woman_counsellor || reasons.includes('sensitive'),
    },
  }
}

export const ALLOWED = { DISTRICT_IDS, TRADE_IDS, EDU_IDS, INCOME_IDS, ROLE_KEYS, MARK_IDS: MARKS.map((m) => m.id) }
