import React from 'react'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import type { HubQuestDef } from '../../data/hub/questDefs'
import type { HubLocationBundle } from '../../data/hub/loader'
import { QuestsContent } from './QuestsModal'
import { HubInventoryContent } from './HubInventoryModal'
import { TradeJournalContent } from './TradeJournalModal'
import { TownDirectoryContent } from './TownDirectory'
import { TownJournalContent } from './TownJournal'
import { HubTownUpgradesContent, type UpgradeRow } from './HubTownUpgrades'
import { PetContent } from './PetModal'

export type HubTabId = 'quests' | 'inventory' | 'trade-journal' | 'directory' | 'journal' | 'upgrades' | 'pet'

interface Props {
  onClose: () => void
  activeTab: HubTabId
  onTabChange: (tab: HubTabId) => void
  hasPet: boolean

  // Quests
  onAbandon: (questId: string) => void
  questDefs: HubQuestDef[]
  resolveNpcName?: (id: string) => string

  // Inventory
  allQuestDefs: HubQuestDef[]

  // Where is / Journal
  locationData: HubLocationBundle
  pinnedNpcId: string | null
  onTogglePin: (npcId: string) => void
  onShowRelationship: (npcId: string) => void

  // Upgrades
  townName: string
  reputation: number
  crystals: number
  rows: UpgradeRow[]
  onUpgrade: (buildingId: string) => void
  tributeAmount: number
  tributeAvailable: boolean
  onCollectTribute: () => void

  // Pet
  petActionRef?: React.MutableRefObject<{ setPetAccessory: (assetId: string | null) => void } | null>
}

const ALL_TABS: { id: HubTabId; icon: string; label: string }[] = [
  { id: 'quests',        icon: '📜',   label: 'Quests' },
  { id: 'inventory',     icon: '🎒',   label: 'Inventory' },
  { id: 'trade-journal', icon: '💱',   label: 'Trade Journal' },
  { id: 'directory',     icon: '🧭',   label: 'Where is…?' },
  { id: 'journal',       icon: '📖',   label: 'Journal' },
  { id: 'upgrades',      icon: '🏗️', label: 'Upgrades' },
  { id: 'pet',           icon: '🐾',   label: 'My Pet' },
]

export function HubTabbedModal(props: Props) {
  const {
    onClose, activeTab, onTabChange, hasPet,
    onAbandon, questDefs, resolveNpcName,
    allQuestDefs,
    locationData, pinnedNpcId, onTogglePin, onShowRelationship,
    townName, reputation, crystals, rows, onUpgrade, tributeAmount, tributeAvailable, onCollectTribute,
    petActionRef,
  } = props

  const tabs = ALL_TABS.filter(t => t.id !== 'pet' || hasPet)
  const tab = activeTab === 'pet' && !hasPet ? 'quests' : activeTab

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="hub-tabbed-modal">
        <div className="hoa-tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`hoa-tab${t.id === tab ? ' hoa-tab--active' : ''}`}
              onClick={() => onTabChange(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div className="hub-tabbed-modal__body">
          {tab === 'quests' && (
            <QuestsContent onClose={onClose} onAbandon={onAbandon} questDefs={questDefs} resolveNpcName={resolveNpcName} />
          )}
          {tab === 'inventory' && (
            <HubInventoryContent onClose={onClose} questDefs={allQuestDefs} />
          )}
          {tab === 'trade-journal' && (
            <TradeJournalContent onClose={onClose} />
          )}
          {tab === 'directory' && (
            <TownDirectoryContent onClose={onClose} locationData={locationData} pinnedNpcId={pinnedNpcId} onTogglePin={onTogglePin} onShowRelationship={onShowRelationship} />
          )}
          {tab === 'journal' && (
            <TownJournalContent onClose={onClose} locationData={locationData} />
          )}
          {tab === 'upgrades' && (
            <HubTownUpgradesContent
              onClose={onClose} townName={townName} reputation={reputation} crystals={crystals} rows={rows} onUpgrade={onUpgrade}
              tributeAmount={tributeAmount} tributeAvailable={tributeAvailable} onCollectTribute={onCollectTribute}
            />
          )}
          {tab === 'pet' && (
            <PetContent onClose={onClose} petActionRef={petActionRef} />
          )}
        </div>
      </div>
    </ModalBackdrop>
  )
}
