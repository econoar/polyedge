// lib/polymarket.ts
// All Polymarket API calls. No auth needed for read endpoints.

import { analyzeBotLikelihood, type BotAnalysis } from './botDetection'
import { cacheGet, cacheSet } from './cache'
import { isWalletSynced, getActivityFromDb, getRedeemsFromDb } from './db/queries'
import { hasDb } from './db/index'
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
export async function getActivity(wallet: string, limit = 30, offset = 0): Promise<Activity[]> {
  const params = new URLSearchParams({
    user:   wallet,
    limit:  String(limit),
    offset: String(offset),
    type:   'TRADE',
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

// Fetches up to maxTrades activity by paginating in parallel (100 per page).
// Used on trader profile pages where completeness matters more than speed.
export async function getActivityPaginated(wallet: string, maxTrades = 1000): Promise<Activity[]> {
  const pageSize  = 100
  const pageCount = Math.ceil(maxTrades / pageSize)
  const pages = await Promise.allSettled(
    Array.from({ length: pageCount }, (_, i) => getActivity(wallet, pageSize, i * pageSize))
  )
  const seen = new Set<string>()
  const all: Activity[] = []
  for (const page of pages) {
    if (page.status !== 'fulfilled') continue
    for (const a of page.value) {
      const key = a.transactionHash || `${a.timestamp}-${a.slug}-${a.side}`
      if (!seen.has(key)) { seen.add(key); all.push(a) }
    }
  }
  return all.sort((a, b) => b.timestamp - a.timestamp)
}

// DB-first, Redis-second, live API fallback.
export async function getActivityCached(wallet: string): Promise<Activity[]> {
  if (hasDb() && await isWalletSynced(wallet)) {
    return getActivityFromDb(wallet)
  }
  const key = `activity:v1:${wallet.toLowerCase()}`
  const hit = await cacheGet<Activity[]>(key)
  if (hit) return hit
  const data = await getActivityPaginated(wallet, 1000)
  await cacheSet(key, data, 3600)
  return data
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
export interface Redeem {
  proxyWallet: string
  slug:        string
  title:       string
  usdcSize:    number
  timestamp:   number
}

export async function getRedeems(wallet: string, limit = 50, offset = 0): Promise<Redeem[]> {
  try {
    const params = new URLSearchParams({
      user:   wallet,
      limit:  String(limit),
      offset: String(offset),
      type:   'REDEEM',
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

// Fetches all redeems by paginating in parallel (100 per page).
export async function getRedeemsPaginated(wallet: string, maxRedeems = 300): Promise<Redeem[]> {
  const pageSize  = 100
  const pageCount = Math.ceil(maxRedeems / pageSize)
  const pages = await Promise.allSettled(
    Array.from({ length: pageCount }, (_, i) => getRedeems(wallet, pageSize, i * pageSize))
  )
  const seen = new Set<string>()
  const all: Redeem[] = []
  for (const page of pages) {
    if (page.status !== 'fulfilled') continue
    for (const r of page.value) {
      if (r.slug && !seen.has(r.slug)) { seen.add(r.slug); all.push(r) }
    }
  }
  return all
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

// DB-first, Redis-second, live API fallback.
export async function getRedeemsCached(wallet: string): Promise<Redeem[]> {
  if (hasDb() && await isWalletSynced(wallet)) {
    return getRedeemsFromDb(wallet)
  }
  const key = `redeems:v1:${wallet.toLowerCase()}`
  const hit = await cacheGet<Redeem[]>(key)
  if (hit) return hit
  const data = await getRedeemsPaginated(wallet, 300)
  await cacheSet(key, data, 3600)
  return data
}

// ── Closed wins ───────────────────────────────────────────────────────────────

export interface ClosedTrade {
  slug:      string
  title:     string
  icon:      string | null
  outcome:   string
  buyPrice:  number   // weighted avg entry price
  sellPrice: number   // weighted avg exit price (1.0 = resolved, 0 = expired worthless)
  profit:    number   // USDC gain (negative = loss)
  roi:       number   // fractional return (negative = loss)
  exitType:  'redeem' | 'sell' | 'expired'
}

/**
 * Slug-level cash flow analysis — far more accurate than individual pair matching.
 * Groups all BUYs/SELLs/REDEEMs per market, computes net profit = total out - total in.
 * Handles multi-buy/single-sell, partial exits, and expired-worthless positions correctly.
 * Pass current `positions` so still-open markets are excluded.
 */
export function buildClosedTrades(
  trades:    Activity[],
  redeems:   Redeem[]   = [],
  positions: Position[] = [],
): ClosedTrade[] {
  // Aggregate per slug
  interface SlugData {
    totalIn:  number
    totalOut: number
    buyWtSum: number   // sum of (price * usdc) for weighted avg
    sellWtSum: number
    title:    string
    icon:     string | null
    outcome:  string
  }
  const bySlug: Record<string, SlugData> = {}

  for (const t of trades) {
    if (!t.slug || t.price <= 0) continue
    if (!bySlug[t.slug]) bySlug[t.slug] = { totalIn: 0, totalOut: 0, buyWtSum: 0, sellWtSum: 0, title: t.title, icon: t.icon, outcome: t.outcome }
    const d = bySlug[t.slug]
    if (t.side === 'BUY')  { d.totalIn  += t.usdcSize; d.buyWtSum  += t.price * t.usdcSize }
    if (t.side === 'SELL') { d.totalOut += t.usdcSize; d.sellWtSum += t.price * t.usdcSize }
  }

  const redeemBySlug: Record<string, Redeem> = {}
  for (const r of redeems) {
    if (r.slug && !redeemBySlug[r.slug]) redeemBySlug[r.slug] = r
  }

  // Only exclude positions that still have value — zero-value positions are resolved losses
  const openSlugs = new Set(positions.filter(p => p.currentValue > 0).map(p => p.slug))

  const closed: ClosedTrade[] = []
  const allSlugs = Array.from(new Set([...Object.keys(bySlug), ...Object.keys(redeemBySlug)]))

  for (const slug of allSlugs) {
    if (openSlugs.has(slug)) continue

    const d = bySlug[slug]
    const r = redeemBySlug[slug]

    const totalIn  = d?.totalIn  ?? 0
    const totalOut = (d?.totalOut ?? 0) + (r?.usdcSize ?? 0)

    if (totalIn < 1) continue   // no tracked buys — position opened before our history window

    const profit = totalOut - totalIn
    const roi    = totalIn > 0 ? profit / totalIn : 0

    const avgBuyPrice  = d && d.totalIn  > 0 ? d.buyWtSum  / d.totalIn  : 0
    const avgSellPrice = r ? 1.0 : d && d.totalOut > 0 ? d.sellWtSum / d.totalOut : 0

    const exitType: ClosedTrade['exitType'] =
      r                               ? 'redeem'  :
      d && d.totalOut > 0             ? 'sell'    : 'expired'

    closed.push({
      slug,
      title:     d?.title    || r?.title || '',
      icon:      d?.icon     ?? null,
      outcome:   d?.outcome  ?? '',
      buyPrice:  avgBuyPrice,
      sellPrice: avgSellPrice,
      profit,
      roi,
      exitType,
    })
  }

  return closed.sort((a, b) => b.profit - a.profit)
}

/** Lightweight homepage preview — positions-only scoring, no trade history fetch.
 *  ~50x faster than getSharpLeaderboard. Scores are approximate (open positions only). */
export async function getSharpPreview(n = 5): Promise<Array<{ trader: LeaderboardEntry; sharp: SharpScore }>> {
  const leaders = await getLeaderboard('all', 50, 'profit')
  const allPositions = await Promise.allSettled(leaders.map(l => getPositions(l.proxyWallet)))

  const results: Array<{ trader: LeaderboardEntry; sharp: SharpScore }> = []
  leaders.forEach((trader, i) => {
    const positions = allPositions[i].status === 'fulfilled' ? allPositions[i].value : []
    const sharp = computeSharpScore(positions)
    if (sharp) results.push({ trader, sharp })
  })

  results.sort((a, b) => b.sharp.total - a.sharp.total)
  return results.slice(0, n)
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
