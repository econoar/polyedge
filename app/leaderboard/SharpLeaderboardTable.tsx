'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type SharpEntry, displayName, fmt$ } from '@/lib/polymarket'

interface Props {
  entries: SharpEntry[]
}

function badgeClass(score: number) {
  if (score >= 70) return 'sharp-high'
  if (score >= 50) return 'sharp-mid'
  return 'sharp-low'
}

export default function SharpLeaderboardTable({ entries }: Props) {
  const router = useRouter()

  return (
    <table className="lb-table">
      <thead>
        <tr>
          <th style={{ width: 40 }}>#</th>
          <th>Trader</th>
          <th className="right">Sharp Score</th>
          <th className="right">Win Rate</th>
          <th className="right">Positions</th>
          <th className="right">P&amp;L</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => {
          const name     = displayName(e.trader)
          const initials = name.slice(0, 2).toUpperCase()
          const winRate  = e.posCount > 0
            ? Math.round((e.sharp.repeatability / 25) * (Math.min(e.posCount, 8) / 8) * 100)
            : 0

          return (
            <tr
              key={e.trader.proxyWallet}
              onClick={() => router.push(`/trader/${e.trader.proxyWallet}`)}
              style={{ cursor: 'pointer' }}
            >
              <td className={`rank ${i < 3 ? 'top' : ''}`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
              </td>
              <td>
                <Link href={`/trader/${e.trader.proxyWallet}`} style={{ textDecoration: 'none' }}>
                  <div className="trader-cell">
                    {e.trader.profileImage ? (
                      <img src={e.trader.profileImage} alt={name} className="avatar" />
                    ) : (
                      <div className="avatar-placeholder">{initials}</div>
                    )}
                    <div>
                      <div className="trader-name">{name}</div>
                      <div className="trader-addr">{e.trader.proxyWallet.slice(0, 6)}…{e.trader.proxyWallet.slice(-4)}</div>
                    </div>
                  </div>
                </Link>
              </td>
              <td className="right">
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div className={`sharp-badge ${badgeClass(e.sharp.total)}`}>
                    <span className="sharp-badge-num">{e.sharp.total}</span>
                    <span className="sharp-badge-sub">/ 100</span>
                  </div>
                </div>
              </td>
              <td className="right mono" style={{ color: 'var(--muted)', fontSize: '12px' }}>
                {winRate}%
              </td>
              <td className="right mono" style={{ color: 'var(--muted2)', fontSize: '12px' }}>
                {e.posCount}
              </td>
              <td className={`right ${e.trader.profit >= 0 ? 'pos' : 'neg'}`}>
                {fmt$(e.trader.profit)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
