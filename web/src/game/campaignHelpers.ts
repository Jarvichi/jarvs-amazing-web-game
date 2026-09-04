import { QuestNode, Act, ReplayModifier, loadPlayerArchetype } from './questline'
import { NewGameOptions, MAX_HANDICAP } from './engine'
import { Card, SECRET_RARITIES } from './types'
import { shuffle } from './engine/helpers'
import { HERO_CARDS, makeNodeDeck, getCardCatalog } from './cards'
import { analyseDeckPower } from './deckPower'
import { loadPlayerStats } from './playerStats'

const QB_ENVIRONMENTS = ['forest', 'farmland', 'ruins', 'ashen', 'sand', 'volcano', 'citadel', 'coast', 'frost', 'fungal', 'vault', 'camp'] as const
function pickQBEnvironment(): string {
  return QB_ENVIRONMENTS[Math.floor(Math.random() * QB_ENVIRONMENTS.length)]
}
import {
  buildDeckCards, DECK_MAX, STARTER_DECK, deckTotalCards,
  generateSeededPack, loadCollection, loadDeck,
} from './collection'

export type QuickBattleMode =
  | 'easy' | 'normal' | 'mirror' | 'unlimited' | 'chaos'
  | 'only-units' | 'only-spells' | 'only-buildings'
  | 'common-only' | 'uncommon-only' | 'rare-only' | 'legendary-only' | 'hero-only'
  | 'draft'

export function loadCurrentDeckInfo(): { playerCards: Card[]; deckBonus: number } {
  const collection  = loadCollection()
  const deckEntries = loadDeck()
  const deckCount   = deckTotalCards(deckEntries)
  const effectiveDeck = deckCount > 0 ? deckEntries : STARTER_DECK
  const playerCards   = buildDeckCards(effectiveDeck, collection)
  const deckBonus = Math.round(Math.max(0, DECK_MAX - deckCount) / DECK_MAX * 10)
  return { playerCards, deckBonus }
}

export function buildQuickBattleOpts(
  mode: QuickBattleMode,
  handicap: number,
): { opts: NewGameOptions; playerCards: Card[] } {
  const collection    = loadCollection()
  const deckEntries   = loadDeck()
  const deckCount     = deckTotalCards(deckEntries)
  const effectiveDeck = deckCount > 0 ? deckEntries : STARTER_DECK
  const playerCards   = buildDeckCards(effectiveDeck, collection)
  const deckBonus     = Math.round(Math.max(0, DECK_MAX - deckCount) / DECK_MAX * 10)
  const adjustedHandicap = Math.min(MAX_HANDICAP, handicap + deckBonus)

  const environment = pickQBEnvironment()

  if (mode === 'mirror') {
    return { playerCards, opts: { playerCards, opponentHandicap: MAX_HANDICAP, prebuiltOpponentDeck: shuffle([...playerCards]), environment } }
  }
  if (mode === 'easy') {
    return { playerCards, opts: { playerCards, opponentHandicap: adjustedHandicap, environment } }
  }
  if (mode === 'normal') {
    const ownedNames       = new Set(collection.filter(e => e.count > 0).map(e => e.cardName))
    const collectionPool   = getCardCatalog().filter(c => ownedNames.has(c.name))
    const opponentCardPool = collectionPool.length >= 20 ? collectionPool : undefined
    return { playerCards, opts: { playerCards, opponentHandicap: adjustedHandicap, opponentCardPool, environment } }
  }
  if (mode === 'chaos') {
    const collectionPool   = makeNodeDeck(generateSeededPack(20, 'legendary'))
    const opponentCardPool = collectionPool.length >= 20 ? collectionPool : undefined
    return { playerCards, opts: { playerCards: opponentCardPool, opponentHandicap: 0, opponentCardPool, forgiveManaLimit: true, environment } }
  }
  if (mode === 'unlimited') {
    const collectionPool   = getCardCatalog().filter(c => !SECRET_RARITIES.has(c.rarity))
    const opponentCardPool = collectionPool.length >= 20 ? collectionPool : undefined
    return { playerCards, opts: { playerCards, opponentHandicap: 0, opponentCardPool, environment } }
  }
  if (mode === 'hero-only') {
    return { playerCards, opts: { playerCards, opponentHandicap: 0, opponentCardPool: [...HERO_CARDS, ...HERO_CARDS, ...HERO_CARDS], forgiveManaLimit: true, environment } }
  }
  // Rarity / type filter modes
  const filterMap: Record<string, (c: Card) => boolean> = {
    'common-only':    c => c.rarity === 'common',
    'uncommon-only':  c => c.rarity === 'uncommon',
    'rare-only':      c => c.rarity === 'rare',
    'legendary-only': c => c.rarity === 'legendary',
    'only-buildings': c => c.cardType.includes('structure'),
    'only-units':     c => c.cardType.includes('unit'),
    'only-spells':    c => c.cardType.includes('upgrade'),
  }
  const filter = filterMap[mode]
  if (filter) {
    const collectionPool   = getCardCatalog().filter(c => filter(c) && !SECRET_RARITIES.has(c.rarity))
    const opponentCardPool = collectionPool.length >= 20 ? collectionPool : undefined
    return { playerCards, opts: { playerCards, opponentHandicap: 0, opponentCardPool, environment } }
  }
  // Fallback: easy
  return { playerCards, opts: { playerCards, opponentHandicap: adjustedHandicap, environment } }
}

export const HANDICAP_KEY = 'jarvs_handicap'

export function loadHandicap(): number {
  try {
    const v = localStorage.getItem(HANDICAP_KEY)
    if (v !== null) return Math.min(MAX_HANDICAP, Math.max(0, parseInt(v, 10)))
  } catch { /* ignore */ }
  return 0
}

// ─── Deck-power difficulty tier (#2290/#2291) ──────────────────────────────
//
// `node.handicap` (0-20) is authored across every act but `newGame()` never
// reads it once a node supplies `enemyDeckNames` and/or `opponentIntervalMs`
// — every authored battle/elite/boss node supplies both, so handicap reaches
// only a UI label. `enemyTier` (1-5) replaces it with something that
// actually resolves to battle effects, shifted by how the player's deck
// compares to what the act expects.

/** Un-migrated nodes (no `enemyTier`) fall back to this so they keep behaving as before. */
export function tierFromHandicap(handicap: number): number {
  return Math.max(1, Math.min(5, Math.round(handicap / 7) + 1))
}

export function nodeEnemyTier(node: QuestNode): number {
  return node.enemyTier ?? tierFromHandicap(node.handicap ?? 0)
}

/**
 * Pure numeric core, shared by the battle-options resolver below and by
 * NodePeekModal's "why is this harder/easier" display, so both read the
 * exact same delta.
 */
export function effectiveTierFor(nodeTier: number, playerBandTier: number, expectedBand: number): number {
  const deckDelta = Math.max(-1, Math.min(2, playerBandTier - expectedBand))
  return Math.max(1, Math.min(5, nodeTier + deckDelta))
}

export function resolveEffectiveTier(node: QuestNode, act: Act | undefined, playerBandTier: number): number {
  return effectiveTierFor(nodeEnemyTier(node), playerBandTier, act?.expectedBand ?? 1)
}

/** The player's current deck-power band tier (1-5), for feeding into resolveEffectiveTier. */
export function currentPlayerBandTier(playerCards: Card[]): number {
  return analyseDeckPower(playerCards, {
    archetype: loadPlayerArchetype(),
    maxMana: loadPlayerStats().maxMana,
  }).band.tier
}

interface TierEffect {
  /** Multiplies opponentBaseHp, after the existing enemyHpPercent modifier. */
  hpMultiplier: number
  /** Added to opponentIntervalMs — positive is slower/easier, negative faster/harder. */
  intervalDeltaMs: number
  /** Added to opponentStartCards, on top of the enemyHandBonus modifier total. */
  startCardsBonus: number
  /** Added to the opponent's mana floor (opponentAI.ts). */
  manaFloorBonus: number
  /** Raises the opponent's per-turn play ceiling (opponentAI.ts). Undefined = no change. */
  maxPlaysOverride?: number
}

/**
 * Tier 2 is the authored baseline — every field is a no-op there, which is
 * what makes "tier 2 produces byte-identical NewGameOptions to today"
 * possible to hold as a regression guard (see campaignHelpers.test.ts).
 */
const TIER_EFFECTS: Record<number, TierEffect> = {
  1: { hpMultiplier: 0.9, intervalDeltaMs:  600, startCardsBonus: 0, manaFloorBonus: 0 },
  2: { hpMultiplier: 1.0, intervalDeltaMs:    0, startCardsBonus: 0, manaFloorBonus: 0 },
  3: { hpMultiplier: 1.0, intervalDeltaMs: -400, startCardsBonus: 1, manaFloorBonus: 0 },
  4: { hpMultiplier: 1.0, intervalDeltaMs: -800, startCardsBonus: 2, manaFloorBonus: 1 },
  5: { hpMultiplier: 1.0, intervalDeltaMs: -1200, startCardsBonus: 2, manaFloorBonus: 2, maxPlaysOverride: 4 },
}

/**
 * Compute the NewGameOptions fields that depend on node data, act modifiers,
 * the player's run count, and (new, #2291) the player's deck-power tier
 * relative to what the act expects.
 *
 * Run count still drives the pre-existing handicap reduction below — that
 * lever is dead (campaign `handicap` is never read once a node has
 * `enemyDeckNames`/`opponentIntervalMs`, which every authored node does) and
 * is scheduled for removal in #2296, once every difficulty consumer has
 * moved onto `enemyTier`. Left untouched here so this diff stays readable:
 *
 *   run 1 → handicap 7, HP 82
 *   run 2 → handicap 5, HP 92
 *   run 3 → handicap 3, HP 102
 *   run 4 → handicap 1, HP 112
 *   run 5+ → handicap 0, HP 122+
 *
 * `playerCards` should be the actual battle deck (post-mastery,
 * post-augments — what `buildDeckCards()` returns) so the tier resolution
 * reads the deck the player is really about to fight with. Defaults to `[]`
 * (→ band tier 1, no upward pressure) for callers that don't have it, such
 * as the balance harness's default sweep.
 */
export function resolvedNodeOpts(
  node: QuestNode,
  act: Act | undefined,
  runCount: number,
  modifiers: ReplayModifier[],
  playerCards: Card[] = [],
): Omit<NewGameOptions, 'playerCards'> {
  const extra = Math.max(0, runCount - 1)
  const handicapReduction = Math.min(extra * 2, MAX_HANDICAP)

  // Stack modifier values
  let hpPctBonus = 0
  let intervalReduction = 0
  let handBonus = 0
  for (const m of modifiers) {
    if (m.type === 'enemyHpPercent') hpPctBonus += m.value
    if (m.type === 'enemyIntervalReduction') intervalReduction += m.value
    if (m.type === 'enemyHandBonus') handBonus += m.value
  }

  const adjustedHandicap = Math.max(0, (node.handicap ?? 0) - handicapReduction)
  // Boss default HP is 95; non-boss 82 (mirrors engine.ts defaults)
  const defaultHp = node.bossAI ? 95 : 82
  const baseHp = node.opponentBaseHp ?? defaultHp
  const modifierHp = Math.round(baseHp * (1 + hpPctBonus / 100))

  // When a modifier or tier reduces interval, fall back to 4000ms base if the node didn't specify one
  const effectiveTier = resolveEffectiveTier(node, act, currentPlayerBandTier(playerCards))
  const tier = TIER_EFFECTS[effectiveTier]
  const baseInterval = node.opponentIntervalMs ?? ((intervalReduction > 0 || tier.intervalDeltaMs !== 0) ? 4000 : undefined)
  const modifierInterval = baseInterval !== undefined ? baseInterval - intervalReduction : undefined

  const adjustedHp = Math.round(modifierHp * tier.hpMultiplier)
  const adjustedInterval = modifierInterval !== undefined
    ? Math.max(1000, modifierInterval + tier.intervalDeltaMs)
    : undefined

  // Boss shockwave kill pct: starts at 50%, increases by 10% per run, capped at 100%
  const bossSpawnKillPct = node.bossAI
    ? Math.min(1.0, 0.5 + (runCount - 1) * 0.1)
    : undefined

  return {
    opponentHandicap: adjustedHandicap,
    bossAI: node.bossAI,
    bossCard: node.bossCard,
    bossName: node.bossName,
    bossHpMultiplier: node.bossHpMultiplier,
    enemyDeckNames: node.enemyDeck,
    terrainSeed: node.id,
    environment: node.environment ?? act?.environment,
    roads: node.roads ?? act?.roads,
    roadFollowing: node.roadFollowing ?? act?.roadFollowing ?? false,
    terrain: node.terrain ?? act?.terrain,
    decor: node.decor ?? act?.decor,
    terrainPaths: node.terrainPaths ?? act?.terrainPaths,
    terrainValidated: node.terrainValidated ?? act?.terrainValidated ?? false,
    opponentIntervalMs: adjustedInterval,
    opponentBaseHp: adjustedHp,
    opponentStartCards: handBonus + tier.startCardsBonus,
    opponentManaFloorBonus: tier.manaFloorBonus,
    opponentMaxPlaysOverride: tier.maxPlaysOverride,
    bossSpawnKillPct,
  }
}

// ─── Campaign HP carry-forward ─────────────────────────────────────────────

/**
 * Computes the run's persisted current HP after a campaign battle win.
 *
 * `playerBase` (from the just-finished GameState) may be scaled up by an
 * equipped relic's flat HP bonus — relics.ts applies that bonus fresh to
 * both `hp` and `maxHp` at the start of every battle, and it is deliberately
 * excluded from `run.maxHp` (the relic is meant to be a transient per-battle
 * cushion, not a permanent stat). Carrying `playerBase.hp` straight into
 * `run.playerHp` would silently bank that bonus into the persisted pool
 * without `run.maxHp` ever growing to match, drifting the two apart over
 * repeated battles. Instead, measure damage taken against the (possibly
 * relic-inflated) battle pool and re-apply it to the relic-free run.maxHp,
 * so run.playerHp and run.maxHp always stay on the same scale.
 */
export function carryHpAfterBattle(runMaxHp: number, playerBase: { hp: number; maxHp: number }): number {
  const dmgTaken = playerBase.maxHp - playerBase.hp
  return Math.max(0, runMaxHp - dmgTaken)
}

/**
 * Applies a node-map event's `healHp` effect. Unlike the rest-node heal
 * choice, event healing always clamps to maxHp — events never grant an
 * overheal above the player's maximum.
 */
export function applyEventHeal(playerHp: number, maxHp: number, amount: number): number {
  return Math.min(maxHp, playerHp + amount)
}

/**
 * Applies a rest-node "heal" choice. Normally clamps to maxHp, but if the
 * player is already at full health, grants the heal as bonus HP above their
 * maximum instead of wasting it — this is an intentional overheal, not a bug.
 */
export function applyRestHeal(playerHp: number, maxHp: number, healAmount: number): { hp: number; message: string } {
  if (playerHp >= maxHp) {
    return {
      hp: playerHp + healAmount,
      message: `Already at full health — gained +${healAmount} bonus HP above your maximum!`,
    }
  }
  const gained = Math.min(healAmount, maxHp - playerHp)
  const hp = Math.min(playerHp + healAmount, maxHp)
  return { hp, message: `Healed ${gained} HP. (${playerHp} → ${hp})` }
}
