import React, { useState } from 'react'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import type { HubQuestDef } from '../../data/hub/questDefs'
import { getQuestState, getQuestProgress } from '../../game/hub/quests'
import { getDailyBounties, isBountyAccepted, isBountyCompleted, getActiveBountyStepHint } from '../../game/hub/bounties'

interface Props {
  onClose: () => void
  onAbandon: (questId: string) => void
  questDefs: HubQuestDef[]
  /** Resolve an NPC/animal id to its display name (for deliver-step labels). */
  resolveNpcName?: (id: string) => string
}

function progressDots(current: number, required: number): string {
  const filled = Math.min(current, required)
  return '●'.repeat(filled) + '○'.repeat(Math.max(0, required - filled))
}

/** Human-readable label for a quest objective. Deliver steps name their target
 *  NPC so it matches the character you actually see in the world; other steps
 *  fall back to a title-cased version of the step key. */
function stepLabel(step: HubQuestDef['steps'][number], resolveNpcName: (id: string) => string): string {
  if (step.type === 'deliver' && step.targetNpcId) {
    return `Deliver to ${resolveNpcName(step.targetNpcId)}`
  }
  return step.key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function getActiveHint(quest: HubQuestDef): string {
  const { activeDialogue } = quest
  if (typeof activeDialogue === 'string') return activeDialogue
  for (const step of quest.steps) {
    if (getQuestProgress(quest.id, step.key) < step.required) {
      return activeDialogue[step.key] ?? (Object.values(activeDialogue)[0] || "Hello")
    }
  }
  return Object.values(activeDialogue)[Object.values(activeDialogue).length - 1] || "Hello"
}

export function QuestsContent({ onClose, onAbandon, questDefs, resolveNpcName = (id) => id }: Props) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const active    = questDefs.filter(q => getQuestState(q.id).status === 'active')
  const completed = questDefs.filter(q => getQuestState(q.id).status === 'completed')
  const discovered = active.length + completed.length
  const total      = questDefs.length

  const acceptedBounties = getDailyBounties().filter(b => isBountyAccepted(b.id) && !isBountyCompleted(b.id))

  return (
      <div className="quests-modal">
        <div className="quests-modal__header">
          <span>📜 Quests</span>
          <span className="quests-modal__meta">
            {discovered} of {total}
            <button className="quests-modal__close" onClick={onClose}>✕</button>
          </span>
        </div>

        {discovered === 0 && acceptedBounties.length === 0 && (
          <div className="quests-modal__empty">No quests active yet — talk to the townsfolk.</div>
        )}

        {active.length > 0 && (
          <>
            <div className="quests-modal__section-label">Active</div>
            {active.map(quest => (
              <div key={quest.id} className="quests-modal__card quests-modal__card--active">
                <div className="quests-modal__title-row">
                  <span className="quests-modal__title">🟡 {quest.title}</span>
                  <button
                    className="quests-modal__abandon-btn"
                    onClick={() => setConfirmingId(confirmingId === quest.id ? null : quest.id)}
                    title="Abandon quest"
                  >✕</button>
                </div>
                {quest.steps.map(step => {
                  const current = getQuestProgress(quest.id, step.key)
                  const label   = stepLabel(step, resolveNpcName)
                  return (
                    <div key={step.key} className="quests-modal__step">
                      <span>{label}</span>
                      <span>{progressDots(current, step.required)} {current}/{step.required}</span>
                    </div>
                  )
                })}
                {confirmingId === quest.id ? (
                  <div className="quests-modal__confirm">
                    <span>Abandon this quest? Collected items will return to the world.</span>
                    <div className="quests-modal__confirm-btns">
                      <button onClick={() => { onAbandon(quest.id); setConfirmingId(null) }}>Abandon</button>
                      <button onClick={() => setConfirmingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="quests-modal__hint">{getActiveHint(quest)}</div>
                )}
              </div>
            ))}
          </>
        )}

        {acceptedBounties.length > 0 && (
          <>
            <div className="quests-modal__section-label">Bounties</div>
            {acceptedBounties.map(bounty => {
              const hint = getActiveBountyStepHint(bounty, resolveNpcName)
              return (
                <div key={bounty.id} className="quests-modal__card quests-modal__card--active">
                  <div className="quests-modal__title-row">
                    <span className="quests-modal__title">{bounty.icon} {bounty.title}</span>
                  </div>
                  <div className="quests-modal__desc">{bounty.desc}</div>
                  {hint && <div className="quests-modal__hint">{hint}</div>}
                  <div className="quests-modal__reward">+{bounty.reward.crystals} 💎</div>
                </div>
              )
            })}
          </>
        )}

        {completed.length > 0 && (
          <>
            <div className="quests-modal__section-label">Completed</div>
            {completed.map(quest => {
              const { reward } = quest
              const rewardParts: string[] = []
              if (reward.crystals)    rewardParts.push(`+${reward.crystals} 💎`)
              if (reward.collectible) rewardParts.push(`${reward.collectible.icon} ${reward.collectible.name}`)
              return (
                <div key={quest.id} className="quests-modal__card quests-modal__card--completed">
                  <div className="quests-modal__title">✅ {quest.title}</div>
                  {rewardParts.length > 0 && (
                    <div className="quests-modal__reward">{rewardParts.join('  ·  ')}</div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
  )
}

export function QuestsModal(props: Props) {
  return (
    <ModalBackdrop onClose={props.onClose}>
      <QuestsContent {...props} />
    </ModalBackdrop>
  )
}
