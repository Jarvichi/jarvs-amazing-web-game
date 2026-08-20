import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { BREAKPOINT } from './breakpoints'

const here = dirname(fileURLToPath(import.meta.url))
const stylesDir = join(here, 'styles')

/**
 * Every `@media (min-width: …)` rule is a desktop/tablet tier (#2183) — the
 * only narrower breakpoints in this codebase are `max-width`. This test is
 * what stands in for reading a shared CSS variable inside `@media`, which
 * plain CSS can't do here (see breakpoints.ts): it fails the moment a new
 * min-width rule uses a value that isn't one of BREAKPOINT's three tiers.
 */
describe('every min-width media query matches a canonical breakpoint', () => {
  const canonical = new Set<number>(Object.values(BREAKPOINT))

  const cssFiles = readdirSync(stylesDir).filter(f => f.endsWith('.css'))
  const found: { file: string; px: number }[] = []
  for (const file of cssFiles) {
    const text = readFileSync(join(stylesDir, file), 'utf8')
    for (const m of text.matchAll(/@media\s*\(min-width:\s*(\d+)px\)/g)) {
      found.push({ file, px: Number(m[1]) })
    }
  }

  it('found at least one min-width rule to check', () => {
    expect(found.length).toBeGreaterThan(0)
  })

  it.each(found)('$file uses a canonical breakpoint ($pxpx)', ({ px }) => {
    expect(canonical.has(px)).toBe(true)
  })

  it('tokens.css documents the same three values', () => {
    const tokens = readFileSync(join(stylesDir, 'tokens.css'), 'utf8')
    const rootBlock = tokens.split('html.light-mode')[0]
    for (const [key, px] of Object.entries(BREAKPOINT)) {
      const varName = `--breakpoint-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`
      const m = rootBlock.match(new RegExp(`${varName}:\\s*(\\d+)px;`))
      expect(m, `tokens.css should define ${varName}`).toBeTruthy()
      expect(Number(m![1])).toBe(px as number)
    }
  })
})
