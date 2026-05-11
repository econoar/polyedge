'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type LeaderboardEntry, displayName, fmt$, fmtPct } from '@/lib/polymarket'

interface Props {
  entries: LeaderboardEntry[]
}

export default function LeaderboardTable({ entries }: Props) {
  const router = useRouter()

  return (
    <table className="lb-table">
      <thead>
        <tr>
          <th style={{ width: 40 }}>#</th>
          <th>Trader</th>
          <th className="right">Profit</th>
          <th className="right">ROI</th>
          <th className="right">Volume</th>
          <th className="right">Markets</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => {
          const name    = displayName(e)
          const initials = name.slice(0, 2).toUpperCase()
          const pnlClass = e.profit >= 0 ? 'pos' : 'neg'
          const roiClass = e.percentPnl >= 0 ? 'pos' : 'neg'

          return (
            <tr
              key={e.proxyWallet}
              onClick={() => router.push(`/trader/${e.proxyWallet}`)}
              style={{ cursor: 'pointer' }}
            >
              <td className={`rank ${i < 3 ? 'top' : ''}`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
              </td>
              <td>
                <Link href={`/trader/${e.proxyWallet}`} style={{ textDecoration: 'none' }}>
                  <div className="trader-cell">
                    {e.profileImage ? (
                      <img src={e.profileImage} alt={name} className="avatar" />
                    ) : (
                      <div className="avatar-placeholder">{initials}</div>
                    )}
                    <div>
                      <div className="trader-name">{name}</div>
                      <div className="trader-addr">{e.proxyWallet.slice(0, 6)}…{e.proxyWallet.slice(-4)}</div>
                    </div>
                  </div>
                </Link>
              </td>
              <td className={`right ${pnlClass}`}>{fmt$(e.profit)}</td>
              <td className={`right ${roiClass}`}>{fmtPct(e.percentPnl)}</td>
              <td className="right mono" style={{ color: 'var(--muted)' }}>{fmt$(e.volume)}</td>
              <td className="right mono" style={{ color: 'var(--muted)' }}>{e.marketsTraded ? e.marketsTraded.toLocaleString() : '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
