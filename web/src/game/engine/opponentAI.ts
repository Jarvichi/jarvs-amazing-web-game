
// ─── Opponent AI ─────────────────────────────────────────

import { Card, GameState, Unit } from "../types"
import { BASE_MAX_MANA } from "./constants"
import { deployOpponentCard } from "./cards"
import { getManaBonus } from "./bonusEffects"
import { drawCard } from "./helpers"

/** Hero cards are locked for the first 30 s — same rule as the player. */
export function isPlayable(card: Card, gameTime: number): boolean {
  return !(card.isHero && gameTime < 30000)
}

// ─── Tier-scaled field response (#2295) ────────────────────
//
// Gated on GameState.opponentTier (campaign only — see effectiveTier in
// campaignHelpers.ts). Absent/undefined everywhere else (Quick Battle,
// endless mode, daily/weekly challenges), so every threshold below reads
// `tier >= N` against `undefined`, which is always false — none of this
// changes those modes' behaviour.

/** Player units this many ahead of the opponent's own mobile count reads as a real swarm, not noise. */
const SWARM_THREAT_MARGIN = 3
/** This many player structures on the field is enough to be worth specifically punishing. */
const STRUCTURE_THREAT_COUNT = 3

/**
 * At tier 3+, bias the card pool toward answering what's actually on the
 * field, ahead of the strategy-driven bucket below. Returns null (falls
 * through to the strategy bucket) when neither threat is present, so a
 * quiet early-game field doesn't force a specific card type.
 */
export function threatResponsePool(affordable: Card[], field: Unit[]): Card[] | null {
  const playerMobile   = field.filter(u => u.owner === 'player'   && u.hp > 0 && u.moveSpeed > 0).length
  const opponentMobile = field.filter(u => u.owner === 'opponent' && u.hp > 0 && u.moveSpeed > 0).length
  const playerStructures = field.filter(u => u.owner === 'player' && u.hp > 0 && u.moveSpeed === 0 && !u.isWall).length

  if (playerMobile - opponentMobile >= SWARM_THREAT_MARGIN) {
    const swarmAnswers = affordable.filter(c =>
      c.cardType === 'structure' || (c.cardType === 'upgrade' && c.upgradeEffect?.type === 'aoe')
    )
    if (swarmAnswers.length > 0) return swarmAnswers
  }

  if (playerStructures >= STRUCTURE_THREAT_COUNT) {
    const siegeAnswers = affordable.filter(c =>
      c.unit?.targetPriority === 'buildings' || c.unit?.bypassWall
    )
    if (siegeAnswers.length > 0) return siegeAnswers
  }

  return null
}

export function opponentAI(s: GameState, log: string[]): void {
  const manaBonus = getManaBonus(s.field, 'opponent')
  const manaMult = s.endlessOpponentManaMult ?? 1
  // Floor mana to the most expensive card in hand so opponents can always play their cards.
  // opponentManaFloorBonus (campaign tier 4+, see effectiveTier in campaignHelpers.ts) raises
  // that floor further — absent/0 everywhere else, so this is a no-op outside high-tier nodes.
  const maxHandCost = s.opponentHand.reduce((m, c) => Math.max(m, c.cost), 0)
  const manaFloor = Math.max(BASE_MAX_MANA, maxHandCost) + (s.opponentManaFloorBonus ?? 0)
  let mana = Math.min(15, Math.round((manaFloor + manaBonus) * manaMult))

  const strategy = s.opponentStrategy
  const wave = s.endlessMode ? (s.endlessWave ?? 1) : 1
  const baseMax = strategy === 'swarm' ? 3 : 2
  // opponentMaxPlaysOverride (campaign tier 5) raises the ceiling rather than
  // replacing it — a swarm/late-wave opponent that already exceeds it keeps
  // its own higher cap.
  const maxPlays = Math.min(6, Math.max(s.opponentMaxPlaysOverride ?? 0, baseMax + Math.floor((wave - 1) / 2)))
  // Early-stop chance after 1st card: 50% wave 1-2, 25% wave 3-4, 0% wave 5+.
  // Tier 5 drops this to 0 regardless of wave — a fight worth fielding a
  // burst-capable opponent for isn't one that should coin-flip into fizzling
  // after a single card.
  const tier = s.opponentTier
  const earlyStopChance = (tier ?? 0) >= 5 ? 0 : wave <= 2 ? 0.5 : wave <= 4 ? 0.25 : 0
  // Turtle's defensive crouch is still the point at low tiers, but capping it
  // at exactly one play regardless of tier is why a "fortified" opponent
  // still loses to a spawner engine it never answers fast enough.
  const turtleMaxPlays = (tier ?? 0) >= 3 ? 2 : 1

  let played = 0
  while (played < maxPlays) {
    const affordable = s.opponentHand.filter(c => c.cost <= mana && isPlayable(c, s.gameTime))
    if (affordable.length === 0) break

    let preferred: Card[] | null = (tier ?? 0) >= 3 ? threatResponsePool(affordable, s.field) : null
    if (!preferred) {
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
    }
    const pool = preferred.length > 0 ? preferred : affordable

    // Tier 4+ spends its interval's mana budget on its best card first,
    // rather than a uniformly random one — the opponent's mana is floored to
    // afford its priciest hand card every interval regardless of tier, so
    // "banking" here means not blowing that budget on a weak card when a
    // multi-play interval could have afforded the strong one too.
    const card = (tier ?? 0) >= 4
      ? pool.reduce((best, c) => c.cost > best.cost ? c : best)
      : pool[Math.floor(Math.random() * pool.length)]
    s.opponentHand.splice(s.opponentHand.indexOf(card), 1)
    mana -= card.cost
    played++

    deployOpponentCard(s, card, log)
    drawCard(s.opponentDeck, s.opponentHand)

    if (strategy === 'turtle') {
      // Turtle stops at its own cap, never the wave-scaled early-stop roll
      // below — that roll models a non-defensive opponent second-guessing
      // itself, which was never the intent for a strategy whose whole
      // premise is "play the one (or two, at tier 3+) card(s) and hold".
      if (played >= turtleMaxPlays) break
    } else if (played === 1 && Math.random() < earlyStopChance) {
      break
    }
  }

  if (played === 0) log.push('Opponent holds.')
}