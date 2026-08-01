import { describe, it, expect } from 'vitest'
import { getDailyPlayerDeck, getDailyOpponentDeck } from './dailyChallenge'
import { newGame } from './engine'
import { SECRET_RARITIES } from './types'

// Nobody picks the daily challenge's decks — the game deals both sides. So the
// same rule generated opponent decks follow (maxRarityForHandicap in engine.ts
// caps at legendary) and Quick Play follows (App.tsx filters SECRET_RARITIES
// out of its opponent pool) has to hold here too. It didn't: buildChallengeCards
// shuffled the whole catalog, so a mythic could be dealt to either side.

describe('daily challenge decks', () => {
  const decks = { player: getDailyPlayerDeck(), opponent: getDailyOpponentDeck() }

  it.each(Object.entries(decks))('the %s deck contains no secret-rarity cards', (_side, deck) => {
    expect(deck.length).toBeGreaterThan(0)
    expect(deck.filter(c => SECRET_RARITIES.has(c.rarity)).map(c => c.name)).toEqual([])
  })

  it.each(Object.entries(decks))('no card in the %s deck can one-shot a starting commander', (_side, deck) => {
    // A unit's attack lands with no counterplay — unlike an enemy spell, which
    // the Counter QTE caps at a fraction of commander max HP (resolveSpellCast
    // in engine/cards.ts). A single hit ending the battle is therefore only ever
    // something a player should be able to opt into with a card they earned.
    const startingCommanderHp = newGame({}).playerBase.maxHp
    const oneShotters = deck
      .filter(c => (c.unit?.attack ?? 0) >= startingCommanderHp)
      .map(c => `${c.name} (${c.unit?.attack} atk vs ${startingCommanderHp} hp)`)
    expect(oneShotters).toEqual([])
  })
})
