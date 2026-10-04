// Free AI counsellor: any OpenAI-compatible chat API, no paid key required.
//   pollinations  - works with no key at all (anonymous free tier)
//   groq          - free tier, needs a free GROQ_API_KEY
//   gemini        - free tier, needs a free GEMINI_API_KEY
// Each family turn: look up the facts this question needs in the outcome database,
// make ONE model call with those facts, then run the same guardrail as the Claude path.
// One call (instead of a tool-calling loop) is faster and more reliable on free models.
import { buildTools, turnMessage, finishTurn, LlmUnavailable, replyLanguage } from './llm.js'
import { replyMatches } from '../src/lib/langdetect.js'
import { tag } from '../src/engine/taxonomy.js'
import { recommendTrade } from '../src/engine/counsel.js'

export const FREE_PROVIDERS = {
  groq: {
    label: 'Groq (free tier)',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    keyEnv: 'GROQ_API_KEY',
    model: () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    jsonMode: true,
  },
  gemini: {
    label: 'Google Gemini (free tier)',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    keyEnv: 'GEMINI_API_KEY',
    model: () => process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    jsonMode: true,
  },
  pollinations: {
    label: 'Pollinations (free, no key)',
    url: 'https://text.pollinations.ai/openai',
    keyEnv: null,
    model: () => process.env.POLLINATIONS_MODEL || 'openai',
    jsonMode: false,
    lowReasoning: true,
  },
}

// Providers to try, best first. Keyed providers only when their key is set; the keyless
// one unless HUNARSETU_FREE_AI=off (for deployments that must not send text to it).
export function freeProviderOrder(lang = 'en') {
  const order = []
  const indic = lang === 'hi' || lang === 'te'
  if (process.env.GEMINI_API_KEY && indic) order.push('gemini')
  if (process.env.GROQ_API_KEY) order.push('groq')
  if (process.env.GEMINI_API_KEY && !indic) order.push('gemini')
  if (process.env.HUNARSETU_FREE_AI !== 'off') order.push('pollinations')
  const forced = process.env.LLM_PROVIDER
  return forced && order.includes(forced) ? [forced, ...order.filter((p) => p !== forced)] : order
}

const SYSTEM = `You are HunarSetu, a counsellor helping Indian families decide together about job-skill courses (ITI courses and short PMKVY courses) for a young learner. You speak to the whole family at once; each message says who is speaking. Many family members have little schooling and will hear your reply read aloud.

Rules:
- Answer the speaker's worry first, warmly, in plain everyday words. Say "students" not "trainees", "got a job" not "placement", "paid training" not "apprenticeship". Two to four short sentences, under 90 words. No markdown, no lists, no emojis.
- Write the reply in the language named on the REPLY LANGUAGE line at the end of the message: the language the speaker just used. Do this even if earlier messages or the facts use another language. In Hindi or Telugu use simple everyday words and short sentences; well-known words like ITI may stay in English. Write numbers with the digits 0-9.
- Use ONLY figures that appear in FACTS, copied exactly as written there (for example "₹13,500–₹17,000" or "74%"). Never invent, round or combine numbers. If FACTS do not answer the question, say you do not have checked information on that and offer to connect a counsellor.
- When it matters, say how sure a figure is: trust "verified" means we phoned past students; "provider" means the centre says so and it is not yet checked; "estimated" means worked out from government surveys.
- Respect every worry. Never pressure, never promise a job, never run down college degrees; the decision belongs to the family.
- Hand over to a person (escalate) when: someone mentions self-harm, being forced, violence or severe stress (reason "distress"; reply only with care and say a counsellor will call); the same person repeats a worry the concern map shows as already answered ("unresolved"); marriage, a daughter's safety, caste or family conflict ("sensitive"; offer a woman counsellor); you cannot understand the message ("low_confidence"; ask one short question); they ask for a person ("requested").

Return ONLY one JSON object, nothing else, with exactly these keys:
{"reply": "<what you say to the family>",
 "objections": ["<worries this speaker raised now, from: income, job, social, safety, distance, cost, marriage, degree>"],
 "acknowledged": <true only if the speaker says the worry is answered or agrees>,
 "sentiment": "negative" | "neutral" | "positive",
 "understood": <false only if you could not understand the message>,
 "escalate": {"needed": <true|false>, "reason": "none" | "distress" | "unresolved" | "low_confidence" | "sensitive" | "requested", "woman_counsellor": <true|false>},
 "evidence_ids": ["<fact_id values from FACTS that your reply uses, most important first>"],
 "show_career_path": <true when you talked about growth or further study>,
 "story_id": "<story_id from FACTS if you used that family story, else empty string>",
 "followups": ["<two or three other worry keys this family may want next>"]}`

// Which facts to look up for each worry (the same tools Claude calls itself).
const PACKS = {
  income: ['get_outcomes'],
  job: ['get_outcomes', 'get_job_market'],
  social: ['find_family_story', 'get_outcomes'],
  safety: ['get_centre_safety'],
  distance: ['get_centre_safety'],
  cost: ['get_costs'],
  marriage: ['find_family_story', 'get_outcomes'],
  degree: ['compare_paths', 'get_career_path'],
}

async function lookUpFacts(text, profile, tools) {
  const tg = tag(text)
  const want = new Set(['get_outcomes'])
  const keys = tg.objections.length ? tg.objections : ['safety', 'cost', 'degree']
  for (const k of keys) for (const name of PACKS[k] ?? []) want.add(name)
  if (!profile.trade || profile.trade === 'unsure') want.add('list_trades')
  const base = { district_id: profile.district, trade_id: recommendTrade(profile) }
  const args = {
    get_outcomes: base,
    get_centre_safety: base,
    get_job_market: base,
    get_costs: { ...base, income_bracket: profile.income },
    get_career_path: { ...base, schooling: profile.edu },
    compare_paths: { ...base, schooling: profile.edu },
    find_family_story: { trade_id: base.trade_id, gender: profile.gender, district_id: profile.district },
    list_trades: { district_id: profile.district, schooling: profile.edu },
  }
  for (const name of want) await tools.find((t) => t.name === name)?.run(args[name])
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// The keyless tier allows about one answer every 15-30 seconds per server and refuses calls
// in between (HTTP 402). Send calls one at a time, leave 15 s after the last answer, and
// when it is still busy, wait and try again rather than giving up.
let keylessChain = Promise.resolve()
let keylessLastOk = 0
let keylessLastTry = 0
function oneAtATime(fn) {
  const run = keylessChain.then(async () => {
    const wait = Math.max(keylessLastOk + 15_000, keylessLastTry + 4_000) - Date.now()
    if (wait > 0) await sleep(wait)
    try {
      const out = await fn()
      keylessLastOk = Date.now()
      return out
    } finally {
      keylessLastTry = Date.now()
    }
  })
  keylessChain = run.catch(() => {})
  return run
}

async function callModel(provider, messages) {
  if (!FREE_PROVIDERS[provider].keyEnv) return oneAtATime(() => sendToModel(provider, messages))
  return sendToModel(provider, messages)
}

async function sendToModel(provider, messages) {
  const cfg = FREE_PROVIDERS[provider]
  const headers = { 'content-type': 'application/json' }
  if (cfg.keyEnv) headers.authorization = `Bearer ${process.env[cfg.keyEnv]}`
  const body = { model: cfg.model(), messages, max_tokens: 4000 }
  if (cfg.jsonMode) body.response_format = { type: 'json_object' }
  if (cfg.lowReasoning) body.reasoning_effort = 'low' // reasoning models: think briefly, answer sooner
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 45_000)
  try {
    const res = await fetch(cfg.url, { method: 'POST', headers, body: JSON.stringify(body), signal: ac.signal })
    const raw = await res.text()
    let data = null
    try {
      data = JSON.parse(raw)
    } catch {
      /* not JSON */
    }
    if (!res.ok) {
      const why = typeof data?.error === 'string' ? data.error : data?.error?.message ?? data?.message ?? raw.slice(0, 200)
      const err = new Error(`HTTP ${res.status} ${why}`.trim())
      err.status = res.status
      throw err
    }
    const msg = data?.choices?.[0]?.message
    if (!msg) throw new Error('no answer in response')
    return { content: typeof msg.content === 'string' ? msg.content : '', model: data.model ?? cfg.model(), finish: data.choices[0].finish_reason }
  } finally {
    clearTimeout(timer)
  }
}

// Read the model's JSON. If a model answers in plain text instead, keep the text and read
// the family signals with the keyword tagger, so the turn still works.
function parseReply(content, text) {
  const s = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  if (a >= 0 && b > a) {
    try {
      const o = JSON.parse(s.slice(a, b + 1))
      if (typeof o.reply === 'string' && o.reply.trim()) return o
    } catch {
      /* fall through to plain text */
    }
  }
  if (!s) return null
  if (s.startsWith('{')) {
    // Cut-off JSON: rescue the reply text; the keyword tagger fills in the signals below.
    const m = s.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/)
    if (!m) return null
    try {
      return { ...fromText(JSON.parse(`"${m[1]}"`), text) }
    } catch {
      return null
    }
  }
  return fromText(s, text)
}

function fromText(reply, text) {
  const tg = tag(text)
  return {
    reply,
    objections: tg.objections,
    acknowledged: tg.positive,
    sentiment: tg.sentiment < 0 ? 'negative' : tg.sentiment > 0 ? 'positive' : 'neutral',
    understood: true,
    escalate: { needed: false, reason: 'none', woman_counsellor: false },
    evidence_ids: [],
    show_career_path: false,
    story_id: '',
    followups: [],
  }
}

// The family sees "checking the numbers" while we wait; after this long, the offline engine answers instead.
const TURN_BUDGET_MS = 55_000

export async function counselWithFreeAI({ text, role, profile, family, history = [], lang = 'en', replyLang = { lang, roman: false } }) {
  const order = freeProviderOrder(replyLang.lang)
  if (!order.length) throw new LlmUnavailable('no_free_provider')
  const turnStarted = Date.now()

  const collector = { items: [], raw: [] }
  const tools = buildTools({ ...profile, lang: replyLang.lang }, collector)
  await lookUpFacts(text, profile, tools)

  const userText = turnMessage({ text, role, profile: { ...profile, lang: replyLang.lang }, family, history, lang, replyLang })
  const language = replyLanguage(replyLang)
  const messages = [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `FACTS (the only allowed source of figures; each figure has a fact_id):\n${collector.raw.join('\n')}\n\n${userText}\n\nReturn only the JSON object. The "reply" must be in ${language}.`,
    },
  ]

  let lastError
  for (const provider of order) {
    let fixedLanguage = false
    for (let attempt = 1; attempt <= 6 && Date.now() - turnStarted < TURN_BUDGET_MS; attempt++) {
      const started = Date.now()
      try {
        const { content, model, finish } = await callModel(provider, messages)
        const out = parseReply(content, text)
        if (!out) throw new Error(`unreadable reply (finish=${finish}, ${content.length} chars: ${JSON.stringify(content.slice(0, 160))})`)
        if (!replyMatches(out.reply, replyLang)) {
          // Wrong language: ask once more, plainly. If it happens again, the offline engine answers.
          if (fixedLanguage) throw Object.assign(new Error(`reply still not in ${language}`), { wrongLanguage: true })
          fixedLanguage = true
          console.warn(`[${provider}] reply was not in ${language}; asking again`)
          messages.push({ role: 'assistant', content }, { role: 'user', content: `Your "reply" is not in ${language}. Write the same answer again in ${language} only. Return only the JSON object.` })
          attempt--
          continue
        }
        console.log(`[${provider}] ${model} answered in ${Date.now() - started} ms (facts: ${collector.items.length}, language: ${language})`)
        return {
          ...finishTurn({ out, text, role, collector, userText, engine: provider, model, girl: profile.gender === 'f', replyLang }),
          providerLabel: FREE_PROVIDERS[provider].label,
        }
      } catch (err) {
        lastError = err
        console.warn(`[${provider}] attempt ${attempt} failed after ${Date.now() - started} ms: ${err.name === 'AbortError' ? 'timed out' : err.message}`)
        if (err.wrongLanguage) break
        const busy = err.status === 402 || err.status === 429 || err.status === 503
        if (!busy && attempt >= 2) break
        if (busy && provider !== 'pollinations') await sleep(attempt * 2000) // keyed tiers: short back-off (the keyless queue spaces itself)
      }
    }
  }
  throw new LlmUnavailable(`free_ai_failed: ${lastError?.message ?? 'unknown'}`)
}
