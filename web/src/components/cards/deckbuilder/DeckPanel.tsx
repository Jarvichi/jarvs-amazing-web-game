import React from 'react'
import { Card } from '../../../game/types'
import { DeckSlot } from '../../../game/collection'
import { CardTile } from '../CardTile'
import { CardCellFooter } from '../CardCellFooter'
import { ProgressBar } from '../../ui/ProgressBar'
import { EmptyState } from '../../ui/EmptyState'
import { Button } from '../../ui/Button'

export interface DeckPanelItem {
  card: Card
  count: number
  resting: boolean
  xp: number
  level: number
  comboCount: number
}

interface Props {
  collapsed: boolean
  onToggleCollapse: () => void
  activeSlot: DeckSlot
  onSwitchSlot: (slot: DeckSlot) => void
  onOpenAutoBuild: () => void
  onOpenSavedDecks: () => void
  onOpenShare: () => void
  total: number
  playerDeckMax: number
  deckLength: number
  search: string
  items: DeckPanelItem[]
  onRemove: (cardName: string) => void
  onInfo: (card: Card) => void
}

/** The deck builder's top panel — the current deck, its slot toggle, and its
 *  build/save/share actions. Tapping a card here removes it from the deck. */
export function DeckPanel({
  collapsed, onToggleCollapse, activeSlot, onSwitchSlot,
  onOpenAutoBuild, onOpenSavedDecks, onOpenShare,
  total, playerDeckMax, deckLength, search, items, onRemove, onInfo,
}: Props) {
  return (
    <div className={`deckbuilder-top-panel${collapsed ? ' deckbuilder-panel--collapsed' : ''}`}>
      <div className="deckbuilder-panel-header">
        <span className="deckbuilder-panel-label">
          DECK<span className="deckbuilder-panel-hint"> — click to remove</span>
        </span>
        <div className="deck-slot-toggle u-flex u-items-c u-gap-1">
          <button
            className={`deck-slot-btn${activeSlot === 'a' ? ' deck-slot-btn--active' : ''}`}
            onClick={() => onSwitchSlot('a')}
            title="Deck A"
          >A</button>
          <button
            className={`deck-slot-btn${activeSlot === 'b' ? ' deck-slot-btn--active' : ''}`}
            onClick={() => onSwitchSlot('b')}
            title="Deck B"
          >B</button>
        </div>
        <div className="deckbuilder-header-actions">
          <Button
            className="db-action-sm"
            onClick={onOpenAutoBuild}
            title="Auto Build"
          >⚡<span className="db-action-label"> AUTO</span></Button>
          <Button
            className="db-action-sm"
            onClick={onOpenSavedDecks}
            title="Saved Decks"
          >💾<span className="db-action-label"> SAVED</span></Button>
          <Button
            className="db-action-sm"
            onClick={onOpenShare}
            title="Share Deck"
          >🔗<span className="db-action-label"> SHARE</span></Button>
          <button
            className="db-collapse-btn"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand deck panel' : 'Collapse deck panel'}
            aria-label={collapsed ? 'Expand deck panel' : 'Collapse deck panel'}
          >{collapsed ? '▼' : '▲'}</button>
        </div>
      </div>

      {!collapsed && (
        <>
          <ProgressBar pct={(total / playerDeckMax) * 100} />
          <div className="deckbuilder-deck-grid">
            {deckLength === 0 ? (
              <EmptyState size="sm">Add cards from the collection below.</EmptyState>
            ) : items.length === 0 ? (
              <EmptyState size="sm">No deck cards match "{search}".</EmptyState>
            ) : (
              <div className="collection-grid u-flex u-wrap u-just-c u-grow">
                {items.map(({ card, count, resting, xp, level, comboCount }) => (
                  <div
                    key={card.name}
                    className={`collection-cell u-col${resting ? ' collection-cell--resting' : ''}`}
                  >
                    <div className="card-cell-tile">
                      {resting && (
                        <div className="resting-overlay">
                          <span className="resting-badge">💤 RESTING</span>
                        </div>
                      )}
                      <CardTile
                        card={card}
                        onClick={() => onRemove(card.name)}
                        deckMatches={comboCount}
                        showDetails={true}
                      />
                    </div>
                    <CardCellFooter xp={xp} onInfo={() => onInfo(card)}>
                      <span className="cell-count">
                        ×{count}
                        {level > 0 && <span className="cell-mastery-badge">★{level}</span>}
                      </span>
                    </CardCellFooter>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
