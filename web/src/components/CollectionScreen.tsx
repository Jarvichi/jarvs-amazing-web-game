import React, { useState, useRef, useEffect } from 'react'
import { Card, CardRarity, CardType, UnitTag } from '../game/types'
import { getCardCatalog } from '../game/cards'
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
} from '../game/collection'
import { CardTile } from './CardTile'
import { useCardDetail } from './useCardDetail'
import { OverlayScreen } from './OverlayScreen'
import { MasteryBar } from './MasteryBar'

interface Props {
  crystals: number
  onCrystalsChanged: (n: number) => void
  onBack: () => void
}

type RarityFilter = 'all' | CardRarity
type TypeFilter   = 'all' | CardType
type SpecialFilter = 'upgradeable'
type AffinityFilter = string  // affinity label, e.g. "Death Rally"

const ALL_TAGS: UnitTag[] = [
  'flying', 'ranged', 'melee', 'fast', 'slow', 'large',
  'magic', 'undead', 'beast', 'armored', 'siege', 'fire',
]


export function CollectionScreen({ crystals, onCrystalsChanged, onBack }: Props) {
  const catalog = getCardCatalog()
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
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [flash, setFlash]       = useState<string | null>(null)
  const { openDetail, cardDetailNode } = useCardDetail({ collection })
  const filterMenuRef = useRef<HTMLDivElement>(null)

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

  const totalOwned  = collection.reduce((s, e) => s + e.count, 0)
  const totalExtras = collection.reduce((s, e) => s + Math.max(0, e.count - COPIES_MAX), 0)
  const totalUpgradeable = collection.reduce((s, e) => s + (Math.max(0, e.count - COPIES_MAX) > 0 ? 1 : 0), 0)

  const filtered = catalog.filter(c => {
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
    const { collection: updated, gained } = disenchantAllExtras(collection)
    saveCollection(updated)
    syncDeckToCollection(updated)
    setCollection(updated)
    const next = crystals + gained
    saveCrystals(next)
    onCrystalsChanged(next)
    notify(`+${gained} 💎`)
  }

  function handleMasterAll() {
    let updated = [...collection]
    let totalGained = 0
    for (const entry of collection) {
      const extras = Math.max(0, entry.count - COPIES_MAX)
      if (extras > 0) {
        updated = masterAllExtras(updated, entry.cardName)
        totalGained += extras
      }
    }
    saveCollection(updated)
    syncDeckToCollection(updated)
    setCollection(updated)
    notify(`+${totalGained} mastery XP across all cards!`)
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
    notify(lvlAfter > lvlBefore
      ? `${cardName} reached Mastery ${lvlAfter}!`
      : `+${extras} mastery XP for ${cardName}`)
  }

  return (
    <OverlayScreen title="COLLECTION" onBack={onBack} right={<span className="crystal-count">💎 {crystals.toLocaleString()}</span>}>

      {/* Action row */}
      <div className="collection-action-row">
        <button
          className="action-btn collection-disenchant-btn"
          onClick={handleDisenchantAll}
          disabled={totalExtras === 0}
        >
          🔮 Disenchant extras ({totalExtras})
        </button>
        <button
          className="action-btn collection-master-btn"
          onClick={handleMasterAll}
          disabled={totalUpgradeable === 0}
          title="Convert all extra copies into mastery XP"
        >
          ★ Upgrade all ({totalUpgradeable})
        </button>
        {flash && <span className="collection-flash">{flash}</span>}
      </div>

      {/* Filter trigger bar */}
      <div className="filter-bar">
        <div className="filter-popup-wrap" ref={filterMenuRef}>
          <button
            className={`filter-btn${activeFilterCount > 0 ? ' filter-btn--active' : ''}`}
            onClick={() => setFilterMenuOpen(o => !o)}
          >
            ▼ FILTERS{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>

          {filterMenuOpen && (
            <div className="filter-popup">
              {/* TYPE */}
              <div className="filter-popup-section">
                <span className="filter-group-label">TYPE</span>
                <div className="filter-popup-btns">
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
              <div className="filter-popup-section">
                <span className="filter-group-label">RARITY</span>
                <div className="filter-popup-btns">
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
              <div className="filter-popup-section">
                <span className="filter-group-label">TAGS <span className="filter-group-hint">(any match)</span></span>
                <div className="filter-popup-btns">
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
              <div className="filter-popup-section">
                <span className="filter-group-label">AFFINITY</span>
                <div className="filter-popup-btns">
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
              <div className="filter-popup-section">
                <span className="filter-group-label">SPECIAL</span>
                <div className="filter-popup-btns">
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

        {/* Active filter pills */}
        {activeFilterCount > 0 && (
          <div className="filter-active-pills">
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
      <div className="collection-grid">
        {filtered.map(card => {
          const owned  = getOwnedCount(collection, card.name)
          const extras = Math.max(0, owned - COPIES_MAX)
          const xp     = getMasteryXp(collection, card.name)
          const { level: lvl } = masteryProgress(xp)
          const disenchantVal  = DISENCHANT_VALUE[card.rarity] * extras

          return (
            <div key={card.name} className={`collection-cell${owned === 0 ? ' collection-cell--unowned' : ''}`}>
              <CardTile card={card} canAfford={true} onClick={() => openDetail(card)} />

              <div className="cell-footer">
                <span className="cell-count">
                  ×{owned}{lvl > 0 && <span className="cell-mastery-badge">★{lvl}</span>}
                </span>
                <div className="cell-footer-buttons">
                  <button
                    className={`extra-btn extra-btn--disenchant${extras === 0 ? ' extra-btn--disabled' : ''}`}
                    onClick={extras > 0 ? () => handleDisenchantCard(card.name) : undefined}
                    disabled={extras === 0}
                    title={extras > 0 ? `Sell extra copies for +${disenchantVal} 💎` : 'No extra copies to sell'}
                  >
                    Sell{extras > 0 ? ` +${disenchantVal}💎` : ''}
                  </button>
                  <button
                    className={`extra-btn extra-btn--master${extras === 0 ? ' extra-btn--disabled' : ''}`}
                    onClick={extras > 0 ? () => handleMasterCard(card.name) : undefined}
                    disabled={extras === 0}
                    title={extras > 0 ? `Convert ${extras} extra cop${extras === 1 ? 'y' : 'ies'} into mastery XP` : 'No extra copies to upgrade'}
                  >
                    Upgrade{extras > 0 ? ` +${extras}XP` : ''}
                  </button>
                </div>
              </div>

              {xp > 0 && <MasteryBar xp={xp} />}
            </div>
          )
        })}
      </div>

      {cardDetailNode}
    </OverlayScreen>
  )
}
