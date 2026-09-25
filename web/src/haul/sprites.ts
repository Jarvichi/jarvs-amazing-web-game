// ─── /haul: pixel art ───────────────────────────────────────────────────────
//
// 10×10 sprites in palette hex digits ('.' is clear), all facing right; the
// renderer flips them for left. Two frames each for a walk cycle. Scared
// ghouls are the same drawings recoloured, so they keep their shapes.

import { makeSprite, type Sprite } from '../arcade/gfx'
import type { GhoulKind, Hero } from './world'

type Rows = string[]

const HERO_ART: Record<Hero, [Rows, Rows]> = {
  // Purple hat with a gold band, silver hair, dark glasses, a staff.
  witch: [
    [
      '....2.....',
      '...22.....',
      '...2a2....',
      '.22222222.',
      '...767...d',
      '...00f...c',
      '..22222.d.',
      '.2a2222.d.',
      '..22222.d.',
      '..2...2...',
    ],
    [
      '....2.....',
      '...22.....',
      '...2a2....',
      '.22222222.',
      '...767...d',
      '...00f...c',
      '..22222.d.',
      '.2a2222.d.',
      '..22222.d.',
      '...2.2....',
    ],
  ],
  // Cowl with ears, grey suit, gold belt, a long black cape.
  hero: [
    [
      '..0...0...',
      '..00000...',
      '..0c0c0...',
      '..0fff0...',
      '0..fff....',
      '0055555...',
      '00555550..',
      '00aaaaa0..',
      '0.55.550..',
      '..00.00...',
    ],
    [
      '..0...0...',
      '..00000...',
      '..0c0c0...',
      '..0fff0...',
      '0..fff....',
      '0055555...',
      '00555550..',
      '00aaaaa0..',
      '00.555.0..',
      '...000....',
    ],
  ],
  // Blond hair, dark glasses, cream suit, leopard tie, a wrapped blade.
  salaryman: [
    [
      '...aaa..6.',
      '..aaaaa60.',
      '..a00f.6..',
      '...fff60..',
      '..7797.6..',
      '.779097...',
      '.779997...',
      '..77077...',
      '..77.77...',
      '..44.44...',
    ],
    [
      '...aaa..6.',
      '..aaaaa60.',
      '..a00f.6..',
      '...fff60..',
      '..7797.6..',
      '.779097...',
      '.779997...',
      '..77077...',
      '...777....',
      '...4.4....',
    ],
  ],
}

const GHOUL_ART: Record<GhoulKind, [Rows, Rows]> = {
  bat: [
    [
      '..........',
      '2........2',
      '22..2.2.22',
      '222.222222',
      '2222822822',
      '.22222222.',
      '..2.22.2..',
      '....22....',
      '..........',
      '..........',
    ],
    [
      '..........',
      '..........',
      '....2.2...',
      '...22222..',
      '..2282282.',
      '.22222222.',
      '222.22.222',
      '22..22..22',
      '2........2',
      '..........',
    ],
  ],
  zombie: [
    [
      '...333....',
      '..33333...',
      '..38338...',
      '..33333...',
      '...303....',
      '.3344433..',
      '..44444...',
      '..44444...',
      '..11.11...',
      '..33.33...',
    ],
    [
      '...333....',
      '..33333...',
      '..38338...',
      '..33333...',
      '...303....',
      '.3344433..',
      '..44444...',
      '..44444...',
      '...1.1....',
      '...3.3....',
    ],
  ],
  skeleton: [
    [
      '...777....',
      '..77777...',
      '..70707...',
      '..77777...',
      '...707....',
      '..67776...',
      '.6.676.6..',
      '...777....',
      '..6...6...',
      '..7...7...',
    ],
    [
      '...777....',
      '..77777...',
      '..70707...',
      '..77777...',
      '...707....',
      '..67776...',
      '.6.676.6..',
      '...777....',
      '...6.6....',
      '...7.7....',
    ],
  ],
  ghost: [
    [
      '...7777...',
      '..777777..',
      '.77777777.',
      '.70077007.',
      '.70077007.',
      '.77777777.',
      '.77700777.',
      '.77777777.',
      '.77777777.',
      '.7.77.77.7',
    ],
    [
      '...7777...',
      '..777777..',
      '.77777777.',
      '.70077007.',
      '.70077007.',
      '.77777777.',
      '.77700777.',
      '.77777777.',
      '.77777777.',
      '7.77.77.7.',
    ],
  ],
}

const LANTERN: Rows = [
  '...3....',
  '..993...',
  '.999999.',
  '9a99a999',
  '99999999',
  '9aaaaa99',
  '.9a9a99.',
  '..9999..',
]

const CANDY: Rows = [
  'e.eee.e.',
  'eeeaaee.',
  'e.eee.e.',
]

/** Scared: body goes deep blue, eyes pale; `flash` gives the white warning. */
function recolour(rows: Rows, flash: boolean): Rows {
  const body = flash ? '7' : '1'
  const eye = flash ? '8' : 'f'
  return rows.map(r => r.replace(/[^.]/g, c => (c === '8' || c === '0' ? eye : body)))
}

export interface Art {
  heroes: Record<Hero, Sprite[]>
  ghouls: Record<GhoulKind, Sprite[]>
  scared: Record<GhoulKind, Sprite[]>
  flash: Record<GhoulKind, Sprite[]>
  lantern: Sprite
  candy: Sprite
}

let art: Art | null = null

/** Built on first use: sprites need a DOM canvas. */
export function sprites(): Art {
  if (art) return art
  const each = <K extends string>(src: Record<K, [Rows, Rows]>, f: (r: Rows) => Rows = r => r) =>
    Object.fromEntries(Object.entries(src).map(([k, v]) => [k, (v as Rows[]).map(r => makeSprite(f(r)))])) as Record<K, Sprite[]>
  art = {
    heroes: each(HERO_ART),
    ghouls: each(GHOUL_ART),
    scared: each(GHOUL_ART, r => recolour(r, false)),
    flash: each(GHOUL_ART, r => recolour(r, true)),
    lantern: makeSprite(LANTERN),
    candy: makeSprite(CANDY),
  }
  return art
}
