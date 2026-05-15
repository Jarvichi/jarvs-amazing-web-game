import React from 'react'

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
    <div className="act-complete">
      <div className="ac-glow" />

      <div className="ac-header">
        <div className="ac-cleared">ACT CLEARED</div>
        <div className="ac-act">{actTitle} — {actSubtitle}</div>
      </div>

      <div className="ac-divider">══════════════════════</div>

      <div className="ac-relic">
        <div className="ac-relic-label">RELIC EARNED</div>
        <div className="ac-relic-name">⬡ {relicName}</div>
        <div className="ac-relic-desc">{relicDesc}</div>
      </div>

      <div className="ac-flavour">
        The shard falls silent. The Fracture's pull grows stronger.<br />
        Your collection endures. Your mastery carries on.
      </div>

      <button className="action-btn action-btn--large ac-continue-btn" onClick={onContinue}>
        {hasNextAct ? 'CONTINUE TO NEXT ACT' : 'RETURN TO MENU'}
      </button>
    </div>
  )
}
