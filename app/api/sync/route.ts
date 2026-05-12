import { NextRequest, NextResponse } from 'next/server'
import { discoverWallets, runSync } from '@/lib/sync'
import { getTraderCount, getSyncedCount } from '@/lib/db/queries'

// No caching — this is a mutation endpoint
export const dynamic = 'force-dynamic'

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  if (!auth) return false
  const token = auth.replace(/^Bearer\s+/i, '')
  // Accept Vercel's auto-injected cron secret or our manual SYNC_SECRET
  return (
    (!!process.env.CRON_SECRET  && token === process.env.CRON_SECRET)  ||
    (!!process.env.SYNC_SECRET  && token === process.env.SYNC_SECRET)
  )
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body   = await req.json().catch(() => ({}))
  const action = (body.action as string) ?? 'sync'
  // How many wallets to process per invocation (Vercel has 5 min timeout)
  const limit  = Number(body.limit ?? 30)

  try {
    if (action === 'discover') {
      const seeded = await discoverWallets({ log: false })
      return NextResponse.json({ ok: true, action: 'discover', seeded })
    }

    if (action === 'status') {
      const [total, synced] = await Promise.all([getTraderCount(), getSyncedCount()])
      return NextResponse.json({ ok: true, total, synced, pending: total - synced })
    }

    // Default: incremental sync of stale wallets
    const result = await runSync({ limit })
    return NextResponse.json({ ok: true, action: 'sync', ...result })

  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const [total, synced] = await Promise.all([getTraderCount(), getSyncedCount()])
  return NextResponse.json({ ok: true, total, synced, pending: total - synced })
}
