import React from 'react'
import type { WeatherType } from '../../game/hub/weather'

interface Props {
  areaName: string | null
  weather:  WeatherType
}

const WEATHER_GLYPH: Partial<Record<WeatherType, string>> = {
  rain: '🌧️',
  snow: '❄️',
  fog:  '🌫️',
}

/** Ambient overlay in the canvas's corner: a weather glyph (when there's
 *  weather worth naming) and the current area name.
 *
 *  Used to also carry the clock, duplicating the one HubStatusBar already
 *  shows in the header — 07:14 rendered twice, simultaneously, on the same
 *  screen. The clock is load-bearing for hub decisions (it gates shop hours,
 *  NPC schedules, festivals) so it stays in the header where it's actionable
 *  context; this corner keeps only what's genuinely local — day/night has no
 *  second home, but weather is also shown as real rain/snow particles on the
 *  canvas, so the glyph here is a legible label for that, not a duplicate. */
export function HubStatusCluster({ areaName, weather }: Props) {
  const weatherGlyph = WEATHER_GLYPH[weather]

  return (
    <div className="hub-status-cluster">
      {weatherGlyph && (
        <div className="hub-status-cluster__weather" aria-hidden="true">{weatherGlyph}</div>
      )}
      <div className={`hub-status-cluster__area${areaName ? ' hub-status-cluster__area--visible' : ''}`}>
        {areaName ?? ''}
      </div>
    </div>
  )
}
