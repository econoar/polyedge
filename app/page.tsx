import Link from 'next/link'
import { getLeaderboard, displayName, fmt$, fmtPct } from '@/lib/polymarket'

export const revalidate = 60

export default async function Home() {
  let topTraders: Awaited<ReturnType<typeof getLeaderboard>> = []
  try {
    topTraders = await getLeaderboard('all', 5, 'profit')
  } catch {}

  return (
    <>
      <div className="hero">
        <div className="hero-tag">// prediction market intelligence</div>
        <h1>Track the <span>sharpest</span><br />Polymarket traders</h1>
        <p>
          On-chain verified PnL, open positions, and real-time leaderboards.
          Follow the wallets that actually win.
        </p>
        <div className="hero-actions">
          <Link href="/leaderboard" className="btn btn-primary">View leaderboard →</Link>
          <Link href="/hot" className="btn btn-secondary">Hot right now</Link>
        </div>
      </div>

      {/* Live top-5 preview */}
      <div style={{marginBottom:'3rem'}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px'}}>
          <div className="section-title" style={{marginBottom:0, borderBottom:'none', paddingBottom:0}}>Top traders · all time</div>
          <Link href="/leaderboard" style={{fontFamily:'var(--font-mono)', fontSize:'11px', color:'var(--accent)', textDecoration:'none', letterSpacing:'0.05em'}}>
            Full leaderboard →
          </Link>
        </div>
        <div className="home-lb-preview">
          {topTraders.length === 0 ? (
            <div style={{padding:'2rem', textAlign:'center', color:'var(--muted)', fontFamily:'var(--font-mono)', fontSize:'12px'}}>Loading…</div>
          ) : topTraders.map((e, i) => {
            const name     = displayName(e)
            const initials = name.slice(0, 2).toUpperCase()
            const medals   = ['🥇','🥈','🥉']

            return (
              <Link key={e.proxyWallet} href={`/trader/${e.proxyWallet}`} className="home-lb-row">
                <span className="home-lb-rank">{medals[i] ?? i + 1}</span>
                <span className="home-lb-avatar">
                  {e.profileImage
                    ? <img src={e.profileImage} alt={name} className="avatar" style={{width:28,height:28}} />
                    : <span className="avatar-placeholder" style={{width:28,height:28,fontSize:'10px'}}>{initials}</span>
                  }
                </span>
                <span className="home-lb-name">{name}</span>
                <span className={`home-lb-profit ${e.profit >= 0 ? 'pos' : 'neg'}`}>{fmt$(e.profit)}</span>
                <span className={`home-lb-roi ${e.percentPnl >= 0 ? 'pos' : 'neg'}`}>{fmtPct(e.percentPnl)}</span>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Data source</div>
          <div className="stat-value" style={{fontSize:'16px', paddingTop:'4px', fontFamily:'var(--font-mono)', color:'var(--accent)'}}>Polymarket API</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Verification</div>
          <div className="stat-value" style={{fontSize:'16px', paddingTop:'4px', fontFamily:'var(--font-mono)', color:'var(--green)'}}>On-chain ✓</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Updates</div>
          <div className="stat-value" style={{fontSize:'16px', paddingTop:'4px', fontFamily:'var(--font-mono)', color:'var(--muted)'}}>~60s cache</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cost to use</div>
          <div className="stat-value" style={{fontSize:'16px', paddingTop:'4px', fontFamily:'var(--font-mono)', color:'var(--muted)'}}>Free</div>
        </div>
      </div>

      <div style={{marginTop:'1rem'}}>
        <div className="section-title">What you can do</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap:'10px'}}>
          {[
            {title:'Leaderboard', desc:'All-time and time-windowed rankings by profit, ROI, or volume', href:'/leaderboard'},
            {title:'Trader profiles', desc:'Full trade history, open positions, and verified stats per wallet', href:'/leaderboard'},
            {title:'Hot right now', desc:'Markets the top 20 profitable wallets are currently holding', href:'/hot'},
          ].map(f => (
            <Link key={f.title} href={f.href} style={{textDecoration:'none'}}>
              <div className="stat-card" style={{cursor:'pointer', transition:'border-color 0.15s', borderColor:'var(--border)'}}>
                <div className="stat-label">{f.title}</div>
                <div style={{fontSize:'13px', color:'var(--muted)', marginTop:'6px', lineHeight:'1.5'}}>{f.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
