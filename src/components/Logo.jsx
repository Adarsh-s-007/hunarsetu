// Bridge arch (setu) over three pillars, with a spark of skill (hunar).
export default function Logo({ size = 40, light = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill={light ? '#ffffff' : '#0E3B3C'} />
      <path d="M10 44c6-14 14-21 22-21s16 7 22 21" fill="none" stroke="#F2A23A" strokeWidth="5" strokeLinecap="round" />
      <path d="M18 44V34M32 44V27M46 44V34" stroke={light ? '#0E3B3C' : '#ffffff'} strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="15" r="4" fill="#F2A23A" />
    </svg>
  )
}

export function Wordmark({ light = false }) {
  return (
    <span className={`wordmark ${light ? 'is-light' : ''}`}>
      <Logo size={38} />
      <span className="wordmark-text">
        <span className="wordmark-name">HunarSetu</span>
        <span className="wordmark-sub">हुनरसेतु · హునర్‌సేతు</span>
      </span>
    </span>
  )
}
