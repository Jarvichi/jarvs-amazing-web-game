import { createContext, useContext, type Dispatch, type ReactNode } from 'react'
import type { GameState } from '../game/types'
import type { BattleAction, BattleState } from '../game/battleReducer'

/**
 * Battle-only state, kept out of AppContext on purpose: `gameState` is replaced
 * every TICK_MS, so folding it into the broad context would re-render every
 * route group and every overlay on every tick.
 *
 * Consumed only by the routes that render during a battle.
 */
export interface BattleContextValue {
  battle:    BattleState
  gameState: GameState | null
  dispatch:  Dispatch<BattleAction>
}

const BattleContext = createContext<BattleContextValue | null>(null)

export function BattleProvider({ value, children }: { value: BattleContextValue; children: ReactNode }) {
  return <BattleContext.Provider value={value}>{children}</BattleContext.Provider>
}

export function useBattle(): BattleContextValue {
  const ctx = useContext(BattleContext)
  if (!ctx) throw new Error('useBattle() called outside <BattleProvider> — battle routes must render inside App')
  return ctx
}
