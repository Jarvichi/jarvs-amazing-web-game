import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const spritesDir = join(here, '..', 'public', 'sprites')

/**
 * 26% of the sprite library turned into palette swaps of a dozen base shapes
 * without anything noticing (#2333) — a player report surfaced it, not the
 * build. This holds the invariant the same way pressFeedback.test.ts holds
 * "every :hover gets an :active": strip what doesn't affect the silhouette,
 * fingerprint what's left, and fail when two base sprites match.
 */
function baseSpriteFiles(): string[] {
  return readdirSync(spritesDir)
    .filter(f => f.endsWith('.svg'))
    // Walk frames legitimately share geometry with their own base/siblings
    // (frame 2 is supposed to equal the static fallback, per AGENTS.md) —
    // only {slug}.svg files are compared against each other.
    .filter(f => !/-[123]\.svg$/.test(f))
}

/** Comments and colour carry no silhouette — what's left is the geometry. */
function fingerprint(file: string): string {
  const svg = readFileSync(join(spritesDir, file), 'utf8')
    // `(-->|$)` rather than a bare `-->`: an unterminated `<!--` (malformed
    // SVG) would otherwise survive the strip untouched (CodeQL
    // js/incomplete-multi-character-sanitization) — matching through
    // end-of-string closes it out instead of leaving a residual `<!--`.
    .replace(/<!--[\s\S]*?(-->|$)/g, '')
    .replace(/(fill|stroke)="[^"]*"/g, '')
  return svg.replace(/\s+/g, ' ').trim()
}

function cloneGroups(): string[][] {
  const byFingerprint = new Map<string, string[]>()
  for (const file of baseSpriteFiles()) {
    const fp = fingerprint(file)
    const list = byFingerprint.get(fp) ?? []
    list.push(file)
    byFingerprint.set(fp, list)
  }
  return [...byFingerprint.values()].filter(names => names.length > 1)
}

/** Stable identity for a group regardless of file-read order. */
function groupKey(names: string[]): string {
  return [...names].sort().join(', ')
}

/**
 * Known clone groups awaiting a bespoke redraw (#2333, #2334, #2336). Each
 * entry is removed once its members are drawn distinctly from each other —
 * the list shrinking is the progress bar. The chapter-2 boss sprites (#2335)
 * are already off this list. `keeps the exception list honest` below fails
 * the moment an entry no longer matches a real clone group, so it can't
 * quietly license some future, unrelated clone under the same key.
 */
const ALLOWED_SPRITE_CLONES = new Map<string, string>([
  [groupKey(['anc-altar.svg', 'ancient-altar.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['anc-grove.svg', 'ancient-grove.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['arcane-golem.svg', 'golem.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['archive-warden.svg', 'company-sergeant.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['banner-chanter.svg', 'banner-herald.svg', 'choir-of-the-candles.svg', 'choir-of-the-reaches.svg', 'choir-of-the-remembered.svg', 'choir-of-the-vigil.svg', 'diadem-bearer.svg', 'diadem-chanter.svg', 'road-chanter.svg', 'road-herald.svg', 'ward-herald.svg', 'window-chanter.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['banner-foundry.svg', 'candle-foundry.svg', 'diadem-foundry.svg', 'vigil-foundry.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['barnacle-guard.svg', 'bonewood-guard.svg', 'frost-guard.svg', 'marsh-guard.svg', 'masked-guard.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['beacon-sentry.svg', 'effigy-watch.svg', 'milestone-effigy.svg', 'reading-room-sentry.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['beacon-tower.svg', 'watch-lectern.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['blossom-foundry.svg', 'glass-foundry.svg', 'mask-foundry.svg', 'pearl-foundry.svg', 'snowmelt-foundry.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['blossom-sentry.svg', 'glass-sentry.svg', 'mask-sentry.svg', 'pearl-sentry.svg', 'snowbound-sentry.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['bonewood-knight.svg', 'drowned-knight.svg', 'frostbound-knight.svg', 'marsh-knight.svg', 'masked-knight.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['bonewood-scout.svg', 'glasswater-scout.svg', 'rime-herald.svg', 'silver-herald.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['bonewood-watchtower.svg', 'envoy-watchtower.svg', 'hollow-watchtower.svg', 'marsh-watchtower.svg', 'rime-watchtower.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['candle-acolyte.svg', 'lamp-acolyte.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['candle-archer.svg', 'reach-archer.svg', 'throne-archer.svg', 'vigil-archer.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['candle-automaton.svg', 'cataloguer-automaton.svg', 'effigy-granary.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['candle-runner.svg', 'crown-sentry.svg', 'marshal-courier.svg', 'procession-courier.svg', 'procession-runner.svg', 'reach-runner.svg', 'regalia-courier.svg', 'rite-sentry.svg', 'throne-runner.svg', 'vigil-walker.svg', 'ward-courier.svg', 'window-sentry.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['candle-sconce.svg', 'reach-sconce.svg', 'throne-sconce.svg', 'vigil-sconce.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['candle-sentry.svg', 'reach-sentry.svg', 'road-sentry.svg', 'throne-sentry.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['candle-watchtower.svg', 'reach-watchtower.svg', 'road-watchtower.svg', 'throne-watchtower.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['candlebound-knight.svg', 'crownbound-knight.svg', 'diadembound-knight.svg', 'roadbound-knight.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['causeway-archer.svg', 'granary-archer.svg', 'mist-archer.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['causeway-chorus.svg', 'chorus-of-the-threshing-floor.svg', 'unremembered-choir.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['causeway-rail.svg', 'grain-palisade.svg', 'shelf-barricade.svg', 'wax-barricade.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['centaur-stable.svg', 'cntaur-stbl.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['choir-of-echoes.svg', 'choir-of-frost.svg', 'choir-of-masks.svg', 'choir-of-roots.svg', 'choir-of-the-drowned.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['choir-of-sealed-names.svg', 'choir-of-watch-flames.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['cmd-tent.svg', 'command-tent.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['company-courier.svg', 'sealed-courier.svg', 'threshing-rider.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['court-attendant.svg', 'grove-tender.svg', 'marsh-skulker.svg', 'waiting-scout.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['court-automaton.svg', 'drowned-automaton.svg', 'frost-automaton.svg', 'grove-automaton.svg', 'reflection-automaton.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['court-courier.svg', 'marsh-runner.svg', 'orchard-courier.svg', 'tide-courier.svg', 'winter-courier.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['court-vanguard.svg', 'envoy-vanguard.svg', 'marsh-vanguard.svg', 'orchard-vanguard.svg', 'winter-vanguard.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['crown-automaton.svg', 'procession-automaton.svg', 'rite-automaton.svg', 'ward-automaton.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['crown-guard.svg', 'crown-vanguard.svg', 'rite-guard.svg', 'rite-vanguard.svg', 'vigil-guard.svg', 'vigil-vanguard.svg', 'ward-guard.svg', 'ward-vanguard.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['driftwood-archer.svg', 'grove-archer.svg', 'icebound-archer.svg', 'reedline-archer.svg', 'silver-archer.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['echo-caller.svg', 'hollow-chanter.svg', 'hollow-tidecaller.svg', 'rime-chanter.svg', 'root-chanter.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['frost-barricade.svg', 'reach-barricade.svg', 'reed-barricade.svg', 'road-barricade.svg', 'root-barricade.svg', 'sunken-barricade.svg', 'throne-barricade.svg', 'velvet-barricade.svg', 'ward-barricade.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['frost-runner.svg', 'masked-page.svg', 'reed-strider.svg', 'sapling-runner.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['frost-sconce.svg', 'root-sconce.svg', 'still-bell.svg', 'velvet-sconce.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['granary.svg', 'warehouse.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['grey-rider.svg', 'pale-rider.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['healer-hut.svg', 'healer-s-hut.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['hollow-cataloguer.svg', 'hollow-snuffer.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['index-engine.svg', 'wick-foundry.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['index-warden.svg', 'lamplighter-cadet.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['jarv-gold.svg', 'jarv-green.svg', 'jarv-red.svg', 'jarv.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['knight-of-the-granary.svg', 'stackbound-knight.svg', 'wickbound-knight.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['lectern-archer.svg', 'sconce-archer.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['milestone-cairn.svg', 'sheaf-cairn.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['pale-vanguard.svg', 'toll-escort.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['pattern-cat-calico-white-sleep.svg', 'pattern-cat-tuxedo-white-sleep.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['pattern-cat-calico-white.svg', 'pattern-cat-tuxedo-white.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['reading-lamp.svg', 'watch-lamp.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['register-bearer.svg', 'wax-bearer.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['sealed-archive.svg', 'sealed-grovehouse.svg', 'sealed-icehouse.svg', 'sealed-millpond.svg', 'sealed-tidegate.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['sealed-bulwark.svg', 'sealed-chantry.svg', 'sealed-reliquary.svg', 'sealed-waystation.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['sealed-sconce.svg', 'sealed-stack.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['shadow-acad.svg', 'shadow-academy.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['stack-runner.svg', 'wick-runner.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['the-echo.svg', 'the-grafted-bloom.svg', 'the-undertow.svg', 'the-unmasked.svg', 'the-waited-cold.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['the-endless-procession.svg', 'the-last-banner.svg', 'the-last-rite.svg', 'the-last-vigil.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['the-pale-marshal.svg', 'the-procession-master.svg', 'the-vigil-king.svg', 'the-vigil-queen.svg']), 'pending redraw — tracked in #2333'],
  [groupKey(['the-unbound-flame.svg', 'the-unbound-index.svg']), 'pending redraw — tracked in #2333'],
])

describe('no two base sprites share a colour-stripped silhouette', () => {
  const groups = cloneGroups()

  it('has no unlisted sprite clone group', () => {
    const unlisted = groups
      .filter(names => !ALLOWED_SPRITE_CLONES.has(groupKey(names)))
      .map(names => groupKey(names))
      .sort()

    expect(
      unlisted,
      'These base sprites are colour-only recolours of each other (same geometry, ' +
      'different fill/stroke) — draw a bespoke silhouette for each, or add the group ' +
      'to ALLOWED_SPRITE_CLONES with a reason.',
    ).toEqual([])
  })

  it('keeps the exception list honest', () => {
    const realGroupKeys = new Set(groups.map(groupKey))
    const stale = [...ALLOWED_SPRITE_CLONES.keys()].filter(k => !realGroupKeys.has(k))
    expect(stale, 'ALLOWED_SPRITE_CLONES entries that no longer match a real clone group').toEqual([])
  })
})
