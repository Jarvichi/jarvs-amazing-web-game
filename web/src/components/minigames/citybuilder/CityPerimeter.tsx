import React from 'react'
import { Fortification, BuildQueueEntry } from '../../../game/cityBuilder'
import { FortCell, FortSlot } from './FortCell'

export interface Props {
  fortifications: Fortification[]
  builderQueue:   BuildQueueEntry[]
  onClick:        () => void
}

export function CityPerimeter({ fortifications, builderQueue, onClick }: Props) {
  const slots: FortSlot[] = [
    ...fortifications.map((fort, fortIndex) => ({ kind: 'active' as const, fort, fortIndex })),
    ...builderQueue.map((entry, queueIndex) => ({ kind: 'building' as const, entry, queueIndex })),
  ]

  if (slots.length === 0) return null

  return (
    <div
      className="city-perimeter"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter') onClick() }}
      title="City fortifications — tap to manage"
    >
      <div className="city-perimeter-forts u-flex u-wrap u-just-c u-gap-1">
        {slots.map((slot, idx) => (
          <FortCell key={idx} slot={slot} area="auto" onClick={onClick} />
        ))}
      </div>
    </div>
  )
}
