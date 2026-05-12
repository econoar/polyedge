'use client'

import { useState } from 'react'
import { type ClosedTrade, type Position, type Activity, fmt$ } from '@/lib/polymarket'

type Tab = 'wins' | 'losses' | 'open' | 'recent'

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
  totalProfit,
}: {
  closedTrades: ClosedTrade[]
  positions:    Position[]
  activity:     Activity[]
  totalProfit:  number
}) {
  const [tab, setTab] = useState<Tab>('wins')

  const wins   = closedTrades.filter(t => t.profit >= 0)
  const losses = closedTrades.filter(t => t.profit <  0)

  return (
    <div style={{ marginTop: '2rem' }}>
      <div className="tabs">
        <button className={`tab ${tab === 'wins' ? 'active' : ''}`} onClick={() => setTab('wins')}>
          Closed Wins{wins.length > 0 ? ` (${wins.length})` : ''}
        </button>
        <button className={`tab ${tab === 'losses' ? 'active' : ''}`} onClick={() => setTab('losses')}>
          Closed Losses{losses.length > 0 ? ` (${losses.length})` : ''}
        </button>
        <button className={`tab ${tab === 'open' ? 'active' : ''}`} onClick={() => setTab('open')}>
          Open Positions{positions.length > 0 ? ` (${positions.length})` : ''}
        </button>
        <button className={`tab ${tab === 'recent' ? 'active' : ''}`} onClick={() => setTab('recent')}>
          Recent Trades
        </button>
      </div>

      {tab === 'losses' && (() => {
        const trackedLoss   = losses.reduce((s, t) => s + t.profit, 0)
        const trackedWin    = wins.reduce((s, t) => s + t.profit, 0)
        const impliedLoss   = totalProfit - trackedWin - trackedLoss
        return (
          <>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: '1rem', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.6 }}>
              When a position expires worthless (held YES, market resolved NO), Polymarket emits no activity event — the shares silently disappear.
              Only early-exit losses (BUY→SELL below entry) are visible here.
              {impliedLoss < -500 && (
                <span style={{ display: 'block', marginTop: 4, color: 'var(--red)' }}>
                  Implied untracked losses: {fmt$(impliedLoss)} (total P&L minus tracked wins/losses)
                </span>
              )}
            </div>
            {losses.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No early-exit losses found in tracked history.</p>
            ) : (
              <div className="pos-list">
                {losses.map((w, i) => (
                  <a key={i} href={`https://polymarket.com/event/${w.slug}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                    <div className="pos-card">
                      {w.icon ? <img src={w.icon} alt="" className="pos-icon" /> : <div className="pos-icon-ph" />}
                      <div>
                        <div className="pos-title">{w.title}</div>
                        <div className="pos-meta">{w.outcome} · {(w.buyPrice * 100).toFixed(0)}¢ → {(w.sellPrice * 100).toFixed(0)}¢</div>
                      </div>
                      <div className="pos-right">
                        <div className="pos-pnl neg">{fmt$(w.profit)}</div>
                        <div className="pos-val" style={{ color: 'var(--red)' }}>{(w.roi * 100).toFixed(0)}% ROI</div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </>
        )
      })()}

      {tab === 'wins' && (() => {
        const rows = wins
        return rows.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No winning closed trades found.</p>
        ) : (
          <div className="pos-list">
            {rows.map((w, i) => (
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
                      {w.outcome} · {(w.buyPrice * 100).toFixed(0)}¢ →{' '}
                      {w.exitType === 'redeem' ? '$1 resolved' : w.exitType === 'expired' ? 'expired worthless' : `${(w.sellPrice * 100).toFixed(0)}¢`}
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
      })()}

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
