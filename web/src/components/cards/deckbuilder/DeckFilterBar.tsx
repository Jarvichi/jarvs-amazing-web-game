import React from 'react'
import { CardRarity, CardType, UnitTag } from '../../../game/types'
import { FilterPopup } from '../../ui/filters/FilterPopup'
import { FilterOption } from '../../ui/filters/FilterOption'
import { FilterPill } from '../../ui/filters/FilterPill'

export type DeckRarityFilter = 'all' | CardRarity
export type DeckTypeFilter   = 'all' | CardType
export type DeckSortKey  = 'default' | 'az' | 'za' | 'mana-asc' | 'mana-desc' | 'rarity' | 'synergy'
export type DeckGroupKey = 'none' | 'type' | 'rarity' | 'mana' | 'act'
export type DeckFilterMenu = 'filters' | 'sort' | 'group' | null

const ALL_TAGS: UnitTag[] = [
  'flying', 'ranged', 'melee', 'fast', 'slow', 'large',
  'magic', 'undead', 'beast', 'armored', 'siege', 'fire',
]

interface Props {
  typeFilter: DeckTypeFilter
  rarityFilter: DeckRarityFilter
  tagFilter: UnitTag[]
  affinityFilter: string | null
  affinityLabels: string[]
  sortKey: DeckSortKey
  groupKey: DeckGroupKey
  openMenu: DeckFilterMenu
  onOpenMenuChange: (menu: DeckFilterMenu) => void
  onTypeChange: (value: DeckTypeFilter) => void
  onRarityChange: (value: DeckRarityFilter) => void
  onTagToggle: (tag: UnitTag) => void
  onAffinityChange: (value: string | null) => void
  onSortChange: (value: DeckSortKey) => void
  onGroupChange: (value: DeckGroupKey) => void
  onResetFilters: () => void
}

/** The deck builder's collection filter/sort/group bar — kept separate from
 *  CollectionScreen's own filter bar since it lacks the SPECIAL/upgradeable
 *  section and adds a synergy sort the collection screen has no use for. */
export function DeckFilterBar({
  typeFilter, rarityFilter, tagFilter, affinityFilter, affinityLabels,
  sortKey, groupKey, openMenu, onOpenMenuChange,
  onTypeChange, onRarityChange, onTagToggle, onAffinityChange, onSortChange, onGroupChange, onResetFilters,
}: Props) {
  const activeFilterCount =
    (typeFilter    !== 'all' ? 1 : 0) +
    (rarityFilter  !== 'all' ? 1 : 0) +
    tagFilter.length +
    (affinityFilter ? 1 : 0)

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
        {affinityLabels.length > 0 && (
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
        )}
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
              ['synergy',   '⚡ Synergy'],
            ] as [DeckSortKey, string][]).map(([val, label]) => (
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
            ] as [DeckGroupKey, string][]).map(([val, label]) => (
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
        </div>
      )}
    </div>
  )
}
