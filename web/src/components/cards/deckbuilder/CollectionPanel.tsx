import React from 'react'
import { Card } from '../../../game/types'
import { CardTile } from '../CardTile'
import { CardCellFooter } from '../CardCellFooter'
import { Button } from '../../ui/Button'
import { DeckFilterBar, DeckFilterMenu, DeckGroupKey, DeckRarityFilter, DeckSortKey, DeckTypeFilter } from './DeckFilterBar'
import { UnitTag } from '../../../game/types'

export interface CollectionPanelItem {
  card: Card
  inDeck: number
  owned: number
  canAdd: boolean
  atCopyLimit: boolean
  resting: boolean
  xp: number
  level: number
  comboCount: number
  synergyGroupCount: number
  groupLabel: string | null
}

interface Props {
  collapsed: boolean
  onToggleCollapse: () => void
  shownCount: number
  search: string
  onSearchChange: (value: string) => void
  onClearSearch: () => void

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

  items: CollectionPanelItem[]
  onAdd: (cardName: string) => void
  onInfo: (card: Card) => void
}

/** The deck builder's bottom panel — the owned-card collection, its search
 *  and filter/sort/group bar, and the add-to-deck grid. */
export function CollectionPanel({
  collapsed, onToggleCollapse, shownCount, search, onSearchChange, onClearSearch,
  items, onAdd, onInfo,
  ...filterBar
}: Props) {
  let lastGroup: string | null = null

  return (
    <div className={`deckbuilder-bottom-panel${collapsed ? ' deckbuilder-panel--collapsed' : ''}`}>
      <div className="deckbuilder-panel-header">
        <span className="deckbuilder-panel-label">
          COLLECTION<span className="deckbuilder-panel-hint"> — click to add</span>
        </span>
        <div className="deckbuilder-header-actions">
          {/* "shown", not "cards": this is the count of distinct owned
              cards after filtering, not a number of copies. Matches the
              Collection screen's wording. */}
          <span className="filter-owned">{shownCount} shown</span>
          <button
            className="db-collapse-btn"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand collection panel' : 'Collapse collection panel'}
            aria-label={collapsed ? 'Expand collection panel' : 'Collapse collection panel'}
          >{collapsed ? '▲' : '▼'}</button>
        </div>
      </div>

      {!collapsed && (
        <div className="deckbuilder-collection-inner u-grow u-col">
          {/* Search */}
          <div className="deckbuilder-search-wrap u-row">
            <input
              className="deckbuilder-search"
              type="text"
              placeholder="Search cards…"
              value={search}
              onChange={e => onSearchChange(e.target.value)}
            />
            <Button
              size="xs"
              aria-label="Clear search"
              title="Clear search"
              onClick={onClearSearch}
            >✕</Button>
          </div>

          <DeckFilterBar {...filterBar} />

          {/* Collection grid */}
          <div className="deckbuilder-collection-grid">
            {/* Gaps are asymmetric (see .collection-grid) — no u-gap-* here. */}
            <div className="collection-grid u-flex u-wrap u-just-c u-grow">
              {items.map(({ card, inDeck, owned, canAdd, atCopyLimit, resting, xp, level, comboCount, synergyGroupCount, groupLabel }) => {
                const showHeader = groupLabel !== null && groupLabel !== lastGroup
                if (showHeader) lastGroup = groupLabel
                return (
                  <React.Fragment key={card.name}>
                    {showHeader && (
                      <div className="collection-group-header">{groupLabel}</div>
                    )}
                    <div className={`collection-cell u-col${resting ? ' collection-cell--resting' : ''}${comboCount > 0 ? ' collection-cell--combo' : synergyGroupCount > 0 ? ' collection-cell--synergy' : ''}`}>
                      {/* Same resting treatment as the deck panel above —
                          the two used to differ (striped overlay + badge
                          there, a bare 💤 in the footer here). */}
                      <div className="card-cell-tile">
                        {resting && (
                          <div className="resting-overlay">
                            <span className="resting-badge">💤 RESTING</span>
                          </div>
                        )}
                        <CardTile
                          card={card}
                          canAfford={canAdd}
                          deckMatches={comboCount}
                          onClick={canAdd ? () => onAdd(card.name) : undefined}
                        />
                      </div>
                      <CardCellFooter xp={xp} onInfo={() => onInfo(card)}>
                        <span className="cell-count">
                          {inDeck}/{owned}
                          {level > 0 && <span className="cell-mastery-badge">★{level}</span>}
                          {atCopyLimit && <span className="cell-copy-limit-badge">MAX</span>}
                        </span>
                      </CardCellFooter>
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
