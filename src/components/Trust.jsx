import { BadgeCheck, Building, Calculator } from 'lucide-react'
import { useApp } from '../AppContext'

const ICONS = { verified: BadgeCheck, provider: Building, estimated: Calculator }

export function TrustBadge({ kind, small = false }) {
  const { t } = useApp()
  const I = ICONS[kind] ?? Calculator
  return (
    <span className={`trust trust-${kind} ${small ? 'trust-sm' : ''}`}>
      <I size={small ? 12 : 14} aria-hidden="true" />
      {t(`trust.${kind}`)}
    </span>
  )
}

// One number, where it came from, and how much to trust it.
export function EvidenceCard({ item }) {
  const { L } = useApp()
  return (
    <div className={`evidence evidence-${item.badge}`} title={`${item.source} · ${item.date}`}>
      <div className="evidence-label">{L(item.label)}</div>
      <div className="evidence-value">{item.value}</div>
      <div className="evidence-meta">
        <TrustBadge kind={item.badge} small />
      </div>
    </div>
  )
}

export function DemoNote({ className = '' }) {
  const { t } = useApp()
  return <p className={`demo-note ${className}`}>{t('c.demo')}</p>
}
