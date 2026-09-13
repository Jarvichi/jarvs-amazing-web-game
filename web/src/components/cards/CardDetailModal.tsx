import React, { useMemo, useState } from 'react'
import { AugmentEffect, AugmentInstance, AugmentSlot, Card } from '../../game/types'
import {
  CollectionEntry,
  DeckEntry,
  getOwnedCount,
  getMasteryXp,
  masteryProgress,
  getCardStats,
  AUGMENT_UPGRADE_COST,
  loadAugmentSouls,
  getSetBonus,
  getEquippedAugments,
  upgradeAugment,
  mergeAugmentEffects,
} from '../../game/collection'
import { getAugmentCard, scaledAugmentEffect } from '../../game/augments'
import { getComboLinks, getSynergyGroups } from '../../game/synergies'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { AugmentPickerModal } from './AugmentPickerModal'
import { RARITY_COLOR } from '../../theme'
import { CardDetailHeader } from './carddetail/CardDetailHeader'
import { CardArtPanel } from './carddetail/CardArtPanel'
import { CardStatsBlock } from './carddetail/CardStatsBlock'
import { CardDetailTabBar } from './carddetail/CardDetailTabBar'
import { CardDetailsTab } from './carddetail/CardDetailsTab'
import { CardAugmentsTab } from './carddetail/CardAugmentsTab'
import { CardDetailActions } from './carddetail/CardDetailActions'
import { masteryStatBonuses } from './carddetail/AugStatRow'

interface Props {
  card: Card
  collection: CollectionEntry[]
  deckEntries?: DeckEntry[]
  onClose: () => void
  extras?: number
  disenchantValue?: number
  onDisenchant?: () => void
  onMasterCard?: () => void
  commanderName?: string | null
  promotionsLeft?: number
  onPromote?: () => void
  // Augment-instance specific (optional)
  augmentLevel?: number
  augmentEquippedTo?: string | null
  canUpgrade?: boolean
  onUpgrade?: () => void
  breakdownValue?: number
  onBreakdown?: () => void
}

export function CardDetailModal({
  card, collection, deckEntries, onClose, extras = 0, disenchantValue = 0, onDisenchant, onMasterCard,
  commanderName, promotionsLeft = 0, onPromote,
  augmentLevel, augmentEquippedTo, canUpgrade, onUpgrade, breakdownValue = 0, onBreakdown,
}: Props) {
  const owned  = getOwnedCount(collection, card.name)
  const inDeck = deckEntries?.find(e => e.cardName === card.name)?.count ?? 0
  const xp     = getMasteryXp(collection, card.name)

  const { level: masteryLvl } = masteryProgress(xp)
  const rarityCol = RARITY_COLOR[card.rarity]

  const [activeTab, setActiveTab] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const [pickerSlot, setPickerSlot] = useState<AugmentSlot | null>(null)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const toggleRow = (key: string) => setExpandedRow(prev => prev === key ? null : key)

  const forceRefresh = () => setRefresh(r => r + 1)

  const synergyGroups = getSynergyGroups(card)
  const comboLinks    = getComboLinks(card)

  // Stats — card name for "played", unit name for "died"
  const statsPlayed = getCardStats(card.name)
  const statsUnit   = card.unit ? getCardStats(card.unit.name) : null

  const equippedMap = getEquippedAugments(card.name)
  const setBonus    = getSetBonus(card.name)
  const souls       = loadAugmentSouls()

  const u = card.unit

  // Mastery stat bonuses. These were computed here and then never rendered —
  // the modal showed base + augments only, so a mastered card understated its
  // real power. Now shared with CardAugmentScreen so both agree.
  const { atk: atkBonus, hp: hpBonus } = masteryStatBonuses(u, masteryLvl)

  // Build trait tags
  const traits: string[] = []
  if (u) {
    if (u.moveSpeed === 0)   traits.push('structure')
    if (u.isWall)            traits.push('wall')
    if (u.flying)            traits.push('flying')
    if (u.climber)           traits.push('climber')
    if (u.bypassWall && u.moveSpeed > 0) traits.push('ranged')
    // Append combat tags that aren't already represented
    for (const t of (u.tags ?? [])) {
      if (!traits.includes(t)) traits.push(t)
    }
  }

  // Compute total augment effect for live stat display
  const totalAugmentEffect = useMemo(() => {
    let effect: AugmentEffect = {}
    for (const inst of Object.values(equippedMap)) {
      const augCard = getAugmentCard(inst.cardId)
      if (!augCard?.augmentEffect) continue
      const scaled = scaledAugmentEffect(augCard.augmentEffect, inst.level)
      effect = mergeAugmentEffects(effect, scaled)
    }
    if (setBonus) effect = mergeAugmentEffects(effect, setBonus.effect)
    return effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh])

  // Whether any stat is actually boosted — the breakdown toggle is pointless
  // otherwise. Structures never take augments (see applyAugmentBonuses), so
  // only their mastery HP counts.
  const hasStatBonus = u
    ? u.moveSpeed > 0
      ? atkBonus !== 0 || hpBonus !== 0 ||
        [totalAugmentEffect.attack, totalAugmentEffect.maxHp,
         totalAugmentEffect.moveSpeed, totalAugmentEffect.attackRange]
          .some(v => v != null && v !== 0)
      : hpBonus !== 0
    : false

  function handleUpgrade(inst: AugmentInstance) {
    const err = upgradeAugment(inst.instanceId)
    if (err) {
      setUpgradeError(err)
      setTimeout(() => setUpgradeError(null), 2500)
    }
    forceRefresh()
  }

  return (
    <ModalBackdrop onClose={onClose} title={card.name}>
      <div className="cdm-panel">
        <CardDetailHeader card={card} collection={collection} colour={rarityCol} onClose={onClose} />

        <div className="cdm-body u-flex u-gap-6">
          <CardArtPanel card={card} owned={owned} inDeck={inDeck} />

          <div className="cdm-info-col u-grow u-col u-gap-4">
            <div className="cdm-desc">{card.description}</div>
            {card.lore && <div className="cdm-lore">{card.lore}</div>}

            <CardStatsBlock
              unit={u}
              atkBonus={atkBonus}
              hpBonus={hpBonus}
              augmentEffect={totalAugmentEffect}
              hasStatBonus={hasStatBonus}
              showBreakdown={showBreakdown}
              onToggleBreakdown={() => setShowBreakdown(v => !v)}
            />
          </div>
        </div>

        <div className="cdm-details u-col">
          {card.cardType === 'unit' && (
            <CardDetailTabBar
              cardName={card.name}
              unit={u}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              commanderName={commanderName}
              promotionsLeft={promotionsLeft}
              onPromote={onPromote}
            />
          )}

          <div className="cdm-info-col u-grow u-col u-gap-4 u-mg-t-md">
            {activeTab === 0 ? (
              <CardDetailsTab
                card={card}
                traits={traits}
                synergyGroups={synergyGroups}
                comboLinks={comboLinks}
                expandedRow={expandedRow}
                onToggleRow={toggleRow}
                masteryLvl={masteryLvl}
                xp={xp}
                augmentLevel={augmentLevel}
                augmentEquippedTo={augmentEquippedTo}
                timesPlayed={statsPlayed.played}
                unitsLost={statsUnit?.died}
              />
            ) : (
              <CardAugmentsTab
                souls={souls}
                upgradeError={upgradeError}
                upgradeCost={AUGMENT_UPGRADE_COST}
                equippedMap={equippedMap}
                setBonus={setBonus}
                onUpgrade={handleUpgrade}
                onPickSlot={setPickerSlot}
              />
            )}
          </div>
        </div>

        {pickerSlot && (
          <AugmentPickerModal
            slot={pickerSlot}
            cardName={card.name}
            onClose={() => { setPickerSlot(null); forceRefresh() }}
          />
        )}

        {/* Lore is rendered once, up next to the description — it used to also
            repeat verbatim here at the foot of the modal. */}

        <CardDetailActions
          augmentUpgradeCost={AUGMENT_UPGRADE_COST}
          canUpgrade={canUpgrade}
          onUpgrade={onUpgrade}
          breakdownValue={breakdownValue}
          onBreakdown={onBreakdown}
          extras={extras}
          disenchantValue={disenchantValue}
          onDisenchant={onDisenchant}
          onMasterCard={onMasterCard}
        />
      </div>
    </ModalBackdrop>
  )
}
