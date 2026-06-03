import { useState, useEffect } from 'react'
import { getGameHour, getGameMinute, isNight } from '../game/hub/hubClock'

export interface HubClockState {
  gameHour:   number
  gameMinute: number
  isNight:    boolean
}

function snapshot(): HubClockState {
  const h = getGameHour()
  return { gameHour: h, gameMinute: getGameMinute(), isNight: isNight(h) }
}

/**
 * Returns the current hub game time, refreshing every `updateMs` milliseconds.
 * Default 10 s is fine-grained enough for schedule checks without being wasteful.
 */
export function useHubClock(updateMs = 10_000): HubClockState {
  const [state, setState] = useState<HubClockState>(snapshot)

  useEffect(() => {
    const id = setInterval(() => setState(snapshot()), updateMs)
    return () => clearInterval(id)
  }, [updateMs])

  return state
}
