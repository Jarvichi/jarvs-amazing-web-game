import { describe, it, expect } from 'vitest'
import { checkBalance, type BalanceFlag } from './cardBalance'

/**
 * Guards the power-score formula ported from `rebalance_cards.py` (#2278):
 * a new or edited card whose cost drifts well off the formula fails the
 * build instead of sitting unnoticed until a player report, the way 960
 * cards' worth of drift did before this existed.
 *
 * Seeded with the 73 cards flagged in the catalog today. Each entry is
 * removed once its stats/cost are reconciled with the formula (or the
 * deviation is confirmed deliberate) — the list shrinking is the progress
 * bar, the same pattern `spriteClones.test.ts` (#2337) and
 * `pressFeedback.test.ts` use for their own backlogs.
 */
const ALLOWED_BALANCE_FLAGS = new Set<string>([
  'Aerial Volley',
  'Ballista',
  'Ballista Crew',
  'Bat',
  'Bone Archer',
  'Bone Colossus',
  'Candle Archer',
  'Candlebound Knight',
  'Canopy Archer',
  'Catapult',
  'Cave Bat',
  'Choir of the Remembered',
  'Chronomancer',
  'Cloud Hawk',
  'Court Writ',
  'Crystalline Shell',
  'Curfew Writ',
  'Deep Resilience',
  'Demolitions Expert',
  'Diadem Bearer',
  'Diadem Chanter',
  'Diadembound Knight',
  'Dreadnought',
  "Envoy's Writ",
  'Gale Warden',
  'Grove Writ',
  'Ice Colossus',
  'Inferno Surge',
  'Leviathan',
  'Lich Apprentice',
  'Mana Siphon',
  'Marshal Writ',
  'Mirror Writ',
  'Moss Golem',
  'Mushroom Hulk',
  'Necromancer',
  'Plague Shaman',
  'Prism Wyrm',
  'Procession Writ',
  'Regalia Courier',
  'Regalia Writ',
  'Rite Guard',
  'Rite Sentry',
  'Rite Vanguard',
  'Rite of Return',
  'Root Surge',
  'Sand Wyrm',
  'Sappers',
  'Shield Wall Soldier',
  'Siege Engineer',
  'Siege Protocol',
  'Soulrend Witch',
  'Spore Colossus',
  'Temporal Loop',
  'The Elder Warden',
  'The Vigil King',
  'Throne Archer',
  'Throne Runner',
  'Tide Dragon',
  'Void Titan',
  'Ward Courier',
  'Ward Guard',
  'Ward Herald',
  'Ward Vanguard',
  'Ward Writ',
  'Window Chanter',
  'Window Sentry',
  'Winter Writ',
  'Wizard',
  'Wraith',
  'Writ of Erasure',
  'Writ of Passage',
  'Writ of the Unharvested',
])

function describeFlag(f: BalanceFlag): string {
  return `[${f.part}] ${f.cardName}: ${f.detail}`
}

describe('card costs stay within tolerance of the balance formula', () => {
  const flags = checkBalance()
  const flaggedNames = new Set(flags.map(f => f.cardName))

  it('has no unlisted balance flag', () => {
    const unlisted = flags
      .filter(f => !ALLOWED_BALANCE_FLAGS.has(f.cardName))
      .map(describeFlag)
      .sort()

    expect(
      unlisted,
      'These cards drift from the power-score formula (see scripts/cardBalance.ts) — ' +
      'adjust the stats/cost to match, or add the card name to ALLOWED_BALANCE_FLAGS.',
    ).toEqual([])
  })

  it('keeps the exception list honest', () => {
    const stale = [...ALLOWED_BALANCE_FLAGS].filter(name => !flaggedNames.has(name))
    expect(stale, 'ALLOWED_BALANCE_FLAGS entries with no current balance flag').toEqual([])
  })
})
