import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const stylesDir = join(here, 'styles')

/**
 * `:hover` never fires on touch, so a control whose only feedback is a hover
 * rule tells a phone player nothing when they tap it — for anything slow, that
 * reads as a dead button. AGENTS.md states the invariant ("a new hover-only
 * control is a regression"); this is what actually holds it, the same way
 * theme.test.ts holds tokens.css and theme.ts together.
 *
 * It parses the stylesheets rather than the rendered page because that's where
 * the pairing lives: every `:hover` on an interactive element should have an
 * `:active` covering the same element, either on the selector itself or on a
 * base class the element also carries.
 */
function stylesheets(): string[] {
  return readdirSync(stylesDir).filter(f => f.endsWith('.css'))
}

/** The element a state selector applies to, with the state and any guards removed. */
function baseOf(selector: string): string {
  return selector
    .replace(/:(hover|active)\b/g, '')
    .replace(/:not\([^)]*\)/g, '')
    .trim()
}

interface Rule { base: string; hover: boolean; active: boolean; file: string }

function collect(): Rule[] {
  const out: Rule[] = []
  for (const file of stylesheets()) {
    // Comments first: a selector inside one isn't a rule, and `/* .foo:hover */`
    // would otherwise register as an unpaired control.
    const css = readFileSync(join(stylesDir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    // Declaration blocks only — the selector list is everything between the
    // previous brace and this one. Splitting on lines instead would read only
    // the last line of a multi-line, comma-separated selector list.
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const raw of m[1].split(',')) {
        const sel = raw.trim()
        if (!sel) continue
        const hover = sel.includes(':hover')
        const active = sel.includes(':active')
        if (hover || active) out.push({ base: baseOf(sel), hover, active, file })
      }
    }
  }
  return out
}

/**
 * Deliberate exceptions. Each is a `:hover` that should NOT gain an `:active`,
 * with the reason — anything else with a hover rule is a control a player can
 * press, and needs to say so when they do.
 */
const ALLOWED_HOVER_ONLY = new Map<string, string>([
  ['::-webkit-scrollbar-thumb', 'not a touch target — touch scrolling never grabs the thumb'],
  ['.card-tile--disabled', 'disabled: its hover rule exists to cancel the lift, not to invite a press'],
  ['.action-btn--noborder-disabled', 'disabled'],
  ['.event-choice .event-choice-consequence',
    'styles a child of the tap target; the pressable parent .event-choice carries the :active'],
  ['.news-chapter__main--tappable .news-chapter__title',
    'styles a child of the tap target; .news-chapter__main--tappable carries the :active'],
])

describe('every clickable element has press feedback', () => {
  const rules = collect()
  const active = new Set(rules.filter(r => r.active).map(r => r.base))

  /** A `--modifier` inherits its base class's `:active`: the element carries both. */
  function coveredByBaseClass(base: string): boolean {
    let s = base
    while (s.includes('--')) {
      s = s.slice(0, s.lastIndexOf('--'))
      if (active.has(s)) return true
    }
    return false
  }

  it('has no :hover rule without a matching :active', () => {
    const unpaired = rules
      .filter(r => r.hover)
      .filter(r => !active.has(r.base))
      .filter(r => !coveredByBaseClass(r.base))
      .filter(r => !ALLOWED_HOVER_ONLY.has(r.base))
      .map(r => `${r.file}: ${r.base}`)

    expect(
      [...new Set(unpaired)].sort(),
      'These have a :hover but no :active, so they give a touch device no press ' +
      'feedback. Add one (AGENTS.md has a table picking the treatment from the ' +
      "control's shape), or add it to ALLOWED_HOVER_ONLY with the reason.",
    ).toEqual([])
  })

  it('keeps the exception list honest', () => {
    // An exception for a selector that no longer has a hover rule is stale, and
    // would silently license a future hover-only control of the same name.
    const hovered = new Set(rules.filter(r => r.hover).map(r => r.base))
    const stale = [...ALLOWED_HOVER_ONLY.keys()].filter(k => !hovered.has(k))
    expect(stale, 'ALLOWED_HOVER_ONLY entries with no :hover rule left').toEqual([])
  })
})
