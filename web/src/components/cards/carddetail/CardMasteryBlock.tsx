import React from 'react'
import { UnitTemplate } from '../../../game/types'
import { MasteryBar } from '../../ui/MasteryBar'

interface Milestone {
  lvl: number
  text: string
}

function structureMilestones(u: UnitTemplate): Milestone[] {
  const se = u.structureEffect as { type: string } | undefined
  const milestones: Milestone[] = [{ lvl: 1, text: '+10% max HP per level' }]
  if (u.isWall) {
    milestones.push({ lvl: 5, text: 'Elite: self-repairs 2 HP every 6s' })
  } else if (se?.type === 'spawn') {
    milestones.push({ lvl: 1, text: '−5% spawn interval per level' })
  } else if (se?.type === 'mana') {
    milestones.push({ lvl: 5, text: 'Elite: +1 mana produced per turn' })
  } else if (se?.type === 'healAura') {
    milestones.push({ lvl: 1, text: '+1 heal per level' })
    milestones.push({ lvl: 5, text: 'Elite: 25% faster heal pulses' })
  } else if (se?.type === 'repairAura') {
    milestones.push({ lvl: 1, text: '+1 repair per level' })
    milestones.push({ lvl: 5, text: 'Elite: 25% faster repair pulses' })
  } else if (se?.type === 'attackAura') {
    milestones.push({ lvl: 1, text: '+1 ATK aura per 2 levels' })
  } else if (se?.type === 'manaSpeed') {
    milestones.push({ lvl: 1, text: '4% faster mana regen per level' })
  }
  return milestones
}

interface Props {
  masteryLvl: number
  xp: number
  unit: UnitTemplate | undefined
}

export function CardMasteryBlock({ masteryLvl, xp, unit: u }: Props) {
  const milestones = u
    ? u.moveSpeed > 0
      ? [{ lvl: 1, text: 'Affinity activates' }, { lvl: 5, text: 'Elite: +10% damage dealt' }]
      : structureMilestones(u)
    : []

  return (
    <div className="cdm-mastery-block">
      <div className="cdm-mastery-header">
        <span className={masteryLvl >= 5 ? 'cdm-mastery-elite' : 'cdm-mastery-title'}>
          {masteryLvl >= 5 ? '⚡' : '★'} Mastery {masteryLvl}{masteryLvl >= 5 ? ' — ELITE' : ''}
        </span>
        {/* Just the target level — the bar below already states the
            raw xpCur/xpNeeded, as does the modal header. */}
        {masteryLvl < 5 && <span className="cdm-mastery-xp">to Lv{masteryLvl + 1}</span>}
      </div>
      <MasteryBar xp={xp} />
      {milestones.length > 0 && (
        <div className="cdm-mastery-milestones">
          {milestones.map(m => (
            <div key={m.text} className={`cdm-milestone${masteryLvl >= m.lvl ? ' cdm-milestone--unlocked u-text-gold' : ''}`}>
              Lv{m.lvl} — {m.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
