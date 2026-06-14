// Pure logic for hub-world animals (issue #1592).
//
// This module is deliberately free of PixiJS and React so the spawn maths,
// colour-variant resolution, and behaviour-transition tables can be unit
// tested in isolation. The imperative sprite/rendering layer lives in
// `web/src/components/hub/hubAnimals.ts`.
//
// Adding a new animal type is mostly a matter of adding an `AnimalSpec` entry
// to ANIMAL_SPECS below (data: speed, scale, tint palette, render layer,
// navigation mode, spawn rule, predator/prey relations) plus its sprites and a
// thin behaviour hook in hubAnimals.ts that reuses the shared primitives.

export type AnimalType =
  | 'cat' | 'dog' | 'bird' | 'fish'
  | 'butterfly' | 'rabbit' | 'chicken' | 'frog'
  | 'firefly' | 'bat'

// How an animal moves around the map.
export type NavMode =
  | 'street'      // street pathfinding (dogs — but they may leave paths to chase)
  | 'grass'       // greedy step avoiding solids; streets allowed (cats)
  | 'grass-only'  // greedy step on grass only, never streets (rabbits)
  | 'fly'         // free movement over an overlay layer to a target (birds, butterflies)
  | 'pond'        // within pond tiles (fish)
  | 'pond-edge'   // hops along pond-adjacent tiles, plops into water (frogs)
  | 'zone'        // clamped to a rectangular pen (chickens)

export type SpawnSource =
  | 'buildings' | 'npcs' | 'flowers' | 'pondTiles' | 'grass' | 'zones' | 'fixed'

export type RenderLayer = 'sprite' | 'overlay' | 'pond'

export interface AnimalSpec {
  speed: number                       // px/s
  scale: number                       // fraction of the NPC sprite size
  palette: Record<string, number>     // colour-variant tints (applied via sprite.tint)
  layer: RenderLayer                  // overlay = above buildings (flying)
  nav: NavMode
  /** Procedural spawn rule. `fixed` (with a source) means "that many if the
   *  source exists, else 0"; otherwise count = floor(sourceCount / per). */
  spawn: { source: SpawnSource; per?: number; fixed?: number; cap: number }
  fleesFrom?: AnimalType[]            // generic predator/prey
  chases?: AnimalType[]
  dens?: boolean                      // follows the night-in / day-out building schedule
  active?: 'day' | 'night'            // only present during this phase (omit = always)
}

// ── Per-type registry — the single source of truth for animal data ──────────
export const ANIMAL_SPECS: Record<AnimalType, AnimalSpec> = {
  cat: {
    speed: 55, scale: 0.62, layer: 'sprite', nav: 'grass',
    palette: { black: 0x3a3a3a, orange: 0xe8923c, grey: 0x9aa0a6, white: 0xf5f5f0, cream: 0xe8d8b0 },
    spawn: { source: 'buildings', per: 4, cap: 6 },
    fleesFrom: ['dog'], chases: ['bird', 'butterfly'], dens: true,
  },
  dog: {
    speed: 72, scale: 0.72, layer: 'sprite', nav: 'street',
    palette: { brown: 0x8b5a2b, black: 0x3a3a3a, golden: 0xe0b050, tan: 0xc9a06a },
    spawn: { source: 'npcs', per: 4, cap: 4 },
    chases: ['cat', 'rabbit'], dens: true,
  },
  bird: {
    speed: 230, scale: 0.5, layer: 'overlay', nav: 'fly',
    palette: { red: 0xd64545, blue: 0x4f86d6, brown: 0x9c6b3f, yellow: 0xe8d24a },
    spawn: { source: 'fixed', fixed: 8, cap: 8 },
    active: 'day',
  },
  fish: {
    speed: 26, scale: 0.5, layer: 'pond', nav: 'pond',
    palette: { orange: 0xe8923c, silver: 0xc8d0d8, teal: 0x46b0a8 },
    spawn: { source: 'pondTiles', per: 6, cap: 12 },
  },
  butterfly: {
    speed: 45, scale: 0.225, layer: 'overlay', nav: 'fly',
    palette: { orange: 0xe8923c, blue: 0x6db4ff, white: 0xf5f5f0, purple: 0xb07cd6, yellow: 0xf0d24a },
    spawn: { source: 'flowers', per: 2, cap: 5 },
    fleesFrom: ['cat'], active: 'day',
  },
  rabbit: {
    speed: 95, scale: 0.5, layer: 'sprite', nav: 'grass-only',
    palette: { brown: 0x9c6b3f, grey: 0x9aa0a6, white: 0xf5f5f0, sandy: 0xd8c090 },
    spawn: { source: 'grass', fixed: 4, cap: 4 },
    fleesFrom: ['dog'],
  },
  chicken: {
    speed: 45, scale: 0.55, layer: 'sprite', nav: 'zone',
    palette: { white: 0xf5f5f0, brown: 0xb87a3c, speckled: 0xcbb89a, black: 0x3a3a3a },
    spawn: { source: 'zones', per: 6, cap: 8 },
    fleesFrom: ['dog'],
  },
  frog: {
    speed: 60, scale: 0.45, layer: 'sprite', nav: 'pond-edge',
    palette: { green: 0x5bbf52, darkgreen: 0x3a8f46, brown: 0x8b7a3c, spotted: 0x7fae5a },
    spawn: { source: 'pondTiles', per: 8, cap: 4 },
  },
  // Nocturnal fliers — replace the birds & butterflies after dark.
  firefly: {
    speed: 28, scale: 0.2, layer: 'overlay', nav: 'fly',
    palette: { yellow: 0xfff07a, green: 0xc8ff88, warm: 0xffd86a },
    spawn: { source: 'fixed', fixed: 10, cap: 10 },
    active: 'night',
  },
  bat: {
    speed: 170, scale: 0.42, layer: 'overlay', nav: 'fly',
    palette: { black: 0x3a3a4a, brown: 0x5a4a3a, grey: 0x6a6a72 },
    spawn: { source: 'fixed', fixed: 5, cap: 5 },
    active: 'night',
  },
}

export const ANIMAL_TYPES = Object.keys(ANIMAL_SPECS) as AnimalType[]

// Back-compat derived maps (still referenced by tests / docs).
export const TINT_PALETTES = Object.fromEntries(
  ANIMAL_TYPES.map(t => [t, ANIMAL_SPECS[t].palette]),
) as Record<AnimalType, Record<string, number>>

export const ANIMAL_CAPS = Object.fromEntries(
  ANIMAL_TYPES.map(t => [t, ANIMAL_SPECS[t].spawn.cap]),
) as Record<AnimalType, number>

// ── Procedural spawn counts ─────────────────────────────────────────────────
export interface SpawnSources {
  buildings: number
  npcs:      number
  flowers:   number
  pondTiles: number
  grass:     number
  zones:     number
}

/** Derive how many of each procedural animal a town should spawn, by reading
 *  each spec's `spawn` rule against the available `sources`. */
export function computeProceduralCounts(sources: SpawnSources): Record<AnimalType, number> {
  const out = {} as Record<AnimalType, number>
  for (const type of ANIMAL_TYPES) {
    const sp = ANIMAL_SPECS[type].spawn
    let n = 0
    if (sp.source === 'fixed') {
      n = sp.fixed ?? 0
    } else {
      const avail = (sources as unknown as Record<string, number>)[sp.source] ?? 0
      n = sp.fixed != null ? (avail > 0 ? sp.fixed : 0) : Math.floor(avail / (sp.per ?? 1))
    }
    out[type] = Math.max(0, Math.min(sp.cap, n))
  }
  return out
}

// ── Colour variants (applied via PIXI sprite.tint) ──────────────────────────
// Base sprites are neutral grey so a flat tint reads cleanly.

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
export type CatState = 'sleep' | 'sit' | 'flee' | 'chase-bird' | 'play' | 'approach-npc' | 'go-home' | 'inside'
export type DogState = 'follow-owner' | 'roam' | 'bark' | 'wag' | 'chase-cat'

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
  sit:             [3000, 8000],
  sleep:           [6000, 14000],
  'follow-owner':  [4000, 9000],
  roam:            [2000, 5000],
}

export function randomDuration(state: string, rng: () => number = Math.random): number {
  const [lo, hi] = STATE_DURATION_MS[state] ?? [2000, 4000]
  return lo + rng() * (hi - lo)
}
