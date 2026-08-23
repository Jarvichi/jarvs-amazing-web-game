import React, { useState } from 'react'
import type { HubQuestDef } from '../../data/hub/questDefs'
import type { HubLocationBundle } from '../../data/hub/loader'
import { SatchelSheet } from './satchel/SatchelSheet'
import { FilterChips } from './satchel/FilterChips'
import { SATCHEL_NAV, type SatchelSectionId } from './satchel/types'
import { QuestsContent, questsMeta } from './QuestsModal'
import { HubInventoryContent } from './HubInventoryModal'
import { TradeJournalContent } from './TradeJournalModal'
import { TownDirectoryContent } from './TownDirectory'
import { TownJournalContent, journalCounts, journalPct, type JournalTab } from './TownJournal'
import { HubTownUpgradesContent, type UpgradeRow } from './HubTownUpgrades'

export type { SatchelSectionId }

/** Which sub-view a section is showing. Sub-views are chips inside a section,
 *  never top-level nav items — that distinction is what took seven tabs down
 *  to four (five once Today lands). */
type TownView  = 'people' | 'standing'
type CodexView = JournalTab | 'trade'

interface Props {
  onClose: () => void
  activeSection: SatchelSectionId
  onSectionChange: (section: SatchelSectionId) => void

  // Quests
  onAbandon: (questId: string) => void
  questDefs: HubQuestDef[]
  resolveNpcName?: (id: string) => string

  // Satchel
  allQuestDefs: HubQuestDef[]

  // Town
  locationData: HubLocationBundle
  pinnedNpcId: string | null
  onTogglePin: (npcId: string) => void
  onShowRelationship: (npcId: string) => void
  townName: string
  reputation: number
  crystals: number
  rows: UpgradeRow[]
  onUpgrade: (buildingId: string) => void
  tributeAmount: number
  tributeAvailable: boolean
  onCollectTribute: () => void
}

/** Section titles. The sheet draws these once — content renders content. */
const SECTION_TITLE: Record<SatchelSectionId, string> = {
  today:   'Today',
  satchel: 'Satchel',
  quests:  'Quests',
  town:    'Town',
  codex:   'Codex',
}

/** Today arrives with the dashboard; until then the nav carries four sections. */
const NAV_ITEMS = SATCHEL_NAV.filter(item => item.id !== 'today')

export function SatchelMenu(props: Props) {
  const {
    onClose, activeSection, onSectionChange,
    onAbandon, questDefs, resolveNpcName,
    allQuestDefs,
    locationData, pinnedNpcId, onTogglePin, onShowRelationship,
    townName, reputation, crystals, rows, onUpgrade,
    tributeAmount, tributeAvailable, onCollectTribute,
  } = props

  const [townView,  setTownView]  = useState<TownView>('people')
  const [codexView, setCodexView] = useState<CodexView>('animals')

  const section = NAV_ITEMS.some(item => item.id === activeSection) ? activeSection : 'quests'
  const counts = journalCounts(locationData)

  // The header's right-hand figure, per section. Each of these used to be a
  // second header line inside the content component itself.
  const meta =
      section === 'quests' ? questsMeta(questDefs)
    : section === 'town'   ? `💎 ${crystals.toLocaleString()}`
    : section === 'codex'  ? `${journalPct(locationData)}% complete`
    : undefined

  return (
    <SatchelSheet
      title={section === 'town' ? townName : SECTION_TITLE[section]}
      meta={meta}
      onClose={onClose}
      activeId={section}
      onSelect={onSectionChange}
      navItems={NAV_ITEMS}
    >
      {section === 'satchel' && (
        <HubInventoryContent questDefs={allQuestDefs} />
      )}

      {section === 'quests' && (
        <QuestsContent onAbandon={onAbandon} questDefs={questDefs} resolveNpcName={resolveNpcName} />
      )}

      {section === 'town' && (
        <>
          <FilterChips
            label="Town view"
            activeId={townView}
            onChange={id => setTownView(id as TownView)}
            options={[
              { id: 'people',   label: 'Where is…?' },
              { id: 'standing', label: 'Standing & Upgrades' },
            ]}
          />
          {townView === 'people' ? (
            <TownDirectoryContent
              locationData={locationData}
              pinnedNpcId={pinnedNpcId}
              onTogglePin={onTogglePin}
              onShowRelationship={onShowRelationship}
            />
          ) : (
            <HubTownUpgradesContent
              townName={townName} reputation={reputation} crystals={crystals} rows={rows} onUpgrade={onUpgrade}
              tributeAmount={tributeAmount} tributeAvailable={tributeAvailable} onCollectTribute={onCollectTribute}
            />
          )}
        </>
      )}

      {section === 'codex' && (
        <>
          <FilterChips
            label="Codex category"
            activeId={codexView}
            onChange={id => setCodexView(id as CodexView)}
            options={[
              { id: 'animals', label: 'Animals', count: counts.animals.seen },
              { id: 'fish',    label: 'Fish',    count: counts.fish.seen },
              { id: 'people',  label: 'People',  count: counts.people.seen },
              { id: 'places',  label: 'Places',  count: counts.places.seen },
              { id: 'trade',   label: 'Trade' },
            ]}
          />
          {codexView === 'trade'
            ? <TradeJournalContent />
            : <TownJournalContent locationData={locationData} tab={codexView} />}
        </>
      )}
    </SatchelSheet>
  )
}
