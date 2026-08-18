import React from 'react'
import { Icon } from '../../ui/icons/Icon'

interface Props {
  onClick: () => void
}

/** Full-width alert banner for an overdue/recently-lost city attack — an
 *  urgent, time-sensitive call to action, so it gets its own ember-toned
 *  treatment rather than sitting in the button grid at normal weight. */
export function CityAlertBanner({ onClick }: Props) {
  return (
    <button type="button" className="title-city-alert" onClick={onClick}>
      <Icon name="sword" size={16} /> CITY ALERT
    </button>
  )
}
