'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SearchBar() {
  const [value, setValue]   = useState('')
  const [invalid, setInvalid] = useState(false)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setInvalid(false)
      router.push(`/trader/${trimmed}`)
    } else {
      setInvalid(true)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="search-form">
      <input
        type="text"
        className={`search-input${invalid ? ' search-input-invalid' : ''}`}
        placeholder="Jump to wallet  0x..."
        value={value}
        onChange={e => { setValue(e.target.value); setInvalid(false) }}
        spellCheck={false}
        autoComplete="off"
      />
      <button type="submit" className="search-btn">Go →</button>
    </form>
  )
}
