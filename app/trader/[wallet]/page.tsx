import Link from 'next/link'
import { getProfile, getPositions, getActivity, computeSharpScore, displayName, fmt$, fmtPct } from '@/lib/polymarket'
import { notFound } from 'next/navigation'
import WatchButton from '@/app/components/WatchButton'
import PnlChart from './PnlChart'
import SharpBreakdown from './SharpBreakdown'

export const revalidate = 60

type Props = { params: { wallet: string } }

function timeAgo(ts: number) {
  const diff = Date.now() / 1000 - ts
  if (diff < 60)    return `${Math.floor(diff)}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function tweetUrl(name: string, profit: number) {
  const dir  = profit >= 0 ? 'up' : 'down'
  const amt  = fmt$(Math.abs(profit))
  const text = `${name} is ${dir} ${amt} all-time on @Polymarket. Track the sharpest traders at polyedge.xyz`
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
}

export default async function TraderPage({ params }: Props) {
  const { wallet } = params

  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) notFound()

  const [profile, positions, activity] = await Promise.allSettled([
    getProfile(wallet),
    getPositions(wallet),
    getActivity(wallet, 30),
  ])

  if (profile.status === 'rejected') {
    return (
      <div>
        <Link href="/leaderboard" className="back">← Leaderboard</Link>
        <div className="error-box">Could not load trader: {String(profile.reason)}</div>
      </div>
    )
  }

  const p   = profile.value
  const pos = positions.status === 'fulfilled' ? positions.value : []
  const act = activity.status  === 'fulfilled' ? activity.value  : []
  const name = displayName(p)

  const sharp = computeSharpScore(pos)

  // Position accuracy: % of open positions currently profitable
  const profitablePos = pos.filter(px => px.cashPnl > 0).length
  const posAccuracy   = pos.length > 0 ? (profitablePos / pos.length) * 100 : null

  return (
    <>
      <Link href="/leaderboard" className="back">← Sharp List</Link>

      {/* Profile header */}
      <div className="profile-header">
        {p.profileImage ? (
          <img src={p.profileImage} alt={name} className="profile-avatar" />
        ) : (
          <div className="profile-avatar-ph">{name.slice(0,2).toUpperCase()}</div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div className="profile-name">{name}</div>
              <div className="profile-addr">{wallet}</div>
              {p.bio && <div className="profile-bio">{p.bio}</div>}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <WatchButton wallet={wallet} name={name} />
              <a
                href={tweetUrl(name, p.profit)}
                target="_blank" rel="noopener noreferrer"
                className="share-btn"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Share
              </a>
            </div>
          </div>
          <div className="verified-badge" style={{ marginTop: '8px' }}>✓ on-chain verified · Polygon</div>
        </div>
      </div>

      {/* Sharp Score hero */}
      {sharp ? (
        <SharpBreakdown sharp={sharp} posCount={pos.length} />
      ) : (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>Sharp Score</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--muted2)' }}>Not enough open positions to compute — check back when this trader has active positions.</div>
        </div>
      )}

      {/* Stat cards */}
      <div className="stat-grid">
        {[
          { label: 'Total profit',  value: fmt$(p.profit),       cls: p.profit >= 0 ? 'pos' : 'neg' },
          { label: 'ROI',           value: fmtPct(p.percentPnl), cls: p.percentPnl >= 0 ? 'pos' : 'neg' },
          { label: 'Volume',        value: fmt$(p.volume),       cls: '' },
          { label: 'Markets',       value: p.marketsTraded.toLocaleString(), cls: '' },
          ...(posAccuracy !== null ? [{
            label: 'Position accuracy',
            value: `${posAccuracy.toFixed(0)}%`,
            cls:   posAccuracy >= 50 ? 'pos' : 'neg',
          }] : []),
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* PnL chart */}
      <PnlChart wallet={wallet} />

      {/* Open positions */}
      <div className="section-title" style={{ marginTop: '2rem' }}>Open positions ({pos.length})</div>
      {pos.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '2.5rem' }}>No open positions.</p>
      ) : (
        <div className="pos-list">
          {pos.map((position, i) => (
            <a
              key={i}
              href={`https://polymarket.com/event/${position.slug}`}
              target="_blank" rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <div className="pos-card">
                {position.icon ? (
                  <img src={position.icon} alt="" className="pos-icon" />
                ) : (
                  <div className="pos-icon-ph" />
                )}
                <div>
                  <div className="pos-title">{position.title}</div>
                  <div className="pos-meta">
                    {position.outcome} · avg {(position.avgPrice * 100).toFixed(0)}¢ → {(position.curPrice * 100).toFixed(0)}¢ now
                  </div>
                </div>
                <div className="pos-right">
                  <div className={`pos-pnl ${position.cashPnl >= 0 ? 'pos' : 'neg'}`}>
                    {position.cashPnl >= 0 ? '+' : ''}{fmt$(position.cashPnl)}
                  </div>
                  <div className="pos-val">{fmt$(position.currentValue)} value</div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Trade activity */}
      <div className="section-title">Recent trades ({act.length})</div>
      {act.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '13px' }}>No recent activity.</p>
      ) : (
        <div className="activity-list">
          {act.map((a, i) => (
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
                <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>@ {(a.price * 100).toFixed(0)}¢</div>
              </div>
              <div className="activity-time">{timeAgo(a.timestamp)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
