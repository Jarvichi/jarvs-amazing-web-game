import React from 'react'
import { RunEndCard } from '../ui/RunEndCard'
import { Button } from '../ui/Button'

interface Props {
  actTitle: string
  actSubtitle: string
  relicName: string
  relicDesc: string
  onContinue: () => void
  hasNextAct?: boolean
  /** #2294: bonus cards from clearing this act with a deck-power band above what it expects. */
  overqualifiedCards?: string[]
}

export function ActComplete({ actTitle, actSubtitle, relicName, relicDesc, onContinue, hasNextAct = false, overqualifiedCards }: Props) {
  return (
    <div className="act-complete u-col u-items-c u-gap-8 u-grow u-text-c u-relative">
      <div className="ac-header">
        <div className="ac-cleared">ACT CLEARED</div>
        <div className="ac-act">{actTitle} — {actSubtitle}</div>
      </div>

      <div className="ac-divider">══════════════════════</div>

      <RunEndCard tone="gold" className="ac-relic u-items-c">
        <div className="ac-relic-label">RELIC EARNED</div>
        <div className="ac-relic-name">⬡ {relicName}</div>
        <div className="ac-relic-desc">{relicDesc}</div>
      </RunEndCard>

      {overqualifiedCards && overqualifiedCards.length > 0 && (
        <RunEndCard tone="gold" className="ac-overqualified u-items-c">
          <div className="ac-relic-label">OVERQUALIFIED — BONUS PACK</div>
          <div className="ac-overqualified-desc">
            Your deck outclassed this act. {overqualifiedCards.length} bonus card{overqualifiedCards.length !== 1 ? 's' : ''}: {overqualifiedCards.join(', ')}
          </div>
        </RunEndCard>
      )}

      <div className="ac-flavour">
        The shard falls silent. The Fracture's pull grows stronger.<br />
        Your collection endures. Your mastery carries on.
      </div>

      <Button size="lg" variant="gold" className="ac-continue-btn" onClick={onContinue}>
        {hasNextAct ? 'CONTINUE TO NEXT ACT' : 'RETURN TO MENU'}
      </Button>
    </div>
  )
}
