import { type SharpScore } from '@/lib/polymarket'

interface Props {
  sharp:    SharpScore
  posCount: number
}

function scoreColor(score: number) {
  if (score >= 70) return 'var(--green)'
  if (score >= 50) return 'var(--amber)'
  return 'var(--muted)'
}

const COMPONENTS = [
  { key: 'entryTiming',        label: 'Entry Timing',        tip: 'Entered before the market moved in their favor' },
  { key: 'contrarianAccuracy', label: 'Contrarian Accuracy', tip: 'Low-probability bets (<45¢) that are currently winning' },
  { key: 'repeatability',      label: 'Repeatability',       tip: 'Win rate across multiple markets' },
  { key: 'stakeSizing',        label: 'Stake Sizing',        tip: 'Bigger positions are the better-performing ones' },
] as const

export default function SharpBreakdown({ sharp, posCount }: Props) {
  const color = scoreColor(sharp.total)

  return (
    <div className="sharp-hero">
      <div className="sharp-score-block">
        <div className="section-title" style={{ border: 'none', padding: 0, marginBottom: '8px' }}>Sharp Score</div>
        <div className="sharp-score-num" style={{ color }}>{sharp.total}</div>
        <div className="sharp-score-denom">out of 100</div>
        <div className="sharp-score-note">{posCount} open position{posCount !== 1 ? 's' : ''}</div>
      </div>

      <div className="sharp-bars">
        {COMPONENTS.map(c => {
          const val = sharp[c.key]
          return (
            <div key={c.key} className="sharp-bar-row" title={c.tip}>
              <div className="sharp-bar-label">{c.label}</div>
              <div className="sharp-bar-track">
                <div className="sharp-bar-fill" style={{ width: `${(val / 25) * 100}%` }} />
              </div>
              <div className="sharp-bar-val">{val}/25</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
