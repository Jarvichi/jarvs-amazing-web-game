import { createContext, useContext, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import type { User } from 'firebase/auth'
import type { Act, RunState } from '../game/questline'
import type { CommanderState } from '../game/commander'
import type { Screen } from './screens'

/**
 * Everything the route groups and overlays need from `App`, minus battle state
 * (see BattleContext — `gameState` changes every TICK_MS and would otherwise
 * re-render every screen and overlay on every tick).
 *
 * `App` still owns all of this; the context only removes the need to hand-write
 * a 40-plus-prop interface per route group. Grown a phase at a time as each
 * route group is extracted (#316) — add a field here when a consumer needs it,
 * not speculatively.
 */
export interface AppContextValue {
  // ── Navigation ────────────────────────────────────────────────────────────
  screen:          Screen
  setScreen:       Dispatch<SetStateAction<Screen>>
  returnScreen:    Screen
  setReturnScreen: Dispatch<SetStateAction<Screen>>

  // ── Player / account ──────────────────────────────────────────────────────
  user:        User | null
  authLoading: boolean
  isAdmin:     boolean
  crystals:    number
  setCrystals: Dispatch<SetStateAction<number>>
  handicap:    number
  setHandicap: Dispatch<SetStateAction<number>>
  commander:   CommanderState | null

  // ── Campaign run ──────────────────────────────────────────────────────────
  run:     RunState | null
  setRun:  Dispatch<SetStateAction<RunState | null>>
  actData: Act | null
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ value, children }: { value: AppContextValue; children: ReactNode }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp() called outside <AppProvider> — route groups must render inside App')
  return ctx
}
