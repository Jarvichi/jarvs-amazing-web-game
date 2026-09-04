import { describe, it, expect } from 'vitest'
import {
  tierFromHandicap,
  nodeEnemyTier,
  effectiveTierFor,
  resolveEffectiveTier,
  resolvedNodeOpts,
} from './campaignHelpers'
import { QuestNode, Act } from './questline'

// ─── Fixtures ─────────────────────────────────────────────

function node(over: Partial<QuestNode> = {}): QuestNode {
  return {
    id: 'test-node',
    type: 'battle',
    label: 'Test',
    description: '',
    row: 0, col: 0, rowCols: 1,
    childIds: [],
    ...over,
  }
}

function act(over: Partial<Act> = {}): Act {
  return {
    id: 'test-act',
    title: 'Test Act',
    subtitle: '',
    rewardRelic: '',
    rewardRelicDesc: '',
    startNodeIds: [],
    nodes: {},
    ...over,
  } as Act
}

// ─── tierFromHandicap ─────────────────────────────────────

describe('tierFromHandicap', () => {
  it('maps the authored handicap range onto 1-5', () => {
    expect(tierFromHandicap(0)).toBe(1)
    expect(tierFromHandicap(7)).toBe(2)
    expect(tierFromHandicap(14)).toBe(3)
    expect(tierFromHandicap(21)).toBe(4)
    expect(tierFromHandicap(28)).toBe(5)
  })

  it('clamps to [1, 5] at both ends', () => {
    expect(tierFromHandicap(-100)).toBe(1)
    expect(tierFromHandicap(0)).toBe(1)
    expect(tierFromHandicap(1000)).toBe(5)
  })
})

describe('nodeEnemyTier', () => {
  it('prefers the authored enemyTier over the handicap fallback', () => {
    expect(nodeEnemyTier(node({ enemyTier: 4, handicap: 0 }))).toBe(4)
  })

  it('falls back to tierFromHandicap for un-migrated nodes', () => {
    expect(nodeEnemyTier(node({ handicap: 14 }))).toBe(tierFromHandicap(14))
  })

  it('treats a node with neither field as handicap 0', () => {
    expect(nodeEnemyTier(node())).toBe(1)
  })
})

// ─── effectiveTierFor ─────────────────────────────────────

describe('effectiveTierFor', () => {
  it('is a no-op when the player is exactly at the act\'s expected band', () => {
    expect(effectiveTierFor(3, 2, 2)).toBe(3)
  })

  it('raises tier when the player is above the expected band, up to +2', () => {
    expect(effectiveTierFor(2, 3, 2)).toBe(3)   // +1
    expect(effectiveTierFor(2, 4, 2)).toBe(4)   // +2
    expect(effectiveTierFor(2, 5, 2)).toBe(4)   // +3 clamped to +2
  })

  it('lowers tier by at most 1 when the player is below the expected band', () => {
    expect(effectiveTierFor(3, 1, 2)).toBe(2)   // -1
    expect(effectiveTierFor(3, 1, 4)).toBe(2)   // -3 clamped to -1
  })

  it('never returns a tier outside [1, 5]', () => {
    expect(effectiveTierFor(1, 1, 5)).toBe(1)    // deckDelta -1, floor at 1
    expect(effectiveTierFor(5, 5, 1)).toBe(5)    // deckDelta +2, ceiling at 5
    expect(effectiveTierFor(4, 5, 1)).toBe(5)    // 4 + 2 clamps to 5
  })
})

describe('resolveEffectiveTier', () => {
  it('defaults expectedBand to 1 when the act omits it', () => {
    const n = node({ enemyTier: 3 })
    expect(resolveEffectiveTier(n, act(), 1)).toBe(3)       // at expected band → no shift
    expect(resolveEffectiveTier(n, undefined, 1)).toBe(3)   // no act at all → same default
  })

  it('shifts using the act\'s declared expectedBand', () => {
    const n = node({ enemyTier: 2 })
    expect(resolveEffectiveTier(n, act({ expectedBand: 4 }), 4)).toBe(2)  // at band → no shift
    expect(resolveEffectiveTier(n, act({ expectedBand: 1 }), 4)).toBe(4)  // 3 bands over, capped +2
  })
})

// ─── resolvedNodeOpts: tier 2 regression guard ─────────────

describe('resolvedNodeOpts — tier 2 is the authored baseline', () => {
  it('produces the same battle-relevant values whether enemyTier is 2 or omitted (handicap-only)', () => {
    const withTier = node({
      handicap: 5, opponentBaseHp: 200, opponentIntervalMs: 5000, enemyTier: 2,
    })
    const withoutTier = node({
      handicap: 5, opponentBaseHp: 200, opponentIntervalMs: 5000,
    })
    const optsWithTier    = resolvedNodeOpts(withTier, act({ expectedBand: 1 }), 1, [])
    const optsWithoutTier = resolvedNodeOpts(withoutTier, act({ expectedBand: 1 }), 1, [])

    expect(optsWithTier.opponentBaseHp).toBe(200)
    expect(optsWithTier.opponentIntervalMs).toBe(5000)
    expect(optsWithTier.opponentStartCards).toBe(0)
    expect(optsWithTier.opponentManaFloorBonus).toBe(0)
    expect(optsWithTier.opponentMaxPlaysOverride).toBeUndefined()

    // Byte-identical to the pre-#2291 formula for every field that formula computed.
    expect(optsWithTier.opponentBaseHp).toBe(optsWithoutTier.opponentBaseHp)
    expect(optsWithTier.opponentIntervalMs).toBe(optsWithoutTier.opponentIntervalMs)
    expect(optsWithTier.opponentStartCards).toBe(optsWithoutTier.opponentStartCards)
    expect(optsWithTier.opponentHandicap).toBe(optsWithoutTier.opponentHandicap)
  })

  it('leaves a node with no opponentIntervalMs at undefined, exactly as before', () => {
    const n = node({ handicap: 0, opponentBaseHp: 100, enemyTier: 2 })
    const opts = resolvedNodeOpts(n, act({ expectedBand: 1 }), 1, [])
    expect(opts.opponentIntervalMs).toBeUndefined()
  })

  it('still applies enemyHpPercent/enemyIntervalReduction/enemyHandBonus modifiers unchanged at tier 2', () => {
    const n = node({ opponentBaseHp: 200, opponentIntervalMs: 5000, enemyTier: 2 })
    const opts = resolvedNodeOpts(n, act({ expectedBand: 1 }), 1, [
      { type: 'enemyHpPercent', value: 20, label: '' },
      { type: 'enemyIntervalReduction', value: 500, label: '' },
      { type: 'enemyHandBonus', value: 1, label: '' },
    ])
    expect(opts.opponentBaseHp).toBe(240)       // 200 * 1.2
    expect(opts.opponentIntervalMs).toBe(4500)  // 5000 - 500
    expect(opts.opponentStartCards).toBe(1)
  })
})

// ─── resolvedNodeOpts: tier effects ─────────────────────────

describe('resolvedNodeOpts — tier effects', () => {
  const base = node({ opponentBaseHp: 200, opponentIntervalMs: 5000 })

  it('tier 1 softens HP and slows the interval', () => {
    const opts = resolvedNodeOpts(node({ ...base, enemyTier: 1 }), act({ expectedBand: 1 }), 1, [])
    expect(opts.opponentBaseHp).toBe(180)        // 200 * 0.9
    expect(opts.opponentIntervalMs).toBe(5600)   // 5000 + 600
    expect(opts.opponentManaFloorBonus).toBe(0)
  })

  it('tier 3 speeds up the interval and adds a card', () => {
    const opts = resolvedNodeOpts(node({ ...base, enemyTier: 3 }), act({ expectedBand: 1 }), 1, [])
    expect(opts.opponentBaseHp).toBe(200)
    expect(opts.opponentIntervalMs).toBe(4600)   // 5000 - 400
    expect(opts.opponentStartCards).toBe(1)
    expect(opts.opponentManaFloorBonus).toBe(0)
  })

  it('tier 4 adds a mana floor bonus on top of more cards and a faster interval', () => {
    const opts = resolvedNodeOpts(node({ ...base, enemyTier: 4 }), act({ expectedBand: 1 }), 1, [])
    expect(opts.opponentIntervalMs).toBe(4200)   // 5000 - 800
    expect(opts.opponentStartCards).toBe(2)
    expect(opts.opponentManaFloorBonus).toBe(1)
    expect(opts.opponentMaxPlaysOverride).toBeUndefined()
  })

  it('tier 5 raises the opponent\'s per-turn play ceiling', () => {
    const opts = resolvedNodeOpts(node({ ...base, enemyTier: 5 }), act({ expectedBand: 1 }), 1, [])
    expect(opts.opponentIntervalMs).toBe(3800)   // 5000 - 1200
    expect(opts.opponentStartCards).toBe(2)
    expect(opts.opponentManaFloorBonus).toBe(2)
    expect(opts.opponentMaxPlaysOverride).toBe(4)
  })

  it('gives an un-migrated node with no opponentIntervalMs a 4000ms base before applying a non-zero tier delta', () => {
    const n = node({ opponentBaseHp: 200, enemyTier: 1 })
    const opts = resolvedNodeOpts(n, act({ expectedBand: 1 }), 1, [])
    expect(opts.opponentIntervalMs).toBe(4600) // 4000 + 600
  })

  it('floors the interval at 1000ms even under a large tier-5 reduction', () => {
    const n = node({ opponentIntervalMs: 1500, enemyTier: 5 })
    const opts = resolvedNodeOpts(n, act({ expectedBand: 1 }), 1, [])
    expect(opts.opponentIntervalMs).toBe(1000)
  })

  it('shifts the effective tier by the deck-power delta, not just the node\'s authored tier', () => {
    // A Tier IV band deck (rating ≥ 340) against an act expecting Tier I nets +2 → tier 3 effects on a tier-1 node.
    const strongDeck = new Array(20).fill(null).map((_, i) => ({
      id: `c${i}`, name: 'Whopper', rarity: 'legendary' as const, cost: 1, cardType: 'unit' as const, description: '',
      unit: { name: 'Whopper', attack: 50, maxHp: 200, isWall: false, bypassWall: false, moveSpeed: 60, attackRange: 30, attackCooldownMs: 300 },
    }))
    const n = node({ opponentBaseHp: 200, opponentIntervalMs: 5000, enemyTier: 1 })
    const opts = resolvedNodeOpts(n, act({ expectedBand: 1 }), 1, [], strongDeck)
    // tier 1 + deckDelta(+2, clamped) = 3 → interval -400, +1 start card
    expect(opts.opponentIntervalMs).toBe(4600)
    expect(opts.opponentStartCards).toBe(1)
  })
})
