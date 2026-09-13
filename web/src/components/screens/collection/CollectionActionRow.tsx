import React from 'react'
import { Button } from '../../ui/Button'

interface Props {
  totalExtras: number
  totalUpgradeable: number
  onDisenchantAll: () => void
  onMasterAll: () => void
}

/** Bulk actions above the collection grid — hidden entirely when there's
 *  nothing to act on, rather than sitting there as two greyed-out bars. */
export function CollectionActionRow({ totalExtras, totalUpgradeable, onDisenchantAll, onMasterAll }: Props) {
  if (totalExtras === 0 && totalUpgradeable === 0) return null
  return (
    <div className="collection-action-row u-flex u-items-c u-gap-4 u-wrap">
      <Button
        size="sm"
        className="collection-disenchant-btn"
        onClick={onDisenchantAll}
        disabled={totalExtras === 0}
      >
        🔮 Disenchant extras ({totalExtras})
      </Button>
      <Button
        size="sm"
        className="collection-master-btn"
        onClick={onMasterAll}
        disabled={totalUpgradeable === 0}
        title="Convert all extra copies into mastery XP"
      >
        ★ Upgrade all ({totalUpgradeable})
      </Button>
    </div>
  )
}
