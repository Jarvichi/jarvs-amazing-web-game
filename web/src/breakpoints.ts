/**
 * Desktop/tablet breakpoints (#2183), mirrored in tokens.css as
 * --breakpoint-tablet / --breakpoint-desktop / --breakpoint-desktop-lg.
 *
 * CSS custom properties can't be read inside an `@media` condition (that
 * needs the still-unshipped-here Custom Media Queries spec / a PostCSS
 * plugin this repo doesn't have), so every `@media (min-width: …)` rule
 * for these tiers has to repeat the literal pixel value instead of
 * `var(--breakpoint-*)`. This file — checked against every such rule by
 * breakpoints.test.ts — is what keeps those literals from drifting apart
 * the way the rarity colours did before #2206.
 */
export const BREAKPOINT = {
  tablet: 768,
  desktop: 1024,
  desktopLg: 1440,
} as const
