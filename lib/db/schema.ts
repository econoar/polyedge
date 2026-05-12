import {
  pgTable, text, real, integer, jsonb, timestamp,
  serial, index, uniqueIndex,
} from 'drizzle-orm/pg-core'

export const traders = pgTable('traders', {
  wallet:          text('wallet').primaryKey(),
  name:            text('name'),
  pseudonym:       text('pseudonym'),
  bio:             text('bio'),
  profileImage:    text('profile_image'),
  profit:          real('profit').notNull().default(0),
  volume:          real('volume').notNull().default(0),
  percentPnl:      real('percent_pnl').notNull().default(0),
  marketsTraded:   integer('markets_traded').notNull().default(0),
  sharpScore:      real('sharp_score'),
  botAnalysis:     jsonb('bot_analysis'),
  humanConfidence: real('human_confidence'),
  firstSeenAt:     timestamp('first_seen_at').defaultNow().notNull(),
  syncedAt:        timestamp('synced_at'),   // null = pending sync
})

// All trade events: type = 'TRADE' (BUY/SELL) or 'REDEEM' (winning resolution)
export const activity = pgTable('activity', {
  id:        serial('id').primaryKey(),
  wallet:    text('wallet').notNull(),
  timestamp: integer('timestamp').notNull(),
  type:      text('type').notNull(),   // TRADE | REDEEM
  side:      text('side'),             // BUY | SELL | null for REDEEM
  slug:      text('slug').notNull().default(''),
  title:     text('title').notNull().default(''),
  outcome:   text('outcome').notNull().default(''),
  icon:      text('icon'),
  size:      real('size').notNull().default(0),
  usdcSize:  real('usdc_size').notNull().default(0),
  price:     real('price').notNull().default(0),
  txHash:    text('tx_hash').notNull(),  // synthetic fallback: `${wallet}:${ts}:${slug}:${type}`
  syncedAt:  timestamp('synced_at').defaultNow().notNull(),
}, (t) => ({
  walletIdx:       index('activity_wallet_idx').on(t.wallet),
  walletTxHashIdx: uniqueIndex('activity_wallet_tx_hash_idx').on(t.wallet, t.txHash),
}))

// Point-in-time position snapshots (taken at sync time)
export const positions = pgTable('positions', {
  id:            serial('id').primaryKey(),
  wallet:        text('wallet').notNull(),
  slug:          text('slug').notNull(),
  title:         text('title').notNull().default(''),
  outcome:       text('outcome').notNull().default(''),
  size:          real('size').notNull().default(0),
  avgPrice:      real('avg_price').notNull().default(0),
  curPrice:      real('cur_price').notNull().default(0),
  currentValue:  real('current_value').notNull().default(0),
  cashPnl:       real('cash_pnl').notNull().default(0),
  percentPnl:    real('percent_pnl').notNull().default(0),
  snapshottedAt: timestamp('snapshotted_at').defaultNow().notNull(),
}, (t) => ({
  walletIdx: index('positions_wallet_idx').on(t.wallet),
}))

// Market metadata — enriched as we see slugs in activity
export const markets = pgTable('markets', {
  slug:           text('slug').primaryKey(),
  title:          text('title').notNull().default(''),
  icon:           text('icon'),
  category:       text('category'),
  endDate:        timestamp('end_date'),
  resolvedAt:     timestamp('resolved_at'),
  winningOutcome: text('winning_outcome'),
  volume:         real('volume').notNull().default(0),
  firstSeenAt:    timestamp('first_seen_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
})

// One row per daily Sharp Score computation — enables trend/history display
export const sharpScores = pgTable('sharp_scores', {
  id:                 serial('id').primaryKey(),
  wallet:             text('wallet').notNull(),
  score:              real('score').notNull(),
  entryTiming:        real('entry_timing').notNull(),
  contrarianAccuracy: real('contrarian_accuracy').notNull(),
  repeatability:      real('repeatability').notNull(),
  stakeSizing:        real('stake_sizing').notNull(),
  computedAt:         timestamp('computed_at').defaultNow().notNull(),
}, (t) => ({
  walletIdx: index('sharp_scores_wallet_idx').on(t.wallet),
}))
