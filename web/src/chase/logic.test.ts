import { describe, it, expect } from 'vitest'
import {
  FORK_CLOSE, FORK_HOLD, FORK_OPEN, PROP_HIT, SEG_LEN, branchCentre, branchHalfWidth, buildTrack, heightAt, laneX, onRoad,
  project, segmentAt, trafficX,
} from './road'
import {
  CAR_LEN, CAR_W, IDLE, MAX_SPEED, OFFROAD_LIMIT, TURBOS, TURBO_SPEED, createPlayer, kmh, stepPlayer, type Controls,
} from './car'
import { createTraffic, hitProp, hitTraffic, makeRng, stepTraffic } from './traffic'
import { createTarget, ramDamage, ramTarget } from './target'
import { CASES } from './tracks'
import { ARREST_GAP, COUNTDOWN, createWorld, wrongWayPenalty, gap, step, type World } from './world'

const DT = 1 / 60
const GAS: Controls = { steer: 0, gas: true, brake: false, turbo: false }

describe('road', () => {
  it('builds curves and hills that ease in and out', () => {
    const t = buildTrack([{ enter: 10, hold: 20, leave: 10, curve: 4, hill: 10 }])
    expect(t.segs[0].curve).toBe(0)
    expect(t.segs[25].curve).toBe(4)
    expect(t.segs[39].y1).toBeCloseTo(10 * SEG_LEN)
    // The loop closes back to its starting height.
    expect(t.segs[t.segs.length - 1].y1).toBeCloseTo(0)
    expect(t.length).toBe(t.segs.length * SEG_LEN)
  })

  it('segments join up with no steps in height', () => {
    for (const c of CASES) {
      const segs = c.track.segs
      for (let i = 1; i < segs.length; i++) expect(segs[i].y0).toBe(segs[i - 1].y1)
      expect(segs[0].y0).toBe(0)
      expect(segs[segs.length - 1].y1).toBeCloseTo(0)
    }
  })

  it('wraps positions around the loop', () => {
    const t = buildTrack([{ enter: 0, hold: 10, leave: 0 }])
    expect(segmentAt(t, 0).index).toBe(0)
    expect(segmentAt(t, t.length + SEG_LEN * 3.5).index).toBe(3)
    expect(segmentAt(t, -1).index).toBe(9)
    expect(heightAt(t, t.length * 5)).toBe(0)
  })

  it('forks open, hold and close', () => {
    const t = buildTrack([{ enter: 0, hold: 5, leave: 0 }, { fork: 'left' }, { enter: 0, hold: 5, leave: 0 }])
    expect(t.forks).toEqual([{ start: 5, end: 5 + FORK_OPEN + FORK_HOLD + FORK_CLOSE - 1, side: 'left' }])
    expect(t.segs[4].fork).toBe(0)
    expect(t.segs[5 + FORK_OPEN + 1].fork).toBe(1)
    expect(t.segs[t.forks[0].end].fork).toBeCloseTo(0)
    expect(t.segs[t.forks[0].end + 1].forkId).toBe(-1)
  })

  it('knows where the tarmac is, forked or not', () => {
    expect(onRoad(0, 0)).toBe(true)
    expect(onRoad(1.2, 0)).toBe(false)
    // Fully split: the middle is the median, the branch centres are road.
    expect(onRoad(0, 1)).toBe(false)
    expect(onRoad(branchCentre(1, 'left'), 1)).toBe(true)
    expect(onRoad(branchCentre(1, 'right'), 1)).toBe(true)
  })

  it('puts lanes on the right branches when split', () => {
    expect(laneX(0, 0)).toBeCloseTo(-2 / 3)
    expect(laneX(1, 0)).toBeCloseTo(0)
    for (const lane of [0, 1]) expect(laneX(lane, 1)).toBeLessThan(0)
    expect(laneX(2, 1)).toBeGreaterThan(0)
    for (const lane of [0, 1, 2]) expect(onRoad(laneX(lane, 1), 1)).toBe(true)
  })

  it('gives traffic two lanes per branch in a fork', () => {
    const xs = [0, 1, 2, 3].map(f => trafficX(f === 0 ? 0 : f === 3 ? 2 : 1, f, 1))
    for (const x of xs) expect(onRoad(x, 1)).toBe(true)
    expect(xs.filter(x => x < 0).length).toBe(2)
    // Lanes are far enough apart to pass between.
    for (let i = 1; i < 4; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(CAR_W * 1.5)
    // With no split, the fork lane is ignored.
    expect(trafficX(0, 0, 0)).toBeCloseTo(laneX(0, 0))
  })

  it('never puts scenery where a car still on the tarmac can hit it', () => {
    for (const c of CASES) {
      for (const seg of c.track.segs) {
        for (const prop of seg.props) {
          // Every car position that would clip it must be off the tarmac.
          const reach = PROP_HIT[prop.kind] + CAR_W / 2
          for (let f = -0.999; f <= 0.999; f += 0.111) {
            if (onRoad(prop.x + f * reach, seg.fork)) {
              throw new Error(`${c.title}: ${prop.kind} at x=${prop.x.toFixed(2)} reaches the road (segment ${seg.index})`)
            }
          }
        }
      }
    }
  })

  it('projects straight ahead onto the screen centre', () => {
    const p = project(0, 0, 1000, 0, 0, 0, 320, 180)
    expect(p.x).toBe(160)
    expect(p.y).toBe(90)
    // Further away is smaller.
    expect(project(0, 0, 5000, 0, 0, 0, 320, 180).w).toBeLessThan(p.w)
  })
})

describe('player car', () => {
  it('accelerates to top speed and no further', () => {
    const p = createPlayer()
    for (let i = 0; i < 60 * 10; i++) stepPlayer(p, GAS, 0, 0, DT)
    expect(p.speed).toBe(MAX_SPEED)
    expect(kmh(p.speed)).toBe(250)
  })

  it('turbo is limited, faster, and wears off', () => {
    const p = createPlayer()
    p.speed = MAX_SPEED
    expect(stepPlayer(p, { ...GAS, turbo: true }, 0, 0, DT)).toBe('turbo')
    expect(p.turbos).toBe(TURBOS - 1)
    // Pressing again while it is running does not waste one.
    expect(stepPlayer(p, { ...GAS, turbo: true }, 0, 0, DT)).toBeNull()
    for (let i = 0; i < 60; i++) stepPlayer(p, GAS, 0, 0, DT)
    expect(p.speed).toBeGreaterThan(MAX_SPEED * 1.2)
    expect(p.speed).toBeLessThanOrEqual(TURBO_SPEED)
    for (let i = 0; i < 60 * 8; i++) stepPlayer(p, GAS, 0, 0, DT)
    expect(p.speed).toBe(MAX_SPEED)
    p.turbos = 0
    expect(stepPlayer(p, { ...GAS, turbo: true }, 0, 0, DT)).toBeNull()
  })

  it('curves push you outward; steering holds the line at top speed', () => {
    const drift = createPlayer()
    drift.speed = MAX_SPEED
    for (let i = 0; i < 30; i++) stepPlayer(drift, GAS, 6, 0, DT)
    expect(drift.x).toBeLessThan(-0.3)

    const held = createPlayer()
    held.speed = MAX_SPEED
    for (let i = 0; i < 60; i++) stepPlayer(held, { ...GAS, steer: 1 }, 6, 0, DT)
    expect(held.x).toBeGreaterThan(0)
  })

  it('slows to a crawl off the road', () => {
    const p = createPlayer()
    p.speed = MAX_SPEED
    p.x = 2
    for (let i = 0; i < 60 * 2; i++) stepPlayer(p, GAS, 0, 0, DT)
    expect(p.speed).toBeLessThanOrEqual(OFFROAD_LIMIT)
  })
})

describe('traffic', () => {
  const track = buildTrack([{ enter: 0, hold: 400, leave: 0 }])

  it('recycles cars left behind onto the road ahead', () => {
    const rnd = makeRng(3)
    const cars = createTraffic(6, 0, rnd)
    for (const c of cars) expect(c.z).toBeGreaterThan(2000)
    stepTraffic(cars, track, 50000, DT, rnd)
    for (const c of cars) expect(c.z).toBeGreaterThan(50000)
  })

  it('rear-ending a car slows you below its speed', () => {
    const p = createPlayer(1000)
    p.speed = MAX_SPEED
    const car = { z: 1000 + CAR_LEN * 0.8, x: 0, lane: 1, forkLane: 1, speed: MAX_SPEED / 2, kind: 0 }
    expect(hitTraffic(p, [car])).toBe('rear')
    expect(p.speed).toBeLessThan(car.speed)
    expect(hitTraffic(p, [car])).toBeNull()
  })

  it('a rear-end leaves room to steer round instead of hitting it again', () => {
    const p = createPlayer(1000)
    p.speed = MAX_SPEED
    const car = { z: 1000 + CAR_LEN * 0.8, x: 0, lane: 1, forkLane: 1, speed: MAX_SPEED / 2, kind: 0 }
    expect(hitTraffic(p, [car])).toBe('rear')
    expect(p.speed).toBeGreaterThan(car.speed * 0.8)
    // Floor it straight ahead for a second: no second hit.
    let hits = 0
    for (let i = 0; i < 60; i++) {
      stepPlayer(p, GAS, 0, 0, DT)
      car.z += car.speed * DT
      if (hitTraffic(p, [car])) hits++
    }
    expect(hits).toBe(0)
  })

  it('side swipes push you apart', () => {
    const p = createPlayer(1000)
    p.x = 0.1
    const car = { z: 1000, x: 0, lane: 1, forkLane: 1, speed: 0, kind: 0 }
    expect(hitTraffic(p, [car])).toBe('side')
    expect(p.x).toBeGreaterThan(0.3)
  })

  it('crashes into scenery only when you hit it', () => {
    const t = buildTrack([{ enter: 0, hold: 10, leave: 0 }])
    t.segs[3].props.push({ kind: 'palm', x: 1.5 })
    const p = createPlayer(3 * SEG_LEN + 10)
    expect(hitProp(p, t)).toBeNull()
    p.x = 1.45
    expect(hitProp(p, t)?.kind).toBe('palm')
  })
})

describe('target', () => {
  it('rams hurt more when faster, with turbo, and on softer cars', () => {
    expect(ramDamage(MAX_SPEED / 2, false, 1, false)).toBeGreaterThan(ramDamage(MAX_SPEED / 10, false, 1, false))
    expect(ramDamage(1000, true, 1, false)).toBeCloseTo(2 * ramDamage(1000, false, 1, false))
    expect(ramDamage(1000, false, 0.5, false)).toBeCloseTo(0.5 * ramDamage(1000, false, 1, false))
    expect(ramDamage(MAX_SPEED * 5, false, 1, false)).toBeLessThanOrEqual(0.16)
  })

  it('counts one collision as one ram, and gives up when wrecked', () => {
    const t = createTarget(1000 + CAR_LEN * 0.8)
    t.speed = MAX_SPEED * 0.8
    const p = createPlayer(1000)
    p.speed = MAX_SPEED
    expect(ramTarget(t, p, 1)).not.toBeNull()
    expect(ramTarget(t, p, 1)).toBeNull()
    t.damage = 0.99
    t.ramCool = 0
    p.z = t.z - CAR_LEN * 0.8
    p.x = t.x
    ramTarget(t, p, 1)
    expect(t.stopping).toBe(true)
  })
})

/**
 * A decent driver: floors it, follows the dispatch hint at forks, changes
 * lane to get round traffic it can see coming, rams the target once on its
 * tail, and saves turbo for straights.
 */
function autopilot(w: World): Controls {
  const { player: p, target: t, track } = w
  const seg = segmentAt(track, p.z)
  // Heads for the right branch as soon as dispatch calls it.
  const near = segmentAt(track, p.z + FORK_OPEN * SEG_LEN * 1.5)
  const forkId = seg.forkId >= 0 ? seg.forkId : near.forkId
  let aim = Math.max(-2 / 3, Math.min(2 / 3, w.phase === 'arrest' ? t.x : p.x))
  let lanes = [0, 1, 2].map(l => laneX(l, 0))
  if (forkId >= 0) {
    const split = Math.max(seg.fork, 0.6)
    const c = branchCentre(split, track.forks[forkId].side)
    const hw = branchHalfWidth(split)
    lanes = [c - hw / 2, c + hw / 2]
    if (Math.abs(aim - c) > hw * 0.5) aim = c
  }
  const blocked = (x: number) => w.traffic.some(c => c.z > p.z && c.z - p.z < 4000 && Math.abs(c.x - x) < CAR_W * 1.3)
  if (blocked(aim)) {
    const free = lanes.filter(x => !blocked(x)).sort((a, b) => Math.abs(a - p.x) - Math.abs(b - p.x))
    if (free.length) aim = free[0]
  }
  const steer = Math.max(-1, Math.min(1, (aim - p.x) * 4 + seg.curve * 0.15))
  const straight = Math.abs(seg.curve) < 1 && Math.abs(segmentAt(track, p.z + 3000).curve) < 1
  return { steer, gas: true, brake: false, turbo: straight && gap(w) > 8000 }
}

/** Step until `until` holds; returns the seconds it took. */
function run(w: World, until: (w: World) => boolean, seconds: number, drive = autopilot): number {
  let i = 0
  for (; i < seconds * 60 && !until(w); i++) step(w, drive(w), DT)
  return i / 60
}

describe('world', () => {
  it('counts down, then the chase is on', () => {
    const w = createWorld(0)
    const ticks: string[] = []
    for (let i = 0; i < COUNTDOWN * 60 + 1; i++) ticks.push(...step(w, GAS, DT).map(e => e.kind))
    expect(ticks.filter(k => k === 'tick').length).toBe(COUNTDOWN - 1)
    expect(ticks).toContain('go')
    expect(w.phase).toBe('pursuit')
    expect(w.player.speed).toBe(0)
  })

  it('the target escapes if you just sit there', () => {
    const w = createWorld(0)
    run(w, w => w.phase === 'escaped', 120, () => IDLE)
    expect(w.phase).toBe('escaped')
  })

  it.each(CASES.map((c, i) => [c.title, i] as const))('%s can be won by a decent driver on an empty road', (_, i) => {
    const w = createWorld(i, 0, 7)
    w.traffic = []
    const pursuit = run(w, w => w.phase !== 'countdown' && w.phase !== 'pursuit', 120) - COUNTDOWN
    expect(w.phase).toBe('arrest')
    // With the road to yourself there is plenty of time to spare; the
    // difficulty comes from traffic (see "winnable in traffic" below).
    expect(pursuit).toBeLessThan(w.def.pursuitTime * 0.6)
    const arrest = run(w, w => w.phase !== 'arrest', 120)
    expect(arrest).toBeGreaterThan(5)
    expect(w.phase).toBe('caught')
    expect(w.timeLeft).toBeGreaterThan(0)
  })

  // The real game has traffic: over 20 runs a decent driver should nearly
  // always catch the early targets, and the Phantom should still be a fight.
  const MIN_WINS = [18, 17, 13, 15, 7]
  it.each(CASES.map((c, i) => [c.title, i] as const))('%s is winnable in traffic', (_, i) => {
    let wins = 0
    for (let seed = 1; seed <= 20; seed++) {
      const w = createWorld(i, 0, seed * 7919)
      run(w, w => w.phase === 'caught' || w.phase === 'escaped', 200)
      if (w.phase === 'caught') wins++
    }
    expect(wins).toBeGreaterThanOrEqual(MIN_WINS[i])
    if (i === CASES.length - 1) expect(wins).toBeLessThan(18)
  })

  it('the wrong branch of a fork lets the target get away further', () => {
    const w = createWorld(0, 0, 3)
    w.traffic = []
    const fork = w.track.forks[0]
    const wrong = fork.side === 'left' ? 'right' : 'left'
    w.phase = 'pursuit'
    w.player.z = fork.start * SEG_LEN - 5 * SEG_LEN
    w.target.z = w.player.z + 60000
    const before = gap(w)
    let wrongway = false
    for (let i = 0; i < 60 * 20 && !wrongway; i++) {
      w.player.speed = MAX_SPEED / 2
      w.target.speed = MAX_SPEED / 2
      w.target.z = w.player.z + before
      const aim = branchCentre(Math.max(0.6, segmentAt(w.track, w.player.z).fork), wrong)
      wrongway = step(w, { steer: Math.max(-1, Math.min(1, (aim - w.player.x) * 4)), gas: false, brake: false, turbo: false }, DT)
        .some(e => e.kind === 'wrongway')
    }
    expect(wrongway).toBe(true)
    expect(gap(w)).toBeGreaterThan(before + wrongWayPenalty(w.def) - 1000)
    expect(ARREST_GAP).toBeLessThan(before)
  })
})
