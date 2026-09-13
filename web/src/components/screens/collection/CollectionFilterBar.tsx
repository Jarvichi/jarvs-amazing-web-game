import React from 'react'
import { CardRarity, CardType, UnitTag } from '../../../game/types'
import { FilterPopup } from '../../ui/filters/FilterPopup'
import { FilterOption } from '../../ui/filters/FilterOption'
import { FilterPill } from '../../ui/filters/FilterPill'

export type CollRarityFilter = 'all' | CardRarity
export type CollTypeFilter   = 'all' | CardType
export type CollSpecialFilter = 'upgradeable'
export type CollSortKey  = 'default' | 'az' | 'za' | 'mana-asc' | 'mana-desc' | 'rarity'
export type CollGroupKey = 'none' | 'type' | 'rarity' | 'mana' | 'act'
export type CollFilterMenu = 'filters' | 'sort' | 'group' | null

const ALL_TAGS: UnitTag[] = [
  'flying', 'ranged', 'melee', 'fast', 'slow', 'large',
  'magic', 'undead', 'beast', 'armored', 'siege', 'fire',
]

interface Props {
  typeFilter: CollTypeFilter
  rarityFilter: CollRarityFilter
  specialFilter: CollSpecialFilter | null
  tagFilter: UnitTag[]
  affinityFilter: string | null
  affinityLabels: string[]
  sortKey: CollSortKey
  groupKey: CollGroupKey
  openMenu: CollFilterMenu
  onOpenMenuChange: (menu: CollFilterMenu) => void
  onTypeChange: (value: CollTypeFilter) => void
  onRarityChange: (value: CollRarityFilter) => void
  onSpecialChange: (value: CollSpecialFilter | null) => void
  onTagToggle: (tag: UnitTag) => void
  onAffinityChange: (value: string | null) => void
  onSortChange: (value: CollSortKey) => void
  onGroupChange: (value: CollGroupKey) => void
  onResetFilters: () => void
  shownCount: number
  totalOwned: number
}

/** The Collection screen's filter/sort/group bar. Distinct from the deck
 *  builder's own bar (`cards/deckbuilder/DeckFilterBar`) in adding the
 *  SPECIAL/upgradeable filter and dropping the synergy sort, which only
 *  makes sense against an active deck. */
export function CollectionFilterBar({
  typeFilter, rarityFilter, specialFilter, tagFilter, affinityFilter, affinityLabels,
  sortKey, groupKey, openMenu, onOpenMenuChange,
  onTypeChange, onRarityChange, onSpecialChange, onTagToggle, onAffinityChange, onSortChange, onGroupChange, onResetFilters,
  shownCount, totalOwned,
}: Props) {
  const activeFilterCount =
    (typeFilter    !== 'all' ? 1 : 0) +
    (rarityFilter  !== 'all' ? 1 : 0) +
    tagFilter.length +
    (affinityFilter ? 1 : 0) +
    (specialFilter  ? 1 : 0)

  return (
    <div className="filter-bar">
      {/* FILTERS */}
      <FilterPopup
        label="▼ FILTERS"
        activeSuffix={activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        isActive={activeFilterCount > 0}
        open={openMenu === 'filters'}
        onToggle={() => onOpenMenuChange(openMenu === 'filters' ? null : 'filters')}
        onClose={() => onOpenMenuChange(openMenu === 'filters' ? null : openMenu)}
        footer={activeFilterCount > 0 && (
          <div className="filter-popup-footer">
            <button className="filter-btn filter-btn--sm filter-btn--reset" onClick={onResetFilters}>
              ✕ Clear all filters
            </button>
          </div>
        )}
      >
        <div className="filter-popup-section u-col">
          <span className="filter-group-label">TYPE</span>
          <div className="filter-popup-btns u-flex u-wrap u-gap-2">
            {(['all', 'unit', 'structure', 'upgrade'] as const).map(val => (
              <FilterOption key={val} active={typeFilter === val} onClick={() => onTypeChange(val)}>
                {val === 'all' ? 'All' : val.charAt(0).toUpperCase() + val.slice(1) + 's'}
              </FilterOption>
            ))}
          </div>
        </div>

        <div className="filter-popup-section u-col">
          <span className="filter-group-label">RARITY</span>
          <div className="filter-popup-btns u-flex u-wrap u-gap-2">
            {(['all', 'common', 'uncommon', 'rare', 'legendary'] as const).map(val => (
              <FilterOption key={val} active={rarityFilter === val} onClick={() => onRarityChange(val)}>
                {val.charAt(0).toUpperCase() + val.slice(1)}
              </FilterOption>
            ))}
          </div>
        </div>

        <div className="filter-popup-section u-col">
          <span className="filter-group-label">TAGS <span className="filter-group-hint">(any match)</span></span>
          <div className="filter-popup-btns u-flex u-wrap u-gap-2">
            {ALL_TAGS.map(tag => (
              <FilterOption key={tag} active={tagFilter.includes(tag)} onClick={() => onTagToggle(tag)}>
                {tag}
              </FilterOption>
            ))}
          </div>
        </div>

        <div className="filter-popup-section u-col">
          <span className="filter-group-label">AFFINITY</span>
          <div className="filter-popup-btns u-flex u-wrap u-gap-2">
            {affinityLabels.map(label => (
              <FilterOption
                key={label}
                active={affinityFilter === label}
                onClick={() => onAffinityChange(affinityFilter === label ? null : label)}
              >
                {label}
              </FilterOption>
            ))}
          </div>
        </div>

        <div className="filter-popup-section u-col">
          <span className="filter-group-label">SPECIAL</span>
          <div className="filter-popup-btns u-flex u-wrap u-gap-2">
            <FilterOption
              active={specialFilter === 'upgradeable'}
              gold={specialFilter === 'upgradeable'}
              onClick={() => onSpecialChange(specialFilter === 'upgradeable' ? null : 'upgradeable')}
            >
              ★ Upgradeable
            </FilterOption>
          </div>
        </div>
      </FilterPopup>

      {/* SORT */}
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
            {([
              ['default',   'Default'],
              ['az',        'A → Z'],
              ['za',        'Z → A'],
              ['mana-asc',  'Mana ↑'],
              ['mana-desc', 'Mana ↓'],
              ['rarity',    'Rarity'],
            ] as [CollSortKey, string][]).map(([val, label]) => (
              <FilterOption key={val} active={sortKey === val} onClick={() => onSortChange(val)}>
                {label}
              </FilterOption>
            ))}
          </div>
        </div>
      </FilterPopup>

      {/* GROUP */}
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
            {([
              ['none',    'None'],
              ['type',    'Type'],
              ['rarity',  'Rarity'],
              ['mana',    'Mana'],
              ['act',     'Act'],
            ] as [CollGroupKey, string][]).map(([val, label]) => (
              <FilterOption key={val} active={groupKey === val} onClick={() => onGroupChange(val)}>
                {label}
              </FilterOption>
            ))}
          </div>
        </div>
      </FilterPopup>

      {/* Active filter pills */}
      {activeFilterCount > 0 && (
        <div className="filter-active-pills u-flex u-gap-2 u-grow u-items-c">
          {typeFilter !== 'all' && (
            <FilterPill onRemove={() => onTypeChange('all')}>{typeFilter}s</FilterPill>
          )}
          {rarityFilter !== 'all' && (
            <FilterPill onRemove={() => onRarityChange('all')}>{rarityFilter}</FilterPill>
          )}
          {tagFilter.map(t => (
            <FilterPill key={t} onRemove={() => onTagToggle(t)}>{t}</FilterPill>
          ))}
          {affinityFilter && (
            <FilterPill onRemove={() => onAffinityChange(null)}>affinity:{affinityFilter}</FilterPill>
          )}
          {specialFilter && (
            <FilterPill onRemove={() => onSpecialChange(null)}>★upgradeable</FilterPill>
          )}
        </div>
      )}

      {/* "shown", not "cards" — this is the filtered catalog count, which is
          not the same as how many copies you own (and differs from the
          discovery denominator below, which includes hidden secrets). */}
      <span className="filter-owned">{shownCount} shown · {totalOwned.toLocaleString()} copies</span>
    </div>
  )
}
