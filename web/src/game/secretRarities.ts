import { Card, CardRarity } from './types'

/** 1-in-N chance any drawn card becomes a secret rare. */
export const SECRET_RARITY_ODDS = 1000

type SecretType = 'mythic' | 'shiny' | 'holofoil' | 'glass'

/** Roll for a secret-rare trigger. Returns the type if triggered, null otherwise. */
export function rollSecretRarity(): SecretType | null {
  if (Math.random() >= 1 / SECRET_RARITY_ODDS) return null
  const r = Math.random()
  if (r < 0.25) return 'mythic'
  if (r < 0.50) return 'shiny'
  if (r < 0.75) return 'holofoil'
  return 'glass'
}

/** Stamp a unique runtime ID onto a card without mutating the original. */
function secretId(card: Card, suffix: string): string {
  return `${card.id}-${suffix}-${Math.random().toString(36).slice(2, 7)}`
}

export function makeShinyVariant(card: Card): Card {
  return {
    ...card,
    id: secretId(card, 'shiny'),
    name: `Shiny ${card.name}`,
    rarity: 'shiny' as CardRarity,
    variant: 'shiny',
    unit: card.unit ? { ...card.unit, cardVariant: 'shiny' } : undefined,
  }
}

export function makeHolofoilVariant(card: Card): Card {
  return {
    ...card,
    id: secretId(card, 'holo'),
    name: `Holo ${card.name}`,
    rarity: 'holofoil' as CardRarity,
    variant: 'holofoil',
    unit: card.unit ? { ...card.unit, cardVariant: 'holofoil' } : undefined,
  }
}

export function makeGlassVariant(card: Card): Card {
  const boostedUnit = card.unit ? {
    ...card.unit,
    attack: Math.round(card.unit.attack * 1.6),
    maxHp: Math.round(card.unit.maxHp * 1.4),
    cardVariant: 'glass' as const,
  } : undefined
  return {
    ...card,
    id: secretId(card, 'glass'),
    name: `Glass ${card.name}`,
    rarity: 'glass' as CardRarity,
    variant: 'glass',
    cost: Math.max(0, card.cost - 1),
    glassBreakChance: 0.35,
    unit: boostedUnit,
  }
}
