/**
 * Core sync engine. Fetches complete activity history from Polymarket and
 * persists it to Neon Postgres. Shared between the CLI script (full initial
 * sync) and the /api/sync route (incremental daily cron).
 *
 * Resumability: syncedAt = null → pending, syncedAt = <ts> → done.
 * Re-running is safe — upserts are idempotent on (wallet, tx_hash).
 */

import {
  upsertTraderSeed, upsertActivityBatch, markWalletSynced,
  getUnsyncedWallets, getStaleWallets,
} from './db/queries'

const DATA = 'https://data-api.polymarket.com'

// ── Raw API helpers ───────────────────────────────────────────────────────────

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json() as Promise<T>
}

interface RawActivity {
  type:            string
  side:            string
  slug:            string
  eventSlug:       string
  title:           string
  outcome:         string
  icon:            string
  size:            string | number
  usdcSize:        string | number
  price:           string | number
  timestamp:       string | number
  transactionHash: string
}

interface RawLeaderboardEntry {
  proxyWallet:  string
  userName:     string | null
  pseudonym:    string | null
  profileImage: string | null
  pnl:          string | number
  vol:          string | number
}

// Fetches one page of the Polymarket leaderboard (50 per page, volume-ordered)
async function fetchLeaderboardPage(offset: number): Promise<RawLeaderboardEntry[]> {
  const params = new URLSearchParams({
    timePeriod: 'ALL',
    orderBy:    'VOL',
    limit:      '50',
    offset:     String(offset),
    category:   'overall',
  })
  try {
    return await apiFetch<RawLeaderboardEntry[]>(`${DATA}/v1/leaderboard?${params}`)
  } catch {
    return []
  }
}

// Fetches ALL activity for a wallet (TRADE + REDEEM), paginating until empty.
// No type filter — we want everything so one pass covers both.
async function fetchAllActivity(wallet: string): Promise<RawActivity[]> {
  const all: RawActivity[] = []
  let offset = 0
  const pageSize = 100

  while (true) {
    const params = new URLSearchParams({
      user:   wallet,
      limit:  String(pageSize),
      offset: String(offset),
    })
    let page: RawActivity[]
    try {
      page = await apiFetch<RawActivity[]>(`${DATA}/activity?${params}`)
    } catch {
      break
    }
    if (!page || page.length === 0) break
    all.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
    // Rate-limit: small pause every 10 pages
    if (offset % 1000 === 0) await sleep(200)
  }
  return all
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// ── Discover wallets ──────────────────────────────────────────────────────────

/**
 * Fetches all ~10,000 wallets from the Polymarket leaderboard and seeds
 * the traders table. New wallets get syncedAt = null (pending).
 * Existing wallets are updated with fresh profile data.
 */
export async function discoverWallets(opts: { log?: boolean } = {}): Promise<number> {
  const { log = true } = opts
  // Leaderboard API caps at ~10,000 unique traders (200 pages × 50)
  const PAGES = 200
  const CONCURRENCY = 20
  const seen = new Set<string>()
  let seeded = 0

  for (let batch = 0; batch < PAGES; batch += CONCURRENCY) {
    const offsets = Array.from({ length: Math.min(CONCURRENCY, PAGES - batch) }, (_, i) => (batch + i) * 50)
    const pages = await Promise.allSettled(offsets.map(o => fetchLeaderboardPage(o)))

    const toUpsert: RawLeaderboardEntry[] = []
    for (const result of pages) {
      if (result.status !== 'fulfilled') continue
      for (const r of result.value) {
        if (!r.proxyWallet || seen.has(r.proxyWallet)) continue
        seen.add(r.proxyWallet)
        toUpsert.push(r)
      }
    }

    // Upsert in parallel (each is a small query)
    await Promise.allSettled(toUpsert.map(r =>
      upsertTraderSeed({
        wallet:        r.proxyWallet,
        name:          r.userName ?? null,
        pseudonym:     r.pseudonym ?? null,
        profileImage:  r.profileImage ?? null,
        profit:        Number(r.pnl ?? 0),
        volume:        Number(r.vol ?? 0),
        percentPnl:    Number(r.vol) > 0 ? Number(r.pnl) / Number(r.vol) * 100 : 0,
        marketsTraded: 0,
      })
    ))
    seeded += toUpsert.length

    if (log) process.stdout.write(`\rDiscovered ${seeded} wallets...`)

    // If any page returned < 50, we've hit the end
    if (pages.some(p => p.status === 'fulfilled' && p.value.length < 50)) break
  }

  if (log) console.log(`\nDiscovery complete: ${seeded} wallets seeded`)
  return seeded
}

// ── Sync a single wallet ──────────────────────────────────────────────────────

export async function syncWallet(wallet: string): Promise<{ trades: number; redeems: number }> {
  const raw = await fetchAllActivity(wallet)

  const rows = raw
    .filter(r => r.type === 'TRADE' || r.type === 'REDEEM')
    .map(r => {
      const slug = r.eventSlug || r.slug || ''
      const ts   = parseInt(String(r.timestamp), 10)
      const txHash = r.transactionHash ||
        `${wallet.toLowerCase()}:${ts}:${r.type}:${slug}`
      return {
        wallet,
        timestamp: ts,
        type:      r.type,
        side:      r.side || null,
        slug,
        title:     r.title     ?? '',
        outcome:   r.outcome   ?? '',
        icon:      r.icon      ?? null,
        size:      Number(r.size     ?? 0),
        usdcSize:  Number(r.usdcSize ?? 0),
        price:     Number(r.price    ?? 0),
        txHash,
      }
    })

  await upsertActivityBatch(rows)
  await markWalletSynced(wallet)

  const trades  = rows.filter(r => r.type === 'TRADE').length
  const redeems = rows.filter(r => r.type === 'REDEEM').length
  return { trades, redeems }
}

// ── Sync job ──────────────────────────────────────────────────────────────────

export interface SyncOpts {
  /** Max wallets to process in this run (undefined = unlimited) */
  limit?:        number
  /** Treat wallets synced > this many ms ago as stale (default 24h) */
  staleAfterMs?: number
  /** Called after each wallet finishes */
  onProgress?:   (wallet: string, stats: { trades: number; redeems: number; remaining: number }) => void
}

export interface SyncResult {
  processed: number
  totalTrades: number
  totalRedeems: number
  errors: number
}

/**
 * Incremental sync: processes wallets where syncedAt is null or stale.
 * Safe to call repeatedly — idempotent on the DB side.
 */
export async function runSync(opts: SyncOpts = {}): Promise<SyncResult> {
  const { limit, staleAfterMs = 24 * 60 * 60 * 1000, onProgress } = opts

  const wallets = await getStaleWallets(staleAfterMs, limit ?? 10_000)
  const result: SyncResult = { processed: 0, totalTrades: 0, totalRedeems: 0, errors: 0 }

  // Process 5 wallets concurrently — balance throughput vs rate limits
  const CONCURRENCY = 5
  for (let i = 0; i < wallets.length; i += CONCURRENCY) {
    const batch = wallets.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(batch.map(w => syncWallet(w)))

    for (let j = 0; j < results.length; j++) {
      const r = results[j]
      if (r.status === 'fulfilled') {
        result.processed++
        result.totalTrades  += r.value.trades
        result.totalRedeems += r.value.redeems
        onProgress?.(batch[j], {
          trades:    r.value.trades,
          redeems:   r.value.redeems,
          remaining: wallets.length - result.processed - result.errors,
        })
      } else {
        result.errors++
      }
    }
  }

  return result
}
