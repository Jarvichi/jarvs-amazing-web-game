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
import { CardCellFooter } from './CardCellFooter'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { useCardDetail } from './useCardDetail'
import { OverlayScreen } from '../ui/OverlayScreen'
import { ProgressBar } from '../ui/ProgressBar'
import { TutorialOverlay } from '../modals/TutorialOverlay'
import { hasSeen, markSeen } from '../../game/tutorial'
import { FilterPopup } from '../ui/filters/FilterPopup'
import { FilterOption } from '../ui/filters/FilterOption'
import { FilterPill } from '../ui/filters/FilterPill'

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
  const [openMenu, setOpenMenu] = useState<'filters' | 'sort' | 'group' | null>(null)

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
  const synergyByName = useMemo(() => {
    const profile = buildDeckProfile(deck.map(e => e.cardName))
    const result  = new Map<string, { combos: number; groups: number; score: number }>()
    for (const card of catalog) {
      const s = getDeckSynergy(card, profile)
      result.set(card.name, { combos: s.combos.length, groups: s.groups.length, score: s.score })
    }
    return result
  }, [catalog, deck])

  const NO_SYNERGY = { combos: 0, groups: 0, score: 0 }
  const synergyOf = (card: Card) => synergyByName.get(card.name) ?? NO_SYNERGY

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
      case 'synergy':   return (synergyOf(b).score - synergyOf(a).score) || a.name.localeCompare(b.name)
      default:          return groupKey === 'none' ? defaultSortKey(a) - defaultSortKey(b) : 0
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [filtered, sortKey, groupKey, synergyByName])

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

  /**
   * Collapsing one panel always expands the other, so "you can never collapse
   * both" is enforced by construction. The two call sites previously had
   * hand-rolled three-branch conditionals whose trailing comments ("do nothing
   * if the other is already collapsed") described behaviour the code did not
   * actually have — the final branch swapped the panels.
   */
  function togglePanel(which: 'deck' | 'collection') {
    if (which === 'deck') {
      const next = !deckCollapsed
      setDeckCollapsed(next)
      if (next) setCollectionCollapsed(false)
    } else {
      const next = !collectionCollapsed
      setCollectionCollapsed(next)
      if (next) setDeckCollapsed(false)
    }
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
        /* Deck status lives in one place. The mana warning used to sit in a
           row of action buttons below the header, where it was the only
           *state* among *actions* and shifted the whole layout whenever it
           appeared. It belongs next to the size counter — the other signal
           that says "this deck isn't ready". */
        <div className="deckbuilder-status u-col u-items-end u-gap-1">
          <span className={`overlay-count${valid ? ' overlay-count--valid' : ' overlay-count--invalid'}`}>
            {total}/{playerDeckMax} cards
            {total < DECK_MIN && ` (need ${DECK_MIN - total} more)`}
          </span>
          {showManaWarning && (
            <span className="deckbuilder-mana-warn" title={`Deck has ${maxDeckCost}-cost cards but no mana structure`}>
              ⚠ no mana building
            </span>
          )}
        </div>
      }
    >
      <div className="deckbuilder-split u-col u-grow">

        {/* ── TOP PANEL: current deck ── */}
        <div className={`deckbuilder-top-panel${deckCollapsed ? ' deckbuilder-panel--collapsed' : ''}`}>
          {/* Deck-scoped actions live in the deck's own header. They used to
              sit in a loose, unpadded row between the page header and this
              one — a fourth stacked band belonging to neither. */}
          <div className="deckbuilder-panel-header">
            <span className="deckbuilder-panel-label">
              DECK<span className="deckbuilder-panel-hint"> — click to remove</span>
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
            <div className="deckbuilder-header-actions">
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
              <button
                className="db-collapse-btn"
                onClick={() => togglePanel('deck')}
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
                  /* Gaps are asymmetric (see .collection-grid) — no u-gap-* here. */
                  <div className="collection-grid u-flex u-wrap u-just-c u-grow">
                    {deckList.map(entry => {
                      const card    = catalog.find(c => c.name === entry.cardName)!
                      const resting = fatiguedCards.includes(entry.cardName)
                      const xp      = getMasteryXp(collection, entry.cardName)
                      const lvl     = masteryLevel(xp)
                      return (
                        <div
                          key={entry.cardName}
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
                              onClick={() => removeCard(entry.cardName)}
                              deckMatches={synergyOf(card).combos}
                              showDetails={true}
                            />
                          </div>
                          <CardCellFooter xp={xp} onInfo={() => openDetail(card)}>
                            <span className="cell-count">
                              ×{entry.count}
                              {lvl > 0 && <span className="cell-mastery-badge">★{lvl}</span>}
                            </span>
                          </CardCellFooter>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* The panels used to be separated by a bar carrying a ⠿ drag handle.
            Nothing was draggable: it swapped which panel was collapsed, and
            in the default state (both panels open) clicking it did nothing at
            all. The collapse buttons already do that job, so the separator is
            now a plain rule on the panel below. */}

        {/* ── BOTTOM PANEL: collection ── */}
        <div className={`deckbuilder-bottom-panel${collectionCollapsed ? ' deckbuilder-panel--collapsed' : ''}`}>
          <div className="deckbuilder-panel-header">
            <span className="deckbuilder-panel-label">
              COLLECTION<span className="deckbuilder-panel-hint"> — click to add</span>
            </span>
            <div className="deckbuilder-header-actions">
              {/* "shown", not "cards": this is the count of distinct owned
                  cards after filtering, not a number of copies. Matches the
                  Collection screen's wording. */}
              <span className="filter-owned">{filtered.length} shown</span>
              <button
                className="db-collapse-btn"
                onClick={() => togglePanel('collection')}
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
                {/* Was an <input type="reset"> carrying an `alt` attribute —
                    not valid on a reset input, so it had no accessible name. */}
                <button
                  type="button"
                  className="action-btn action-btn--xs"
                  aria-label="Clear search"
                  title="Clear search"
                  onClick={() => setSearch('')}
                >✕</button>
              </div>

              {/* Filter / Sort / Group bar */}
              <div className="filter-bar">
                {/* FILTERS */}
                <FilterPopup
                  label="▼ FILTERS"
                  activeSuffix={activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                  isActive={activeFilterCount > 0}
                  open={openMenu === 'filters'}
                  onToggle={() => setOpenMenu(m => m === 'filters' ? null : 'filters')}
                  onClose={() => setOpenMenu(m => m === 'filters' ? null : m)}
                  footer={activeFilterCount > 0 && (
                    <div className="filter-popup-footer">
                      <button className="filter-btn filter-btn--sm filter-btn--reset" onClick={resetFilters}>
                        ✕ Clear all filters
                      </button>
                    </div>
                  )}
                >
                  <div className="filter-popup-section u-col">
                    <span className="filter-group-label">TYPE</span>
                    <div className="filter-popup-btns u-flex u-wrap u-gap-2">
                      {(['all', 'unit', 'structure', 'upgrade'] as const).map(val => (
                        <FilterOption key={val} active={typeFilter === val} onClick={() => setTypeFilter(val)}>
                          {val === 'all' ? 'All' : val.charAt(0).toUpperCase() + val.slice(1) + 's'}
                        </FilterOption>
                      ))}
                    </div>
                  </div>
                  <div className="filter-popup-section u-col">
                    <span className="filter-group-label">RARITY</span>
                    <div className="filter-popup-btns u-flex u-wrap u-gap-2">
                      {(['all', 'common', 'uncommon', 'rare', 'legendary'] as const).map(val => (
                        <FilterOption key={val} active={rarityFilter === val} onClick={() => setRarityFilter(val)}>
                          {val.charAt(0).toUpperCase() + val.slice(1)}
                        </FilterOption>
                      ))}
                    </div>
                  </div>
                  <div className="filter-popup-section u-col">
                    <span className="filter-group-label">TAGS <span className="filter-group-hint">(any match)</span></span>
                    <div className="filter-popup-btns u-flex u-wrap u-gap-2">
                      {ALL_TAGS.map(tag => (
                        <FilterOption key={tag} active={tagFilter.includes(tag)} onClick={() => toggleTag(tag)}>
                          {tag}
                        </FilterOption>
                      ))}
                    </div>
                  </div>
                  {allAffinityLabels.length > 0 && (
                    <div className="filter-popup-section u-col">
                      <span className="filter-group-label">AFFINITY</span>
                      <div className="filter-popup-btns u-flex u-wrap u-gap-2">
                        {allAffinityLabels.map(label => (
                          <FilterOption
                            key={label}
                            active={affinityFilter === label}
                            onClick={() => setAffinityFilter(prev => prev === label ? null : label)}
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
                  onToggle={() => setOpenMenu(m => m === 'sort' ? null : 'sort')}
                  onClose={() => setOpenMenu(m => m === 'sort' ? null : m)}
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
                      ] as [SortKey, string][]).map(([val, label]) => (
                        <FilterOption key={val} active={sortKey === val} onClick={() => setSortKey(val)}>
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
                  onToggle={() => setOpenMenu(m => m === 'group' ? null : 'group')}
                  onClose={() => setOpenMenu(m => m === 'group' ? null : m)}
                >
                  <div className="filter-popup-section u-col">
                    <div className="filter-popup-btns u-flex u-wrap u-gap-2">
                      {([
                        ['none',    'None'],
                        ['type',    'Type'],
                        ['rarity',  'Rarity'],
                        ['mana',    'Mana'],
                        ['act',     'Act'],
                      ] as [GroupKey, string][]).map(([val, label]) => (
                        <FilterOption key={val} active={groupKey === val} onClick={() => setGroupKey(val)}>
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
                      <FilterPill onRemove={() => setTypeFilter('all')}>{typeFilter}s</FilterPill>
                    )}
                    {rarityFilter !== 'all' && (
                      <FilterPill onRemove={() => setRarityFilter('all')}>{rarityFilter}</FilterPill>
                    )}
                    {tagFilter.map(t => (
                      <FilterPill key={t} onRemove={() => toggleTag(t)}>{t}</FilterPill>
                    ))}
                    {affinityFilter && (
                      <FilterPill onRemove={() => setAffinityFilter(null)}>affinity:{affinityFilter}</FilterPill>
                    )}
                  </div>
                )}
              </div>

              {/* Collection grid */}
              <div className="deckbuilder-collection-grid">
                {/* Gaps are asymmetric (see .collection-grid) — no u-gap-* here. */}
                <div className="collection-grid u-flex u-wrap u-just-c u-grow">
                  {(() => {
                    let lastGroup: string | null = null
                    return sorted.map(card => {
                      const owned   = getOwnedCount(collection, card.name)
                      const inDeck  = inDeckCount(card.name)
                      const resting = fatiguedCards.includes(card.name)
                      const atCopyLimit = owned > 0 && inDeck >= Math.min(owned, COPIES_MAX)
                      const canAdd  = !atCopyLimit && total < playerDeckMax
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
                          <div className={`collection-cell u-col${resting ? ' collection-cell--resting' : ''}${synergy.combos > 0 ? ' collection-cell--combo' : synergy.groups > 0 ? ' collection-cell--synergy' : ''}`}>
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
                                deckMatches={synergy.combos}
                                onClick={canAdd ? () => addCard(card.name) : undefined}
                              />
                            </div>
                            <CardCellFooter xp={xp} onInfo={() => openDetail(card)}>
                              <span className="cell-count">
                                {inDeck}/{owned}
                                {lvl > 0 && <span className="cell-mastery-badge">★{lvl}</span>}
                                {atCopyLimit && <span className="cell-copy-limit-badge">MAX</span>}
                              </span>
                            </CardCellFooter>
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
        <ModalBackdrop onClose={() => setShowAutoBuild(false)} title="Auto Build">
          <div className="autobuild-panel">
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
        </ModalBackdrop>
      )}

      {/* ── Saved Decks modal ── */}
      {showSavedDecks && (
        <ModalBackdrop onClose={() => setShowSavedDecks(false)} title="Saved Decks">
          <div className="autobuild-panel saveddecks-panel">
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
        </ModalBackdrop>
      )}

      {/* ── Share modal ── */}
      {showShare && (
        <ModalBackdrop onClose={() => setShowShare(false)} title="Share Deck">
          <div className="autobuild-panel share-panel">
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
        </ModalBackdrop>
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
