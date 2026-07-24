import React from 'react'
import { loadPlayerName } from '../../game/questline'

interface Props {
  onBeginAnew: () => void
  campaignId?: string
}

interface VictoryCopy {
  title: string
  lines: string[]
}

const VICTORY_COPY: Record<string, VictoryCopy> = {
  c1: {
    title: '⚡ Worldmender ⚡',
    lines: [
      'The Fracture is sealed. The shards breathe again.',
      "{playerName}'s legend echoes across the Dominion.",
    ],
  },
  c2: {
    title: '🕯️ The Kingdom Remembered 🕯️',
    lines: [
      "Amarath is written back onto every map in the Dominion — remembered, at peace, part of the mended Dominion.",
      "{playerName}'s name joins a vigil three centuries kept for exactly this.",
      'Somewhere, the Dominion’s other maps still hold blank quarters. The Fracture erased more than one kingdom.',
    ],
  },
}

export function CampaignVictoryScreen({ onBeginAnew, campaignId = 'c1' }: Props) {
  const playerName = loadPlayerName()
  const copy = VICTORY_COPY[campaignId] ?? VICTORY_COPY.c1
  return (
    <div className="campaign-victory u-col u-items-c u-just-c u-relative u-text-c">
      <div className="cv-glow" />
      <pre className="cv-ascii">{`  ╔══════════════════════╗
  ║  QUESTLINE  COMPLETE ║
  ╚══════════════════════╝`}</pre>
      <div className="cv-body">
        <p className="cv-title">{copy.title}</p>
        {copy.lines.map((line, i) => (
          <p key={i}>{line.replace('{playerName}', playerName)}</p>
        ))}
        <p className="cv-reward">+500 ◆ awarded for completing the questline.</p>
      </div>
      <button className="action-btn action-btn--large action-btn--gold" onClick={onBeginAnew}>
        [ Claim Reward ]
      </button>
    </div>
  )
}
