import { useEffect, useMemo, useRef, useState } from 'react'
import { inr } from '../lib/format'

function useWidth(ref, fallback = 720) {
  const [w, setW] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el || !('ResizeObserver' in window)) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

function niceTicks(min, max, count = 5) {
  const span = max - min || 1
  const step0 = span / count
  const mag = Math.pow(10, Math.floor(Math.log10(step0)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? mag * 10
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const out = []
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v))
  return out
}

const compact = (v) => `${v < 0 ? '−' : ''}₹${Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1)}k` : Math.round(Math.abs(v))}`

/**
 * Stepped line chart (values are monthly, constant within a year) with a crosshair tooltip,
 * legend, selective end labels and a table fallback.
 * series: [{ key, label, color, values: number[] }]
 */
export default function LineChart({ series, height = 320, xLabel = (i) => `Month ${i + 1}`, yearTicks = true, yearLabel = 'Year', ariaLabel }) {
  const wrapRef = useRef(null)
  const width = useWidth(wrapRef)
  const [hover, setHover] = useState(null)
  const n = series[0]?.values.length ?? 0
  const m = { top: 16, right: 96, bottom: 34, left: 56 }
  const iw = width - m.left - m.right
  const ih = height - m.top - m.bottom

  const all = series.flatMap((s) => s.values)
  const ticks = useMemo(() => niceTicks(Math.min(0, ...all), Math.max(...all)), [all])
  const y0 = ticks[0]
  const y1 = ticks.at(-1)
  const x = (i) => m.left + (i / Math.max(1, n)) * iw
  const y = (v) => m.top + ih - ((v - y0) / (y1 - y0)) * ih

  const path = (vals) => {
    let d = `M${x(0)},${y(vals[0])}`
    for (let i = 1; i < vals.length; i++) d += ` H${x(i)} V${y(vals[i])}`
    return d + ` H${x(vals.length)}`
  }

  // End labels: only when they don't collide; otherwise legend + tooltip carry identity.
  const ends = series.map((s) => ({ key: s.key, label: s.label, y: y(s.values.at(-1)), color: s.color })).sort((a, b) => a.y - b.y)
  const collide = ends.some((e, i) => i > 0 && e.y - ends[i - 1].y < 16)

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * width
    const i = Math.max(0, Math.min(n - 1, Math.floor(((px - m.left) / iw) * n)))
    setHover(i)
  }
  const onKey = (e) => {
    if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? -1) + 1))
    else if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n) - 1))
    else if (e.key === 'Escape') setHover(null)
  }

  const tipLeft = hover == null ? 0 : x(hover + 0.5)
  const flip = tipLeft > width - 220

  return (
    <div className="chart" ref={wrapRef}>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.key}>
            <span className="legend-line" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="chart-plot">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={m.left} x2={m.left + iw} y1={y(v)} y2={y(v)} className={v === 0 ? 'axis-base' : 'grid'} />
              <text x={m.left - 8} y={y(v)} className="tick" textAnchor="end" dominantBaseline="middle">
                {compact(v)}
              </text>
            </g>
          ))}
          {yearTicks &&
            Array.from({ length: Math.floor(n / 12) }, (_, k) => (
              <g key={k}>
                {k > 0 && <line x1={x(k * 12)} x2={x(k * 12)} y1={m.top} y2={m.top + ih} className="grid" />}
                <text x={x(k * 12 + 6)} y={height - 10} className="tick" textAnchor="middle">
                  {yearLabel} {k + 1}
                </text>
              </g>
            ))}
          {series.map((s) => (
            <path key={s.key} d={path(s.values)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {series.map((s) => (
            <circle key={s.key} cx={x(n)} cy={y(s.values.at(-1))} r="4.5" fill={s.color} stroke="var(--chart-surface)" strokeWidth="2" />
          ))}
          {!collide &&
            ends.map((e) => (
              <text key={e.key} x={x(n) + 10} y={e.y} className="end-label" dominantBaseline="middle">
                {compact(series.find((s) => s.key === e.key).values.at(-1))}
              </text>
            ))}
          {hover != null && (
            <g>
              <line x1={x(hover + 0.5)} x2={x(hover + 0.5)} y1={m.top} y2={m.top + ih} className="crosshair" />
              {series.map((s) => (
                <circle key={s.key} cx={x(hover + 0.5)} cy={y(s.values[hover])} r="4.5" fill={s.color} stroke="var(--chart-surface)" strokeWidth="2" />
              ))}
            </g>
          )}
        </svg>
        {hover != null && (
          <div className="chart-tip" style={{ left: flip ? tipLeft - 12 : tipLeft + 12, transform: flip ? 'translateX(-100%)' : 'none' }}>
            <div className="chart-tip-title">{xLabel(hover)}</div>
            {series.map((s) => (
              <div key={s.key} className="chart-tip-row">
                <span className="legend-line" style={{ background: s.color }} />
                <strong>{inr(s.values[hover])}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
