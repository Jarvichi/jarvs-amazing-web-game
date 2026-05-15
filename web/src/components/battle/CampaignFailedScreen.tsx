import React from 'react'

interface Props {
  onReturnToMenu: () => void
}

export function CampaignFailedScreen({ onReturnToMenu }: Props) {
  return (
    <div className="campaign-failed">
      <div className="cf-glow" />
      <pre className="cf-ascii">{`  ╔══════════════════╗
  ║ CAMPAIGN  FAILED ║
  ╚══════════════════╝`}</pre>
      <div className="cf-body">
        <p>All lives lost. The Fracture claims another wanderer.</p>
        <p className="cf-reward">You earned <strong>50 ◆</strong> for your effort.</p>
      </div>
      <button className="action-btn action-btn--large" onClick={onReturnToMenu}>
        [ Return to Menu ]
      </button>
    </div>
  )
}
