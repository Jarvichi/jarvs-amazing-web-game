// ─── /adventure: game state and the helpers every rule needs ────────────────
//
// Plain data, so a save is just a few fields of it. Positions are in pixels
// across the whole map; the room on screen is (rx, ry).

import { QUESTS, type BossKind, type Dir, type EnemyKind, type GameMap, type ItemKind, type Npc, type Quest, type Warp } from './maps'
import { RH, RW, TILE, VIEW_H, VIEW_W } from './tiles'

export type BItem = 'bombs' | 'rod' | 'grapple'

export interface Player {
  x: number
  y: number
  dir: Dir
  /** Health in half hearts. */
  hp: number
  maxHp: number
  invuln: number
  knock: number
  kx: number
  ky: number
  /** Seconds left of the current sword swing. */
  swing: number
  /** Seconds before the B item can be used again. */
  cooldown: number
  /** Walk-cycle clock, for animation. */
  step: number
  /** A treasure held up overhead while its message shows. */
  hold: ItemKind | null
  /** Holding a boulder overhead (iron gloves); A throws it. */
  carry: boolean
  /** Stood still this tick: a mirror shield then throws shots back. */
  still: boolean
}

export interface Inventory {
  sword: boolean
  hasBombs: boolean
  rod: boolean
  boots: boolean
  bombs: number
  maxBombs: number
  coins: number
  potion: boolean
  /** Frostreach gear. */
  gloves: boolean
  grapple: boolean
  shield: boolean
  /** Keys per dungeon: they only open doors where they were found. */
  keys: Record<string, number>
  flames: number
  /** The item on the B button. */
  b: BItem | null
}

export interface Enemy {
  id: number
  kind: EnemyKind | BossKind
  boss: boolean
  x: number
  y: number
  w: number
  h: number
  dir: Dir
  hp: number
  maxHp: number
  dmg: number
  /** General AI clock. */
  t: number
  /** Walkers: pixels left to the next tile. */
  left: number
  state: string
  vx: number
  vy: number
  flash: number
  stun: number
  /** Fast knockback slide still to run (walkers). */
  knock: number
  /** Appearing in a puff of smoke: harmless and untouchable until 0. */
  spawn: number
  /** The sword swing that last hit it, so one swing hits once. */
  hitBy: number
  /** Dying animation; removed when it runs out. */
  dying: number
  /** Bosses: a second clock for multi-step moves. */
  sub: number
  /** The Ashen King: seconds his armour stays burnt away. */
  bare: number
}

export type ShotKind = 'beam' | 'fire' | 'seed' | 'flame' | 'orb' | 'ember' | 'rock' | 'snow' | 'feather'

export interface Shot {
  x: number
  y: number
  vx: number
  vy: number
  kind: ShotKind
  owner: 'player' | 'enemy'
  dmg: number
  life: number
  /** A sword beam passes over whatever its own swing already hit. */
  swing?: number
}

export type DropKind = ItemKind | 'coin' | 'coin5' | 'heartSmall' | 'bomb'

export interface Drop {
  x: number
  y: number
  item: DropKind
  /** Seconds before a random drop vanishes; Infinity for placed treasure. */
  life: number
  /** Flag set once taken, for treasure that never comes back. */
  id?: string
  price?: number
  /** Shop goods: false until the hero steps off them again. */
  armed?: boolean
}

export type Action = { kind: 'warp'; warp: Warp } | { kind: 'win' } | { kind: 'none' }

export interface Dialog {
  pages: string[]
  page: number
  /** Characters of the current page shown so far (typewriter). */
  shown: number
  then: Action
}

export type EventKind =
  | 'swing' | 'beam' | 'hit' | 'kill' | 'hurt' | 'coin' | 'heal' | 'key' | 'unlock' | 'bomb' | 'blast'
  | 'secret' | 'fire' | 'burn' | 'cut' | 'item' | 'flame' | 'bossHit' | 'bossDie' | 'clang' | 'talk'
  | 'buy' | 'nope' | 'stairs' | 'door' | 'die' | 'potion' | 'shoot' | 'thud' | 'win' | 'room'
  | 'lift' | 'throw' | 'reflect' | 'hook' | 'latch' | 'sail'

export interface GameEvent { kind: EventKind; x?: number; y?: number }

export interface Hook {
  x: number
  y: number
  dir: Dir
  /** Pixels flown so far. */
  dist: number
  state: 'out' | 'back' | 'pull'
  /** Where the hero ends up when pulled across (map pixels, top-left). */
  toX: number
  toY: number
  /** A treasure caught on the hook, dragged back with it. */
  drop: Drop | null
}

export interface World {
  map: GameMap
  rx: number
  ry: number
  player: Player
  inv: Inventory
  /** Things that stay done: "got:<id>", "boss:<map>". */
  flags: Set<string>
  /** Opened walls, burnt thorns, unlocked doors: "<map>:<group>". */
  opened: Set<string>
  /** Bushes cut in this room ("tx,ty"); they grow back. */
  cut: Set<string>
  /** Dungeon rooms emptied this visit ("<map>:rx,ry"). */
  cleared: Set<string>
  enemies: Enemy[]
  shots: Shot[]
  bombs: { x: number; y: number; fuse: number }[]
  blasts: { x: number; y: number; t: number }[]
  drops: Drop[]
  /** People in this room, positioned in map pixels. */
  npcs: (Npc & { px: number; py: number })[]
  dialog: Dialog | null
  scroll: { dx: number; dy: number; t: number } | null
  /** The grapple's hook: flying out, coming back, or reeling the hero in. */
  hook: Hook | null
  /** Fade-in after going through a doorway. */
  fade: number
  phase: 'play' | 'dying' | 'over' | 'won'
  phaseTime: number
  /** Seconds played. */
  time: number
  score: number
  kills: number
  /** Where you wake after falling. */
  respawn: Warp
  roomBusy: boolean
  nextId: number
  swingId: number
  nope: number
  seed: number
  events: GameEvent[]
}

// ── Randomness ──────────────────────────────────────────────────────────────
/** Deterministic random numbers (mulberry32), so tests can replay a fight. */
export function rand(w: World): number {
  w.seed = (w.seed + 0x6d2b79f5) | 0
  let t = w.seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export const pick = <T>(w: World, list: readonly T[]): T => list[Math.floor(rand(w) * list.length)]

// ── Geometry ────────────────────────────────────────────────────────────────
export const DIRS: Dir[] = ['up', 'down', 'left', 'right']
export const VEC: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
export const REVERSE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

export interface Box { x: number; y: number; w: number; h: number }

export const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** The part of the hero that bumps into walls: the feet. */
export const feet = (x: number, y: number): Box => ({ x: x + 3, y: y + 8, w: 10, h: 8 })
/** The part that gets hurt. */
export const body = (p: Player): Box => ({ x: p.x + 3, y: p.y + 3, w: 10, h: 12 })
export const enemyBox = (e: Enemy): Box => ({ x: e.x + 2, y: e.y + 2, w: e.w - 4, h: e.h - 4 })

/** The direction from a to b along its longer axis. */
export function facing(ax: number, ay: number, bx: number, by: number): Dir {
  const dx = bx - ax
  const dy = by - ay
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right'
  return dy < 0 ? 'up' : 'down'
}

export const roomLeft = (w: World) => w.rx * VIEW_W
export const roomTop = (w: World) => w.ry * VIEW_H
export const roomKey = (w: World) => `${w.rx},${w.ry}`

/** A tile position within the current room, in map pixels. */
export const roomPx = (w: World, tx: number, ty: number) =>
  ({ x: (w.rx * RW) * TILE + tx * TILE, y: (w.ry * RH) * TILE + ty * TILE })

// ── Tiles ───────────────────────────────────────────────────────────────────
const groupOf = (m: GameMap, tx: number, ty: number) => m.groups[`${tx},${ty}`] ?? `${tx},${ty}`
export const openKey = (m: GameMap, tx: number, ty: number) => `${m.id}:${groupOf(m, tx, ty)}`

/** A tile as it is now: walls may be blown open, doors unlocked, bushes cut. */
export function tileAt(w: World, tx: number, ty: number): string {
  const m = w.map
  const ch = m.tiles[ty]?.[tx]
  if (ch === undefined) return '_'
  switch (ch) {
    case 'L':
    case 'C':
    case 'X':
    case 'O':
      if (!w.opened.has(openKey(m, tx, ty))) return ch
      return ch === 'C' && m.warps[`${tx},${ty}`] ? 'D' : m.floor
    case 'B': return w.cut.has(`${tx},${ty}`) ? m.floor : ch
    case 'K': return questFlames(w) >= questOf(w).dungeons.length ? ',' : ch
    case 'S': return w.roomBusy ? ch : m.floor
  }
  return ch
}

export const tileAtPx = (w: World, x: number, y: number) => tileAt(w, Math.floor(x / TILE), Math.floor(y / TILE))

export function emit(w: World, kind: EventKind, x?: number, y?: number) {
  w.events.push({ kind, x, y })
}

// ── Quests ──────────────────────────────────────────────────────────────────
/** The quest of the land you're in. */
export const questOf = (w: World): Quest => QUESTS[w.map.quest]

/** Flames (or the like) relit so far in the current land's quest. */
export const questFlames = (w: World, q: Quest = questOf(w)) =>
  q.dungeons.filter(d => w.flags.has(`got:flame:${d}`)).length

/** The first step of the current quest not yet done, or null when it's all done. */
export function nextStep(w: World) {
  const q = questOf(w)
  return q.steps.find(s => ('flag' in s.need ? !w.flags.has(s.need.flag) : !w.inv[s.need.have])) ?? null
}
