/**
 * Unit tests for the opponent spell-cast telegraph + Counter QTE mechanics
 * (deployOpponentCard / applyAoeDamage / resolveSpellCast) in engine/cards.ts.
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

import { newGame } from '../engine'
import { deployOpponentCard, applyAoeDamage, resolveSpellCast } from './cards'
import { CAST_WINDUP_MS } from './constants'
import { Card, GameState, PendingSpellCast } from '../types'

function makeAoeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'test-aoe-card',
    name: 'Roots Burst',
    rarity: 'common',
    cost: 3,
    cardType: 'upgrade',
    description: 'AOE damage spell',
    upgradeEffect: { type: 'aoe', damage: 15 },
    ...overrides,
  }
}

describe('deployOpponentCard', () => {
  it('telegraphs a damage-AOE card instead of applying damage immediately', () => {
    const s = newGame()
    const card = makeAoeCard()
    const log: string[] = []
    const playerCmd = s.field.find(u => u.isCommander && u.owner === 'player')!
    const hpBefore = playerCmd.hp

    deployOpponentCard(s, card, log)

    expect(s.pendingSpellCast).not.toBeNull()
    expect(s.pendingSpellCast!.cardName).toBe('Roots Burst')
    expect(s.pendingSpellCast!.resolvesAtMs).toBe(s.gameTime + CAST_WINDUP_MS)
    expect(s.pendingSpellCast!.counterGrade).toBeUndefined()
    // No damage applied yet — the commander is untouched
    expect(playerCmd.hp).toBe(hpBefore)
    expect(log.some(l => l.includes('Roots Burst'))).toBe(true)
  })

  it('resolves a second simultaneous cast immediately (single-flight guard)', () => {
    const s = newGame()
    const first = makeAoeCard({ id: 'first', name: 'First Spell' })
    const second = makeAoeCard({ id: 'second', name: 'Second Spell' })
    const log: string[] = []

    deployOpponentCard(s, first, log)
    expect(s.pendingSpellCast!.cardName).toBe('First Spell')

    const playerCmd = s.field.find(u => u.isCommander && u.owner === 'player')!
    const hpBefore = playerCmd.hp
    deployOpponentCard(s, second, log)

    // Still the first cast pending; the second resolved instantly via deployCard
    expect(s.pendingSpellCast!.cardName).toBe('First Spell')
    expect(playerCmd.hp).toBeLessThan(hpBefore)
  })

  it('deploys non-AOE cards immediately, unaffected by the telegraph path', () => {
    const s = newGame()
    const unitCard = s.opponentHand.find(c => c.cardType === 'unit')
    if (!unitCard) return // skip if opponent hand has no unit card this run
    const log: string[] = []
    const fieldCountBefore = s.field.length

    deployOpponentCard(s, unitCard, log)

    expect(s.pendingSpellCast).toBeNull()
    expect(s.field.length).toBeGreaterThan(fieldCountBefore)
  })
})

describe('applyAoeDamage', () => {
  it('scales damage by the multiplier and reports hit targets', () => {
    const s = newGame()
    const playerCmd = s.field.find(u => u.isCommander && u.owner === 'player')!
    const hpBefore = playerCmd.hp

    const { targets, dmg } = applyAoeDamage(s, { type: 'aoe', damage: 20 }, 'opponent', 0.5)

    expect(dmg).toBe(10)
    expect(targets).toContain(playerCmd)
    expect(playerCmd.hp).toBe(hpBefore - 10)
  })

  it('applies zero damage with a 0 multiplier (full counter)', () => {
    const s = newGame()
    const playerCmd = s.field.find(u => u.isCommander && u.owner === 'player')!
    const hpBefore = playerCmd.hp

    applyAoeDamage(s, { type: 'aoe', damage: 50 }, 'opponent', 0)

    expect(playerCmd.hp).toBe(hpBefore)
  })
})

describe('resolveSpellCast', () => {
  function withPendingCast(s: GameState, overrides: Partial<PendingSpellCast> = {}): void {
    s.pendingSpellCast = {
      cardName: 'Roots Burst',
      effect: { type: 'aoe', damage: 25 },
      startedAtMs: s.gameTime,
      resolvesAtMs: s.gameTime + CAST_WINDUP_MS,
      ...overrides,
    }
  }

  it('does nothing before the windup has elapsed', () => {
    const s = newGame()
    withPendingCast(s)
    const log: string[] = []

    resolveSpellCast(s, log)

    expect(s.pendingSpellCast).not.toBeNull()
    expect(log).toEqual([])
  })

  it('applies full damage once the windup elapses with no counter', () => {
    const s = newGame()
    const playerCmd = s.field.find(u => u.isCommander && u.owner === 'player')!
    const hpBefore = playerCmd.hp
    withPendingCast(s)
    s.gameTime = s.pendingSpellCast!.resolvesAtMs
    const log: string[] = []

    resolveSpellCast(s, log)

    expect(s.pendingSpellCast).toBeNull()
    expect(playerCmd.hp).toBe(hpBefore - 25)
    expect(s.lastPlayerDamageSource).toEqual({ kind: 'spell', name: 'Roots Burst' })
  })

  it('negates all damage when countered with grade "avoid"', () => {
    const s = newGame()
    const playerCmd = s.field.find(u => u.isCommander && u.owner === 'player')!
    const hpBefore = playerCmd.hp
    withPendingCast(s, { counterGrade: 'avoid' })
    s.gameTime = s.pendingSpellCast!.resolvesAtMs
    const log: string[] = []

    resolveSpellCast(s, log)

    expect(playerCmd.hp).toBe(hpBefore)
    expect(s.lastPlayerDamageSource).toBeUndefined()
    expect(log.some(l => l.includes('counter'))).toBe(true)
  })

  it('halves damage when countered with grade "halve"', () => {
    const s = newGame()
    const playerCmd = s.field.find(u => u.isCommander && u.owner === 'player')!
    const hpBefore = playerCmd.hp
    withPendingCast(s, { counterGrade: 'halve' })
    s.gameTime = s.pendingSpellCast!.resolvesAtMs
    const log: string[] = []

    resolveSpellCast(s, log)

    expect(playerCmd.hp).toBe(hpBefore - Math.round(25 * 0.5))
  })
})
