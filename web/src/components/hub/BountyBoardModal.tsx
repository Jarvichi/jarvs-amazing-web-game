import React, { useState } from 'react'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { Panel } from '../ui/Panel'
import { getDailyBounties, isBountyAccepted, isBountyCompleted, acceptBounty, turnInBounty, getActiveBountyStepHint, type BountyReward } from '../../game/hub/bounties'
import type { RivalNpc } from '../../game/hub/relationships'

interface Props {
  onClose: () => void
  /** Resolve an NPC/animal id to its display name (for report-step hints and reward lines). */
  resolveNpcName?: (id: string) => string
  /** Same-town NPCs — threaded into turnInBounty so friendship/relationship rewards trigger rivalry (§7c). */
  townNpcs?: RivalNpc[]
}

// Extra reward lines beyond the ever-present crystals line — mirrors
// HubWorld.tsx's formatQuestReward for the same reward shape.
function formatExtraReward(reward: BountyReward, resolveNpcName: (id: string) => string): string | null {
  const parts: string[] = []
  if (reward.friendship) {
    for (const [npcId, xp] of Object.entries(reward.friendship)) {
      parts.push(`+${xp} friendship with ${resolveNpcName(npcId)}`)
    }
  }
  if (reward.relationship) {
    for (const [npcId, grant] of Object.entries(reward.relationship)) {
      parts.push(`+${grant.points} ${grant.track} with ${resolveNpcName(npcId)}`)
    }
  }
  return parts.length > 0 ? parts.join('  ·  ') : null
}

export function BountyBoardModal({ onClose, resolveNpcName = (id) => id, townNpcs = [] }: Props) {
  const [, setTick] = useState(0)
  const refresh = () => setTick(t => t + 1)

  const bounties  = getDailyBounties()
  const available = bounties.filter(b => !isBountyAccepted(b.id) && !isBountyCompleted(b.id))
  const accepted  = bounties.filter(b => isBountyAccepted(b.id))
  const completed = bounties.filter(b => isBountyCompleted(b.id))

  return (
    <ModalBackdrop onClose={onClose} title="Bounty Board">
      <Panel elevation="floating" className="bounty-board-modal">
        <div className="bounty-board-modal__header">
          <span>📋 Bounty Board</span>
          <span className="bounty-board-modal__meta">
            {completed.length} of {bounties.length}
            <button className="bounty-board-modal__close" onClick={onClose} aria-label="Close">✕</button>
          </span>
        </div>

        {available.length > 0 && (
          <>
            <div className="bounty-board-modal__section-label">Available</div>
            {available.map(bounty => (
              <div key={bounty.id} className="bounty-board-modal__card">
                <div className="bounty-board-modal__title-row">
                  <span className="bounty-board-modal__title">{bounty.icon} {bounty.title}</span>
                  <button
                    className="action-btn"
                    onClick={() => { acceptBounty(bounty.id); refresh() }}
                  >Accept</button>
                </div>
                <div className="bounty-board-modal__desc">{bounty.desc}</div>
                <div className="bounty-board-modal__reward">+{bounty.reward.crystals} 💎</div>
                {formatExtraReward(bounty.reward, resolveNpcName) && (
                  <div className="bounty-board-modal__reward">{formatExtraReward(bounty.reward, resolveNpcName)}</div>
                )}
              </div>
            ))}
          </>
        )}

        {accepted.length > 0 && (
          <>
            <div className="bounty-board-modal__section-label">Accepted</div>
            {accepted.map(bounty => {
              const hint = getActiveBountyStepHint(bounty, resolveNpcName)
              return (
                <div key={bounty.id} className="bounty-board-modal__card bounty-board-modal__card--accepted">
                  <div className="bounty-board-modal__title-row">
                    <span className="bounty-board-modal__title">{bounty.icon} {bounty.title}</span>
                    <button
                      className={`action-btn action-btn--gold${hint ? ' action-btn--disabled' : ''}`}
                      disabled={!!hint}
                      onClick={() => { turnInBounty(bounty.id, townNpcs); refresh() }}
                    >Turn In</button>
                  </div>
                  <div className="bounty-board-modal__desc">{bounty.desc}</div>
                  {hint && <div className="bounty-board-modal__hint">{hint}</div>}
                  <div className="bounty-board-modal__reward">+{bounty.reward.crystals} 💎</div>
                  {formatExtraReward(bounty.reward, resolveNpcName) && (
                    <div className="bounty-board-modal__reward">{formatExtraReward(bounty.reward, resolveNpcName)}</div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {completed.length > 0 && (
          <>
            <div className="bounty-board-modal__section-label">Completed</div>
            {completed.map(bounty => (
              <div key={bounty.id} className="bounty-board-modal__card bounty-board-modal__card--completed">
                <div className="bounty-board-modal__title">✅ {bounty.icon} {bounty.title}</div>
                <div className="bounty-board-modal__reward">+{bounty.reward.crystals} 💎</div>
                {formatExtraReward(bounty.reward, resolveNpcName) && (
                  <div className="bounty-board-modal__reward">{formatExtraReward(bounty.reward, resolveNpcName)}</div>
                )}
              </div>
            ))}
          </>
        )}
      </Panel>
    </ModalBackdrop>
  )
}
