// Townsfolk composite sprite catalog. A wandering hub-town NPC that isn't a
// card unit is assembled from several 32x32 sprite layers stacked as PIXI
// siblings, each tinted independently — the same trick the pet coat patterns
// and accessories use (see data/petPatterns.ts, data/petAccessories.ts and
// hubAnimals.ts's patternLayers/applyAccessorySprite). A handful of layers and
// a few palettes give millions of distinct-looking townsfolk without an artist
// drawing a single one of them.
//
// Art lives at web/public/sprites/townsfolk-*.svg. Two authoring rules make the
// whole thing work — break either and the layers come apart:
//
//   1. Every body places the head at the SAME coordinates, so the head-attached
//      layers (skin, face, hair, hat) are shared across all bodies instead of
//      being redrawn per body.
//   2. Walk frames animate arms, legs and hems ONLY — the head and shoulders
//      never move. (The older hand-drawn hub-npc-*.svg frames bob the whole
//      body 1px; these deliberately don't.) That's why head-attached layers
//      ship a single frameless SVG and only the body layers have -1/-2/-3.
//
// Tinted layers are filled #ffffff so sprite.tint colours them; untinted layers
// (the shadow's soft black, the eyes' dark brown) carry their own colours and
// are left at the default white tint.

export const TOWNSFOLK_BODIES = ['tunic', 'robe', 'apron'] as const
export const TOWNSFOLK_HAIR   = ['short', 'long', 'bun', 'curly'] as const
export const TOWNSFOLK_HATS   = ['cap', 'wide', 'hood'] as const

export type TownsfolkBody = typeof TOWNSFOLK_BODIES[number]
export type TownsfolkHair = typeof TOWNSFOLK_HAIR[number]
export type TownsfolkHat  = typeof TOWNSFOLK_HATS[number]

export interface TownsfolkLook {
  body:       TownsfolkBody
  hair:       TownsfolkHair
  /** Bare-headed when absent. */
  hat?:       TownsfolkHat
  skin:       number
  outfit:     number
  accent:     number
  hairColour: number
  hatColour:  number
}

export interface TownsfolkLayer {
  /** Sprite filename stem, without the -1/-2/-3 frame suffix. */
  slug:      string
  /** PIXI tint; 0xffffff leaves the SVG's own colours alone. */
  tint:      number
  /** Whether `${slug}-1/-2/-3.svg` exist and should animate with the walk cycle. */
  animated:  boolean
  /** Draw order relative to the base sprite's zIndex. */
  z:         number
}

// ── Palettes ────────────────────────────────────────────────────────────────
// Deliberately muted and earthy: a dozen of these are on screen at once, and
// saturated clothing would pull the eye away from named NPCs and interactables.

export const SKIN_TONES = [
  0xffdcbc, 0xf0c9a0, 0xd9a273, 0xb87f4d, 0xa9713f, 0x7a4a26, 0x5a3418, 0x402410,
]

export const HAIR_COLOURS = [
  0x2a1a0a, 0x4a3018, 0x6b4020, 0x8b5e3c, 0xc8a050, 0xa83a3a, 0xe8e0d8, 0x9aa0a6,
]

export const OUTFIT_COLOURS = [
  0x4a6fa5, 0x3a5a6b, 0x4a8b5c, 0x6b7f3a, 0x8b4a4a, 0xa5793a,
  0x6b4a8b, 0x8b6f5e, 0x5c6b7a, 0xa55a7a, 0x3f7a6b, 0x7a6a3a,
]

export const ACCENT_COLOURS = [
  0xd4af37, 0xe8e0d8, 0x2a2a2a, 0xc05a5a, 0x5ac0a0, 0x8b5e3c,
  0x6b4020, 0xb0b8c0, 0xe0b050, 0x4a4a5a,
]

export const HAT_COLOURS = [
  0x8b5e3c, 0x2a2a2a, 0x6b4020, 0x4a5a6b, 0xa5793a, 0x5a6b4a, 0xc05a5a, 0xe8e0d8,
]

// ── Layer assembly ──────────────────────────────────────────────────────────

const UNTINTED = 0xffffff

/**
 * The full ordered layer stack for a look. `base` is the sprite that owns the
 * hit area and the walk animation (the outfit — the largest silhouette, so it
 * makes the best tap target); `overlays` are cosmetic siblings glued to it,
 * ordered back to front by their `z` offset.
 */
export function townsfolkLayers(look: TownsfolkLook): { base: TownsfolkLayer; overlays: TownsfolkLayer[] } {
  const overlays: TownsfolkLayer[] = [
    { slug: 'townsfolk-shadow',                tint: UNTINTED,        animated: false, z: -0.2 },
    { slug: `townsfolk-${look.body}-accent`,   tint: look.accent,     animated: true,  z:  0.1 },
    { slug: 'townsfolk-skin',                  tint: look.skin,       animated: false, z:  0.2 },
    { slug: 'townsfolk-face',                  tint: UNTINTED,        animated: false, z:  0.3 },
    { slug: `townsfolk-hair-${look.hair}`,     tint: look.hairColour, animated: false, z:  0.4 },
  ]
  if (look.hat) {
    overlays.push({ slug: `townsfolk-hat-${look.hat}`, tint: look.hatColour, animated: false, z: 0.5 })
  }
  return {
    base: { slug: `townsfolk-${look.body}-outfit`, tint: look.outfit, animated: true, z: 0 },
    overlays,
  }
}

/** Every sprite stem the townsfolk catalog can ever reference — used by tests
 *  to assert the art on disk matches the data. */
export function allTownsfolkSlugs(): string[] {
  const slugs = ['townsfolk-shadow', 'townsfolk-skin', 'townsfolk-face']
  for (const body of TOWNSFOLK_BODIES) {
    slugs.push(`townsfolk-${body}-outfit`, `townsfolk-${body}-accent`)
  }
  for (const hair of TOWNSFOLK_HAIR) slugs.push(`townsfolk-hair-${hair}`)
  for (const hat of TOWNSFOLK_HATS) slugs.push(`townsfolk-hat-${hat}`)
  return slugs
}
