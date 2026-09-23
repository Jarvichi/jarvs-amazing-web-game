import { describe, it, expect } from 'vitest'
import { createWorld, step, type Input, type World } from './physics'
import { LEVELS } from './levels'

// Guards against shipping an impossible level: a beam search drives the real
// physics with a handful of button combos and must reach every flag. It proves
// a route exists (frame-perfect), not that the level is fair for a human —
// that still needs a playtest after any map edit.

const DT = 1 / 60
const TICKS_PER_CHOICE = 6
const BEAM = 300

const held = (right: boolean, left: boolean, jump: boolean): Input =>
  ({ left, right, jump, jumpPressed: false })

// [first tick, remaining ticks] — a fresh jump press only happens on tick one.
const CHOICES: [Input, Input][] = [
  [held(true, false, false), held(true, false, false)],
  [{ ...held(true, false, true), jumpPressed: true }, held(true, false, true)],
  [held(true, false, true), held(true, false, true)],
  [{ ...held(false, false, true), jumpPressed: true }, held(false, false, true)],
  [held(false, false, false), held(false, false, false)],
  [held(false, true, false), held(false, true, false)],
]

const clone = (w: World): World => ({
  ...w,
  player: { ...w.player },
  enemies: w.enemies.map(e => ({ ...e })),
  coins: new Set(w.coins),
})

function solve(world: World): World | null {
  let beam = [world]
  for (let n = 0; n < 400 && beam.length; n++) {
    const seen = new Map<string, World>()
    for (const w of beam) {
      for (const [first, rest] of CHOICES) {
        const c = clone(w)
        for (let i = 0; i < TICKS_PER_CHOICE && c.status === 'playing'; i++) step(c, i ? rest : first, DT)
        if (c.status === 'won') return c
        if (c.status !== 'playing') continue
        const p = c.player
        const key = [p.x / 3, p.y / 3, p.vy / 60].map(Math.round).join() + c.enemies.filter(e => e.alive).length
        if (!seen.has(key)) seen.set(key, c)
      }
    }
    beam = [...seen.values()].sort((a, b) => b.player.x - a.player.x).slice(0, BEAM)
  }
  return null
}

describe('levels', () => {
  it.each(LEVELS.map(l => [l.name, l] as const))('%s can be completed', (_, def) => {
    const won = solve(createWorld(def))
    expect(won?.status).toBe('won')
  }, 30000)
})
