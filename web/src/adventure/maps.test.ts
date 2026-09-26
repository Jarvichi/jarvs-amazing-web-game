import { describe, it, expect } from 'vitest'
import { MAPS, QUESTS, START, DUNGEON_IDS, type GameMap } from './maps'
import { OVERWORLD_TILES } from './emberfall'
import { RH, RW, TILE, stopsShots, walkable } from './tiles'
import { FROST_TILES } from './frostreach'

const LEGAL = new Set('.,FA=TaRMgWw~BXCDhHQK:#soLS;_OVPI')
const tileKey = (x: number, y: number) => `${x},${y}`
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]]

type Gear = 'sword' | 'bombs' | 'rod' | 'boots' | 'gloves' | 'grapple' | 'shield'
const GEAR = new Set<string>(['sword', 'bombs', 'rod', 'boots', 'gloves', 'grapple', 'shield'])

/** Gear a boss can't be beaten without (besides the sword). */
const BOSS_NEEDS: Partial<Record<string, Gear>> = { king: 'rod', glasseye: 'shield', warden: 'shield' }

/**
 * Walk every land tile by tile, the way a player could: pick up what is
 * reachable, spend keys on locked doors, blow up / burn / cut / lift what the
 * gear allows, grapple across chasms, take ships, and repeat until nothing new
 * opens. `withhold` never hands over that piece of gear, to prove it's needed.
 */
function explore(withhold?: Gear) {
  const gear = new Set<Gear>()
  const flags = new Set<string>()
  const reached = new Set<string>() // "map:x,y"
  const opened = new Set<string>() // "map:group"
  const taken = new Set<string>()
  const keys: Record<string, number> = {}
  const queue: [string, number, number][] = []

  const visit = (map: string, x: number, y: number) => {
    const k = `${map}:${x},${y}`
    if (reached.has(k)) return false
    reached.add(k)
    queue.push([map, x, y])
    return true
  }
  const visitWarp = (w: { map: string; x: number; y: number }) =>
    visit(w.map, Math.floor((w.x + 8) / TILE), Math.floor((w.y + 12) / TILE))
  const tileOf = (m: GameMap, x: number, y: number) => m.tiles[y]?.[x]
  const groupOf = (m: GameMap, x: number, y: number) => m.groups[tileKey(x, y)] ?? tileKey(x, y)
  const flamesIn = (m: GameMap) => QUESTS[m.quest].dungeons.filter(d => flags.has(`got:flame:${d}`)).length

  const passable = (m: GameMap, x: number, y: number): boolean => {
    const ch = tileOf(m, x, y)
    if (ch === undefined) return false
    if ('LCXO'.includes(ch)) return opened.has(`${m.id}:${groupOf(m, x, y)}`)
    if (ch === 'B') return gear.has('sword')
    if (ch === 'K') return flamesIn(m) >= QUESTS[m.quest].dungeons.length
    if (ch === 'S') return true // shutters open once the room is cleared
    return walkable(ch, { boots: gear.has('boots') })
  }

  const tryOpen = (m: GameMap, x: number, y: number): boolean => {
    const ch = tileOf(m, x, y)
    const k = `${m.id}:${groupOf(m, x, y)}`
    if (!ch || opened.has(k)) return false
    const can = (ch === 'C' && gear.has('bombs')) || (ch === 'X' && gear.has('rod'))
      || (ch === 'O' && gear.has('gloves')) || (ch === 'L' && (keys[m.id] ?? 0) > 0)
    if (!can) return false
    if (ch === 'L') keys[m.id]--
    opened.add(k)
    return true
  }

  /** The grapple: a straight line over gaps and ground to a post in the same room. */
  const grapple = (m: GameMap, x: number, y: number) => {
    if (!gear.has('grapple')) return false
    let moved = false
    const room = `${Math.floor(x / RW)},${Math.floor(y / RH)}`
    for (const [dx, dy] of SIDES) {
      for (let k = 1; k <= 7; k++) {
        const tx = x + dx * k
        const ty = y + dy * k
        if (`${Math.floor(tx / RW)},${Math.floor(ty / RH)}` !== room) break
        const ch = tileOf(m, tx, ty)
        if (ch === 'P') {
          if (k > 1 && passable(m, tx - dx, ty - dy)) moved = visit(m.id, tx - dx, ty - dy) || moved
          break
        }
        if (ch === undefined || (stopsShots(ch) && !passable(m, tx, ty))) break
      }
    }
    return moved
  }

  const give = (item: string) => {
    if (GEAR.has(item) && item !== withhold) gear.add(item as Gear)
  }

  const roomReached = (m: GameMap, rx: number, ry: number) => {
    for (let y = 0; y < RH; y++) {
      for (let x = 0; x < RW; x++) if (reached.has(`${m.id}:${rx * RW + x},${ry * RH + y}`)) return true
    }
    return false
  }

  const collect = () => {
    let changed = false
    for (const m of Object.values(MAPS)) {
      for (const [room, def] of Object.entries(m.rooms)) {
        const [rx, ry] = room.split(',').map(Number)
        if (!roomReached(m, rx, ry)) continue
        const id = `${m.id}:${room}`
        const take = (what: string, fn: () => void) => {
          if (taken.has(`${id}:${what}`)) return
          taken.add(`${id}:${what}`)
          fn()
          changed = true
        }
        if (def.key) take('key', () => { keys[m.id] = (keys[m.id] ?? 0) + 1 })
        if (def.item) take('item', () => give(def.item!))
        const needs = def.boss && BOSS_NEEDS[def.boss]
        if (def.boss && gear.has('sword') && (!needs || gear.has(needs))) {
          take('boss', () => {
            flags.add(`boss:${m.id}`)
            if (QUESTS[m.quest].dungeons.includes(m.id)) flags.add(`got:flame:${m.id}`)
          })
        }
        for (const n of def.npcs ?? []) {
          if (n.ferry && (!n.ferry.needs || flags.has(n.ferry.needs)) && visitWarp(n.ferry.to)) changed = true
        }
      }
    }
    return changed
  }

  visitWarp(START)
  for (let changed = true; changed;) {
    changed = false
    while (queue.length) {
      const [id, x, y] = queue.shift()!
      const m = MAPS[id]
      const warp = m.warps[tileKey(x, y)]
      if (warp && ['D', 'C', 'O'].includes(tileOf(m, x, y))) visitWarp(warp)
      for (const [dx, dy] of SIDES) if (passable(m, x + dx, y + dy)) visit(id, x + dx, y + dy)
    }
    for (const k of [...reached]) {
      const [id, pos] = k.split(':')
      const [x, y] = pos.split(',').map(Number)
      const m = MAPS[id]
      // Spend what we have on whatever blocks the edge of the explored area.
      for (const [dx, dy] of SIDES) {
        if (tryOpen(m, x + dx, y + dy)) {
          changed = true
          visit(id, x + dx, y + dy)
        }
        // Newly passable tiles (a bush once the sword is in hand, the gate…).
        if (!reached.has(`${id}:${x + dx},${y + dy}`) && passable(m, x + dx, y + dy)) {
          visit(id, x + dx, y + dy)
          changed = true
        }
      }
      if (grapple(m, x, y)) changed = true
    }
    if (collect()) changed = true
  }
  const mapsReached = new Set([...reached].map(k => k.split(':')[0]))
  const finals = new Set(Object.values(QUESTS).filter(q => flags.has(`boss:${q.final.map}`)).map(q => q.final.boss))
  const flames = (quest: keyof typeof QUESTS) => QUESTS[quest].dungeons.filter(d => flags.has(`got:flame:${d}`)).length
  return { gear, flames, finals, reached, mapsReached, taken }
}

describe('map data', () => {
  it.each([
    ['Emberfall', OVERWORLD_TILES, 6, 5],
    ['the Frostreach', FROST_TILES, 5, 4],
  ] as const)('%s is %i×%i screens of 16×11 tiles', (_, tiles, cols, rows) => {
    expect(tiles).toHaveLength(rows * RH)
    tiles.forEach((row, y) => expect(row.length, `row ${y}`).toBe(cols * RW))
  })

  it('every map is rectangular and uses known tiles only', () => {
    for (const m of Object.values(MAPS)) {
      expect(m.tiles, m.id).toHaveLength(m.rows * RH)
      for (const row of m.tiles) {
        expect(row.length, m.id).toBe(m.cols * RW)
        for (const ch of row) expect(LEGAL.has(ch), `${m.id} has '${ch}'`).toBe(true)
      }
    }
  })

  it('every doorway leads somewhere, and arrives on open ground', () => {
    for (const m of Object.values(MAPS)) {
      m.tiles.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === 'D') expect(m.warps[tileKey(x, y)], `${m.id} door ${x},${y}`).toBeDefined()
      }))
      for (const [at, w] of Object.entries(m.warps)) {
        const dest = MAPS[w.map]
        expect(dest, `${m.id} ${at} → ${w.map}`).toBeDefined()
        const ch = dest.tiles[Math.floor((w.y + 12) / TILE)][Math.floor((w.x + 8) / TILE)]
        // Thorns, boulders and the gate are open by the time you can be coming back out.
        const open = walkable(ch, { boots: false }) || ch === 'X' || ch === 'O' || ch === 'K'
        expect(open && ch !== 'D', `${m.id} ${at} lands on '${ch}'`).toBe(true)
      }
    }
  })

  it('each dungeon has exactly as many keys as locked doors', () => {
    for (const id of DUNGEON_IDS) {
      const m = MAPS[id]
      const keys = Object.values(m.rooms).filter(r => r.key).length
      const locks = new Set(Object.entries(m.groups)
        .filter(([at]) => { const [x, y] = at.split(',').map(Number); return m.tiles[y][x] === 'L' })
        .map(([, g]) => g)).size
      expect(keys, id).toBe(locks)
    }
  })

  it('each land has three dungeon bosses and a final one', () => {
    const bosses = Object.values(MAPS).flatMap(m => Object.values(m.rooms).map(r => r.boss).filter(Boolean))
    expect(bosses.sort()).toEqual(['drake', 'glasseye', 'king', 'mossback', 'rimefang', 'serpent', 'stormcrow', 'warden'])
  })
})

describe('the adventure can be finished', () => {
  const run = explore()

  it('relights every flame and beats both final bosses', () => {
    expect([...run.gear].sort()).toEqual(['bombs', 'boots', 'gloves', 'grapple', 'rod', 'shield', 'sword'])
    expect(run.flames('emberfall')).toBe(3)
    expect(run.flames('frostreach')).toBe(3)
    expect([...run.finals].sort()).toEqual(['king', 'warden'])
  })

  it('the Frostreach opens only once the Ashen King is beaten', () => {
    const noKing = explore('rod')
    expect(noKing.finals.has('king')).toBe(false)
    expect(noKing.mapsReached.has('frost')).toBe(false)
  })

  it('the Pale Warden needs the mirror shield', () => {
    expect(explore('shield').finals.has('warden')).toBe(false)
  })

  it('every room of every map can be reached', () => {
    for (const m of Object.values(MAPS)) {
      for (let ry = 0; ry < m.rows; ry++) {
        for (let rx = 0; rx < m.cols; rx++) {
          if (m.kind === 'dungeon' && !m.rooms[`${rx},${ry}`]) continue
          let seen = false
          for (let y = 0; y < RH && !seen; y++) {
            for (let x = 0; x < RW && !seen; x++) seen = run.reached.has(`${m.id}:${rx * RW + x},${ry * RH + y}`)
          }
          expect(seen, `${m.id} room ${rx},${ry}`).toBe(true)
        }
      }
    }
  })

  // A gate you walk into must be on the screen you're on, so you can see what stops you.
  it.each([['bombs', 'C'], ['rod', 'X'], ['boots', 'w'], ['gloves', 'O'], ['grapple', 'V']] as const)('every %s gate is in plain sight where you meet it', (gear, gate) => {
    const { reached } = explore(gear)
    const roomOf = (map: string, x: number, y: number) => `${map}:${Math.floor(x / RW)},${Math.floor(y / RH)}`
    const seen = new Set([...reached].map(k => { const [map, pos] = k.split(':'); const [x, y] = pos.split(',').map(Number); return roomOf(map, x, y) }))
    for (const k of reached) {
      const [map, pos] = k.split(':')
      const [x, y] = pos.split(',').map(Number)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (MAPS[map].tiles[y + dy]?.[x + dx] !== gate) continue
        expect(seen.has(roomOf(map, x + dx, y + dy)), `${map} ${gate} at ${x + dx},${y + dy} is off-screen`).toBe(true)
      }
    }
  })

  // Otherwise a player can relight a flame, walk out without the treasure and be stuck.
  it.each([
    ['bombs', 'barrow:0,0'],
    ['rod', 'mine:1,0'],
    ['boots', 'shrine:1,0'],
    ['gloves', 'rimeglass:0,0'],
    ['grapple', 'spire:1,0'],
    ['shield', 'sanctum:1,0'],
  ] as const)('the %s are needed to reach the boss of the dungeon they are found in (%s)', (gear, bossRoom) => {
    expect(explore(gear).taken.has(`${bossRoom}:boss`)).toBe(false)
    expect(explore().taken.has(`${bossRoom}:boss`)).toBe(true)
  })

  it.each([
    ['bombs', 'mine'],
    ['rod', 'shrine'],
    ['boots', 'keep'],
    ['gloves', 'spire'],
    ['grapple', 'sanctum'],
  ] as const)('the %s are needed to reach the %s', (gear, map) => {
    expect(explore(gear).mapsReached.has(map)).toBe(false)
  })
})
