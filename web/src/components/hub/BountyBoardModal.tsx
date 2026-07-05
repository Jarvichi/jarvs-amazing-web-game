import React, { useState } from 'react'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { getDailyBounties, isBountyAccepted, isBountyCompleted, acceptBounty, turnInBounty, getActiveBountyStepHint } from '../../game/hub/bounties'

interface Props {
  onClose: () => void
  /** Resolve an NPC/animal id to its display name (for report-step hints). */
  resolveNpcName?: (id: string) => string
}

export function BountyBoardModal({ onClose, resolveNpcName = (id) => id }: Props) {
  const [, setTick] = useState(0)
  const refresh = () => setTick(t => t + 1)

  const bounties  = getDailyBounties()
  const available = bounties.filter(b => !isBountyAccepted(b.id) && !isBountyCompleted(b.id))
  const accepted  = bounties.filter(b => isBountyAccepted(b.id))
  const completed = bounties.filter(b => isBountyCompleted(b.id))

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bounty-board-modal">
        <div className="bounty-board-modal__header">
          <span>📋 Bounty Board</span>
          <span className="bounty-board-modal__meta">
            {completed.length} of {bounties.length}
            <button className="bounty-board-modal__close" onClick={onClose}>✕</button>
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
                      onClick={() => { turnInBounty(bounty.id); refresh() }}
                    >Turn In</button>
                  </div>
                  <div className="bounty-board-modal__desc">{bounty.desc}</div>
                  {hint && <div className="bounty-board-modal__hint">{hint}</div>}
                  <div className="bounty-board-modal__reward">+{bounty.reward.crystals} 💎</div>
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
              </div>
            ))}
          </>
        )}
      </div>
    </ModalBackdrop>
  )
}
