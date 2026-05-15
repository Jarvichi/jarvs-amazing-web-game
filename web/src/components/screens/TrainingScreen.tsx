import React, { useState, useMemo } from 'react'
import { getCardCatalog } from '../../game/cards'
import { loadCollection, loadDeck, buildDeckCards, deckTotalCards, STARTER_DECK } from '../../game/collection'
import { Card } from '../../game/types'
import { SpriteImg } from '../BuildingBlocks/SpriteImg'
import { OverlayScreen } from '../BuildingBlocks/OverlayScreen'
interface Props {
  onBack: () => void
  onStart: (enemyUnitName: string, playerCards: Card[]) => void
}

type Step = 'pickEnemy' | 'pickDeck'

const PAGE_SIZE = 18

export function TrainingScreen({ onBack, onStart }: Props) {
  const [step, setStep]           = useState<Step>('pickEnemy')
  const [enemyUnit, setEnemyUnit] = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [page, setPage]           = useState(0)

  const catalog    = useMemo(() => getCardCatalog(), [])
  const collection = useMemo(() => loadCollection(), [])

  // All unit cards that have a unit template (i.e. deployable units)
  const unitCards = useMemo(() =>
    catalog.filter(c => c.cardType === 'unit' && c.unit != null),
  [catalog])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return unitCards.filter(c =>
      !q || c.name.toLowerCase().includes(q)
    )
  }, [unitCards, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const visible    = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleSearchChange(v: string) {
    setSearch(v)
    setPage(0)
  }

  function handlePickEnemy(name: string) {
    setEnemyUnit(name)
    setStep('pickDeck')
  }

  function handleStartWithSavedDeck() {
    const deckEntries = loadDeck()
    const count       = deckTotalCards(deckEntries)
    const entries     = count > 0 ? deckEntries : STARTER_DECK
    const cards       = buildDeckCards(entries, collection)
    onStart(enemyUnit!, cards)
  }

  if (step === 'pickDeck') {
    return (
      <OverlayScreen title="TRAINING MODE" onBack={() => setStep('pickEnemy')}>
        <div className="training-enemy-preview">
          <SpriteImg name={enemyUnit!} className="training-sprite-lg" />
          <span className="training-enemy-label">vs {enemyUnit}</span>
        </div>

        <div className="training-deck-section">
          <p className="training-hint">
            Your current saved deck will be used. Edit it in the Deck Builder before training.
          </p>
          <button
            className="action-btn action-btn--large"
            onClick={handleStartWithSavedDeck}
          >
            ▶ Start Training
          </button>
        </div>

        <div className="training-rules">
          <div className="training-rules-title">Training Rules</div>
          <ul className="training-rules-list">
            <li>The opponent spawns <strong>{enemyUnit}</strong> on repeat</li>
            <li>No crystals, cards, or achievements are earned</li>
            <li>Use "Play Again" after the battle to respawn your opponent</li>
          </ul>
        </div>
      </OverlayScreen>
    )
  }

  return (
    <OverlayScreen title="TRAINING MODE" onBack={onBack}>
      <p className="training-hint">Select a unit to practice against.</p>

      <input
        className="training-search"
        type="text"
        placeholder="Search units…"
        value={search}
        onChange={e => handleSearchChange(e.target.value)}
        aria-label="Search units"
      />

      <div className="training-unit-grid">
        {visible.map(card => (
          <button
            key={card.name}
            className={`training-unit-btn${enemyUnit === card.name ? ' training-unit-btn--selected' : ''}`}
            onClick={() => handlePickEnemy(card.name)}
          >
            <SpriteImg name={card.name} className="training-sprite-sm" />
            <span className="training-unit-name">{card.name}</span>
          </button>
        ))}
        {visible.length === 0 && (
          <p className="training-empty">No units match "{search}"</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="training-pagination">
          <button
            className="filter-btn"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >← Prev</button>
          <span className="training-page-label">{page + 1} / {totalPages}</span>
          <button
            className="filter-btn"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >Next →</button>
        </div>
      )}

    </OverlayScreen>
  )
}
