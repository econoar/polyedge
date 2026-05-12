import type { BotAnalysis } from '@/lib/polymarket'

interface Props {
  confidence: BotAnalysis['humanConfidence']
  showLabel?: boolean
}

export default function HumanBadge({ confidence, showLabel = true }: Props) {
  if (confidence === 'verified') {
    return (
      <span className="human-badge human-verified">
        ✓{showLabel ? ' Verified Human' : ''}
      </span>
    )
  }
  if (confidence === 'unverified') {
    return (
      <span className="human-badge human-unverified">
        ?{showLabel ? ' Unverified' : ''}
      </span>
    )
  }
  return (
    <span className="human-badge human-bot">
      ⚠{showLabel ? ' Likely Bot' : ''}
    </span>
  )
}
