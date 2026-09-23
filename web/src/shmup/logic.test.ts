import { describe, it, expect } from 'vitest'
import {
  BASE_SPEED, H, MARGIN, MAX_LIVES, MAX_SHIELD, SHIP_W, START_LOADOUT, W,
  buy, coreExposed, createWorld, priceOf, step,
  type Carry, type Input, type LevelDef, type World,
} from './logic'
import { LEVELS } from './levels'

const DT = 1 / 60
const IDLE: Input = { dx: 0, dy: 0, dragX: 0, dragY: 0, fire: false }

const EMPTY: LevelDef = {
  name: 'TEST',
  theme: 'flesh',
  bossAt: 9999,
  waves: [],
  boss: { name: 'B', coreHp: 10, pods: [{ ox: -30, oy: 0 }], podHp: 5, spread: 3, sway: 0.5 },
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
