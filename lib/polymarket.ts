// lib/polymarket.ts
// All Polymarket API calls. No auth needed for read endpoints.

import { analyzeBotLikelihood, type BotAnalysis } from './botDetection'
export type { BotAnalysis } from './botDetection'

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
  const raw = entry.name || entry.pseudonym
  if (!raw || raw.length > 20) return shortAddr(entry.proxyWallet)
  return raw
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

// Single leaderboard page — used by Profit/Volume tabs and internally by getLeaderboardByRoi.
export async function getLeaderboard(
  timeWindow: Window = 'all',
  limit  = 50,
  sortBy: 'profit' | 'volume' = 'profit',
): Promise<LeaderboardEntry[]> {
  const params = new URLSearchParams({
    timePeriod: timePeriodMap[timeWindow],
    orderBy:    sortBy === 'volume' ? 'VOL' : 'PNL',
    limit:      String(Math.min(limit, 50)),  // API hard cap is 50
    offset:     '0',
    category:   'overall',
  })
  const raw = await get<any[]>(`${DATA}/v1/leaderboard?${params}`)
  return raw.map(r => mapLeaderboardRow(r))
}

function mapLeaderboardRow(r: any): LeaderboardEntry {
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
}

// Fetch up to `candidatePool` traders by volume (paginated), re-rank by ROI.
// The leaderboard API caps at ~10,000 unique traders (all with ≥$1.6M volume);
// pages repeat after that so deduplication handles any overshoot safely.
export async function getLeaderboardByRoi(
  timeWindow: Window = 'all',
  candidatePool = 10_000,
): Promise<LeaderboardEntry[]> {
  const pageCount = Math.ceil(candidatePool / 50)

  const pages = await Promise.allSettled(
    Array.from({ length: pageCount }, (_, i) => {
      const params = new URLSearchParams({
        timePeriod: timePeriodMap[timeWindow],
        orderBy:    'VOL',
        limit:      '50',
        offset:     String(i * 50),
        category:   'overall',
      })
      return get<any[]>(`${DATA}/v1/leaderboard?${params}`)
    })
  )

  const seen = new Set<string>()
  const all: LeaderboardEntry[] = []

  for (const page of pages) {
    if (page.status !== 'fulfilled') continue
    for (const r of page.value) {
      if (seen.has(r.proxyWallet)) continue
      seen.add(r.proxyWallet)
      const entry = mapLeaderboardRow(r)
      if (entry.volume < 500) continue   // $500 USDC floor
      all.push(entry)
    }
  }

  // Re-rank by ROI — surfaces skill, not capital
  all.sort((a, b) => b.percentPnl - a.percentPnl)
  return all
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

// Fetches more trades for bot detection — silently returns [] on error.
export async function getActivityForBot(wallet: string): Promise<Activity[]> {
  try {
    return await getActivity(wallet, 100)
  } catch {
    return []
  }
}

// Redeem events: market resolutions where this trader held the winning side.
// Each REDEEM means they won — sellPrice is always $1.00/share.
interface Redeem {
  proxyWallet: string
  slug:        string
  title:       string
  usdcSize:    number
  timestamp:   number
}

export async function getRedeems(wallet: string, limit = 50): Promise<Redeem[]> {
  try {
    const params = new URLSearchParams({
      user:  wallet,
      limit: String(limit),
      type:  'REDEEM',
    })
    const raw = await get<any[]>(`${DATA}/activity?${params}`)
    return raw.map(r => ({
      proxyWallet: wallet,
      slug:        r.eventSlug ?? r.slug ?? '',
      title:       r.title     ?? '',
      usdcSize:    Number(r.usdcSize ?? 0),
      timestamp:   parseInt(r.timestamp ?? 0, 10),
    }))
  } catch {
    return []
  }
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
// Sharp score is computed for free — positions are already fetched here.
export async function getMarketHolders(eventSlug: string, topN = 50): Promise<Array<{
  trader:   LeaderboardEntry
  position: Position
  sharp:    SharpScore | null
}>> {
  const leaders = await getLeaderboard('all', topN, 'profit')
  const allPositions = await Promise.allSettled(
    leaders.map(l => getPositions(l.proxyWallet))
  )
  const holders: Array<{ trader: LeaderboardEntry; position: Position; sharp: SharpScore | null }> = []
  allPositions.forEach((result, i) => {
    if (result.status !== 'fulfilled') return
    const positions = result.value
    const pos = positions.find(p => p.slug === eventSlug)
    if (pos) holders.push({ trader: leaders[i], position: pos, sharp: computeSharpScore(positions) })
  })
  return holders.sort((a, b) => b.position.currentValue - a.position.currentValue)
}

// ── Sharp Score ───────────────────────────────────────────────────────────────

export interface SharpScore {
  total:              number  // 0–100
  entryTiming:        number  // 0–25
  contrarianAccuracy: number  // 0–25
  repeatability:      number  // 0–25
  stakeSizing:        number  // 0–25
  resolvedCount:      number  // closed round-trips used in computation
  winRate:            number  // 0–1, from resolved trips + open positions
}

export interface SharpEntry {
  trader:      LeaderboardEntry
  sharp:       SharpScore
  posCount:    number
  positions:   Position[]
  botAnalysis: BotAnalysis
}

interface RoundTrip {
  slug:      string
  buyPrice:  number
  sellPrice: number
  buyUsdc:   number
  won:       boolean
}

function matchRoundTrips(trades: Activity[], redeems: Redeem[] = []): RoundTrip[] {
  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp)
  const queues: Record<string, Array<{ price: number; usdc: number }>> = {}
  const trips: RoundTrip[] = []

  // BUY→SELL pairs from trade activity
  for (const t of sorted) {
    if (t.price <= 0) continue
    const key = `${t.slug}::${t.outcome}`
    if (t.side === 'BUY') {
      if (!queues[key]) queues[key] = []
      queues[key].push({ price: t.price, usdc: t.usdcSize })
    } else if (t.side === 'SELL' && queues[key]?.length) {
      const buy = queues[key].shift()!
      trips.push({ slug: t.slug, buyPrice: buy.price, sellPrice: t.price, buyUsdc: buy.usdc, won: t.price > buy.price })
    }
  }

  // BUY→REDEEM: market resolved with this trader on the winning side (sellPrice = $1.00 always).
  // Build slug→buys index for matching, then attribute each REDEEM to the prior buys in that market.
  const buysBySlug: Record<string, Array<{ price: number; usdc: number; timestamp: number }>> = {}
  for (const t of sorted) {
    if (t.side === 'BUY' && t.price > 0) {
      if (!buysBySlug[t.slug]) buysBySlug[t.slug] = []
      buysBySlug[t.slug].push({ price: t.price, usdc: t.usdcSize, timestamp: t.timestamp })
    }
  }

  const redeemedSlugs = new Set<string>()
  for (const r of redeems) {
    if (!r.slug || redeemedSlugs.has(r.slug)) continue  // one trip per market
    const priorBuys = (buysBySlug[r.slug] ?? []).filter(b => b.timestamp < r.timestamp)
    if (priorBuys.length === 0) continue
    redeemedSlugs.add(r.slug)
    const avgBuyPrice  = priorBuys.reduce((s, b) => s + b.price, 0) / priorBuys.length
    const totalBuyUsdc = priorBuys.reduce((s, b) => s + b.usdc,  0)
    trips.push({ slug: r.slug, buyPrice: avgBuyPrice, sellPrice: 1.0, buyUsdc: totalBuyUsdc, won: true })
  }

  return trips
}

/** Compute Sharp Score from open positions + closed trade history (BUY→SELL pairs and market resolutions).
 *  Requires ≥2 open positions OR ≥5 closed round-trips to score. */
export function computeSharpScore(
  positions: Position[],
  trades: Activity[] = [],
  redeems: Redeem[] = [],
): SharpScore | null {
  const trips = matchRoundTrips(trades, redeems)
  if (positions.length < 2 && trips.length < 3) return null

  // 1. Entry Timing — entered before the market moved in your favor
  //    Combines: unrealised gain on open positions + price appreciation on closed trades.
  //    Threshold lowered to 0.25 (25% avg appreciation = full marks).
  const timingValues = [
    ...positions.map(p => Math.max(p.curPrice - p.avgPrice, 0) / (p.avgPrice || 0.01)),
    ...trips.map(t => Math.max(t.sellPrice - t.buyPrice, 0) / (t.buyPrice || 0.01)),
  ]
  const avgTiming = timingValues.length > 0
    ? timingValues.reduce((a, b) => a + b, 0) / timingValues.length : 0
  const entryTiming = Math.round(Math.min(avgTiming / 0.25, 1) * 25)

  // 2. Contrarian Accuracy — low-prob entries (<45¢) that paid off
  const contrarianAll = [
    ...positions.filter(p => p.avgPrice < 0.45).map(p => p.cashPnl > 0),
    ...trips.filter(t => t.buyPrice < 0.45).map(t => t.won),
  ]
  const contrarianAccuracy = contrarianAll.length === 0
    ? 12
    : Math.round((contrarianAll.filter(Boolean).length / contrarianAll.length) * 25)

  // 3. Repeatability — win rate across breadth of unique markets
  //    Breadth divisor 10: needs trades across 10 distinct markets for full credit.
  const allOutcomes = [
    ...positions.map(p => p.cashPnl > 0),
    ...trips.map(t => t.won),
  ]
  const winRate = allOutcomes.length > 0
    ? allOutcomes.filter(Boolean).length / allOutcomes.length : 0
  const uniqueMarkets = new Set([
    ...positions.map(p => p.slug),
    ...trips.map(t => t.slug),
  ].filter(Boolean)).size
  const breadthFactor = Math.min(uniqueMarkets / 10, 1)
  const repeatability = Math.round(winRate * breadthFactor * 25)

  // 4. Stake Sizing — bigger bets on better outcomes
  const allSized = [
    ...positions.map(p => ({ size: p.initialValue, won: p.cashPnl > 0 })),
    ...trips.map(t => ({ size: t.buyUsdc, won: t.won })),
  ].filter(s => s.size > 0)
  let stakeSizing = 13  // neutral default when insufficient data
  if (allSized.length >= 4) {
    const bySizeDesc = [...allSized].sort((a, b) => b.size - a.size)
    const mid = Math.ceil(bySizeDesc.length / 2)
    const bigWR   = bySizeDesc.slice(0, mid).filter(s => s.won).length / Math.max(mid, 1)
    const smallWR = bySizeDesc.slice(mid).filter(s => s.won).length / Math.max(bySizeDesc.length - mid, 1)
    stakeSizing = Math.round(((bigWR - smallWR + 1) / 2) * 25)
  }

  const total = entryTiming + contrarianAccuracy + repeatability + stakeSizing
  return { total, entryTiming, contrarianAccuracy, repeatability, stakeSizing, resolvedCount: trips.length, winRate }
}

/** Build the Sharp List.
 *  Pool: top 1000 by volume, re-ranked by ROI — surfaces skill, not capital.
 *  Hard filters: bot exclusions, $500 vol floor, ≥10 unique markets traded.
 *  `poolSize` controls how many ROI-ranked candidates get the expensive analysis. */
export async function getSharpLeaderboard(
  timeWindow: Window = 'all',
  poolSize = 300,
): Promise<{ qualified: SharpEntry[]; rising: LeaderboardEntry[] }> {
  // Candidate pool: all ~10,000 accessible traders by volume, re-ranked by ROI.
  // Deduplication in getLeaderboardByRoi handles the API's hard cap safely.
  const allCandidates = await getLeaderboardByRoi(timeWindow, 10_000)
  const leaders = allCandidates.slice(0, poolSize)

  // Fetch positions, trade activity, and redeem history in parallel — same wall-clock time.
  const [allPositions, allActivity, allRedeems] = await Promise.all([
    Promise.allSettled(leaders.map(l => getPositions(l.proxyWallet))),
    Promise.allSettled(leaders.map(l => getActivityForBot(l.proxyWallet))),
    Promise.allSettled(leaders.map(l => getRedeems(l.proxyWallet, 50))),
  ])

  const qualified: SharpEntry[] = []
  const rising:    LeaderboardEntry[] = []

  leaders.forEach((trader, i) => {
    const positions = allPositions[i].status === 'fulfilled' ? allPositions[i].value : []
    const trades    = allActivity[i].status  === 'fulfilled' ? allActivity[i].value  : []
    const redeems   = allRedeems[i].status   === 'fulfilled' ? allRedeems[i].value   : []

    // Minimum market breadth: ≥5 unique markets across trades and redeems.
    const tradeSlugs  = trades.map(t => t.slug).filter(Boolean)
    const redeemSlugs = redeems.map(r => r.slug).filter(Boolean)
    const uniqueMarkets = new Set([...tradeSlugs, ...redeemSlugs])
    if (trades.length > 0 && uniqueMarkets.size < 5) return

    const sharp       = computeSharpScore(positions, trades, redeems)
    const botAnalysis = analyzeBotLikelihood(trades, trader.profit, trader.volume, positions)

    if (!sharp) {
      rising.push(trader)
      return
    }

    if (botAnalysis.isDefiniteBot) return  // excluded from Sharp List; still on Profit/Volume

    const effectiveSharp = botAnalysis.scoreMultiplier < 1
      ? { ...sharp, total: Math.round(sharp.total * botAnalysis.scoreMultiplier) }
      : sharp

    qualified.push({ trader, sharp: effectiveSharp, posCount: positions.length, positions, botAnalysis })
  })

  qualified.sort((a, b) => b.sharp.total - a.sharp.total)
  return { qualified, rising }
}

// ── "Hot right now": aggregate positions from sharp-ranked entries into markets
// Pure function — no API calls. Pass the slice of SharpEntry[] you want to aggregate.
export function buildHotMarkets(entries: SharpEntry[]): {
  slug:       string
  title:      string
  icon:       string | null
  traders:    number
  totalValue: number
  avgPrice:   number
}[] {
  const bySlug: Record<string, {
    title: string; icon: string | null
    traders: Set<string>; totalValue: number; prices: number[]
  }> = {}

  entries.forEach(({ trader, positions }) => {
    positions.forEach(pos => {
      const key = pos.slug
      if (!key) return
      if (!bySlug[key]) {
        bySlug[key] = { title: pos.title, icon: pos.icon, traders: new Set(), totalValue: 0, prices: [] }
      }
      bySlug[key].traders.add(trader.proxyWallet)
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
