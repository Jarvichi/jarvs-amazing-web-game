import React, { useState, useMemo, useRef } from 'react'
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
  buildDeckCards,
} from '../../game/collection'
import { analyseDeckPower } from '../../game/deckPower'
import { loadPlayerArchetype } from '../../game/questline'
import { loadPlayerStats } from '../../game/playerStats'
import { useCardDetail } from './useCardDetail'
import { OverlayScreen } from '../ui/OverlayScreen'
import { TutorialOverlay } from '../modals/TutorialOverlay'
import { hasSeen, markSeen } from '../../game/tutorial'
import { Icon } from '../ui/icons/Icon'
import { DeckPowerBadge } from './DeckPowerBadge'
import { AutoBuildModal, AutoStrategy } from './deckbuilder/AutoBuildModal'
import { SavedDecksModal } from './deckbuilder/SavedDecksModal'
import { ShareDeckModal } from './deckbuilder/ShareDeckModal'
import { DeckPanel } from './deckbuilder/DeckPanel'
import { CollectionPanel } from './deckbuilder/CollectionPanel'
import { DeckFilterMenu, DeckGroupKey, DeckRarityFilter, DeckSortKey, DeckTypeFilter } from './deckbuilder/DeckFilterBar'

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
  const [typeFilter, setTypeFilter]       = useState<DeckTypeFilter>('all')
  const [rarityFilter, setRarityFilter]   = useState<DeckRarityFilter>('all')
  const [tagFilter, setTagFilter]         = useState<UnitTag[]>([])
  const [affinityFilter, setAffinityFilter] = useState<string | null>(null)
  const [sortKey, setSortKey]             = useState<DeckSortKey>('default')
  const [groupKey, setGroupKey]           = useState<DeckGroupKey>('none')
  const [openMenu, setOpenMenu] = useState<DeckFilterMenu>(null)

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

  // Deck power rating. Scored from built cards rather than catalogue entries
  // so the player's mastery levels and equipped augments are priced in.
  const deckPower = useMemo(
    () => analyseDeckPower(buildDeckCards(deck, collection), {
      archetype: loadPlayerArchetype(),
      maxMana: loadPlayerStats().maxMana,
    }),
    [deck, collection],
  )

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

  const deckPanelItems = deckList.map(entry => {
    const card    = catalog.find(c => c.name === entry.cardName)!
    const resting = fatiguedCards.includes(entry.cardName)
    const xp      = getMasteryXp(collection, entry.cardName)
    const level   = masteryLevel(xp)
    return { card, count: entry.count, resting, xp, level, comboCount: synergyOf(card).combos }
  })

  let lastGroup: string | null = null
  const collectionPanelItems = sorted.map(card => {
    const owned   = getOwnedCount(collection, card.name)
    const inDeck  = inDeckCount(card.name)
    const resting = fatiguedCards.includes(card.name)
    const atCopyLimit = owned > 0 && inDeck >= Math.min(owned, COPIES_MAX)
    const canAdd  = !atCopyLimit && total < playerDeckMax
    const xp      = getMasteryXp(collection, card.name)
    const { level } = masteryProgress(xp)
    const label   = groupLabel(card)
    const synergy = synergyOf(card)
    const showHeader = label !== null && label !== lastGroup
    if (showHeader) lastGroup = label
    return {
      card, inDeck, owned, canAdd, atCopyLimit, resting, xp, level,
      comboCount: synergy.combos, synergyGroupCount: synergy.groups,
      groupLabel: showHeader ? label : null,
    }
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
          <DeckPowerBadge power={deckPower} />
          {showManaWarning && (
            <span className="deckbuilder-mana-warn" title={`Deck has ${maxDeckCost}-cost cards but no mana structure`}>
              <Icon name="warning" size={11} /> no mana building
            </span>
          )}
        </div>
      }
    >
      <div className={`deckbuilder-split u-col u-grow${
        collectionCollapsed ? ' deckbuilder-split--deck-only'
        : deckCollapsed ? ' deckbuilder-split--collection-only' : ''
      }`}>
        <DeckPanel
          collapsed={deckCollapsed}
          onToggleCollapse={() => togglePanel('deck')}
          activeSlot={activeSlot}
          onSwitchSlot={handleSwitchSlot}
          onOpenAutoBuild={() => setShowAutoBuild(true)}
          onOpenSavedDecks={() => { setSavedDecks(loadSavedDecks()); setShowSavedDecks(true) }}
          onOpenShare={() => setShowShare(true)}
          total={total}
          playerDeckMax={playerDeckMax}
          deckLength={deck.length}
          search={search}
          items={deckPanelItems}
          onRemove={removeCard}
          onInfo={openDetail}
        />

        {/* The panels used to be separated by a bar carrying a ⠿ drag handle.
            Nothing was draggable: it swapped which panel was collapsed, and
            in the default state (both panels open) clicking it did nothing at
            all. The collapse buttons already do that job, so the separator is
            now a plain rule on the panel below. */}

        <CollectionPanel
          collapsed={collectionCollapsed}
          onToggleCollapse={() => togglePanel('collection')}
          shownCount={filtered.length}
          search={search}
          onSearchChange={setSearch}
          onClearSearch={() => setSearch('')}
          typeFilter={typeFilter}
          rarityFilter={rarityFilter}
          tagFilter={tagFilter}
          affinityFilter={affinityFilter}
          affinityLabels={allAffinityLabels}
          sortKey={sortKey}
          groupKey={groupKey}
          openMenu={openMenu}
          onOpenMenuChange={setOpenMenu}
          onTypeChange={setTypeFilter}
          onRarityChange={setRarityFilter}
          onTagToggle={toggleTag}
          onAffinityChange={setAffinityFilter}
          onSortChange={setSortKey}
          onGroupChange={setGroupKey}
          onResetFilters={resetFilters}
          items={collectionPanelItems}
          onAdd={addCard}
          onInfo={openDetail}
        />
      </div>

      {showAutoBuild && (
        <AutoBuildModal onSelect={handleAutoBuild} onClose={() => setShowAutoBuild(false)} />
      )}

      {showSavedDecks && (
        <SavedDecksModal
          savedDecks={savedDecks}
          saveNameInput={saveNameInput}
          onSaveNameChange={setSaveNameInput}
          onSave={handleSaveNamed}
          onLoad={handleLoadSaved}
          onDelete={handleDeleteSaved}
          onClose={() => setShowSavedDecks(false)}
        />
      )}

      {showShare && (
        <ShareDeckModal
          deckCode={encodeDeck(deck)}
          shareCodeRef={shareCodeRef}
          copyFeedback={copyFeedback}
          onCopy={handleCopyCode}
          importCode={importCode}
          importError={importError}
          onImportCodeChange={value => { setImportCode(value); setImportError('') }}
          onImport={handleImport}
          onClose={() => setShowShare(false)}
        />
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
