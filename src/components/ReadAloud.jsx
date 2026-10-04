import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX, Pointer, Mic, Users, X } from 'lucide-react'
import { useApp } from '../AppContext'
import { speak, stopSpeaking, canSpeak } from '../lib/speech'

// On/off switch: read each new answer aloud.
export function ReadAloudToggle({ compact = false }) {
  const { t, autoRead, setAutoRead } = useApp()
  if (!canSpeak()) return null
  return (
    <button
      type="button"
      className={`read-toggle ${autoRead ? 'is-on' : ''} ${compact ? 'is-compact' : ''}`}
      aria-pressed={autoRead}
      onClick={() => {
        if (autoRead) stopSpeaking()
        setAutoRead(!autoRead)
      }}
      title={t('read.auto')}
    >
      {autoRead ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
      <span>{t('read.auto')}</span>
      <span className="read-switch" aria-hidden="true" />
    </button>
  )
}

// Speaks the newest answer when "Read answers aloud" is on. Answers already on screen are not read.
export function useAutoRead(messages, isBot = (m) => m.from === 'bot') {
  const { autoRead, lang } = useApp()
  const seen = useRef(messages.length)
  useEffect(() => {
    const last = messages.at(-1)
    if (messages.length > seen.current && autoRead && last && isBot(last) && last.text) speak(last.text, last.lang ?? lang)
    seen.current = messages.length
  }, [messages.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopSpeaking(), [])
}

// Three pictures that show how to use the chat. Can be hidden; remembered on this device.
export function HowToUse() {
  const { t } = useApp()
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('hs.howto') !== 'hidden'
    } catch {
      return true
    }
  })
  const toggle = (v) => {
    setOpen(v)
    try {
      localStorage.setItem('hs.howto', v ? 'shown' : 'hidden')
    } catch {
      /* storage unavailable */
    }
  }
  if (!open)
    return (
      <button type="button" className="howto-show" onClick={() => toggle(true)}>
        <Pointer size={15} aria-hidden="true" /> {t('howto.show')}
      </button>
    )
  return (
    <div className="howto" role="note" aria-label={t('howto.title')}>
      <ol>
        {[
          [Users, t('howto.1')],
          [Mic, t('howto.2')],
          [Volume2, t('howto.3')],
        ].map(([I, text], i) => (
          <li key={i}>
            <span className="howto-pic">
              <I size={22} aria-hidden="true" />
              <b>{i + 1}</b>
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ol>
      <button type="button" className="howto-hide" onClick={() => toggle(false)} aria-label={t('howto.hide')} title={t('howto.hide')}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

// True once something has been busy for longer than ms (to explain a slow answer).
export function useSlow(busy, ms = 12000) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    setSlow(false)
    if (!busy) return
    const timer = setTimeout(() => setSlow(true), ms)
    return () => clearTimeout(timer)
  }, [busy, ms])
  return slow
}
