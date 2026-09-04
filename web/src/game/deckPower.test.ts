import { describe, it, expect } from 'vitest'
import { Card, UnitTemplate } from './types'
import { buildDeckCards, STARTER_DECK, CollectionEntry } from './collection'
import { getCardCatalog } from './cards'
import {
  DECK_POWER_BANDS,
  analyseDeckPower,
  cardPowerRatio,
  cardPowerScore,
  classifyDeckShape,
  deckPower,
  deckPowerBand,
  effectiveCost,
  medianScoreForCost,
  unitPowerScore,
} from './deckPower'

// ─── Fixtures ─────────────────────────────────────────────

function unit(over: Partial<UnitTemplate> = {}): UnitTemplate {
  return {
    name: 'Test Unit',
    attack: 3,
    maxHp: 10,
    isWall: false,
    bypassWall: false,
    moveSpeed: 45,
    attackRange: 5,
    attackCooldownMs: 1000,
    ...over,
  }
}

function card(over: Partial<Card> = {}): Card {
  return {
    id: 'test',
    name: 'Test Card',
    rarity: 'common',
    cost: 3,
    cardType: 'unit',
    description: '',
    unit: unit(),
    ...over,
  }
}

function deckOf(c: Card, count: number): Card[] {
  return Array.from({ length: count }, (_, i) => ({ ...c, id: `${c.id}-${i}` }))
}

// ─── Unit scoring ─────────────────────────────────────────

describe('unitPowerScore', () => {
  /**
   * balance_report.txt calibrates its divisor so this exact statline scores
   * ~30 (formula cost 1). If this drifts, the runtime rating and the
   * authoring-time balance pass have stopped agreeing on what "strong" means.
   */
  it('scores the calibration Goblin at the documented ~30', () => {
    const score = unitPowerScore(unit({ attack: 3, maxHp: 10, moveSpeed: 45, attackRange: 5, attackCooldownMs: 1000 }))
    expect(score).toBeGreaterThan(25)
    expect(score).toBeLessThan(32)
  })

  it('rises with attack, HP, speed and range', () => {
    const base = unitPowerScore(unit())
    expect(unitPowerScore(unit({ attack: 6 }))).toBeGreaterThan(base)
    expect(unitPowerScore(unit({ maxHp: 20 }))).toBeGreaterThan(base)
    expect(unitPowerScore(unit({ moveSpeed: 90 }))).toBeGreaterThan(base)
    expect(unitPowerScore(unit({ attackRange: 40 }))).toBeGreaterThan(base)
  })

  it('rises as the attack cooldown shortens', () => {
    expect(unitPowerScore(unit({ attackCooldownMs: 500 })))
      .toBeGreaterThan(unitPowerScore(unit({ attackCooldownMs: 2000 })))
  })

  it('does not divide by zero on a zero cooldown', () => {
    expect(Number.isFinite(unitPowerScore(unit({ attackCooldownMs: 0 })))).toBe(true)
  })
})

describe('medianScoreForCost', () => {
  it('is monotonic in cost', () => {
    for (let c = 1; c < 8; c++) {
      expect(medianScoreForCost(c + 1)).toBeGreaterThan(medianScoreForCost(c))
    }
  })

  it('tracks the tier medians in balance_report.txt', () => {
    // Report medians: cost 1 → 30.3, cost 3 → 70.8, cost 5 → 106.0.
    expect(medianScoreForCost(1)).toBeCloseTo(30.3, 1)
    expect(medianScoreForCost(3)).toBeGreaterThan(65)
    expect(medianScoreForCost(3)).toBeLessThan(78)
    expect(medianScoreForCost(5)).toBeGreaterThan(98)
    expect(medianScoreForCost(5)).toBeLessThan(118)
  })
})

// ─── Card shapes the unit formula would misprice ──────────

describe('cardPowerScore card shapes', () => {
  it('prices a wall on what it absorbs rather than as a fighter', () => {
    const weak   = card({ cardType: 'structure', unit: unit({ isWall: true, attack: 0, moveSpeed: 0, maxHp: 30 }) })
    const strong = card({ cardType: 'structure', unit: unit({ isWall: true, attack: 0, moveSpeed: 0, maxHp: 120 }) })
    expect(cardPowerScore(weak)).toBeGreaterThan(0)
    expect(cardPowerScore(strong)).toBeGreaterThan(cardPowerScore(weak))
  })

  /**
   * Moats set maxHp to a 9999 sentinel meaning "indestructible", not real
   * durability. Scoring that as HP made Spike Pit read as the strongest card
   * in the game during calibration.
   */
  it('ignores the indestructible-moat HP sentinel', () => {
    const moat = card({
      cost: 2,
      cardType: 'structure',
      unit: unit({
        isMoat: true, attack: 0, moveSpeed: 0, maxHp: 9999, attackRange: 0, attackCooldownMs: 0,
        structureEffect: { type: 'slowZone', slowFactor: 0.5, radius: 24, damagePerSec: 12 },
      }),
    })
    // Comfortably below a real cost-2 card's worth of a hundred-odd points.
    expect(cardPowerScore(moat)).toBeLessThan(medianScoreForCost(2) * 3)
  })

  it('gives a pure spawner no phantom combat score for its zero attack', () => {
    const inert = card({ cardType: 'structure', unit: unit({ attack: 0, moveSpeed: 0, maxHp: 25, attackRange: 0, attackCooldownMs: 0 }) })
    expect(cardPowerScore(inert)).toBeCloseTo(cardPowerScore(card({
      cardType: 'structure',
      unit: unit({ attack: 0, moveSpeed: 0, maxHp: 25, attackRange: 500, attackCooldownMs: 0 }),
    })), 5)
  })
})

// ─── Permanents ───────────────────────────────────────────

describe('spawner scoring', () => {
  function spawner(intervalMs: number, spawn = unit()): Card {
    return card({
      cardType: 'structure',
      unit: unit({ attack: 0, moveSpeed: 0, maxHp: 25, structureEffect: { type: 'spawn', unitTemplate: spawn, intervalMs } }),
    })
  }

  it('values a spawner above the single unit it emits', () => {
    expect(cardPowerScore(spawner(7000))).toBeGreaterThan(unitPowerScore(unit()))
  })

  it('rises as the spawn interval shortens — this is how mastery shows up', () => {
    expect(cardPowerScore(spawner(4000))).toBeGreaterThan(cardPowerScore(spawner(7000)))
  })

  it('rises with the strength of the unit emitted — this is how augments show up', () => {
    expect(cardPowerScore(spawner(7000, unit({ attack: 9, maxHp: 30 }))))
      .toBeGreaterThan(cardPowerScore(spawner(7000)))
  })

  it('applies diminishing returns rather than scaling linearly with rate', () => {
    const slow = cardPowerScore(spawner(8000))
    const fast = cardPowerScore(spawner(1000))
    expect(fast).toBeGreaterThan(slow)
    expect(fast).toBeLessThan(slow * 8)
  })
})

describe('mana structures', () => {
  it('prices a +1 mana structure near its cost curve', () => {
    const farm = card({ cost: 3, cardType: 'structure', unit: unit({ attack: 0, moveSpeed: 0, maxHp: 20, structureEffect: { type: 'mana', amount: 1 } }) })
    expect(cardPowerRatio(farm)).toBeGreaterThan(0.7)
    expect(cardPowerRatio(farm)).toBeLessThan(1.4)
  })
})

// ─── Cost, archetype and castability ──────────────────────

describe('effectiveCost', () => {
  it('discounts structures for the Siege Commander only', () => {
    const structure = card({ cardType: 'structure', cost: 4 })
    expect(effectiveCost(structure, 'siege_commander')).toBe(3)
    expect(effectiveCost(structure, 'swarm_tactician')).toBe(4)
    expect(effectiveCost(card({ cardType: 'unit', cost: 4 }), 'siege_commander')).toBe(4)
  })

  it('never floors below 1', () => {
    expect(effectiveCost(card({ cardType: 'structure', cost: 1 }), 'siege_commander')).toBe(1)
  })
})

describe('cardPowerRatio', () => {
  it('reads ~1.0 for a card sitting on its cost curve', () => {
    const onCurve = card({ cost: 1, cardType: 'unit', unit: unit() })
    expect(cardPowerRatio(onCurve)).toBeGreaterThan(0.8)
    expect(cardPowerRatio(onCurve)).toBeLessThan(1.2)
  })

  it('discounts a card the player cannot afford to cast', () => {
    const bomb = card({ cost: 8 })
    expect(cardPowerRatio(bomb, { maxMana: 5 })).toBeLessThan(cardPowerRatio(bomb))
  })

  it('counts a cost discount as extra efficiency', () => {
    const structure = card({ cardType: 'structure', cost: 4 })
    expect(cardPowerRatio(structure, { archetype: 'siege_commander' }))
      .toBeGreaterThan(cardPowerRatio(structure))
  })
})

// ─── Deck scoring ─────────────────────────────────────────

describe('analyseDeckPower', () => {
  it('returns a zeroed breakdown for an empty deck', () => {
    const a = analyseDeckPower([])
    expect(a.rating).toBe(0)
    expect(a.band).toBe(DECK_POWER_BANDS[0])
    expect(a.topCards).toEqual([])
  })

  it('rewards redundancy — the same cards across fewer names draw better', () => {
    const c = card({ cost: 3 })
    const focused = deckOf(c, 20)
    const spread  = Array.from({ length: 20 }, (_, i) => ({ ...c, id: `s${i}`, name: `Card ${i}` }))
    expect(deckPower(focused)).toBeGreaterThan(deckPower(spread))
  })

  it('does not reward deck size on its own', () => {
    const c = card({ cost: 3 })
    expect(deckPower(deckOf(c, 30))).toBe(deckPower(deckOf(c, 12)))
  })

  it('reports the strongest cards, best first', () => {
    const weak   = card({ id: 'w', name: 'Weak',   cost: 6, unit: unit({ attack: 1, maxHp: 4 }) })
    const strong = card({ id: 's', name: 'Strong', cost: 1, unit: unit({ attack: 12, maxHp: 60 }) })
    const a = analyseDeckPower([...deckOf(weak, 4), ...deckOf(strong, 4)])
    expect(a.topCards[0].name).toBe('Strong')
    expect(a.topCards[0].ratio).toBeGreaterThan(a.topCards[1].ratio)
    expect(a.uniqueCount).toBe(2)
    expect(a.cardCount).toBe(8)
  })
})

describe('deckPowerBand', () => {
  it('is ordered and starts at zero', () => {
    expect(DECK_POWER_BANDS[0].min).toBe(0)
    for (let i = 1; i < DECK_POWER_BANDS.length; i++) {
      expect(DECK_POWER_BANDS[i].min).toBeGreaterThan(DECK_POWER_BANDS[i - 1].min)
      expect(DECK_POWER_BANDS[i].tier).toBe(DECK_POWER_BANDS[i - 1].tier + 1)
    }
  })

  it('picks the highest band the rating reaches', () => {
    for (const b of DECK_POWER_BANDS) expect(deckPowerBand(b.min).tier).toBe(b.tier)
    expect(deckPowerBand(-50).tier).toBe(1)
    expect(deckPowerBand(999_999).tier).toBe(DECK_POWER_BANDS[DECK_POWER_BANDS.length - 1].tier)
  })
})

// ─── Calibration against real game data ───────────────────

describe('calibration against the real card catalogue', () => {
  const starter = buildDeckCards(STARTER_DECK)

  /**
   * The rating scale is anchored here: the deck every player begins with is
   * the definition of "ordinary", so it must read ~100 and sit in the bottom
   * band. Retuning any constant in deckPower.ts without moving this is the
   * signal that the retune changed the scale rather than the ranking.
   */
  it('rates the starter deck at roughly 100, in the bottom band', () => {
    const a = analyseDeckPower(starter, { maxMana: 5 })
    expect(a.rating).toBeGreaterThan(70)
    expect(a.rating).toBeLessThan(130)
    expect(a.band.tier).toBe(1)
  })

  /**
   * The case the rating exists for: a mature player's cheap-spawner deck —
   * max copies of the best engines, mastered, under the archetype that
   * discounts them. Taken from a real save that walks the campaign.
   */
  it('puts a mastered cheap-spawner deck in the top bands', () => {
    const entries = [
      { cardName: 'Barracks',     count: 4 },
      { cardName: 'Bat Cave',     count: 4 },
      { cardName: 'Fairy Ring',   count: 4 },
      { cardName: 'Bandit Camp',  count: 4 },
      { cardName: 'Scout Garden', count: 4 },
      { cardName: 'Wisp Grove',   count: 4 },
      { cardName: 'Air Sanctum',  count: 3 },
      { cardName: 'Tidal Spring', count: 3 },
    ]
    // masteryLevel(xp) = floor(log2(xp/5 + 1)); 155 extra copies is level 5.
    const collection: CollectionEntry[] = entries.map(e => ({ ...e, masteryXp: 155 }))
    const a = analyseDeckPower(buildDeckCards(entries, collection), {
      archetype: 'siege_commander',
      maxMana: 5,
    })
    expect(a.rating).toBeGreaterThan(analyseDeckPower(starter, { maxMana: 5 }).rating * 4)
    expect(a.band.tier).toBeGreaterThanOrEqual(4)
  })

  it('raises the rating of the same deck as its cards gain mastery', () => {
    const deck = [{ cardName: 'Barracks', count: 4 }, { cardName: 'Fairy Ring', count: 4 }]
    // masteryLevel(xp) = floor(log2(xp/5 + 1)); 155 extra copies is level 5.
    const mastered: CollectionEntry[] = [
      { cardName: 'Barracks',   count: 4, masteryXp: 155 },
      { cardName: 'Fairy Ring', count: 4, masteryXp: 155 },
    ]
    expect(deckPower(buildDeckCards(deck, mastered)))
      .toBeGreaterThan(deckPower(buildDeckCards(deck)))
  })

  it('raises a structure deck under the Siege Commander discount', () => {
    const deck = buildDeckCards([{ cardName: 'Barracks', count: 4 }, { cardName: 'Fairy Ring', count: 4 }])
    expect(deckPower(deck, { archetype: 'siege_commander' })).toBeGreaterThan(deckPower(deck))
  })

  it('gives every catalogue card a finite, positive score', () => {
    // Guards against a card shape (new effect type, odd statline) scoring
    // NaN or Infinity and silently poisoning every deck rating.
    for (const c of getCardCatalog()) {
      const score = cardPowerScore(c)
      expect(Number.isFinite(score), `${c.name} scored ${score}`).toBe(true)
      expect(score, `${c.name} scored ${score}`).toBeGreaterThan(0)
    }
  })
})

// ─── classifyDeckShape (#2292) ─────────────────────────────

describe('classifyDeckShape', () => {
  it('calls an empty deck balanced rather than throwing', () => {
    expect(classifyDeckShape([])).toBe('balanced')
  })

  it('classifies a structure-heavy deck as structure — the god-deck shape', () => {
    const deck = buildDeckCards([
      { cardName: 'Barracks', count: 4 }, { cardName: 'Bat Cave', count: 4 },
      { cardName: 'Fairy Ring', count: 4 }, { cardName: 'Bandit Camp', count: 4 },
    ])
    expect(classifyDeckShape(deck)).toBe('structure')
  })

  it('classifies a deck of mostly cost ≤2 units as swarm', () => {
    const deck = buildDeckCards([{ cardName: 'Goblin', count: 4 }, { cardName: 'Archer', count: 4 }])
    expect(classifyDeckShape(deck)).toBe('swarm')
  })

  it('classifies a high-average-cost deck as bigUnit', () => {
    const deck: Card[] = getCardCatalog()
      .filter(c => c.cardType === 'unit' && c.cost >= 5)
      .slice(0, 10)
    expect(deck.length).toBeGreaterThan(0)
    expect(classifyDeckShape(deck)).toBe('bigUnit')
  })

  it('falls back to balanced for a deck fitting no dominant plan', () => {
    // A genuine curve: no structure majority, no cheap-unit majority, no high average cost.
    const deck = buildDeckCards([
      { cardName: 'Barracks', count: 2 },   // structure, but nowhere near the 40% threshold
      { cardName: 'Knight', count: 4 },     // cost 3+ — not a swarm unit
      { cardName: 'Wizard', count: 4 },
      { cardName: 'Sharpen Blades', count: 2 },
    ])
    expect(classifyDeckShape(deck)).toBe('balanced')
  })

  it('prioritises structure over bigUnit when a deck is both expensive and structure-heavy', () => {
    // Siege Works (cost 4) + Death Tower (cost 4): 100% structure AND avg cost 4 — still 'structure'.
    const deck = buildDeckCards([{ cardName: 'Siege Works', count: 4 }, { cardName: 'Death Tower', count: 4 }])
    expect(classifyDeckShape(deck)).toBe('structure')
  })
})
