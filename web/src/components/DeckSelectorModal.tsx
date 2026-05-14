import React, { useState, useMemo } from 'react'
import { ModalBackdrop } from './ModalBackdrop'
import { getCardCatalog } from '../game/cards'
import {
  DeckSlot,
  DeckEntry,
  getActiveDeckSlot,
  setActiveDeckSlot,
  loadDeckSlot,
} from '../game/collection'

interface Props {
  onConfirm: () => void
  onCancel: () => void
}

function DeckPreview({ entries, slot, selected, onSelect }: {
  entries: DeckEntry[]
  slot: DeckSlot
  selected: boolean
  onSelect: () => void
}) {
  const catalog = useMemo(() => getCardCatalog(), [])
  const sorted = [...entries].sort((a, b) => {
    const ca = catalog.find(c => c.name === a.cardName)
    const cb = catalog.find(c => c.name === b.cardName)
    return (ca?.cost ?? 0) - (cb?.cost ?? 0) || a.cardName.localeCompare(b.cardName)
  })
  const total = entries.reduce((s, e) => s + e.count, 0)

  return (
    <div
      className={`deck-selector-panel${selected ? ' deck-selector-panel--active' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect() }}
    >
      <div className="deck-selector-panel-header">
        <span className="deck-selector-slot-label">DECK {slot.toUpperCase()}</span>
        {selected && <span className="deck-selector-active-badge">✓ ACTIVE</span>}
        <span className="deck-selector-count">{total} cards</span>
      </div>
      {entries.length === 0 ? (
        <div className="deck-selector-empty">No cards — build one in Deck Builder</div>
      ) : (
        <div className="deck-selector-list">
          {sorted.map(e => {
            const card = catalog.find(c => c.name === e.cardName)
            return (
              <div key={e.cardName} className="deck-selector-row">
                <span className="deck-selector-cost">{card?.cost ?? '?'}</span>
                <span className="deck-selector-name">{e.cardName}</span>
                {e.count > 1 && <span className="deck-selector-qty">×{e.count}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function DeckSelectorModal({ onConfirm, onCancel }: Props) {
  const [selected, setSelected] = useState<DeckSlot>(getActiveDeckSlot)
  const deckA = useMemo(() => loadDeckSlot('a'), [])
  const deckB = useMemo(() => loadDeckSlot('b'), [])

  function handleConfirm() {
    setActiveDeckSlot(selected)
    onConfirm()
  }

  return (
    <ModalBackdrop onClose={onCancel}>
      <div className="deck-selector-modal">
        <div className="deck-selector-title">CHOOSE YOUR DECK</div>
        <div className="deck-selector-panels">
          <DeckPreview
            entries={deckA}
            slot="a"
            selected={selected === 'a'}
            onSelect={() => setSelected('a')}
          />
          <DeckPreview
            entries={deckB}
            slot="b"
            selected={selected === 'b'}
            onSelect={() => setSelected('b')}
          />
        </div>
        <div className="deck-selector-actions">
          <button className="action-btn" onClick={onCancel}>Cancel</button>
          <button className="action-btn action-btn--primary" onClick={handleConfirm}>
            ▶ Battle with Deck {selected.toUpperCase()}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  )
}
