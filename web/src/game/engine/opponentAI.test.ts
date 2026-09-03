/**
 * Unit tests for opponentAI.ts's tier-scaled behaviour (#2295).
 * sound.ts and debug.ts are stubbed so newGame()/tick() run in Node — same
 * pattern as engine.test.ts.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../sound', () => ({
  playUnitDeath: vi.fn(),
  playBuildingDestroyed: vi.fn(),
  playCardPlay: vi.fn(),
  playUpgrade: vi.fn(),
  playBaseHit: vi.fn(),
  playVictory: vi.fn(),
  playDefeat: vi.fn(),
}))

vi.mock('../debug', () => ({
  isNoDamageMode: () => false,
}))

import { threatResponsePool, opponentAI } from './opponentAI'
import { newGame } from '../engine'
import { Card, Unit } from '../types'

function unit(over: Partial<Unit> = {}): Unit {
  return {
    id: 'u', owner: 'player', name: 'Test', attack: 5, maxHp: 20, hp: 20,
    isWall: false, bypassWall: false, moveSpeed: 40, attackRange: 5, attackCooldownMs: 1000,
    x: 100, y: 0, attackTimer: 0,
    ...over,
  }
}

function card(over: Partial<Card> = {}): Card {
  return {
    id: 'c', name: 'Test Card', rarity: 'common', cost: 2, cardType: 'unit', description: '',
    ...over,
  }
}

// ─── threatResponsePool ─────────────────────────────────────

describe('threatResponsePool', () => {
  const structureCard = card({ id: 's', cardType: 'structure' })
  const aoeCard = card({ id: 'a', cardType: 'upgrade', upgradeEffect: { type: 'aoe', damage: 10 } })
  const plainUnitCard = card({ id: 'p', cardType: 'unit' })
  const siegeCard = card({ id: 'g', cardType: 'unit', unit: { name: 'Siege', attack: 5, maxHp: 20, isWall: false, bypassWall: false, moveSpeed: 10, attackRange: 5, attackCooldownMs: 1000, targetPriority: 'buildings' } })

  it('returns null on a quiet field — no threat to answer', () => {
    const field = [unit({ id: 'p1' }), unit({ id: 'o1', owner: 'opponent' })]
    expect(threatResponsePool([structureCard, aoeCard, plainUnitCard], field)).toBeNull()
  })

  it('prefers structures/AOE when player mobile units outnumber the opponent\'s by the swarm margin', () => {
    const field = [
      unit({ id: 'p1' }), unit({ id: 'p2' }), unit({ id: 'p3' }), unit({ id: 'p4' }),
      unit({ id: 'o1', owner: 'opponent' }),
    ]
    const pool = threatResponsePool([structureCard, aoeCard, plainUnitCard], field)
    expect(pool).not.toBeNull()
    expect(pool).toContain(structureCard)
    expect(pool).toContain(aoeCard)
    expect(pool).not.toContain(plainUnitCard)
  })

  it('prefers siege/bypassWall cards when the player has fielded enough structures', () => {
    const field = [
      unit({ id: 'p1', moveSpeed: 0 }), unit({ id: 'p2', moveSpeed: 0 }), unit({ id: 'p3', moveSpeed: 0 }),
    ]
    const pool = threatResponsePool([siegeCard, plainUnitCard], field)
    expect(pool).toEqual([siegeCard])
  })

  it('ignores dead units and walls when counting structures', () => {
    const field = [
      unit({ id: 'p1', moveSpeed: 0, hp: 0 }),        // dead — doesn't count
      unit({ id: 'p2', moveSpeed: 0, isWall: true }),  // wall — doesn't count as a structure threat
      unit({ id: 'p3', moveSpeed: 0 }),
    ]
    expect(threatResponsePool([siegeCard], field)).toBeNull()
  })

  it('falls back to null when the threat is real but no card in hand answers it', () => {
    const field = [unit({ id: 'p1' }), unit({ id: 'p2' }), unit({ id: 'p3' }), unit({ id: 'p4' })]
    expect(threatResponsePool([plainUnitCard], field)).toBeNull()
  })
})

// ─── opponentAI tier gating ──────────────────────────────────

describe('opponentAI — tier gating', () => {
  it('caps turtle at one play when opponentTier is undefined (unaffected outside campaign)', () => {
    const state = newGame()
    state.opponentStrategy = 'turtle'
    state.opponentTier = undefined
    const structureA = card({ id: 'h1', cost: 1, cardType: 'structure', unit: { name: 'A', attack: 0, maxHp: 10, isWall: false, bypassWall: false, moveSpeed: 0, attackRange: 0, attackCooldownMs: 0 } })
    const structureB = card({ id: 'h2', cost: 1, cardType: 'structure', unit: { name: 'B', attack: 0, maxHp: 10, isWall: false, bypassWall: false, moveSpeed: 0, attackRange: 0, attackCooldownMs: 0 } })
    state.opponentHand = [structureA, structureB]
    const fieldBefore = state.field.filter(u => u.owner === 'opponent').length
    const log: string[] = []
    opponentAI(state, log)
    const fieldAfter = state.field.filter(u => u.owner === 'opponent').length
    expect(fieldAfter - fieldBefore).toBe(1)
  })

  it('lets turtle play up to two cards at tier 3+', () => {
    const state = newGame()
    state.opponentStrategy = 'turtle'
    state.opponentTier = 3
    const structureA = card({ id: 'h1', cost: 1, cardType: 'structure', unit: { name: 'A', attack: 0, maxHp: 10, isWall: false, bypassWall: false, moveSpeed: 0, attackRange: 0, attackCooldownMs: 0 } })
    const structureB = card({ id: 'h2', cost: 1, cardType: 'structure', unit: { name: 'B', attack: 0, maxHp: 10, isWall: false, bypassWall: false, moveSpeed: 0, attackRange: 0, attackCooldownMs: 0 } })
    state.opponentHand = [structureA, structureB]
    const fieldBefore = state.field.filter(u => u.owner === 'opponent').length
    const log: string[] = []
    opponentAI(state, log)
    const fieldAfter = state.field.filter(u => u.owner === 'opponent').length
    expect(fieldAfter - fieldBefore).toBe(2)
  })

  it('picks the highest-cost affordable card at tier 4+, not a random one', () => {
    const state = newGame()
    state.opponentStrategy = 'rush'
    state.opponentTier = 4
    const cheap = card({ id: 'cheap', cost: 3, cardType: 'unit', unit: { name: 'Cheap', attack: 3, maxHp: 10, isWall: false, bypassWall: false, moveSpeed: 30, attackRange: 5, attackCooldownMs: 1000 } })
    const strong = card({ id: 'strong', cost: 5, cardType: 'unit', unit: { name: 'Strong', attack: 10, maxHp: 30, isWall: false, bypassWall: false, moveSpeed: 30, attackRange: 5, attackCooldownMs: 1000 } })
    state.opponentHand = [cheap, strong]
    const log: string[] = []
    opponentAI(state, log)
    // The strong (higher-cost) card should have been played — cheap remains in hand.
    expect(state.opponentHand.find(c => c.id === 'strong')).toBeUndefined()
  })

  it('never has a chance to stop after one card at tier 5', () => {
    const originalRandom = Math.random
    Math.random = () => 0.01 // would trigger the wave 1-2 50% early-stop if it applied
    try {
      const state = newGame()
      state.opponentStrategy = 'rush'
      state.opponentTier = 5
      const a = card({ id: 'a', cost: 1, cardType: 'unit', unit: { name: 'A', attack: 3, maxHp: 10, isWall: false, bypassWall: false, moveSpeed: 30, attackRange: 5, attackCooldownMs: 1000 } })
      const b = card({ id: 'b', cost: 1, cardType: 'unit', unit: { name: 'B', attack: 3, maxHp: 10, isWall: false, bypassWall: false, moveSpeed: 30, attackRange: 5, attackCooldownMs: 1000 } })
      state.opponentHand = [a, b]
      const fieldBefore = state.field.filter(u => u.owner === 'opponent').length
      const log: string[] = []
      opponentAI(state, log)
      const fieldAfter = state.field.filter(u => u.owner === 'opponent').length
      expect(fieldAfter - fieldBefore).toBeGreaterThan(1)
    } finally {
      Math.random = originalRandom
    }
  })
})
