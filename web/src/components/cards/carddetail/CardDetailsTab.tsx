import React from 'react'
import { Card } from '../../../game/types'
import { ComboLink, SynergyGroup } from '../../../game/synergies'
import { CardSpawnRatePreview } from './CardSpawnRatePreview'
import { CardAugmentStatsBlock } from './CardAugmentStatsBlock'
import { CardTraitsRow } from './CardTraitsRow'
import { CardCombatProfile } from './CardCombatProfile'
import { CardSynergyPanel } from './CardSynergyPanel'
import { CardMasteryBlock } from './CardMasteryBlock'
import { CardBattleStatsBlock } from './CardBattleStatsBlock'

interface Props {
  card: Card
  traits: string[]
  synergyGroups: SynergyGroup[]
  comboLinks: ComboLink[]
  expandedRow: string | null
  onToggleRow: (key: string) => void
  masteryLvl: number
  xp: number
  augmentLevel?: number
  augmentEquippedTo?: string | null
  timesPlayed: number
  unitsLost?: number
}

/** The "Details" tab: everything about a card besides its live augment
 *  loadout (that's CardAugmentsTab). */
export function CardDetailsTab({
  card, traits, synergyGroups, comboLinks, expandedRow, onToggleRow,
  masteryLvl, xp, augmentLevel, augmentEquippedTo, timesPlayed, unitsLost,
}: Props) {
  const u = card.unit

  return (
    <>
      {u && <CardSpawnRatePreview unit={u} />}

      <CardAugmentStatsBlock card={card} augmentLevel={augmentLevel} augmentEquippedTo={augmentEquippedTo} />

      <CardTraitsRow traits={traits} />

      {u && (
        <CardCombatProfile unit={u} masteryLvl={masteryLvl} expandedRow={expandedRow} onToggleRow={onToggleRow} />
      )}

      <CardSynergyPanel
        synergyGroups={synergyGroups}
        comboLinks={comboLinks}
        expandedRow={expandedRow}
        onToggleRow={onToggleRow}
      />

      {card.cardType !== 'augment' && (
        <CardMasteryBlock masteryLvl={masteryLvl} xp={xp} unit={u} />
      )}

      {card.cardType !== 'augment' && (
        <CardBattleStatsBlock timesPlayed={timesPlayed} unitsLost={unitsLost} />
      )}
    </>
  )
}
