'use client'

import { useState, useEffect } from 'react'
import { fmt$ } from '@/lib/polymarket'

type Point = { t: number; p: number }
type Interval = '1d' | '1w' | '1m' | 'all'

const INTERVALS: { key: Interval; label: string; fidelity: string }[] = [
  { key: '1d',  label: '24h', fidelity: '1h' },
  { key: '1w',  label: '7d',  fidelity: '1h' },
  { key: '1m',  label: '30d', fidelity: '1d' },
  { key: 'all', label: 'All', fidelity: '1d' },
]

const W = 600, H = 130
const PAD = { top: 12, right: 8, bottom: 28, left: 12 }
const CW = W - PAD.left - PAD.right
const CH = H - PAD.top - PAD.bottom

function buildPaths(data: Point[]) {
  if (data.length < 2) return null
  const minT = data[0].t, maxT = data[data.length - 1].t
  const ps    = data.map(d => d.p)
  const minP  = Math.min(0, ...ps)
  const maxP  = Math.max(0, ...ps)
  const range = maxP - minP || 1

  const x = (t: number) => PAD.left + ((t - minT) / (maxT - minT || 1)) * CW
  const y = (p: number) => PAD.top  + CH - ((p - minP) / range) * CH
  const y0 = y(0)

  const pts = data.map(d => [x(d.t), y(d.p)] as [number, number])
  const line = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length-1][0].toFixed(1)},${y0.toFixed(1)} L${pts[0][0].toFixed(1)},${y0.toFixed(1)} Z`

  // x-axis date labels (3 evenly spaced)
  const ticks = [0, Math.floor(data.length / 2), data.length - 1].map(i => ({
    x: x(data[i].t),
    label: new Date(data[i].t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  const last = data[data.length - 1].p
  return { line, area, y0, y0pct: ((y0 - PAD.top) / CH) * 100, last, ticks, positive: last >= 0 }
}

export default function PnlChart({ wallet }: { wallet: string }) {
  const [interval, setInterval] = useState<Interval>('all')
  const [data, setData]         = useState<Point[] | null>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    setData(null)
    const { fidelity } = INTERVALS.find(i => i.key === interval)!
    fetch(`https://user-pnl-api.polymarket.com/user-pnl?user_address=${wallet}&interval=${interval}&fidelity=${fidelity}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { setData([]); setLoading(false) })
  }, [wallet, interval])

  const chart = data && data.length >= 2 ? buildPaths(data) : null
  const color = chart ? (chart.positive ? 'var(--green)' : 'var(--red)') : 'var(--muted)'
  const fillId = `pnl-fill-${wallet.slice(2, 8)}`

  return (
    <div className="pnl-chart-wrap">
      <div className="pnl-chart-header">
        <span className="section-title" style={{ border: 'none', padding: 0, margin: 0 }}>PnL chart</span>
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
          {INTERVALS.map(iv => (
            <button
              key={iv.key}
              className={`tab ${interval === iv.key ? 'active' : ''}`}
              onClick={() => setInterval(iv.key)}
            >{iv.label}</button>
          ))}
        </div>
      </div>

      <div className="pnl-chart-body">
        {loading && <div className="pnl-loading">Loading…</div>}

        {!loading && !chart && (
          <div className="pnl-loading">No chart data available</div>
        )}

        {chart && (
          <>
            <div className="pnl-current" style={{ color }}>
              {chart.positive ? '+' : ''}{fmt$(chart.last)}
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="pnl-svg">
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* zero line */}
              <line
                x1={PAD.left} y1={chart.y0} x2={W - PAD.right} y2={chart.y0}
                stroke="var(--border2)" strokeWidth="1" strokeDasharray="3 3"
              />

              {/* area fill */}
              <path d={chart.area} fill={`url(#${fillId})`} />

              {/* line */}
              <path d={chart.line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />

              {/* x-axis labels */}
              {chart.ticks.map((tk, i) => (
                <text
                  key={i} x={tk.x} y={H - 4}
                  textAnchor={i === 0 ? 'start' : i === chart.ticks.length - 1 ? 'end' : 'middle'}
                  fill="var(--muted2)" fontSize="9" fontFamily="var(--font-mono)"
                >{tk.label}</text>
              ))}
            </svg>
          </>
        )}
      </div>
    </div>
  )
}
