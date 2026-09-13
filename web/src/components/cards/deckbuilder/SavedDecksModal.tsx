import React from 'react'
import { SavedDeck, deckTotalCards } from '../../../game/collection'
import { ModalBackdrop } from '../../ui/ModalBackdrop'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'

interface Props {
  savedDecks: SavedDeck[]
  saveNameInput: string
  onSaveNameChange: (value: string) => void
  onSave: () => void
  onLoad: (deck: SavedDeck) => void
  onDelete: (name: string) => void
  onClose: () => void
}

export function SavedDecksModal({ savedDecks, saveNameInput, onSaveNameChange, onSave, onLoad, onDelete, onClose }: Props) {
  return (
    <ModalBackdrop onClose={onClose} title="Saved Decks">
      <div className="autobuild-panel saveddecks-panel">
        <div className="autobuild-title">💾 SAVED DECKS</div>
        {savedDecks.length === 0 ? (
          <EmptyState size="sm">No saved decks yet.</EmptyState>
        ) : (
          <ul className="saveddecks-list">
            {savedDecks.map(d => (
              <li key={d.name} className="saveddecks-item u-flex u-items-c u-gap-4">
                <span className="saveddecks-name">{d.name}</span>
                <span className="saveddecks-count">{deckTotalCards(d.deck)} cards</span>
                <Button size="xs" onClick={() => onLoad(d)}>LOAD</Button>
                <Button size="xs" variant="danger" aria-label={`Delete ${d.name}`} onClick={() => onDelete(d.name)}>✕</Button>
              </li>
            ))}
          </ul>
        )}
        <div className="saveddecks-save-row u-flex u-gap-4 u-items-c">
          <input
            className="deckbuilder-search saveddecks-name-input u-grow"
            type="text"
            maxLength={24}
            placeholder="Deck name…"
            value={saveNameInput}
            onChange={e => onSaveNameChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSave() }}
          />
          <Button
            size="sm"
            onClick={onSave}
            disabled={!saveNameInput.trim()}
          >
            SAVE CURRENT
          </Button>
        </div>
        <Button className="autobuild-cancel" onClick={onClose}>
          CLOSE
        </Button>
      </div>
    </ModalBackdrop>
  )
}
