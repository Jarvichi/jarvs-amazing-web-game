import React, { useState } from 'react'
import type { HubQuestDef } from '../../data/hub/questDefs'
import type { HubLocationBundle } from '../../data/hub/loader'
import type { TownRegistry } from '../../game/hub/questBoard'
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

  // Quests — global, not town-scoped: quests are carried between towns.
  onAbandon: (questId: string) => void
  allQuestDefs: HubQuestDef[]
  registry: TownRegistry
  onShowOnMap: (npcId: string) => void

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
    onAbandon, allQuestDefs, registry, onShowOnMap,
    locationData, pinnedNpcId, onTogglePin, onShowRelationship,
    townName, reputation, crystals, rows, onUpgrade,
    tributeAmount, tributeAvailable, onCollectTribute,
  } = props

  const [townView,  setTownView]  = useState<TownView>('people')
  const [codexView, setCodexView] = useState<CodexView>('animals')
  const [query,     setQuery]     = useState('')

  // Named NPCs and animals standing in this town right now — the difference
  // between "hand this to Mira, she's here" and "…she's in Saltmere".
  const presentNpcIds = React.useMemo(() => new Set<string>([
    ...locationData.HUB_NPCS.map(n => n.id),
    ...locationData.HUB_ANIMALS.map(a => a.id),
  ]), [locationData])

  const section = NAV_ITEMS.some(item => item.id === activeSection) ? activeSection : 'quests'
  const counts = journalCounts(locationData)

  // The header's right-hand figure, per section. Each of these used to be a
  // second header line inside the content component itself.
  const meta =
      section === 'quests' ? questsMeta(allQuestDefs)
    : section === 'town'   ? `💎 ${crystals.toLocaleString()}`
    : section === 'codex'  ? `${journalPct(locationData)}% complete`
    : undefined

  return (
    <SatchelSheet
      title={section === 'town' ? townName : SECTION_TITLE[section]}
      meta={meta}
      search={section === 'quests' || section === 'satchel'
        ? { value: query, onChange: setQuery, placeholder: section === 'quests' ? 'Search quests' : 'Search items' }
        : undefined}
      onClose={onClose}
      activeId={section}
      onSelect={onSectionChange}
      navItems={NAV_ITEMS}
    >
      {section === 'satchel' && (
        <HubInventoryContent questDefs={allQuestDefs} />
      )}

      {section === 'quests' && (
        <QuestsContent
          onAbandon={onAbandon}
          questDefs={allQuestDefs}
          registry={registry}
          currentTownName={townName}
          presentNpcIds={presentNpcIds}
          onShowOnMap={onShowOnMap}
          query={query}
        />
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
