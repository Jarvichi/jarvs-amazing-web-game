
// ─── Opponent AI ─────────────────────────────────────────

import { Card, GameState } from "../types"
import { BASE_MAX_MANA } from "./constants"
import { deployOpponentCard } from "./cards"
import { getManaBonus } from "./bonusEffects"
import { drawCard } from "./helpers"

/** Hero cards are locked for the first 30 s — same rule as the player. */
export function isPlayable(card: Card, gameTime: number): boolean {
  return !(card.isHero && gameTime < 30000)
}

export function opponentAI(s: GameState, log: string[]): void {
  const manaBonus = getManaBonus(s.field, 'opponent')
  const manaMult = s.endlessOpponentManaMult ?? 1
  // Floor mana to the most expensive card in hand so opponents can always play their cards
  const maxHandCost = s.opponentHand.reduce((m, c) => Math.max(m, c.cost), 0)
  let mana = Math.min(15, Math.round((Math.max(BASE_MAX_MANA, maxHandCost) + manaBonus) * manaMult))

  const strategy = s.opponentStrategy
  const wave = s.endlessMode ? (s.endlessWave ?? 1) : 1
  const baseMax = strategy === 'swarm' ? 3 : 2
  const maxPlays = Math.min(6, baseMax + Math.floor((wave - 1) / 2))
  // Early-stop chance after 1st card: 50% wave 1-2, 25% wave 3-4, 0% wave 5+
  const earlyStopChance = wave <= 2 ? 0.5 : wave <= 4 ? 0.25 : 0

  let played = 0
  while (played < maxPlays) {
    const affordable = s.opponentHand.filter(c => c.cost <= mana && isPlayable(c, s.gameTime))
    if (affordable.length === 0) break

    let preferred: Card[]
    if (strategy === 'swarm') {
      // Prefer cheap units; flood the board
      preferred = affordable.filter(c => c.cost <= 2 && c.cardType === 'unit')
    } else if (strategy === 'turtle') {
      // Prefer structures; be defensive
      preferred = affordable.filter(c => c.cardType === 'structure')
    } else {
      // rush: prefer expensive units
      preferred = affordable.filter(c => c.cost >= 3 && c.cardType !== 'structure')
    }
    const pool = preferred.length > 0 ? preferred : affordable

    const card = pool[Math.floor(Math.random() * pool.length)]
    s.opponentHand.splice(s.opponentHand.indexOf(card), 1)
    mana -= card.cost
    played++

    deployOpponentCard(s, card, log)
    drawCard(s.opponentDeck, s.opponentHand)

    // Turtle only plays 1 card per turn
    if (strategy === 'turtle') break
    // Others have a wave-scaled early-stop chance
    if (played === 1 && Math.random() < earlyStopChance) break
  }

  if (played === 0) log.push('Opponent holds.')
}