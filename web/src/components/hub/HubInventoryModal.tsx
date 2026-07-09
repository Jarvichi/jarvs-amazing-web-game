import React from 'react'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import type { HubQuestDef } from '../../data/hub/questDefs'
import { getQuestState, getQuestProgress } from '../../game/hub/quests'
import { getHubItems, getHubItemCount, ItemEntry } from '../../game/itemStore'
import { questItemId } from '../../game/hub/questItems'
import { getOwnedAccessoryIds, getEquippedAccessoryId } from '../../game/hub/pet'
import { getPetAccessoryDef } from '../../data/petAccessories'

interface Props {
  onClose: () => void
  /** All towns' quest defs — held quest items may belong to any town's quest. */
  questDefs: HubQuestDef[]
}

interface QuestItemRow {
  questId: string
  questTitle: string
  stepKey: string
  name: string
  icon: string
  held: number
  required: number
}

function activeQuestItemRows(questDefs: HubQuestDef[]): QuestItemRow[] {
  const rows: QuestItemRow[] = []
  for (const quest of questDefs) {
    if (getQuestState(quest.id).status !== 'active') continue
    for (const step of quest.steps) {
      if (step.type !== 'collect' || !step.itemName) continue
      rows.push({
        questId: quest.id,
        questTitle: quest.title,
        stepKey: step.key,
        name: step.itemName,
        icon: step.itemIcon ?? '📦',
        held: getHubItemCount(questItemId(quest.id, step.key)),
        required: step.required,
      })
    }
  }
  return rows
}

export function HubInventoryContent({ onClose, questDefs }: Props) {
  const questRows = activeQuestItemRows(questDefs)

  const hubItems = getHubItems()
  const materials = hubItems.filter(e => e.category === 'material')
  const tools     = hubItems.filter(e => e.category === 'tool')

  const accessoryIds = getOwnedAccessoryIds()
  const equippedId   = getEquippedAccessoryId()

  const itemRow = (entry: ItemEntry) => (
    <div key={entry.id} className="quests-modal__step">
      <span>{entry.icon ?? '📦'} {entry.name ?? entry.id}</span>
      <span>{entry.count > 1 ? `×${entry.count}` : ''}</span>
    </div>
  )

  return (
      <div className="quests-modal">
        <div className="quests-modal__header">
          <span>🎒 Inventory</span>
          <span className="quests-modal__meta">
            <button className="quests-modal__close" onClick={onClose}>✕</button>
          </span>
        </div>

        <div className="quests-modal__section-label">Quest Items</div>
        {questRows.length === 0 ? (
          <div className="quests-modal__empty">Nothing held for a quest right now.</div>
        ) : (
          questRows.map(row => (
            <div key={`${row.questId}:${row.stepKey}`} className="quests-modal__card quests-modal__card--active">
              <div className="quests-modal__title">{row.icon} {row.name}</div>
              <div className="quests-modal__step">
                <span>{row.questTitle}</span>
                <span>{row.held}/{row.required}</span>
              </div>
            </div>
          ))
        )}

        {(materials.length > 0 || tools.length > 0) && (
          <>
            <div className="quests-modal__section-label">Materials &amp; Tools</div>
            <div className="quests-modal__card">
              {tools.map(itemRow)}
              {materials.map(itemRow)}
            </div>
          </>
        )}

        <div className="quests-modal__section-label">Pet Accessories</div>
        {accessoryIds.length === 0 ? (
          <div className="quests-modal__empty">Nothing yet — Tailor Pell in the capital stocks pet accessories.</div>
        ) : (
          <div className="quests-modal__card">
            {accessoryIds.map(id => {
              const def = getPetAccessoryDef(id)
              return (
                <div key={id} className="quests-modal__step">
                  <span>🎀 {def?.name ?? id}</span>
                  <span>{id === equippedId ? 'equipped' : ''}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
  )
}

export function HubInventoryModal(props: Props) {
  return (
    <ModalBackdrop onClose={props.onClose}>
      <HubInventoryContent {...props} />
    </ModalBackdrop>
  )
}
