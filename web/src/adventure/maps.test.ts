import { describe, it, expect } from 'vitest'
import { MAPS, OVERWORLD_TILES, START, DUNGEON_IDS, type GameMap } from './maps'
import { RH, RW, TILE, walkable } from './tiles'

const LEGAL = new Set('.,FA=TaRMgWw~BXCDhHQK:#soLS;_')
const tileKey = (x: number, y: number) => `${x},${y}`

type Gear = 'sword' | 'bombs' | 'rod' | 'boots'

/**
 * Walk the whole world tile by tile, the way a player could: pick up what is
 * reachable, spend keys on locked doors, blow up / burn / cut what the gear
 * allows, and repeat until nothing new opens. `withhold` never hands over
 * that piece of gear, to prove it really is needed.
 */
function explore(withhold?: Gear) {
  const gear = new Set<Gear>()
  const reached = new Set<string>() // "map:x,y"
  const opened = new Set<string>() // "map:group"
  const taken = new Set<string>()
  const keys: Record<string, number> = {}
  let flames = 0
  let kingBeaten = false
  const queue: [string, number, number][] = []

  const visit = (map: string, x: number, y: number) => {
    const k = `${map}:${x},${y}`
    if (reached.has(k)) return
    reached.add(k)
    queue.push([map, x, y])
  }
  const tileOf = (m: GameMap, x: number, y: number) => m.tiles[y]?.[x]
  const groupOf = (m: GameMap, x: number, y: number) => m.groups[tileKey(x, y)] ?? tileKey(x, y)

  const passable = (m: GameMap, x: number, y: number): boolean => {
    const ch = tileOf(m, x, y)
    if (ch === undefined) return false
    if ('LCX'.includes(ch)) return opened.has(`${m.id}:${groupOf(m, x, y)}`)
    if (ch === 'B') return gear.has('sword')
    if (ch === 'K') return flames >= 3
    if (ch === 'S') return true // shutters open once the room is cleared
    return walkable(ch, { boots: gear.has('boots') })
  }

  const tryOpen = (m: GameMap, x: number, y: number): boolean => {
    const ch = tileOf(m, x, y)
    const k = `${m.id}:${groupOf(m, x, y)}`
    if (!ch || opened.has(k)) return false
    const can = (ch === 'C' && gear.has('bombs')) || (ch === 'X' && gear.has('rod'))
      || (ch === 'L' && (keys[m.id] ?? 0) > 0)
    if (!can) return false
    if (ch === 'L') keys[m.id]--
    opened.add(k)
    return true
  }

  const give = (item: string) => {
    if (item === 'sword' || item === 'bombs' || item === 'rod' || item === 'boots') {
      if (item !== withhold) gear.add(item)
    }
  }

  const collect = () => {
    let changed = false
    for (const m of Object.values(MAPS)) {
      for (const [room, def] of Object.entries(m.rooms)) {
        const [rx, ry] = room.split(',').map(Number)
        let inRoom = false
        for (let y = 0; y < RH && !inRoom; y++) {
          for (let x = 0; x < RW && !inRoom; x++) inRoom = reached.has(`${m.id}:${rx * RW + x},${ry * RH + y}`)
        }
        if (!inRoom) continue
        const id = `${m.id}:${room}`
        const take = (what: string, fn: () => void) => {
          if (taken.has(`${id}:${what}`)) return
          taken.add(`${id}:${what}`)
          fn()
          changed = true
        }
        if (def.key) take('key', () => { keys[m.id] = (keys[m.id] ?? 0) + 1 })
        if (def.item) take('item', () => give(def.item!))
        if (def.boss && (def.boss !== 'king' || gear.has('rod')) && gear.has('sword')) {
          take('boss', () => { if (def.boss === 'king') kingBeaten = true; else flames++ })
        }
      }
    }
    return changed
  }

  visit('overworld', Math.floor((START.x + 8) / TILE), Math.floor((START.y + 12) / TILE))
  for (let changed = true; changed;) {
    changed = false
    while (queue.length) {
      const [id, x, y] = queue.shift()!
      const m = MAPS[id]
      const warp = m.warps[tileKey(x, y)]
      if (warp && ['D', 'C'].includes(tileOf(m, x, y))) {
        visit(warp.map, Math.floor((warp.x + 8) / TILE), Math.floor((warp.y + 12) / TILE))
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        const ny = y + dy
        if (passable(m, nx, ny)) visit(id, nx, ny)
      }
    }
    // Spend what we have on whatever blocks the edge of the explored area.
    for (const k of [...reached]) {
      const [id, pos] = k.split(':')
      const [x, y] = pos.split(',').map(Number)
      const m = MAPS[id]
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (tryOpen(m, x + dx, y + dy)) {
          changed = true
          visit(id, x + dx, y + dy)
        }
      }
    }
    if (collect()) changed = true
    // Newly passable tiles next to explored ones (a bush once the sword is in hand, the gate…).
    for (const k of [...reached]) {
      const [id, pos] = k.split(':')
      const [x, y] = pos.split(',').map(Number)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!reached.has(`${id}:${x + dx},${y + dy}`) && passable(MAPS[id], x + dx, y + dy)) {
          visit(id, x + dx, y + dy)
          changed = true
        }
      }
    }
  }
  const mapsReached = new Set([...reached].map(k => k.split(':')[0]))
  return { gear, flames, kingBeaten, reached, mapsReached }
}

describe('map data', () => {
  it('overworld is 6×5 screens of 16×11 tiles', () => {
    expect(OVERWORLD_TILES).toHaveLength(5 * RH)
    OVERWORLD_TILES.forEach((row, y) => expect(row.length, `row ${y}`).toBe(6 * RW))
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
        // Thorns and the gate are open by the time you can be coming back out.
        const open = walkable(ch, { boots: false }) || ch === 'X' || ch === 'K'
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

  it('has three flame-keeping bosses and the Ashen King', () => {
    const bosses = Object.values(MAPS).flatMap(m => Object.values(m.rooms).map(r => r.boss).filter(Boolean))
    expect(bosses.sort()).toEqual(['drake', 'king', 'mossback', 'serpent'])
  })
})

describe('the adventure can be finished', () => {
  const run = explore()

  it('relights all three flames and beats the Ashen King', () => {
    expect([...run.gear].sort()).toEqual(['bombs', 'boots', 'rod', 'sword'])
    expect(run.flames).toBe(3)
    expect(run.kingBeaten).toBe(true)
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

  it.each([
    ['bombs', 'mine'],
    ['rod', 'shrine'],
    ['boots', 'keep'],
  ] as const)('the %s are needed to reach the %s', (gear, map) => {
    const without = explore(gear)
    expect(without.mapsReached.has(map)).toBe(false)
    expect(without.kingBeaten).toBe(false)
  })
})
