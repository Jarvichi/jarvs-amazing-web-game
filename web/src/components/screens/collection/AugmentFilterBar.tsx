import React from 'react'
import { FilterPopup } from '../../ui/filters/FilterPopup'
import { FilterOption } from '../../ui/filters/FilterOption'

export type AugSortKey  = 'default' | 'az' | 'za' | 'rarity' | 'level-desc' | 'level-asc' | 'slot'
export type AugGroupKey = 'none' | 'slot' | 'set' | 'rarity' | 'status'
export type AugFilterMenu = 'sort' | 'group' | null

const SORT_OPTIONS: [AugSortKey, string][] = [
  ['default',    'Default'],
  ['az',         'A → Z'],
  ['za',         'Z → A'],
  ['rarity',     'Rarity'],
  ['level-desc', 'Level ↓'],
  ['level-asc',  'Level ↑'],
  ['slot',       'Slot'],
]

const GROUP_OPTIONS: [AugGroupKey, string][] = [
  ['none',   'None'],
  ['slot',   'Slot'],
  ['set',    'Set'],
  ['rarity', 'Rarity'],
  ['status', 'Equipped / Unequipped'],
]

interface Props {
  sortKey: AugSortKey
  groupKey: AugGroupKey
  openMenu: AugFilterMenu
  onOpenMenuChange: (menu: AugFilterMenu) => void
  onSortChange: (value: AugSortKey) => void
  onGroupChange: (value: AugGroupKey) => void
}

/** Augments' sort/group control pair, on the same `FilterPopup`/`FilterOption`
 *  vocabulary as `CollectionFilterBar` and `DeckFilterBar` — augments just
 *  have no type/rarity/tag/affinity filters, only a sort and a group, over
 *  a different key set. */
export function AugmentFilterBar({ sortKey, groupKey, openMenu, onOpenMenuChange, onSortChange, onGroupChange }: Props) {
  return (
    <div className="filter-bar">
      <FilterPopup
        label="↕ SORT"
        activeSuffix={sortKey !== 'default' ? ` (${sortKey})` : ''}
        isActive={sortKey !== 'default'}
        open={openMenu === 'sort'}
        onToggle={() => onOpenMenuChange(openMenu === 'sort' ? null : 'sort')}
        onClose={() => onOpenMenuChange(openMenu === 'sort' ? null : openMenu)}
      >
        <div className="filter-popup-section u-col">
          <div className="filter-popup-btns u-flex u-wrap u-gap-2">
            {SORT_OPTIONS.map(([val, label]) => (
              <FilterOption key={val} active={sortKey === val} onClick={() => onSortChange(val)}>
                {label}
              </FilterOption>
            ))}
          </div>
        </div>
      </FilterPopup>

      <FilterPopup
        label="⊞ GROUP"
        activeSuffix={groupKey !== 'none' ? ` (${groupKey})` : ''}
        isActive={groupKey !== 'none'}
        open={openMenu === 'group'}
        onToggle={() => onOpenMenuChange(openMenu === 'group' ? null : 'group')}
        onClose={() => onOpenMenuChange(openMenu === 'group' ? null : openMenu)}
      >
        <div className="filter-popup-section u-col">
          <div className="filter-popup-btns u-flex u-wrap u-gap-2">
            {GROUP_OPTIONS.map(([val, label]) => (
              <FilterOption key={val} active={groupKey === val} onClick={() => onGroupChange(val)}>
                {label}
              </FilterOption>
            ))}
          </div>
        </div>
      </FilterPopup>
    </div>
  )
}
