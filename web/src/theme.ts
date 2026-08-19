import type { CardRarity } from './game/types'

/**
 * Shared colour palette (#2203) — the single TypeScript source of truth for
 * colours PixiJS canvases need, mirroring tokens.css's dark-theme :root
 * values. CSS can't import a .ts file and this can't import a .css file, so
 * the two are kept in step by convention plus theme.test.ts, which parses
 * tokens.css and fails the build if a value here drifts from it.
 *
 * Before this, changing --accent-gold in tokens.css recoloured every DOM
 * primitive (Panel, Button, Modal) but not a single sprite tint, aura glow,
 * or connector line drawn on a PixiJS canvas — those needed a separate edit,
 * in a different file, in a different language, with no link back to the
 * token change. PixiJS draw code should import from here instead of
 * hardcoding its own hex/rgba literals.
 */
export const PALETTE = {
  accentGold:   '#ffcc00',
  accentEmber:  '#ff4444',
  accentArcane: '#e040fb',
  accentBlood:  '#6a2288',
  surface0:     '#0a0a0a',
  surface1:     '#111111',
  surface2:     '#1a1a1a',
  surface3:     '#1c1c26',
  surface4:     '#262633',
} as const

export type PaletteKey = keyof typeof PALETTE

/** '#rrggbb' or '#rgb' → the numeric form Pixi's tint/fill/stroke APIs expect. */
export function toPixiColor(hex: string): number {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  return parseInt(full, 16)
}

export const PALETTE_HEX: Record<PaletteKey, number> = Object.fromEntries(
  (Object.entries(PALETTE) as [PaletteKey, string][]).map(([k, v]) => [k, toPixiColor(v)])
) as Record<PaletteKey, number>

/**
 * Rarity → colour (#2206). Previously defined independently in four
 * components (CardDetailModal, AugmentPickerModal, CodexScreen,
 * CardAugmentScreen — the last of which had drifted to a stale green
 * `common: '#55cc55'` left over from the pre-#2177 terminal theme) plus two
 * CSS files (collection.css's .rarity-badge--*, cards.css's --card-frame),
 * none of which agreed with each other. `Record<CardRarity, string>` makes
 * adding a rarity to the CardRarity union a compile error here until its
 * colour is defined, instead of a silent '#fff'/undefined fallback at the
 * call site.
 *
 * This is the *text* colour — the shade used for rarity-coloured labels,
 * stars and names. cards.css's --card-frame (border/background tint) uses
 * the same value for every rarity except common, which intentionally uses a
 * separate, dimmer steel (#555, var(--color-gray-6)) as its frame — common
 * is meant to read as neutral chrome, not as a coloured label. See
 * theme.test.ts for where that one exception is asserted explicitly rather
 * than silently allowed to drift.
 */
export const RARITY_COLOR: Record<CardRarity, string> = {
  common:    '#999999',
  uncommon:  '#4499ff',
  rare:      '#bb66ff',
  epic:      '#ff8800',
  legendary: '#ffcc00',
  mythic:    '#e040fb',
  shiny:     '#ffe066',
  holofoil:  '#40e0d0',
  glass:     '#a0d8ef',
}

export const RARITY_COLOR_HEX: Record<CardRarity, number> = Object.fromEntries(
  (Object.entries(RARITY_COLOR) as [CardRarity, string][]).map(([k, v]) => [k, toPixiColor(v)])
) as Record<CardRarity, number>
