'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type LeaderboardEntry, type Position, type SharpScore, displayName, fmt$ } from '@/lib/polymarket'

interface Holder {
  trader:   LeaderboardEntry
  position: Position
  sharp:    SharpScore | null
}

function badgeClass(score: number) {
  if (score >= 70) return 'sharp-high'
  if (score >= 50) return 'sharp-mid'
  return 'sharp-low'
}

export default function MarketHoldersTable({ holders }: { holders: Holder[] }) {
  const router = useRouter()

  return (
    <table className="lb-table">
      <thead>
        <tr>
          <th>Trader</th>
          <th className="right">Outcome</th>
          <th className="right">Avg price</th>
          <th className="right">Value</th>
          <th className="right">P&amp;L</th>
        </tr>
      </thead>
      <tbody>
        {holders.map(({ trader, position, sharp }) => {
          const name     = displayName(trader)
          const initials = name.slice(0, 2).toUpperCase()
          return (
            <tr
              key={trader.proxyWallet}
              onClick={() => router.push(`/trader/${trader.proxyWallet}`)}
              style={{ cursor: 'pointer' }}
            >
              <td>
                <Link href={`/trader/${trader.proxyWallet}`} style={{ textDecoration: 'none' }}>
                  <div className="trader-cell">
                    {trader.profileImage
                      ? <img src={trader.profileImage} alt={name} className="avatar" />
                      : <div className="avatar-placeholder">{initials}</div>
                    }
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="trader-name">{name}</span>
                        {sharp && (
                          <span className={`sharp-badge-sm ${badgeClass(sharp.total)}`}>
                            {sharp.total}
                          </span>
                        )}
                      </div>
                      <div className="trader-addr">{trader.proxyWallet.slice(0, 6)}…{trader.proxyWallet.slice(-4)}</div>
                    </div>
                  </div>
                </Link>
              </td>
              <td className="right">
                <span className="outcome-tag">{position.outcome}</span>
              </td>
              <td className="right mono" style={{ color: 'var(--muted)' }}>
                {(position.avgPrice * 100).toFixed(0)}¢
                <span style={{ color: 'var(--muted2)', marginLeft: 4 }}>→</span>
                <span style={{ color: position.curPrice >= position.avgPrice ? 'var(--green)' : 'var(--red)', marginLeft: 4 }}>
                  {(position.curPrice * 100).toFixed(0)}¢
                </span>
              </td>
              <td className="right mono" style={{ color: 'var(--muted)' }}>
                {fmt$(position.currentValue)}
              </td>
              <td className={`right ${position.cashPnl >= 0 ? 'pos' : 'neg'}`}>
                {position.cashPnl >= 0 ? '+' : ''}{fmt$(position.cashPnl)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
