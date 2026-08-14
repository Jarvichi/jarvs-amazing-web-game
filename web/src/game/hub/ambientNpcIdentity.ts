// ─── Identity for wandering hub-town NPCs ───────────────────────────────────
//
// The town's wandering ("ambient") NPCs used to be pure rendering state: no id,
// no name, and a sprite picked from whatever unit cards happened to be in the
// player's deck. This mints them an identity instead — a name nobody else in
// town shares, and a look that's either a tinted composite townsfolk (see
// data/townsfolk.ts) or one of the game's several hundred unit-card sprites.
//
// Deliberately free of PIXI and of anything that touches localStorage: a roster
// is a plain seeded generator, so it can be unit-tested and reasoned about
// without a canvas. A roster lives for one town visit — wanderers were never
// persisted across reloads, and giving them save-file presence isn't the goal.

import { hashStr, makeSeededRng, seededShuffle } from '../seededRandom'
import { RESIDENT_FIRST_NAMES, WANDERER_SURNAMES } from '../names'
import {
  TOWNSFOLK_BODIES, TOWNSFOLK_HAIR, TOWNSFOLK_HATS,
  SKIN_TONES, HAIR_COLOURS, OUTFIT_COLOURS, ACCENT_COLOURS, HAT_COLOURS,
  type TownsfolkLook,
} from '../../data/townsfolk'

export type AmbientNpcLook =
  | ({ kind: 'townsfolk' } & TownsfolkLook)
  | { kind: 'unit'; slug: string }

export interface AmbientNpcIdentity {
  /** Unique within a roster; also the seed for this NPC's dialogue queue. */
  id:   string
  name: string
  look: AmbientNpcLook
}

export interface AmbientRoster {
  /** Mints one wanderer. Never returns a name another live wanderer holds. */
  mint(): AmbientNpcIdentity
  /** Hands a wanderer's name back to the pool when they despawn. */
  release(id: string): void
  /** Live wanderer count — mostly for tests and debugging. */
  size(): number
}

export interface AmbientRosterOptions {
  /** Anything stable per town visit; hashed, so a string or number both work. */
  seed: number | string
  /** Card-sprite slugs this town may dress wanderers in, most-preferred first. */
  unitSlugs: string[]
  /** Fraction of wanderers built as composite townsfolk rather than card units. */
  townsfolkShare?: number
}

const DEFAULT_TOWNSFOLK_SHARE = 0.6

/** Chance a townsfolk wanderer wears a hat at all (the rest go bare-headed). */
const HAT_CHANCE = 0.45

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length) % arr.length]
}

function makeTownsfolkLook(rng: () => number): AmbientNpcLook {
  return {
    kind:       'townsfolk',
    body:       pick(TOWNSFOLK_BODIES, rng),
    hair:       pick(TOWNSFOLK_HAIR, rng),
    hat:        rng() < HAT_CHANCE ? pick(TOWNSFOLK_HATS, rng) : undefined,
    skin:       pick(SKIN_TONES, rng),
    outfit:     pick(OUTFIT_COLOURS, rng),
    accent:     pick(ACCENT_COLOURS, rng),
    hairColour: pick(HAIR_COLOURS, rng),
    hatColour:  pick(HAT_COLOURS, rng),
  }
}

/**
 * Creates the identity generator for one town visit.
 *
 * Names come from a seeded shuffle of first x surname pairs, walked in order
 * and skipping any name a live wanderer already holds — so a town never shows
 * two Miras at once, and a released name can come back later on somebody new.
 * (The city builder's residentName() deliberately has no such guarantee: it's a
 * pure function of grid position and tolerates collisions. Reuse its name pool,
 * not its uniqueness story.)
 */
export function createAmbientRoster(opts: AmbientRosterOptions): AmbientRoster {
  const seed = typeof opts.seed === 'number' ? opts.seed : hashStr(opts.seed)
  const rng = makeSeededRng(seed ^ 0x7a11d0)
  const share = opts.townsfolkShare ?? DEFAULT_TOWNSFOLK_SHARE

  // Full name space, shuffled once. 104 first names x 40 surnames is far more
  // than a town of a dozen needs, so the walk never realistically runs dry —
  // but wrap anyway rather than risk an infinite loop if it somehow does.
  const firstNames = seededShuffle(RESIDENT_FIRST_NAMES, rng)
  const surnames   = seededShuffle(WANDERER_SURNAMES, rng)
  const unitSlugs  = opts.unitSlugs.length > 0 ? opts.unitSlugs : []

  const taken = new Map<string, string>()  // id -> name
  const inUse = new Set<string>()
  let nameCursor = 0
  let minted = 0

  function nextName(): string {
    const total = firstNames.length * surnames.length
    for (let i = 0; i < total; i++) {
      const at = (nameCursor + i) % total
      const name = `${firstNames[at % firstNames.length]} ${surnames[Math.floor(at / firstNames.length) % surnames.length]}`
      if (!inUse.has(name)) {
        nameCursor = at + 1
        return name
      }
    }
    // Every combination is live at once — impossible for a town of a dozen, but
    // returning something is better than looping forever.
    return `${firstNames[0]} ${surnames[0]} ${inUse.size}`
  }

  return {
    mint(): AmbientNpcIdentity {
      const id = `wanderer-${seed.toString(36)}-${minted++}`
      const name = nextName()
      inUse.add(name)
      taken.set(id, name)
      const wantsTownsfolk = unitSlugs.length === 0 || rng() < share
      const look = wantsTownsfolk
        ? makeTownsfolkLook(rng)
        : { kind: 'unit' as const, slug: pick(unitSlugs, rng) }
      return { id, name, look }
    },
    release(id: string): void {
      const name = taken.get(id)
      if (name === undefined) return
      taken.delete(id)
      inUse.delete(name)
    },
    size: () => taken.size,
  }
}

/**
 * Orders a town's wanderer sprite pool: the sprites its config nominates first
 * (so Millhaven still reads as a fishing town), then the rest of the catalog
 * seeded-shuffled behind them. Duplicates are dropped, preference order kept.
 */
export function buildUnitSlugPool(preferred: string[], catalog: string[], seed: number | string): string[] {
  const s = typeof seed === 'number' ? seed : hashStr(seed)
  const seen = new Set<string>()
  const out: string[] = []
  for (const slug of preferred) {
    if (slug && !seen.has(slug)) { seen.add(slug); out.push(slug) }
  }
  for (const slug of seededShuffle(catalog, makeSeededRng(s ^ 0x5109))) {
    if (slug && !seen.has(slug)) { seen.add(slug); out.push(slug) }
  }
  return out
}
