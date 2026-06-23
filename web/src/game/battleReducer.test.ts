import { describe, it, expect, vi, beforeEach } from 'vitest'
import { battleReducer, INITIAL_BATTLE_STATE, TICK_MS, BattleState } from './battleReducer'
import { GameState, BattleStats, Card } from './types'

// ─── Mocks ────────────────────────────────────────────────
//
// The reducer imports engine.tick, engine.playCard, and
// questline.generateEndlessRewardChoices. We mock these so
// tests are fast and don't pull in the full card catalogue.

vi.mock('./engine', () => ({
  tick: vi.fn((state: GameState, deltaMs: number) => ({
    ...state,
    gameTime: state.gameTime + deltaMs,
  })),
  playCard: vi.fn((state: GameState) => ({ ...state })),
}))

vi.mock('./questline', () => ({
  generateEndlessRewardChoices: vi.fn((_wave: number) => ['Card A', 'Card B', 'Card C']),
}))

// ─── Helpers ──────────────────────────────────────────────

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    playerBase: { hp: 100, maxHp: 100 },
    opponentBase: { hp: 100, maxHp: 100 },
    field: [],
    playerHand: [],
    playerDeck: [],
    opponentHand: [],
    opponentDeck: [],
    mana: 3,
    maxMana: 3,
    manaAccum: 0,
    log: [],
    phase: { type: 'playing' },
    opponentTimer: 5000,
    opponentIntervalMs: 5000,
    opponentStrategy: 'swarm',
    gameTime: 0,
    playerScore: 0,
    opponentScore: 0,
    suddenDeath: false,
    suddenDeathTimer: 60000,
    suddenDeathBuildingTimer: 2000,
    battleEventTimer: 30000,
    activeBattleEvent: null,
    terrain: [],
    battleStats: { cardsPlayed: {}, playerKills: 0, playerUnitsLost: 0 } satisfies BattleStats,
    animEvents: [],
    bloodPools: [],
    hazards: [],
    pendingSpellCast: null,
    ...overrides,
  }
}

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'test-card',
    name: 'Test Card',
    rarity: 'common',
    cost: 2,
    cardType: 'unit',
    description: 'A test card',
    ...overrides,
  }
}

function withGameState(gs: GameState, overrides: Partial<BattleState> = {}): BattleState {
  return { ...INITIAL_BATTLE_STATE, gameState: gs, ...overrides }
}

// ─── Tests ────────────────────────────────────────────────

describe('battleReducer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── START ──────────────────────────────────────────────

  describe('START', () => {
    it('sets gameState and resets all other fields to initial values', () => {
      const dirtyState: BattleState = {
        gameState: null,
        showBossShockwave: true,
        dcGameOverState: { date: '2026-01-01', won: true, attempts: 3 },
        summaryStats: { stats: { cardsPlayed: {}, playerKills: 5, playerUnitsLost: 2 }, gameTime: 60000, playerScore: 500 },
        showFingerSmash: true,
        fingerSmashNames: ['Goblin', 'Rat'],
        waveRewardChoices: ['Goblin', 'Rat', 'Spider'],
        speedMultiplier: 4,
      }
      const gs = makeGameState()
      const next = battleReducer(dirtyState, { type: 'START', gameState: gs })

      expect(next.gameState).toBe(gs)
      expect(next.showBossShockwave).toBe(false)
      expect(next.dcGameOverState).toBeUndefined()
      expect(next.summaryStats).toBeNull()
      expect(next.showFingerSmash).toBe(false)
      expect(next.fingerSmashNames).toEqual([])
      expect(next.waveRewardChoices).toEqual([])
    })
  })

  // ── END ────────────────────────────────────────────────

  describe('END', () => {
    it('resets all battle state to initial values', () => {
      const active: BattleState = {
        gameState: makeGameState(),
        showBossShockwave: true,
        dcGameOverState: { date: '2026-01-01', won: false, attempts: 2 },
        summaryStats: { stats: { cardsPlayed: {}, playerKills: 1, playerUnitsLost: 0 }, gameTime: 30000, playerScore: 100 },
        showFingerSmash: true,
        fingerSmashNames: ['Goblin'],
        waveRewardChoices: ['Card A'],
        speedMultiplier: 2,
      }
      const next = battleReducer(active, { type: 'END' })

      expect(next).toEqual(INITIAL_BATTLE_STATE)
      expect(next.gameState).toBeNull()
    })
  })

  // ── TICK ───────────────────────────────────────────────

  describe('TICK', () => {
    it('calls engine.tick and updates gameState', async () => {
      const { tick } = await import('./engine')
      const gs = makeGameState({ gameTime: 0 })
      const state = withGameState(gs)

      const next = battleReducer(state, { type: 'TICK' })

      expect(tick).toHaveBeenCalledWith(gs, TICK_MS)
      expect(next.gameState?.gameTime).toBe(TICK_MS)
    })

    it('is a no-op when gameState is null', () => {
      const next = battleReducer(INITIAL_BATTLE_STATE, { type: 'TICK' })
      expect(next).toBe(INITIAL_BATTLE_STATE)
    })

    it('runs one fixed-size engine sub-tick per speed multiple', async () => {
      const { tick } = await import('./engine')
      const state = withGameState(makeGameState({ gameTime: 0 }), { speedMultiplier: 8 })

      const next = battleReducer(state, { type: 'TICK' })

      expect(tick).toHaveBeenCalledTimes(8)
      expect(vi.mocked(tick).mock.calls.every(call => call[1] === TICK_MS)).toBe(true)
      expect(next.gameState?.gameTime).toBe(8 * TICK_MS)
    })

    it('stops sub-ticking as soon as the player base takes damage', async () => {
      const { tick } = await import('./engine')
      vi.mocked(tick).mockImplementationOnce((state: GameState, deltaMs: number) => ({
        ...state,
        gameTime: state.gameTime + deltaMs,
        playerBase: { ...state.playerBase, hp: state.playerBase.hp - 5 },
      }))
      const state = withGameState(makeGameState({ gameTime: 0 }), { speedMultiplier: 8 })

      const next = battleReducer(state, { type: 'TICK' })

      expect(tick).toHaveBeenCalledTimes(1)
      expect(next.gameState?.playerBase.hp).toBe(95)
    })

    it('stops sub-ticking when the game leaves the playing phase', async () => {
      const { tick } = await import('./engine')
      vi.mocked(tick).mockImplementationOnce((state: GameState, deltaMs: number) => ({
        ...state,
        gameTime: state.gameTime + deltaMs,
        phase: { type: 'gameOver' as const, winner: 'opponent' as const },
      }))
      const state = withGameState(makeGameState({ gameTime: 0 }), { speedMultiplier: 8 })

      const next = battleReducer(state, { type: 'TICK' })

      expect(tick).toHaveBeenCalledTimes(1)
      expect(next.gameState?.phase.type).toBe('gameOver')
    })

    it('does not mutate other battle state fields', () => {
      const state = withGameState(makeGameState(), { showBossShockwave: true, fingerSmashNames: ['X'] })
      const next = battleReducer(state, { type: 'TICK' })
      expect(next.showBossShockwave).toBe(true)
      expect(next.fingerSmashNames).toEqual(['X'])
    })
  })

  // ── SET_GAME_STATE ─────────────────────────────────────

  describe('SET_GAME_STATE', () => {
    it('replaces gameState without touching other fields', () => {
      const gs1 = makeGameState({ gameTime: 0 })
      const gs2 = makeGameState({ gameTime: 5000 })
      const state = withGameState(gs1, { showBossShockwave: true })

      const next = battleReducer(state, { type: 'SET_GAME_STATE', gameState: gs2 })

      expect(next.gameState).toBe(gs2)
      expect(next.showBossShockwave).toBe(true)
    })
  })

  // ── SHOW/HIDE_BOSS_SHOCKWAVE ───────────────────────────

  describe('SHOW_BOSS_SHOCKWAVE', () => {
    it('sets showBossShockwave to true', () => {
      const next = battleReducer(withGameState(makeGameState()), { type: 'SHOW_BOSS_SHOCKWAVE' })
      expect(next.showBossShockwave).toBe(true)
    })
  })

  describe('HIDE_BOSS_SHOCKWAVE', () => {
    it('sets showBossShockwave to false', () => {
      const state = withGameState(makeGameState(), { showBossShockwave: true })
      const next = battleReducer(state, { type: 'HIDE_BOSS_SHOCKWAVE' })
      expect(next.showBossShockwave).toBe(false)
    })
  })

  // ── ENTER_FINGER_SMASH ─────────────────────────────────

  describe('ENTER_FINGER_SMASH', () => {
    it('shows finger smash with correct names', () => {
      const state = withGameState(makeGameState())
      const next = battleReducer(state, {
        type: 'ENTER_FINGER_SMASH',
        names: ['Goblin', 'Rat'],
        wave: 3,
        rewardDue: false,
      })

      expect(next.showFingerSmash).toBe(true)
      expect(next.fingerSmashNames).toEqual(['Goblin', 'Rat'])
    })

    it('generates wave reward choices when rewardDue is true', async () => {
      const { generateEndlessRewardChoices } = await import('./questline')
      const state = withGameState(makeGameState())
      const next = battleReducer(state, {
        type: 'ENTER_FINGER_SMASH',
        names: ['Goblin'],
        wave: 5,
        rewardDue: true,
      })

      expect(generateEndlessRewardChoices).toHaveBeenCalledWith(5)
      expect(next.waveRewardChoices).toEqual(['Card A', 'Card B', 'Card C'])
    })

    it('does not generate choices when rewardDue is false', async () => {
      const { generateEndlessRewardChoices } = await import('./questline')
      const state = withGameState(makeGameState())
      battleReducer(state, {
        type: 'ENTER_FINGER_SMASH',
        names: [],
        wave: 1,
        rewardDue: false,
      })

      expect(generateEndlessRewardChoices).not.toHaveBeenCalled()
    })
  })

  // ── DISMISS_FINGER_SMASH ───────────────────────────────

  describe('DISMISS_FINGER_SMASH', () => {
    it('hides finger smash overlay', () => {
      const state = withGameState(makeGameState(), {
        showFingerSmash: true,
        fingerSmashNames: ['Goblin'],
      })
      const next = battleReducer(state, { type: 'DISMISS_FINGER_SMASH' })

      expect(next.showFingerSmash).toBe(false)
      expect(next.fingerSmashNames).toEqual(['Goblin']) // names preserved for animation completion
    })
  })

  // ── SET_WAVE_REWARD_CHOICES ────────────────────────────

  describe('SET_WAVE_REWARD_CHOICES', () => {
    it('sets wave reward choices', () => {
      const state = withGameState(makeGameState())
      const next = battleReducer(state, {
        type: 'SET_WAVE_REWARD_CHOICES',
        choices: ['Fire Imp', 'Vine Creeper', 'Stone Golem'],
      })

      expect(next.waveRewardChoices).toEqual(['Fire Imp', 'Vine Creeper', 'Stone Golem'])
    })
  })

  // ── WAVE_REWARD_PICK ───────────────────────────────────

  describe('WAVE_REWARD_PICK', () => {
    it('transitions phase to playing and injects card into player deck', () => {
      const gs = makeGameState({
        phase: { type: 'waveReward', wave: 2, smashedNames: [] },
        playerDeck: [],
      })
      const card = makeCard({ id: 'reward-card', name: 'Fire Imp' })
      const state = withGameState(gs, { waveRewardChoices: ['Fire Imp', 'Stone Golem'] })

      const next = battleReducer(state, { type: 'WAVE_REWARD_PICK', card })

      expect(next.gameState?.phase.type).toBe('playing')
      expect(next.gameState?.playerDeck).toHaveLength(1)
      expect(next.gameState?.playerDeck[0].name).toBe('Fire Imp')
      expect(next.waveRewardChoices).toEqual([])
    })

    it('transitions phase without injecting card when card is undefined', () => {
      const gs = makeGameState({
        phase: { type: 'waveReward', wave: 1, smashedNames: [] },
        playerDeck: [],
      })
      const state = withGameState(gs)

      const next = battleReducer(state, { type: 'WAVE_REWARD_PICK', card: undefined })

      expect(next.gameState?.phase.type).toBe('playing')
      expect(next.gameState?.playerDeck).toHaveLength(0)
    })

    it('is a no-op when phase is not waveReward', () => {
      const gs = makeGameState({ phase: { type: 'playing' } })
      const state = withGameState(gs)
      const card = makeCard()

      const next = battleReducer(state, { type: 'WAVE_REWARD_PICK', card })

      expect(next).toBe(state)
    })
  })

  // ── WAVE_REWARD_SKIP ───────────────────────────────────

  describe('WAVE_REWARD_SKIP', () => {
    it('transitions phase to playing and clears reward choices', () => {
      const gs = makeGameState({ phase: { type: 'waveReward', wave: 1, smashedNames: [] } })
      const state = withGameState(gs, { waveRewardChoices: ['Card A', 'Card B'] })

      const next = battleReducer(state, { type: 'WAVE_REWARD_SKIP' })

      expect(next.gameState?.phase.type).toBe('playing')
      expect(next.waveRewardChoices).toEqual([])
    })

    it('is a no-op when phase is not waveReward', () => {
      const gs = makeGameState({ phase: { type: 'playing' } })
      const state = withGameState(gs)

      const next = battleReducer(state, { type: 'WAVE_REWARD_SKIP' })

      expect(next).toBe(state)
    })
  })

  // ── SET_DC_GAME_OVER ───────────────────────────────────

  describe('SET_DC_GAME_OVER', () => {
    it('stores the daily challenge snapshot', () => {
      const state = withGameState(makeGameState())
      const dcState = { date: '2026-03-28', won: true, attempts: 1 }

      const next = battleReducer(state, { type: 'SET_DC_GAME_OVER', state: dcState })

      expect(next.dcGameOverState).toEqual(dcState)
    })
  })

  // ── SET_SUMMARY_STATS ──────────────────────────────────

  describe('SET_SUMMARY_STATS', () => {
    it('stores the battle summary stats', () => {
      const state = withGameState(makeGameState())
      const stats: BattleStats = { cardsPlayed: { Goblin: 3 }, playerKills: 7, playerUnitsLost: 2 }

      const next = battleReducer(state, {
        type: 'SET_SUMMARY_STATS',
        stats,
        gameTime: 120000,
        playerScore: 850,
      })

      expect(next.summaryStats).toEqual({ stats, gameTime: 120000, playerScore: 850 })
    })
  })

  // ── COUNTER_SPELL ──────────────────────────────────────

  describe('COUNTER_SPELL', () => {
    function makeCast(overrides: Partial<NonNullable<GameState['pendingSpellCast']>> = {}) {
      return {
        cardName: 'Roots Burst',
        effect: { type: 'aoe' as const, damage: 15 },
        startedAtMs: 0,
        resolvesAtMs: 5000,
        ...overrides,
      }
    }

    it('grades "avoid" when pressed early — reacting fast must never be punished', () => {
      // Regression: pressing with 3.5s left (1.5s elapsed) used to grade "full" (no
      // protection at all), letting a high-damage spell one-shot the commander anyway.
      const gs = makeGameState({ gameTime: 1500, pendingSpellCast: makeCast() })
      const state = withGameState(gs)

      const next = battleReducer(state, { type: 'COUNTER_SPELL' })

      expect(next.gameState!.pendingSpellCast!.counterGrade).toBe('avoid')
    })

    it('grades "avoid" when pressed anywhere before the 4.5s closing window', () => {
      const gs = makeGameState({ gameTime: 3000, pendingSpellCast: makeCast() })
      const state = withGameState(gs)

      const next = battleReducer(state, { type: 'COUNTER_SPELL' })

      expect(next.gameState!.pendingSpellCast!.counterGrade).toBe('avoid')
    })

    it('grades "halve" when pressed after 4.5s', () => {
      const gs = makeGameState({ gameTime: 4800, pendingSpellCast: makeCast() })
      const state = withGameState(gs)

      const next = battleReducer(state, { type: 'COUNTER_SPELL' })

      expect(next.gameState!.pendingSpellCast!.counterGrade).toBe('halve')
    })

    it('is a no-op when no cast is pending', () => {
      const state = withGameState(makeGameState({ pendingSpellCast: null }))

      const next = battleReducer(state, { type: 'COUNTER_SPELL' })

      expect(next).toBe(state)
    })

    it('is a no-op once the cast already has a grade', () => {
      const gs = makeGameState({ gameTime: 1000, pendingSpellCast: makeCast({ counterGrade: 'avoid' }) })
      const state = withGameState(gs)

      const next = battleReducer(state, { type: 'COUNTER_SPELL' })

      expect(next).toBe(state)
    })
  })

  // ── Invariants ─────────────────────────────────────────

  describe('immutability', () => {
    it('does not mutate the input state', () => {
      const gs = makeGameState()
      const state = withGameState(gs)
      const frozen = Object.freeze({ ...state, gameState: Object.freeze(gs) })

      // If the reducer mutates, this will throw in strict mode
      expect(() => battleReducer(frozen, { type: 'TICK' })).not.toThrow()
    })
  })
})
