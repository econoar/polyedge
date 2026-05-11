import { getHotMarkets, fmt$, type Window } from '@/lib/polymarket'

export const revalidate = 120

const VALID_N       = [10, 20, 50, 100] as const
const VALID_WINDOWS = ['all', '1m', '1w'] as const

type ValidN = typeof VALID_N[number]

const windowLabel: Record<string, string> = {
  all: 'All time',
  '1m': 'Past 30 days',
  '1w': 'Past 7 days',
}

type Props = { searchParams: { n?: string; window?: string } }

export default async function HotPage({ searchParams }: Props) {
  const n = (VALID_N.includes(Number(searchParams.n) as ValidN)
    ? Number(searchParams.n)
    : 50) as ValidN

  const timeWin = (VALID_WINDOWS.includes(searchParams.window as any)
    ? searchParams.window
    : 'all') as Window

  let markets: Awaited<ReturnType<typeof getHotMarkets>> = []
  let error: string | null = null

  try {
    markets = await getHotMarkets(n, timeWin)
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to fetch data'
  }

  return (
    <>
      <div className="page-header">
        <h1>Hot right now</h1>
        <p>Markets the top {n} sharpest traders ({windowLabel[timeWin].toLowerCase()}) are currently holding</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase' }}>Traders</span>
          <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
            {VALID_N.map(v => (
              <a
                key={v}
                href={`/hot?n=${v}&window=${timeWin}`}
                className={`tab ${n === v ? 'active' : ''}`}
              >Top {v}</a>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--muted)', textTransform: 'uppercase' }}>Period</span>
          <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
            {VALID_WINDOWS.map(w => (
              <a
                key={w}
                href={`/hot?n=${n}&window=${w}`}
                className={`tab ${timeWin === w ? 'active' : ''}`}
              >{windowLabel[w]}</a>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="error-box">⚠ {error}</div>}

      {!error && markets.length === 0 && (
        <div className="empty">No data — positions for this cohort may still be loading.</div>
      )}

      <div className="hot-grid">
        {markets.map((m, i) => (
          <a
            key={m.slug}
            href={`/market/${m.slug}`}
            className="hot-card"
          >
            <div className="hot-rank">{i + 1}</div>

            {m.icon ? (
              <img src={m.icon} alt="" className="hot-icon" />
            ) : (
              <div className="hot-icon-ph" />
            )}

            <div className="hot-body">
              <div className="hot-title">{m.title}</div>
              <div className="hot-traders-count">
                <span className="hot-traders-num">{m.traders}</span>
                <span className="hot-traders-label"> of {n} top traders holding</span>
              </div>
              <div className="hot-exposure">{fmt$(m.totalValue)} exposure</div>
            </div>

            <div className="hot-right">
              <div className="hot-prob" style={{
                color: m.avgPrice > 0.7 ? 'var(--green)' : m.avgPrice < 0.3 ? 'var(--red)' : 'var(--text)'
              }}>
                {(m.avgPrice * 100).toFixed(0)}¢
              </div>
              <div className="hot-prob-label">avg price</div>
            </div>
          </a>
        ))}
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
        <div className="section-title" style={{ marginBottom: '8px' }}>How this works</div>
        <p style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', lineHeight: '1.7' }}>
          We fetch the current open positions of the top {n} sharpest traders ({windowLabel[timeWin].toLowerCase()}),
          then aggregate by market. Markets held by more of them appear higher.
          This is not investment advice — it shows where sharp capital is concentrated,
          not necessarily where it should be.
        </p>
      </div>
    </>
  )
}
