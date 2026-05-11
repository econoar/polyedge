# PolyEdge

Polymarket trader leaderboard and social layer. Track the sharpest wallets, see their open positions, and find what markets smart money is concentrated in.

## Stack

- **Next.js 14** (App Router, server components)
- **TypeScript**
- **No database** — reads directly from Polymarket's public APIs
- **Vercel** — deploy in one click

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Pages

| Route | Description |
|---|---|
| `/` | Homepage |
| `/leaderboard` | Top traders by profit or volume, filterable by time window |
| `/trader/[wallet]` | Individual profile: stats, open positions, trade history |
| `/hot` | Markets the top 20 wallets are currently holding |

## APIs used

All public, no auth required:

- `gamma-api.polymarket.com` — profiles, market metadata
- `data-api.polymarket.com` — leaderboard, positions, activity

## Monetization

Register as a Polymarket Builder to earn referral fees on trades from users you send to Polymarket:
https://docs.polymarket.com/builders/builder-program

## Deploy to Vercel

```bash
npx vercel
```

That's it — no environment variables needed for the public read endpoints.

## Next steps to build

- [ ] Email/wallet follow alerts (Resend + cron)
- [ ] Search by wallet address
- [ ] Historical PnL chart per trader
- [ ] Category filtering (Politics, Sports, Crypto)
- [ ] Share card generation (og:image per trader)
- [ ] Mobile app (React Native)
