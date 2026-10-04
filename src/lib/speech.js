// Browser speech: text-to-speech for read-aloud, speech-to-text for the mic button.
// Production uses Bhashini ASR/TTS; the Web Speech API stands in for the prototype.
import { LANGS } from '../i18n/strings.js'
import { scriptOf } from './langdetect.js'

const speechLang = (lang) => LANGS.find((l) => l.id === lang)?.speech ?? 'en-IN'

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export function speak(text, lang, onEnd) {
  if (!canSpeak()) return false
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text.replace(/[“”]/g, ''))
  // Read with the voice that matches the text (an English answer on the Telugu site gets an English voice).
  const script = scriptOf(text)
  const code = script === 'te' ? 'te-IN' : script === 'hi' ? 'hi-IN' : lang === 'en' || /[A-Za-z]/.test(text) ? 'en-IN' : speechLang(lang)
  u.lang = code
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang === code) ?? window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(code.slice(0, 2)))
  if (voice) u.voice = voice
  u.rate = 0.95
  u.onend = () => onEnd?.()
  u.onerror = () => onEnd?.()
  window.speechSynthesis.speak(u)
  return true
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel()
}

export function getRecognizer(lang) {
  const R = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  if (!R) return null
  const r = new R()
  r.lang = speechLang(lang)
  r.interimResults = true
  r.maxAlternatives = 1
  return r
}
