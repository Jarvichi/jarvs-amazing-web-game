import { describe, it, expect } from 'vitest'
import {
  BASE_SPEED, ENEMIES, H, MARGIN, MAX_LIVES, MAX_SHIELD, SHIP_W, START_LOADOUT, W,
  BONUS_WAVE_MIN, MAX_BOMBS, REAR_KINDS, expectedLoadout, firepower, onScreen, powerScale, cloneLoadout, podPos, podSlot, REAR_WARNING, SHIP_H, applyCapsule, buy, continueCarry, rearWarnings, coreExposed, createWorld, dronePos, maxShield, priceOf, step, tierScale,
  type Attack, type BossPhase, type Carry, type Input, type LevelDef, type Wave, type World,
} from './logic'
import { currentPhase, healthFraction, partPos } from './boss'
import { LEVELS } from './levels'

const DT = 1 / 60
const IDLE: Input = { dx: 0, dy: 0, dragX: 0, dragY: 0, fire: false, bomb: false }

const EMPTY: LevelDef = {
  name: 'TEST',
  theme: 'flesh',
  tier: 1,
  bossAt: 9999,
  waves: [],
  boss: {
    name: 'B', look: 'maw', coreHp: 10, podHp: 5, pods: [{ ox: -30, oy: 0 }],
    phases: [{ core: [{ kind: 'fan', every: 1, n: 3, spread: 0.2, speed: 80 }], pods: [], sway: 0.5 }],
  },
}

const carry = (over: Partial<Carry> = {}): Carry =>
  ({ score: 0, credits: 0, lives: 3, ...over, loadout: cloneLoadout(over.loadout ?? START_LOADOUT) })

function run(w: World, seconds: number, input: Partial<Input> = {}) {
  const events: string[] = []
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    events.push(...step(w, { ...IDLE, ...input }, DT).map(e => e.kind))
  }
  return events
}

describe('ship', () => {
  it('moves at its speed and stays inside the tunnel', () => {
    const w = createWorld(EMPTY, carry())
    const x0 = w.ship.x
    run(w, 0.5, { dx: 1 })
    expect(w.ship.x - x0).toBeCloseTo(BASE_SPEED * 0.5, 0)
    run(w, 5, { dx: 1 })
    expect(w.ship.x).toBe(W - MARGIN - SHIP_W)
    run(w, 10, { dx: -1, dy: -1 })
    expect(w.ship.x).toBe(MARGIN + SHIP_W)
    expect(w.ship.y).toBeGreaterThanOrEqual(0)
  })

  it('follows pointer drags one-to-one', () => {
    const w = createWorld(EMPTY, carry())
    const { x, y } = w.ship
    step(w, { ...IDLE, dragX: -20, dragY: -30 }, DT)
    expect(w.ship.x).toBe(x - 20)
    expect(w.ship.y).toBe(y - 30)
  })

  it('fires more bullets with a bigger cannon', () => {
    const shotsFor = (cannon: 1 | 2 | 3) => {
      const w = createWorld(EMPTY, carry({ loadout: { ...START_LOADOUT, cannon } }))
      step(w, { ...IDLE, fire: true }, DT)
      return w.shots.length
    }
    // Maxing the cannon mounts a pod that fires the full 3-shot spread, so
    // firepower never drops when the base cannon resets.
    const [one, two, max] = [shotsFor(1), shotsFor(2), shotsFor(3)]
    expect([one, two]).toEqual([1, 2])
    expect(max).toBeGreaterThanOrEqual(3)
  })
})

describe('combat', () => {
  it('kills enemies, which drop credits worth collecting', () => {
    const w = createWorld({ ...EMPTY, waves: [{ at: 0, kind: 'drifter', n: 1, x: W / 2 }] }, carry())
    w.enemies = []
    w.ship.x = W / 2
    const events = run(w, 3, { fire: true })
    expect(events).toContain('explode')
    expect(w.score).toBeGreaterThan(0)
    // Fly up into the credit and collect it.
    run(w, 3, { dy: -1 })
    expect(w.credits).toBeGreaterThan(0)
  })

  it('shots drain the shield and losing it costs a life and a cannon level', () => {
    const w = createWorld(EMPTY, carry({ loadout: { ...START_LOADOUT, cannon: 2 } }))
    w.ship.invuln = 0
    const hitShip = () => {
      w.ship.invuln = 0
      w.enemyShots.push({ x: w.ship.x, y: w.ship.y, vx: 0, vy: 0, dmg: 25 })
      return step(w, IDLE, DT).map(e => e.kind)
    }
    expect(hitShip()).toContain('hurt')
    expect(w.ship.shield).toBe(MAX_SHIELD - 25)
    hitShip(); hitShip()
    expect(hitShip()).toContain('die')
    expect(w.lives).toBe(2)
    expect(w.loadout.cannon).toBe(1)
    run(w, 2.5)
    expect(w.ship.alive).toBe(true)
    expect(w.ship.shield).toBe(MAX_SHIELD)
  })

  it('ends the game when the last life is lost', () => {
    const w = createWorld(EMPTY, carry({ lives: 1 }))
    w.ship.invuln = 0
    w.ship.shield = 1
    w.enemyShots.push({ x: w.ship.x, y: w.ship.y, vx: 0, vy: 0, dmg: 25 })
    step(w, IDLE, DT)
    expect(w.status).toBe('gameover')
  })

  it('spawns waves on schedule', () => {
    const w = createWorld({ ...EMPTY, waves: [{ at: 1, kind: 'spinner', n: 3, x: 50, gap: 0.5 }] }, carry())
    run(w, 0.9)
    expect(w.enemies).toHaveLength(0)
    run(w, 0.2)
    expect(w.enemies).toHaveLength(1)
    run(w, 1)
    expect(w.enemies).toHaveLength(3)
  })
})

describe('boss', () => {
  it('keeps its core armoured until every pod is destroyed', () => {
    const w = createWorld({ ...EMPTY, bossAt: 0 }, carry())
    step(w, IDLE, DT)
    const b = w.boss!
    expect(b).toBeTruthy()
    b.y = 64
    // Hammer the core directly: it must not take damage while a pod lives.
    for (let i = 0; i < 20; i++) w.shots.push({ x: b.x, y: b.y, vx: 0, vy: 0, dmg: 1 })
    step(w, IDLE, DT)
    expect(b.core.hp).toBe(b.core.max)
    b.pods[0].hp = 0
    expect(coreExposed(b)).toBe(true)
    for (let i = 0; i < 20; i++) w.shots.push({ x: b.x, y: b.y, vx: 0, vy: 0, dmg: 1 })
    const events = run(w, 3).concat()
    expect(b.core.hp).toBeLessThanOrEqual(0)
    expect(events).toContain('bossdie')
    expect(w.status).toBe('won')
  })

  // Flies each level with the loadout it's tuned for (EXPECTED_LOADOUT in
  // difficulty.ts), so enemies there get no power scaling.

  it.each(LEVELS.map((l, i) => [l.name, l, i] as const))(
    '%s can be finished with a typical loadout in reasonable time', (_, level, i) => {
      // An invulnerable ship that tracks the nearest threat and holds fire.
      const w = createWorld(level, carry({ loadout: expectedLoadout(level.tier) }), 7)
      for (let n = 0; n < 60 * 60 * 5 && w.status === 'playing'; n++) {
        w.ship.invuln = 1
        const b = w.boss
        const pod = b?.pods.find(p => p.hp > 0)
        const target = b ? (pod ? partPos(b, pod).x : b.x) : (w.enemies[0]?.x ?? W / 2)
        step(w, { ...IDLE, dx: Math.sign(target - w.ship.x), fire: true }, DT)
      }
      expect(w.status).toBe('won')
      expect(w.time).toBeLessThan(level.bossAt + 60)
      // Each level must pay for a meaningful shop visit.
      expect(w.credits).toBeGreaterThan(300 + i * 150)
    })

})

describe('boss attacks', () => {
  const bossLevel = (phases: BossPhase[], extra: Partial<LevelDef['boss']> = {}): LevelDef =>
    ({ ...EMPTY, bossAt: 0, boss: { ...EMPTY.boss, coreHp: 20, podHp: 10, phases, ...extra } })
  const phase = (core: Attack[], when?: BossPhase['when']): BossPhase => ({ when, core, pods: [], sway: 0 })

  /** A world with the boss already in position. */
  function arrived(level: LevelDef) {
    const w = createWorld(level, carry())
    step(w, IDLE, DT)
    w.boss!.y = 64
    return w
  }

  it('switches phase as health drops, and again when the pods fall', () => {
    const w = arrived(bossLevel([phase([]), phase([], 0.5), phase([], 'exposed')]))
    const b = w.boss!
    expect(currentPhase(b)).toBe(0)
    b.core.hp = 5 // 15 of 30 total left
    expect(healthFraction(b)).toBe(0.5)
    const events = run(w, DT)
    expect(b.phase).toBe(1)
    expect(events).toContain('phase')
    b.pods[0].hp = 0
    run(w, DT)
    expect(b.phase).toBe(2)
  })

  it('warns before a laser burns, and only hurts under the beam', () => {
    const w = arrived(bossLevel([phase([{ kind: 'laser', every: 99, warn: 1, dur: 1, width: 10 }])]))
    w.ship.invuln = 0
    w.ship.x = w.boss!.x
    run(w, 1.5) // first volley within ~1.4s, then 1s of warning
    expect(w.boss!.lasers).toHaveLength(1)
    expect(w.ship.shield).toBe(MAX_SHIELD)
    run(w, 1)
    expect(w.ship.shield).toBeLessThan(MAX_SHIELD)

    const dodged = arrived(bossLevel([phase([{ kind: 'laser', every: 99, warn: 0.2, dur: 2, width: 10 }])]))
    dodged.ship.invuln = 0
    dodged.ship.x = MARGIN + SHIP_W
    run(dodged, 3)
    expect(dodged.ship.shield).toBe(MAX_SHIELD)
  })

  it('summons minions but never past the cap', () => {
    const w = arrived(bossLevel([phase([{ kind: 'summon', every: 0.1, enemy: 'drifter', n: 3, max: 4 }])]))
    w.ship.invuln = 999
    run(w, 3)
    expect(w.enemies.length).toBeGreaterThan(0)
    expect(w.enemies.length).toBeLessThanOrEqual(4)
  })

  it('fires every attack kind without error', () => {
    const attacks: Attack[] = [
      { kind: 'fan', every: 0.5, n: 5, spread: 0.2, speed: 80 },
      { kind: 'aimed', every: 0.5, n: 3, speed: 90 },
      { kind: 'ring', every: 0.5, n: 12, speed: 70 },
      { kind: 'spiral', every: 0.1, arms: 3, spin: 0.3, speed: 80 },
    ]
    const w = arrived(bossLevel([phase(attacks)]))
    w.ship.invuln = 999
    run(w, 2)
    expect(w.enemyShots.length).toBeGreaterThan(20)
  })
})

describe('new enemies', () => {
  const one = (kind: Wave['kind'], extra: Partial<Wave> = {}) =>
    createWorld({ ...EMPTY, waves: [{ at: 0, kind, n: 1, x: W / 2, ...extra }] }, carry())
  const kill = (w: World) => {
    for (const e of w.enemies) w.shots.push({ x: e.x, y: e.y, vx: 0, vy: 0, dmg: 99 })
    return run(w, DT)
  }

  it('splitters split into two drifters', () => {
    const w = one('splitter')
    run(w, 1)
    kill(w)
    expect(w.enemies.filter(e => e.kind === 'drifter')).toHaveLength(2)
  })

  it('mines burst into a ring when shot', () => {
    const w = one('mine')
    w.ship.x = MARGIN + SHIP_W // well clear
    run(w, 1)
    kill(w)
    expect(w.enemyShots.length).toBe(8)
  })

  it('mines go off when the ship flies too close', () => {
    const w = one('mine')
    run(w, 4) // drift down past the ship's top limit (y 40)
    w.ship.invuln = 999
    w.ship.x = w.enemies[0].x
    w.ship.y = w.enemies[0].y + 15
    const events = run(w, DT)
    expect(events).toContain('explode')
    expect(w.enemyShots.length).toBe(8)
  })

  it('snipers show where they will shoot before firing', () => {
    const w = one('sniper')
    w.ship.invuln = 999
    let warned = false
    for (let i = 0; i < 60 * 4 && w.enemyShots.length === 0; i++) {
      step(w, IDLE, DT)
      if (w.enemies[0]?.aim) warned = true
    }
    expect(warned).toBe(true)
    expect(w.enemyShots).toHaveLength(1)
    expect(Math.hypot(w.enemyShots[0].vx, w.enemyShots[0].vy)).toBeGreaterThan(200)
  })

  it('carriers keep launching swoopers', () => {
    const w = one('carrier')
    w.ship.invuln = 999
    run(w, 6)
    expect(w.enemies.filter(e => e.kind === 'swooper').length).toBeGreaterThanOrEqual(2)
  })

  it('snake segments trail their head along the same path', () => {
    const w = createWorld({ ...EMPTY, waves: [{ at: 0, kind: 'snake', n: 3, x: 90, gap: 0.2, p: 1 }] }, carry())
    run(w, 1)
    const [head, second] = w.enemies
    expect(head.member).toBe(0)
    expect(second.member).toBe(1)
    // The second segment is where the head was 0.2s ago: same path, delayed.
    expect(second.age).toBeCloseTo(head.age - 0.2, 1)
    expect(head.y - second.y).toBeCloseTo(60 * 0.2, 0)
  })
})

describe('upgrades', () => {
  const armed = (over: Partial<Carry['loadout']>) =>
    createWorld(EMPTY, carry({ loadout: { ...START_LOADOUT, ...over } }))

  it('laser bolts pierce a column of enemies, hurting each only once', () => {
    const w = armed({ laser: true })
    w.ship.x = W / 2
    for (const y of [150, 120, 90]) {
      w.enemies.push({ id: y, kind: 'turret', x: W / 2, y, sx: W / 2, p: 0, member: 0, hp: 99, age: 0, fire: 99, flash: 0 })
    }
    step(w, { ...IDLE, fire: true }, DT)
    const bolt = w.shots.find(s => s.pierce)!
    bolt.x = W / 2 // fired from the laser pod beside the ship; line it up with the column
    w.shots = [bolt]
    run(w, 1)
    // Each turret took exactly one bolt (2 damage) — none was hit twice.
    expect(w.enemies.map(e => 99 - e.hp)).toEqual([2, 2, 2])
  })

  it('rapid fire shortens the cannon cooldown', () => {
    const shotsIn = (rapid: 0 | 2) => {
      const w = armed({ rapid })
      w.ship.y = H - 12
      let n = 0
      for (let i = 0; i < 60; i++) n += step(w, { ...IDLE, fire: true }, DT).filter(e => e.kind === 'shot').length
      return n
    }
    expect(shotsIn(2)).toBeGreaterThan(shotsIn(0))
  })

  it('drones block enemy shots', () => {
    const w = armed({ drones: 1 })
    step(w, IDLE, DT)
    const d = dronePos(w, 0)
    w.enemyShots.push({ x: d.x, y: d.y, vx: 0, vy: 0, dmg: 25 })
    const events = run(w, 2 * DT) // blocked on the first tick, swept away on the next
    expect(events).toContain('hit')
    expect(w.enemyShots).toHaveLength(0)
    expect(w.ship.shield).toBe(MAX_SHIELD)
  })

  it('armour raises the maximum shield', () => {
    expect(armed({ armour: true }).ship.shield).toBe(maxShield({ ...START_LOADOUT, armour: true }))
    expect(maxShield({ ...START_LOADOUT, armour: true })).toBeGreaterThan(MAX_SHIELD)
  })

  it('smart bombs clear shots and kill weak enemies, but never finish a boss part', () => {
    const w = armed({ bombs: 1 })
    w.enemies.push({ id: 1, kind: 'drifter', x: 90, y: 100, sx: 90, p: 0, member: 0, hp: 2, age: 0, fire: 99, flash: 0 })
    w.enemyShots.push({ x: 50, y: 50, vx: 0, vy: 10, dmg: 25 })
    const events = step(w, { ...IDLE, bomb: true }, DT).map(e => e.kind)
    expect(events).toContain('bomb')
    expect(w.enemyShots).toHaveLength(0)
    expect(w.enemies.every(e => e.hp <= 0)).toBe(true)
    expect(w.loadout.bombs).toBe(0)
    // Out of bombs: nothing happens.
    expect(step(w, { ...IDLE, bomb: true }, DT).map(e => e.kind)).not.toContain('bomb')

    const bw = createWorld({ ...EMPTY, bossAt: 0 }, carry({ loadout: { ...START_LOADOUT, bombs: 3 } }))
    step(bw, IDLE, DT)
    bw.boss!.pods[0].hp = 3
    for (let i = 0; i < 3; i++) step(bw, { ...IDLE, bomb: true }, DT)
    expect(bw.boss!.pods[0].hp).toBe(1)
  })

  it('capsules keep capped upgrades capped, and turn maxed weapons into pods', () => {
    const w = armed({})
    for (let i = 0; i < 80; i++) applyCapsule(w)
    const l = w.loadout
    expect([l.speed, l.drones, l.rapid]).toEqual([2, 2, 2])
    expect(l.bombs).toBeLessThanOrEqual(MAX_BOMBS)
    expect(l.cannon).toBeLessThan(3)
    expect(l.homing).toBeLessThan(2)
    expect(l.pods.length).toBeGreaterThan(0)
    // Capsules never hand out the shop-only pods.
    expect(l.pods.every(p => p === 'cannon' || p === 'homing')).toBe(true)
  })

  it('sells every new item at a price, and caps the ones that cap', () => {
    const c = carry({ credits: 99999 })
    for (const id of ['drone', 'armour', 'rapid', 'bomb'] as const) expect(buy(c, id), id).toBe('ok')
    expect(buy(c, 'laser')).toBe('mounted')
    expect(buy(c, 'armour')).toBe('maxed')
    buy(c, 'bomb')
    expect(c.loadout.bombs).toBe(MAX_BOMBS)
    expect(buy(c, 'bomb')).toBe('maxed')
  })
})

describe('rear waves', () => {
  const rear = (kind: Wave['kind'], at = 2) =>
    createWorld({ ...EMPTY, waves: [{ at, kind, n: 1, x: 90, from: 'below' }] }, carry())

  it('warn before arriving, then enter below the ship and fly upward', () => {
    const w = rear('drifter')
    w.ship.invuln = 999
    let warnedAt = -1
    let warnings = 0
    for (let i = 0; i < 60 * 2; i++) {
      const ev = step(w, IDLE, DT)
      if (ev.some(e => e.kind === 'rearwarn')) { warnedAt = w.time; warnings++ }
      if (w.time < 2) expect(w.enemies).toHaveLength(0)
    }
    expect(warnings).toBe(1)
    expect(warnedAt).toBeCloseTo(2 - REAR_WARNING, 1)
    expect(rearWarnings(createWorld(w.level, carry()))).toEqual([])

    run(w, 0.2)
    const e = w.enemies[0]
    expect(e.below).toBe(true)
    // Spawns beneath the lowest point the ship can reach, so never on top of it.
    expect(e.y).toBeGreaterThan(H - 12 + SHIP_H)
    const y0 = e.y
    run(w, 1)
    expect(e.y).toBeLessThan(y0)
  })

  it('lists upcoming rear waves for the warning arrows', () => {
    const w = rear('swooper', 3)
    run(w, 1)
    expect(rearWarnings(w)).toEqual([])
    run(w, 0.6)
    const [warning] = rearWarnings(w)
    expect(warning.x).toBe(90)
    expect(warning.t).toBeGreaterThan(0)
    expect(warning.t).toBeLessThanOrEqual(REAR_WARNING)
  })

  it('rear spinners shoot from where they really are', () => {
    const w = rear('spinner', 0)
    w.ship.invuln = 999
    w.ship.x = MARGIN + SHIP_W // out of its path, so it isn't rammed
    for (let i = 0; i < 60 * 4 && w.enemyShots.length === 0; i++) step(w, IDLE, DT)
    const shot = w.enemyShots[0]
    const e = w.enemies[0]
    expect(Math.abs(shot.y - e.y)).toBeLessThan(5)
  })

  it('only mirror kinds that make sense from behind', () => {
    for (const l of LEVELS) {
      for (const wv of l.waves.filter(v => v.from === 'below')) {
        expect(REAR_KINDS, `${l.name} rear wave at ${wv.at}`).toContain(wv.kind)
      }
    }
  })
})

describe('difficulty tiers', () => {
  it('toughens enemies on later tiers', () => {
    expect(tierScale(1)).toEqual({ hp: 1, fire: 1, speed: 1 })
    const late = { ...EMPTY, tier: 3, waves: [{ at: 0, kind: 'turret' as const, n: 1, x: 90 }] }
    const w = createWorld(late, carry())
    step(w, IDLE, DT)
    expect(w.enemies[0].hp).toBeGreaterThan(ENEMIES.turret.hp)
  })
})

describe('shop', () => {
  it('charges credits and upgrades the loadout', () => {
    const c = carry({ credits: 1000 })
    expect(buy(c, 'cannon')).toBe('ok')
    expect(c.loadout.cannon).toBe(2)
    expect(c.credits).toBe(750)
  })

  it('refuses when too poor, without changing anything', () => {
    const c = carry({ credits: 100 })
    expect(buy(c, 'side')).toBe('poor')
    expect(c.loadout.side).toBe(false)
    expect(c.credits).toBe(100)
  })

  it('refuses maxed items', () => {
    const c = carry({ credits: 99999, lives: MAX_LIVES })
    expect(buy(c, 'life')).toBe('maxed')
    buy(c, 'speed'); buy(c, 'speed')
    expect(priceOf('speed', c)).toBeNull()
    expect(buy(c, 'speed')).toBe('maxed')
  })
})

describe('pods', () => {
  it('maxing the cannon mounts a cannon pod and starts the cannon over', () => {
    const c = carry({ credits: 99999 })
    expect(buy(c, 'cannon')).toBe('ok')
    expect(buy(c, 'cannon')).toBe('mounted')
    expect(c.loadout.pods).toEqual(['cannon'])
    expect(c.loadout.cannon).toBe(1)
    // The climb starts again, pricier: pods scale up per pod of that type.
    expect(priceOf('cannon', c)).toBeGreaterThan(250)
  })

  it('side, rear and laser mount straight away, and keep stacking', () => {
    const c = carry({ credits: 99999 })
    for (let i = 0; i < 3; i++) expect(buy(c, 'rear')).toBe('mounted')
    buy(c, 'side')
    expect(c.loadout.pods).toEqual(['rear', 'rear', 'rear', 'side'])
    expect(c.loadout.rear).toBe(false)
  })

  it('has no cap: dozens of pods all get their own slot inside the tunnel', () => {
    const slots = Array.from({ length: 40 }, (_, i) => podSlot(i))
    const keys = new Set(slots.map(s => `${Math.round(s.dx)},${Math.round(s.dy)}`))
    expect(keys.size).toBe(40)
    for (const s of slots) expect(Math.abs(s.dx)).toBeLessThan(W / 2 - MARGIN)
    // The first ring fills the wings before the nose and tail.
    expect(Math.abs(slots[0].dy)).toBeLessThan(1)
    expect(Math.abs(slots[1].dy)).toBeLessThan(1)
  })

  it('pods fire their weapon, but cannot be hit', () => {
    const w = createWorld(EMPTY, carry({ loadout: { ...START_LOADOUT, pods: ['rear', 'laser'] } }))
    w.ship.invuln = 0
    run(w, 0.1, { fire: true }) // pods' first shots are staggered slightly
    expect(w.shots.some(s => s.vy > 0)).toBe(true) // rear pod
    expect(w.shots.some(s => s.pierce)).toBe(true) // laser pod
    const pod = podPos(w, 0)
    w.enemyShots.push({ x: pod.x, y: pod.y, vx: 0, vy: 0, dmg: 25 })
    step(w, IDLE, DT)
    expect(w.ship.shield).toBe(MAX_SHIELD)
  })

  it('losing a ship costs the newest pod instead of a cannon level', () => {
    const w = createWorld(EMPTY, carry({ loadout: { ...START_LOADOUT, cannon: 2, pods: ['cannon', 'side'] } }))
    w.ship.invuln = 0
    w.ship.shield = 1
    w.enemyShots.push({ x: w.ship.x, y: w.ship.y, vx: 0, vy: 0, dmg: 25 })
    const events = step(w, IDLE, DT)
    expect(w.ship.alive).toBe(false)
    expect(w.loadout.pods).toEqual(['cannon'])
    expect(w.loadout.cannon).toBe(2)
    expect(events.find(e => e.kind === 'podlost')?.detail).toBe('side')
  })

  it('are copied, never shared, between a carry and a world', () => {
    const c = carry({ loadout: { ...START_LOADOUT, pods: ['rear'] } })
    const w = createWorld(EMPTY, c)
    w.loadout.pods.push('side')
    expect(c.loadout.pods).toEqual(['rear'])
    expect(cloneLoadout(c.loadout).pods).not.toBe(c.loadout.pods)
  })
})

describe('difficulty keeps up with the ship', () => {
  const fleet = (n: number): Carry['loadout'] =>
    ({ ...expectedLoadout(5), pods: Array.from({ length: n }, (_, i) => (['cannon', 'laser', 'homing'] as const)[i % 3]) })

  it('leaves a ship at the expected power untouched', () => {
    for (let tier = 1; tier <= 5; tier++) expect(powerScale(expectedLoadout(tier), tier)).toBe(1)
    expect(powerScale(expectedLoadout(1), 5)).toBe(1) // weaker than expected: never easier than designed
  })

  it('toughens enemies against a big fleet, but only partly', () => {
    const big = fleet(24)
    const scale = powerScale(big, 5)
    const ratio = firepower(big) / firepower(expectedLoadout(5))
    expect(scale).toBeGreaterThan(2)
    // Enemies still die faster to the bigger ship: the upgrades still count.
    expect(ratio / scale).toBeGreaterThan(1)
  })

  it('applies to spawned enemies and to bosses', () => {
    const plain = createWorld({ ...LEVELS[4], waves: [{ at: 0, kind: 'turret', n: 1, x: 90 }] }, carry({ loadout: expectedLoadout(5) }))
    const strong = createWorld({ ...LEVELS[4], waves: [{ at: 0, kind: 'turret', n: 1, x: 90 }] }, carry({ loadout: fleet(24) }))
    step(plain, IDLE, DT)
    step(strong, IDLE, DT)
    expect(strong.enemies[0].hp).toBeGreaterThan(plain.enemies[0].hp * 2)

    const boss = createWorld({ ...LEVELS[4], waves: [], bossAt: 0, miniboss: undefined }, carry({ loadout: fleet(24) }))
    step(boss, IDLE, DT)
    expect(boss.boss!.core.max).toBeGreaterThan(LEVELS[4].boss.coreHp * 2)
  })

  it('makes enemies immune until they are fully on screen', () => {
    const w = createWorld({ ...EMPTY, waves: [{ at: 0, kind: 'turret', n: 1, x: 90 }] }, carry())
    step(w, IDLE, DT)
    const e = w.enemies[0]
    expect(onScreen(e)).toBe(false)
    w.shots.push({ x: e.x, y: e.y, vx: 0, vy: 0, dmg: 99 })
    step(w, IDLE, DT)
    expect(e.hp).toBeGreaterThan(0)
    run(w, 2)
    expect(onScreen(e)).toBe(true)
    w.shots.push({ x: e.x, y: e.y, vx: 0, vy: 0, dmg: 99 })
    step(w, IDLE, DT)
    expect(e.hp).toBeLessThanOrEqual(0)
  })

  it('makes a boss immune while it arrives', () => {
    const w = createWorld({ ...EMPTY, bossAt: 0 }, carry())
    step(w, IDLE, DT)
    const b = w.boss!
    const pod = b.pods[0]
    for (let i = 0; i < 30; i++) w.shots.push({ x: b.x + pod.ox, y: b.y + pod.oy, vx: 0, vy: 0, dmg: 1 })
    step(w, IDLE, DT)
    expect(pod.hp).toBe(pod.max)
  })
})

describe('gold bonus formations', () => {
  const formation = (n: number, extra: Partial<Wave> = {}) =>
    createWorld({ ...EMPTY, waves: [{ at: 0, kind: 'turret', n, x: 40, dx: 45, gap: 0, bonus: true, ...extra }] }, carry())
  /** Let the wave drift fully on screen, then kill `count` of its members. */
  function killSome(w: World, count: number) {
    run(w, 2)
    const targets = w.enemies.slice(0, count)
    for (const e of targets) w.shots.push({ x: e.x, y: e.y, vx: 0, vy: 0, dmg: 999 })
    return run(w, DT)
  }

  it('drops a capsule for wiping out a whole formation', () => {
    const w = formation(3)
    w.ship.invuln = 999
    const events = killSome(w, 3)
    expect(events).toContain('wavebonus')
    expect(w.pickups.filter(p => p.kind === 'capsule')).toHaveLength(1)
  })

  it('gives nothing if any member escapes', () => {
    const w = formation(3)
    w.ship.invuln = 999
    run(w, 2)
    w.enemies[2].y = H + 100 // this one gets away
    const events = killSome(w, 2)
    expect(events).not.toContain('wavebonus')
    expect(w.pickups.some(p => p.kind === 'capsule')).toBe(false)
  })

  it('only gold formations pay out: wiping out an ordinary wave earns nothing', () => {
    const w = formation(4, { bonus: false })
    w.ship.invuln = 999
    expect(killSome(w, 4)).not.toContain('wavebonus')
    expect(w.pickups.some(p => p.kind === 'capsule')).toBe(false)
  })

  it('are rare: a few real formations per level, spread through it', () => {
    for (const l of LEVELS) {
      const gold = l.waves.filter(v => v.bonus)
      expect(gold.length, l.name).toBeGreaterThanOrEqual(2)
      expect(gold.length, l.name).toBeLessThanOrEqual(4)
      for (const v of gold) expect(v.n, `${l.name} gold wave at ${v.at}`).toBeGreaterThanOrEqual(BONUS_WAVE_MIN)
      // At least one before the miniboss and one after it.
      expect(gold.some(v => v.at < l.miniboss!.at), l.name).toBe(true)
      expect(gold.some(v => v.at > l.miniboss!.at), l.name).toBe(true)
    }
  })

  it('ignores enemies released mid-fight (carriers, splitters, bosses)', () => {
    const w = createWorld(EMPTY, carry())
    w.ship.invuln = 999
    run(w, DT)
    for (let i = 0; i < 3; i++) w.enemies.push({ id: 100 + i, kind: 'turret', x: 40 + i * 40, y: 100, sx: 40, p: 0, member: i, hp: 1, age: 0, fire: 99, flash: 0 })
    for (const e of w.enemies) w.shots.push({ x: e.x, y: e.y, vx: 0, vy: 0, dmg: 99 })
    expect(run(w, DT)).not.toContain('wavebonus')
  })
})

describe('minibosses', () => {
  const MINI = { ...LEVELS[0].miniboss!.boss, coreHp: 5, podHp: 3 }
  const midLevel = (waves: Wave[] = []) =>
    createWorld({ ...EMPTY, bossAt: 999, waves, miniboss: { at: 1, boss: MINI } }, carry())

  it('appears at its time once the screen is clear, and holds the timeline', () => {
    const w = midLevel([{ at: 0.5, kind: 'turret', n: 1, x: 90 }, { at: 1.5, kind: 'drifter', n: 1, x: 90 }])
    w.ship.invuln = 999
    run(w, 1.2)
    // A turret from before is still on screen: the timeline waits, nothing new spawns.
    expect(w.miniState).toBe('waiting')
    expect(w.boss).toBeNull()
    const t = w.time
    w.enemies = []
    run(w, DT)
    expect(w.boss?.mini).toBe(true)
    run(w, 3)
    expect(w.time).toBe(t) // frozen during the fight
    expect(w.enemies.some(e => e.kind === 'drifter')).toBe(false)
  })

  it('resumes the level when killed, paying credits and a capsule', () => {
    const w = midLevel([{ at: 1.5, kind: 'drifter', n: 1, x: 90 }])
    w.ship.invuln = 999
    run(w, 1.1)
    const b = w.boss!
    b.y = 64
    b.pods.forEach(p => { p.hp = 0 })
    const credits = w.credits
    for (let i = 0; i < 10; i++) w.shots.push({ x: b.x, y: b.y, vx: 0, vy: 0, dmg: 1 })
    const events = step(w, IDLE, DT)
    expect(events.find(e => e.kind === 'bossdie')?.detail).toBe('mini')
    expect(w.credits).toBeGreaterThan(credits)
    expect(w.pickups.some(p => p.kind === 'capsule')).toBe(true)
    run(w, 3)
    expect(w.status).toBe('playing') // a miniboss never ends the level
    expect(w.boss).toBeNull()
    expect(w.miniState).toBe('done')
    run(w, 1)
    expect(w.enemies.some(e => e.kind === 'drifter')).toBe(true) // the timeline carries on
  })

  it('is smaller than a full boss, hitbox and all', () => {
    const w = midLevel()
    run(w, 1.1)
    expect(w.boss!.core.w).toBeLessThan(36)
  })

  it('every level has one, halfway, before its boss', () => {
    for (const l of LEVELS) {
      expect(l.miniboss, l.name).toBeTruthy()
      expect(l.miniboss!.at).toBeGreaterThan(l.bossAt * 0.3)
      expect(l.miniboss!.at).toBeLessThan(l.bossAt * 0.7)
    }
  })
})

describe('collector drone', () => {
  const withCollector = (on: boolean) => createWorld(EMPTY, carry({ loadout: { ...START_LOADOUT, collector: on } }))

  it('flies out, fetches a far-off bubble and banks it', () => {
    const w = withCollector(true)
    w.ship.x = MARGIN + SHIP_W // bubble is on the far side, well out of the ship's reach
    w.pickups.push({ x: W - 30, y: 120, kind: 'credit', value: 15 })
    let fetching = false
    for (let i = 0; i < 60 * 3 && w.pickups.length; i++) { step(w, IDLE, DT); fetching ||= w.collector.fetching }
    expect(fetching).toBe(true)
    expect(w.pickups).toHaveLength(0)
    expect(w.credits).toBe(15)
  })

  it('brings capsules home too, applying the upgrade', () => {
    const w = withCollector(true)
    w.pickups.push({ x: W - 30, y: 120, kind: 'capsule', value: 0 })
    const events = run(w, 3)
    expect(events).toContain('capsule')
  })

  it('does nothing without the upgrade', () => {
    const w = withCollector(false)
    w.ship.x = MARGIN + SHIP_W
    w.pickups.push({ x: W - 30, y: 120, kind: 'credit', value: 15 })
    run(w, 1)
    expect(w.credits).toBe(0)
  })

  it('is a one-off purchase', () => {
    const c = carry({ credits: 5000 })
    expect(buy(c, 'collector')).toBe('ok')
    expect(c.loadout.collector).toBe(true)
    expect(buy(c, 'collector')).toBe('maxed')
  })
})

describe('continues', () => {
  it('restart the level with its starting loadout and credits, fresh ships and no score', () => {
    const start = carry({ credits: 420, score: 9000, lives: 1, loadout: { ...START_LOADOUT, cannon: 3, laser: true } })
    const c = continueCarry(start, 3)
    expect(c).toEqual({ loadout: start.loadout, credits: 420, score: 0, lives: 3 })
    // A copy: the dead run can't leak changes into the continue.
    c.loadout.cannon = 1
    expect(start.loadout.cannon).toBe(3)
  })
})

describe('levels', () => {
  it('keep every spawn inside the playfield', () => {
    for (const l of LEVELS) {
      for (const wv of l.waves) {
        for (let i = 0; i < wv.n; i++) {
          const x = wv.x + i * (wv.dx ?? 0)
          expect(x, `${l.name} wave at ${wv.at}`).toBeGreaterThanOrEqual(MARGIN)
          expect(x, `${l.name} wave at ${wv.at}`).toBeLessThanOrEqual(W - MARGIN)
        }
      }
    }
  })

  it('is deterministic for a given seed', () => {
    const a = createWorld(LEVELS[0], carry(), 3)
    const b = createWorld(LEVELS[0], carry(), 3)
    run(a, 20, { fire: true })
    run(b, 20, { fire: true })
    expect(a.score).toBe(b.score)
    expect(a.ship).toEqual(b.ship)
    expect(H).toBe(320)
  })
})
