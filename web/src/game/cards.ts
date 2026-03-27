import { Card, CardRarity, CardType, UnitTemplate, UpgradeEffect } from './types'
import { logError } from '../logger'
import cardsData from '../data/cards.json'

let _id = 0
const uid = () => `card-${++_id}`

// Validation errors discovered during module init (before the Rollbar logger is ready).
// Flushed to Rollbar on the first call to flushCardValidationErrors() — called from newGame().
const _pendingValidationErrors: Array<{ msg: string; ctx: Record<string, unknown> }> = []

/** Send any card-definition validation errors that occurred at module-init time to Rollbar. */
export function flushCardValidationErrors(): void {
  for (const { msg, ctx } of _pendingValidationErrors) {
    logError(msg, ctx)
  }
  _pendingValidationErrors.length = 0
}

// ─── Card Definition Schema ───────────────────────────────

interface CardDef {
  name: string
  rarity: CardRarity
  cost: number
  cardType: CardType
  unit?: UnitTemplate
  upgradeEffect?: UpgradeEffect
  description: string
  lore?: string
  /** How many copies go in the default makeDeck() */
  deckCount: number
}

// ─── JSON data types ──────────────────────────────────────

interface RawStructureEffect {
  type: 'mana' | 'spawn' | 'manaSpeed' | 'healAura' | 'repairAura' | 'attackAura'
  amount?: number
  speedMult?: number
  unitTemplateRef?: string
  intervalMs?: number
}

interface RawUnitDef {
  name: string
  attack: number
  maxHp: number
  isWall: boolean
  bypassWall: boolean
  moveSpeed: number
  attackRange: number
  attackCooldownMs: number
  flying?: boolean
  climber?: boolean
  structureEffect?: RawStructureEffect
}

interface RawCardDef {
  name: string
  rarity: string
  cost: number
  cardType: string
  unitRef?: string
  unit?: RawUnitDef
  upgradeEffect?: { type: string; amount: number }
  description: string
  lore?: string
  deckCount: number
}

interface RawHeroCard {
  id: string
  name: string
  rarity: string
  cost: number
  cardType: string
  isHero: true
  unit: RawUnitDef
  heroEffect: { type: string; amount: number }
  description: string
  lore?: string
}

// ─── Template resolution ──────────────────────────────────

const TEMPLATES = cardsData.templates as Record<string, RawUnitDef>

function resolveUnit(raw: RawUnitDef): UnitTemplate {
  if (!raw.structureEffect || raw.structureEffect.type !== 'spawn') {
    return raw as UnitTemplate
  }
  const { unitTemplateRef, intervalMs } = raw.structureEffect
  const resolved = unitTemplateRef ? TEMPLATES[unitTemplateRef] : undefined
  if (!resolved) {
    const msg = `cards.json: unknown unitTemplateRef '${unitTemplateRef ?? '(none)'}' for unit '${raw.name}' — spawner will produce invalid units`
    console.error('[cards]', msg)
    _pendingValidationErrors.push({ msg, ctx: { unitName: raw.name, unitTemplateRef: unitTemplateRef ?? null } })
  }
  const unitTemplate = (resolved ?? {}) as UnitTemplate
  return {
    ...(raw as unknown as UnitTemplate),
    structureEffect: { type: 'spawn' as const, unitTemplate, intervalMs: intervalMs ?? 0 },
  }
}

// Resolve a manaSpeed effect from raw JSON to typed StructureEffect
// (healAura, repairAura, attackAura also pass through resolveUnit as-is via the cast above)

function resolveCardDef(raw: RawCardDef): CardDef {
  let unit: UnitTemplate | undefined
  if (raw.unitRef) {
    const resolved = TEMPLATES[raw.unitRef]
    if (!resolved) {
      const msg = `cards.json: unknown unitRef '${raw.unitRef}' for card '${raw.name}' — card will be undeployable`
      console.error('[cards]', msg)
      _pendingValidationErrors.push({ msg, ctx: { cardName: raw.name, unitRef: raw.unitRef } })
    }
    unit = resolved as UnitTemplate
  } else if (raw.unit) {
    unit = resolveUnit(raw.unit)
  }
  return {
    name: raw.name,
    rarity: raw.rarity as CardRarity,
    cost: raw.cost,
    cardType: raw.cardType as CardType,
    unit,
    upgradeEffect: raw.upgradeEffect as UpgradeEffect | undefined,
    description: raw.description,
    lore: raw.lore,
    deckCount: raw.deckCount,
  }
}

// ─── Resolved data ────────────────────────────────────────

const CARD_DEFS: CardDef[] = (cardsData.cards as RawCardDef[]).map(resolveCardDef)

// Exported shared templates (for backward compatibility)
export const GOBLIN_UNIT  = TEMPLATES['goblin']  as UnitTemplate
export const ARCHER_UNIT  = TEMPLATES['archer']  as UnitTemplate
export const DRAGON_UNIT  = TEMPLATES['dragon']  as UnitTemplate

// ─── Hero Cards ───────────────────────────────────────────
// One hero is randomly injected into each player's deck per game.

export const HERO_CARDS: Card[] = (cardsData.heroCards as RawHeroCard[]).map(raw => ({
  id: raw.id,
  name: raw.name,
  rarity: raw.rarity as CardRarity,
  cost: raw.cost,
  cardType: raw.cardType as CardType,
  isHero: true as const,
  unit: resolveUnit(raw.unit),
  heroEffect: raw.heroEffect as UpgradeEffect,
  description: raw.description,
  lore: raw.lore,
}))

// ─── Lore lookup ──────────────────────────────────────────

const LORE_BY_NAME = new Map<string, string>([
  ...CARD_DEFS.filter(d => d.lore).map(d => [d.name, d.lore!] as [string, string]),
  ...(cardsData.heroCards as RawHeroCard[]).filter(h => h.lore).map(h => [h.name, h.lore!] as [string, string]),
])

/** Return the flavour-text lore for a unit/card by name, or undefined. */
export function getUnitLore(name: string): string | undefined {
  return LORE_BY_NAME.get(name)
}

// ─── Public API ───────────────────────────────────────────

/** One Card instance per card type — used for display and collection lookups. */
export function getCardCatalog(): Card[] {
  return CARD_DEFS.map(def => ({
    id: `cat-${def.name}`,
    name: def.name,
    rarity: def.rarity,
    cost: def.cost,
    cardType: def.cardType,
    unit: def.unit,
    upgradeEffect: def.upgradeEffect,
    description: def.description,
    lore: def.lore,
  }))
}

/** Build the default deck (used by opponent AI and as fallback). */
export function makeDeck(): Card[] {
  const result: Card[] = []
  for (const def of CARD_DEFS) {
    for (let i = 0; i < def.deckCount; i++) {
      result.push({
        id: uid(),
        name: def.name,
        rarity: def.rarity,
        cost: def.cost,
        cardType: def.cardType,
        unit: def.unit,
        upgradeEffect: def.upgradeEffect,
        description: def.description,
        lore: def.lore,
      })
    }
  }
  return result
}

/**
 * The Thornlord boss deck — wall-heavy with spawner structures and sturdy defenders.
 * 6× Stone Wall ensures walls go down every turn via thornlordAI priority routing.
 */
export function makeThorlordDeck(): Card[] {
  const make = (name: string, count: number): Card[] => {
    const def = CARD_DEFS.find(d => d.name === name)
    if (!def) return []
    return Array.from({ length: count }, () => ({
      id: uid(),
      name: def.name,
      rarity: def.rarity,
      cost: def.cost,
      cardType: def.cardType,
      unit: def.unit,
      upgradeEffect: def.upgradeEffect,
      description: def.description,
      lore: def.lore,
    }))
  }
  return [
    ...make('Stone Wall',   6),
    ...make('Barracks',     3),
    ...make('Farm',         2),
    ...make('Crypt',        2),
    ...make('Shield Guard', 2),
    ...make('Knight',       2),
    ...make('Fortify',      1),
  ]
}

/**
 * Build a deck from an ordered list of card names.
 * Unknown names are silently skipped.
 * Used for node-specific deterministic enemy decks.
 */
export function makeNodeDeck(names: string[]): Card[] {
  return names.flatMap(name => {
    const def = CARD_DEFS.find(d => d.name === name)
    if (!def) return []
    return [{
      id: uid(),
      name: def.name,
      rarity: def.rarity,
      cost: def.cost,
      cardType: def.cardType,
      unit: def.unit,
      upgradeEffect: def.upgradeEffect,
      description: def.description,
      lore: def.lore,
    }]
  })
}

/**
 * Kragg boss deck — heavy siege weapons, fortified walls, and disciplined infantry.
 */
export function makeKraggDeck(): Card[] {
  const make = (name: string, count: number): Card[] => {
    const def = CARD_DEFS.find(d => d.name === name)
    if (!def) return []
    return Array.from({ length: count }, () => ({
      id: uid(), name: def.name, rarity: def.rarity, cost: def.cost,
      cardType: def.cardType, unit: def.unit, upgradeEffect: def.upgradeEffect,
      description: def.description, lore: def.lore,
    }))
  }
  return [
    ...make('Stone Wall',   4),
    ...make('Catapult',     3),
    ...make('Knight',       3),
    ...make('Shield Guard', 2),
    ...make('Ballista',     2),
    ...make('Siege Works',  1),
    ...make('War Drums',    1),
    ...make('Fortify',      1),
    ...make('Crossbow',     2),
  ]
}

/**
 * Ashwalker boss deck — undead horde with necromantic support and revenant swarms.
 */
export function makeAshwalkerDeck(): Card[] {
  const make = (name: string, count: number): Card[] => {
    const def = CARD_DEFS.find(d => d.name === name)
    if (!def) return []
    return Array.from({ length: count }, () => ({
      id: uid(), name: def.name, rarity: def.rarity, cost: def.cost,
      cardType: def.cardType, unit: def.unit, upgradeEffect: def.upgradeEffect,
      description: def.description, lore: def.lore,
    }))
  }
  return [
    ...make('Skeleton',    5),
    ...make('Specter',     3),
    ...make('Bat',         3),
    ...make('Crypt',       2),
    ...make('Necromancer', 2),
    ...make('Dark Shrine', 2),
    ...make('Bloodlust',   1),
    ...make('Vampire',     1),
  ]
}

export function getCardUnit(cardName: string): UnitTemplate | undefined {
  return CARD_DEFS.find(d => d.name === cardName)?.unit
}

export function rarityStars(r: CardRarity): string {
  return '\u2605'.repeat({ common: 1, uncommon: 2, rare: 3, legendary: 4 }[r])
}
