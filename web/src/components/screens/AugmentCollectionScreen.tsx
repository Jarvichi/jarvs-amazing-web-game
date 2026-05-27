import React, { memo, useRef, useState, useEffect } from 'react'
import { AugmentInstance, Card } from '../../game/types'
import {
  loadAugmentInstances,
  loadAugmentSouls,
  upgradeAugment,
  AUGMENT_UPGRADE_COST,
} from '../../game/collection'
import {
  getAugmentCard,
  augmentSlotLabel,
  scaledAugmentEffect,
  ALL_AUGMENT_SLOTS,
} from '../../game/augments'
import { OverlayScreen } from '../ui/OverlayScreen'
import { CardTile } from '../cards/CardTile'
import { CardDetailModal } from '../cards/CardDetailModal'
import { CardAugmentScreen } from '../cards/CardAugmentScreen'
import { getCardCatalog } from '../../game/cards'
import { loadCollection } from '../../game/collection'

// ─── Lazy cell (same pattern as CollectionScreen) ──────────

const LazyCell = memo(function LazyCell({ children, className }: { children: React.ReactNode; className: string }) {
  const ref  = useRef<HTMLDivElement>(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect() } }, { rootMargin: '200px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return <div ref={ref} className={className}>{vis ? children : null}</div>
})

// ─── Sort / group types ────────────────────────────────────

type AugSortKey  = 'default' | 'az' | 'za' | 'rarity' | 'level-desc' | 'level-asc' | 'slot'
type AugGroupKey = 'none' | 'slot' | 'set' | 'rarity' | 'status'

const RARITY_ORDER: Record<string, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5,
  shiny: 4, holofoil: 4, glass: 4,
}

interface Props {
  onBack: () => void
  embedded?: boolean
}

export function AugmentCollectionScreen({ onBack, embedded }: Props) {
  const [refresh,    setRefresh]    = useState(0)
  const [sortKey,    setSortKey]    = useState<AugSortKey>('default')
  const [groupKey,   setGroupKey]   = useState<AugGroupKey>('none')
  const [sortOpen,   setSortOpen]   = useState(false)
  const [groupOpen,  setGroupOpen]  = useState(false)
  const [detailInst, setDetailInst] = useState<{ card: Card; inst: AugmentInstance } | null>(null)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const [detailCardName, setDetailCardName] = useState<string | null>(null)

  const forceRefresh = () => setRefresh(r => r + 1)

  const instances  = loadAugmentInstances()
  const souls      = loadAugmentSouls()
  const collection = loadCollection()
  const catalog    = getCardCatalog()

  function handleUpgrade(inst: AugmentInstance) {
    const err = upgradeAugment(inst.instanceId)
    if (err) {
      setUpgradeError(err)
      setTimeout(() => setUpgradeError(null), 2500)
    }
    forceRefresh()
    // refresh detail modal to show updated level
    if (detailInst?.inst.instanceId === inst.instanceId) {
      const updated = loadAugmentInstances().find(i => i.instanceId === inst.instanceId)
      if (updated) {
        const augCard = getAugmentCard(updated.cardId)
        if (augCard) {
          const displayCard = { ...augCard, augmentEffect: scaledAugmentEffect(augCard.augmentEffect ?? {}, updated.level) }
          setDetailInst({ card: displayCard, inst: updated })
        }
      }
    }
  }

  // Navigate to unit card's augment screen
  if (detailCardName) {
    const card = catalog.find(c => c.name === detailCardName)
    if (card) {
      return (
        <CardAugmentScreen
          card={card}
          collection={collection}
          onClose={() => setDetailCardName(null)}
        />
      )
    }
  }

  // ─── Build display items ───────────────────────────────

  type DisplayItem = { inst: AugmentInstance; card: Card; displayCard: Card }

  const items: DisplayItem[] = instances.flatMap(inst => {
    const augCard = getAugmentCard(inst.cardId)
    if (!augCard) return []
    const displayCard = { ...augCard, augmentEffect: scaledAugmentEffect(augCard.augmentEffect ?? {}, inst.level) }
    return [{ inst, card: augCard, displayCard }]
  })

  // ─── Sort ─────────────────────────────────────────────

  const sorted = [...items].sort((a, b) => {
    switch (sortKey) {
      case 'az':         return a.card.name.localeCompare(b.card.name)
      case 'za':         return b.card.name.localeCompare(a.card.name)
      case 'rarity':     return (RARITY_ORDER[b.card.rarity] ?? 0) - (RARITY_ORDER[a.card.rarity] ?? 0)
      case 'level-desc': return b.inst.level - a.inst.level
      case 'level-asc':  return a.inst.level - b.inst.level
      case 'slot':       return ALL_AUGMENT_SLOTS.indexOf(a.card.augmentSlot!) - ALL_AUGMENT_SLOTS.indexOf(b.card.augmentSlot!)
      default:           return 0
    }
  })

  // ─── Group ────────────────────────────────────────────

  function groupLabel(item: DisplayItem): string {
    switch (groupKey) {
      case 'slot':   return augmentSlotLabel(item.card.augmentSlot!)
      case 'set':    return item.card.setName ?? 'Unknown Set'
      case 'rarity': return item.card.rarity.charAt(0).toUpperCase() + item.card.rarity.slice(1)
      case 'status': return item.inst.equippedToCardName ? 'Equipped' : 'Unequipped'
      default:       return ''
    }
  }

  const groups: { label: string; items: DisplayItem[] }[] = []
  if (groupKey === 'none') {
    groups.push({ label: '', items: sorted })
  } else {
    for (const item of sorted) {
      const label = groupLabel(item)
      const existing = groups.find(g => g.label === label)
      if (existing) existing.items.push(item)
      else groups.push({ label, items: [item] })
    }
  }

  // Count total instances per cardId for the modal "owned" display
  const instanceCounts: Record<string, number> = {}
  for (const inst of instances) {
    instanceCounts[inst.cardId] = (instanceCounts[inst.cardId] ?? 0) + 1
  }

  const currentSouls = loadAugmentSouls()

  const inner = (
    <>
      {/* Filter bar */}
      <div className="filter-bar">
        {/* SORT */}
        <div className="filter-popup-wrap">
          <button
            className={`filter-btn${sortKey !== 'default' ? ' filter-btn--active' : ''}`}
            onClick={() => { setSortOpen(o => !o); setGroupOpen(false) }}
          >
            SORT {sortOpen ? '▲' : '▼'}
          </button>
          {sortOpen && (
            <div className="filter-popup">
              {([
                ['default',    'Default'],
                ['az',         'A → Z'],
                ['za',         'Z → A'],
                ['rarity',     'Rarity'],
                ['level-desc', 'Level ↓'],
                ['level-asc',  'Level ↑'],
                ['slot',       'Slot'],
              ] as [AugSortKey, string][]).map(([key, label]) => (
                <button
                  key={key}
                  className={`filter-btn filter-btn--sm${sortKey === key ? ' filter-btn--active' : ''}`}
                  onClick={() => { setSortKey(key); setSortOpen(false) }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* GROUP */}
        <div className="filter-popup-wrap">
          <button
            className={`filter-btn${groupKey !== 'none' ? ' filter-btn--active' : ''}`}
            onClick={() => { setGroupOpen(o => !o); setSortOpen(false) }}
          >
            GROUP {groupOpen ? '▲' : '▼'}
          </button>
          {groupOpen && (
            <div className="filter-popup">
              {([
                ['none',   'None'],
                ['slot',   'Slot'],
                ['set',    'Set'],
                ['rarity', 'Rarity'],
                ['status', 'Equipped / Unequipped'],
              ] as [AugGroupKey, string][]).map(([key, label]) => (
                <button
                  key={key}
                  className={`filter-btn filter-btn--sm${groupKey === key ? ' filter-btn--active' : ''}`}
                  onClick={() => { setGroupKey(key); setGroupOpen(false) }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {upgradeError && (
        <div style={{ color: '#ff6666', textAlign: 'center', fontSize: 12, padding: '4px 0' }}>{upgradeError}</div>
      )}

      {instances.length === 0 ? (
        <div style={{ textAlign: 'center', opacity: 0.6, marginTop: 48 }}>
          No augments owned yet. Earn augments from packs to equip them to your units.
        </div>
      ) : (
        <div className="collection-grid u-flex u-wrap u-just-c u-gap-4 u-grow">
          {groups.map(group => (
            <React.Fragment key={group.label}>
              {group.label && (
                <div className="collection-group-header">{group.label}</div>
              )}
              {group.items.map(({ inst, displayCard }) => (
                <LazyCell key={inst.instanceId} className="collection-cell u-col">
                  <CardTile
                    card={displayCard}
                    onClick={() => setDetailInst({ card: displayCard, inst })}
                  />
                  <div className="cell-footer">
                    <span>Lv{inst.level}</span>
                    {inst.equippedToCardName && (
                      <span
                        title={inst.equippedToCardName}
                        style={{ cursor: 'pointer', color: '#88ccff' }}
                        onClick={e => { e.stopPropagation(); setDetailCardName(inst.equippedToCardName!) }}
                      >↗</span>
                    )}
                    <button
                      className={`action-btn action-btn--gold${currentSouls < AUGMENT_UPGRADE_COST ? ' action-btn--disabled' : ''}`}
                      onClick={e => { e.stopPropagation(); handleUpgrade(inst) }}
                      title={`Upgrade · ${AUGMENT_UPGRADE_COST} souls`}
                      style={{ padding: '1px 6px', fontSize: 11 }}
                    >↑</button>
                  </div>
                </LazyCell>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {detailInst && (
        <CardDetailModal
          card={detailInst.card}
          collection={[{ cardName: detailInst.inst.cardId, count: instanceCounts[detailInst.inst.cardId] ?? 1 }]}
          augmentLevel={detailInst.inst.level}
          augmentEquippedTo={detailInst.inst.equippedToCardName}
          canUpgrade={currentSouls >= AUGMENT_UPGRADE_COST}
          onUpgrade={() => handleUpgrade(detailInst.inst)}
          onClose={() => setDetailInst(null)}
        />
      )}
    </>
  )

  if (embedded) return inner
  return (
    <OverlayScreen
      title="AUGMENTS"
      onBack={onBack}
      right={<span style={{ color: '#cc88ff', fontWeight: 700 }}>{souls.toLocaleString()} 👻 souls</span>}
    >
      {inner}
    </OverlayScreen>
  )
}
