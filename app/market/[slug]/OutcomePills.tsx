'use client'

import { useState } from 'react'

interface Props {
  subMarkets: any[]
}

interface Outcome {
  key:   string
  name:  string
  price: number
}

const SHOW_COUNT = 3

export default function OutcomePills({ subMarkets }: Props) {
  const [expanded, setExpanded] = useState(false)

  // Flatten, filter zero-value, sort by price desc
  const all: Outcome[] = []
  for (const sm of subMarkets) {
    const prices: number[]  = JSON.parse(sm.outcomePrices ?? '[]')
    const names:  string[]  = JSON.parse(sm.outcomes     ?? '[]')
    names.forEach((name, i) => {
      const price = Number(prices[i] ?? 0)
      if (price > 0.01) all.push({ key: `${sm.id}-${i}`, name, price })
    })
  }
  all.sort((a, b) => b.price - a.price)

  if (all.length === 0) return null

  const needsCollapse = all.length > SHOW_COUNT + 1  // only collapse if it saves space
  const visible = needsCollapse && !expanded ? all.slice(0, SHOW_COUNT) : all

  return (
    <div className="market-outcomes">
      {visible.map(o => (
        <div key={o.key} className="outcome-chip">
          <span className="outcome-name">{o.name}</span>
          <span className="outcome-price" style={{
            color: o.price > 0.7 ? 'var(--green)' : o.price < 0.3 ? 'var(--red)' : 'var(--text)'
          }}>{(o.price * 100).toFixed(0)}¢</span>
        </div>
      ))}
      {needsCollapse && (
        <button className="outcome-toggle" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Show less' : `+${all.length - SHOW_COUNT} more`}
        </button>
      )}
    </div>
  )
}
