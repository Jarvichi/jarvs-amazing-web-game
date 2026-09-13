import React from 'react'
import { AugmentEffect, AugmentInstance } from '../../../game/types'
import { getAugmentCard, getAugmentSetDef } from '../../../game/augments'
import { RARITY_COLOR } from '../../../theme'
import { effectSummary } from './AugmentSlotsGrid'

interface Props {
  equippedMap: Record<string, AugmentInstance>
  setBonus: { setName: string; effect: AugmentEffect; description: string } | undefined
}

/** Names the set a unit's equipped augments belong to, how many of its 7
 *  slots are filled from that set, and the bonus once all 7 are. Shared
 *  between CardDetailModal's Augments tab and CardAugmentScreen. */
export function AugmentSetBonusPanel({ equippedMap, setBonus }: Props) {
  const equipped = Object.values(equippedMap)
  if (equipped.length === 0) return null

  const firstAug = getAugmentCard(equipped[0]?.cardId ?? '')
  const setName = firstAug?.setName
  const setDef = setName ? getAugmentSetDef(setName) : undefined
  if (!setDef) return null

  const hasFullSet = !!setBonus
  const slotsFilledSameSet = equipped.filter(i => getAugmentCard(i.cardId)?.setName === setName).length

  return (
    <div className={`cas-set-bonus${hasFullSet ? ' cas-set-bonus--active' : ''}`}>
      <span className="cas-set-bonus-name" style={{ color: RARITY_COLOR[setDef.rarity] }}>
        {setName} Set Bonus ({slotsFilledSameSet}/7)
      </span>
      <span className="cas-set-bonus-desc">{setDef.setBonusDescription}</span>
      {hasFullSet && (
        <span className="cas-set-bonus-effect cas-set-bonus-effect--active">
          {effectSummary(setDef.setBonus)} ACTIVE
        </span>
      )}
    </div>
  )
}
