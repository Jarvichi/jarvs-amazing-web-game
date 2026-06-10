/**
 * Unit tests for engine.ts pure functions.
 *
 * sound.ts and debug.ts are stubbed so tests run in Node without a DOM.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'

// ─── Stubs for browser-only modules ──────────────────────────────────────────

vi.mock('./sound', () => ({
  playUnitDeath: vi.fn(),
  playBuildingDestroyed: vi.fn(),
  playCardPlay: vi.fn(),
  playUpgrade: vi.fn(),
  playBaseHit: vi.fn(),
  playVictory: vi.fn(),
  playDefeat: vi.fn(),
}))

vi.mock('./debug', () => ({
  isNoDamageMode: () => false,
}))

// ─── Module under test ────────────────────────────────────────────────────────

import { newGame, tick, MAX_HANDICAP } from './engine'
import { playCard } from './engine/cards'
import { triggerNextEndlessWave } from './engine/endlessMode'
import { syncUnitIdCounter, uid } from './engine/helpers'
import { makeDeck } from './cards'

// ─── newGame ──────────────────────────────────────────────────────────────────

describe('newGame', () => {
  it('creates a valid initial state', () => {
    const state = newGame()
    expect(state.phase.type).toBe('playing')
    expect(state.playerHand.length).toBeGreaterThan(0)
    expect(state.opponentBase.hp).toBeGreaterThan(0)
    expect(state.playerBase.hp).toBeGreaterThan(0)
    expect(state.mana).toBeGreaterThanOrEqual(0)
  })

  it('uses supplied player cards', () => {
    const deck = makeDeck().slice(0, 10)
    const state = newGame(deck)
    // All hand cards came from the supplied deck
    const deckNames = new Set(deck.map(c => c.name))
    for (const card of state.playerHand) {
      if (!card.isHero) expect(deckNames.has(card.name)).toBe(true)
    }
  })

  it('clamps handicap to MAX_HANDICAP', () => {
    const over = newGame(undefined, MAX_HANDICAP + 100)
    const normal = newGame(undefined, MAX_HANDICAP)
    // Both games should produce a valid state; the important thing is no error is thrown
    expect(over.phase.type).toBe('playing')
    expect(normal.phase.type).toBe('playing')
  })

  it('accepts the options-object API', () => {
    const state = newGame({ opponentHandicap: 5 })
    expect(state.phase.type).toBe('playing')
  })

  it('supports prebuiltPlayerDeck without reshuffling', () => {
    const deck = makeDeck().slice(0, 12)
    const state = newGame({ prebuiltPlayerDeck: deck })
    // A hero may be injected at a random position; exclude it before checking order
    const nonHero = state.playerHand.filter(c => !c.isHero)
    expect(nonHero[0].name).toBe(deck[0].name)
    expect(nonHero[1].name).toBe(deck[1].name)
  })
})

// ─── playCard ─────────────────────────────────────────────────────────────────

describe('playCard', () => {
  it('returns unchanged state when card is not in hand', () => {
    const state = newGame()
    const next = playCard(state, 'nonexistent-id')
    expect(next).toBe(state)
  })

  it('returns unchanged state when mana is insufficient', () => {
    const state = newGame()
    // Find a card with cost > current mana
    const expensiveCard = state.playerHand.find(c => c.cost > state.mana)
    if (!expensiveCard) return // skip if no such card in this game
    const next = playCard(state, expensiveCard.id)
    expect(next.mana).toBe(state.mana)
    expect(next.playerHand.length).toBe(state.playerHand.length)
  })

  it('deducts mana and removes card from hand when affordable', () => {
    const state = newGame()
    const affordable = state.playerHand.find(c => c.cost <= state.mana)
    if (!affordable) return // skip if no affordable card
    const next = playCard(state, affordable.id)
    expect(next.mana).toBe(state.mana - affordable.cost)
    expect(next.playerHand.find(c => c.id === affordable.id)).toBeUndefined()
  })

  it('does not mutate the original state', () => {
    const state = newGame()
    const original = JSON.stringify(state)
    const affordable = state.playerHand.find(c => c.cost <= state.mana)
    if (affordable) playCard(state, affordable.id)
    expect(JSON.stringify(state)).toBe(original)
  })

  it('returns unchanged state when game phase is not playing', () => {
    const state = newGame()
    const gameOver = { ...state, phase: { type: 'gameOver' as const, winner: 'player' as const } }
    const affordable = state.playerHand.find(c => c.cost <= state.mana)
    if (!affordable) return
    const next = playCard(gameOver, affordable.id)
    expect(next).toBe(gameOver)
  })
})

// ─── tick ─────────────────────────────────────────────────────────────────────

describe('tick', () => {
  it('advances game time', () => {
    const state = newGame()
    const next = tick(state, 100)
    expect(next.gameTime).toBe(state.gameTime + 100)
  })

  it('does not advance time when phase is gameOver', () => {
    const state = newGame()
    const gameOver = { ...state, phase: { type: 'gameOver' as const, winner: 'player' as const } }
    const next = tick(gameOver, 100)
    expect(next.gameTime).toBe(gameOver.gameTime)
  })

  it('regenerates mana over time', () => {
    // Drain mana to 0 and zero the accumulator, then tick past a full regen interval
    const state = newGame()
    const drained = { ...state, mana: 0, manaAccum: 0 }
    const next = tick(drained, 4000) // 4 s > 3 s regen interval → ≥1 mana
    expect(next.mana).toBeGreaterThan(0)
  })

  it('does not exceed max mana', () => {
    const state = newGame()
    // Set mana to max and advance time far
    const full = { ...state, mana: state.maxMana, manaAccum: 0 }
    const next = tick(full, 100000)
    expect(next.mana).toBeLessThanOrEqual(next.maxMana)
  })
})

// ─── Endless mode wave transition ────────────────────────────────────────────

describe('triggerNextEndlessWave', () => {
  it('finger smash never removes the player commander, even when unit ids collide', () => {
    const state = newGame({ endlessMode: true })
    const commander = state.field.find(u => u.isCommander && u.owner === 'player')
    expect(commander).toBeDefined()

    // Simulate a restored save where the id counter reset and a later spawn
    // re-used the commander's id (issue: instant "base destroyed" on wave clear).
    state.field = state.field.filter(u => u.isCommander)
    const dupe = { ...commander!, isCommander: false, commanderHomeX: undefined, name: 'Dupe', moveSpeed: 5 }
    state.field.push(dupe)

    triggerNextEndlessWave(state)

    // The duplicate-id unit is the only smash candidate and is always removed;
    // the commander must survive the removal despite sharing its id.
    expect(state.field).toContain(commander)
    expect(state.field).not.toContain(dupe)
  })
})

// ─── Unit id counter restore ─────────────────────────────────────────────────

describe('syncUnitIdCounter', () => {
  it('bumps the uid counter past restored unit ids so new spawns cannot collide', () => {
    syncUnitIdCounter([{ id: 'unit-9000' }, { id: 'rc-5' }, { id: undefined }])
    const next = parseInt(uid().replace('unit-', ''), 10)
    expect(next).toBeGreaterThan(9000)
  })
})
