import React from 'react'
import { UnitTemplate } from '../../../game/types'
import { Icon } from '../../ui/icons/Icon'
import { CardExpandableRow } from './CardExpandableRow'

function joinEm(tags: string[]): React.ReactNode[] {
  return tags
    .map(t => <em key={t}>{t}</em>)
    .reduce<React.ReactNode[]>((a, el, i) => i === 0 ? [el] : [...a, ', ', el], [])
}

function affinityEffectText(effectType: string, effectAmount: number): string {
  const pct = Math.round(Math.abs(effectAmount - 1) * 100)
  if (effectType === 'attackSpeed') return `+${pct}% attack speed`
  if (effectType === 'damage')      return `+${pct}% damage dealt`
  if (effectType === 'moveSpeed')   return `+${pct}% movement speed`
  return `×${effectAmount} ${effectType}`
}

interface Props {
  unit: UnitTemplate
  masteryLvl: number
  expandedRow: string | null
  onToggleRow: (key: string) => void
}

/** Strengths, weaknesses, and affinity — the "what this unit is good and
 *  bad against" disclosure block. */
export function CardCombatProfile({ unit: u, masteryLvl, expandedRow, onToggleRow }: Props) {
  if (!(u.strengths?.length || u.weaknesses?.length || u.affinity)) return null

  return (
    <div className="cdm-sw-block u-col u-gap-1">
      {u.strengths && u.strengths.length > 0 && (
        <CardExpandableRow
          labelContent="⚔ Strong vs"
          labelClassName="cdm-sw-label--strong"
          tagsText={u.strengths.join(', ')}
          expanded={expandedRow === 'strong'}
          onToggle={() => onToggleRow('strong')}
        >
          Deals <strong>×1.5 damage</strong> against units tagged: {joinEm(u.strengths)}
        </CardExpandableRow>
      )}

      {u.weaknesses && u.weaknesses.length > 0 && (
        <CardExpandableRow
          labelContent={<><Icon name="warning" size={12} /> Weak to</>}
          labelClassName="cdm-sw-label--weak"
          tagsText={u.weaknesses.join(', ')}
          expanded={expandedRow === 'weak'}
          onToggle={() => onToggleRow('weak')}
        >
          Enemies tagged {joinEm(u.weaknesses)} deal <strong>×1.5 damage</strong> to this unit.
        </CardExpandableRow>
      )}

      {u.affinity && (
        <CardExpandableRow
          labelContent={<>{masteryLvl < 1 ? <Icon name="lock" size={12} /> : '✦'} Affinity</>}
          labelClassName="cdm-sw-label--affinity"
          tagsText={u.affinity.label}
          expanded={expandedRow === 'affinity'}
          onToggle={() => onToggleRow('affinity')}
        >
          {masteryLvl < 1 && (
            <div className="cdm-locked-note">Requires Mastery 1 to activate.</div>
          )}
          When a <strong>{u.affinity.withName}</strong> is nearby (within {u.affinity.range}px),
          grants <strong>{affinityEffectText(u.affinity.effectType, u.affinity.effectAmount)}</strong>.
          <br />"{u.affinity.label}"
        </CardExpandableRow>
      )}
    </div>
  )
}
