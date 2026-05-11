import type { Metadata } from 'next'
import './globals.css'
import ThemeToggle from './ThemeToggle'

export const metadata: Metadata = {
  title: 'PolyEdge — Polymarket Trader Leaderboard',
  description: 'Track the sharpest traders on Polymarket. On-chain verified PnL, open positions, and real-time leaderboards.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Runs before hydration to prevent flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('theme')==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}` }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <nav>
          <a href="/" className="logo">POLYEDGE</a>
          <div className="nav-links">
            <a href="/leaderboard">Leaderboard</a>
            <a href="/hot">Hot Now</a>
            <a href="/watchlist">Watchlist</a>
            <ThemeToggle />
          </div>
        </nav>
        <main>{children}</main>
        <footer>
          <span>Data from Polymarket public API · On-chain verified · Not financial advice</span>
        </footer>
      </body>
    </html>
  )
}
