import { describe, it, expect } from 'vitest'
import { ALL_HINTS, MAPS, START } from './maps'
import { tileAt, type GameEvent, type World } from './state'
import { makeEnemy } from './enemies'
import {
  NO_INPUT, START_HP, nextGoal, continueGame, createWorld, cycleItem, damage, enterMap, hurtPlayer, step, type Controls,
} from './world'
import { DIALOG_COLS, paginate, wrap } from './text'
import { ENEMY_ART, HERO, ITEM_ART, PERSON } from './sprites'
import { SAVE_KEY, fromSave, parseSave, toSave } from './save'
import { RH, RW, TILE, VIEW_H, VIEW_W, enemyWalkable } from './tiles'

const DT = 1 / 60

function tick(w: World, c: Controls = NO_INPUT, frames = 1): GameEvent[] {
  const events: GameEvent[] = []
  for (let i = 0; i < frames; i++) events.push(...step(w, c, DT))
  return events
}
const hold = (w: World, c: Partial<Controls>, seconds: number) => tick(w, { ...NO_INPUT, ...c }, Math.round(seconds * 60))
const press = (w: World, button: 'a' | 'b') => tick(w, { ...NO_INPUT, [button]: true })
const kinds = (events: GameEvent[]) => events.map(e => e.kind)

function closeDialog(w: World) {
  for (let i = 0; w.dialog && i < 40; i++) {
    press(w, 'a')
    tick(w)
  }
}

/** Stand on tile (tx, ty) of a map, with the room's greeting dismissed. */
function put(w: World, map: string, tx: number, ty: number, dx = 0) {
  enterMap(w, { map, x: tx * TILE + dx, y: ty * TILE, dir: 'down' })
  w.dialog = null
}

/** Remove the room's enemies (as if all were beaten) and let the rules notice. */
function clearRoom(w: World) {
  for (const e of w.enemies) e.hp = 0
  w.enemies = []
  tick(w)
}

describe('a new adventure', () => {
  it('starts in the village with three hearts and no sword', () => {
    const w = createWorld()
    expect(w.map.id).toBe('overworld')
    expect([w.rx, w.ry]).toEqual([2, 4])
    expect(w.player.hp).toBe(START_HP)
    expect(w.inv.sword).toBe(false)
    expect(w.enemies).toHaveLength(0)
  })

  it('the smith gives you the blade', () => {
    const w = createWorld()
    put(w, 'overworld', 35, 47, 5) // below the forge door, a little off to one side
    hold(w, { dy: -1 }, 1)
    expect(w.map.id).toBe('smith')
    expect(w.dialog?.pages[0]).toContain('ANVIL')
    closeDialog(w)
    const sword = w.drops.find(d => d.item === 'sword')!
    w.player.x = sword.x
    w.player.y = sword.y
    const ev = tick(w)
    expect(kinds(ev)).toContain('item')
    expect(w.inv.sword).toBe(true)
    expect(w.player.hold).toBe('sword')
    closeDialog(w)
    expect(w.player.hold).toBe(null)
    // It never comes back.
    put(w, 'smith', 7, 8)
    expect(w.drops.some(d => d.item === 'sword')).toBe(false)
  })
})

describe('moving', () => {
  it('trees stop you', () => {
    const w = createWorld()
    put(w, 'overworld', 33, 45)
    hold(w, { dx: -1 }, 1)
    expect(w.player.x).toBeGreaterThanOrEqual(32 * TILE + TILE - 3)
  })

  it('walking off the edge scrolls to the next screen, and its enemies appear', () => {
    const w = createWorld()
    hold(w, { dx: -1 }, 3)
    expect([w.rx, w.ry]).toEqual([1, 4])
    expect(w.scroll).toBe(null)
    expect(w.enemies.map(e => e.kind)).toEqual(['blob', 'blob', 'blob'])
    for (const e of w.enemies) {
      expect(e.x).toBeGreaterThanOrEqual(VIEW_W)
      expect(e.x).toBeLessThan(2 * VIEW_W)
    }
  })

  it('shallow water needs the heron boots', () => {
    const w = createWorld()
    put(w, 'overworld', 38, 24)
    hold(w, { dy: -1 }, 0.5)
    expect(w.player.y).toBeGreaterThanOrEqual(24 * TILE - 8)
    w.inv.boots = true
    hold(w, { dy: -1 }, 0.5)
    expect(w.player.y).toBeLessThan(23 * TILE)
  })

  it('the ashen gate opens for three flames', () => {
    const w = createWorld()
    expect(tileAt(w, 55, 3)).toBe('K')
    w.flags.add('got:flame:barrow')
    w.flags.add('got:flame:mine')
    expect(tileAt(w, 55, 3)).toBe('K')
    w.flags.add('got:flame:shrine')
    expect(tileAt(w, 55, 3)).toBe(',')
  })
})

describe('fighting', () => {
  function arena(kind: Parameters<typeof makeEnemy>[1]) {
    const w = createWorld(7)
    w.inv.sword = true
    put(w, 'overworld', 38, 49)
    const e = makeEnemy(w, kind, 38 * TILE, 50 * TILE)
    e.spawn = 0
    w.enemies = [e]
    w.roomBusy = true
    w.player.dir = 'down'
    return { w, e }
  }

  it('the sword hits once per swing and a blob falls', () => {
    const { w, e } = arena('beetle')
    const ev = press(w, 'a')
    expect(kinds(ev)).toContain('hit')
    expect(e.hp).toBe(1)
    tick(w, NO_INPUT, 5)
    expect(e.hp).toBe(1) // same swing
    tick(w, NO_INPUT, 30)
  })

  it.each([
    ['dead ahead', 0, 18, true],
    ['ahead and to one side', 14, 14, true],
    ['right beside', 18, 0, true],
    ['behind', 0, -18, false],
    ['out of reach', 0, 34, false],
  ] as const)('the swing sweeps a half-circle: an enemy %s is hit=%s', (_, ox, oy, hit) => {
    const { w, e } = arena('beetle')
    w.player.hp = 1 // no beam
    e.x = w.player.x + ox
    e.y = w.player.y + oy
    e.stun = 5
    press(w, 'a')
    tick(w, NO_INPUT, 15)
    expect(e.hp < 2).toBe(hit)
  })

  it('killing an enemy counts, scores and may leave loot', () => {
    const { w, e } = arena('blob')
    const ev = press(w, 'a')
    expect(kinds(ev)).toContain('kill')
    expect(w.kills).toBe(1)
    expect(w.score).toBe(10)
    tick(w, NO_INPUT, 30)
    expect(w.enemies).not.toContain(e)
  })

  it('touching an enemy hurts, knocks you back, then protects you a moment', () => {
    const { w, e } = arena('boar')
    e.x = w.player.x
    e.y = w.player.y + 6
    e.stun = 5
    const hp = w.player.hp
    tick(w)
    expect(w.player.hp).toBe(hp - 2)
    expect(w.player.knock).toBeGreaterThan(0)
    tick(w, NO_INPUT, 10)
    e.x = w.player.x
    e.y = w.player.y
    tick(w)
    expect(w.player.hp).toBe(hp - 2)
  })

  it('at full health the sword throws a beam', () => {
    const { w } = arena('blob')
    w.enemies = []
    expect(kinds(press(w, 'a'))).toContain('beam')
    expect(w.shots.filter(s => s.kind === 'beam')).toHaveLength(1)
    w.player.hp = 1
    tick(w, NO_INPUT, 90)
    expect(kinds(press(w, 'a'))).not.toContain('beam')
  })

  it('a fall with a potion lifts you back up', () => {
    const w = createWorld()
    w.inv.potion = true
    w.player.hp = 1
    hurtPlayer(w, 2, 0, 0)
    expect(w.player.hp).toBe(w.player.maxHp)
    expect(w.inv.potion).toBe(false)
    expect(w.phase).toBe('play')
  })

  it('a fall without one ends in a game over, and continuing wakes you at home', () => {
    const w = createWorld()
    put(w, 'overworld', 20, 38)
    w.player.maxHp = 10
    w.player.hp = 1
    hurtPlayer(w, 2, 0, 0)
    expect(w.phase).toBe('dying')
    tick(w, NO_INPUT, 130)
    expect(w.phase).toBe('over')
    continueGame(w)
    expect(w.phase).toBe('play')
    expect(w.player.hp).toBe(START_HP)
    expect([w.player.x, w.player.y]).toEqual([START.x, START.y])
  })
})

describe('items and secrets', () => {
  it('a bomb cracks the rocks by the lake and reveals a doorway', () => {
    const w = createWorld()
    w.inv.hasBombs = true
    w.inv.b = 'bombs'
    w.inv.bombs = 3
    w.inv.maxBombs = 8
    put(w, 'overworld', 77, 53)
    w.enemies = []
    w.player.dir = 'up'
    expect(tileAt(w, 77, 52)).toBe('C')
    expect(kinds(press(w, 'b'))).toContain('bomb')
    expect(w.inv.bombs).toBe(2)
    const ev = tick(w, NO_INPUT, 70)
    expect(kinds(ev)).toContain('secret')
    expect(tileAt(w, 77, 52)).toBe('D')
    hold(w, { dy: -1 }, 0.5)
    expect(w.map.id).toBe('heart1')
  })

  it('the ember rod burns thorns away', () => {
    const w = createWorld()
    w.inv.rod = true
    w.inv.b = 'rod'
    put(w, 'overworld', 53, 26)
    w.enemies = []
    w.player.dir = 'up'
    const ev = [...press(w, 'b'), ...tick(w, NO_INPUT, 20)]
    expect(kinds(ev)).toContain('burn')
    expect(tileAt(w, 53, 25)).toBe('.')
  })

  it('B switches between the items carried', () => {
    const w = createWorld()
    cycleItem(w)
    expect(w.inv.b).toBe(null)
    w.inv.hasBombs = true
    w.inv.rod = true
    w.inv.b = 'bombs'
    cycleItem(w)
    expect(w.inv.b).toBe('rod')
    cycleItem(w)
    expect(w.inv.b).toBe('bombs')
  })

  it('the shop sells for coins, and says no when you are short', () => {
    const w = createWorld()
    put(w, 'shop', 7, 8)
    const potion = w.drops.find(d => d.item === 'potion')!
    expect(potion.price).toBe(40)
    w.player.x = potion.x
    w.player.y = potion.y
    expect(kinds(tick(w))).toContain('nope')
    w.inv.coins = 50
    tick(w, NO_INPUT, 5)
    expect(w.inv.coins).toBe(50) // must step off and back on
    w.player.y += 40
    tick(w)
    w.player.y -= 40
    expect(kinds(tick(w))).toContain('buy')
    expect(w.inv.coins).toBe(10)
    expect(w.inv.potion).toBe(true)
  })
})

describe('dungeons', () => {
  it('a key opens a locked door and is used up', () => {
    const w = createWorld()
    put(w, 'barrow', 23, 12, 8)
    w.enemies = []
    w.roomBusy = false
    expect(tileAt(w, 23, 11)).toBe('L')
    hold(w, { dy: -1 }, 0.3)
    expect(tileAt(w, 23, 11)).toBe('L') // no key yet
    w.inv.keys.barrow = 1
    const ev = hold(w, { dy: -1 }, 0.3)
    expect(kinds(ev)).toContain('unlock')
    expect(w.inv.keys.barrow).toBe(0)
    expect(tileAt(w, 24, 10)).toBe(':') // both halves of the door
    hold(w, { dy: -1 }, 1.5)
    expect([w.rx, w.ry]).toEqual([1, 0])
  })

  it('shutters stay shut until the room is cleared', () => {
    const w = createWorld()
    put(w, 'barrow', 39, 12, 8)
    expect(w.enemies.length).toBeGreaterThan(0)
    expect(tileAt(w, 39, 11)).toBe('S')
    hold(w, { dy: -1 }, 0.3)
    expect(w.ry).toBe(1)
    const ev = (() => { for (const e of w.enemies) e.hp = 0; w.enemies = []; return tick(w) })()
    expect(kinds(ev)).toContain('door')
    expect(tileAt(w, 39, 11)).toBe(':')
  })

  it('a cleared room drops its key, and stays cleared until you leave the dungeon', () => {
    const w = createWorld()
    put(w, 'barrow', 3, 16)
    expect(w.drops.some(d => d.item === 'key')).toBe(false)
    clearRoom(w)
    expect(w.drops.some(d => d.item === 'key')).toBe(true)
    put(w, 'barrow', 7, 16)
    expect(w.enemies).toHaveLength(0)
    put(w, 'overworld', 38, 49)
    put(w, 'barrow', 7, 16)
    expect(w.enemies.length).toBeGreaterThan(0)
  })

  it('beating a boss leaves a heart vessel and the flame, which carries you out', () => {
    const w = createWorld()
    put(w, 'barrow', 7, 8)
    const boss = w.enemies.find(e => e.boss)!
    expect(boss.kind).toBe('mossback')
    boss.spawn = 0
    boss.hp = 1
    damage(w, boss, 1, 'sword', 'up')
    tick(w, NO_INPUT, 100)
    expect(w.flags.has('boss:barrow')).toBe(true)
    const flame = w.drops.find(d => d.item === 'flame')!
    const heart = w.drops.find(d => d.item === 'heart')!
    expect(flame && heart).toBeTruthy()
    w.player.x = heart.x
    w.player.y = heart.y
    tick(w)
    expect(w.player.maxHp).toBe(START_HP + 2)
    closeDialog(w)
    w.player.x = flame.x
    w.player.y = flame.y
    expect(kinds(tick(w))).toContain('flame')
    expect(w.inv.flames).toBe(1)
    closeDialog(w)
    expect(w.map.id).toBe('overworld')
    expect([w.rx, w.ry]).toEqual([0, 3])
    // Back inside: no boss, nothing left to take.
    put(w, 'barrow', 7, 8)
    expect(w.enemies).toHaveLength(0)
    expect(w.drops).toHaveLength(0)
  })

  it('the Ashen King shrugs off steel until fire burns his armour', () => {
    const w = createWorld()
    put(w, 'keep', 23, 8)
    const king = w.enemies.find(e => e.kind === 'king')!
    king.spawn = 0
    const hp = king.hp
    expect(damage(w, king, 1, 'sword', 'up')).toBe(false)
    expect(damage(w, king, 2, 'fire', 'up')).toBe(true)
    expect(king.hp).toBe(hp)
    expect(king.bare).toBeGreaterThan(0)
    expect(damage(w, king, 1, 'sword', 'up')).toBe(true)
    expect(king.hp).toBe(hp - 1)
  })

  it('beating the king wins the game', () => {
    const w = createWorld()
    put(w, 'keep', 23, 8)
    const king = w.enemies.find(e => e.kind === 'king')!
    king.spawn = 0
    king.hp = 1
    king.bare = 3
    damage(w, king, 1, 'sword', 'up')
    tick(w, NO_INPUT, 100)
    expect(w.dialog?.pages[w.dialog.pages.length - 1]).toBe('EMBERFALL IS SAVED!')
    expect(w.dialog!.pages.every(p => p.split('\n').every(l => l.length <= DIALOG_COLS))).toBe(true)
    closeDialog(w)
    expect(w.phase).toBe('won')
    expect(w.score).toBeGreaterThan(5000)
  })
})

describe('enemies keep to the rules of the room', () => {
  const rooms = Object.values(MAPS).flatMap(m =>
    Object.entries(m.rooms).filter(([, r]) => r.enemies || r.boss).map(([k]) => [m.id, k] as const))

  it.each(rooms)('%s room %s', (map, room) => {
    const w = createWorld(3)
    const [rx, ry] = room.split(',').map(Number)
    const m = MAPS[map]
    // Stand the hero somewhere open in the room, and make them untouchable.
    let spot = [rx * RW + 7, ry * RH + 8]
    for (let y = 1; y < RH - 1; y++) {
      for (let x = 1; x < RW - 1; x++) {
        if (enemyWalkable(m.tiles[ry * RH + y][rx * RW + x])) spot = [rx * RW + x, ry * RH + y]
      }
    }
    put(w, map, spot[0], spot[1])
    w.inv.boots = true
    for (let i = 0; i < 60 * 12; i++) {
      w.player.invuln = 99
      w.player.hp = w.player.maxHp
      w.dialog = null
      step(w, NO_INPUT, DT)
      for (const e of w.enemies) {
        expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(true)
        expect(e.x).toBeGreaterThanOrEqual(rx * VIEW_W)
        expect(e.y).toBeGreaterThanOrEqual(ry * VIEW_H)
        expect(e.x + e.w).toBeLessThanOrEqual((rx + 1) * VIEW_W)
        expect(e.y + e.h).toBeLessThanOrEqual((ry + 1) * VIEW_H)
        if (!e.boss && !['bat', 'wisp'].includes(e.kind)) {
          for (const [cx, cy] of [[e.x, e.y], [e.x + 15, e.y + 15]]) {
            expect(enemyWalkable(tileAt(w, Math.floor(cx / TILE), Math.floor(cy / TILE))), `${e.kind} at ${cx},${cy}`).toBe(true)
          }
        }
      }
    }
    expect(w.map.id).toBe(map)
  })
})

describe('saving', () => {
  it('keeps gear, hearts and what has been opened', () => {
    const w = createWorld()
    w.inv.sword = true
    w.inv.coins = 123
    w.inv.keys.barrow = 1
    w.player.maxHp = 10
    w.flags.add('got:item:barrow:2,0')
    w.opened.add('overworld:77,52')
    w.respawn = { map: 'barrow', x: 1, y: 2, dir: 'up' }
    const text = JSON.stringify(toSave(w))
    const back = fromSave(parseSave(text)!)
    expect(back.inv.sword).toBe(true)
    expect(back.inv.coins).toBe(123)
    expect(back.inv.keys.barrow).toBe(1)
    expect(back.player.maxHp).toBe(10)
    expect(back.player.hp).toBe(START_HP)
    expect(back.flags.has('got:item:barrow:2,0')).toBe(true)
    expect(back.opened.has('overworld:77,52')).toBe(true)
    expect(back.map.id).toBe('barrow')
  })

  it('ignores missing or broken saves', () => {
    expect(parseSave(null)).toBe(null)
    expect(parseSave('not json')).toBe(null)
    expect(parseSave('{"v":2}')).toBe(null)
    expect(parseSave(JSON.stringify({ ...toSave(createWorld()), respawn: { map: 'nowhere', x: 0, y: 0 } }))).toBe(null)
  })

  it('has a storage key of its own', () => {
    expect(SAVE_KEY).toBe('jawg-adventure-save')
    expect(VIEW_H).toBe(176)
  })
})

describe('dialog text', () => {
  it('wraps at spaces within the box width', () => {
    expect(wrap('THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG', 10)).toEqual(['THE QUICK', 'BROWN FOX', 'JUMPS OVER', 'THE LAZY', 'DOG'])
  })

  it('cuts long pages into boxes of three lines', () => {
    const pages = paginate(['ONE TWO THREE FOUR FIVE SIX SEVEN', 'HI'], 9, 3)
    expect(pages).toEqual(['ONE TWO\nTHREE\nFOUR FIVE', 'SIX SEVEN', 'HI'])
  })

  it('every line the game says fits', () => {
    for (const m of Object.values(MAPS)) {
      for (const r of Object.values(m.rooms)) {
        for (const page of paginate([...(r.talk ?? []), ...(r.npcs ?? []).flatMap(n => n.lines), ...ALL_HINTS])) {
          for (const line of page.split('\n')) expect(line.length).toBeLessThanOrEqual(DIALOG_COLS)
        }
      }
    }
  })
})

describe('sprite art', () => {
  const all: [string, string[]][] = [
    ...Object.entries(HERO).flatMap(([d, frames]) => frames.map((f, i) => [`hero ${d} ${i}`, f] as [string, string[]])),
    ['person', PERSON],
    ...Object.entries(ENEMY_ART),
    ...Object.entries(ITEM_ART),
  ]
  it.each(all)('%s is a clean rectangle of palette digits', (_, rows) => {
    for (const row of rows) {
      expect(row).toHaveLength(rows[0].length)
      expect(row).toMatch(/^[0-9a-f.]+$/)
    }
  })
})

describe('finding the way', () => {
  it('the next goal follows the story', () => {
    const w = createWorld()
    expect(nextGoal(w)).toBe('sword')
    w.inv.sword = true
    expect(nextGoal(w)).toBe('barrow')
    w.flags.add('got:flame:barrow')
    expect(nextGoal(w)).toBe('bombs') // the flame relit, but the bombs left behind
    w.inv.hasBombs = true
    expect(nextGoal(w)).toBe('mine')
    w.flags.add('got:flame:mine')
    w.inv.rod = true
    w.flags.add('got:flame:shrine')
    expect(nextGoal(w)).toBe('boots')
    w.inv.boots = true
    expect(nextGoal(w)).toBe('keep')
    w.flags.add('boss:keep')
    expect(nextGoal(w)).toBe('done')
  })

  it('the elder tells the story once, then points the way from where you are', () => {
    const w = createWorld()
    w.inv.sword = true
    put(w, 'overworld', 52, 48) // just below the elder in the village's east half
    w.player.dir = 'up'
    press(w, 'a')
    expect(w.dialog!.pages.join(' ')).toContain('ASHEN KING')
    expect(w.dialog!.pages.join(' ')).toContain('MOSSY BARROW')
    closeDialog(w)
    w.flags.add('got:flame:barrow')
    w.inv.hasBombs = true
    press(w, 'a')
    expect(w.dialog!.pages.join(' ')).not.toContain('ASHEN KING CAME')
    expect(w.dialog!.pages.join(' ')).toContain('CINDER MINE')
  })

  it.each([
    [true, 'CRACKED ROCKS'],
    [false, 'BAG OF BOMBS'], // left behind: sent back for it
  ])('relighting a flame says where to go next (bombs in hand: %s)', (hasBombs, hint) => {
    const w = createWorld()
    w.inv.sword = true
    w.inv.hasBombs = hasBombs
    put(w, 'barrow', 7, 8)
    const boss = w.enemies.find(e => e.boss)!
    boss.spawn = 0
    boss.hp = 1
    damage(w, boss, 1, 'sword', 'up')
    tick(w, NO_INPUT, 100)
    const flame = w.drops.find(d => d.item === 'flame')!
    w.player.x = flame.x
    w.player.y = flame.y
    tick(w)
    expect(w.dialog!.pages.join(' ').replace(/\n/g, ' ')).toContain(hint)
  })
})
