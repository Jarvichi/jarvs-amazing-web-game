/**
 * Reference decks, one per `DECK_POWER_BANDS` tier (see `src/game/deckPower.ts`),
 * for the balance harness's `BALANCE_DECK_BAND` axis (#2293).
 *
 * `balance-test.ts` always simulated with `makeDeck()` — a randomized "default"
 * deck — which measures player *skill* with deck *strength* held constant. That
 * is exactly the axis #2290 (the deck-power difficulty epic) is about: the
 * harness could not previously answer "is this node easy for a STRONG deck?"
 *
 * Each fixture is built the same way the real game builds a deck
 * (`buildDeckCards`), so mastery levels and the Siege Commander discount are
 * priced in exactly as they are for a player — not re-derived here. All five
 * assume the same mastery level (5, i.e. masteryXp 155 — `masteryLevel(xp) =
 * floor(log2(xp/5+1))`), so the tier a fixture reaches is a property of *what
 * cards it runs*, not of an arbitrarily higher mastery grind on the same deck.
 *
 * Structure decks bank most of their power in the unit a spawner emits, not
 * just the spawner's own stats — `buildDeckCards` looks up mastery for the
 * spawned unit's name separately from the structure's own name, so a fixture
 * that wants real structure-deck power needs mastery entries for both.
 */

import { buildDeckCards, STARTER_DECK, DeckEntry, CollectionEntry } from '../src/game/collection'
import { analyseDeckPower, DECK_POWER_BANDS } from '../src/game/deckPower'
import { Archetype, Card } from '../src/game/types'

/** Matches DEFAULTS.maxMana in playerStats.ts — scripts have no localStorage to read a real value from. */
const BASELINE_MAX_MANA = 5

/** masteryLevel(155) = 5 — a genuinely mastered card, not an absurd one. */
const MASTERY_XP = 155

function masteryFor(names: string[]): CollectionEntry[] {
  return names.map(cardName => ({ cardName, count: 4, masteryXp: MASTERY_XP }))
}

const MIXED_ENTRIES: DeckEntry[] = [
  { cardName: 'Barracks',       count: 4 },
  { cardName: 'Arcane Tower',   count: 4 },
  { cardName: 'Siege Works',    count: 4 },
  { cardName: 'Plague Den',     count: 3 },
  { cardName: 'Centaur Run',    count: 4 },
  { cardName: 'Shadow Academy', count: 3 },
  { cardName: 'Death Tower',    count: 4 },
  { cardName: 'Eel Trench',     count: 4 },
]
// The units Barracks/Arcane Tower/Siege Works spawn — the other four
// structures in MIXED_ENTRIES spawn units with no standalone card, so they
// have nothing to master beyond the structure itself.
const MIXED_SPAWN_NAMES = ['Goblin', 'Archer', 'Catapult']

const CHEAP_ENTRIES: DeckEntry[] = [
  { cardName: 'Barracks',     count: 4 },
  { cardName: 'Bat Cave',     count: 4 },
  { cardName: 'Fairy Ring',   count: 4 },
  { cardName: 'Bandit Camp',  count: 4 },
  { cardName: 'Scout Garden', count: 4 },
  { cardName: 'Wisp Grove',   count: 4 },
  { cardName: 'Air Sanctum',  count: 3 },
  { cardName: 'Tidal Spring', count: 3 },
]
const CHEAP_SPAWN_NAMES = ['Goblin', 'Bat', 'Pixie', 'Bandit', 'Pixie Scout', 'Mana Wisp', 'Air Sprite', 'Tide Sprite']

const MIXED_MASTERED_COLLECTION = [...masteryFor(MIXED_ENTRIES.map(e => e.cardName)), ...masteryFor(MIXED_SPAWN_NAMES)]
const CHEAP_MASTERED_COLLECTION = [...masteryFor(CHEAP_ENTRIES.map(e => e.cardName)), ...masteryFor(CHEAP_SPAWN_NAMES)]

export interface DeckFixture {
  /** DECK_POWER_BANDS tier this fixture is meant to land in — verified by validateFixtures(). */
  band: number
  name: string
  archetype?: Archetype
  build(): Card[]
}

export const DECK_FIXTURES: DeckFixture[] = [
  {
    band: 1,
    name: 'Starter deck (I RECRUIT)',
    build: () => buildDeckCards(STARTER_DECK),
  },
  {
    band: 2,
    name: 'Mixed spawners, unmastered (II SEASONED)',
    build: () => buildDeckCards(MIXED_ENTRIES),
  },
  {
    band: 3,
    name: 'Mixed spawners, mastered (III VETERAN)',
    build: () => buildDeckCards(MIXED_ENTRIES, MIXED_MASTERED_COLLECTION),
  },
  {
    band: 4,
    name: 'Mixed spawners, mastered + Siege Commander (IV ELITE)',
    archetype: 'siege_commander',
    build: () => buildDeckCards(MIXED_ENTRIES, MIXED_MASTERED_COLLECTION),
  },
  {
    band: 5,
    name: 'Cheap spawners, mastered + Siege Commander (V MYTHIC)',
    archetype: 'siege_commander',
    build: () => buildDeckCards(CHEAP_ENTRIES, CHEAP_MASTERED_COLLECTION),
  },
]

export function getFixture(band: number): DeckFixture | undefined {
  return DECK_FIXTURES.find(f => f.band === band)
}

/**
 * A fixture that has drifted out of its intended band (a card rebalance, a
 * mastery-formula change) would silently invalidate the sweep — the harness
 * would report "Tier IV is fine" while actually testing a Tier III deck.
 * Call this once before running any sweep; a non-empty result means stop.
 */
export function validateFixtures(): string[] {
  const problems: string[] = []
  for (const fixture of DECK_FIXTURES) {
    const analysis = analyseDeckPower(fixture.build(), { archetype: fixture.archetype, maxMana: BASELINE_MAX_MANA })
    if (analysis.band.tier !== fixture.band) {
      const wanted = DECK_POWER_BANDS.find(b => b.tier === fixture.band)?.name ?? `tier ${fixture.band}`
      problems.push(
        `"${fixture.name}" is meant to land in tier ${fixture.band} (${wanted}) but rates ${analysis.rating} ` +
        `→ ${analysis.band.name} (tier ${analysis.band.tier}). Update the fixture's cards/mastery in deckPowerFixtures.ts.`
      )
    }
  }
  return problems
}
