import { createContext, useContext, type Dispatch, type MutableRefObject, type ReactNode, type SetStateAction } from 'react'
import type { GameState, StanceRules } from '../game/types'
import type { BattleAction, BattleState } from '../game/battleReducer'
import type { RareEventKind } from '../components/rare-events/types'

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

  showBossSplash:        boolean
  actTheme:              string | undefined
  isCampaign:            boolean
  quickPlayRewardClaimed: boolean
  activeRareEvent:       RareEventKind | null
  handleRareEventDone:   () => void

  /**
   * Mode flags read during render. They are refs rather than state because the
   * battle flow mutates them synchronously between screens; a consumer reads
   * them at the same points App used to.
   */
  isCampaignRef:         MutableRefObject<boolean>
  worldBattleNodeIdRef:  MutableRefObject<string | null>
  isDailyChallengeRef:   MutableRefObject<boolean>
  isWeeklyChallengeRef:  MutableRefObject<boolean>
  /** True while playing a single-battle duel offered by a wandering hub-town NPC (#2149). */
  isWandererBattleRef:   MutableRefObject<boolean>
  gameStateRef:          MutableRefObject<GameState | null>
  summaryDoneRef:        MutableRefObject<() => void>

  // ── Battle controls ───────────────────────────────────────────────────────
  handlePlayCard:    (cardId: string) => void
  handlePlayAoeCard: (cardId: string, cx: number, cy: number) => void
  handleGiveUp:      () => void
  setIsUserPaused:   Dispatch<SetStateAction<boolean>>
  handleSetStance:   (s: NonNullable<GameState['playerStance']>) => void
  handleCycleSpeed:  () => void
  handleWaveRewardPick: (cardName: string) => void
  handleWaveRewardSkip: () => void

  // ── Post-battle ───────────────────────────────────────────────────────────
  handleOpenPack:            () => void
  handleCampaignWin:         () => void
  handleCampaignRetry:       () => void
  handleDailyChallengeRetry: () => void
  handlePlayAgain:           () => void
  handleWorldBattleRetry:    () => void
  handleMainMenu:            () => void
  handleAbandonRun:          () => void
}

/** Re-exported for consumers that narrow stance options per node type. */
export type { StanceRules }

const BattleContext = createContext<BattleContextValue | null>(null)

export function BattleProvider({ value, children }: { value: BattleContextValue; children: ReactNode }) {
  return <BattleContext.Provider value={value}>{children}</BattleContext.Provider>
}

export function useBattle(): BattleContextValue {
  const ctx = useContext(BattleContext)
  if (!ctx) throw new Error('useBattle() called outside <BattleProvider> — battle routes must render inside App')
  return ctx
}
