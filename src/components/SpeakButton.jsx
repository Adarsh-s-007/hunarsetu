import { useEffect, useState } from 'react'
import { Volume2, Square } from 'lucide-react'
import { useApp } from '../AppContext'
import { speak, stopSpeaking, canSpeak } from '../lib/speech'

// Read-aloud for low-literacy users. Every bot reply and setup question has one.
export default function SpeakButton({ text, label = true, className = '' }) {
  const { lang, t } = useApp()
  const [on, setOn] = useState(false)
  useEffect(() => () => {
    if (on) stopSpeaking()
  }, [on])
  if (!canSpeak()) return null
  const toggle = () => {
    if (on) {
      stopSpeaking()
      setOn(false)
    } else {
      setOn(true)
      speak(text, lang, () => setOn(false))
    }
  }
  return (
    <button type="button" className={`speak-btn ${on ? 'is-on' : ''} ${className}`} onClick={toggle} aria-label={on ? t('c.stop') : t('c.listen')}>
      {on ? <Square size={14} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
      {label && <span>{on ? t('c.stop') : t('c.listen')}</span>}
    </button>
  )
}
