import React, { useState } from 'react'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { HUB_QUEST_DEFS } from '../../data/hub/questDefs'
import type { HubQuestDef } from '../../data/hub/questDefs'
import { getQuestState, getQuestProgress } from '../../game/hub/quests'

interface Props {
  onClose: () => void
  onAbandon: (questId: string) => void
  questDefs?: HubQuestDef[]
}

function progressDots(current: number, required: number): string {
  const filled = Math.min(current, required)
  return '●'.repeat(filled) + '○'.repeat(Math.max(0, required - filled))
}

function getActiveHint(quest: HubQuestDef): string {
  const { activeDialogue } = quest
  if (typeof activeDialogue === 'string') return activeDialogue
  for (const step of quest.steps) {
    if (getQuestProgress(quest.id, step.key) < step.required) {
      return activeDialogue[step.key] ?? Object.values(activeDialogue)[0]
    }
  }
  return Object.values(activeDialogue)[Object.values(activeDialogue).length - 1]
}

export function QuestsModal({ onClose, onAbandon, questDefs: questDefsProp }: Props) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const defs = questDefsProp ?? HUB_QUEST_DEFS

  const active    = defs.filter(q => getQuestState(q.id).status === 'active')
  const completed = defs.filter(q => getQuestState(q.id).status === 'completed')
  const discovered = active.length + completed.length
  const total      = defs.length

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="quests-modal">
        <div className="quests-modal__header">
          <span>📜 Quests</span>
          <span className="quests-modal__meta">
            {discovered} of {total}
            <button className="quests-modal__close" onClick={onClose}>✕</button>
          </span>
        </div>

        {discovered === 0 && (
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
                  const label   = step.key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
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
    </ModalBackdrop>
  )
}
