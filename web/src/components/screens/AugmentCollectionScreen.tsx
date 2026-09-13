import React, { useState } from 'react'
import { AugmentInstance, Card } from '../../game/types'
import {
  loadAugmentInstances,
  loadAugmentSouls,
  upgradeAugment,
  upgradeAugmentStack,
  equipAugmentSet,
  breakdownAugmentInstance,
  AUGMENT_UPGRADE_COST,
  AUGMENT_DISENCHANT_VALUE,
  loadCollection,
} from '../../game/collection'
import {
  getAugmentCard,
  augmentSlotLabel,
  scaledAugmentEffect,
  ALL_AUGMENT_SLOTS,
  getAugmentSetDef,
} from '../../game/augments'
import { OverlayScreen } from '../ui/OverlayScreen'
import { CardDetailModal } from '../cards/CardDetailModal'
import { CardAugmentScreen } from '../cards/CardAugmentScreen'
import { getCardCatalog } from '../../game/cards'
import { AugStack } from './collection/AugmentStackTile'
import { AugmentFilterBar, AugFilterMenu, AugGroupKey, AugSortKey } from './collection/AugmentFilterBar'
import { AugmentStacksSection } from './collection/AugmentStacksSection'
import { AugmentDrillDownHeader } from './collection/AugmentDrillDownHeader'
import { AugmentDrillDownUpgradeBar } from './collection/AugmentDrillDownUpgradeBar'
import { AugmentItemGrid, AugmentGridItem } from './collection/AugmentItemGrid'
import { AugmentUnitPickerModal } from './collection/AugmentUnitPickerModal'

const RARITY_ORDER: Record<string, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5,
  shiny: 4, holofoil: 4, glass: 4,
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

interface Props {
  onBack: () => void
  embedded?: boolean
}

export function AugmentCollectionScreen({ onBack, embedded }: Props) {
  const [refresh,       setRefresh]       = useState(0)
  const [sortKey,       setSortKey]       = useState<AugSortKey>('default')
  const [groupKey,      setGroupKey]      = useState<AugGroupKey>('none')
  const [openMenu,      setOpenMenu]      = useState<AugFilterMenu>(null)
  const [detailInst,    setDetailInst]    = useState<{ card: Card; inst: AugmentInstance } | null>(null)
  const [upgradeError,  setUpgradeError]  = useState<string | null>(null)
  const [breakdownMsg,  setBreakdownMsg]  = useState<string | null>(null)
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

  function handleBreakdown(inst: AugmentInstance) {
    const gained = breakdownAugmentInstance(inst.instanceId)
    setBreakdownMsg(`+${gained} 👻 souls`)
    setTimeout(() => setBreakdownMsg(null), 2500)
    forceRefresh()
    if (detailInst?.inst.instanceId === inst.instanceId) setDetailInst(null)
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

  const gridItems: AugmentGridItem[] = groups.flatMap(group =>
    group.items.map((item, i) => ({
      inst: item.inst,
      displayCard: item.displayCard,
      groupLabel: i === 0 && group.label ? group.label : null,
      breakdownValue: AUGMENT_DISENCHANT_VALUE[item.displayCard.rarity],
    }))
  )

  const inner = (
    <>
      {activeStack ? (
        <AugmentDrillDownHeader
          stack={activeStack}
          onBack={() => setActiveStack(null)}
          onEquipToUnit={() => setEquipTarget(activeStack)}
        />
      ) : (
        <AugmentFilterBar
          sortKey={sortKey}
          groupKey={groupKey}
          openMenu={openMenu}
          onOpenMenuChange={setOpenMenu}
          onSortChange={key => { setSortKey(key); setOpenMenu(null) }}
          onGroupChange={key => { setGroupKey(key); setOpenMenu(null) }}
        />
      )}

      {upgradeError && (
        <div className="aug-status-msg aug-status-msg--error">{upgradeError}</div>
      )}

      {breakdownMsg && (
        <div className="aug-status-msg aug-status-msg--souls">{breakdownMsg}</div>
      )}

      {instances.length === 0 ? (
        <div className="aug-empty-state">
          No augments owned yet. Earn augments from packs to equip them to your units.
        </div>
      ) : (
        <div className="u-col u-gap-4 u-grow">

          {!activeStack && (
            <AugmentStacksSection
              stacks={stacks}
              souls={souls}
              upgradeCost={AUGMENT_UPGRADE_COST}
              stackErrors={stackErrors}
              onView={setActiveStack}
              onUpgrade={handleUpgradeStack}
              onEquipToUnit={setEquipTarget}
            />
          )}

          {activeStack && (
            <AugmentDrillDownUpgradeBar
              stack={activeStack}
              souls={souls}
              upgradeCost={AUGMENT_UPGRADE_COST}
              onUpgrade={() => handleUpgradeStack(activeStack)}
            />
          )}

          {(!activeStack && individuals.length > 0) || activeStack ? (
            <>
              {!activeStack && individuals.length > 0 && stacks.length > 0 && (
                <div className="collection-group-header">Individual Augments ({individuals.length})</div>
              )}
              <AugmentItemGrid
                items={gridItems}
                souls={souls}
                upgradeCost={AUGMENT_UPGRADE_COST}
                onSelect={({ inst, displayCard }) => setDetailInst({ card: displayCard, inst })}
                onViewEquippedUnit={setDetailCardName}
                onUpgrade={handleUpgrade}
                onBreakdown={handleBreakdown}
              />
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
          breakdownValue={AUGMENT_DISENCHANT_VALUE[detailInst.card.rarity]}
          onBreakdown={() => handleBreakdown(detailInst.inst)}
          onClose={() => setDetailInst(null)}
        />
      )}

      {/* Unit picker for equipping a complete set */}
      {equipTarget && (
        <AugmentUnitPickerModal
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
      right={<span className="aug-souls-count">{souls.toLocaleString()} 👻 souls</span>}
    >
      {inner}
    </OverlayScreen>
  )
}
