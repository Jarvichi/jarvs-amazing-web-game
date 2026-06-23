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
    expect(s.pendingSpellCast!.counterPct).toBeUndefined()
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

  it('clamps damage to dmgCap when the raw damage exceeds it', () => {
    const s = newGame()
    const playerCmd = s.field.find(u => u.isCommander && u.owner === 'player')!
    const hpBefore = playerCmd.hp

    const { dmg } = applyAoeDamage(s, { type: 'aoe', damage: 180 }, 'opponent', 1, 10)

    expect(dmg).toBe(10)
    expect(playerCmd.hp).toBe(hpBefore - 10)
  })

  it('leaves damage unclamped when dmgCap exceeds the raw damage', () => {
    const s = newGame()
    const playerCmd = s.field.find(u => u.isCommander && u.owner === 'player')!
    const hpBefore = playerCmd.hp

    const { dmg } = applyAoeDamage(s, { type: 'aoe', damage: 15 }, 'opponent', 1, 20)

    expect(dmg).toBe(15)
    expect(playerCmd.hp).toBe(hpBefore - 15)
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

  it('caps damage at counterPct of commander max HP when countered quickly', () => {
    // Commander max HP is 50 by default, so a 0.2 cap is 10 — below the spell's raw 25.
    const s = newGame()
    const playerCmd = s.field.find(u => u.isCommander && u.owner === 'player')!
    const hpBefore = playerCmd.hp
    withPendingCast(s, { counterPct: 0.2 })
    s.gameTime = s.pendingSpellCast!.resolvesAtMs
    const log: string[] = []

    resolveSpellCast(s, log)

    expect(playerCmd.hp).toBe(hpBefore - 10)
    expect(s.lastPlayerDamageSource).toEqual({ kind: 'spell', name: 'Roots Burst' })
    expect(log.some(l => l.includes('counter'))).toBe(true)
  })

  it('caps damage at a higher counterPct of commander max HP when countered later', () => {
    // Commander max HP is 50 by default, so a 0.4 cap is 20 — below the spell's raw 25.
    const s = newGame()
    const playerCmd = s.field.find(u => u.isCommander && u.owner === 'player')!
    const hpBefore = playerCmd.hp
    withPendingCast(s, { counterPct: 0.4 })
    s.gameTime = s.pendingSpellCast!.resolvesAtMs
    const log: string[] = []

    resolveSpellCast(s, log)

    expect(playerCmd.hp).toBe(hpBefore - 20)
  })

  it('survives an otherwise one-shot spell when countered, but still takes some damage', () => {
    // "World's End" deals 180 damage — well above a full-health commander's max HP (50).
    // A counter must guarantee survival, but per design should never reduce damage to zero.
    const s = newGame()
    const playerCmd = s.field.find(u => u.isCommander && u.owner === 'player')!
    const hpBefore = playerCmd.hp
    withPendingCast(s, { cardName: "World's End", effect: { type: 'aoe', damage: 180 }, counterPct: 0.2 })
    s.gameTime = s.pendingSpellCast!.resolvesAtMs
    const log: string[] = []

    resolveSpellCast(s, log)

    expect(playerCmd.hp).toBeLessThan(hpBefore)
    expect(playerCmd.hp).toBeGreaterThan(0)
    expect(s.phase.type).not.toBe('gameOver')
  })

  it('rewards a quick counter with less damage than a late counter, on the same lethal spell', () => {
    const quick = newGame()
    const quickCmd = quick.field.find(u => u.isCommander && u.owner === 'player')!
    withPendingCast(quick, { cardName: "World's End", effect: { type: 'aoe', damage: 180 }, counterPct: 0.2 })
    quick.gameTime = quick.pendingSpellCast!.resolvesAtMs
    resolveSpellCast(quick, [])

    const late = newGame()
    const lateCmd = late.field.find(u => u.isCommander && u.owner === 'player')!
    withPendingCast(late, { cardName: "World's End", effect: { type: 'aoe', damage: 180 }, counterPct: 0.4 })
    late.gameTime = late.pendingSpellCast!.resolvesAtMs
    resolveSpellCast(late, [])

    const quickDmg = 50 - quickCmd.hp
    const lateDmg = 50 - lateCmd.hp
    expect(quickDmg).toBeLessThan(lateDmg)
    expect(quickCmd.hp).toBeGreaterThan(0)
    expect(lateCmd.hp).toBeGreaterThan(0)
  })

  it('applies full, uncapped damage on timeout even when the spell exceeds commander max HP', () => {
    // No press at all must remain undefended — 100% raw damage, never clamped to maxHp.
    const s = newGame()
    const playerCmd = s.field.find(u => u.isCommander && u.owner === 'player')!
    withPendingCast(s, { cardName: "World's End", effect: { type: 'aoe', damage: 180 } })
    s.gameTime = s.pendingSpellCast!.resolvesAtMs
    const log: string[] = []

    resolveSpellCast(s, log)

    expect(playerCmd.hp).toBe(playerCmd.maxHp - 180)
  })
})
