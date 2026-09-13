import React from 'react'
import { UnitTemplate } from '../../../game/types'
import { Toolbar } from '../../ui/Toolbar/Toolbar'
import { ToolbarButton } from '../../ui/Toolbar/ToolbarButton'
import { ToolbarLabel } from '../../ui/Toolbar/ToolbarLabel'
import { ToolbarSpacer } from '../../ui/Toolbar/ToolbarSpacer'

interface Props {
  cardName: string
  unit: UnitTemplate | undefined
  activeTab: number
  onTabChange: (tab: number) => void
  commanderName?: string | null
  promotionsLeft: number
  onPromote?: () => void
}

/** Details/Augments tab switcher, plus the promote-to-commander control that
 *  shares its row (unit cards only). */
export function CardDetailTabBar({ cardName, unit: u, activeTab, onTabChange, commanderName, promotionsLeft, onPromote }: Props) {
  return (
    <Toolbar>
      <ToolbarButton label="Details" active={activeTab === 0} onClick={() => onTabChange(0)} />
      <ToolbarButton label="Augments" active={activeTab === 1} onClick={() => onTabChange(1)} />
      <ToolbarSpacer />

      {onPromote && u && u.moveSpeed > 0 && (
        commanderName === cardName ? (
          <ToolbarLabel>⭐ Current Commander</ToolbarLabel>
        ) : (
          <ToolbarButton
            className="extra-btn extra-btn--promote"
            onClick={onPromote}
            locked={promotionsLeft === 0}
            label={
              promotionsLeft === 0 ? 'Promotion limit reached for today (2/day)'
              : commanderName ? `Promote to Commander (replaces ${commanderName})`
              : 'Promote to Commander'
            }
          />
        )
      )}
    </Toolbar>
  )
}
