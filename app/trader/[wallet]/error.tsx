'use client'

export default function TraderError({ error }: { error: Error }) {
  return (
    <div className="error-box" style={{ marginTop: '2rem' }}>
      <strong>Failed to load trader</strong>
      <pre style={{ marginTop: 8, fontSize: 11, whiteSpace: 'pre-wrap' }}>{error.message}</pre>
    </div>
  )
}
