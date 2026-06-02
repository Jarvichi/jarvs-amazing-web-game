import { QuestNode, Act, ReplayModifier } from './questline'
import { NewGameOptions, MAX_HANDICAP } from './engine'
import { Card, SECRET_RARITIES } from './types'
import { shuffle } from './engine/helpers'
import { HERO_CARDS, makeNodeDeck, getCardCatalog } from './cards'

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

/**
 * Compute the NewGameOptions fields that depend on node data, act modifiers,
 * and the player's run count. Run count drives a scaling handicap reduction
 * so repeat runs get a bit easier:
 *
 *   run 1 → handicap 7, HP 82
 *   run 2 → handicap 5, HP 92
 *   run 3 → handicap 3, HP 102
 *   run 4 → handicap 1, HP 112
 *   run 5+ → handicap 0, HP 122+
 */
export function resolvedNodeOpts(
  node: QuestNode,
  act: Act | undefined,
  runCount: number,
  modifiers: ReplayModifier[],
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
  const adjustedHp = Math.round(baseHp * (1 + hpPctBonus / 100))

  // When a modifier reduces interval, fall back to 4000ms base if node didn't specify one
  const baseInterval = node.opponentIntervalMs ?? (intervalReduction > 0 ? 4000 : undefined)
  const adjustedInterval = baseInterval !== undefined
    ? Math.max(1000, baseInterval - intervalReduction)
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
    opponentIntervalMs: adjustedInterval,
    opponentBaseHp: adjustedHp,
    opponentStartCards: handBonus,
    bossSpawnKillPct,
  }
}
