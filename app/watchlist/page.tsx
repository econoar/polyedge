'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { fmt$ } from '@/lib/polymarket'
import { getWatchlist, type WatchedTrader } from '@/app/components/WatchButton'

interface ActivityItem {
  proxyWallet:     string
  traderName:      string
  side:            string
  title:           string
  slug:            string
  outcome:         string
  usdcSize:        number
  price:           number
  timestamp:       number
  transactionHash: string
}

function timeAgo(ts: number) {
  const diff = Date.now() / 1000 - ts
  if (diff < 60)    return `${Math.floor(diff)}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

async function fetchActivity(trader: WatchedTrader): Promise<ActivityItem[]> {
  try {
    const r = await fetch(
      `https://data-api.polymarket.com/activity?user=${trader.wallet}&limit=20&type=TRADE`
    )
    if (!r.ok) return []
    const data = await r.json()
    return (data as any[]).map(a => ({
      proxyWallet:     trader.wallet,
      traderName:      trader.name,
      side:            a.side ?? 'BUY',
      title:           a.title ?? '',
      slug:            a.eventSlug ?? a.slug ?? '',
      outcome:         a.outcome ?? '',
      usdcSize:        Number(a.usdcSize ?? 0),
      price:           Number(a.price    ?? 0),
      timestamp:       Number(a.timestamp ?? 0),
      transactionHash: a.transactionHash ?? '',
    }))
  } catch {
    return []
  }
}

export default function WatchlistPage() {
  const [traders, setTraders]   = useState<WatchedTrader[]>([])
  const [feed, setFeed]         = useState<ActivityItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [mounted, setMounted]   = useState(false)

  useEffect(() => {
    setMounted(true)
    const list = getWatchlist()
    setTraders(list)
    if (list.length === 0) { setLoading(false); return }

    Promise.all(list.map(fetchActivity)).then(results => {
      const merged = results
        .flat()
        .sort((a, b) => b.timestamp - a.timestamp)
      setFeed(merged)
      setLoading(false)
    })
  }, [])

  if (!mounted) return null

  if (traders.length === 0) {
    return (
      <>
        <div className="page-header">
          <h1>Watchlist</h1>
          <p>Your followed traders</p>
        </div>
        <div className="empty" style={{ paddingTop: '5rem' }}>
          <div style={{ marginBottom: '12px', fontSize: '28px' }}>☆</div>
          <div>You're not watching any traders yet.</div>
          <div style={{ marginTop: '8px' }}>
            <Link href="/leaderboard" style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
              Browse the leaderboard →
            </Link>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Watchlist</h1>
          <p>Latest activity from {traders.length} watched trader{traders.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {traders.map(t => (
            <Link key={t.wallet} href={`/trader/${t.wallet}`} className="watch-chip">
              {t.name}
            </Link>
          ))}
        </div>
      </div>

      {loading && (
        <div className="empty">Loading activity…</div>
      )}

      {!loading && feed.length === 0 && (
        <div className="empty">No recent trades found for your watched traders.</div>
      )}

      {!loading && feed.length > 0 && (
        <div className="activity-list">
          {feed.map((a, i) => (
            <div key={`${a.proxyWallet}-${a.transactionHash}-${i}`} className="activity-row watchlist-row">
              <span className={`side-badge ${a.side === 'BUY' ? 'side-buy' : 'side-sell'}`}>
                {a.side}
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="activity-title">{a.title}</div>
                <div className="activity-outcome">
                  {a.outcome}
                  <span style={{ marginLeft: 8, color: 'var(--muted2)' }}>·</span>
                  <Link href={`/trader/${a.proxyWallet}`} className="watchlist-trader-link">
                    {a.traderName}
                  </Link>
                </div>
              </div>
              <div className="activity-size">
                <div className="mono" style={{ fontSize: '12px' }}>{fmt$(a.usdcSize)}</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                  @ {(a.price * 100).toFixed(0)}¢
                </div>
              </div>
              <div className="activity-time">{timeAgo(a.timestamp)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
