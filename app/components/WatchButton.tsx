'use client'

import { useState, useEffect } from 'react'

interface Props {
  wallet:   string
  name:     string
}

export interface WatchedTrader {
  wallet:  string
  name:    string
  addedAt: number
}

const KEY = 'polyedge-watchlist'

export function getWatchlist(): WatchedTrader[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function isWatched(wallet: string): boolean {
  return getWatchlist().some(w => w.wallet === wallet)
}

export default function WatchButton({ wallet, name }: Props) {
  const [watching, setWatching] = useState(false)

  useEffect(() => {
    setWatching(isWatched(wallet))
  }, [wallet])

  function toggle() {
    const list = getWatchlist()
    let next: WatchedTrader[]
    if (watching) {
      next = list.filter(w => w.wallet !== wallet)
    } else {
      next = [...list, { wallet, name, addedAt: Date.now() }]
    }
    localStorage.setItem(KEY, JSON.stringify(next))
    setWatching(!watching)
  }

  return (
    <button onClick={toggle} className={`watch-btn ${watching ? 'watch-btn-active' : ''}`} title={watching ? 'Unwatch trader' : 'Watch trader'}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill={watching ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
      {watching ? 'Watching' : 'Watch'}
    </button>
  )
}
