import { describe, it, expect } from 'vitest'
import {
  AMMO, BASES_X, BLAST_GROW, BLAST_R, BONUS_CITY_EVERY, CENTRE_SPEED, GROUND, INTERCEPTOR_SPEED, MIN_AIM_Y, POINTS,
  blastRadius, citiesLeft, createWorld, fire, makeRng, multiplier, startWave, step, waveDef,
  type Enemy, type World,
} from './world'

const DT = 1 / 60

/** An empty, quiet wave to test mechanics in. */
function quiet(): World {
  const w = createWorld(1)
  w.toLaunch = { warheads: 0, bombers: 0, drones: 0 }
  w.launchTimer = 1e9
  return w
}

function warhead(x: number, y: number, vx = 0, vy = 20): Enemy {
  return { kind: 'warhead', x, y, sx: x, sy: 0, vx, vy, split: 0, splitY: 0, drop: 0, dodge: 0 }
}

function run(w: World, seconds: number) {
  const events: string[] = []
  for (let i = 0; i < seconds * 60; i++) events.push(...step(w, DT).map(e => e.kind))
  return events
}

describe('firing', () => {
  it('fires from the nearest base with ammo', () => {
    const w = quiet()
    expect(fire(w, 10, 100).detail).toBe('0')
    expect(fire(w, 100, 100).detail).toBe('1')
    expect(fire(w, 170, 100).detail).toBe('2')
    expect(w.bases.map(b => b.ammo)).toEqual([AMMO - 1, AMMO - 1, AMMO - 1])
  })

  it('falls back to another base when the nearest is empty or destroyed', () => {
    const w = quiet()
    w.bases[0].ammo = 0
    w.bases[1].alive = false
    expect(fire(w, 10, 100).detail).toBe('2')
    w.bases[2].ammo = 0
    expect(fire(w, 10, 100).kind).toBe('empty')
  })

  it('can fire from a chosen base (keyboard / gamepad)', () => {
    const w = quiet()
    expect(fire(w, 10, 100, 2).detail).toBe('2')
    w.bases[2].ammo = 0
    expect(fire(w, 10, 100, 2).kind).toBe('empty')
  })

  it('never aims into the ground', () => {
    const w = quiet()
    fire(w, 90, GROUND + 5)
    expect(w.interceptors[0].ty).toBe(MIN_AIM_Y)
  })

  it('centre base interceptors are faster', () => {
    expect(CENTRE_SPEED).toBeGreaterThan(INTERCEPTOR_SPEED)
  })

  it('an interceptor bursts where it was aimed', () => {
    const w = quiet()
    fire(w, 90, 100)
    const events = run(w, 1)
    expect(events).toContain('blast')
    expect(w.interceptors).toHaveLength(0)
  })
})

describe('fireballs', () => {
  it('grow, hold and fade', () => {
    expect(blastRadius(0)).toBe(0)
    expect(blastRadius(BLAST_GROW)).toBe(BLAST_R)
    expect(blastRadius(10)).toBe(0)
  })

  it('destroy enemies that drift into them, with points by wave', () => {
    const w = quiet()
    w.blasts.push({ x: 90, y: 100, t: BLAST_GROW, enemy: false })
    w.enemies.push(warhead(90, 95))
    const events = step(w, DT).map(e => e.kind)
    expect(events).toContain('kill')
    expect(w.score).toBe(POINTS.warhead * multiplier(1))
    expect(multiplier(5)).toBe(3)
  })

  it("enemy impacts don't destroy other enemies", () => {
    const w = quiet()
    w.blasts.push({ x: 90, y: 100, t: BLAST_GROW, enemy: true })
    w.enemies.push(warhead(90, 95))
    expect(step(w, DT).map(e => e.kind)).not.toContain('kill')
  })
})

describe('enemies', () => {
  it('a warhead landing on a city destroys it', () => {
    const w = quiet()
    const x = w.cities[2].x
    w.enemies.push(warhead(x, GROUND - 0.1))
    expect(step(w, DT).map(e => e.kind)).toContain('cityLost')
    expect(w.cities[2].alive).toBe(false)
    expect(citiesLeft(w)).toBe(5)
  })

  it('a warhead landing on a base takes out its missiles', () => {
    const w = quiet()
    w.enemies.push(warhead(BASES_X[0], GROUND - 0.1))
    step(w, DT)
    expect(w.bases[0].alive).toBe(false)
    expect(w.bases[0].ammo).toBe(0)
  })

  it('splitting warheads become several', () => {
    const w = quiet()
    w.def = { ...w.def, splitChance: 1, splitInto: 3 }
    const e = warhead(90, 99.9)
    e.split = 3
    e.splitY = 100
    w.enemies.push(e)
    expect(step(w, DT).map(e => e.kind)).toContain('split')
    expect(w.enemies).toHaveLength(3)
  })

  it('bombers drop warheads as they cross', () => {
    const w = quiet()
    w.enemies.push({ kind: 'bomber', x: 20, y: 60, sx: 20, sy: 60, vx: 22, vy: 0, split: 0, splitY: 0, drop: 0.1, dodge: 0 })
    run(w, 0.5)
    expect(w.enemies.filter(e => e.kind === 'warhead').length).toBeGreaterThan(0)
  })

  it('drones sidestep fireballs', () => {
    const w = quiet()
    const d: Enemy = { ...warhead(95, 100, 0, 10), kind: 'drone' }
    w.enemies.push(d)
    // Just outside the fireball, and heading for it.
    w.blasts.push({ x: 90, y: 130, t: BLAST_GROW, enemy: false })
    for (let i = 0; i < 30; i++) step(w, DT)
    expect(w.enemies).toContain(d)
    expect(d.x).toBeGreaterThan(100)
  })

  it('waves get harder and add new enemy types', () => {
    const [a, b] = [waveDef(1), waveDef(8)]
    expect(b.speed).toBeGreaterThan(a.speed)
    expect(b.warheads).toBeGreaterThan(a.warheads)
    expect(a.bombers + a.drones + a.splitChance).toBe(0)
    expect(b.bombers).toBeGreaterThan(0)
    expect(b.drones).toBeGreaterThan(0)
    expect(b.splitChance).toBeGreaterThan(0)
  })
})

describe('waves', () => {
  it('a cleared wave pays a bonus for cities and unused missiles', () => {
    const w = quiet()
    w.cities[0].alive = false
    w.bases[0].ammo = 3
    const events = run(w, 0.1)
    expect(events).toContain('cleared')
    expect(w.phase).toBe('tally')
    expect(w.tally.cities).toBe(5)
    expect(w.tally.ammo).toBe(3 + AMMO * 2)
    expect(w.score).toBe(w.tally.points)
  })

  it('the next wave restores bases and missiles but not cities', () => {
    const w = quiet()
    w.cities[0].alive = false
    w.bases[1].alive = false
    w.bases[2].ammo = 0
    startWave(w, 2)
    expect(w.bases.every(b => b.alive && b.ammo === AMMO)).toBe(true)
    expect(w.cities[0].alive).toBe(false)
  })

  it(`earns a city back every ${BONUS_CITY_EVERY} points`, () => {
    const w = quiet()
    w.cities[0].alive = false
    w.score = BONUS_CITY_EVERY - 10
    w.blasts.push({ x: 90, y: 100, t: BLAST_GROW, enemy: false })
    w.enemies.push(warhead(90, 100))
    expect(step(w, DT).map(e => e.kind)).toContain('bonusCity')
    startWave(w, 2)
    expect(w.cities[0].alive).toBe(true)
  })

  it('losing every city ends the game when the wave is over', () => {
    const w = quiet()
    for (const c of w.cities) c.alive = false
    expect(run(w, 0.1)).toContain('over')
    expect(w.phase).toBe('over')
  })
})

// ── A human-like player, for tuning ─────────────────────────────────────────
/**
 * Picks the most urgent threat nobody is shooting at, leads it, and taps.
 * `react`: seconds between taps; `aim`: how far off a tap lands (pixels);
 * `judge`: how far off its guess of the lead is (fraction, either way).
 */
function player(react: number, aim: number, judge: number, seed = 5) {
  const rnd = makeRng(seed)
  let wait = 0
  let clock = 0
  // Remembers what it has already shot at, and gives each shot time to land.
  const shotAt = new Map<Enemy, number>()
  return (w: World) => {
    clock += DT
    wait -= DT
    if (wait > 0 || w.phase !== 'wave') return
    const covered = (x: number, y: number) =>
      w.interceptors.some(m => Math.hypot(m.tx - x, m.ty - y) < BLAST_R * 1.2) ||
      w.blasts.some(b => !b.enemy && Math.hypot(b.x - x, b.y - y) < BLAST_R)
    const threats = w.enemies
      .filter(e => e.y > 8 && e.y < MIN_AIM_Y && e.x > 2 && e.x < 178)
      .map(e => ({ e, eta: (GROUND - e.y) / Math.max(1, e.vy) }))
      .sort((a, b) => a.eta - b.eta)
    for (const { e } of threats) {
      if (clock - (shotAt.get(e) ?? -99) < 1.5) continue
      // Lead the target: where will it be when an interceptor gets there?
      const bi = w.bases.reduce((best, b, i) => (b.alive && b.ammo > 0 && (best < 0 || Math.abs(b.x - e.x) < Math.abs(w.bases[best].x - e.x)) ? i : best), -1)
      if (bi < 0) return
      const base = w.bases[bi]
      const speed = bi === 1 ? CENTRE_SPEED : INTERCEPTOR_SPEED
      const guess = 1 + (rnd() * 2 - 1) * judge
      let tx = e.x, ty = e.y
      for (let i = 0; i < 3; i++) {
        const t = (Math.hypot(tx - base.x, ty - GROUND) / speed + BLAST_GROW * 0.5) * guess
        tx = e.x + e.vx * t
        ty = e.y + e.vy * t
      }
      if (covered(tx, ty) || ty >= MIN_AIM_Y) continue
      const ang = rnd() * Math.PI * 2
      const off = rnd() * aim
      fire(w, tx + Math.cos(ang) * off, ty + Math.sin(ang) * off)
      shotAt.set(e, clock)
      wait = react
      return
    }
  }
}

/** Waves survived by `drive` from a fresh game. */
function survive(drive: (w: World) => void, seed: number, maxWave = 25): number {
  const w = createWorld(seed)
  for (let i = 0; i < 60 * 60 * 30; i++) {
    drive(w)
    step(w, DT)
    if (w.phase === 'over') return w.wave - 1
    if (w.phase === 'tally' && w.phaseTime > 0.5) {
      if (w.wave >= maxWave) return maxWave
      startWave(w, w.wave + 1)
    }
  }
  return w.wave
}

describe('difficulty', () => {
  // Nine games each for three players. Missiles are the limit late on (30 a
  // wave), so skill buys a few waves rather than many: about 6 / 8 / 10.
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
  const runs = (react: number, aim: number, judge: number) =>
    Array.from({ length: 9 }, (_, i) => survive(player(react, aim, judge, i + 1), (i + 1) * 7919))
  const slow = median(runs(0.6, 12, 0.45))
  const average = median(runs(0.45, 9, 0.3))
  const good = median(runs(0.3, 5, 0.15))

  it('everyone gets a few waves in', () => {
    expect(slow).toBeGreaterThanOrEqual(4)
  })

  it('an average player lasts about 6-9 waves', () => {
    expect(average).toBeGreaterThanOrEqual(6)
    expect(average).toBeLessThanOrEqual(9)
  })

  it('a good player lasts longer, but not forever', () => {
    expect(good).toBeGreaterThanOrEqual(average)
    expect(good).toBeLessThanOrEqual(13)
  })

  it('doing nothing loses quickly', () => {
    expect(survive(() => {}, 1)).toBeLessThanOrEqual(2)
  })
})
