import React from 'react'
import { Icon } from '../../ui/icons/Icon'
import { Button } from '../../ui/Button'

interface Props {
  augmentUpgradeCost: number
  canUpgrade?: boolean
  onUpgrade?: () => void
  breakdownValue: number
  onBreakdown?: () => void
  extras: number
  disenchantValue: number
  onDisenchant?: () => void
  onMasterCard?: () => void
}

/** The modal's bottom action bar: augment upgrade/breakdown when viewing an
 *  augment instance, or sell/mastery-upgrade when viewing a collection card
 *  with spare copies. */
export function CardDetailActions({
  augmentUpgradeCost, canUpgrade, onUpgrade, breakdownValue, onBreakdown,
  extras, disenchantValue, onDisenchant, onMasterCard,
}: Props) {
  return (
    <>
      {onUpgrade && (
        <div className="cdm-actions">
          <Button variant="gold" disabled={!canUpgrade} onClick={onUpgrade} title={`Costs ${augmentUpgradeCost} souls`}>
            ↑ Upgrade ({augmentUpgradeCost} souls)
          </Button>
        </div>
      )}

      {onBreakdown && (
        <div className="cdm-actions">
          <Button size="sm" onClick={onBreakdown}>
            💀 Break Down (+{breakdownValue} 👻)
          </Button>
        </div>
      )}

      {extras > 0 && (onDisenchant || onMasterCard) && (
        <div className="cdm-actions">
          {onDisenchant && (
            <Button size="sm" onClick={onDisenchant}>
              Sell +{disenchantValue}<Icon name="crystal" size={13} />
            </Button>
          )}
          {onMasterCard && (
            <Button size="sm" variant="gold" onClick={onMasterCard}>
              Upgrade +{extras}XP
            </Button>
          )}
        </div>
      )}
    </>
  )
}
