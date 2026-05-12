'use client'

import { useState } from 'react'
import { type ClosedTrade, type Position, type Activity, fmt$ } from '@/lib/polymarket'

type Tab = 'closed' | 'open' | 'recent'

function timeAgo(ts: number) {
  const diff = Date.now() / 1000 - ts
  if (diff < 60)    return `${Math.floor(diff)}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function TraderTabs({
  closedTrades,
  positions,
  activity,
}: {
  closedTrades: ClosedTrade[]
  positions:    Position[]
  activity:     Activity[]
}) {
  const [tab, setTab] = useState<Tab>('closed')

  return (
    <div style={{ marginTop: '2rem' }}>
      <div className="tabs">
        <button className={`tab ${tab === 'closed' ? 'active' : ''}`} onClick={() => setTab('closed')}>
          Closed Trades{closedTrades.length > 0 ? ` (${closedTrades.length})` : ''}
        </button>
        <button className={`tab ${tab === 'open' ? 'active' : ''}`} onClick={() => setTab('open')}>
          Open Positions{positions.length > 0 ? ` (${positions.length})` : ''}
        </button>
        <button className={`tab ${tab === 'recent' ? 'active' : ''}`} onClick={() => setTab('recent')}>
          Recent Trades
        </button>
      </div>

      {tab === 'closed' && (
        closedTrades.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No closed trades found in recent history.</p>
        ) : (
          <div className="pos-list">
            {closedTrades.map((w, i) => (
              <a
                key={i}
                href={`https://polymarket.com/event/${w.slug}`}
                target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <div className="pos-card">
                  {w.icon ? <img src={w.icon} alt="" className="pos-icon" /> : <div className="pos-icon-ph" />}
                  <div>
                    <div className="pos-title">{w.title}</div>
                    <div className="pos-meta">
                      {w.outcome} · {(w.buyPrice * 100).toFixed(0)}¢ → {w.sellPrice >= 0.99 ? '$1 resolved' : `${(w.sellPrice * 100).toFixed(0)}¢`}
                    </div>
                  </div>
                  <div className="pos-right">
                    <div className={`pos-pnl ${w.profit >= 0 ? 'pos' : 'neg'}`}>
                      {w.profit >= 0 ? '+' : ''}{fmt$(w.profit)}
                    </div>
                    <div className="pos-val" style={{ color: w.roi >= 0 ? 'var(--muted)' : 'var(--red)' }}>
                      {w.roi >= 0 ? '+' : ''}{(w.roi * 100).toFixed(0)}% ROI
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )
      )}

      {tab === 'open' && (
        positions.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No open positions.</p>
        ) : (
          <div className="pos-list">
            {positions.map((p, i) => (
              <a
                key={i}
                href={`https://polymarket.com/event/${p.slug}`}
                target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <div className="pos-card">
                  {p.icon ? <img src={p.icon} alt="" className="pos-icon" /> : <div className="pos-icon-ph" />}
                  <div>
                    <div className="pos-title">{p.title}</div>
                    <div className="pos-meta">
                      {p.outcome} · avg {(p.avgPrice * 100).toFixed(0)}¢ → {(p.curPrice * 100).toFixed(0)}¢ now
                    </div>
                  </div>
                  <div className="pos-right">
                    <div className={`pos-pnl ${p.cashPnl >= 0 ? 'pos' : 'neg'}`}>
                      {p.cashPnl >= 0 ? '+' : ''}{fmt$(p.cashPnl)}
                    </div>
                    <div className="pos-val">{fmt$(p.currentValue)} value</div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )
      )}

      {tab === 'recent' && (
        activity.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No recent activity.</p>
        ) : (
          <div className="activity-list">
            {activity.map((a, i) => (
              <div className="activity-row" key={i}>
                <span className={`side-badge ${a.side === 'BUY' ? 'side-buy' : 'side-sell'}`}>
                  {a.side}
                </span>
                <div>
                  <div className="activity-title">{a.title}</div>
                  <div className="activity-outcome">{a.outcome}</div>
                </div>
                <div className="activity-size">
                  <div className="mono" style={{ fontSize: '12px' }}>{fmt$(a.usdcSize || a.size * a.price)}</div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                    @ {(a.price * 100).toFixed(0)}¢
                  </div>
                </div>
                <div className="activity-time">{timeAgo(a.timestamp)}</div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
