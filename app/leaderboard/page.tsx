import {
  getLeaderboard, getSharpLeaderboard,
  type Window, type LeaderboardEntry, type SharpEntry,
} from '@/lib/polymarket'
import LeaderboardTable from './LeaderboardTable'
import SharpLeaderboardTable from './SharpLeaderboardTable'
import SearchBar from './SearchBar'

export const revalidate = 60

type Sort = 'sharp' | 'profit' | 'volume'
type Props = { searchParams: { window?: string; sort?: string } }

export default async function LeaderboardPage({ searchParams }: Props) {
  const timeWin = (['1d', '1w', '1m', 'all'].includes(searchParams.window ?? '')
    ? searchParams.window : 'all') as Window

  const sort: Sort = (['sharp', 'profit', 'volume'].includes(searchParams.sort ?? '')
    ? searchParams.sort : 'sharp') as Sort

  let sharpData: { qualified: SharpEntry[]; rising: LeaderboardEntry[] } | null = null
  let entries: LeaderboardEntry[] = []
  let error: string | null = null

  try {
    if (sort === 'sharp') {
      sharpData = await getSharpLeaderboard(timeWin, 300)
    } else {
      entries = await getLeaderboard(timeWin, 50, sort)
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to fetch'
  }

  const windows: { key: Window; label: string }[] = [
    { key: 'all', label: 'All time' },
    { key: '1m',  label: '30 days'  },
    { key: '1w',  label: '7 days'   },
    { key: '1d',  label: '24 hours' },
  ]

  const subtitleMap: Record<Sort, string> = {
    sharp:  'Ranked by Sharp Score — quality over quantity',
    profit: 'Ranked by total profit',
    volume: 'Ranked by trading volume',
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1>Sharp List</h1>
          <p>{subtitleMap[sort]} · {timeWin === 'all' ? 'all time' : timeWin}</p>
        </div>
        <SearchBar />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '12px' }}>
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
          <a href={`/leaderboard?window=${timeWin}&sort=sharp`}  className={`tab ${sort === 'sharp'  ? 'active' : ''}`}>Sharp</a>
          <a href={`/leaderboard?window=${timeWin}&sort=profit`} className={`tab ${sort === 'profit' ? 'active' : ''}`}>Profit</a>
          <a href={`/leaderboard?window=${timeWin}&sort=volume`} className={`tab ${sort === 'volume' ? 'active' : ''}`}>Volume</a>
        </div>
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
          {windows.map(w => (
            <a
              key={w.key}
              href={`/leaderboard?window=${w.key}&sort=${sort}`}
              className={`tab ${timeWin === w.key ? 'active' : ''}`}
            >{w.label}</a>
          ))}
        </div>
      </div>

      {error && <div className="error-box">⚠ {error}</div>}

      {/* Sharp view */}
      {sort === 'sharp' && sharpData && (
        <>
          {sharpData.qualified.length === 0 && !error && (
            <div className="empty">No data available for this window.</div>
          )}

          {sharpData.qualified.length > 0 && (
            <SharpLeaderboardTable entries={sharpData.qualified} />
          )}

          {sharpData.rising.length > 0 && (
            <>
              <div className="rising-divider">
                <div className="rising-divider-line" />
                <span className="rising-label">Rising — not enough open positions to score</span>
                <div className="rising-divider-line" />
              </div>
              <LeaderboardTable entries={sharpData.rising} />
            </>
          )}
        </>
      )}

      {/* Profit / Volume views */}
      {sort !== 'sharp' && (
        <>
          {entries.length === 0 && !error && (
            <div className="empty">No data available for this window.</div>
          )}
          {entries.length > 0 && <LeaderboardTable entries={entries} />}
        </>
      )}
    </>
  )
}
