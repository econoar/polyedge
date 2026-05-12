import type { Activity, Position } from './polymarket'

export interface BotAnalysis {
  isDefiniteBot:    boolean
  exclusionReasons: string[]
  suspicionFlags:   string[]
  suspicionCount:   number
  humanConfidence:  'verified' | 'unverified' | 'likely-bot'
  scoreMultiplier:  number   // 1.0 normally, 0.8 if 2+ suspicion flags
}

function avgHoldHours(trades: Activity[]): number | null {
  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp)
  const buyQueue: Record<string, number[]> = {}
  const holds: number[] = []

  for (const t of sorted) {
    const key = `${t.slug}::${t.outcome}`
    if (t.side === 'BUY') {
      if (!buyQueue[key]) buyQueue[key] = []
      buyQueue[key].push(t.timestamp)
    } else if (t.side === 'SELL' && buyQueue[key]?.length) {
      holds.push((t.timestamp - buyQueue[key].shift()!) / 3600)
    }
  }
  return holds.length >= 5 ? holds.reduce((a, b) => a + b, 0) / holds.length : null
}

export function analyzeBotLikelihood(
  trades:    Activity[],
  profit:    number,
  volume:    number,
  positions: Position[] = [],
): BotAnalysis {
  const exclusionReasons: string[] = []
  const suspicionFlags:   string[] = []

  // ── Hard exclusions (require ≥20 trades for statistical validity) ─────────

  if (trades.length >= 20) {
    // 1. Avg hold time < 2h
    const avgHold = avgHoldHours(trades)
    if (avgHold !== null && avgHold < 2) {
      exclusionReasons.push(`Avg hold ${avgHold.toFixed(1)}h (min 2h)`)
    }

    // 2. Trade size CV < 5%
    const sizes = trades.map(t => t.usdcSize).filter(s => s > 0)
    if (sizes.length >= 20) {
      const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length
      const variance = sizes.reduce((s, x) => s + (x - mean) ** 2, 0) / sizes.length
      const cv = mean > 0 ? (Math.sqrt(variance) / mean) * 100 : 0
      if (cv < 5) exclusionReasons.push(`Trade size CV ${cv.toFixed(1)}% (min 5%)`)
    }

    // 3. 100+ trades in a single market
    const countBySlug: Record<string, number> = {}
    for (const t of trades) countBySlug[t.slug] = (countBySlug[t.slug] ?? 0) + 1
    const maxInMarket = Math.max(0, ...Object.values(countBySlug))
    if (maxInMarket >= 100) {
      exclusionReasons.push(`${maxInMarket} trades in one market`)
    }

    // 5. >20% trades within 10s of previous
    const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp)
    let rapid = 0
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].timestamp - sorted[i - 1].timestamp <= 10) rapid++
    }
    const rapidRate = rapid / (sorted.length - 1)
    if (rapidRate > 0.35) {
      exclusionReasons.push(`${(rapidRate * 100).toFixed(0)}% of trades within 10s`)
    }
  }

  // ── Suspicion flags ────────────────────────────────────────────────────────

  // 1. Win rate > 85% on open positions (proxy for resolved trade win rate)
  if (positions.length >= 20) {
    const winRate = positions.filter(p => p.cashPnl > 0).length / positions.length
    if (winRate > 0.85) {
      suspicionFlags.push(`Win rate ${(winRate * 100).toFixed(0)}% on ${positions.length} positions`)
    }
  }

  if (trades.length >= 20) {
    // 2. Avg trade size < $25
    const allSizes = trades.map(t => t.usdcSize)
    const avgSize = allSizes.reduce((a, b) => a + b, 0) / allSizes.length
    if (avgSize < 25) {
      suspicionFlags.push(`Avg trade $${avgSize.toFixed(0)} (min $25)`)
    }

    // 4. Trades clustered in < 4h/day consistently (bot scheduler pattern)
    const byDay: Record<string, number[]> = {}
    for (const t of trades) {
      const day = new Date(t.timestamp * 1000).toISOString().slice(0, 10)
      if (!byDay[day]) byDay[day] = []
      byDay[day].push(t.timestamp)
    }
    const tradingDays = Object.values(byDay).filter(ts => ts.length >= 3)
    if (tradingDays.length >= 5) {
      const clustered = tradingDays.filter(
        ts => (Math.max(...ts) - Math.min(...ts)) / 3600 < 4
      ).length
      if (clustered / tradingDays.length > 0.6) {
        suspicionFlags.push(`Clustered in < 4h/day on ${clustered}/${tradingDays.length} trading days`)
      }
    }
  }

  // 3. High volume with near-zero profit — wash trading signal
  if (volume > 100_000 && profit < 50) {
    suspicionFlags.push(`Vol $${Math.round(volume / 1000)}k with <$50 profit`)
  }

  const isDefiniteBot   = exclusionReasons.length > 0
  const suspicionCount  = suspicionFlags.length
  const scoreMultiplier = suspicionCount >= 2 ? 0.8 : 1.0

  let humanConfidence: 'verified' | 'unverified' | 'likely-bot'
  if (isDefiniteBot || suspicionCount >= 2) humanConfidence = 'likely-bot'
  else if (suspicionCount === 1)            humanConfidence = 'unverified'
  else                                      humanConfidence = 'verified'

  return { isDefiniteBot, exclusionReasons, suspicionFlags, suspicionCount, humanConfidence, scoreMultiplier }
}
