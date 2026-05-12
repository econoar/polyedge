import { eq, and, lt, isNull, or, desc, sql } from 'drizzle-orm'
import { getDb } from './index'
import { traders, activity as activityTable } from './schema'
import type { Activity, Redeem } from '@/lib/polymarket'

// ── Read helpers ──────────────────────────────────────────────────────────────

export async function isWalletSynced(wallet: string): Promise<boolean> {
  try {
    const db = getDb()
    const rows = await db
      .select({ syncedAt: traders.syncedAt })
      .from(traders)
      .where(eq(traders.wallet, wallet.toLowerCase()))
      .limit(1)
    return !!(rows[0]?.syncedAt)
  } catch {
    return false
  }
}

export async function getActivityFromDb(wallet: string): Promise<Activity[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(activityTable)
    .where(and(
      eq(activityTable.wallet, wallet.toLowerCase()),
      eq(activityTable.type, 'TRADE'),
    ))
    .orderBy(desc(activityTable.timestamp))
  return rows.map(r => ({
    proxyWallet:     wallet,
    side:            (r.side ?? 'BUY') as 'BUY' | 'SELL',
    title:           r.title,
    slug:            r.slug,
    icon:            r.icon ?? null,
    outcome:         r.outcome,
    size:            r.size,
    usdcSize:        r.usdcSize,
    price:           r.price,
    timestamp:       r.timestamp,
    transactionHash: r.txHash,
    name:            null,
    pseudonym:       null,
    profileImage:    null,
  }))
}

export async function getRedeemsFromDb(wallet: string): Promise<Redeem[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(activityTable)
    .where(and(
      eq(activityTable.wallet, wallet.toLowerCase()),
      eq(activityTable.type, 'REDEEM'),
    ))
  return rows.map(r => ({
    proxyWallet: wallet,
    slug:        r.slug,
    title:       r.title,
    usdcSize:    r.usdcSize,
    timestamp:   r.timestamp,
  }))
}

export async function getUnsyncedWallets(limit = 50): Promise<string[]> {
  const db = getDb()
  const rows = await db
    .select({ wallet: traders.wallet })
    .from(traders)
    .where(isNull(traders.syncedAt))
    .limit(limit)
  return rows.map(r => r.wallet)
}

export async function getStaleWallets(olderThanMs = 24 * 60 * 60 * 1000, limit = 50): Promise<string[]> {
  const db = getDb()
  const threshold = new Date(Date.now() - olderThanMs)
  const rows = await db
    .select({ wallet: traders.wallet })
    .from(traders)
    .where(or(
      isNull(traders.syncedAt),
      lt(traders.syncedAt, threshold),
    ))
    .limit(limit)
  return rows.map(r => r.wallet)
}

// ── Write helpers ─────────────────────────────────────────────────────────────

export async function upsertTraderSeed(data: {
  wallet:        string
  name:          string | null
  pseudonym:     string | null
  profileImage:  string | null
  profit:        number
  volume:        number
  percentPnl:    number
  marketsTraded: number
}) {
  const db = getDb()
  await db
    .insert(traders)
    .values({
      wallet:        data.wallet.toLowerCase(),
      name:          data.name,
      pseudonym:     data.pseudonym,
      profileImage:  data.profileImage,
      profit:        data.profit,
      volume:        data.volume,
      percentPnl:    data.percentPnl,
      marketsTraded: data.marketsTraded,
    })
    .onConflictDoUpdate({
      target: traders.wallet,
      set: {
        name:         data.name,
        pseudonym:    data.pseudonym,
        profileImage: data.profileImage,
        profit:       data.profit,
        volume:       data.volume,
        percentPnl:   data.percentPnl,
      },
    })
}

export async function markWalletSynced(wallet: string) {
  const db = getDb()
  await db
    .update(traders)
    .set({ syncedAt: new Date() })
    .where(eq(traders.wallet, wallet.toLowerCase()))
}

type ActivityRow = {
  wallet:    string
  timestamp: number
  type:      string
  side:      string | null
  slug:      string
  title:     string
  outcome:   string
  icon:      string | null
  size:      number
  usdcSize:  number
  price:     number
  txHash:    string
}

export async function upsertActivityBatch(rows: ActivityRow[]) {
  if (!rows.length) return
  const db = getDb()
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db
      .insert(activityTable)
      .values(rows.slice(i, i + CHUNK).map(r => ({ ...r, wallet: r.wallet.toLowerCase() })))
      .onConflictDoNothing()
  }
}

export async function getTraderCount(): Promise<number> {
  const db = getDb()
  const rows = await db.select({ c: sql<number>`count(*)` }).from(traders)
  return Number(rows[0]?.c ?? 0)
}

export async function getSyncedCount(): Promise<number> {
  const db = getDb()
  const rows = await db
    .select({ c: sql<number>`count(*)` })
    .from(traders)
    .where(sql`synced_at IS NOT NULL`)
  return Number(rows[0]?.c ?? 0)
}
