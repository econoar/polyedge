// lib/polymarket.ts
// All Polymarket API calls. No auth needed for read endpoints.

const GAMMA = 'https://gamma-api.polymarket.com'
const DATA  = 'https://data-api.polymarket.com'

// ── Types ────────────────────────────────────────────────────────────────────

export type Window = '1d' | '1w' | '1m' | 'all'

const timePeriodMap: Record<Window, string> = {
  '1d':  'DAY',
  '1w':  'WEEK',
  '1m':  'MONTH',
  'all': 'ALL',
}

export interface LeaderboardEntry {
  proxyWallet:   string
  name:          string | null
  pseudonym:     string | null
  profileImage:  string | null
  profit:        number
  volume:        number
  percentPnl:    number
  marketsTraded: number
}

export interface TraderProfile {
  proxyWallet:   string
  name:          string | null
  pseudonym:     string | null
  bio:           string | null
  profileImage:  string | null
  profit:        number
  volume:        number
  percentPnl:    number
  marketsTraded: number
}

export interface Position {
  proxyWallet:  string
  title:        string
  slug:         string
  icon:         string | null
  outcome:      string
  size:         number
  avgPrice:     number
  curPrice:     number
  currentValue: number
  initialValue: number
  cashPnl:      number
  percentPnl:   number
  realizedPnl:  number
}

export interface Activity {
  proxyWallet:     string
  side:            'BUY' | 'SELL'
  title:           string
  slug:            string
  icon:            string | null
  outcome:         string
  size:            number
  usdcSize:        number
  price:           number
  timestamp:       number
  transactionHash: string
  name:            string | null
  pseudonym:       string | null
  profileImage:    string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { next: { revalidate: 60 } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

function shortAddr(addr: string) {
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

export function displayName(entry: { name?: string | null; pseudonym?: string | null; proxyWallet: string }) {
  return entry.name || entry.pseudonym || shortAddr(entry.proxyWallet)
}

export function fmt$(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

export function fmtPct(n: number) {
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
}

// ── API calls ────────────────────────────────────────────────────────────────

// Actual endpoint: DATA/v1/leaderboard
// Fields: rank, proxyWallet, userName, xUsername, verifiedBadge, vol, pnl, profileImage
export async function getLeaderboard(
  timeWindow: Window = 'all',
  limit  = 50,
  sortBy: 'profit' | 'volume' = 'profit',
): Promise<LeaderboardEntry[]> {
  const params = new URLSearchParams({
    timePeriod: timePeriodMap[timeWindow],
    orderBy:    sortBy === 'volume' ? 'VOL' : 'PNL',
    limit:      String(limit),
    offset:     '0',
    category:   'overall',
  })
  const raw = await get<any[]>(`${DATA}/v1/leaderboard?${params}`)
  return raw.map(r => {
    const pnl = Number(r.pnl ?? 0)
    const vol = Number(r.vol ?? 0)
    return {
      proxyWallet:   r.proxyWallet,
      name:          r.userName  || null,
      pseudonym:     null,
      profileImage:  r.profileImage || null,
      profit:        pnl,
      volume:        vol,
      percentPnl:    vol > 0 ? (pnl / vol) * 100 : 0,
      marketsTraded: 0,
    }
  })
}

// Profile: leaderboard user filter (stats) + user-stats (trade count)
export async function getProfile(wallet: string): Promise<TraderProfile> {
  const [lbRaw, statsRaw] = await Promise.allSettled([
    get<any[]>(`${DATA}/v1/leaderboard?timePeriod=ALL&orderBy=PNL&limit=1&user=${wallet}`),
    get<any>(`${DATA}/v1/user-stats?proxyAddress=${wallet}`),
  ])

  const lb    = lbRaw.status    === 'fulfilled' ? (lbRaw.value[0] ?? {})    : {}
  const stats = statsRaw.status === 'fulfilled' ? (statsRaw.value ?? {})    : {}

  const pnl = Number(lb.pnl ?? 0)
  const vol = Number(lb.vol ?? 0)
  return {
    proxyWallet:   wallet,
    name:          lb.userName    || null,
    pseudonym:     null,
    bio:           null,
    profileImage:  lb.profileImage || null,
    profit:        pnl,
    volume:        vol,
    percentPnl:    vol > 0 ? (pnl / vol) * 100 : 0,
    marketsTraded: parseInt(stats.trades ?? 0, 10),
  }
}

// Positions: DATA/positions
// Fields: proxyWallet, size, avgPrice, curPrice, currentValue, initialValue,
//         cashPnl, percentPnl, realizedPnl, title, slug (market), eventSlug, icon, outcome
export async function getPositions(wallet: string): Promise<Position[]> {
  const params = new URLSearchParams({
    user:          wallet,
    sizeThreshold: '0.01',
    sortBy:        'CURRENT',
    sortDirection: 'DESC',
    limit:         '20',
  })
  const raw = await get<any[]>(`${DATA}/positions?${params}`)
  return raw.map(r => ({
    proxyWallet:  wallet,
    title:        r.title        ?? '',
    // eventSlug is the parent event slug for polymarket.com/event/ links
    slug:         r.eventSlug    ?? r.slug ?? '',
    icon:         r.icon         ?? null,
    outcome:      r.outcome      ?? '',
    size:         Number(r.size         ?? 0),
    avgPrice:     Number(r.avgPrice     ?? 0),
    curPrice:     Number(r.curPrice     ?? 0),
    currentValue: Number(r.currentValue ?? 0),
    initialValue: Number(r.initialValue ?? 0),
    cashPnl:      Number(r.cashPnl      ?? 0),
    percentPnl:   Number(r.percentPnl   ?? 0),
    realizedPnl:  Number(r.realizedPnl  ?? 0),
  }))
}

// Activity: DATA/activity
// Fields: proxyWallet, side, title, slug, eventSlug, icon, outcome,
//         size (shares), usdcSize (dollar value), price, timestamp, transactionHash, name, pseudonym, profileImage
export async function getActivity(wallet: string, limit = 30): Promise<Activity[]> {
  const params = new URLSearchParams({
    user:  wallet,
    limit: String(limit),
    type:  'TRADE',
  })
  const raw = await get<any[]>(`${DATA}/activity?${params}`)
  return raw.map(r => ({
    proxyWallet:     wallet,
    side:            (r.side ?? 'BUY') as 'BUY' | 'SELL',
    title:           r.title         ?? '',
    slug:            r.eventSlug     ?? r.slug ?? '',
    icon:            r.icon          ?? null,
    outcome:         r.outcome       ?? '',
    size:            Number(r.size     ?? 0),
    usdcSize:        Number(r.usdcSize ?? 0),
    price:           Number(r.price    ?? 0),
    timestamp:       parseInt(r.timestamp ?? 0, 10),
    transactionHash: r.transactionHash ?? '',
    name:            r.name           ?? null,
    pseudonym:       r.pseudonym      ?? null,
    profileImage:    r.profileImage   ?? null,
  }))
}

// ── PnL history ──────────────────────────────────────────────────────────────

const PNL_API = 'https://user-pnl-api.polymarket.com'

export type PnlInterval = '1d' | '1w' | '1m' | 'all'
export interface PnlPoint { t: number; p: number }

export async function getPnlHistory(wallet: string, interval: PnlInterval = 'all'): Promise<PnlPoint[]> {
  const fidelity = interval === '1d' ? '1h' : '1d'
  const url = `${PNL_API}/user-pnl?user_address=${wallet}&interval=${interval}&fidelity=${fidelity}`
  try {
    const res = await fetch(url, { next: { revalidate: 300 } })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

// ── Market detail ─────────────────────────────────────────────────────────────

export async function getMarket(slug: string) {
  const url = `${GAMMA}/events?slug=${slug}`
  const raw = await get<any[]>(url)
  return raw[0] ?? null
}

// Top traders currently holding a specific market (by eventSlug)
export async function getMarketHolders(eventSlug: string, topN = 50): Promise<Array<{
  trader:   LeaderboardEntry
  position: Position
}>> {
  const leaders = await getLeaderboard('all', topN, 'profit')
  const allPositions = await Promise.allSettled(
    leaders.map(l => getPositions(l.proxyWallet))
  )
  const holders: Array<{ trader: LeaderboardEntry; position: Position }> = []
  allPositions.forEach((result, i) => {
    if (result.status !== 'fulfilled') return
    const pos = result.value.find(p => p.slug === eventSlug)
    if (pos) holders.push({ trader: leaders[i], position: pos })
  })
  return holders.sort((a, b) => b.position.currentValue - a.position.currentValue)
}

// ── Sharp Score ───────────────────────────────────────────────────────────────

export interface SharpScore {
  total:              number  // 0–100
  entryTiming:        number  // 0–25  how well they entered before price moved
  contrarianAccuracy: number  // 0–25  low-prob entries that are winning
  repeatability:      number  // 0–25  win rate weighted by breadth
  stakeSizing:        number  // 0–25  bigger bets on better outcomes
}

export interface SharpEntry {
  trader:   LeaderboardEntry
  sharp:    SharpScore
  posCount: number
}

/** Compute Sharp Score from a trader's current open positions.
 *  Returns null when there aren't enough positions to be meaningful (< 2). */
export function computeSharpScore(positions: Position[]): SharpScore | null {
  if (positions.length < 2) return null

  // 1. Entry Timing — reward entering before the market moved in your favor
  const timingValues = positions.map(p =>
    Math.max(p.curPrice - p.avgPrice, 0) / (p.avgPrice || 0.01)
  )
  const avgTiming = timingValues.reduce((a, b) => a + b, 0) / timingValues.length
  const entryTiming = Math.round(Math.min(avgTiming / 0.5, 1) * 25)

  // 2. Contrarian Accuracy — low-probability entries (<45¢) that are currently profitable
  const contrarian = positions.filter(p => p.avgPrice < 0.45)
  const contrarianAccuracy = contrarian.length === 0
    ? 12  // neutral score when no contrarian positions
    : Math.round((contrarian.filter(p => p.cashPnl > 0).length / contrarian.length) * 25)

  // 3. Repeatability — win rate weighted by number of markets (rewards breadth)
  const winRate = positions.filter(p => p.cashPnl > 0).length / positions.length
  const breadthFactor = Math.min(positions.length / 8, 1)
  const repeatability = Math.round(winRate * breadthFactor * 25)

  // 4. Stake Sizing — are the bigger bets the winning bets?
  const sorted = [...positions].sort((a, b) => b.initialValue - a.initialValue)
  const mid = Math.ceil(sorted.length / 2)
  const bigWinRate  = sorted.slice(0, mid).filter(p => p.cashPnl > 0).length / Math.max(mid, 1)
  const smallWinRate = sorted.slice(mid).filter(p => p.cashPnl > 0).length / Math.max(sorted.length - mid, 1)
  const stakeSizing = Math.round(((bigWinRate - smallWinRate + 1) / 2) * 25)

  const total = entryTiming + contrarianAccuracy + repeatability + stakeSizing
  return { total, entryTiming, contrarianAccuracy, repeatability, stakeSizing }
}

/** Fetch the top `poolSize` traders by profit, score them all, return sorted by Sharp Score.
 *  Traders with < 2 open positions go into `rising` (not enough data). */
export async function getSharpLeaderboard(
  timeWindow: Window = 'all',
  poolSize = 100,
): Promise<{ qualified: SharpEntry[]; rising: LeaderboardEntry[] }> {
  const leaders = await getLeaderboard(timeWindow, poolSize, 'profit')
  const allPositions = await Promise.allSettled(leaders.map(l => getPositions(l.proxyWallet)))

  const qualified: SharpEntry[] = []
  const rising:    LeaderboardEntry[] = []

  leaders.forEach((trader, i) => {
    const positions = allPositions[i].status === 'fulfilled' ? allPositions[i].value : []
    const sharp = computeSharpScore(positions)
    if (sharp) {
      qualified.push({ trader, sharp, posCount: positions.length })
    } else {
      rising.push(trader)
    }
  })

  qualified.sort((a, b) => b.sharp.total - a.sharp.total)
  return { qualified, rising }
}

// ── "Hot right now": open positions of top traders, aggregated by market
export async function getHotMarkets(topN = 20, timeWindow: Window = 'all'): Promise<{
  slug:       string
  title:      string
  icon:       string | null
  traders:    number
  totalValue: number
  avgPrice:   number
}[]> {
  const leaders = await getLeaderboard(timeWindow, topN, 'profit')
  const allPositions = await Promise.allSettled(
    leaders.map(l => getPositions(l.proxyWallet))
  )

  const bySlug: Record<string, {
    title: string; icon: string | null
    traders: Set<string>; totalValue: number; prices: number[]
  }> = {}

  allPositions.forEach((result, i) => {
    if (result.status !== 'fulfilled') return
    result.value.forEach(pos => {
      const key = pos.slug
      if (!key) return
      if (!bySlug[key]) {
        bySlug[key] = { title: pos.title, icon: pos.icon, traders: new Set(), totalValue: 0, prices: [] }
      }
      bySlug[key].traders.add(leaders[i].proxyWallet)
      bySlug[key].totalValue += pos.currentValue
      bySlug[key].prices.push(pos.curPrice)
    })
  })

  return Object.entries(bySlug)
    .map(([slug, d]) => ({
      slug,
      title:      d.title,
      icon:       d.icon,
      traders:    d.traders.size,
      totalValue: d.totalValue,
      avgPrice:   d.prices.reduce((a, b) => a + b, 0) / d.prices.length,
    }))
    .sort((a, b) => b.traders - a.traders || b.totalValue - a.totalValue)
    .slice(0, 15)
}
