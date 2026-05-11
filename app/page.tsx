import Link from 'next/link'
import { getSharpLeaderboard, displayName, fmt$ } from '@/lib/polymarket'

export const revalidate = 60

function badgeClass(score: number) {
  if (score >= 70) return 'sharp-high'
  if (score >= 50) return 'sharp-mid'
  return 'sharp-low'
}

export default async function Home() {
  let topSharp: Awaited<ReturnType<typeof getSharpLeaderboard>>['qualified'] = []
  try {
    const { qualified } = await getSharpLeaderboard('all', 20)
    topSharp = qualified.slice(0, 5)
  } catch {}

  return (
    <>
      <div className="hero">
        <div className="hero-tag">// prediction market intelligence</div>
        <h1>PnL shows who got lucky.<br /><span>Sharp Score</span> shows who knows.</h1>
        <p>
          We score every trader on entry timing, contrarian accuracy, repeatability,
          and stake sizing — not just how much they made.
        </p>
        <div className="hero-actions">
          <Link href="/leaderboard" className="btn btn-primary">View Sharp List →</Link>
          <Link href="/hot" className="btn btn-secondary">Hot right now</Link>
        </div>
      </div>

      {/* Live top-5 preview */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div className="section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>Top 5 by Sharp Score · all time</div>
          <Link href="/leaderboard" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', textDecoration: 'none', letterSpacing: '0.05em' }}>
            Full Sharp List →
          </Link>
        </div>
        <div className="home-lb-preview">
          {topSharp.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>Loading…</div>
          ) : topSharp.map((e, i) => {
            const name     = displayName(e.trader)
            const initials = name.slice(0, 2).toUpperCase()
            const medals   = ['🥇', '🥈', '🥉']

            return (
              <Link key={e.trader.proxyWallet} href={`/trader/${e.trader.proxyWallet}`} className="home-lb-row">
                <span className="home-lb-rank">{medals[i] ?? i + 1}</span>
                <span className="home-lb-avatar">
                  {e.trader.profileImage
                    ? <img src={e.trader.profileImage} alt={name} className="avatar" style={{ width: 28, height: 28 }} />
                    : <span className="avatar-placeholder" style={{ width: 28, height: 28, fontSize: '10px' }}>{initials}</span>
                  }
                </span>
                <span className="home-lb-name">{name}</span>
                <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <span className={`sharp-badge ${badgeClass(e.sharp.total)}`} style={{ width: 44, height: 44 }}>
                    <span className="sharp-badge-num" style={{ fontSize: '18px' }}>{e.sharp.total}</span>
                    <span className="sharp-badge-sub">sharp</span>
                  </span>
                </span>
                <span className={`home-lb-roi ${e.trader.profit >= 0 ? 'pos' : 'neg'}`}>{fmt$(e.trader.profit)}</span>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Data source</div>
          <div className="stat-value" style={{ fontSize: '16px', paddingTop: '4px', fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>Polymarket API</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Verification</div>
          <div className="stat-value" style={{ fontSize: '16px', paddingTop: '4px', fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>On-chain ✓</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Updates</div>
          <div className="stat-value" style={{ fontSize: '16px', paddingTop: '4px', fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>~60s cache</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cost to use</div>
          <div className="stat-value" style={{ fontSize: '16px', paddingTop: '4px', fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>Free</div>
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <div className="section-title">What you can do</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: '10px' }}>
          {[
            { title: 'Sharp List',      desc: 'Traders ranked by Sharp Score — a composite of timing, accuracy, consistency, and sizing', href: '/leaderboard' },
            { title: 'Trader profiles', desc: 'Full score breakdown, open positions, PnL chart, and trade history per wallet', href: '/leaderboard' },
            { title: 'Hot right now',   desc: 'Markets the top profitable wallets are currently holding — follow the smart money', href: '/hot' },
          ].map(f => (
            <Link key={f.title} href={f.href} style={{ textDecoration: 'none' }}>
              <div className="stat-card" style={{ cursor: 'pointer', transition: 'border-color 0.15s', borderColor: 'var(--border)' }}>
                <div className="stat-label">{f.title}</div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px', lineHeight: '1.5' }}>{f.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
