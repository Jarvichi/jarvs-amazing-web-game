import { AugmentEffect, AugmentSlot, Card, CardRarity } from './types'
import augmentsData from '../data/augments.json'

// ─── Raw JSON types ───────────────────────────────────────

interface RawAugmentCard {
  id: string
  name: string
  rarity: string
  setName: string
  slot: string
  effect: { attack?: number; attackRange?: number; maxHp?: number; moveSpeed?: number }
  description: string
  lore: string
}

interface RawAugmentSet {
  name: string
  rarity: string
  setBonusDescription: string
  setBonus: { attack?: number; attackRange?: number; maxHp?: number; moveSpeed?: number }
}

// ─── Public types ─────────────────────────────────────────

export interface AugmentSetDef {
  name: string
  rarity: CardRarity
  setBonusDescription: string
  setBonus: AugmentEffect
}

// ─── Parsed data ──────────────────────────────────────────

const _sets: AugmentSetDef[] = (augmentsData.sets as RawAugmentSet[]).map(s => ({
  name: s.name,
  rarity: s.rarity as CardRarity,
  setBonusDescription: s.setBonusDescription,
  setBonus: s.setBonus as AugmentEffect,
}))

const SET_MAP = new Map<string, AugmentSetDef>(_sets.map(s => [s.name, s]))

const _cards: Card[] = (augmentsData.cards as RawAugmentCard[]).map(raw => ({
  id: raw.id,
  name: raw.name,
  rarity: raw.rarity as CardRarity,
  cost: 0,
  cardType: 'augment' as const,
  description: raw.description,
  lore: raw.lore,
  augmentSlot: raw.slot as AugmentSlot,
  augmentEffect: raw.effect as AugmentEffect,
  setName: raw.setName,
}))

const AUGMENT_MAP = new Map<string, Card>(_cards.map(c => [c.name, c]))

// ─── Public API ───────────────────────────────────────────

/** All augment card definitions (one per type). */
export function getAugmentCatalog(): Card[] {
  return _cards
}

/** Look up a single augment card by name. */
export function getAugmentCard(name: string): Card | undefined {
  return AUGMENT_MAP.get(name)
}

/** All 25 set definitions. */
export function getAllAugmentSets(): AugmentSetDef[] {
  return _sets
}

/** Look up a set definition by name, or undefined if not found. */
export function getAugmentSetDef(setName: string): AugmentSetDef | undefined {
  return SET_MAP.get(setName)
}

/** Compute scaled effect for a given augment at a given level.
 *  Each level adds 20% of the base effect: effectValue * (1 + 0.2 * level). */
export function scaledAugmentEffect(baseEffect: AugmentEffect, level: number): AugmentEffect {
  const mult = 1 + 0.2 * level
  return {
    attack:      baseEffect.attack      != null ? Math.round(baseEffect.attack      * mult) : undefined,
    attackRange: baseEffect.attackRange != null ? Math.round(baseEffect.attackRange * mult) : undefined,
    maxHp:       baseEffect.maxHp       != null ? Math.round(baseEffect.maxHp       * mult) : undefined,
    moveSpeed:   baseEffect.moveSpeed   != null ? Math.round(baseEffect.moveSpeed   * mult) : undefined,
  }
}

/** Human-readable label for a slot type. */
export function augmentSlotLabel(slot: AugmentSlot): string {
  const labels: Record<AugmentSlot, string> = {
    helmet:       'Helmet',
    chest:        'Chest',
    arms:         'Arms',
    legs:         'Legs',
    amulet:       'Amulet',
    primaryRanged:'Ranged Weapon',
    heavyMelee:   'Melee Weapon',
  }
  return labels[slot]
}

/** Slot category — 'weapon' or 'armour'. */
export function augmentSlotCategory(slot: AugmentSlot): 'weapon' | 'armour' {
  return slot === 'primaryRanged' || slot === 'heavyMelee' ? 'weapon' : 'armour'
}

export const ALL_AUGMENT_SLOTS: AugmentSlot[] = [
  'helmet', 'chest', 'arms', 'legs', 'amulet', 'primaryRanged', 'heavyMelee',
]
