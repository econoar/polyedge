import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMarket, getMarketHolders, displayName, fmt$, fmtPct } from '@/lib/polymarket'

export const revalidate = 60

type Props = { params: { slug: string } }

export default async function MarketPage({ params }: Props) {
  const { slug } = params

  const [market, holders] = await Promise.allSettled([
    getMarket(slug),
    getMarketHolders(slug, 50),
  ])

  if (market.status === 'rejected' || !market.value) notFound()

  const m = market.value
  const traders = holders.status === 'fulfilled' ? holders.value : []

  // Pull current prices from nested markets array
  const subMarkets: any[] = m.markets ?? []
  const totalVolume = Number(m.volume ?? 0)

  return (
    <>
      <Link href="/hot" className="back">← Hot right now</Link>

      {/* Market header */}
      <div className="market-header">
        {m.icon && <img src={m.icon} alt="" className="market-icon" />}
        <div>
          <div className="market-title">{m.title}</div>
          <div className="market-meta">
            {m.closed ? (
              <span className="market-badge market-badge-closed">Resolved</span>
            ) : (
              <span className="market-badge market-badge-open">Active</span>
            )}
            <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
              Vol: {fmt$(totalVolume)}
            </span>
            <a
              href={`https://polymarket.com/event/${slug}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)', textDecoration: 'none' }}
            >Trade on Polymarket ↗</a>
          </div>
        </div>
      </div>

      {/* Current prices from sub-markets */}
      {subMarkets.length > 0 && (
        <div className="market-outcomes">
          {subMarkets.slice(0, 6).map((sm: any) => {
            const prices: number[] = JSON.parse(sm.outcomePrices ?? '[]')
            const outcomes: string[] = JSON.parse(sm.outcomes ?? '[]') as string[]
            return outcomes.map((outcome: string, oi: number) => {
              const price = prices[oi] ?? 0
              return (
                <div key={`${sm.id}-${oi}`} className="outcome-chip">
                  <span className="outcome-name">{outcome}</span>
                  <span className="outcome-price" style={{
                    color: price > 0.7 ? 'var(--green)' : price < 0.3 ? 'var(--red)' : 'var(--text)'
                  }}>{(Number(price) * 100).toFixed(0)}¢</span>
                </div>
              )
            })
          })}
        </div>
      )}

      {/* Top trader holders */}
      <div className="section-title" style={{ marginTop: '2rem' }}>
        Top traders holding this market ({traders.length})
      </div>

      {traders.length === 0 ? (
        <div className="empty" style={{ padding: '3rem 0' }}>
          None of the top 50 traders currently hold a position here.
        </div>
      ) : (
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
            {traders.map(({ trader, position }) => {
              const name = displayName(trader)
              const initials = name.slice(0, 2).toUpperCase()
              return (
                <tr key={trader.proxyWallet}>
                  <td>
                    <Link href={`/trader/${trader.proxyWallet}`} style={{ textDecoration: 'none' }}>
                      <div className="trader-cell">
                        {trader.profileImage
                          ? <img src={trader.profileImage} alt={name} className="avatar" />
                          : <div className="avatar-placeholder">{initials}</div>
                        }
                        <div>
                          <div className="trader-name">{name}</div>
                          <div className="trader-addr">{trader.proxyWallet.slice(0,6)}…{trader.proxyWallet.slice(-4)}</div>
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
      )}
    </>
  )
}
