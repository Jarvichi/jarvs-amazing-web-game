import React from 'react'
import { RunEndCard } from '../ui/RunEndCard'

interface Props {
  actTitle: string
  actSubtitle: string
  relicName: string
  relicDesc: string
  onContinue: () => void
  hasNextAct?: boolean
}

export function ActComplete({ actTitle, actSubtitle, relicName, relicDesc, onContinue, hasNextAct = false }: Props) {
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

      <div className="ac-flavour">
        The shard falls silent. The Fracture's pull grows stronger.<br />
        Your collection endures. Your mastery carries on.
      </div>

      <button className="action-btn action-btn--large action-btn--gold ac-continue-btn" onClick={onContinue}>
        {hasNextAct ? 'CONTINUE TO NEXT ACT' : 'RETURN TO MENU'}
      </button>
    </div>
  )
}
