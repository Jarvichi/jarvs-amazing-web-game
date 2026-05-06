/**
 * battleReducer — manages all state that exists only during a battle.
 *
 * Consolidating these into a single reducer prevents the sync bugs that arise
 * from updating multiple useState values independently (issue #490).
 *
 * Responsibilities:
 *   - Atomic START (all state initialised together)
 *   - Atomic END (all state cleared together)
 *   - Game tick and wave-reward phase transitions
 *   - Companion UI state (finger smash, shockwave, summary)
 *
 * The reducer is a pure function — no side effects.
 * Sound, analytics, Rollbar, and localStorage writes stay in App.tsx.
 */

import { GameState, BattleStats, Card } from './types'
import { tick as engineTick } from './engine'
import { playCard as enginePlayCard } from './engine/cards'
import type { DailyChallengeState } from './dailyChallenge'
import { generateEndlessRewardChoices } from './questline'

// ─── Constants ────────────────────────────────────────────

/** Game loop tick interval in ms. Exported so App.tsx and tests use the same value. */
export const TICK_MS = 100

// ─── State ────────────────────────────────────────────────

export interface BattleState {
  /** The live game state. null when no battle is active. */
  gameState: GameState | null
  /** Show the boss shockwave animation overlay. */
  showBossShockwave: boolean
  /** Snapshot of daily-challenge progress taken at battle end (for GameOver display). */
  dcGameOverState: DailyChallengeState | undefined
  /** Post-battle stats shown on the BattleSummary screen. */
  summaryStats: { stats: BattleStats; gameTime: number; playerScore: number } | null
  /** Show the FingerSmash animation overlay (endless mode wave clear). */
  showFingerSmash: boolean
  /** Unit names displayed in the FingerSmash animation. */
  fingerSmashNames: string[]
  /** Card name choices available on the wave-reward screen. */
  waveRewardChoices: string[]
  /** Game speed multiplier (1 / 2 / 4 / 8). Applied to deltaMs each tick. */
  speedMultiplier: 1 | 2 | 4 | 8
}

export const INITIAL_BATTLE_STATE: BattleState = {
  gameState: null,
  showBossShockwave: false,
  dcGameOverState: undefined,
  summaryStats: null,
  showFingerSmash: false,
  fingerSmashNames: [],
  waveRewardChoices: [],
  speedMultiplier: 1,
}

// ─── Actions ──────────────────────────────────────────────

export type BattleAction =
  /** Initialise all battle state atomically from a freshly-created GameState. */
  | { type: 'START'; gameState: GameState }
  /** Clear all battle state atomically when returning to a non-battle screen. */
  | { type: 'END' }
  /** Advance the game by one tick (TICK_MS ms). */
  | { type: 'TICK' }
  /**
   * Replace the live game state directly.
   * Use for complex external updates (e.g. card play, mid-battle saves) where
   * the caller already has the new GameState object.
   */
  | { type: 'SET_GAME_STATE'; gameState: GameState }
  /** Show the boss shockwave overlay. */
  | { type: 'SHOW_BOSS_SHOCKWAVE' }
  /** Hide the boss shockwave overlay (called from BossShockwave.onDone). */
  | { type: 'HIDE_BOSS_SHOCKWAVE' }
  /** Show the FingerSmash overlay for the given wave and populate reward choices. */
  | { type: 'ENTER_FINGER_SMASH'; names: string[]; wave: number; rewardDue: boolean }
  /** Hide the FingerSmash overlay when the animation completes. */
  | { type: 'DISMISS_FINGER_SMASH' }
  /** Explicitly set wave-reward choices (used when the phase skips straight to waveReward). */
  | { type: 'SET_WAVE_REWARD_CHOICES'; choices: string[] }
  /**
   * Player picked a wave-reward card.
   * Transitions phase back to 'playing' and injects the card into the player deck.
   * Pass undefined for card if the catalog lookup returned nothing.
   */
  | { type: 'WAVE_REWARD_PICK'; card: Card | undefined }
  /** Player skipped the wave-reward screen; transition phase back to 'playing'. */
  | { type: 'WAVE_REWARD_SKIP' }
  /** Store a snapshot of the daily-challenge state (called when phase reaches gameOver). */
  | { type: 'SET_DC_GAME_OVER'; state: DailyChallengeState }
  /** Store post-battle stats for the BattleSummary screen. */
  | { type: 'SET_SUMMARY_STATS'; stats: BattleStats; gameTime: number; playerScore: number }
  /** Change the player unit movement stance. */
  | { type: 'SET_STANCE'; stance: NonNullable<GameState['playerStance']> }
  /** Change the game speed multiplier. */
  | { type: 'SET_SPEED'; multiplier: 1 | 2 | 4 | 8 }

// ─── Reducer ──────────────────────────────────────────────

export function battleReducer(state: BattleState, action: BattleAction): BattleState {
  switch (action.type) {
    case 'START':
      return { ...INITIAL_BATTLE_STATE, gameState: action.gameState }

    case 'END':
      return INITIAL_BATTLE_STATE

    case 'TICK': {
      if (!state.gameState) return state
      return { ...state, gameState: engineTick(state.gameState, TICK_MS * state.speedMultiplier) }
    }

    case 'SET_GAME_STATE':
      return { ...state, gameState: action.gameState }

    case 'SHOW_BOSS_SHOCKWAVE':
      return { ...state, showBossShockwave: true }

    case 'HIDE_BOSS_SHOCKWAVE':
      return { ...state, showBossShockwave: false }

    case 'ENTER_FINGER_SMASH': {
      const choices = action.rewardDue ? generateEndlessRewardChoices(action.wave) : state.waveRewardChoices
      return {
        ...state,
        showFingerSmash: true,
        fingerSmashNames: action.names,
        waveRewardChoices: choices,
      }
    }

    case 'DISMISS_FINGER_SMASH':
      return { ...state, showFingerSmash: false }

    case 'SET_WAVE_REWARD_CHOICES':
      return { ...state, waveRewardChoices: action.choices }

    case 'WAVE_REWARD_PICK': {
      const gs = state.gameState
      if (!gs || gs.phase.type !== 'waveReward') return state
      const next: GameState = { ...gs, phase: { type: 'playing' } }
      if (action.card) {
        next.playerDeck = [...gs.playerDeck, { ...action.card, id: `reward-${Date.now()}` }]
      }
      return { ...state, gameState: next, waveRewardChoices: [] }
    }

    case 'WAVE_REWARD_SKIP': {
      const gs = state.gameState
      if (!gs || gs.phase.type !== 'waveReward') return state
      return { ...state, gameState: { ...gs, phase: { type: 'playing' } }, waveRewardChoices: [] }
    }

    case 'SET_DC_GAME_OVER':
      return { ...state, dcGameOverState: action.state }

    case 'SET_SUMMARY_STATS':
      return {
        ...state,
        summaryStats: { stats: action.stats, gameTime: action.gameTime, playerScore: action.playerScore },
      }

    case 'SET_STANCE': {
      if (!state.gameState) return state
      return { ...state, gameState: { ...state.gameState, playerStance: action.stance } }
    }

    case 'SET_SPEED':
      return { ...state, speedMultiplier: action.multiplier }

    default:
      return state
  }
}
