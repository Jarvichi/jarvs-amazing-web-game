import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { PALETTE, RARITY_COLOR } from './theme'

const here = dirname(fileURLToPath(import.meta.url))
const stylesDir = join(here, 'styles')

/**
 * theme.ts and the CSS token layer can't import each other, so this is what
 * stands in for that — it parses the raw CSS and fails the moment a value
 * here and a value there disagree, instead of letting them drift silently
 * the way the five/six independent rarity-colour copies did before #2206.
 */
function readCss(file: string): string {
  return readFileSync(join(stylesDir, file), 'utf8')
}

/** Resolves one level of `var(--other-token)` indirection against the same :root block. */
function resolveToken(rootBlock: string, value: string): string {
  const ref = value.match(/^var\((--[a-z0-9-]+)\)$/)
  if (!ref) return value
  const aliased = rootBlock.match(new RegExp(`${ref[1]}:\\s*([^;]+);`))
  if (!aliased) throw new Error(`theme.test.ts: couldn't resolve ${value} — is ${ref[1]} defined in :root?`)
  return resolveToken(rootBlock, aliased[1].trim())
}

function tokenValue(rootBlock: string, name: string): string {
  const m = rootBlock.match(new RegExp(`${name}:\\s*([^;]+);`))
  if (!m) throw new Error(`theme.test.ts: ${name} not found in tokens.css :root`)
  return resolveToken(rootBlock, m[1].trim()).toLowerCase()
}

describe('theme.ts stays in step with tokens.css', () => {
  // Only the :root block — html.light-mode reuses the same custom property
  // names for different values, which isn't what PALETTE mirrors.
  const rootBlock = readCss('tokens.css').split('html.light-mode')[0]

  const cases: [keyof typeof PALETTE, string][] = [
    ['accentGold', '--accent-gold'],
    ['accentEmber', '--accent-ember'],
    ['accentArcane', '--accent-arcane'],
    ['accentBlood', '--accent-blood'],
    ['surface0', '--surface-0'],
    ['surface1', '--surface-1'],
    ['surface2', '--surface-2'],
    ['surface3', '--surface-3'],
    ['surface4', '--surface-4'],
  ]

  it.each(cases)('PALETTE.%s matches tokens.css %s', (key, cssVar) => {
    const cssValue = tokenValue(rootBlock, cssVar)
    const themeValue = PALETTE[key].toLowerCase()
    // tokens.css shorthands 3-digit hex sometimes and not others (#111 vs
    // #ffcc00) — normalise both sides to 6-digit before comparing.
    const normalise = (h: string) => {
      const s = h.replace('#', '')
      return s.length === 3 ? s.split('').map(c => c + c).join('') : s
    }
    expect(normalise(themeValue)).toBe(normalise(cssValue))
  })
})

describe('RARITY_COLOR stays in step with cards.css and collection.css', () => {
  const cardsCss = readCss('cards.css')
  const collectionCss = readCss('collection.css')
  const tokensRoot = readCss('tokens.css').split('html.light-mode')[0]

  function resolveMaybeVar(value: string): string {
    const ref = value.match(/^var\((--[a-z0-9-]+)\)$/)
    if (!ref) return value.toLowerCase()
    return tokenValue(tokensRoot, ref[1])
  }

  const normalise = (h: string) => {
    const s = h.replace('#', '').toLowerCase()
    return s.length === 3 ? s.split('').map(c => c + c).join('') : s
  }

  // common is the one deliberate exception: cards.css gives it a dimmer
  // steel frame (var(--color-gray-6), #555) rather than the rarity label's
  // own grey (#999999) — common is meant to read as neutral chrome, not as
  // a coloured label. See the comment on RARITY_COLOR in theme.ts.
  const rarities = (Object.keys(RARITY_COLOR) as (keyof typeof RARITY_COLOR)[])
    .filter(r => r !== 'common')

  it.each(rarities)('cards.css --card-frame for .card-tile--%s matches RARITY_COLOR', rarity => {
    const m = cardsCss.match(new RegExp(`\\.card-tile--${rarity}\\s*\\{[^}]*--card-frame:\\s*([^;]+);`))
    if (!m) throw new Error(`.card-tile--${rarity} not found in cards.css`)
    expect(normalise(resolveMaybeVar(m[1].trim()))).toBe(normalise(RARITY_COLOR[rarity]))
  })

  const badgedRarities: (keyof typeof RARITY_COLOR)[] = ['uncommon', 'rare', 'epic', 'legendary', 'mythic', 'shiny', 'holofoil', 'glass']

  it.each(badgedRarities)('collection.css .rarity-badge--%s matches RARITY_COLOR', rarity => {
    const m = collectionCss.match(new RegExp(`\\.rarity-badge--${rarity}\\s*\\{\\s*color:\\s*([^;]+);`))
    if (!m) throw new Error(`.rarity-badge--${rarity} not found in collection.css`)
    expect(normalise(resolveMaybeVar(m[1].trim()))).toBe(normalise(RARITY_COLOR[rarity]))
  })
})
