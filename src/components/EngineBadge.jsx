import { Sparkles } from 'lucide-react'
import { useApp } from '../AppContext'

// Which engine is answering: Claude through the HunarSetu API, or the built-in offline engine.
export default function EngineBadge() {
  const { backend, t } = useApp()
  const live = !!backend?.llm
  const name = backend?.providerLabel?.split(' (')[0]
  return (
    <span className={`engine-badge ${live ? 'is-live' : ''}`} title={live ? `${backend.providerLabel} · ${backend.model}` : t('engine.offlineHint')}>
      <Sparkles size={13} aria-hidden="true" />
      {live ? `${t('engine.live')} · ${name}` : t('engine.offline')}
    </span>
  )
}
