import React from 'react'
import { AugmentEffect, UnitTemplate } from '../../../game/types'
import { AugStatRow } from './AugStatRow'

interface Props {
  unit: UnitTemplate | undefined
  atkBonus: number
  hpBonus: number
  augmentEffect: AugmentEffect
  hasStatBonus: boolean
  showBreakdown: boolean
  onToggleBreakdown: () => void
}

/** The top ATK/HP/SPD/RNG/CD row and the "where do these come from?" toggle
 *  that reveals base/mastery/augment breakdowns for each. */
export function CardStatsBlock({ unit: u, atkBonus, hpBonus, augmentEffect, hasStatBonus, showBreakdown, onToggleBreakdown }: Props) {
  if (!u) return null
  return (
    <>
      {u.moveSpeed > 0 ? (
        <div className="cdm-stats-block u-flex u-wrap">
          <AugStatRow label="ATK" base={u.attack}    mastery={atkBonus} augment={augmentEffect.attack}    breakdown={showBreakdown} />
          <AugStatRow label="HP"  base={u.maxHp}     mastery={hpBonus}  augment={augmentEffect.maxHp}     breakdown={showBreakdown} />
          <AugStatRow label="SPD" base={u.moveSpeed}                    augment={augmentEffect.moveSpeed} breakdown={showBreakdown} />
          {u.attackRange > 0 && <AugStatRow label="RNG" base={u.attackRange} augment={augmentEffect.attackRange} breakdown={showBreakdown} />}
          {u.attackCooldownMs > 0 && <AugStatRow label="CD" base={u.attackCooldownMs / 1000} />}
        </div>
      ) : (
        <div className="cdm-stats-block u-flex u-wrap">
          {/* No augment delta: applyAugmentBonuses returns early for
              structures, so showing one promised a bonus the engine
              would never apply. Mastery HP does apply (+10%/level). */}
          <AugStatRow label="HP" base={u.maxHp} mastery={hpBonus} breakdown={showBreakdown} />
        </div>
      )}

      {hasStatBonus && (
        <button
          type="button"
          className="cdm-breakdown-toggle"
          onClick={onToggleBreakdown}
          aria-expanded={showBreakdown}
        >
          {showBreakdown ? '▴ Hide breakdown' : '▾ Where do these come from?'}
        </button>
      )}
    </>
  )
}
