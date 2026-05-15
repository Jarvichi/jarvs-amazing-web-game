import React from 'react'
import { loadPlayerName } from '../../game/questline'

interface Props {
  onBeginAnew: () => void
}

export function CampaignVictoryScreen({ onBeginAnew }: Props) {
  const playerName = loadPlayerName()
  return (
    <div className="campaign-victory">
      <div className="cv-glow" />
      <pre className="cv-ascii">{`  ╔══════════════════════╗
  ║  QUESTLINE  COMPLETE ║
  ╚══════════════════════╝`}</pre>
      <div className="cv-body">
        <p className="cv-title">⚡ Worldmender ⚡</p>
        <p>The Fracture is sealed. The shards breathe again.</p>
        <p>{playerName}'s legend echoes across the Dominion.</p>
        <p className="cv-reward">+500 ◆ awarded for completing the questline.</p>
      </div>
      <button className="action-btn action-btn--large action-btn--gold" onClick={onBeginAnew}>
        [ Claim Reward ]
      </button>
    </div>
  )
}
