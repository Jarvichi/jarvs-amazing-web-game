import { describe, it, expect } from 'vitest'
import {
  AMBIENT_LINES_GENERIC, DAY_LINES, NIGHT_LINES, GHOST_LINES,
  ARRIVAL_LINES, DOORWAY_LINES, INDOOR_LINES, RAIN_LINES, SNOW_LINES, FOG_LINES,
  SCARED_PHRASES,
  ambientLinePool, contextKey, makeAmbientLineCursor, nextAmbientLine,
  type AmbientLineContext,
} from './ambientDialogue'

const ctx = (over: Partial<AmbientLineContext> = {}): AmbientLineContext => ({
  isNight: false, weather: 'clear', isGhost: false, situation: 'street', ...over,
})

const ALL_POOLS = {
  AMBIENT_LINES_GENERIC, DAY_LINES, NIGHT_LINES, GHOST_LINES,
  ARRIVAL_LINES, DOORWAY_LINES, INDOOR_LINES, RAIN_LINES, SNOW_LINES, FOG_LINES,
  SCARED_PHRASES,
}

describe('line pools', () => {
  it('replaces the old eight-line pool with a substantial one', () => {
    expect(AMBIENT_LINES_GENERIC.length).toBeGreaterThanOrEqual(100)
  })

  it('has no duplicate line within any pool', () => {
    for (const [name, pool] of Object.entries(ALL_POOLS)) {
      expect(new Set(pool).size, name).toBe(pool.length)
    }
  })

  it('has no blank or untrimmed lines', () => {
    for (const [name, pool] of Object.entries(ALL_POOLS)) {
      for (const line of pool) {
        expect(line.trim(), name).toBe(line)
        expect(line.length, name).toBeGreaterThan(0)
      }
    }
  })

  it('keeps lines short enough for a speech bubble', () => {
    for (const pool of Object.values(ALL_POOLS)) {
      for (const line of pool) expect(line.length).toBeLessThanOrEqual(70)
    }
  })
})

describe('ambientLinePool', () => {
  it('layers day lines onto the generic pool by day', () => {
    const pool = ambientLinePool(ctx())
    expect(pool).toEqual(expect.arrayContaining([...AMBIENT_LINES_GENERIC, ...DAY_LINES]))
    expect(pool).not.toEqual(expect.arrayContaining(NIGHT_LINES))
  })

  it('swaps in night lines after dark', () => {
    const pool = ambientLinePool(ctx({ isNight: true }))
    expect(pool).toEqual(expect.arrayContaining(NIGHT_LINES))
    for (const line of DAY_LINES) expect(pool).not.toContain(line)
  })

  it('adds weather lines only for weather that is actually happening', () => {
    expect(ambientLinePool(ctx({ weather: 'rain' }))).toEqual(expect.arrayContaining(RAIN_LINES))
    const clear = ambientLinePool(ctx({ weather: 'clear' }))
    for (const line of [...RAIN_LINES, ...SNOW_LINES, ...FOG_LINES]) expect(clear).not.toContain(line)
  })

  it('drops weather lines indoors, where nobody can see the sky', () => {
    const pool = ambientLinePool(ctx({ weather: 'snow', situation: 'indoors' }))
    for (const line of SNOW_LINES) expect(pool).not.toContain(line)
    expect(pool).toEqual(expect.arrayContaining(INDOOR_LINES))
  })

  it('adds situation lines for arriving and doorway wanderers', () => {
    expect(ambientLinePool(ctx({ situation: 'arriving' }))).toEqual(expect.arrayContaining(ARRIVAL_LINES))
    expect(ambientLinePool(ctx({ situation: 'doorway' }))).toEqual(expect.arrayContaining(DOORWAY_LINES))
  })

  it('lets ghosts speak only ghost lines', () => {
    const pool = ambientLinePool(ctx({ isGhost: true, isNight: true, weather: 'fog' }))
    expect(pool).toEqual(GHOST_LINES)
  })
})

describe('contextKey', () => {
  it('changes when any context field changes', () => {
    const base = contextKey(ctx())
    for (const over of [
      { isNight: true }, { weather: 'fog' as const }, { isGhost: true }, { situation: 'indoors' as const },
    ]) {
      expect(contextKey(ctx(over))).not.toBe(base)
    }
  })
})

describe('nextAmbientLine', () => {
  it('walks the whole pool before repeating anything', () => {
    const c = ctx()
    const cursor = makeAmbientLineCursor('npc-1', c)
    const size = cursor.queue.length
    const seen = Array.from({ length: size }, () => nextAmbientLine(cursor, 'npc-1', c))
    expect(new Set(seen).size).toBe(size)
  })

  it('reshuffles on wrap instead of replaying the same order', () => {
    const c = ctx()
    const cursor = makeAmbientLineCursor('npc-2', c)
    const size = cursor.queue.length
    const first = Array.from({ length: size }, () => nextAmbientLine(cursor, 'npc-2', c))
    const second = Array.from({ length: size }, () => nextAmbientLine(cursor, 'npc-2', c))
    expect(second).not.toEqual(first)
    expect(new Set(second).size).toBe(size)
  })

  it('never repeats the previous line across the wrap', () => {
    const c = ctx()
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const cursor = makeAmbientLineCursor(seed, c)
      let last = ''
      for (let i = 0; i <= cursor.queue.length; i++) {
        const line = nextAmbientLine(cursor, seed, c)
        expect(line).not.toBe(last)
        last = line
      }
    }
  })

  it('rebuilds the queue when the context changes', () => {
    const cursor = makeAmbientLineCursor('npc-3', ctx())
    nextAmbientLine(cursor, 'npc-3', ctx())
    const line = nextAmbientLine(cursor, 'npc-3', ctx({ isGhost: true }))
    expect(GHOST_LINES).toContain(line)
    expect(cursor.idx).toBe(1)
  })

  it('gives two wanderers in the same context different line orders', () => {
    const c = ctx()
    const a = makeAmbientLineCursor('npc-a', c)
    const b = makeAmbientLineCursor('npc-b', c)
    expect(a.queue).not.toEqual(b.queue)
    expect([...a.queue].sort()).toEqual([...b.queue].sort())
  })

  it('is deterministic for a given wanderer', () => {
    const c = ctx({ isNight: true, weather: 'snow' })
    expect(makeAmbientLineCursor('npc-4', c).queue).toEqual(makeAmbientLineCursor('npc-4', c).queue)
  })

  it('recovers if a cursor is somehow left with an empty queue', () => {
    const c = ctx()
    const cursor = makeAmbientLineCursor('npc-5', c)
    cursor.queue = []
    expect(typeof nextAmbientLine(cursor, 'npc-5', c)).toBe('string')
  })
})
