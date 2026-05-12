import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMarket, getMarketHolders, fmt$ } from '@/lib/polymarket'
import OutcomePills from './OutcomePills'
import MarketHoldersTable from './MarketHoldersTable'

export const revalidate = 60

type Props = { params: { slug: string } }

export default async function MarketPage({ params }: Props) {
  const { slug } = params

  const [market, holders] = await Promise.allSettled([
    getMarket(slug),
    getMarketHolders(slug, 50),
  ])

  if (market.status === 'rejected' || !market.value) notFound()

  const m       = market.value
  const traders = holders.status === 'fulfilled' ? holders.value : []

  const subMarkets: any[] = m.markets ?? []
  const totalVolume = Number(m.volume ?? 0)

  return (
    <>
      <Link href="/hot" className="back">← Back</Link>

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

      {/* Outcome pills — filtered, sorted, collapsible */}
      {subMarkets.length > 0 && <OutcomePills subMarkets={subMarkets} />}

      {/* Top trader holders */}
      <div className="section-title" style={{ marginTop: '2rem' }}>
        Sharps holding this market ({traders.length})
      </div>

      {traders.length === 0 ? (
        <div className="empty" style={{ padding: '3rem 0' }}>
          None of the top 50 sharps currently hold a position here.
        </div>
      ) : (
        <MarketHoldersTable holders={traders} />
      )}
    </>
  )
}
