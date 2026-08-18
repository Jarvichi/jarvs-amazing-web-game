import React from 'react'
import { RunEndCard } from '../ui/RunEndCard'

interface Props {
  onReturnToMenu: () => void
}

export function CampaignFailedScreen({ onReturnToMenu }: Props) {
  return (
    <div className="campaign-failed u-col u-items-c u-just-c u-relative u-text-c">
      <pre className="cf-ascii">{`  ╔══════════════════╗
  ║ CAMPAIGN  FAILED ║
  ╚══════════════════╝`}</pre>
      <RunEndCard tone="ember" className="cf-body u-items-c">
        <p>All lives lost. The Fracture claims another wanderer.</p>
        <p className="cf-reward">You earned <strong>50 ◆</strong> for your effort.</p>
      </RunEndCard>
      <button className="action-btn action-btn--large" onClick={onReturnToMenu}>
        [ Return to Menu ]
      </button>
    </div>
  )
}
