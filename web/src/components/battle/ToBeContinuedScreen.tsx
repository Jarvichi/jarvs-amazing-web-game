import React from 'react'
import { RunEndCard } from '../ui/RunEndCard'

interface Props {
  /** Display name of the campaign arc, e.g. "The Forgotten Kingdom". */
  campaignName: string
  onContinue: () => void
}

/**
 * Shown when the player clears the last *authored* act of a campaign whose
 * later acts haven't shipped yet (campaign 2 lands act by act). The run ends
 * here; progress, rewards, and act completion counts are already banked.
 */
export function ToBeContinuedScreen({ campaignName, onContinue }: Props) {
  return (
    <div className="campaign-victory u-col u-items-c u-just-c u-relative u-text-c">
      <pre className="cv-ascii">{`  ╔══════════════════════╗
  ║  TO  BE  CONTINUED…  ║
  ╚══════════════════════╝`}</pre>
      <RunEndCard tone="arcane" className="cv-body u-items-c">
        <p className="cv-title">🕯️ {campaignName} 🕯️</p>
        <p>You have reached the edge of the story — for now.</p>
        <p>The next act of {campaignName} is still being written. Your progress, rewards, and relics are safe.</p>
      </RunEndCard>
      <button className="action-btn action-btn--large action-btn--gold" onClick={onContinue}>
        [ Return ]
      </button>
    </div>
  )
}
