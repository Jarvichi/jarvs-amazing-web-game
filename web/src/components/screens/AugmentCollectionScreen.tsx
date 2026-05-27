import React, { memo, useRef, useState, useEffect } from 'react'
import { AugmentInstance, Card } from '../../game/types'
import {
  loadAugmentInstances,
  loadAugmentSouls,
  upgradeAugment,
  upgradeAugmentStack,
  equipAugmentSet,
  AUGMENT_UPGRADE_COST,
  loadCollection,
} from '../../game/collection'
import {
  getAugmentCard,
  augmentSlotLabel,
  scaledAugmentEffect,
  ALL_AUGMENT_SLOTS,
  getAugmentSetDef,
  AugmentSetDef,
} from '../../game/augments'
import { OverlayScreen } from '../ui/OverlayScreen'
import { CardTile } from '../cards/CardTile'
import { CardDetailModal } from '../cards/CardDetailModal'
import { CardAugmentScreen } from '../cards/CardAugmentScreen'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { getCardCatalog } from '../../game/cards'
import { Button } from '../ui/Button'

// ─── Lazy cell ────────────────────────────────────────────

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

// ─── Sort / group types ───────────────────────────────────

type AugSortKey  = 'default' | 'az' | 'za' | 'rarity' | 'level-desc' | 'level-asc' | 'slot'
type AugGroupKey = 'none' | 'slot' | 'set' | 'rarity' | 'status'

const RARITY_ORDER: Record<string, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5,
  shiny: 4, holofoil: 4, glass: 4,
}

const RARITY_COLOUR: Record<string, string> = {
  common:    '#55cc55',
  uncommon:  '#4499ff',
  rare:      '#bb66ff',
  epic:      '#ff8800',
  legendary: '#ffcc00',
  mythic:    '#e040fb',
}

// ─── Stack type and computation ───────────────────────────

interface AugStack {
  setName: string
  setDef: AugmentSetDef | undefined
  instances: AugmentInstance[]   // exactly 7, one per slot
}

function computeStacks(instances: AugmentInstance[]): { stacks: AugStack[]; individuals: AugmentInstance[] } {
  const stacks: AugStack[] = []
  const individuals: AugmentInstance[] = []

  const bySet = new Map<string, AugmentInstance[]>()
  for (const inst of instances) {
    const card = getAugmentCard(inst.cardId)
    const setName = card?.setName
    if (!setName) { individuals.push(inst); continue }
    if (!bySet.has(setName)) bySet.set(setName, [])
    bySet.get(setName)!.push(inst)
  }

  for (const [setName, setInsts] of bySet) {
    const bySlot = new Map<string, AugmentInstance[]>()
    for (const inst of setInsts) {
      const card = getAugmentCard(inst.cardId)
      if (!card?.augmentSlot) { individuals.push(inst); continue }
      if (!bySlot.has(card.augmentSlot)) bySlot.set(card.augmentSlot, [])
      bySlot.get(card.augmentSlot)!.push(inst)
    }

    const allPresent = ALL_AUGMENT_SLOTS.every(s => (bySlot.get(s)?.length ?? 0) > 0)
    if (!allPresent) {
      for (const inst of setInsts) individuals.push(inst)
      continue
    }

    const queues = new Map(ALL_AUGMENT_SLOTS.map(s => [s, [...(bySlot.get(s) ?? [])]]))

    while (ALL_AUGMENT_SLOTS.every(s => (queues.get(s)?.length ?? 0) > 0)) {
      const stackInsts: AugmentInstance[] = []
      for (const slot of ALL_AUGMENT_SLOTS) stackInsts.push(queues.get(slot)!.shift()!)
      stacks.push({ setName, setDef: getAugmentSetDef(setName), instances: stackInsts })
    }

    for (const slot of ALL_AUGMENT_SLOTS) {
      for (const inst of queues.get(slot) ?? []) individuals.push(inst)
    }
  }

  return { stacks, individuals }
}

function stackLevelSummary(stack: AugStack): string {
  const levels = stack.instances.map(i => i.level)
  const min = Math.min(...levels)
  const max = Math.max(...levels)
  return min === max ? `Lv${min}` : `Lv${min}–${max}`
}

function stackUpgradeCost(stack: AugStack): number {
  const minLevel = Math.min(...stack.instances.map(i => i.level))
  const count = stack.instances.filter(i => i.level === minLevel).length
  return count * AUGMENT_UPGRADE_COST
}

// ─── Unit Picker Modal ────────────────────────────────────

interface UnitPickerProps {
  stack: AugStack
  onEquip: (cardName: string) => void
  onClose: () => void
}

function UnitPickerModal({ stack, onEquip, onClose }: UnitPickerProps) {
  const collection = loadCollection()
  const catalog    = getCardCatalog()
  const unitCards  = catalog.filter(c =>
    c.cardType === 'unit' && c.unit && c.unit.moveSpeed > 0 &&
    collection.some(e => e.cardName === c.name && e.count > 0)
  )

  return (
    <ModalBackdrop onClose={onClose} zIndex={400}>
      <div className="apm-panel">
        <div className="apm-header">
          Equip {stack.setName} Set to Unit
          <button className="cdm-close" onClick={onClose}>✕</button>
        </div>
        {unitCards.length === 0 ? (
          <div className="apm-empty">No unit cards owned.</div>
        ) : (
          <div className="apm-list">
            {unitCards.map(card => (
              <div key={card.name} className="apm-item">
                <div className="apm-item-info">
                  <span className="apm-item-name">{card.name}</span>
                  <span className="apm-item-set" style={{ opacity: 0.6, fontSize: 11 }}>
                    {card.rarity.toUpperCase()}
                  </span>
                </div>
                <div className="apm-item-actions">
                  <Button
                    className="action-btn action-btn--gold"
                    onClick={() => { onEquip(card.name); onClose() }}
                  >
                    Equip Set
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalBackdrop>
  )
}

// ─── Stack Tile ───────────────────────────────────────────

interface StackTileProps {
  stack: AugStack
  souls: number
  onView: () => void
  onUpgrade: () => void
  onEquipToUnit: () => void
  upgradeError?: string | null
}

function StackTile({ stack, souls, onView, onUpgrade, onEquipToUnit, upgradeError }: StackTileProps) {
  const cost      = stackUpgradeCost(stack)
  const canUpgrade = souls >= cost
  const col       = RARITY_COLOUR[stack.setDef?.rarity ?? 'common'] ?? '#55cc55'
  const levels    = stack.instances.map(i => i.level)
  const minLevel  = Math.min(...levels)
  const atMin     = levels.filter(l => l === minLevel).length
  const areAnyEquipped = stack.instances.some(i => i.equippedToCardName)
  const equippedCount = stack.instances.filter(i => i.equippedToCardName).length

  return (
    <div className="aug-stack-tile">
      <div className="aug-stack-header">
        <span className="aug-stack-name" style={{ color: col }}>{stack.setName} Set</span>
        <span className="aug-stack-levels">{stackLevelSummary(stack)}</span>
      </div>
      <div className="aug-stack-slots">
        {stack.instances.map(inst => {
          const card = getAugmentCard(inst.cardId)
          return (
            <span key={inst.instanceId} className="aug-stack-slot-chip" style={{ color: col }}>
              {augmentSlotLabel(card?.augmentSlot ?? 'helmet').slice(0, 4)} Lv{inst.level}
            </span>
          )
        })}
      </div>
      {atMin < 7 && (
        <div className="aug-stack-upgrade-note">
          {atMin} item{atMin !== 1 ? 's' : ''} at Lv{minLevel} · next upgrade: {cost.toLocaleString()} souls
        </div>
      )}
      {upgradeError && <div style={{ color: '#ff6666', fontSize: 11 }}>{upgradeError}</div>}
      <div className="aug-stack-actions">
        <Button size="sm" onClick={onView}>
          View Stack
        </Button>
        <Button
          className={`action-btn action-btn--gold${canUpgrade ? '' : ' action-btn--disabled'}`}
          onClick={onUpgrade}
          title={`Upgrade stack · ${cost.toLocaleString()} souls`}
          style={{ fontSize: 11, padding: '2px 8px' }}
        >
          ↑ Upgrade · {cost.toLocaleString()}
        </Button>
        <Button
          className={`action-btn ${areAnyEquipped ?  ' action-btn--disabled' : ''}`}
          size="sm"
          onClick={onEquipToUnit}
          disabled={areAnyEquipped}
          title={areAnyEquipped ? 'Unequip all items in stack to enable' : 'Equip stack to unit'}
        >
          {areAnyEquipped ? `${equippedCount} already equipped` : 'Equip stack to unit'}
        </Button>
      </div>
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────

interface Props {
  onBack: () => void
  embedded?: boolean
}

export function AugmentCollectionScreen({ onBack, embedded }: Props) {
  const [refresh,       setRefresh]       = useState(0)
  const [sortKey,       setSortKey]       = useState<AugSortKey>('default')
  const [groupKey,      setGroupKey]      = useState<AugGroupKey>('none')
  const [sortOpen,      setSortOpen]      = useState(false)
  const [groupOpen,     setGroupOpen]     = useState(false)
  const [detailInst,    setDetailInst]    = useState<{ card: Card; inst: AugmentInstance } | null>(null)
  const [upgradeError,  setUpgradeError]  = useState<string | null>(null)
  const [stackErrors,   setStackErrors]   = useState<Record<string, string | null>>({})
  const [detailCardName, setDetailCardName] = useState<string | null>(null)
  const [activeStack,   setActiveStack]   = useState<AugStack | null>(null)
  const [equipTarget,   setEquipTarget]   = useState<AugStack | null>(null)

  const forceRefresh = () => setRefresh(r => r + 1)

  const instances  = loadAugmentInstances()
  const souls      = loadAugmentSouls()
  const collection = loadCollection()
  const catalog    = getCardCatalog()

  const { stacks, individuals } = computeStacks(instances)

  function handleUpgrade(inst: AugmentInstance) {
    const err = upgradeAugment(inst.instanceId)
    if (err) {
      setUpgradeError(err)
      setTimeout(() => setUpgradeError(null), 2500)
    }
    forceRefresh()
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

  function handleUpgradeStack(stack: AugStack) {
    const key = stack.instances[0].instanceId
    const err = upgradeAugmentStack(stack.instances.map(i => i.instanceId))
    if (err) {
      setStackErrors(prev => ({ ...prev, [key]: err }))
      setTimeout(() => setStackErrors(prev => ({ ...prev, [key]: null })), 2500)
    }
    forceRefresh()
    // keep activeStack in sync if we're in drill-down
    if (activeStack) {
      const updated = loadAugmentInstances()
      const refreshed = activeStack.instances.map(old => updated.find(i => i.instanceId === old.instanceId) ?? old)
      setActiveStack({ ...activeStack, instances: refreshed })
    }
  }

  function handleEquipSet(stack: AugStack, cardName: string) {
    equipAugmentSet(stack.instances.map(i => i.instanceId), cardName)
    forceRefresh()
  }

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

  // ─── Build display items for individual grid ──────────

  type DisplayItem = { inst: AugmentInstance; card: Card; displayCard: Card }

  const sourceInstances = activeStack ? activeStack.instances : individuals

  const items: DisplayItem[] = sourceInstances.flatMap(inst => {
    const augCard = getAugmentCard(inst.cardId)
    if (!augCard) return []
    const displayCard = { ...augCard, augmentEffect: scaledAugmentEffect(augCard.augmentEffect ?? {}, inst.level) }
    return [{ inst, card: augCard, displayCard }]
  })

  // ─── Sort (only applies to individuals list, not stack drill-down) ───

  const sorted = activeStack ? items : [...items].sort((a, b) => {
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

  // ─── Group (only for individuals) ─────────────────────

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
  if (groupKey === 'none' || activeStack) {
    groups.push({ label: '', items: sorted })
  } else {
    for (const item of sorted) {
      const label = groupLabel(item)
      const existing = groups.find(g => g.label === label)
      if (existing) existing.items.push(item)
      else groups.push({ label, items: [item] })
    }
  }

  const instanceCounts: Record<string, number> = {}
  for (const inst of instances) {
    instanceCounts[inst.cardId] = (instanceCounts[inst.cardId] ?? 0) + 1
  }

  const inner = (
    <>
      {/* Drill-down header */}
      {activeStack ? (
        <div className="aug-stack-drill-header">
          <button className="filter-btn" onClick={() => setActiveStack(null)}>← Back to All</button>
          <span className="aug-stack-drill-title">
            {activeStack.setName} Set
          </span>
          <button
            className="action-btn"
            onClick={() => setEquipTarget(activeStack)}
            style={{ fontSize: 11, padding: '2px 8px' }}
          >
            Equip to Unit
          </button>
        </div>
      ) : (
        /* Filter bar — only shown when not in drill-down */
        <div className="filter-bar">
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
      )}

      {upgradeError && (
        <div style={{ color: '#ff6666', textAlign: 'center', fontSize: 12, padding: '4px 0' }}>{upgradeError}</div>
      )}

      {instances.length === 0 ? (
        <div style={{ textAlign: 'center', opacity: 0.6, marginTop: 48 }}>
          No augments owned yet. Earn augments from packs to equip them to your units.
        </div>
      ) : (
        <div className="u-col u-gap-4 u-grow">

          {/* Complete set stacks — only shown when not in drill-down */}
          {!activeStack && stacks.length > 0 && (
            <div className="aug-stacks-section">
              <div className="collection-group-header">Complete Sets ({stacks.length})</div>
              {stacks.map((stack, i) => (
                <StackTile
                  key={`${stack.setName}-${i}`}
                  stack={stack}
                  souls={souls}
                  onView={() => setActiveStack(stack)}
                  onUpgrade={() => handleUpgradeStack(stack)}
                  onEquipToUnit={() => setEquipTarget(stack)}
                  upgradeError={stackErrors[stack.instances[0].instanceId]}
                />
              ))}
            </div>
          )}

          {/* Drill-down upgrade bar */}
          {activeStack && (
            <div className="aug-stack-drill-upgrade">
              <span style={{ fontSize: 12, opacity: 0.8 }}>
                Stack: {stackLevelSummary(activeStack)}
              </span>
              <button
                className={`action-btn action-btn--gold${souls >= stackUpgradeCost(activeStack) ? '' : ' action-btn--disabled'}`}
                onClick={() => handleUpgradeStack(activeStack)}
                style={{ fontSize: 11, padding: '2px 8px' }}
              >
                ↑ Upgrade Stack · {stackUpgradeCost(activeStack).toLocaleString()} souls
              </button>
            </div>
          )}

          {/* Individuals / drill-down items grid */}
          {(!activeStack && individuals.length > 0) || activeStack ? (
            <>
              {!activeStack && individuals.length > 0 && stacks.length > 0 && (
                <div className="collection-group-header">Individual Augments ({individuals.length})</div>
              )}
              <div className="collection-grid u-flex u-wrap u-just-c u-gap-4">
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
                            className={`action-btn action-btn--gold${souls < AUGMENT_UPGRADE_COST ? ' action-btn--disabled' : ''}`}
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
            </>
          ) : null}
        </div>
      )}

      {/* Detail modal */}
      {detailInst && (
        <CardDetailModal
          card={detailInst.card}
          collection={[{ cardName: detailInst.inst.cardId, count: instanceCounts[detailInst.inst.cardId] ?? 1 }]}
          augmentLevel={detailInst.inst.level}
          augmentEquippedTo={detailInst.inst.equippedToCardName}
          canUpgrade={souls >= AUGMENT_UPGRADE_COST}
          onUpgrade={() => handleUpgrade(detailInst.inst)}
          onClose={() => setDetailInst(null)}
        />
      )}

      {/* Unit picker for equipping a complete set */}
      {equipTarget && (
        <UnitPickerModal
          stack={equipTarget}
          onEquip={cardName => handleEquipSet(equipTarget, cardName)}
          onClose={() => setEquipTarget(null)}
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
