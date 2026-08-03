import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Card, CardType, CardRarity, UnitTag } from '../../game/types'
import { getCardCatalog, getCardThemeTags } from '../../game/cards'
import { buildDeckProfile, getDeckSynergy } from '../../game/synergies'
import {
  loadCollection,
  loadDeck,
  saveDeck,
  deckTotalCards,
  isDeckValid,
  getOwnedCount,
  getMasteryXp,
  masteryLevel,
  masteryProgress,
  DECK_MIN,
  DECK_MAX,
  COPIES_MAX,
  getPlayerMaxDeckSize,
  getActiveDeckSlot,
  setActiveDeckSlot,
  DeckSlot,
  CollectionEntry,
  DeckEntry,
  SavedDeck,
  loadSavedDecks,
  saveNamedDeck,
  deleteSavedDeck,
  encodeDeck,
  decodeDeck,
} from '../../game/collection'
import { CardTile } from './CardTile'
import { MasteryBar } from '../ui/MasteryBar'
import { useCardDetail } from './useCardDetail'
import { OverlayScreen } from '../ui/OverlayScreen'
import { ProgressBar } from '../ui/ProgressBar'
import { TutorialOverlay } from '../modals/TutorialOverlay'
import { hasSeen, markSeen } from '../../game/tutorial'

const DECK_TUTORIAL_ID = 'deckbuilder'
const DECK_TUTORIAL_STEPS = [
  {
    title: 'YOUR DECK',
    body: 'Cards you add appear here. You need between 10 and 30 cards to play. You can have up to 4 copies of each card.',
  },
  {
    title: 'COLLECTION',
    body: 'Your owned cards are listed below. Tap a card to add it to your deck — tap it in the deck to remove it.',
  },
  {
    title: 'FILTERS & SORT',
    body: 'Use the filter and sort buttons to find what you need. When your deck is ready, tap BACK — it saves automatically.',
  },
]

interface Props {
  onBack: () => void
  fatiguedCards?: string[]   // card names that cannot be added to the deck this act
}

type AutoStrategy = 'aggro' | 'control' | 'balanced' | 'ranged'
type RarityFilter = 'all' | CardRarity
type TypeFilter   = 'all' | CardType
type SortKey  = 'default' | 'az' | 'za' | 'mana-asc' | 'mana-desc' | 'rarity' | 'synergy'
type GroupKey = 'none' | 'type' | 'rarity' | 'mana' | 'act'

const ALL_TAGS: UnitTag[] = [
  'flying', 'ranged', 'melee', 'fast', 'slow', 'large',
  'magic', 'undead', 'beast', 'armored', 'siege', 'fire',
]

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

  const available = catalog.filter(
    c => getOwnedCount(collection, c.name) > 0 && !fatiguedCards.includes(c.name)
  )

  function score(c: typeof available[0]): number {
    const ownedCopies = Math.min(getOwnedCount(collection, c.name), COPIES_MAX)
    let s = 0

    if (strategy === 'aggro') {
      if (c.cardType === 'unit')      s += c.cost <= 2 ? 100 : c.cost <= 3 ? 60 : 20
      if (c.cardType === 'upgrade')   s += 30
      if (c.cardType === 'structure') s += c.unit?.isWall ? 5 : 15
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

    } else {
      if (c.cardType === 'unit')      s += 60
      if (c.cardType === 'structure') s += 50
      if (c.cardType === 'upgrade')   s += 40
    }

    const rarityBonus: Record<string, number> = { common: 0, uncommon: 10, rare: 20, legendary: 35 }
    s += rarityBonus[c.rarity] ?? 0
    s += ownedCopies * 5
    return s
  }

  const scored = available
    .map(c => ({ card: c, score: score(c), maxCopies: Math.min(getOwnedCount(collection, c.name), COPIES_MAX) }))
    .sort((a, b) => b.score - a.score)

  const deck: DeckEntry[] = []
  let total = 0

  for (const { card, maxCopies } of scored) {
    if (total >= 20) break
    if (maxCopies < 1) continue
    deck.push({ cardName: card.name, count: 1 })
    total++
  }

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
  const catalog = useMemo(() => getCardCatalog(), [])
  const [collection] = useState<CollectionEntry[]>(loadCollection)
  const [activeSlot, setActiveSlot] = useState<DeckSlot>(getActiveDeckSlot)
  const [deck, setDeck] = useState<DeckEntry[]>(() =>
    loadDeck().filter(e => catalog.some(c => c.name === e.cardName))
  )
  const { openDetail, cardDetailNode } = useCardDetail({ collection, deckEntries: deck })

  // Split panel collapse state
  const [deckCollapsed, setDeckCollapsed] = useState(false)
  const [collectionCollapsed, setCollectionCollapsed] = useState(false)

  // Tutorial
  const [showTutorial, setShowTutorial] = useState(() => !hasSeen(DECK_TUTORIAL_ID))

  // Modal state
  const [showAutoBuild, setShowAutoBuild] = useState(false)
  const [showSavedDecks, setShowSavedDecks] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>(() => loadSavedDecks())
  const [saveNameInput, setSaveNameInput] = useState('')
  const [importCode, setImportCode] = useState('')
  const [importError, setImportError] = useState('')
  const [copyFeedback, setCopyFeedback] = useState(false)
  const shareCodeRef = useRef<HTMLTextAreaElement>(null)

  // Collection filter / sort / group state
  const [search, setSearch]               = useState('')
  const [typeFilter, setTypeFilter]       = useState<TypeFilter>('all')
  const [rarityFilter, setRarityFilter]   = useState<RarityFilter>('all')
  const [tagFilter, setTagFilter]         = useState<UnitTag[]>([])
  const [affinityFilter, setAffinityFilter] = useState<string | null>(null)
  const [sortKey, setSortKey]             = useState<SortKey>('default')
  const [groupKey, setGroupKey]           = useState<GroupKey>('none')
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [sortMenuOpen, setSortMenuOpen]     = useState(false)
  const [groupMenuOpen, setGroupMenuOpen]   = useState(false)
  const filterMenuRef = useRef<HTMLDivElement>(null)
  const sortMenuRef   = useRef<HTMLDivElement>(null)
  const groupMenuRef  = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    if (!filterMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setFilterMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [filterMenuOpen])

  useEffect(() => {
    if (!sortMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [sortMenuOpen])

  useEffect(() => {
    if (!groupMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) {
        setGroupMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [groupMenuOpen])

  // Affinity label → card name set (both sides of each pair)
  const allAffinityLabels = useMemo(() =>
    Array.from(new Set(catalog.flatMap(c => c.unit?.affinity?.label ? [c.unit.affinity.label] : []))).sort(),
    [catalog]
  )
  const affinityGroupNames = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const c of catalog) {
      const aff = c.unit?.affinity
      if (!aff) continue
      if (!map.has(aff.label)) map.set(aff.label, new Set())
      const group = map.get(aff.label)!
      group.add(c.name)
      group.add(aff.withName)
    }
    return map
  }, [catalog])

  const RARITY_ORDER: Record<CardRarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, shiny: 6, holofoil: 7, glass: 8 }
  const TYPE_ORDER: Record<CardType, number>     = { unit: 0, structure: 1, upgrade: 2, augment: 3 }

  const catalogPos = useMemo(() => new Map<string, number>(catalog.map((c, i) => [c.name, i])), [catalog])

  function defaultSortKey(card: Card): number {
    if (card.unit?.structureEffect?.type === 'spawn') {
      const spawnedName = card.unit.structureEffect.unitTemplate.name
      const unitPos = catalogPos.get(spawnedName)
      if (unitPos !== undefined) return unitPos + 0.5
    }
    return catalogPos.get(card.name) ?? 999999
  }

  function groupSortValue(card: Card): string {
    switch (groupKey) {
      case 'type':   return String(TYPE_ORDER[card.cardType]).padStart(2, '0')
      case 'rarity': return String(RARITY_ORDER[card.rarity]).padStart(2, '0')
      case 'mana':   return String(card.cost).padStart(3, '0')
      case 'act':    return getCardThemeTags(card.name)[0] ?? ''
      default:       return ''
    }
  }

  function groupLabel(card: Card): string | null {
    switch (groupKey) {
      case 'type':   return card.cardType.charAt(0).toUpperCase() + card.cardType.slice(1) + 's'
      case 'rarity': return card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1)
      case 'mana':   return `${card.cost} Mana`
      case 'act': {
        const t = getCardThemeTags(card.name)[0]
        return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Other'
      }
      default: return null
    }
  }

  const q = search.trim().toLowerCase()

  const filtered = useMemo(() => catalog.filter(c => {
    if (getOwnedCount(collection, c.name) === 0) return false
    if (typeFilter   !== 'all' && c.cardType !== typeFilter)   return false
    if (rarityFilter !== 'all' && c.rarity   !== rarityFilter) return false
    if (tagFilter.length > 0) {
      const unitTags = c.unit?.tags ?? []
      if (!tagFilter.some(t => unitTags.includes(t))) return false
    }
    if (affinityFilter) {
      const group = affinityGroupNames.get(affinityFilter)
      if (!group || !group.has(c.name)) return false
    }
    if (q && !c.name.toLowerCase().includes(q)) return false
    return true
  }), [catalog, collection, typeFilter, rarityFilter, tagFilter, affinityFilter, q, affinityGroupNames])

  // Synergy against the current deck, recomputed on every add/remove. The deck
  // profile is built once and reused across all ~960 browser cards.
  const synergyScores = useMemo(() => {
    const profile = buildDeckProfile(deck.map(e => e.cardName))
    const scores  = new Map<string, number>()
    for (const card of catalog) scores.set(card.name, getDeckSynergy(card, profile).score)
    return scores
  }, [catalog, deck])

  const synergyOf = (card: Card) => synergyScores.get(card.name) ?? 0

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (groupKey !== 'none') {
      const cmp = groupSortValue(a).localeCompare(groupSortValue(b))
      if (cmp !== 0) return cmp
    }
    switch (sortKey) {
      case 'az':        return a.name.localeCompare(b.name)
      case 'za':        return b.name.localeCompare(a.name)
      case 'mana-asc':  return a.cost - b.cost
      case 'mana-desc': return b.cost - a.cost
      case 'rarity':    return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]
      case 'synergy':   return (synergyOf(b) - synergyOf(a)) || a.name.localeCompare(b.name)
      default:          return groupKey === 'none' ? defaultSortKey(a) - defaultSortKey(b) : 0
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [filtered, sortKey, groupKey, synergyScores])

  const activeFilterCount =
    (typeFilter    !== 'all' ? 1 : 0) +
    (rarityFilter  !== 'all' ? 1 : 0) +
    tagFilter.length +
    (affinityFilter ? 1 : 0)

  function resetFilters() {
    setTypeFilter('all')
    setRarityFilter('all')
    setTagFilter([])
    setAffinityFilter(null)
  }

  function toggleTag(tag: UnitTag) {
    setTagFilter(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  // Deck helpers
  const total = deckTotalCards(deck)
  const playerDeckMax = getPlayerMaxDeckSize()
  const valid = isDeckValid(deck)

  function inDeckCount(name: string): number {
    return deck.find(e => e.cardName === name)?.count ?? 0
  }

  function addCard(name: string) {
    const owned = getOwnedCount(collection, name)
    const inDeck = inDeckCount(name)
    if (inDeck >= Math.min(owned, COPIES_MAX)) return
    if (total >= playerDeckMax) return
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

  function handleSwitchSlot(slot: DeckSlot) {
    if (slot === activeSlot) return
    saveDeck(deck)
    setActiveDeckSlot(slot)
    setActiveSlot(slot)
    setDeck(loadDeck().filter(e => catalog.some(c => c.name === e.cardName)))
  }

  function handleBack() {
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
    const valid = decoded.every(e => catalog.some(c => c.name === e.cardName))
    if (!valid) {
      setImportError('Code contains unknown cards.')
      return
    }
    setDeck(decoded)
    setImportCode('')
    setShowShare(false)
  }

  // Mana warning
  const deckCardObjects = deck.flatMap(e => { const c = catalog.find(x => x.name === e.cardName); return c ? [c] : [] })
  const hasManaStructure = deckCardObjects.some(c => c.unit?.structureEffect?.type === 'mana')
  const maxDeckCost = deckCardObjects.reduce((m, c) => Math.max(m, c.cost), 0)
  const showManaWarning = maxDeckCost > 5 && !hasManaStructure

  // Deck list sorted by cost then name, filtered by active search term
  const deckList = deck
    .filter(e => {
      if (!catalog.some(c => c.name === e.cardName)) return false
      if (q && !e.cardName.toLowerCase().includes(q)) return false
      return true
    })
    .sort((a, b) => {
      const ca = catalog.find(c => c.name === a.cardName)!
      const cb = catalog.find(c => c.name === b.cardName)!
      return ca.cost - cb.cost || a.cardName.localeCompare(b.cardName)
    })

  return (
    <OverlayScreen
      title="DECK BUILDER"
      onBack={handleBack}
      right={
        <span className={`overlay-count${valid ? ' overlay-count--valid' : ' overlay-count--invalid'}`}>
          {total}/{playerDeckMax} cards
          {total < DECK_MIN && ` (need ${DECK_MIN - total} more)`}
        </span>
      }
    >
<div className="deckbuilder-header-actions u-flex u-items-c u-gap-2 u-wrap">
   {showManaWarning && (
                <span className="deckbuilder-mana-warn" title={`Deck has ${maxDeckCost}-cost cards but no mana structure`}>
                  ⚠ no mana building
                </span>
              )}
              <button
                className="action-btn db-action-sm"
                onClick={() => setShowAutoBuild(true)}
                title="Auto Build"
              >⚡ AUTO</button>
              <button
                className="action-btn db-action-sm"
                onClick={() => { setSavedDecks(loadSavedDecks()); setShowSavedDecks(true) }}
                title="Saved Decks"
              >💾 SAVED</button>
              <button
                className="action-btn db-action-sm"
                onClick={() => setShowShare(true)}
                title="Share Deck"
              >🔗 SHARE</button>
</div>

      <div className="deckbuilder-split u-col u-grow">

        {/* ── TOP PANEL: current deck ── */}
        <div className={`deckbuilder-top-panel${deckCollapsed ? ' deckbuilder-panel--collapsed' : ''}`}>
          <div className="deckbuilder-panel-header">
            <span className="deckbuilder-panel-label">
              DECK — click to remove
            </span>
            <div className="deck-slot-toggle u-flex u-items-c u-gap-1">
              <button
                className={`deck-slot-btn${activeSlot === 'a' ? ' deck-slot-btn--active' : ''}`}
                onClick={() => handleSwitchSlot('a')}
                title="Deck A"
              >A</button>
              <button
                className={`deck-slot-btn${activeSlot === 'b' ? ' deck-slot-btn--active' : ''}`}
                onClick={() => handleSwitchSlot('b')}
                title="Deck B"
              >B</button>
            </div>
            <div className="deckbuilder-header-actions u-flex u-items-c u-gap-2 u-wrap">
           
              <button
                className="db-collapse-btn"
                onClick={() => {
                  if (!deckCollapsed && !collectionCollapsed) {
                    setDeckCollapsed(true)           // collapse deck, collection stays open
                  } else if (deckCollapsed) {
                    setDeckCollapsed(false)           // expand deck
                  } else {

setDeckCollapsed(true)
setCollectionCollapsed(false)
}
                  // do nothing if collection is already collapsed (can't collapse both)
                }}
                title={deckCollapsed ? 'Expand deck panel' : 'Collapse deck panel'}
              >{deckCollapsed ? '▼' : '▲'}</button>
            </div>
          </div>

          {!deckCollapsed && (
            <>
              <ProgressBar pct={(total / playerDeckMax) * 100} />
              <div className="deckbuilder-deck-grid">
                {deck.length === 0 ? (
                  <div className="deck-empty">Add cards from the collection below.</div>
                ) : deckList.length === 0 ? (
                  <div className="deck-empty">No deck cards match "{search}".</div>
                ) : (
                  <div className="collection-grid u-flex u-wrap u-just-c u-gap-4 u-grow">
                    {deckList.map(entry => {
                      const card    = catalog.find(c => c.name === entry.cardName)!
                      const resting = fatiguedCards.includes(entry.cardName)
                      const lvl     = masteryLevel(getMasteryXp(collection, entry.cardName))
                      return (
                        <div
                          key={entry.cardName}
                          className={`collection-cell u-col deck-cell${resting ? ' deck-cell--resting' : ''}`}
                        >
                          {resting && (
                            <div className="resting-overlay">
                              <span className="resting-badge">💤 RESTING</span>
                            </div>
                          )}
                          <CardTile
                            card={card}
                            onClick={() => removeCard(entry.cardName)}
                            deckMatches={synergyOf(card)}
                            showDetails={true}
                          />
                          <div className="cell-footer">
                            <span className="cell-count">
                              ×{entry.count}
                              {lvl > 0 && <span className="cell-mastery-badge">★{lvl}</span>}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── DIVIDER ── */}
        <div
          className="deckbuilder-divider u-flex u-items-c u-just-c u-pointer u-no-select"
          title="Swap expanded panel"
          onClick={() => {
            if (deckCollapsed) {
              setDeckCollapsed(false)
              setCollectionCollapsed(true)
            } else if (collectionCollapsed) {
              setCollectionCollapsed(false)
              setDeckCollapsed(true)
            }
            // both open — no-op; use the panel collapse buttons
          }}
        >
          <span className="deckbuilder-divider-handle">⠿</span>
        </div>

        {/* ── BOTTOM PANEL: collection ── */}
        <div className={`deckbuilder-bottom-panel${collectionCollapsed ? ' deckbuilder-panel--collapsed' : ''}`}>
          <div className="deckbuilder-panel-header">
            <span className="deckbuilder-panel-label">COLLECTION — click to add</span>
            <div className="deckbuilder-header-actions u-flex u-items-c u-gap-2 u-wrap">
              <span className="filter-owned" style={{ fontSize: '10px' }}>{filtered.length} cards</span>
              <button
                className="db-collapse-btn"
                onClick={() => {
                  if (!collectionCollapsed && !deckCollapsed) {
                    setCollectionCollapsed(true)      // collapse collection, deck stays open
                  } else if (collectionCollapsed) {
                    setCollectionCollapsed(false)     // expand collection
                  } else {
setDeckCollapsed(false)
setCollectionCollapsed(true)
 }
                  // do nothing if deck is already collapsed (can't collapse both)
                }}
                title={collectionCollapsed ? 'Expand collection panel' : 'Collapse collection panel'}
              >{collectionCollapsed ? '▲' : '▼'}</button>
            </div>
          </div>

          {!collectionCollapsed && (
            <div className="deckbuilder-collection-inner u-grow u-col">
              {/* Search */}
              <div className="deckbuilder-search-wrap u-row">
                <input
                  className="deckbuilder-search"
                  type="text"
                  placeholder="Search cards…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <input type="reset" value="X" alt="Clear the search form" className="action-btn action-btn--xs" onClick={() => setSearch('')} />
              </div>

              {/* Filter / Sort / Group bar */}
              <div className="filter-bar">
                {/* FILTERS */}
                <div className="filter-popup-wrap" ref={filterMenuRef}>
                  <button
                    className={`filter-btn${activeFilterCount > 0 ? ' filter-btn--active' : ''}`}
                    onClick={() => { setFilterMenuOpen(o => !o); setSortMenuOpen(false); setGroupMenuOpen(false) }}
                  >
                    ▼ FILTERS{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                  </button>
                  {filterMenuOpen && (
                    <div className="filter-popup">
                      <div className="filter-popup-section u-col">
                        <span className="filter-group-label">TYPE</span>
                        <div className="filter-popup-btns u-flex u-wrap u-gap-2">
                          {(['all', 'unit', 'structure', 'upgrade'] as const).map(val => (
                            <button
                              key={val}
                              className={`filter-btn filter-btn--sm${typeFilter === val ? ' filter-btn--active' : ''}`}
                              onClick={() => setTypeFilter(val)}
                            >
                              {val === 'all' ? 'All' : val.charAt(0).toUpperCase() + val.slice(1) + 's'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="filter-popup-section u-col">
                        <span className="filter-group-label">RARITY</span>
                        <div className="filter-popup-btns u-flex u-wrap u-gap-2">
                          {(['all', 'common', 'uncommon', 'rare', 'legendary'] as const).map(val => (
                            <button
                              key={val}
                              className={`filter-btn filter-btn--sm${rarityFilter === val ? ' filter-btn--active' : ''}`}
                              onClick={() => setRarityFilter(val)}
                            >
                              {val.charAt(0).toUpperCase() + val.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="filter-popup-section u-col">
                        <span className="filter-group-label">TAGS <span className="filter-group-hint">(any match)</span></span>
                        <div className="filter-popup-btns u-flex u-wrap u-gap-2">
                          {ALL_TAGS.map(tag => (
                            <button
                              key={tag}
                              className={`filter-btn filter-btn--sm${tagFilter.includes(tag) ? ' filter-btn--active' : ''}`}
                              onClick={() => toggleTag(tag)}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                      {allAffinityLabels.length > 0 && (
                        <div className="filter-popup-section u-col">
                          <span className="filter-group-label">AFFINITY</span>
                          <div className="filter-popup-btns u-flex u-wrap u-gap-2">
                            {allAffinityLabels.map(label => (
                              <button
                                key={label}
                                className={`filter-btn filter-btn--sm${affinityFilter === label ? ' filter-btn--active' : ''}`}
                                onClick={() => setAffinityFilter(prev => prev === label ? null : label)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {activeFilterCount > 0 && (
                        <div className="filter-popup-footer">
                          <button className="filter-btn filter-btn--sm filter-btn--reset" onClick={resetFilters}>
                            ✕ Clear all filters
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* SORT */}
                <div className="filter-popup-wrap" ref={sortMenuRef}>
                  <button
                    className={`filter-btn${sortKey !== 'default' ? ' filter-btn--active' : ''}`}
                    onClick={() => { setSortMenuOpen(o => !o); setFilterMenuOpen(false); setGroupMenuOpen(false) }}
                  >
                    ↕ SORT{sortKey !== 'default' ? ` (${sortKey})` : ''}
                  </button>
                  {sortMenuOpen && (
                    <div className="filter-popup">
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
                          ] as [SortKey, string][]).map(([val, label]) => (
                            <button
                              key={val}
                              className={`filter-btn filter-btn--sm${sortKey === val ? ' filter-btn--active' : ''}`}
                              onClick={() => setSortKey(val)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* GROUP */}
                <div className="filter-popup-wrap" ref={groupMenuRef}>
                  <button
                    className={`filter-btn${groupKey !== 'none' ? ' filter-btn--active' : ''}`}
                    onClick={() => { setGroupMenuOpen(o => !o); setFilterMenuOpen(false); setSortMenuOpen(false) }}
                  >
                    ⊞ GROUP{groupKey !== 'none' ? ` (${groupKey})` : ''}
                  </button>
                  {groupMenuOpen && (
                    <div className="filter-popup">
                      <div className="filter-popup-section u-col">
                        <div className="filter-popup-btns u-flex u-wrap u-gap-2">
                          {([
                            ['none',    'None'],
                            ['type',    'Type'],
                            ['rarity',  'Rarity'],
                            ['mana',    'Mana'],
                            ['act',     'Act'],
                          ] as [GroupKey, string][]).map(([val, label]) => (
                            <button
                              key={val}
                              className={`filter-btn filter-btn--sm${groupKey === val ? ' filter-btn--active' : ''}`}
                              onClick={() => setGroupKey(val)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Active filter pills */}
                {activeFilterCount > 0 && (
                  <div className="filter-active-pills u-flex u-gap-2 u-grow u-items-c">
                    {typeFilter !== 'all' && (
                      <span className="filter-pill">{typeFilter}s <button onClick={() => setTypeFilter('all')}>✕</button></span>
                    )}
                    {rarityFilter !== 'all' && (
                      <span className="filter-pill">{rarityFilter} <button onClick={() => setRarityFilter('all')}>✕</button></span>
                    )}
                    {tagFilter.map(t => (
                      <span key={t} className="filter-pill">{t} <button onClick={() => toggleTag(t)}>✕</button></span>
                    ))}
                    {affinityFilter && (
                      <span className="filter-pill">affinity:{affinityFilter} <button onClick={() => setAffinityFilter(null)}>✕</button></span>
                    )}
                  </div>
                )}
              </div>

              {/* Collection grid */}
              <div className="deckbuilder-collection-grid">
                <div className="collection-grid u-flex u-wrap u-just-c u-gap-4 u-grow">
                  {(() => {
                    let lastGroup: string | null = null
                    return sorted.map(card => {
                      const owned   = getOwnedCount(collection, card.name)
                      const inDeck  = inDeckCount(card.name)
                      const resting = fatiguedCards.includes(card.name)
                      const canAdd  = inDeck < Math.min(owned, COPIES_MAX) && total < playerDeckMax
                      const xp      = getMasteryXp(collection, card.name)
                      const { level: lvl } = masteryProgress(xp)
                      const label   = groupLabel(card)
                      const synergy = synergyOf(card)
                      const showHeader = label !== null && label !== lastGroup
                      if (showHeader) lastGroup = label
                      return (
                        <React.Fragment key={card.name}>
                          {showHeader && (
                            <div className="collection-group-header">{label}</div>
                          )}
                          <div className={`collection-cell u-col${resting ? ' collection-cell--resting' : ''}${synergy > 0 ? ' collection-cell--synergy' : ''}`}>
                            <CardTile
                              card={card}
                              canAfford={canAdd}
                              deckMatches={synergy}
                              onClick={canAdd ? () => addCard(card.name) : undefined}
                            />
                            <div className="cell-footer">
                              <span className="cell-count">
                                {resting
                                  ? <><span className="cell-resting-label">💤</span> {inDeck}/{owned}</>
                                  : <>{inDeck}/{owned}{lvl > 0 && <span className="cell-mastery-badge">★{lvl}</span>}</>
                                }
                              </span>
                              <button
                                className="extra-btn cdm-info-btn"
                                onClick={e => { e.stopPropagation(); openDetail(card) }}
                                title="Card details"
                              >ⓘ</button>
                            </div>
                            {xp > 0 && <MasteryBar xp={xp} />}
                          </div>
                        </React.Fragment>
                      )
                    })
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Auto-build modal ── */}
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
            <div className="autobuild-strategies u-col u-gap-4">
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

      {/* ── Saved Decks modal ── */}
      {showSavedDecks && (
        <div className="autobuild-backdrop" onClick={() => setShowSavedDecks(false)}>
          <div className="autobuild-panel saveddecks-panel" onClick={e => e.stopPropagation()}>
            <div className="autobuild-title">💾 SAVED DECKS</div>
            {savedDecks.length === 0 ? (
              <div className="saveddecks-empty">No saved decks yet.</div>
            ) : (
              <ul className="saveddecks-list">
                {savedDecks.map(d => (
                  <li key={d.name} className="saveddecks-item u-flex u-items-c u-gap-4">
                    <span className="saveddecks-name">{d.name}</span>
                    <span className="saveddecks-count">{deckTotalCards(d.deck)} cards</span>
                    <button className="filter-btn" onClick={() => handleLoadSaved(d)}>LOAD</button>
                    <button className="filter-btn action-btn--danger-text" onClick={() => handleDeleteSaved(d.name)}>✕</button>
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

      {/* ── Share modal ── */}
      {showShare && (
        <div className="autobuild-backdrop" onClick={() => setShowShare(false)}>
          <div className="autobuild-panel share-panel" onClick={e => e.stopPropagation()}>
            <div className="autobuild-title">🔗 SHARE DECK</div>
            <div className="share-section u-col u-gap-3">
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
            <div className="share-section u-col u-gap-3">
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
      {showTutorial && (
        <TutorialOverlay
          steps={DECK_TUTORIAL_STEPS}
          onDone={() => { markSeen(DECK_TUTORIAL_ID); setShowTutorial(false) }}
        />
      )}
    </OverlayScreen>
  )
}
