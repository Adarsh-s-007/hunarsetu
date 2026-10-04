import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { S } from './i18n/strings'
import { pick } from './lib/format.js'
import { connectBackend, resetLlm } from './lib/api.js'

const Ctx = createContext(null)

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v == null ? fallback : JSON.parse(v)
  } catch {
    return fallback
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

export function AppProvider({ children }) {
  const [lang, setLang] = useState(() => load('hs.lang', 'en'))
  const [easy, setEasy] = useState(() => load('hs.easy', false))
  // Read every new answer aloud (for families who find reading hard).
  const [autoRead, setAutoRead] = useState(() => load('hs.autoRead', false))
  // Counselling session: profile, messages, family concern map. Shared by Counsel, Pact and Counsellor pages.
  const [session, setSession] = useState(() => load('hs.session', null))
  const [requests, setRequests] = useState(() => load('hs.requests', []))

  useEffect(() => { save('hs.lang', lang) }, [lang])
  useEffect(() => { save('hs.easy', easy) }, [easy])
  useEffect(() => { save('hs.autoRead', autoRead) }, [autoRead])
  useEffect(() => { save('hs.session', session) }, [session])
  useEffect(() => { save('hs.requests', requests) }, [requests])

  // Backend status: { online, llm, model, stats } or null when running without a server.
  const [backend, setBackend] = useState(undefined)
  useEffect(() => {
    let live = true
    connectBackend().then((b) => {
      if (!live) return
      resetLlm(!!b?.llm)
      setBackend(b)
    })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.classList.toggle('easy', easy)
  }, [lang, easy])

  const t = useCallback((key, vars) => {
    let s = pick(S[key], lang) || key
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
    return s
  }, [lang])
  const L = useCallback((obj) => pick(obj, lang), [lang])

  const value = useMemo(
    () => ({ lang, setLang, easy, setEasy, autoRead, setAutoRead, t, L, session, setSession, requests, setRequests, backend }),
    [lang, easy, autoRead, t, L, session, requests, backend],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useApp = () => useContext(Ctx)
