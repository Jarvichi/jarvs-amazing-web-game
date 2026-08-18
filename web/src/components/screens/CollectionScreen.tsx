import React, { useState, useRef, useEffect, useCallback, memo } from 'react'
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
  CollectionEntry,
  DISENCHANT_VALUE,
  COPIES_MAX,
} from '../../game/collection'
import { promotionsRemainingToday } from '../../game/commander'
import { incrementAchievementProgress } from '../../game/achievements'
import { CardTile } from '../cards/CardTile'
import { CardDetailModal } from '../cards/CardDetailModal'
import { CardAugmentScreen } from '../cards/CardAugmentScreen'
import { OverlayScreen } from '../ui/OverlayScreen'
import { MasteryBar } from '../ui/MasteryBar'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { Button } from '../ui/Button'

interface Props {
  crystals: number
  onCrystalsChanged: (n: number) => void
  onBack: () => void
  commanderName?: string | null
  onPromoteCommander?: (cardName: string) => void
  onViewAugments?: () => void
  embedded?: boolean
}

type RarityFilter = 'all' | CardRarity
type TypeFilter   = 'all' | CardType
type SpecialFilter = 'upgradeable'
type AffinityFilter = string  // affinity label, e.g. "Death Rally"
type SortKey  = 'default' | 'az' | 'za' | 'mana-asc' | 'mana-desc' | 'rarity'
type GroupKey = 'none' | 'type' | 'rarity' | 'mana' | 'act'

const ALL_TAGS: UnitTag[] = [
  'flying', 'ranged', 'melee', 'fast', 'slow', 'large',
  'magic', 'undead', 'beast', 'armored', 'siege', 'fire',
]

const LazyCell = memo(function LazyCell({ children, className }: { children: React.ReactNode; className: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={className}>
      {visible ? children : null}
    </div>
  )
})

export function CollectionScreen({ crystals, onCrystalsChanged, onBack, commanderName, onPromoteCommander, onViewAugments, embedded }: Props) {
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
  const [typeFilter,    setTypeFilter]    = useState<TypeFilter>('all')
  const [rarityFilter,  setRarityFilter]  = useState<RarityFilter>('all')
  const [specialFilter, setSpecialFilter] = useState<SpecialFilter | null>(null)
  const [tagFilter,     setTagFilter]     = useState<UnitTag[]>([])
  const [affinityFilter, setAffinityFilter] = useState<AffinityFilter | null>(null)
  const [sortKey,  setSortKey]  = useState<SortKey>('default')
  const [groupKey, setGroupKey] = useState<GroupKey>('none')
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [sortMenuOpen,   setSortMenuOpen]   = useState(false)
  const [groupMenuOpen,  setGroupMenuOpen]  = useState(false)
  const [flash, setFlash]       = useState<string | null>(null)
  const [upgradeModal, setUpgradeModal] = useState<Array<{cardName: string, xpGained: number}> | null>(null)
  const [disenchantModal, setDisenchantModal] = useState<Array<{cardName: string, crystals: number}> | null>(null)
  const [detailCard, setDetailCard] = useState<import('../../game/types').Card | null>(null)
  const [augmentCard, setAugmentCard] = useState<import('../../game/types').Card | null>(null)
  const [levelUpCard, setLevelUpCard] = useState<string | null>(null)
  const [secretToast, setSecretToast] = useState<string | null>(null)
  const legendaryViewCount = useRef(0)
  const filterMenuRef = useRef<HTMLDivElement>(null)
  const sortMenuRef   = useRef<HTMLDivElement>(null)
  const groupMenuRef  = useRef<HTMLDivElement>(null)

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

  const totalOwned  = collection.reduce((s, e) => s + e.count, 0)
  const totalExtras = collection.reduce((s, e) => s + Math.max(0, e.count - COPIES_MAX), 0)
  const totalUpgradeable = collection.reduce((s, e) => s + (Math.max(0, e.count - COPIES_MAX) > 0 ? 1 : 0), 0)

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
  function defaultSortKey(card: import('../../game/types').Card): number {
    if (card.unit?.structureEffect?.type === 'spawn') {
      const spawnedName = card.unit.structureEffect.unitTemplate.name
      const unitPos = catalogPos.get(spawnedName)
      if (unitPos !== undefined) return unitPos + 0.5
    }
    return catalogPos.get(card.name) ?? 999999
  }

  function groupSortValue(card: import('../../game/types').Card): string {
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

  function groupLabel(card: import('../../game/types').Card): string | null {
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

  const activeFilterCount =
    (typeFilter    !== 'all' ? 1 : 0) +
    (rarityFilter  !== 'all' ? 1 : 0) +
    tagFilter.length +
    (affinityFilter ? 1 : 0) +
    (specialFilter  ? 1 : 0)

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
    setFlash(msg)
    setTimeout(() => setFlash(null), 2000)
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

  const inner = (
    <>

      {/* Action row */}
      <div className="collection-action-row u-flex u-items-c u-gap-4 u-wrap">
        <Button
          size="sm"
          className="collection-disenchant-btn"
          onClick={handleDisenchantAll}
          disabled={totalExtras === 0}
          style={{ flex: 1 }}
        >
          🔮 Disenchant extras ({totalExtras})
        </Button>
        <Button
          size="sm"
          className="collection-master-btn"
          onClick={handleMasterAll}
          disabled={totalUpgradeable === 0}
          title="Convert all extra copies into mastery XP"
          style={{ flex: 1 }}
        >
          ★ Upgrade all ({totalUpgradeable})
        </Button>
        {flash && <span className="collection-flash">{flash}</span>}
        {secretToast && <div className="collection-secret-toast">{secretToast}</div>}
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
              {/* TYPE */}
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

              {/* RARITY */}
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

              {/* TAGS */}
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

              {/* AFFINITY */}
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

              {/* SPECIAL */}
              <div className="filter-popup-section u-col">
                <span className="filter-group-label">SPECIAL</span>
                <div className="filter-popup-btns u-flex u-wrap u-gap-2">
                  <button
                    className={`filter-btn filter-btn--sm${specialFilter === 'upgradeable' ? ' filter-btn--active filter-btn--gold' : ''}`}
                    onClick={() => setSpecialFilter(prev => prev === 'upgradeable' ? null : 'upgradeable')}
                  >
                    ★ Upgradeable
                  </button>
                </div>
              </div>

              {/* Reset */}
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
            {specialFilter && (
              <span className="filter-pill">★upgradeable <button onClick={() => setSpecialFilter(null)}>✕</button></span>
            )}
          </div>
        )}

        <span className="filter-owned">{filtered.length} cards</span>
      </div>

      {/* Grid */}
      <div className="collection-grid u-flex u-wrap u-just-c u-gap-4 u-grow">
        {(() => {
          let lastGroup: string | null = null
          return sorted.map(card => {
            const owned  = getOwnedCount(collection, card.name)
            const extras = Math.max(0, owned - COPIES_MAX)
            const xp     = getMasteryXp(collection, card.name)
            const { level: lvl } = masteryProgress(xp)
            const label = groupLabel(card)
            const showHeader = label !== null && label !== lastGroup
            if (showHeader) lastGroup = label

            return (
              <React.Fragment key={card.name}>
                {showHeader && (
                  <div className="collection-group-header">{label}</div>
                )}
                <LazyCell className={`collection-cell u-col${owned === 0 ? ' collection-cell--unowned' : ''}${levelUpCard === card.name ? ' collection-cell--levelup' : ''}`}>
                  <CardTile
                    card={card}
                    canAfford={true}
                    upgradeable={extras > 0}
                    onClick={() => {
                      // if (card.cardType === 'unit' && card.unit && card.unit.moveSpeed > 0) {
                      //   setAugmentCard(card)
                      // } else {
                        setDetailCard(card)
                      // }
                      if (card.rarity === 'legendary') {
                        legendaryViewCount.current += 1
                        if (legendaryViewCount.current === 10) {
                          incrementAchievementProgress('misc:legend_stare')
                          setSecretToast('✦ The legendaries have noticed your gaze.')
                          setTimeout(() => setSecretToast(null), 3500)
                        }
                      }
                    }}
                  />

                  <div className="cell-footer">
                    {owned === 0 && questTargetCards.has(card.name)
                      ? <span className="earn-via-quest-badge">EARN VIA QUEST</span>
                      : <span className="cell-count">
                          ×{owned}{lvl > 0 && <span className="cell-mastery-badge">★{lvl}</span>}
                        </span>}
                  </div>

                  {xp > 0 && <MasteryBar xp={xp} />}
                </LazyCell>
              </React.Fragment>
            )
          })
        })()}
      </div>

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
        <ModalBackdrop onClose={() => setDisenchantModal(null)} zIndex={300}>
          <div className="daily-modal" style={{ maxWidth: 360, textAlign: 'left' }}>
            <div className="daily-modal-header">🔮 DISENCHANT ALL</div>
            <div className="daily-modal-sub">
              {disenchantModal.length} card{disenchantModal.length !== 1 ? 's' : ''} sold
            </div>
            <div style={{ width: '100%', maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {disenchantModal.map(({ cardName, crystals: val }) => (
                <div key={cardName} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', borderBottom: '1px solid #222' }}>
                  <span>{cardName}</span>
                  <span style={{ color: '#88ccff' }}>+{val} 💎</span>
                </div>
              ))}
            </div>
            <div className="daily-modal-desc" style={{ textAlign: 'center' }}>
              Total: +{disenchantModal.reduce((s, i) => s + i.crystals, 0)} 💎
            </div>
            <Button onClick={() => setDisenchantModal(null)}>OK</Button>
          </div>
        </ModalBackdrop>
      )}

      {upgradeModal && (
        <ModalBackdrop onClose={() => setUpgradeModal(null)} zIndex={300}>
          <div className="daily-modal" style={{ maxWidth: 360, textAlign: 'left' }}>
            <div className="daily-modal-header">★ UPGRADE ALL</div>
            <div className="daily-modal-sub">
              {upgradeModal.length} card{upgradeModal.length !== 1 ? 's' : ''} upgraded
            </div>
            <div style={{ width: '100%', maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {upgradeModal.map(({ cardName, xpGained }) => (
                <div key={cardName} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', borderBottom: '1px solid #222' }}>
                  <span>{cardName}</span>
                  <span style={{ color: '#ffcc00' }}>+{xpGained} XP</span>
                </div>
              ))}
            </div>
            <div className="daily-modal-desc" style={{ textAlign: 'center' }}>
              Total: +{upgradeModal.reduce((s, i) => s + i.xpGained, 0)} mastery XP
            </div>
            <Button onClick={() => setUpgradeModal(null)}>OK</Button>
          </div>
        </ModalBackdrop>
      )}
    </>
  )

  if (embedded) return inner
  return (
    <OverlayScreen title="COLLECTION" onBack={onBack} right={
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {onViewAugments && (
          <Button style={{ fontSize: 12, padding: '3px 10px' }} onClick={onViewAugments}>
            Augments 👻
          </Button>
        )}
        <span className="crystal-count">💎 {crystals.toLocaleString()}</span>
      </div>
    }>
      {inner}
    </OverlayScreen>
  )
}
