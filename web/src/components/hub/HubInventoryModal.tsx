import React, { useState } from 'react'
import type { HubQuestDef } from '../../data/hub/questDefs'
import {
  questItems, carriedItems, itemDetail, isSatisfied, type SatchelItem,
} from '../../game/hub/satchelItems'
import { SatchelEmpty } from './satchel/SatchelSheet'
import { FilterChips } from './satchel/FilterChips'
import { GroupHeading } from './satchel/GroupHeading'
import { ItemTile, ItemGrid } from './satchel/ItemTile'
import { ItemDetailSheet } from './satchel/ItemDetailSheet'

type ItemFilter = 'all' | 'quest' | 'material' | 'tool'

interface Props {
  /** All towns' quest defs — held quest items may belong to any town's quest. */
  questDefs: HubQuestDef[]
  /** Filters by name. Supplied by the sheet's search field. */
  query?: string
}

/** Tile caption: "2/4" while a quest still wants more, else the stack size. */
function tileCount(item: SatchelItem): React.ReactNode {
  if (item.need) return `${item.count}/${item.need.required}`
  return item.count > 1 ? item.count : null
}

function tileLabel(item: SatchelItem): string {
  if (item.need) return `${item.name} — ${item.count} of ${item.need.required} for ${item.need.questTitle}`
  return item.count > 1 ? `${item.name} ×${item.count}` : item.name
}

export function HubInventoryContent({ questDefs, query = '' }: Props) {
  const [filter, setFilter] = useState<ItemFilter>('all')
  const [openItem, setOpenItem] = useState<SatchelItem | null>(null)

  const quest   = questItems(questDefs)
  const carried = carriedItems()
  const tools     = carried.filter(i => i.category === 'tool')
  const materials = carried.filter(i => i.category === 'material')

  const matches = (item: SatchelItem) => item.name.toLowerCase().includes(query.trim().toLowerCase())
  const show = (items: SatchelItem[], category: ItemFilter) =>
    (filter === 'all' || filter === category ? items : []).filter(matches)

  const visibleQuest     = show(quest, 'quest')
  const visibleTools     = show(tools, 'tool')
  const visibleMaterials = show(materials, 'material')
  const total = visibleQuest.length + visibleTools.length + visibleMaterials.length

  const grid = (items: SatchelItem[]) => (
    <ItemGrid>
      {items.map(item => (
        <ItemTile
          key={item.id}
          icon={item.icon}
          count={tileCount(item)}
          label={tileLabel(item)}
          flagged={item.need != null}
          complete={isSatisfied(item)}
          onClick={() => setOpenItem(item)}
        />
      ))}
    </ItemGrid>
  )

  return (
    <>
      <FilterChips
        label="Filter items"
        activeId={filter}
        onChange={id => setFilter(id as ItemFilter)}
        options={[
          { id: 'all',      label: 'All',       count: quest.length + carried.length },
          { id: 'quest',    label: 'Quest',     count: quest.length },
          { id: 'material', label: 'Materials', count: materials.length },
          { id: 'tool',     label: 'Tools',     count: tools.length },
        ]}
      />

      {total === 0 && (
        <SatchelEmpty>
          {query
            ? `Nothing in your satchel matches “${query}”.`
            : 'Your satchel is empty — gather something out in the world.'}
        </SatchelEmpty>
      )}

      {visibleQuest.length > 0 && (
        <>
          <GroupHeading tone="gold" count={visibleQuest.length}>Needed for a quest</GroupHeading>
          {grid(visibleQuest)}
        </>
      )}

      {visibleTools.length > 0 && (
        <>
          <GroupHeading count={visibleTools.length}>Tools</GroupHeading>
          {grid(visibleTools)}
        </>
      )}

      {visibleMaterials.length > 0 && (
        <>
          <GroupHeading count={visibleMaterials.length}>Materials</GroupHeading>
          {grid(visibleMaterials)}
        </>
      )}

      {openItem && (
        <ItemDetailSheet detail={itemDetail(openItem)} onClose={() => setOpenItem(null)} />
      )}
    </>
  )
}
