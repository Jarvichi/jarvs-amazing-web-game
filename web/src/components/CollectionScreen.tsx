import React, { useState } from 'react'
import { Card, CardRarity, CardType } from '../game/types'
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
import { CardDetailModal } from './CardDetailModal'

interface Props {
  crystals: number
  onCrystalsChanged: (n: number) => void
  onBack: () => void
}

type RarityFilter = 'all' | CardRarity
type TypeFilter   = 'all' | CardType
type SpecialFilter = 'upgradeable'

function MasteryBar({ xp }: { xp: number }) {
  const { level, current, needed } = masteryProgress(xp)
  const pct = needed > 0 ? Math.round((current / needed) * 100) : 100
  return (
    <div className="mastery-bar-wrap">
      <span className="mastery-level">★{level}</span>
      <div className="mastery-bar-track">
        <div className="mastery-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="mastery-xp">{current}/{needed}</span>
    </div>
  )
}

export function CollectionScreen({ crystals, onCrystalsChanged, onBack }: Props) {
  const catalog = getCardCatalog()
  const [collection, setCollection] = useState<CollectionEntry[]>(loadCollection)
  const [typeFilter,    setTypeFilter]    = useState<TypeFilter>('all')
  const [rarityFilter,  setRarityFilter]  = useState<RarityFilter>('all')
  const [specialFilter, setSpecialFilter] = useState<SpecialFilter | null>(null)
  const [flash, setFlash]       = useState<string | null>(null)
  const [detailCard, setDetailCard] = useState<Card | null>(null)

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
    return true
  })

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

  function toggleSpecial() {
    setSpecialFilter(prev => prev === 'upgradeable' ? null : 'upgradeable')
  }

  return (
    <div className="overlay-screen">
      {/* Header */}
      <div className="overlay-header">
        <button className="action-btn" onClick={onBack}>← BACK</button>
        <span className="overlay-title">COLLECTION</span>
        <span className="crystal-count">💎 {crystals.toLocaleString()}</span>
      </div>

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

      {/* Filters */}
      <div className="filter-bar">
        <span className="filter-group-label">TYPE:</span>
        {([
          ['all',       'All'],
          ['unit',      'Units'],
          ['structure', 'Structures'],
          ['upgrade',   'Upgrades'],
        ] as const).map(([val, label]) => (
          <button
            key={val}
            className={`filter-btn${typeFilter === val ? ' filter-btn--active' : ''}`}
            onClick={() => setTypeFilter(val as TypeFilter)}
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
            className={`filter-btn${rarityFilter === val ? ' filter-btn--active' : ''}`}
            onClick={() => setRarityFilter(val as RarityFilter)}
          >
            {label}
          </button>
        ))}
        <span className="filter-sep">|</span>
        <button
          className={`filter-btn${specialFilter === 'upgradeable' ? ' filter-btn--active' : ''}`}
          onClick={toggleSpecial}
          title="Show only cards with extra copies that can be mastered"
          style={specialFilter === 'upgradeable' ? { borderColor: '#ffd700', color: '#ffd700' } : {}}
        >
          ★ Upgradeable
        </button>
        <span className="filter-owned">{totalOwned} cards</span>
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
              <CardTile card={card} canAfford={true} onClick={() => setDetailCard(card)} />

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

      {detailCard && (
        <CardDetailModal
          card={detailCard}
          collection={collection}
          onClose={() => setDetailCard(null)}
        />
      )}
    </div>
  )
}
