import { getLeaderboard, type Window } from '@/lib/polymarket'
import LeaderboardTable from './LeaderboardTable'
import SearchBar from './SearchBar'

export const revalidate = 60

type Props = { searchParams: { window?: string; sort?: string } }

export default async function LeaderboardPage({ searchParams }: Props) {
  const timeWin = (['1d', '1w', '1m', 'all'].includes(searchParams.window ?? '')
    ? searchParams.window : 'all') as Window
  const sort = searchParams.sort === 'volume' ? 'volume' : 'profit'

  let entries: Awaited<ReturnType<typeof getLeaderboard>> = []
  let error: string | null = null

  try {
    entries = await getLeaderboard(timeWin, 50, sort)
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to fetch leaderboard'
  }

  const windows: { key: Window; label: string }[] = [
    { key: 'all', label: 'All time' },
    { key: '1m',  label: '30 days'  },
    { key: '1w',  label: '7 days'   },
    { key: '1d',  label: '24 hours' },
  ]

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1>Leaderboard</h1>
          <p>Top traders ranked by {sort === 'volume' ? 'volume' : 'profit'} · {timeWin === 'all' ? 'all time' : timeWin}</p>
        </div>
        <SearchBar />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '12px' }}>
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
          {windows.map(w => (
            <a
              key={w.key}
              href={`/leaderboard?window=${w.key}&sort=${sort}`}
              className={`tab ${timeWin === w.key ? 'active' : ''}`}
            >{w.label}</a>
          ))}
        </div>
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
          <a href={`/leaderboard?window=${timeWin}&sort=profit`}  className={`tab ${sort === 'profit'  ? 'active' : ''}`}>Profit</a>
          <a href={`/leaderboard?window=${timeWin}&sort=volume`}  className={`tab ${sort === 'volume'  ? 'active' : ''}`}>Volume</a>
        </div>
      </div>

      {error && <div className="error-box">⚠ {error}</div>}

      {!error && entries.length === 0 && (
        <div className="empty">No data available for this window.</div>
      )}

      {entries.length > 0 && <LeaderboardTable entries={entries} />}
    </>
  )
}
