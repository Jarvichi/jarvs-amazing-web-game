import React from 'react'
import type { WeatherType } from '../../game/hub/weather'

interface Props {
  areaName: string | null
  isNight:  boolean
  timeLabel: string
  weather:  WeatherType
}

const WEATHER_GLYPH: Partial<Record<WeatherType, string>> = {
  rain: '🌧️',
  snow: '❄️',
  fog:  '🌫️',
}

/** Consolidated ambient overlay — day/night, weather, and the current area
 *  name — so the canvas carries one coherent status readout in its corner
 *  instead of three unrelated floating pieces of chrome. */
export function HubStatusCluster({ areaName, isNight, timeLabel, weather }: Props) {
  const weatherGlyph = WEATHER_GLYPH[weather]

  return (
    <div className="hub-status-cluster">
      <div className="hub-status-cluster__time">
        <span aria-hidden="true">{isNight ? '🌙' : '☀️'}</span>
        {weatherGlyph && <span aria-hidden="true">{weatherGlyph}</span>}
        <span>{timeLabel}</span>
      </div>
      <div className={`hub-status-cluster__area${areaName ? ' hub-status-cluster__area--visible' : ''}`}>
        {areaName ?? ''}
      </div>
    </div>
  )
}
