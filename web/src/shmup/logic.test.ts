import { describe, it, expect } from 'vitest'
import {
  BASE_SPEED, ENEMIES, H, MARGIN, MAX_LIVES, MAX_SHIELD, SHIP_W, START_LOADOUT, W,
  buy, coreExposed, createWorld, priceOf, step, tierScale,
  type Attack, type BossPhase, type Carry, type Input, type LevelDef, type Wave, type World,
} from './logic'
import { currentPhase, healthFraction } from './boss'
import { LEVELS } from './levels'

const DT = 1 / 60
const IDLE: Input = { dx: 0, dy: 0, dragX: 0, dragY: 0, fire: false }

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
  ({ loadout: { ...START_LOADOUT }, score: 0, credits: 0, lives: 3, ...over })

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
    expect([shotsFor(1), shotsFor(2), shotsFor(3)]).toEqual([1, 2, 3])
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
    const w = createWorld(EMPTY, carry({ loadout: { ...START_LOADOUT, cannon: 3 } }))
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
    expect(w.loadout.cannon).toBe(2)
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

  it.each(LEVELS.map(l => [l.name, l] as const))(
    '%s can be finished with starting weapons in reasonable time', (_, level) => {
      // An invulnerable ship that tracks the nearest threat and holds fire.
      const w = createWorld(level, carry(), 7)
      for (let i = 0; i < 60 * 60 * 5 && w.status === 'playing'; i++) {
        w.ship.invuln = 1
        const target = w.boss ? w.boss.x + (w.boss.pods.find(p => p.hp > 0)?.ox ?? 0) : (w.enemies[0]?.x ?? W / 2)
        step(w, { ...IDLE, dx: Math.sign(target - w.ship.x), fire: true }, DT)
      }
      expect(w.status).toBe('won')
      expect(w.time).toBeLessThan(level.bossAt + 60)
      expect(w.credits).toBeGreaterThan(300) // enough to afford something in the shop
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
    buy(c, 'cannon'); buy(c, 'cannon')
    expect(priceOf('cannon', c)).toBeNull()
    expect(buy(c, 'cannon')).toBe('maxed')
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
