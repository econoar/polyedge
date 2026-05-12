import { NextRequest, NextResponse } from 'next/server'
import { getLeaderboard } from '@/lib/polymarket'

export const revalidate = 300

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase()
  if (!q || q.length < 2) return NextResponse.json({ wallet: null })

  // Search top 50 by profit and top 50 by volume — deduplicated, covers most known names.
  const [byProfit, byVolume] = await Promise.allSettled([
    getLeaderboard('all', 50, 'profit'),
    getLeaderboard('all', 50, 'volume'),
  ])

  const seen  = new Set<string>()
  const pool  = [...(byProfit.status === 'fulfilled' ? byProfit.value : []),
                  ...(byVolume.status === 'fulfilled' ? byVolume.value : [])]
    .filter(e => { if (seen.has(e.proxyWallet)) return false; seen.add(e.proxyWallet); return true })

  const match = pool.find(e => {
    const name = (e.name || e.pseudonym || '').toLowerCase()
    return name.includes(q)
  })

  return NextResponse.json({ wallet: match?.proxyWallet ?? null })
}
