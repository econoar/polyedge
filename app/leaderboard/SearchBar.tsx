'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Status = 'idle' | 'loading' | 'not-found'

export default function SearchBar() {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return

    setStatus('idle')

    // Wallet address — navigate directly
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      router.push(`/trader/${trimmed}`)
      return
    }

    // Name search — query the API
    setStatus('loading')
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
      const data = await res.json()
      if (data.wallet) {
        router.push(`/trader/${data.wallet}`)
      } else {
        setStatus('not-found')
      }
    } catch {
      setStatus('not-found')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="search-form">
      <input
        type="text"
        className={`search-input${status === 'not-found' ? ' search-input-invalid' : ''}`}
        placeholder="Search name or 0x wallet…"
        value={value}
        onChange={e => { setValue(e.target.value); setStatus('idle') }}
        spellCheck={false}
        autoComplete="off"
        disabled={status === 'loading'}
      />
      <button type="submit" className="search-btn" disabled={status === 'loading'}>
        {status === 'loading' ? '…' : 'Go →'}
      </button>
      {status === 'not-found' && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)', whiteSpace: 'nowrap' }}>
          No match — try a full 0x wallet address
        </div>
      )}
    </form>
  )
}
