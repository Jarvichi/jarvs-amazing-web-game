import React from 'react'

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
      <div className="cv-glow" />
      <pre className="cv-ascii">{`  ╔══════════════════════╗
  ║  TO  BE  CONTINUED…  ║
  ╚══════════════════════╝`}</pre>
      <div className="cv-body">
        <p className="cv-title">🕯️ {campaignName} 🕯️</p>
        <p>You have reached the edge of the story — for now.</p>
        <p>The next act of {campaignName} is still being written. Your progress, rewards, and relics are safe.</p>
      </div>
      <button className="action-btn action-btn--large action-btn--gold" onClick={onContinue}>
        [ Return ]
      </button>
    </div>
  )
}
