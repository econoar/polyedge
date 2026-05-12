#!/usr/bin/env tsx
/**
 * CLI sync runner for the initial full sync and one-off wallet syncs.
 *
 * Usage:
 *   npm run sync                          # sync all stale wallets (forever)
 *   npm run sync:discover                 # seed traders table from leaderboard
 *   npm run sync:wallet 0xabc...          # sync a single wallet
 *
 * Run with: npm run sync (uses dotenv-cli to load .env.local)
 */

import { discoverWallets, runSync, syncWallet } from '../lib/sync'
import { getTraderCount, getSyncedCount } from '../lib/db/queries'

async function main() {
  const args = process.argv.slice(2)

  // Single-wallet mode: tsx scripts/sync.ts --wallet 0x...
  const walletIdx = args.indexOf('--wallet')
  if (walletIdx !== -1) {
    const wallet = args[walletIdx + 1]
    if (!wallet) { console.error('--wallet requires an address'); process.exit(1) }
    console.log(`Syncing ${wallet}...`)
    const stats = await syncWallet(wallet)
    console.log(`Done: ${stats.trades} trades, ${stats.redeems} redeems`)
    process.exit(0)
  }

  // Discover mode: seeds traders table from Polymarket leaderboard
  if (args.includes('--discover')) {
    console.log('Discovering wallets from Polymarket leaderboard...')
    const seeded = await discoverWallets({ log: true })
    const total  = await getTraderCount()
    console.log(`Seeded ${seeded} wallets. Total in DB: ${total}`)
    process.exit(0)
  }

  // Full sync mode: processes all stale/unsynced wallets
  const [total, synced] = await Promise.all([getTraderCount(), getSyncedCount()])
  const pending = total - synced
  console.log(`Starting full sync. Total wallets: ${total}, synced: ${synced}, pending: ${pending}`)
  if (pending === 0) {
    console.log('All wallets are up to date.')
    process.exit(0)
  }

  let processed = 0
  const start = Date.now()

  // Run indefinitely in batches until all wallets are synced
  while (true) {
    const result = await runSync({
      limit: 50,
      onProgress: (wallet, stats) => {
        processed++
        const elapsed  = ((Date.now() - start) / 1000 / 60).toFixed(1)
        const rate     = (processed / (Date.now() - start) * 60_000).toFixed(1)
        process.stdout.write(
          `\r[${elapsed}m] ${processed}/${pending} wallets | ${rate}/min | ` +
          `${wallet.slice(0, 8)}… ${stats.trades}t ${stats.redeems}r  `
        )
      },
    })

    if (result.processed === 0) {
      console.log('\nAll wallets synced.')
      break
    }
  }

  const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1)
  console.log(`\nSync complete in ${elapsed} minutes.`)
  process.exit(0)
}

main().catch(err => {
  console.error('Sync failed:', err)
  process.exit(1)
})
