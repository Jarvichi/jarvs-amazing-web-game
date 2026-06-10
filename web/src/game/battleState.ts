import { GameState } from './types'
import { logError } from '../logger'
import { syncUnitIdCounter } from './engine/helpers'

const KEY = 'jarv_battle_state'

/** Persist the current battle GameState so it can be restored after a page refresh. */
export function saveBattleState(state: GameState): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

/** Load a previously persisted battle GameState, or null if none exists or validation fails. */
export function loadBattleState(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GameState
    // Validate critical fields that would crash renders if missing (schema may have changed)
    if (
      typeof parsed?.playerBase?.maxHp !== 'number' ||
      typeof parsed?.opponentBase?.maxHp !== 'number' ||
      !Array.isArray(parsed?.field) ||
      !parsed?.battleStats
    ) {
      logError('loadBattleState: saved state failed base validation — discarding', {
        hasPlayerBase: typeof parsed?.playerBase?.maxHp,
        hasOpponentBase: typeof parsed?.opponentBase?.maxHp,
        hasField: Array.isArray(parsed?.field),
        hasBattleStats: !!parsed?.battleStats,
      })
      localStorage.removeItem(KEY)
      return null
    }
    // Validate that all field units have required numeric fields (guards against stale schema)
    const invalidUnits = parsed.field.filter(u => typeof u?.maxHp !== 'number' || typeof u?.hp !== 'number')
    if (invalidUnits.length > 0) {
      logError('loadBattleState: saved state has units with invalid maxHp/hp — discarding', {
        invalidCount: invalidUnits.length,
        names: invalidUnits.map(u => u?.name).join(', '),
      })
      localStorage.removeItem(KEY)
      return null
    }
    // Units in the restored field keep their original ids while the module-level id
    // counter restarts at 0 after a reload — bump it so new spawns can't collide.
    syncUnitIdCounter(parsed.field)
    return parsed
  } catch { return null }
}

/** Remove the persisted battle state (call on battle end or game reset). */
export function clearBattleState(): void {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
