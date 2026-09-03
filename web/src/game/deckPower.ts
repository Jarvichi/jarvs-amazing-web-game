// ─── Deck Power Rating ────────────────────────────────────
//
// One number for "how strong is this deck". The deck builder shows it as a
// badge; campaign difficulty scaling reads it so the game can respond to the
// deck the player actually brought instead of to how many runs they've played.
//
// ## Why the numbers are what they are
//
// The per-card scoring reuses the power formula documented in
// `balance_report.txt` (implemented by `rebalance_cards.py`), so a card's
// runtime rating and the authoring-time balance pass agree on what "strong"
// means. If that formula is retuned, retune `unitPowerScore` to match.
//
// Every function here is pure and takes already-built `Card[]` — the array
// `buildDeckCards()` returns. That matters: those cards have mastery levels
// and equipped augments already folded into their stats, including on the
// unit template a spawner emits. Scoring the built cards therefore prices in
// mastery and augments for free, and keeps doing so as those systems change,
// rather than re-deriving their multipliers here and drifting apart.

import { Card, UnitTemplate, StructureEffect, UpgradeEffect, Archetype } from './types'
import { ARCH_STRUCTURE_COST_REDUCTION } from './engine/constants'

// ─── Tuning constants ─────────────────────────────────────

/** Exponents from balance_report.txt's unit power score. */
const DPS_EXP   = 0.65
const HP_EXP    = 0.65
const SPEED_EXP = 0.20
const RANGE_EXP = 0.15

/**
 * Reference battle length used to price permanents. A spawner's worth is the
 * units it emits before the battle ends, so it needs a battle length to be
 * measured against; 60 s is roughly a campaign node that goes to plan.
 */
const BATTLE_WINDOW_MS = 60_000

/**
 * Emissions from a permanent get diminishing returns: the lane fills up, the
 * spawner gets focused down, and the twentieth goblin is worth less than the
 * second. Without this a 1000 ms spawner would score twenty times a 20 s one.
 */
const EMISSION_EXP = 0.6

/** A stationary structure has no move speed, so the speed term needs a floor. */
const STATIONARY_SPEED = 10

/**
 * Cost→score curve: the median power score of a fairly-costed card at each
 * mana cost. Derived from the tier medians in balance_report.txt
 * (cost 1: 30.3, 2: 48.2, 3: 70.8, 4: 87.2, 5: 106.0, 6: 163.7) but smoothed
 * to a monotonic curve — the report's cost 7 and 8 medians sit *below* cost 6
 * on samples of 6 and 3 cards, which is sampling noise, not a real dip.
 */
export function medianScoreForCost(cost: number): number {
  return 30.3 * Math.pow(Math.max(1, cost), 0.8)
}

/**
 * Mana-cost weights for upgrade effects, from balance_report.txt. An upgrade
 * has no battlefield stats to score, so its power is read off the cost its
 * effect *should* carry, then priced through the same cost curve as everything
 * else.
 */
const UPGRADE_WEIGHTS: Record<UpgradeEffect['type'], number> = {
  buffAttack:         0.60,
  buffMaxHp:          0.10,
  buffSpeed:          0.13,
  buffRange:          0.07,
  healUnits:          0.15,
  buffHp:             0.10,
  aoe:                0.50,
  buffAttackCooldown: 0.20,
  buffHeal:           0.15,
}

/**
 * Worth of +1 max mana, in score. A mana structure raises the cap for the
 * rest of the battle, so it is priced at roughly one on-curve cheap card's
 * worth of tempo per point — which lands Farm, the calibration case, at
 * almost exactly its cost-3 curve value.
 */
const MANA_TO_SCORE = 55

/** Score per point of max HP absorbed, for anything that cannot attack. */
const TANK_WEIGHT = 2.2

/** Consistency swing between a 30-unique deck and a minimum-unique deck. */
const CONSISTENCY_SWING = 0.15

/** A card costing more than the player's mana cap is mostly a dead draw. */
const UNCASTABLE_MULT = 0.35

/** Scales the raw mean efficiency ratio so a fairly-costed deck reads ~100. */
const RATING_SCALE = 100

// ─── Bands ────────────────────────────────────────────────

export interface DeckPowerBand {
  /** 1–5, usable directly as a difficulty tier input. */
  tier: number
  name: string
  /** Lowest rating in this band. */
  min: number
}

/**
 * Thresholds are calibrated against real decks from a save that walks the
 * campaign, not picked for round numbers:
 *
 *   STARTER_DECK                          ~93   → I   (the scale's anchor)
 *   the same spawner deck, unmastered     ~166  → II
 *   that deck mastered, no archetype      ~290  → III
 *   that deck mastered, Siege Commander   ~373  → IV
 *   max-copy cheap spawners, mastered     ~780  → V
 *
 * The last two are the decks that make the campaign trivial today, so they
 * have to land in the top bands — a rating that called them "average" would
 * leave difficulty scaling with nothing to respond to.
 */
export const DECK_POWER_BANDS: readonly DeckPowerBand[] = [
  { tier: 1, name: 'RECRUIT',  min: 0 },
  { tier: 2, name: 'SEASONED', min: 130 },
  { tier: 3, name: 'VETERAN',  min: 220 },
  { tier: 4, name: 'ELITE',    min: 340 },
  { tier: 5, name: 'MYTHIC',   min: 600 },
]

export function deckPowerBand(rating: number): DeckPowerBand {
  let band = DECK_POWER_BANDS[0]
  for (const b of DECK_POWER_BANDS) if (rating >= b.min) band = b
  return band
}

// ─── Per-card scoring ─────────────────────────────────────

/**
 * Raw power score of a unit template, on the same scale as the tier medians
 * in balance_report.txt (a starting Goblin scores ~27).
 */
export function unitPowerScore(u: UnitTemplate): number {
  const cooldown = Math.max(1, u.attackCooldownMs)
  const dps      = Math.max(0.1, u.attack * (1000 / cooldown))
  const speed    = u.moveSpeed > 0 ? u.moveSpeed : STATIONARY_SPEED
  return (
    Math.pow(dps, DPS_EXP) *
    Math.pow(Math.max(1, u.maxHp), HP_EXP) *
    Math.pow(speed, SPEED_EXP) *
    Math.pow(u.attackRange + 5, RANGE_EXP)
  )
}

/**
 * Fallback pulse rate for an aura whose template omits `intervalMs`.
 * `cards.json` is not type-checked against `StructureEffect`, and two
 * repair-aura templates (Resonance Spire, Reef Mender) are missing the field —
 * enough to make a rating NaN, so every interval read here is defended.
 */
const DEFAULT_PULSE_MS = 6000

/** How many times a permanent fires in a reference battle, with falloff. */
function emissions(intervalMs: number | undefined): number {
  const interval = intervalMs != null && intervalMs > 0 ? intervalMs : DEFAULT_PULSE_MS
  return Math.pow(BATTLE_WINDOW_MS / interval, EMISSION_EXP)
}

/**
 * Score the ongoing output of a structure's effect. This is where spawner
 * decks earn their rating: a structure is a permanent, so it is priced on
 * everything it produces over a battle, not on the one body it puts down.
 */
function structureEffectScore(effect: StructureEffect): number {
  switch (effect.type) {
    case 'spawn':
      return unitPowerScore(effect.unitTemplate) * emissions(effect.intervalMs)
    case 'mana':
      return effect.amount * MANA_TO_SCORE
    case 'manaSpeed':
      // speedMult < 1 is faster regen; express the saving as extra mana.
      return Math.max(0, 1 - effect.speedMult) * MANA_TO_SCORE * 2
    case 'healAura':
    case 'repairAura':
      return effect.amount * emissions(effect.intervalMs) * 2
    case 'attackAura':
      return effect.amount * 20
    case 'slowZone':
      return (1 - effect.slowFactor) * 40 + (effect.damagePerSec ?? 0) * 6
    default:
      return 0
  }
}

/** Mana cost an upgrade's effect is worth, per balance_report.txt's weights. */
function upgradeEquivalentCost(effect: UpgradeEffect): number {
  const weight = UPGRADE_WEIGHTS[effect.type] ?? 0.2
  const amount =
    effect.type === 'aoe'
      ? Math.abs(effect.damage ?? effect.amount ?? 0)
      : Math.abs((effect as { amount?: number }).amount ?? 0)
  return Math.max(1, amount * weight)
}

/** What a body is worth purely as something the enemy has to chew through. */
function tankScore(maxHp: number): number {
  return Math.pow(Math.max(1, maxHp), HP_EXP) * TANK_WEIGHT
}

/**
 * The value of the body itself, ignoring any structure effect it carries.
 *
 * Two card shapes would otherwise be badly mispriced by the unit formula.
 * Walls and pure spawners have `attack: 0`, so the DPS term collapses to its
 * floor and the score becomes a function of HP alone dressed up as combat
 * power — they are worth what they absorb, and nothing more. Moats set
 * `maxHp: 9999` as an "indestructible" sentinel rather than as real
 * durability, so their HP must not be scored at all.
 */
function bodyScore(unit: UnitTemplate): number {
  if (unit.isMoat) return 0
  if (unit.attack <= 0) return tankScore(unit.maxHp)
  if (unit.isWall) return tankScore(unit.maxHp)
  // A defensive tower keeps shooting all battle; a mobile unit gets one life.
  const body = unitPowerScore(unit)
  return unit.moveSpeed === 0 ? body * 1.5 : body
}

/**
 * Raw power score of a card, before its mana cost is taken into account.
 * Comparable across card types — all three branches land on the same scale.
 */
export function cardPowerScore(card: Card): number {
  if (card.cardType === 'upgrade') {
    const effect = card.upgradeEffect ?? card.heroEffect
    return effect ? medianScoreForCost(upgradeEquivalentCost(effect)) : medianScoreForCost(card.cost)
  }

  const unit = card.unit
  if (!unit) return medianScoreForCost(card.cost)

  return bodyScore(unit) + (unit.structureEffect ? structureEffectScore(unit.structureEffect) : 0)
}

// ─── Deck scoring ─────────────────────────────────────────

export interface DeckPowerOptions {
  /** Archetype passives change what a card effectively costs. */
  archetype?: Archetype | null
  /** The player's mana cap — cards above it are mostly dead draws. */
  maxMana?: number
}

/** A card's cost after archetype discounts, floored at 1. */
export function effectiveCost(card: Card, archetype?: Archetype | null): number {
  let cost = card.cost
  if (archetype === 'siege_commander' && card.cardType === 'structure') {
    cost -= ARCH_STRUCTURE_COST_REDUCTION
  }
  return Math.max(1, cost)
}

/**
 * A card's power per point of mana, where 1.0 means "exactly on curve for its
 * cost". Mana is the binding constraint in a battle, so this — not raw score —
 * is what decides whether a deck overperforms.
 */
export function cardPowerRatio(card: Card, opts: DeckPowerOptions = {}): number {
  const cost  = effectiveCost(card, opts.archetype)
  const ratio = cardPowerScore(card) / medianScoreForCost(cost)
  const capped = opts.maxMana != null && cost > opts.maxMana
  return capped ? ratio * UNCASTABLE_MULT : ratio
}

export interface DeckPowerBreakdown {
  /** The headline rating. A deck of perfectly on-curve cards scores ~100. */
  rating: number
  band: DeckPowerBand
  /** Mean per-card power-per-mana, before the consistency multiplier. */
  meanRatio: number
  /** Draw-consistency multiplier from how few unique names the deck runs. */
  consistency: number
  cardCount: number
  uniqueCount: number
  /** The deck's strongest cards, highest power-per-mana first. */
  topCards: Array<{ name: string; ratio: number }>
}

/**
 * Rate a built deck. Pass the `Card[]` from `buildDeckCards()` so mastery and
 * augments are already in the stats.
 *
 * Deck size is deliberately not a term. A 30-card deck is not stronger than a
 * 12-card one — the shorter deck draws its best cards more often, which the
 * consistency multiplier prices instead.
 */
export function analyseDeckPower(cards: Card[], opts: DeckPowerOptions = {}): DeckPowerBreakdown {
  if (cards.length === 0) {
    return {
      rating: 0,
      band: DECK_POWER_BANDS[0],
      meanRatio: 0,
      consistency: 1,
      cardCount: 0,
      uniqueCount: 0,
      topCards: [],
    }
  }

  const ratios = cards.map(c => ({ name: c.name, ratio: cardPowerRatio(c, opts) }))
  const meanRatio = ratios.reduce((s, r) => s + r.ratio, 0) / ratios.length

  // Fewer unique names means the deck draws what it wants more reliably. The
  // floor is one unique per 4 copies (COPIES_MAX), which is maximum redundancy.
  const uniqueCount = new Set(cards.map(c => c.name)).size
  const minUnique   = Math.max(1, Math.ceil(cards.length / 4))
  const spread      = cards.length - minUnique
  const redundancy  = spread > 0 ? 1 - (uniqueCount - minUnique) / spread : 1
  const consistency = 1 + CONSISTENCY_SWING * Math.max(0, Math.min(1, redundancy))

  const byName = new Map<string, number>()
  for (const r of ratios) byName.set(r.name, r.ratio)
  const topCards = [...byName.entries()]
    .map(([name, ratio]) => ({ name, ratio }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5)

  return {
    rating: Math.round(meanRatio * consistency * RATING_SCALE),
    band: deckPowerBand(Math.round(meanRatio * consistency * RATING_SCALE)),
    meanRatio,
    consistency,
    cardCount: cards.length,
    uniqueCount,
    topCards,
  }
}

/** Convenience wrapper for callers that only want the number. */
export function deckPower(cards: Card[], opts: DeckPowerOptions = {}): number {
  return analyseDeckPower(cards, opts).rating
}

// ─── Deck shape ───────────────────────────────────────────
//
// What a deck is *for*, as opposed to how strong it is. Used to pick which
// answer cards (#2292) a high-tier node should field: a spawner-turtle deck
// and a big-single-unit deck are both "strong" at the same rating, but need
// completely different counters.

export type DeckShape = 'structure' | 'swarm' | 'bigUnit' | 'balanced'

/** A cost this cheap is what makes a unit fit for a swarm plan. */
const SWARM_UNIT_MAX_COST = 2
/** Share of the deck that must be cheap units for "many cheap bodies" to be the actual plan. */
const SWARM_SHARE_THRESHOLD = 0.5
/** Share of the deck that must be structures for "the board is the plan" to be the actual plan. */
const STRUCTURE_SHARE_THRESHOLD = 0.4
/** Average cost above which a deck is leaning on a few big cards rather than a curve. */
const BIG_UNIT_AVG_COST_THRESHOLD = 4.5

/**
 * Classifies a deck by its dominant plan. Checked in this order because a
 * deck can be structure-heavy AND expensive (a turtle deck) — being mostly
 * structures is the more actionable fact for choosing a counter (siege units
 * beat a wall of buildings; a big-unit answer does not), so it takes priority.
 */
export function classifyDeckShape(cards: Card[]): DeckShape {
  if (cards.length === 0) return 'balanced'

  const structureShare = cards.filter(c => c.cardType === 'structure').length / cards.length
  if (structureShare >= STRUCTURE_SHARE_THRESHOLD) return 'structure'

  const units = cards.filter(c => c.cardType === 'unit')
  const cheapUnitShare = units.filter(c => c.cost <= SWARM_UNIT_MAX_COST).length / cards.length
  if (cheapUnitShare >= SWARM_SHARE_THRESHOLD) return 'swarm'

  const avgCost = cards.reduce((s, c) => s + c.cost, 0) / cards.length
  if (avgCost >= BIG_UNIT_AVG_COST_THRESHOLD) return 'bigUnit'

  return 'balanced'
}
