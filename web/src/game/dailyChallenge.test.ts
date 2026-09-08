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

  it('raises the mana cap to cover a costly card dealt into the opening hand', () => {
    // Regression: newGame() splices the opening hand out of playerDeck before it
    // measures the deck's top cost, so a card costing more than BASE_MAX_MANA in
    // the opening four left the gauge stuck at 5 and the card unplayable.
    const deck = getDailyPlayerDeck()
    const costly = deck.find(c => c.cost > 5)
    // Put the costly card first so it is guaranteed to land in the opening hand.
    const stacked = costly ? [costly, ...deck.filter(c => c !== costly)] : deck
    const topCost = Math.max(...stacked.map(c => c.cost))

    const state = newGame({ prebuiltPlayerDeck: stacked, isDailyChallenge: true })
    expect(state.maxMana).toBeGreaterThanOrEqual(Math.min(10, topCost))
  })

  it("today's deck never deals a card the mana gauge cannot reach", () => {
    const deck = getDailyPlayerDeck()
    const state = newGame({ prebuiltPlayerDeck: deck, isDailyChallenge: true })
    const unreachable = [...state.playerHand, ...state.playerDeck]
      .filter(c => c.cost > state.maxMana)
      .map(c => `${c.name} (${c.cost})`)
    expect(unreachable).toEqual([])
  })
})
