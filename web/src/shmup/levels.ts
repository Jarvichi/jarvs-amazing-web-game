// ─── /shmup: level timelines ────────────────────────────────────────────────
//
// Each level is a list of waves keyed by the second they enter, then a boss
// once `bossAt` has passed and the screen is clear. x is the spawn column on
// the 180px playfield (the tunnel walls take 12px each side). See `Wave` in
// logic.ts for the fields; `p` is per-kind: swoop direction for swoopers,
// extra hover depth for darters, phase for drifters.

import type { LevelDef } from './logic'

export const LEVELS: LevelDef[] = [
  {
    name: 'THE GULLET',
    theme: 'flesh',
    bossAt: 68,
    waves: [
      { at: 2, kind: 'drifter', n: 5, x: 40, dx: 25, gap: 0.3 },
      { at: 6, kind: 'swooper', n: 5, x: 40, p: 1 },
      { at: 9, kind: 'swooper', n: 5, x: 140, p: -1 },
      { at: 13, kind: 'drifter', n: 6, x: 30, dx: 24, gap: 0.2 },
      { at: 17, kind: 'spinner', n: 3, x: 50, dx: 40, gap: 0.6 },
      { at: 20, kind: 'turret', n: 1, x: 40 },
      { at: 21, kind: 'turret', n: 1, x: 140 },
      { at: 24, kind: 'swooper', n: 6, x: 90, p: 1 },
      { at: 25, kind: 'swooper', n: 6, x: 90, p: -1 },
      { at: 30, kind: 'darter', n: 2, x: 60, dx: 60, gap: 0.8 },
      { at: 34, kind: 'drifter', n: 8, x: 30, dx: 17, gap: 0.15 },
      { at: 38, kind: 'spinner', n: 4, x: 30, dx: 40, gap: 0.4 },
      { at: 42, kind: 'turret', n: 2, x: 50, dx: 80, gap: 0 },
      { at: 45, kind: 'swooper', n: 5, x: 30, p: 1 },
      { at: 47, kind: 'swooper', n: 5, x: 150, p: -1 },
      { at: 51, kind: 'darter', n: 3, x: 40, dx: 50, gap: 0.6, p: 10 },
      { at: 56, kind: 'drifter', n: 6, x: 40, dx: 20, gap: 0.2 },
      { at: 57, kind: 'spinner', n: 3, x: 140, dx: -30, gap: 0.5 },
      { at: 60, kind: 'turret', n: 3, x: 40, dx: 50, gap: 0 },
      { at: 63, kind: 'swooper', n: 6, x: 40, p: 1 },
    ],
    boss: {
      name: 'THE MAW',
      coreHp: 60,
      pods: [{ ox: -32, oy: 6 }, { ox: 32, oy: 6 }],
      podHp: 30,
      spread: 5,
      sway: 0.6,
    },
  },
  {
    name: 'IRON HEART',
    theme: 'machine',
    bossAt: 78,
    waves: [
      { at: 2, kind: 'spinner', n: 4, x: 30, dx: 40, gap: 0.3 },
      { at: 5, kind: 'swooper', n: 6, x: 30, p: 1, gap: 0.3 },
      { at: 7, kind: 'swooper', n: 6, x: 150, p: -1, gap: 0.3 },
      { at: 11, kind: 'turret', n: 3, x: 40, dx: 50, gap: 0 },
      { at: 14, kind: 'darter', n: 2, x: 50, dx: 80, gap: 0.5 },
      { at: 18, kind: 'drifter', n: 8, x: 25, dx: 18, gap: 0.12 },
      { at: 21, kind: 'spinner', n: 5, x: 150, dx: -28, gap: 0.3 },
      { at: 25, kind: 'darter', n: 3, x: 40, dx: 50, gap: 0.5, p: 20 },
      { at: 29, kind: 'swooper', n: 8, x: 90, p: 1, gap: 0.25 },
      { at: 30, kind: 'swooper', n: 8, x: 90, p: -1, gap: 0.25 },
      { at: 35, kind: 'turret', n: 2, x: 30, dx: 120, gap: 0 },
      { at: 36, kind: 'turret', n: 2, x: 70, dx: 40, gap: 0 },
      { at: 40, kind: 'drifter', n: 10, x: 25, dx: 14, gap: 0.12 },
      { at: 44, kind: 'darter', n: 4, x: 30, dx: 40, gap: 0.4 },
      { at: 49, kind: 'spinner', n: 6, x: 25, dx: 26, gap: 0.2 },
      { at: 53, kind: 'swooper', n: 6, x: 40, p: 1 },
      { at: 54, kind: 'swooper', n: 6, x: 140, p: -1 },
      { at: 58, kind: 'turret', n: 4, x: 30, dx: 40, gap: 0 },
      { at: 62, kind: 'darter', n: 4, x: 40, dx: 33, gap: 0.3, p: 15 },
      { at: 66, kind: 'drifter', n: 8, x: 30, dx: 17, gap: 0.15 },
      { at: 70, kind: 'spinner', n: 4, x: 40, dx: 33, gap: 0.3 },
      { at: 73, kind: 'swooper', n: 8, x: 90, p: 1, gap: 0.2 },
    ],
    boss: {
      name: 'IRON HEART',
      coreHp: 90,
      pods: [{ ox: -36, oy: 4 }, { ox: 36, oy: 4 }, { ox: 0, oy: 22 }],
      podHp: 36,
      spread: 7,
      sway: 0.8,
    },
  },
]
