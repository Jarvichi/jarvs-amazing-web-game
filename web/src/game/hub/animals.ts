// Pure logic for hub-world animals (issue #1592).
//
// This module is deliberately free of PixiJS and React so the spawn maths,
// colour-variant resolution, and behaviour-transition tables can be unit
// tested in isolation. The imperative sprite/rendering layer lives in
// `web/src/components/hub/hubAnimals.ts`.

export type AnimalType = 'cat' | 'dog' | 'bird' | 'fish'

// ── Procedural spawn ratios ─────────────────────────────────────────────────
// Cats: 1 per 4 buildings · Dogs: 1 per 4 NPCs · Birds: 4 per town ·
// Fish: 1 per 6 pond tiles.
export const ANIMAL_RATIOS = {
  buildingsPerCat: 4,
  npcsPerDog:      4,
  birdsPerTown:    4,
  pondTilesPerFish: 6,
} as const

// Per-type caps keep rendering cost bounded in the largest town (Ravenwatch).
export const ANIMAL_CAPS: Record<AnimalType, number> = {
  cat:  6,
  dog:  4,
  bird: 4,
  fish: 12,
}

export interface ProceduralCounts {
  cat:  number
  dog:  number
  bird: number
  fish: number
}

/** Derive how many of each procedural animal a town should spawn. */
export function computeProceduralCounts(
  buildingCount: number,
  npcCount:      number,
  pondTileCount: number,
): ProceduralCounts {
  const clamp = (type: AnimalType, n: number) => Math.max(0, Math.min(ANIMAL_CAPS[type], n))
  return {
    cat:  clamp('cat',  Math.floor(buildingCount / ANIMAL_RATIOS.buildingsPerCat)),
    dog:  clamp('dog',  Math.floor(npcCount      / ANIMAL_RATIOS.npcsPerDog)),
    bird: clamp('bird', ANIMAL_RATIOS.birdsPerTown),
    fish: clamp('fish', Math.floor(pondTileCount / ANIMAL_RATIOS.pondTilesPerFish)),
  }
}

// ── Colour variants (applied via PIXI sprite.tint) ──────────────────────────
// Base sprites are neutral grey so a flat tint reads cleanly.
export const TINT_PALETTES: Record<AnimalType, Record<string, number>> = {
  cat:  { black: 0x3a3a3a, orange: 0xe8923c, grey: 0x9aa0a6, white: 0xf5f5f0, cream: 0xe8d8b0 },
  dog:  { brown: 0x8b5a2b, black: 0x3a3a3a, golden: 0xe0b050, tan: 0xc9a06a },
  bird: { red: 0xd64545, blue: 0x4f86d6, brown: 0x9c6b3f, yellow: 0xe8d24a },
  fish: { orange: 0xe8923c, silver: 0xc8d0d8, teal: 0x46b0a8 },
}

/**
 * Resolve a colour-variant for an animal to a PIXI tint (0xRRGGBB).
 * `variant` may be a palette key (e.g. "orange"), a hex string
 * ("#e8923c"/"e8923c"/"0xe8923c"), or omitted (random from the type palette).
 */
export function resolveVariantTint(
  type:    AnimalType,
  variant?: string,
  rng:     () => number = Math.random,
): number {
  const palette = TINT_PALETTES[type]
  if (variant) {
    if (variant in palette) return palette[variant]
    const hex = variant.replace(/^#/, '').replace(/^0x/i, '')
    if (/^[0-9a-fA-F]{6}$/.test(hex)) return parseInt(hex, 16)
  }
  const values = Object.values(palette)
  return values[Math.floor(rng() * values.length)]
}

// ── Behaviour transition tables ─────────────────────────────────────────────
// Only the *idle* transitions are weighted here; event-driven states
// (cat flee/chase-bird, dog bark/wag) are triggered by the manager.
export type CatState = 'wander' | 'sit' | 'sleep' | 'follow-player' | 'flee' | 'chase-bird'
export type DogState = 'follow-owner' | 'roam' | 'bark' | 'wag'
export type BirdState = 'perched' | 'fleeing'

export const CAT_IDLE_WEIGHTS: Record<string, number> = {
  wander:          4,
  sit:             3,
  sleep:           2,
  'follow-player': 1,
}

export const DOG_IDLE_WEIGHTS: Record<string, number> = {
  'follow-owner': 5,
  roam:           3,
}

/** Pick a key from a weight table. Higher weight → more likely. */
export function pickWeighted(
  weights: Record<string, number>,
  rng:     () => number = Math.random,
): string {
  const entries = Object.entries(weights)
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let r = rng() * total
  for (const [key, w] of entries) {
    r -= w
    if (r < 0) return key
  }
  return entries[entries.length - 1][0]
}

// Idle-state durations, in milliseconds: [min, max].
export const STATE_DURATION_MS: Record<string, [number, number]> = {
  wander:          [2000, 5000],
  sit:             [3000, 8000],
  sleep:           [6000, 14000],
  'follow-player': [3000, 7000],
  'follow-owner':  [4000, 9000],
  roam:            [2000, 5000],
}

export function randomDuration(state: string, rng: () => number = Math.random): number {
  const [lo, hi] = STATE_DURATION_MS[state] ?? [2000, 4000]
  return lo + rng() * (hi - lo)
}
