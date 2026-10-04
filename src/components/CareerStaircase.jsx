import { useApp } from '../AppContext'
import { getDistrict } from '../data/districts'
import { inrRange } from '../lib/format'
import { TrustBadge } from './Trust'

const round500 = (n) => Math.round(n / 500) * 500
const LEVEL = { en: 'Level', hi: 'स्तर', te: 'స్థాయి' }
const NOTE = {
  en: 'Pay for later steps is an estimate from government wage surveys for your district.',
  hi: 'आगे के कदमों का वेतन आपके ज़िले के सरकारी वेतन सर्वे से अनुमानित है।',
  te: 'తర్వాతి దశల జీతం మీ జిల్లా ప్రభుత్వ జీత సర్వేల నుండి అంచనా.',
}

// Qualification → job → pay → next step, drawn as rising steps.
export default function CareerStaircase({ trade, districtId, compact = false }) {
  const { L } = useApp()
  const w = getDistrict(districtId).wage
  const steps = trade.staircase
  return (
    <div className={`staircase ${compact ? 'is-compact' : ''}`}>
      <ol className="staircase-steps">
        {steps.map((s, i) => (
          <li key={i} className="stair" style={{ '--i': i, '--n': steps.length }}>
            <div className="stair-card">
              <div className="stair-top">
                <span className="stair-level">{L(LEVEL)} {s.nsqf}</span>
                <span className="stair-time">{s.time}</span>
              </div>
              <div className="stair-title">{s.title}</div>
              <div className="stair-role">{s.role}</div>
              <div className="stair-pay">
                {inrRange(round500(s.pay[0] * w), round500(s.pay[1] * w))}
                <small>{s.stipend ? ' stipend' : ''} / month</small>
              </div>
            </div>
            <div className="stair-block" aria-hidden="true">
              <span>{i + 1}</span>
            </div>
          </li>
        ))}
      </ol>
      {!compact && (
        <div className="staircase-foot">
          <TrustBadge kind="estimated" small />
          <span>{L(NOTE)}</span>
        </div>
      )}
    </div>
  )
}
