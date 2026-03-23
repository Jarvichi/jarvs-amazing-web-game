// ─── Dev Config Store ─────────────────────────────────────────────────────────
//
// Stores dev-mode tool settings under a dedicated key so they never
// interfere with the main save data. Intended for use with ?dev in the URL
// (ideally in an incognito window).

import { RareEventKind } from '../components/rare-events/types'
import { logError } from '../logger'

const DEV_CONFIG_KEY = 'jarv_dev_config'

export interface DevConfig {
  forcedRareEvent:   RareEventKind | null
  crystalBonus:      number | null
  handicapOverride:  number | null
  grantAllCards:     boolean
}

const DEFAULT_CONFIG: DevConfig = {
  forcedRareEvent:  null,
  crystalBonus:     null,
  handicapOverride: null,
  grantAllCards:    false,
}

export function loadDevConfig(): DevConfig {
  try {
    const raw = localStorage.getItem(DEV_CONFIG_KEY)
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch (e) {
    logError('loadDevConfig failed', { error: String(e) })
  }
  return { ...DEFAULT_CONFIG }
}

export function saveDevConfig(config: DevConfig): void {
  try {
    localStorage.setItem(DEV_CONFIG_KEY, JSON.stringify(config))
  } catch (e) {
    logError('saveDevConfig failed', { error: String(e) })
  }
}

export function clearDevConfig(): void {
  try {
    localStorage.removeItem(DEV_CONFIG_KEY)
  } catch (e) {
    logError('clearDevConfig failed', { error: String(e) })
  }
}

/** Patch a subset of the dev config and persist it. */
export function patchDevConfig(patch: Partial<DevConfig>): DevConfig {
  const next = { ...loadDevConfig(), ...patch }
  saveDevConfig(next)
  return next
}
