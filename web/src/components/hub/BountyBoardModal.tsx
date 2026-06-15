import React, { useState } from 'react'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import type { BountyDef } from '../../game/hub/bounties'
import { getBountyState, getBountyProgress, isBountyReadyToComplete } from '../../game/hub/bounties'

interface Props {
  onClose: () => void
  bountyDefs: BountyDef[]
  onAccept: (bountyId: string) => void
  onTurnIn: (bountyId: string) => void
}

function progressDots(current: number, required: number): string {
  const filled = Math.min(current, required)
  return '●'.repeat(filled) + '○'.repeat(Math.max(0, required - filled))
}

export function BountyBoardModal({ onClose, bountyDefs, onAccept, onTurnIn }: Props) {
  const [tab, setTab] = useState<'available' | 'active' | 'completed'>('available')

  const available = bountyDefs.filter(b => getBountyState(b.id).status === 'available')
  const active    = bountyDefs.filter(b => getBountyState(b.id).status === 'active')
  const completed = bountyDefs.filter(b => {
    const s = getBountyState(b.id).status
    return s === 'completed' || s === 'turned-in'
  })

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="bounty-modal">
        <div className="bounty-modal__header">
          <span>🎯 Bounty Board</span>
          <span className="bounty-modal__meta">
            <button className="bounty-modal__close" onClick={onClose}>✕</button>
          </span>
        </div>

        <div className="bounty-modal__tabs">
          {(['available', 'active', 'completed'] as const).map(t => (
            <button
              key={t}
              className={`bounty-modal__tab${tab === t ? ' bounty-modal__tab--active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'available' && (
          <>
            {available.length === 0 && (
              <div className="bounty-modal__empty">No new bounties today — check back tomorrow!</div>
            )}
            {available.map(bounty => (
              <div key={bounty.id} className="bounty-modal__card">
                <div className="bounty-modal__title">{bounty.title}</div>
                <div className="bounty-modal__steps">
                  {bounty.steps.map(step => (
                    <div key={step.key} className="bounty-modal__step">
                      <span>{step.description}</span>
                      <span>{step.required > 1 ? `×${step.required}` : ''}</span>
                    </div>
                  ))}
                </div>
                <div className="bounty-modal__reward">
                  {bounty.reward.crystals ? `+${bounty.reward.crystals} 💎` : ''}
                  {bounty.reward.collectible ? ` · ${bounty.reward.collectible.icon} ${bounty.reward.collectible.name}` : ''}
                </div>
                <button className="bounty-modal__action" onClick={() => onAccept(bounty.id)}>Accept</button>
              </div>
            ))}
          </>
        )}

        {tab === 'active' && (
          <>
            {active.length === 0 && (
              <div className="bounty-modal__empty">No active bounties — pick one from Available!</div>
            )}
            {active.map(bounty => {
              const ready = isBountyReadyToComplete(bounty)
              return (
                <div key={bounty.id} className="bounty-modal__card bounty-modal__card--active">
                  <div className="bounty-modal__title">{bounty.title}</div>
                  {bounty.steps.map(step => {
                    const current = getBountyProgress(bounty.id, step.key)
                    return (
                      <div key={step.key} className="bounty-modal__step">
                        <span>{step.description}</span>
                        <span>{progressDots(current, step.required)} {current}/{step.required}</span>
                      </div>
                    )
                  })}
                  {ready ? (
                    <button className="bounty-modal__action bounty-modal__action--ready" onClick={() => onTurnIn(bounty.id)}>Turn In</button>
                  ) : (
                    <div className="bounty-modal__hint">In progress…</div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {tab === 'completed' && (
          <>
            {completed.length === 0 && (
              <div className="bounty-modal__empty">No completed bounties yet.</div>
            )}
            {completed.map(bounty => {
              const state = getBountyState(bounty.id)
              return (
                <div key={bounty.id} className="bounty-modal__card bounty-modal__card--completed">
                  <div className="bounty-modal__title">{bounty.title}</div>
                  <div className="bounty-modal__reward">
                    {state.status === 'turned-in' ? 'Turned in ✅' : 'Completed'}
                    {bounty.reward.crystals ? ` · +${bounty.reward.crystals} 💎` : ''}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </ModalBackdrop>
  )
}
