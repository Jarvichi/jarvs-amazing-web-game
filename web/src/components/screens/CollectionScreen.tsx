import React, { useState, useRef } from 'react'
import { Card, CardRarity, CardType, UnitTag, SECRET_RARITIES } from '../../game/types'
import { getCardCatalog, getCardThemeTags } from '../../game/cards'
import { getQuestTargetCards } from '../../game/quests'
import {
  loadCollection,
  saveCollection,
  saveCrystals,
  getOwnedCount,
  getMasteryXp,
  masteryProgress,
  disenchantCard,
  disenchantAllExtras,
  masterAllExtras,
  syncDeckToCollection,
  getCollectionCompletion,
  CollectionEntry,
  DISENCHANT_VALUE,
  COPIES_MAX,
} from '../../game/collection'
import { promotionsRemainingToday } from '../../game/commander'
import { incrementAchievementProgress } from '../../game/achievements'
import { CardDetailModal } from '../cards/CardDetailModal'
import { CardAugmentScreen } from '../cards/CardAugmentScreen'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Button } from '../ui/Button'
import { Icon } from '../ui/icons/Icon'
import { ProgressBar } from '../ui/ProgressBar'
import { useToast } from '../ui/Toast'
import { CollectionFilterBar, CollFilterMenu, CollGroupKey, CollRarityFilter, CollSortKey, CollSpecialFilter, CollTypeFilter } from './collection/CollectionFilterBar'
import { CollectionActionRow } from './collection/CollectionActionRow'
import { CollectionGrid } from './collection/CollectionGrid'
import { DisenchantAllModal } from './collection/DisenchantAllModal'
import { UpgradeAllModal } from './collection/UpgradeAllModal'

interface Props {
  crystals: number
  onCrystalsChanged: (n: number) => void
  onBack: () => void
  commanderName?: string | null
  onPromoteCommander?: (cardName: string) => void
  onViewAugments?: () => void
  embedded?: boolean
}

export function CollectionScreen({ crystals, onCrystalsChanged, onBack, commanderName, onPromoteCommander, onViewAugments, embedded }: Props) {
  const { showToast } = useToast()
  const catalog = getCardCatalog()
  const questTargetCards = getQuestTargetCards()
  const allAffinityLabels = Array.from(
    new Set(catalog.flatMap(c => c.unit?.affinity?.label ? [c.unit.affinity.label] : []))
  ).sort()
  // Map: affinity label → set of card names in that synergy group (both sides of the pair)
  const affinityGroupNames = new Map<string, Set<string>>()
  for (const c of catalog) {
    const aff = c.unit?.affinity
    if (!aff) continue
    if (!affinityGroupNames.has(aff.label)) affinityGroupNames.set(aff.label, new Set())
    const group = affinityGroupNames.get(aff.label)!
    group.add(c.name)        // the card that benefits
    group.add(aff.withName)  // the card that triggers it
  }
  const [collection, setCollection] = useState<CollectionEntry[]>(loadCollection)
  const [typeFilter,    setTypeFilter]    = useState<CollTypeFilter>('all')
  const [rarityFilter,  setRarityFilter]  = useState<CollRarityFilter>('all')
  const [specialFilter, setSpecialFilter] = useState<CollSpecialFilter | null>(null)
  const [tagFilter,     setTagFilter]     = useState<UnitTag[]>([])
  const [affinityFilter, setAffinityFilter] = useState<string | null>(null)
  const [sortKey,  setSortKey]  = useState<CollSortKey>('default')
  const [groupKey, setGroupKey] = useState<CollGroupKey>('none')
  const [openMenu, setOpenMenu] = useState<CollFilterMenu>(null)
  const [upgradeModal, setUpgradeModal] = useState<Array<{cardName: string, xpGained: number}> | null>(null)
  const [disenchantModal, setDisenchantModal] = useState<Array<{cardName: string, crystals: number}> | null>(null)
  const [detailCard, setDetailCard] = useState<Card | null>(null)
  const [augmentCard, setAugmentCard] = useState<Card | null>(null)
  const [levelUpCard, setLevelUpCard] = useState<string | null>(null)
  const legendaryViewCount = useRef(0)

  const totalOwned  = collection.reduce((s, e) => s + e.count, 0)
  const totalExtras = collection.reduce((s, e) => s + Math.max(0, e.count - COPIES_MAX), 0)
  const totalUpgradeable = collection.reduce((s, e) => s + (Math.max(0, e.count - COPIES_MAX) > 0 ? 1 : 0), 0)
  const { distinctOwned, pct: completionPct } = getCollectionCompletion(collection)

  const filtered = catalog.filter(c => {
    // Secret rarities are hidden until the player has obtained at least one copy —
    // except quest-chain rewards, which are shown with an "Earn via Quest" badge
    if (SECRET_RARITIES.has(c.rarity) && getOwnedCount(collection, c.name) === 0 && !questTargetCards.has(c.name)) return false
    if (typeFilter   !== 'all' && c.cardType !== typeFilter)   return false
    if (rarityFilter !== 'all' && c.rarity   !== rarityFilter) return false
    if (specialFilter === 'upgradeable') {
      const owned = getOwnedCount(collection, c.name)
      if (Math.max(0, owned - COPIES_MAX) === 0) return false
    }
    if (tagFilter.length > 0) {
      const unitTags = c.unit?.tags ?? []
      if (!tagFilter.some(t => unitTags.includes(t))) return false
    }
    if (affinityFilter) {
      const group = affinityGroupNames.get(affinityFilter)
      if (!group || !group.has(c.name)) return false
    }
    return true
  })

  const RARITY_ORDER: Record<CardRarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, shiny: 6, holofoil: 7, glass: 8 }
  const TYPE_ORDER: Record<CardType, number>     = { unit: 0, structure: 1, upgrade: 2, augment: 3 }

  // Default sort: spawn buildings appear immediately after the unit they spawn.
  const catalogPos = new Map<string, number>(catalog.map((c, i) => [c.name, i]))
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

  const sorted = [...filtered].sort((a, b) => {
    // Primary: group key
    if (groupKey !== 'none') {
      const cmp = groupSortValue(a).localeCompare(groupSortValue(b))
      if (cmp !== 0) return cmp
    }
    // Secondary: sort key
    switch (sortKey) {
      case 'az':        return a.name.localeCompare(b.name)
      case 'za':        return b.name.localeCompare(a.name)
      case 'mana-asc':  return a.cost - b.cost
      case 'mana-desc': return b.cost - a.cost
      case 'rarity':    return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]
      default:          return groupKey === 'none' ? defaultSortKey(a) - defaultSortKey(b) : 0
    }
  })

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

  function resetFilters() {
    setTypeFilter('all')
    setRarityFilter('all')
    setSpecialFilter(null)
    setTagFilter([])
    setAffinityFilter(null)
  }

  function toggleTag(tag: UnitTag) {
    setTagFilter(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  function notify(msg: string) {
    showToast(msg, { variant: 'reward', duration: 2000 })
  }

  function handleDisenchantAll() {
    const items: Array<{cardName: string, crystals: number}> = []
    for (const entry of collection) {
      const extras = Math.max(0, entry.count - COPIES_MAX)
      if (extras > 0) {
        const card = catalog.find(c => c.name === entry.cardName)
        const val = DISENCHANT_VALUE[card?.rarity ?? 'common'] * extras
        items.push({ cardName: entry.cardName, crystals: val })
      }
    }
    const { collection: updated, gained } = disenchantAllExtras(collection)
    saveCollection(updated)
    syncDeckToCollection(updated)
    setCollection(updated)
    const next = crystals + gained
    saveCrystals(next)
    onCrystalsChanged(next)
    setDisenchantModal(items)
  }

  function handleMasterAll() {
    let updated = [...collection]
    const items: Array<{cardName: string, xpGained: number}> = []
    for (const entry of collection) {
      const extras = Math.max(0, entry.count - COPIES_MAX)
      if (extras > 0) {
        updated = masterAllExtras(updated, entry.cardName)
        items.push({ cardName: entry.cardName, xpGained: extras })
      }
    }
    saveCollection(updated)
    syncDeckToCollection(updated)
    setCollection(updated)
    setUpgradeModal(items)
  }

  function handleDisenchantCard(cardName: string) {
    const { collection: updated, gained } = disenchantCard(collection, cardName)
    saveCollection(updated)
    syncDeckToCollection(updated)
    setCollection(updated)
    const next = crystals + gained
    saveCrystals(next)
    onCrystalsChanged(next)
    notify(`+${gained} 💎`)
  }

  function handleMasterCard(cardName: string) {
    const before  = getMasteryXp(collection, cardName)
    const entry   = collection.find(e => e.cardName === cardName)
    const extras  = entry ? Math.max(0, entry.count - COPIES_MAX) : 0
    if (extras === 0) return
    const updated = masterAllExtras(collection, cardName)
    saveCollection(updated)
    syncDeckToCollection(updated)
    setCollection(updated)
    const after = getMasteryXp(updated, cardName)
    const { level: lvlBefore } = masteryProgress(before)
    const { level: lvlAfter  } = masteryProgress(after)
    if (lvlAfter > lvlBefore) {
      setLevelUpCard(cardName)
      setTimeout(() => setLevelUpCard(null), 1600)
    }
    notify(lvlAfter > lvlBefore
      ? `${cardName} reached Mastery ${lvlAfter}!`
      : `+${extras} mastery XP for ${cardName}`)
  }

  function handleCardClick(card: Card) {
    setDetailCard(card)
    if (card.rarity === 'legendary') {
      legendaryViewCount.current += 1
      if (legendaryViewCount.current === 10) {
        incrementAchievementProgress('misc:legend_stare')
        showToast('✦ The legendaries have noticed your gaze.', { variant: 'reward', duration: 3500 })
      }
    }
  }

  let lastGroup: string | null = null
  const gridItems = sorted.map(card => {
    const owned  = getOwnedCount(collection, card.name)
    const extras = Math.max(0, owned - COPIES_MAX)
    const xp     = getMasteryXp(collection, card.name)
    const { level } = masteryProgress(xp)
    const label = groupLabel(card)
    const showHeader = label !== null && label !== lastGroup
    if (showHeader) lastGroup = label
    return {
      card, owned, extras, xp, level,
      groupLabel: showHeader ? label : null,
      earnViaQuest: questTargetCards.has(card.name),
      levelingUp: levelUpCard === card.name,
    }
  })

  const inner = (
    <>
      <CollectionActionRow
        totalExtras={totalExtras}
        totalUpgradeable={totalUpgradeable}
        onDisenchantAll={handleDisenchantAll}
        onMasterAll={handleMasterAll}
      />

      <CollectionFilterBar
        typeFilter={typeFilter}
        rarityFilter={rarityFilter}
        specialFilter={specialFilter}
        tagFilter={tagFilter}
        affinityFilter={affinityFilter}
        affinityLabels={allAffinityLabels}
        sortKey={sortKey}
        groupKey={groupKey}
        openMenu={openMenu}
        onOpenMenuChange={setOpenMenu}
        onTypeChange={setTypeFilter}
        onRarityChange={setRarityFilter}
        onSpecialChange={setSpecialFilter}
        onTagToggle={toggleTag}
        onAffinityChange={setAffinityFilter}
        onSortChange={setSortKey}
        onGroupChange={setGroupKey}
        onResetFilters={resetFilters}
        shownCount={filtered.length}
        totalOwned={totalOwned}
      />

      {/* Collection progress */}
      <div className="collection-progress u-flex u-items-c u-gap-3">
        <ProgressBar pct={completionPct} className="collection-progress-bar" />
        <span className="collection-progress-label">{distinctOwned}/{catalog.length} discovered ({completionPct}%)</span>
      </div>

      <CollectionGrid items={gridItems} onCardClick={handleCardClick} />

      {augmentCard && (
        <CardAugmentScreen
          card={augmentCard}
          collection={collection}
          onClose={() => setAugmentCard(null)}
        />
      )}

      {detailCard && (() => {
        const dOwned   = getOwnedCount(collection, detailCard.name)
        const dExtras  = Math.max(0, dOwned - COPIES_MAX)
        const dVal     = DISENCHANT_VALUE[detailCard.rarity] * dExtras
        return (
          <CardDetailModal
            card={detailCard}
            collection={collection}
            extras={dExtras}
            disenchantValue={dVal}
            onDisenchant={dExtras > 0 ? () => { handleDisenchantCard(detailCard.name); setDetailCard(null) } : undefined}
            onMasterCard={dExtras > 0 ? () => { handleMasterCard(detailCard.name); setDetailCard(null) } : undefined}
            onClose={() => setDetailCard(null)}
            commanderName={commanderName}
            promotionsLeft={promotionsRemainingToday()}
            onPromote={onPromoteCommander ? () => { onPromoteCommander(detailCard.name); setDetailCard(null) } : undefined}
          />
        )
      })()}

      {disenchantModal && (
        <DisenchantAllModal items={disenchantModal} onClose={() => setDisenchantModal(null)} />
      )}

      {upgradeModal && (
        <UpgradeAllModal items={upgradeModal} onClose={() => setUpgradeModal(null)} />
      )}
    </>
  )

  if (embedded) return inner
  return (
    <OverlayScreen title="COLLECTION" onBack={onBack} right={
      <div className="u-flex u-items-c u-gap-4">
        {onViewAugments && (
          <Button size="sm" onClick={onViewAugments}>
            Augments 👻
          </Button>
        )}
        <span className="crystal-count"><Icon name="crystal" size={14} /> {crystals.toLocaleString()}</span>
      </div>
    }>
      {inner}
    </OverlayScreen>
  )
}
