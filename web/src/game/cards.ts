import { AttackEffect, Card, CardRarity, CardType, UnitTemplate, UpgradeEffect } from './types'
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
  tags?: string[]
  structureEffect?: RawStructureEffect
  onDeathEffect?: { damage: number; range: number }
  teleportAbility?: { cooldownMs: number; distancePx: number }
  invisibilityAbility?: { activeMs: number; cooldownMs: number }
  bloodSummonAbility?: { cooldownMs: number; minionTemplate: RawUnitDef; range: number }
}

/** Radius (game units) of the lingering gas cloud dropped by `gascloud`-tagged units. */
export const GAS_CLOUD_RADIUS = 45

function deriveAttackEffect(tags: string[] | undefined, attack: number): AttackEffect | undefined {
  if (!tags || attack === 0) return undefined
  if (tags.includes('fire') || tags.includes('ember'))
    return { type: 'burn',     chance: 0.70, durationMs: 3000, dps: 8 }
  if (tags.includes('frost') || tags.includes('glacier'))
    return { type: 'freeze',   chance: 0.75, durationMs: 2500, slowFactor: 0.35 }
  // GAS_CLOUD_RADIUS is the damage radius *and* the radius the green cloud is drawn at
  // (battlefieldCanvas/effects.ts) — the two must agree or units get gassed while visibly
  // clear of the cloud, and the hazard avoidance in engine/units.ts looks broken.
  if (tags.includes('gascloud'))
    return { type: 'gascloud', chance: 1.00, durationMs: 8000, aoeRadius: GAS_CLOUD_RADIUS, dps: 3 }
  if (tags.includes('aoe'))
    return { type: 'aoe',      chance: 1.00, durationMs: 500,  aoeRadius: 72 }
  if (tags.includes('lightning'))
    return { type: 'shock',    chance: 0.50, durationMs: 600 }
  if (tags.includes('poison'))
    return { type: 'poison',   chance: 0.65, durationMs: 5000, dps: 5 }
  return undefined
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
  isHero?: true
  unit?: RawUnitDef
  heroEffect?: { type: string; amount: number }
  upgradeEffect?: { type: string; amount?: number; damage?: number; range?: number }
  description: string
  lore?: string
}

// ─── Template resolution ──────────────────────────────────

const TEMPLATES = cardsData.templates as Record<string, RawUnitDef>

function resolveUnit(raw: RawUnitDef): UnitTemplate {
  const attackEffect = deriveAttackEffect(raw.tags, raw.attack)
  if (!raw.structureEffect || raw.structureEffect.type !== 'spawn') {
    return attackEffect ? { ...(raw as UnitTemplate), attackEffect } : raw as UnitTemplate
  }
  const { unitTemplateRef, intervalMs } = raw.structureEffect
  const resolved = unitTemplateRef ? TEMPLATES[unitTemplateRef] : undefined
  if (!resolved) {
    const msg = `cards.json: unknown unitTemplateRef '${unitTemplateRef ?? '(none)'}' for unit '${raw.name}' — spawner will produce invalid units`
    console.error('[cards]', msg)
    _pendingValidationErrors.push({ msg, ctx: { unitName: raw.name, unitTemplateRef: unitTemplateRef ?? null } })
  }
  const unitRaw = (resolved ?? {}) as RawUnitDef
  const unitEffect = resolved ? deriveAttackEffect(resolved.tags, resolved.attack) : undefined
  const unitTemplate: UnitTemplate = { ...(unitRaw as unknown as UnitTemplate), ...(unitEffect ? { attackEffect: unitEffect } : {}) }
  return {
    ...(raw as unknown as UnitTemplate),
    ...(attackEffect ? { attackEffect } : {}),
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
      // Deferred: logged to Rollbar via flushCardValidationErrors() called at newGame() time
      _pendingValidationErrors.push({ msg, ctx: { cardName: raw.name, unitRef: raw.unitRef } })
    }
    unit = resolved ? resolveUnit(resolved) : undefined
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

// ─── Theme tag lookup (faction/act tags from cards.json) ──
const THEME_TAGS_BY_NAME = new Map<string, string[]>(
  (cardsData.cards as Array<RawCardDef & { tags?: string[] }>)
    .map(c => [c.name, c.tags ?? []] as [string, string[]])
)

export function getCardThemeTags(name: string): string[] {
  return THEME_TAGS_BY_NAME.get(name) ?? []
}

/** A card's tags: theme tags from cards.json plus the unit's combat tags. */
export function getAllCardTags(card: Card): string[] {
  return [...getCardThemeTags(card.name), ...(card.unit?.tags ?? [])]
}

// Exported shared templates (for backward compatibility)
export const GOBLIN_UNIT  = TEMPLATES['goblin']  as UnitTemplate
export const ARCHER_UNIT  = TEMPLATES['archer']  as UnitTemplate
export const DRAGON_UNIT  = TEMPLATES['dragon']  as UnitTemplate

export const COMMANDER_UNIT     = TEMPLATES['commander']     as UnitTemplate
export const WARLORD_UNIT       = TEMPLATES['warlord']       as UnitTemplate
export const BOSS_FRAGMENT_UNIT = TEMPLATES['boss-fragment'] as UnitTemplate

// ─── Hero Cards ───────────────────────────────────────────
// One hero is randomly injected into each player's deck per game.

export const HERO_CARDS: Card[] = (cardsData.heroCards as RawHeroCard[]).map(raw => ({
  id: raw.id,
  name: raw.name,
  rarity: raw.rarity as CardRarity,
  cost: raw.cost,
  cardType: raw.cardType as CardType,
  isHero: true as const,
  unit: raw.unit ? resolveUnit(raw.unit) : undefined,
  heroEffect: raw.heroEffect as UpgradeEffect | undefined,
  upgradeEffect: raw.upgradeEffect as UpgradeEffect | undefined,
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

export function getCardUnit(cardName: string): UnitTemplate | undefined {
  return CARD_DEFS.find(d => d.name === cardName)?.unit
}

export function rarityStars(r: CardRarity): string {
  const counts: Record<CardRarity, number> = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6, shiny: 4, holofoil: 4, glass: 4 }
  return '\u2605'.repeat(counts[r] ?? 1)
}
