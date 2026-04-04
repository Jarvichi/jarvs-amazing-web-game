import React, { useState, useMemo, useRef } from 'react'
import { Card, CardType, CardRarity } from '../game/types'
import { getCardCatalog } from '../game/cards'
import {
  loadCollection,
  loadDeck,
  saveDeck,
  deckTotalCards,
  isDeckValid,
  getOwnedCount,
  getMasteryXp,
  masteryLevel,
  DECK_MIN,
  DECK_MAX,
  COPIES_MAX,
  CollectionEntry,
  DeckEntry,
  SavedDeck,
  loadSavedDecks,
  saveNamedDeck,
  deleteSavedDeck,
  encodeDeck,
  decodeDeck,
} from '../game/collection'
import { CardTile } from './CardTile'
import { useCardDetail } from './useCardDetail'
import { OverlayScreen } from './OverlayScreen'
import { ProgressBar } from './ProgressBar'

interface Props {
  onBack: () => void
  fatiguedCards?: string[]   // card names that cannot be added to the deck this act
}

type AutoStrategy = 'aggro' | 'control' | 'balanced' | 'ranged'

const AUTO_STRATEGIES: { id: AutoStrategy; name: string; desc: string }[] = [
  { id: 'aggro',    name: 'AGGRO',    desc: 'Flood the field with cheap, fast units. Speed is your weapon.' },
  { id: 'ranged',   name: 'RANGED',   desc: 'Archers and bypass units that ignore walls. Strike from safety.' },
  { id: 'control',  name: 'CONTROL',  desc: 'Walls, Farms, and structures to grind the enemy down slowly.' },
  { id: 'balanced', name: 'BALANCED', desc: 'A mix of everything — units, structures, and upgrades.' },
]

function buildAutoDeck(
  strategy: AutoStrategy,
  collection: CollectionEntry[],
  fatiguedCards: string[],
): DeckEntry[] {
  const catalog = getCardCatalog()

  // Only consider cards the player owns and aren't resting
  const available = catalog.filter(
    c => getOwnedCount(collection, c.name) > 0 && !fatiguedCards.includes(c.name)
  )

  // Score each card based on strategy
  function score(c: typeof available[0]): number {
    const ownedCopies = Math.min(getOwnedCount(collection, c.name), COPIES_MAX)
    let s = 0

    if (strategy === 'aggro') {
      if (c.cardType === 'unit')      s += c.cost <= 2 ? 100 : c.cost <= 3 ? 60 : 20
      if (c.cardType === 'upgrade')   s += 30
      if (c.cardType === 'structure') s += c.unit?.isWall ? 5 : 15
      // Bonus for fast units
      if (c.unit && c.unit.moveSpeed >= 40) s += 30

    } else if (strategy === 'ranged') {
      if (c.cardType === 'unit' && c.unit?.bypassWall) s += 100
      if (c.cardType === 'unit' && !c.unit?.bypassWall) s += 20
      if (c.cardType === 'upgrade')   s += 40
      if (c.cardType === 'structure') s += c.unit?.structureEffect?.type === 'mana' ? 30 : 10

    } else if (strategy === 'control') {
      if (c.cardType === 'structure' && c.unit?.isWall) s += 100
      if (c.cardType === 'structure' && !c.unit?.isWall) s += 80
      if (c.cardType === 'upgrade')   s += 40
      if (c.cardType === 'unit')      s += c.cost >= 4 ? 30 : 10

    } else { // balanced
      if (c.cardType === 'unit')      s += 60
      if (c.cardType === 'structure') s += 50
      if (c.cardType === 'upgrade')   s += 40
    }

    // Prefer higher rarity (more powerful)
    const rarityBonus: Record<string, number> = { common: 0, uncommon: 10, rare: 20, legendary: 35 }
    s += rarityBonus[c.rarity] ?? 0

    // More owned copies = more reliable draw
    s += ownedCopies * 5

    return s
  }

  const scored = available
    .map(c => ({ card: c, score: score(c), maxCopies: Math.min(getOwnedCount(collection, c.name), COPIES_MAX) }))
    .sort((a, b) => b.score - a.score)

  const deck: DeckEntry[] = []
  let total = 0

  // Phase 1: grab 1 copy of each top-scored card until we have 15-20 distinct cards
  for (const { card, maxCopies } of scored) {
    if (total >= 20) break
    if (maxCopies < 1) continue
    deck.push({ cardName: card.name, count: 1 })
    total++
  }

  // Phase 2: fill remaining slots with extra copies of top cards
  for (const { card, maxCopies } of scored) {
    if (total >= DECK_MAX) break
    const entry = deck.find(e => e.cardName === card.name)
    if (!entry) continue
    const canAdd = maxCopies - entry.count
    if (canAdd <= 0) continue
    const toAdd = Math.min(canAdd, DECK_MAX - total)
    entry.count += toAdd
    total += toAdd
  }

  // Phase 3: if still below DECK_MIN, add any remaining owned cards
  for (const { card, maxCopies } of scored) {
    if (total >= DECK_MAX) break
    const existing = deck.find(e => e.cardName === card.name)
    if (existing && existing.count >= maxCopies) continue
    if (!existing) {
      deck.push({ cardName: card.name, count: 1 })
      total++
    } else {
      existing.count++
      total++
    }
  }

  return deck.filter(e => e.count > 0)
}

export function DeckBuilder({ onBack, fatiguedCards = [] }: Props) {
  const catalog = getCardCatalog()
  const [collection] = useState<CollectionEntry[]>(loadCollection)
  const [deck, setDeck] = useState<DeckEntry[]>(() =>
    loadDeck().filter(e => catalog.some(c => c.name === e.cardName))
  )
  const { openDetail, cardDetailNode } = useCardDetail({ collection, deckEntries: deck })
  const [showAutoBuild, setShowAutoBuild] = useState(false)
  const [showSavedDecks, setShowSavedDecks] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>(() => loadSavedDecks())
  const [saveNameInput, setSaveNameInput] = useState('')
  const [importCode, setImportCode] = useState('')
  const [importError, setImportError] = useState('')
  const [copyFeedback, setCopyFeedback] = useState(false)
  const shareCodeRef = useRef<HTMLTextAreaElement>(null)
  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter]   = useState<'all' | CardType>('all')
  const [rarityFilter, setRarityFilter] = useState<'all' | CardRarity>('all')
  const [sortBy, setSortBy]           = useState<'cost' | 'name' | 'rarity'>('cost')

  const total = deckTotalCards(deck)
  const valid = isDeckValid(deck)

  function inDeckCount(name: string): number {
    return deck.find(e => e.cardName === name)?.count ?? 0
  }

  function addCard(name: string) {
    if (fatiguedCards.includes(name)) return
    const owned = getOwnedCount(collection, name)
    const inDeck = inDeckCount(name)
    if (inDeck >= Math.min(owned, COPIES_MAX)) return
    if (total >= DECK_MAX) return
    setDeck(prev => {
      const idx = prev.findIndex(e => e.cardName === name)
      if (idx === -1) return [...prev, { cardName: name, count: 1 }]
      const next = [...prev]
      next[idx] = { ...next[idx], count: next[idx].count + 1 }
      return next
    })
  }

  function removeCard(name: string) {
    setDeck(prev => {
      const idx = prev.findIndex(e => e.cardName === name)
      if (idx === -1) return prev
      const next = [...prev]
      if (next[idx].count <= 1) {
        next.splice(idx, 1)
      } else {
        next[idx] = { ...next[idx], count: next[idx].count - 1 }
      }
      return next
    })
  }

  function handleAutoBuild(strategy: AutoStrategy) {
    const built = buildAutoDeck(strategy, collection, fatiguedCards)
    setDeck(built)
    setShowAutoBuild(false)
  }

  function handleSave() {
    saveDeck(deck)
    onBack()
  }

  function handleSaveNamed() {
    const name = saveNameInput.trim()
    if (!name) return
    saveNamedDeck(name, deck)
    setSavedDecks(loadSavedDecks())
    setSaveNameInput('')
  }

  function handleLoadSaved(saved: SavedDeck) {
    setDeck(saved.deck)
    setShowSavedDecks(false)
  }

  function handleDeleteSaved(name: string) {
    deleteSavedDeck(name)
    setSavedDecks(loadSavedDecks())
  }

  function handleCopyCode() {
    const code = encodeDeck(deck)
    navigator.clipboard.writeText(code).catch(() => {
      shareCodeRef.current?.select()
    })
    setCopyFeedback(true)
    setTimeout(() => setCopyFeedback(false), 1500)
  }

  function handleImport() {
    setImportError('')
    const decoded = decodeDeck(importCode)
    if (!decoded) {
      setImportError('Invalid code — could not decode.')
      return
    }
    const catalog = getCardCatalog()
    const valid = decoded.every(e => catalog.some(c => c.name === e.cardName))
    if (!valid) {
      setImportError('Code contains unknown cards.')
      return
    }
    setDeck(decoded)
    setImportCode('')
    setShowShare(false)
  }

  // Filtered + sorted collection panel
  const rarityOrder: Record<string, number> = { legendary: 0, rare: 1, uncommon: 2, common: 3 }
  const ownedCards = useMemo(() => {
    const q = search.trim().toLowerCase()
    return catalog
      .filter(c => {
        if (getOwnedCount(collection, c.name) === 0) return false
        if (typeFilter !== 'all' && c.cardType !== typeFilter) return false
        if (rarityFilter !== 'all' && c.rarity !== rarityFilter) return false
        if (q && !c.name.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'name')   return a.name.localeCompare(b.name)
        if (sortBy === 'rarity') return rarityOrder[a.rarity] - rarityOrder[b.rarity]
        return a.cost - b.cost || a.name.localeCompare(b.name)   // cost (default)
      })
  }, [catalog, collection, search, typeFilter, rarityFilter, sortBy])

  // Mana warning: deck has high-cost cards but no mana structure to unlock them
  const deckCardObjects = deck.flatMap(e => { const c = catalog.find(x => x.name === e.cardName); return c ? [c] : [] })
  const hasManaStructure = deckCardObjects.some(c => c.unit?.structureEffect?.type === 'mana')
  const maxDeckCost = deckCardObjects.reduce((m, c) => Math.max(m, c.cost), 0)
  const showManaWarning = maxDeckCost > 5 && !hasManaStructure

  // Deck list sorted by cost then name (skip any cards not in catalog)
  const deckList = deck
    .filter(e => catalog.some(c => c.name === e.cardName))
    .sort((a, b) => {
      const ca = catalog.find(c => c.name === a.cardName)!
      const cb = catalog.find(c => c.name === b.cardName)!
      return ca.cost - cb.cost || a.cardName.localeCompare(b.cardName)
    })

  return (
    <OverlayScreen
      title="DECK BUILDER"
      onBack={onBack}
      right={
        <span className={`overlay-count${valid ? ' overlay-count--valid' : ' overlay-count--invalid'}`}>
          {total}/{DECK_MAX} cards
          {total < DECK_MIN && ` (need ${DECK_MIN - total} more)`}
        </span>
      }
    >

      <div className="deckbuilder-body">
        {/* ── Left: collection ── */}
        <div className="deckbuilder-collection">
          <div className="deckbuilder-panel-title">YOUR CARDS — click to add</div>

          {/* Search + filter bar */}
          <div className="deckbuilder-filters">
            <input
              className="deckbuilder-search"
              type="text"
              placeholder="Search cards..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="deckbuilder-filter-row">
              <span className="filter-group-label">TYPE:</span>
            {([
              ['all',       'All'],
              ['unit',      'Units'],
              ['structure', 'Structs'],
              ['upgrade',   'Upgrades'],
            ] as const).map(([val, label]) => (
                <button
                  key={val}
                  className={`filter-btn filter-btn--sm${typeFilter === val ? ' filter-btn--active' : ''}`}
                  onClick={() => setTypeFilter(val as typeof typeFilter)}
                >
                  {label}
                </button>
              ))}
              <span className="filter-sep">|</span>
              <span className="filter-group-label">RARITY:</span>
              {([
                ['all',       'All'],
                ['common',    'Common'],
                ['uncommon',  'Uncommon'],
                ['rare',      'Rare'],
                ['legendary', 'Legendary'],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  className={`filter-btn filter-btn--sm${rarityFilter === val ? ' filter-btn--active' : ''}`}
                  onClick={() => setRarityFilter(val as typeof rarityFilter)}
                >
                  {label}
                </button>
              ))}
              <span className="filter-sep">|</span>
              <span className="filter-group-label">SORT:</span>
              {([
                ['cost',   'Cost'],
                ['name',   'A–Z'],
                ['rarity', 'Rarity'],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  className={`filter-btn filter-btn--sm${sortBy === val ? ' filter-btn--active' : ''}`}
                  onClick={() => setSortBy(val as typeof sortBy)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="collection-grid">
            {ownedCards.map(card => {
              const owned    = getOwnedCount(collection, card.name)
              const inDeck   = inDeckCount(card.name)
              const resting  = fatiguedCards.includes(card.name)
              const canAdd   = !resting && inDeck < Math.min(owned, COPIES_MAX) && total < DECK_MAX
              const lvl      = masteryLevel(getMasteryXp(collection, card.name))
              return (
                <div key={card.name} className={`collection-cell${resting ? ' collection-cell--resting' : ''}`}>
                  <CardTile
                    card={card}
                    canAfford={canAdd}
                    onClick={canAdd ? () => addCard(card.name) : undefined}
                  />
                  <div className="cell-footer">
                    <span className="cell-count">
                      {resting
                        ? <span className="cell-resting-label">ZZZ RESTING</span>
                        : <>{inDeck}/{owned}{lvl > 0 && <span className="cell-mastery-badge">★{lvl}</span>}</>
                      }
                    </span>
                    <button
                      className="extra-btn cdm-info-btn"
                      onClick={e => { e.stopPropagation(); openDetail(card) }}
                      title="Card details"
                    >ⓘ</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right: current deck ── */}
        <div className="deckbuilder-deck">
          <div className="deckbuilder-panel-title">DECK — click to remove</div>
          {deck.length === 0 ? (
            <div className="deck-empty">Add cards from the left.</div>
          ) : (
            <ul className="deck-list">
              {deckList.map(entry => {
                const card = catalog.find(c => c.name === entry.cardName)!
                const lvl  = masteryLevel(getMasteryXp(collection, entry.cardName))
                return (
                  <li
                    key={entry.cardName}
                    className={`deck-list-item deck-list-item--${card.rarity}`}
                    onClick={() => removeCard(entry.cardName)}
                    title="Click to remove one copy"
                  >
                    <span className="deck-list-cost">{card.cost}</span>
                    <span className="deck-list-name">{card.name}</span>
                    {lvl > 0 && <span className="deck-list-mastery">★{lvl}</span>}
                    <span className="deck-list-count">×{entry.count}</span>
                    <button
                      className="deck-list-info-btn"
                      onClick={e => { e.stopPropagation(); openDetail(card) }}
                      title="Card details"
                    >ⓘ</button>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="deckbuilder-footer">
            {showManaWarning && (
              <div style={{ fontSize: '11px', color: '#ffcc00', padding: '4px 0', lineHeight: 1.4 }}>
                ⚠ Deck has {maxDeckCost}-cost cards but no mana structure. Add a Farm or mana building to exceed 5 max mana.
              </div>
            )}
            <ProgressBar pct={(total / DECK_MAX) * 100} />
            <div className="deckbuilder-footer-row">
              <button
                className="action-btn"
                style={{ fontSize: '11px', padding: '5px 10px', borderColor: 'rgba(51,255,51,0.4)', color: 'var(--game-text-color-dim)' }}
                onClick={() => setShowAutoBuild(true)}
              >
                ⚡ AUTO BUILD
              </button>
              <button
                className="action-btn"
                style={{ fontSize: '11px', padding: '5px 10px', borderColor: 'rgba(51,255,51,0.4)', color: 'var(--game-text-color-dim)' }}
                onClick={() => { setSavedDecks(loadSavedDecks()); setShowSavedDecks(true) }}
              >
                💾 SAVED
              </button>
              <button
                className="action-btn"
                style={{ fontSize: '11px', padding: '5px 10px', borderColor: 'rgba(51,255,51,0.4)', color: 'var(--game-text-color-dim)' }}
                onClick={() => setShowShare(true)}
              >
                🔗 SHARE
              </button>
            </div>
            <button
              className={`action-btn${valid ? ' action-btn--large' : ''}`}
              onClick={handleSave}
              disabled={!valid}
            >
              {valid ? '✓ SAVE DECK' : `NEED ${DECK_MIN}+ CARDS`}
            </button>
          </div>
        </div>
      </div>

      {/* Auto-build strategy picker */}
      {showAutoBuild && (
        <div className="autobuild-backdrop" onClick={() => setShowAutoBuild(false)}>
          <div className="autobuild-panel" onClick={e => e.stopPropagation()}>
            <div>
              <div className="autobuild-title">⚡ AUTO BUILD</div>
              <div className="autobuild-sub">
                Choose a strategy. Your owned cards will be arranged into the strongest possible deck for that style.
                Resting cards are excluded.
              </div>
            </div>
            <div className="autobuild-strategies">
              {AUTO_STRATEGIES.map(s => (
                <button
                  key={s.id}
                  className="autobuild-strategy"
                  onClick={() => handleAutoBuild(s.id)}
                >
                  <span className="autobuild-strategy-name">{s.name}</span>
                  <span className="autobuild-strategy-desc">{s.desc}</span>
                </button>
              ))}
            </div>
            <button className="action-btn autobuild-cancel" onClick={() => setShowAutoBuild(false)}>
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Saved Decks panel */}
      {showSavedDecks && (
        <div className="autobuild-backdrop" onClick={() => setShowSavedDecks(false)}>
          <div className="autobuild-panel saveddecks-panel" onClick={e => e.stopPropagation()}>
            <div className="autobuild-title">💾 SAVED DECKS</div>
            {savedDecks.length === 0 ? (
              <div className="saveddecks-empty">No saved decks yet.</div>
            ) : (
              <ul className="saveddecks-list">
                {savedDecks.map(d => (
                  <li key={d.name} className="saveddecks-item">
                    <span className="saveddecks-name">{d.name}</span>
                    <span className="saveddecks-count">{deckTotalCards(d.deck)} cards</span>
                    <button className="filter-btn" onClick={() => handleLoadSaved(d)}>LOAD</button>
                    <button className="filter-btn action-btn--danger-text" onClick={() => handleDeleteSaved(d.name)}>✕</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="saveddecks-save-row">
              <input
                className="deckbuilder-search saveddecks-name-input"
                type="text"
                maxLength={24}
                placeholder="Deck name…"
                value={saveNameInput}
                onChange={e => setSaveNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveNamed() }}
              />
              <button
                className="action-btn"
                style={{ fontSize: '11px', padding: '5px 10px' }}
                onClick={handleSaveNamed}
                disabled={!saveNameInput.trim()}
              >
                SAVE CURRENT
              </button>
            </div>
            <button className="action-btn autobuild-cancel" onClick={() => setShowSavedDecks(false)}>
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* Share panel */}
      {showShare && (
        <div className="autobuild-backdrop" onClick={() => setShowShare(false)}>
          <div className="autobuild-panel share-panel" onClick={e => e.stopPropagation()}>
            <div className="autobuild-title">🔗 SHARE DECK</div>
            <div className="share-section">
              <div className="share-label">EXPORT — copy this code and share it:</div>
              <textarea
                ref={shareCodeRef}
                className="share-code-box"
                readOnly
                value={encodeDeck(deck)}
                onClick={e => (e.target as HTMLTextAreaElement).select()}
              />
              <button
                className="action-btn"
                style={{ fontSize: '11px', padding: '5px 10px', alignSelf: 'flex-start' }}
                onClick={handleCopyCode}
              >
                {copyFeedback ? '✓ COPIED!' : '📋 COPY'}
              </button>
            </div>
            <div className="share-divider">──────────</div>
            <div className="share-section">
              <div className="share-label">IMPORT — paste a deck code:</div>
              <textarea
                className="share-code-box"
                value={importCode}
                onChange={e => { setImportCode(e.target.value); setImportError('') }}
                placeholder="Paste code here…"
                rows={3}
              />
              {importError && <div className="share-error">{importError}</div>}
              <button
                className="action-btn"
                style={{ fontSize: '11px', padding: '5px 10px', alignSelf: 'flex-start' }}
                onClick={handleImport}
                disabled={!importCode.trim()}
              >
                LOAD DECK
              </button>
            </div>
            <button className="action-btn autobuild-cancel" onClick={() => setShowShare(false)}>
              CLOSE
            </button>
          </div>
        </div>
      )}

      {cardDetailNode}
    </OverlayScreen>
  )
}
