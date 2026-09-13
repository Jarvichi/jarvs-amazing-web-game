import React from 'react'
import { ComboLink, SynergyGroup } from '../../../game/synergies'
import { CardExpandableRow } from './CardExpandableRow'

interface Props {
  synergyGroups: SynergyGroup[]
  comboLinks: ComboLink[]
  expandedRow: string | null
  onToggleRow: (key: string) => void
}

/** The groups this card shares with others in the same deck, and the cards
 *  it directly pairs with. */
export function CardSynergyPanel({ synergyGroups, comboLinks, expandedRow, onToggleRow }: Props) {
  if (synergyGroups.length === 0 && comboLinks.length === 0) return null

  const tagsText = [
    ...synergyGroups.map(g => g.label),
    ...(comboLinks.length > 0
      ? [`${comboLinks.length} card pairing${comboLinks.length === 1 ? '' : 's'}`]
      : []),
  ].join(', ')

  return (
    <div className="cdm-sw-block u-col u-gap-1">
      <CardExpandableRow
        labelContent="⚡ Synergy"
        labelClassName="cdm-sw-label--synergy"
        tagsText={tagsText}
        expanded={expandedRow === 'synergy'}
        onToggle={() => onToggleRow('synergy')}
      >
        {comboLinks.map(link => (
          <div key={`${link.kind}-${link.partner}`} className="cdm-synergy-item">
            <strong>{link.partner}</strong> — {link.detail}
          </div>
        ))}
        {synergyGroups.map(g => (
          <div key={g.id} className="cdm-synergy-item">
            <strong>{g.icon} {g.label}</strong> — {g.desc}
          </div>
        ))}
      </CardExpandableRow>
    </div>
  )
}
