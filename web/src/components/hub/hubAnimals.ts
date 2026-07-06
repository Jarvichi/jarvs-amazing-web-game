// Imperative PixiJS manager for hub-world animals (issue #1592).
//
// Spawns and ticks all animal types. Per-type data (speed, scale, tints, render
// layer, navigation mode, spawn rule, predator/prey relations) lives in the
// `ANIMAL_SPECS` registry in `web/src/game/hub/animals.ts`; this file owns
// sprites, movement primitives, and the per-frame loop. New types are mostly a
// spec entry + sprites + a thin behaviour hook that reuses the shared helpers.

import * as PIXI from 'pixi.js'
import { findPath } from '../../utils/hubPathfinder'
import { loadAnimFrames, loadTextureUrl } from '../../utils/pixiHelpers'
import { emitSound, SoundId } from '../../game/sound'
import { getEquippedAccessoryId } from '../../game/hub/pet'
import { getPetAccessoryDef } from '../../data/petAccessories'
import { getPatternDef, type PatternSpecies } from '../../data/petPatterns'
import type { HubAnimal, HubAnimalType } from '../../data/hub/loader'
import {
  AnimalType,
  ANIMAL_SPECS,
  DOG_IDLE_WEIGHTS,
  computeProceduralCounts,
  pickWeighted,
  randomDuration,
  resolveVariantTint,
  variantKeyForTint,
} from '../../game/hub/animals'

const FRAME_MS = 160
const T_PX = 32
// Birds flee anything within this radius; perch clearance is larger so a newly
// placed bird has hysteresis and doesn't instantly re-flee.
const BIRD_FLEE_R = 4.5 * T_PX
const BIRD_PERCH_CLEAR = 6 * T_PX
const FIREFLY_GLOW_R = 1.2 * T_PX   // small night light pool each firefly casts

type Rect = [number, number, number, number]   // tx, ty, w, h
interface Pt { x: number; y: number }

// A sprite that owns its own texture set and swaps frames in lockstep with
// whatever pose the owning Animal is in (see texLayers()/showStatic/showSleep/
// animateWalk). The base Animal itself is one (see below); each pattern part
// is another, layered as a sibling so it can be tinted independently.
interface TexturedLayer {
  sprite: PIXI.Sprite
  staticTex: PIXI.Texture | null
  sleepTex: PIXI.Texture | null
  frames: PIXI.Texture[]
}

interface Animal extends TexturedLayer {
  type: AnimalType
  id?: string                 // placed/quest animals only
  stationary: boolean         // placed animal with roam !== true
  homeTile: [number, number]
  tint: number
  bottomAnchored: boolean
  baseScale: number
  homeBuildingId?: string         // building this animal dens in at night
  homeDoor?: [number, number]     // its door tile
  insideBuilding: string | null   // currently denned inside this building
  zoneRect?: Rect                 // chickens: pen they're confined to
  roostTile?: [number, number]    // chickens: where they roost at night
  tx: number
  ty: number
  path: [number, number][]
  movingTo: [number, number] | null
  target: Pt | null
  goal: [number, number] | null   // beacon tile for grass-capable steppers
  frameIdx: number
  frameTimer: number
  state: string
  stateTimer: number
  bubble: PIXI.Container | null
  bubbleTimer: number
  indicator: PIXI.Text | null
  // player's pet: composited equipped-accessory sprites, one per colour-tinted
  // part (sibling, not a child — the pet's texture swaps per animation frame,
  // so only sibling repositioning every tick keeps them aligned; see advance())
  accessorySprites: PIXI.Sprite[]
  // coat pattern markings (tabby stripes, calico patches, ...): each part is
  // its own animated sibling layer, tracking the same pose as the base sprite
  // (see texLayers()) but tinted independently — see advance() for position sync.
  patternLayers: TexturedLayer[]
  // dog social memory
  ownerId?: string
  seen: Set<string>
  opinion: Map<string, boolean>
  reactCooldown: number
  wagTimer: number
  // bird
  fleeRequested: boolean
  // fish/butterfly bob
  bobPhase: number
  baseY: number
}

export interface AnimalSystemOptions {
  app: PIXI.Application
  /** Y-sorted layer shared with the avatar (ground walkers live here). */
  spriteLayer: PIXI.Container
  /** Layer rendered above buildings (birds & butterflies nest here). */
  overlayLayer: PIXI.Container
  /** Pond/water layer (fish nest here). */
  pondLayer: PIXI.Container
  bubbleLayer: PIXI.Container
  baseUrl: string
  T: number
  spriteSize: number
  mapW: number
  mapH: number
  /** Current walkable street tiles ("tx,ty"), recomputed each call. */
  getWalkable: () => Set<string>
  /** True if a tile is impassable for off-path roamers (building/pond/out-of-bounds). */
  isSolidTile: (tx: number, ty: number) => boolean
  /** Current in-game hour (0–23) for the day/night den schedule. */
  getGameHour: () => number
  /** Buildings (with door tiles) cats/dogs can call home. */
  homes: { buildingId: string; tx: number; ty: number }[]
  pondTiles: [number, number][]
  roofTiles: [number, number][]
  /** Flower-decor tiles — butterflies route between these. */
  flowerTiles: [number, number][]
  /** Fenced pens chickens are confined to (with an optional night roost tile). */
  chickenZones: { rect: Rect; count?: number; roost?: [number, number] }[]
  placedAnimals: HubAnimal[]
  buildingCount: number
  npcCount: number
  getAvatarPx: () => Pt
  /** Pixel positions of named (id'd) + ambient NPCs. */
  getNpcPositions: () => { id?: string; x: number; y: number }[]
  /** Routes a placed animal tap to quest handling. */
  onAnimalTap: (animalId: string) => void
  /** Fires for every animal tap (placed or procedural) for journal/bestiary tracking. */
  onAnimalSeen?: (type: AnimalType, variant?: string) => void
  /** Lets React intercept a tap on an ambient (id-less) animal — e.g. to
   *  offer feeding it. Return true if handled (suppresses the default
   *  flavour bubble), false to fall through. */
  onAmbientAnimalTap?: (type: AnimalType) => boolean
  /** Quest indicator state for a placed animal id ('offer'|'ready'|null). */
  getQuestIndicator?: (animalId: string) => 'offer' | 'ready' | null
  isInteriorActive: () => boolean
  /** True if a world-pixel position is within the visible viewport. */
  isOnScreen: (x: number, y: number) => boolean
  /** Visible viewport rect in world pixels, or null when there is no camera. */
  getViewportRect: () => { x: number; y: number; w: number; h: number } | null
}

/** A point light the night overlay should carve into the darkness. */
export interface GlowSource { x: number; y: number; radius: number; pulse: boolean }

// Sentinel ids for the player's adopted follower pet (see pet.ts / PetModal.tsx).
// PLAYER_OWNER_ID is injected into getNpcPositions() by HubTownCanvas so the
// existing follow-owner dog behaviour below "just works" for the player, with
// no changes to the state machine itself.
export const PLAYER_OWNER_ID = '__player__'
export const PLAYER_PET_ANIMAL_ID = '__player-pet__'
/** The player's pet is never allowed to wander more than this many tiles
 *  from the player — enforced by the leash check in the dog tick dispatch. */
export const PLAYER_LEASH_TILES = 5

export interface AnimalSystem {
  tick: (deltaMS: number) => void
  /** Animals currently denned inside the given building (for interior render). */
  getAnimalsInBuilding: (buildingId: string) => { type: AnimalType; tint: number }[]
  /** Night light sources from animals (fireflies) for the night overlay. */
  getGlowSources: () => GlowSource[]
  /** Spawns (or re-spawns) the player's follower pet near (tx,ty). */
  spawnFollowerPet: (type: AnimalType, variant: string, pattern: string | undefined, tx: number, ty: number) => void
  /** Best-effort removal of an animal by id. No-op if not found. */
  removeAnimal: (id: string) => void
  /** Sends the player's pet off to fetch something; fires onReturn once it's
   *  back near the player. Returns false if there's no pet or it's already fetching. */
  sendPetFetching: (onReturn: () => void) => boolean
  /** Cosmetic affection reaction (wag + heart bubble) for the player's pet. */
  givePetAffection: () => void
  /** Equips (or, passing null, unequips) a composited accessory sprite on the
   *  player's pet — pass an accessory id from petAccessories.ts. */
  setPetAccessory: (assetId: string | null) => void
  destroy: () => void
}

const FLAVOUR: Record<AnimalType, string> = {
  cat: 'Meow', dog: 'Woof!', bird: 'Chirp!', fish: 'blub',
  butterfly: '~', rabbit: '!', chicken: 'Cluck', frog: 'Ribbit',
  firefly: '✦', bat: 'eek!',
}

// Vocal critters → their procedural SFX id (see sound.ts). Others are silent.
const ANIMAL_SFX: Partial<Record<AnimalType, SoundId>> = {
  cat: 'catMeow', dog: 'dogBark', bird: 'birdChirp', chicken: 'henCluck',
}
// Global throttle so overlapping animals never produce a cacophony.
let _lastAnimalSfxMs = 0

// Floating types are centre-anchored and hover; the rest are bottom-anchored.
const isFloating = (t: AnimalType) => t === 'fish' || t === 'butterfly' || t === 'firefly' || t === 'bat'

export function createAnimalSystem(opts: AnimalSystemOptions): AnimalSystem {
  const { app, T, spriteSize } = opts
  const animals: Animal[] = []
  // Set by sendPetFetching(); fired once the fetching pet is back near the player.
  let fetchCallback: (() => void) | null = null
  // Tracks how long the player has been stationary, so the player's pet can
  // sit rather than roam off — makes it a stable, easy tap target instead of
  // a constantly-moving one.
  let ownerLastPx: Pt | null = null
  let ownerStillMs = 0

  const overlayAnimLayer = new PIXI.Container()   // birds + butterflies (above buildings)
  const fishLayer = new PIXI.Container()
  opts.overlayLayer.addChild(overlayAnimLayer)
  // Pond water tiles are rendered into pondLayer asynchronously, so they can be
  // added AFTER fishLayer and would otherwise draw on top of the fish. Sort by
  // zIndex (tiles default to 0) and keep fish above them.
  opts.pondLayer.sortableChildren = true
  fishLayer.zIndex = 1000
  opts.pondLayer.addChild(fishLayer)

  const cols = Math.floor(opts.mapW / T)
  const rows = Math.floor(opts.mapH / T)
  const DIRS8: [number, number][] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]
  const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

  // ── geometry helpers ───────────────────────────────────────────────────────
  const key = (tx: number, ty: number) => `${tx},${ty}`
  const center = (a: Animal, tx: number, ty: number): Pt =>
    a.bottomAnchored
      ? { x: tx * T + T / 2, y: ty * T + T }
      : { x: tx * T + T / 2, y: ty * T + T / 2 }

  function tilesWithin(set: Iterable<string>, tx: number, ty: number, r: number): [number, number][] {
    const out: [number, number][] = []
    for (const k of set) {
      const [x, y] = k.split(',').map(Number)
      if ((x !== tx || y !== ty) && Math.abs(x - tx) <= r && Math.abs(y - ty) <= r) out.push([x, y])
    }
    return out
  }

  const randOf = <X,>(arr: X[]): X | null => (arr.length ? arr[(Math.random() * arr.length) | 0] : null)

  const pondSet = new Set(opts.pondTiles.map(([x, y]) => key(x, y)))

  function setPath(a: Animal, from: [number, number], to: [number, number], walkable: Set<string>) {
    const path = findPath(from, to, walkable)
    a.path = path.length > 1 ? path.slice(1) : []
    beginNextStep(a)
  }

  function beginNextStep(a: Animal) {
    const next = a.path.shift()
    if (!next) { a.target = null; a.movingTo = null; return }
    a.movingTo = next
    a.target = center(a, next[0], next[1])
  }

  // Move the sprite directly to a tile (one straight segment; used by flyers/froggers).
  function hopTo(a: Animal, tile: [number, number]) {
    a.movingTo = tile
    a.target = center(a, tile[0], tile[1])
    a.path = []
  }

  // ── movement integration ─────────────────────────────────────────────────────
  function advance(a: Animal, dt: number) {
    if (!a.target) return
    const dx = a.target.x - a.sprite.x
    const dy = a.target.y - a.sprite.y
    const dist = Math.hypot(dx, dy)
    const step = ANIMAL_SPECS[a.type].speed * (dt / 1000)
    if (dx < -0.5) a.sprite.scale.x = -a.baseScale
    else if (dx > 0.5) a.sprite.scale.x = a.baseScale
    if (step >= dist || dist < 0.001) {
      a.sprite.x = a.target.x
      a.baseY = a.target.y
      a.sprite.y = a.target.y
      if (a.movingTo) { a.tx = a.movingTo[0]; a.ty = a.movingTo[1] }
      beginNextStep(a)
    } else {
      a.sprite.x += (dx / dist) * step
      a.baseY = a.sprite.y + (dy / dist) * step
      a.sprite.y = a.baseY
    }
    if (a.bottomAnchored) a.sprite.zIndex = a.sprite.y
    a.patternLayers.forEach((l, i) => syncSibling(a, l.sprite, 0.1 + i * 0.001))
    a.accessorySprites.forEach((s, i) => syncSibling(a, s, 0.5 + i * 0.001))
  }

  function syncSibling(a: Animal, s: PIXI.Sprite, zOffset: number) {
    s.position.copyFrom(a.sprite.position)
    s.scale.x = a.sprite.scale.x
    s.zIndex = a.sprite.zIndex + zOffset
  }

  const isMoving = (a: Animal) => a.target !== null

  // ── textures / pose ──────────────────────────────────────────────────────────
  // All layers that should show the same pose in lockstep: the base sprite
  // plus every coat-pattern part. Patterns never get their own frame clock —
  // a.frameIdx/a.frameTimer are the single source of truth for all of them.
  function texLayers(a: Animal): TexturedLayer[] {
    return a.patternLayers.length ? [a, ...a.patternLayers] : [a]
  }

  function showStatic(a: Animal) {
    for (const l of texLayers(a)) if (l.staticTex) l.sprite.texture = l.staticTex
    a.frameIdx = 0
  }
  function showSleep(a: Animal) {
    for (const l of texLayers(a)) l.sprite.texture = l.sleepTex ?? l.staticTex ?? l.sprite.texture
  }

  function animateWalk(a: Animal, dt: number) {
    if (a.frames.length === 0) return
    a.frameTimer -= dt
    if (a.frameTimer <= 0) {
      a.frameTimer = FRAME_MS
      a.frameIdx = (a.frameIdx + 1) % a.frames.length
      for (const l of texLayers(a)) if (l.frames.length) l.sprite.texture = l.frames[a.frameIdx % l.frames.length]
    }
  }

  // ── bubbles ────────────────────────────────────────────────────────────────
  function speak(a: Animal, text: string, ms = 1600) {
    if (a.bubble) { opts.bubbleLayer.removeChild(a.bubble); a.bubble = null }
    const c = new PIXI.Container()
    const lbl = new PIXI.Text({ text, style: { fontSize: 10, fill: '#111', fontFamily: 'monospace' } })
    lbl.anchor.set(0.5, 0.5)
    const pad = 5, bw = lbl.width + pad * 2, bh = lbl.height + pad * 2
    lbl.position.set(0, -bh / 2)
    const bg = new PIXI.Graphics()
    bg.roundRect(-bw / 2, -bh, bw, bh, 5).fill({ color: 0xffffff }).stroke({ color: 0x000000, width: 1.2 })
    c.addChild(bg, lbl)
    c.zIndex = 1e6
    opts.bubbleLayer.addChild(c)
    a.bubble = c
    a.bubbleTimer = ms
    positionBubble(a)
  }
  function positionBubble(a: Animal) {
    if (a.bubble) a.bubble.position.set(a.sprite.x, a.sprite.y - spriteSize * a.baseScale - 4)
  }
  // Play an animal's vocalisation (throttled globally); optionally show its bubble.
  function vocalize(a: Animal, withBubble = false): void {
    const id = ANIMAL_SFX[a.type]
    if (!id) return
    // Only animals actually rendered on screen should be audible.
    if (!opts.isOnScreen(a.sprite.x, a.sprite.y)) return
    const t = Date.now()
    if (t - _lastAnimalSfxMs < 250) return
    _lastAnimalSfxMs = t
    emitSound(id)
    if (withBubble) speak(a, FLAVOUR[a.type], 1200)
  }
  // Occasional ambient vocalisation from a critter near the avatar.
  let _ambientVocalTimer = 4000

  // ── shared relations & navigation ─────────────────────────────────────────────
  function nearestAnimal(a: Animal, pred: (o: Animal) => boolean, radiusPx: number): Animal | null {
    let best: Animal | null = null
    let bd = radiusPx
    for (const o of animals) {
      if (o === a || o.insideBuilding || !pred(o)) continue
      const d = Math.hypot(o.sprite.x - a.sprite.x, o.sprite.y - a.sprite.y)
      if (d < bd) { bd = d; best = o }
    }
    return best
  }
  // Nearest animal this type flees from / chases, per the registry.
  function nearestThreat(a: Animal, r: number): Animal | null {
    const f = ANIMAL_SPECS[a.type].fleesFrom
    return f ? nearestAnimal(a, o => f.includes(o.type), r) : null
  }
  function nearestPrey(a: Animal, r: number): Animal | null {
    const c = ANIMAL_SPECS[a.type].chases
    return c ? nearestAnimal(a, o => c.includes(o.type) && !o.stationary, r) : null
  }

  type StepMode = 'grass' | 'grass-only' | 'zone'
  // Greedy one-tile step toward a.goal, avoiding solids. `grass-only` also avoids
  // streets; `zone` clamps candidates to a rect.
  function stepToward(a: Animal, walkable: Set<string>, mode: StepMode = 'grass', zone?: Rect) {
    if (!a.goal) return
    const [gx, gy] = a.goal
    if (Math.abs(a.tx - gx) <= 1 && Math.abs(a.ty - gy) <= 1) { a.goal = null; return }
    let best: [number, number] | null = null, bd = Infinity
    for (const [dx, dy] of DIRS8) {
      const nx = a.tx + dx, ny = a.ty + dy
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
      if (opts.isSolidTile(nx, ny)) continue
      if (mode === 'grass-only' && walkable.has(key(nx, ny))) continue
      if (mode === 'zone' && zone && (nx < zone[0] || ny < zone[1] || nx >= zone[0] + zone[2] || ny >= zone[1] + zone[3])) continue
      const d = Math.hypot(nx - gx, ny - gy)
      if (d < bd) { bd = d; best = [nx, ny] }
    }
    if (best) { a.movingTo = best; a.target = center(a, best[0], best[1]); a.path = [] }
    else a.goal = null
  }

  function fleeBeacon(a: Animal, fromPx: Pt, durationMs: number) {
    a.state = 'flee'; a.stateTimer = durationMs
    const dx = a.tx - fromPx.x / T, dy = a.ty - fromPx.y / T
    const len = Math.hypot(dx, dy) || 1
    a.goal = [clampN(Math.round(a.tx + (dx / len) * 6), 0, cols - 1),
              clampN(Math.round(a.ty + (dy / len) * 6), 0, rows - 1)]
  }

  function followToward(a: Animal, target: Pt, walkable: Set<string>) {
    const tt: [number, number] = [Math.floor(target.x / T), Math.floor(target.y / T)]
    const near = tilesWithin(walkable, tt[0], tt[1], 2)
    const dest = randOf(near) ?? (walkable.has(key(tt[0], tt[1])) ? tt : null)
    if (dest) setPath(a, [a.tx, a.ty], dest, walkable)
  }

  // A quiet grass tile (off the path) within a short radius, else null.
  function grassTileNear(a: Animal, walkable: Set<string>, r = 3): [number, number] | null {
    const out: [number, number][] = []
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      const tx = a.tx + dx, ty = a.ty + dy
      if ((dx || dy) && tx >= 0 && ty >= 0 && tx < cols && ty < rows
          && !opts.isSolidTile(tx, ty) && !walkable.has(key(tx, ty))) out.push([tx, ty])
    }
    return randOf(out)
  }

  // ── behaviour: cats ──────────────────────────────────────────────────────────
  function catRest(a: Animal, walkable: Set<string>) {
    const sleeping = Math.random() < 0.85
    a.state = sleeping ? 'sleep' : 'sit'
    a.stateTimer = sleeping ? 12000 + Math.random() * 30000 : 4000 + Math.random() * 6000
    a.goal = Math.random() < 0.4 ? grassTileNear(a, walkable) : null
  }

  function catWake(a: Animal, dt: number, npcs: { x: number; y: number }[]): boolean {
    const prey = nearestPrey(a, 5 * T)
    if (prey && Math.random() < (dt / 1000) * 0.5) {
      a.state = 'chase'; a.stateTimer = 3500
      if (prey.type === 'bird') prey.fleeRequested = true
      a.goal = [prey.tx, prey.ty]; return true
    }
    const cat = nearestAnimal(a, o => o.type === 'cat' && !o.stationary, 4 * T)
    if (cat && Math.random() < (dt / 1000) * 0.12) {
      a.state = 'play'; a.stateTimer = 4000; a.goal = [cat.tx, cat.ty]; return true
    }
    let npc: { x: number; y: number } | null = null, nd = 3 * T
    for (const n of npcs) { const d = Math.hypot(n.x - a.sprite.x, n.y - a.sprite.y); if (d < nd) { nd = d; npc = n } }
    if (npc && Math.random() < (dt / 1000) * 0.1) {
      a.state = 'approach-npc'; a.stateTimer = 5000; a.goal = [Math.floor(npc.x / T), Math.floor(npc.y / T)]; return true
    }
    return false
  }

  function catTick(a: Animal, dt: number, walkable: Set<string>, npcs: { x: number; y: number }[]) {
    if (a.stationary) {
      if (!isMoving(a) && a.stateTimer <= 0) {
        a.state = Math.random() < 0.6 ? 'sleep' : 'sit'
        a.stateTimer = 5000 + Math.random() * 8000
      }
      return
    }
    if (a.state !== 'flee') {
      const dog = nearestThreat(a, 3.5 * T)   // dogs
      if (dog) fleeBeacon(a, { x: dog.sprite.x, y: dog.sprite.y }, 2600)
    }
    if (a.state === 'sleep' || a.state === 'sit') catWake(a, dt, npcs)
    if (a.goal && !isMoving(a)) stepToward(a, walkable, 'grass')
    if (!a.goal && !isMoving(a) && (a.state === 'play' || a.state === 'approach-npc')) {
      speak(a, a.state === 'play' ? '♪' : '?', 1400)
      a.state = 'sit'; a.stateTimer = 1500
    }
    if (!isMoving(a) && !a.goal && a.stateTimer <= 0) catRest(a, walkable)
  }

  // ── behaviour: dogs ──────────────────────────────────────────────────────────
  function dogIdle(a: Animal, walkable: Set<string>, npcs: { id?: string; x: number; y: number }[]) {
    if (a.stationary) { a.state = 'sit'; a.stateTimer = randomDuration('sit'); showStatic(a); return }
    const choice = pickWeighted(DOG_IDLE_WEIGHTS)
    a.state = choice
    a.stateTimer = randomDuration(choice)
    showStatic(a)
    if (choice === 'follow-owner') {
      const owner = npcs.find(n => n.id === a.ownerId)
      if (owner) followToward(a, owner, walkable)
      else { const d = randOf(tilesWithin(walkable, a.tx, a.ty, 5)); if (d) setPath(a, [a.tx, a.ty], d, walkable) }
    } else if (a.ownerId === PLAYER_OWNER_ID) {
      // The player's own pet roams within a leash of the player, not of
      // wherever it happens to already be — prevents drift compounding
      // across repeated roam cycles (see the PLAYER_LEASH_TILES cap below).
      const owner = npcs.find(n => n.id === PLAYER_OWNER_ID)
      const otx = owner ? Math.floor(owner.x / T) : a.tx
      const oty = owner ? Math.floor(owner.y / T) : a.ty
      const d = randOf(tilesWithin(walkable, otx, oty, PLAYER_LEASH_TILES))
      if (d) setPath(a, [a.tx, a.ty], d, walkable)
    } else {
      const d = randOf(tilesWithin(walkable, a.tx, a.ty, 5))
      if (d) setPath(a, [a.tx, a.ty], d, walkable)
    }
  }

  function dogSocial(a: Animal, dt: number, npcs: { id?: string; x: number; y: number }[]) {
    if (a.reactCooldown > 0) a.reactCooldown -= dt
    if (a.wagTimer > 0) {
      a.wagTimer -= dt
      a.sprite.angle = Math.sin(performance.now() / 70) * 6
      if (a.wagTimer <= 0) a.sprite.angle = 0
    }
    if (a.reactCooldown > 0) return
    let near: { id?: string; x: number; y: number } | null = null
    let nearD = Infinity
    for (const n of npcs) {
      if (!n.id || n.id === a.ownerId) continue
      const d = Math.hypot(n.x - a.sprite.x, n.y - a.sprite.y)
      if (d < 2.5 * T && d < nearD) { nearD = d; near = n }
    }
    if (!near || !near.id) return
    if (!a.seen.has(near.id)) { a.seen.add(near.id); a.opinion.set(near.id, Math.random() < 0.5) }
    a.reactCooldown = 5000
    if (a.opinion.get(near.id)) { speak(a, '♥'); a.wagTimer = 1300 }
    else { speak(a, FLAVOUR[a.type]); vocalize(a) }
  }

  // Dogs spot a wandering cat or rabbit and give chase — they leave the path
  // (grass step) to pursue, returning to street roaming afterwards.
  function dogChasePrey(a: Animal, dt: number): boolean {
    if (a.stationary || a.state === 'chase') return false
    const prey = nearestPrey(a, 5 * T)
    if (prey && Math.random() < (dt / 1000) * 0.5) {
      a.state = 'chase'; a.stateTimer = 3000; a.goal = [prey.tx, prey.ty]; return true
    }
    return false
  }

  // Forced (never idle-picked) two-phase state for the player's "give a treat"
  // interaction: walk out to a.goal (grass-stepping, same as chase-prey), pause
  // briefly on arrival, then follow the player home exactly like follow-owner.
  function tickFetching(a: Animal, walkable: Set<string>, npcs: { id?: string; x: number; y: number }[]) {
    if (a.state === 'fetching-out') {
      if (a.goal) { if (!isMoving(a)) stepToward(a, walkable, 'grass'); return }
      if (!isMoving(a) && a.stateTimer <= 0) a.state = 'fetching-return'
      return
    }
    // fetching-return
    const owner = npcs.find(n => n.id === PLAYER_OWNER_ID)
    if (!owner) return
    const dist = Math.hypot(a.sprite.x - owner.x, a.sprite.y - owner.y)
    if (dist <= 3 * T) {
      const cb = fetchCallback
      fetchCallback = null
      a.state = 'sit'; a.stateTimer = randomDuration('sit')
      showStatic(a)
      cb?.()
      return
    }
    if (!isMoving(a)) followToward(a, owner, walkable)
  }

  // ── behaviour: birds ─────────────────────────────────────────────────────────
  function emptyPerch(avatar: Pt, npcs: { x: number; y: number }[], walkable: Set<string>): { tile: [number, number] } | null {
    const ground = Array.from(walkable).map(k => k.split(',').map(Number) as [number, number])
    const blockers = [avatar, ...npcs, ...animals.filter(a => a.type === 'cat' || a.type === 'dog').map(a => ({ x: a.sprite.x, y: a.sprite.y }))]
    const isFree = (t: [number, number]) => {
      const px = t[0] * T + T / 2, py = t[1] * T + T / 2
      return blockers.every(b => Math.hypot(b.x - px, b.y - py) > BIRD_PERCH_CLEAR)
    }
    const freeGround = ground.filter(isFree).map(t => ({ tile: t }))
    const freeRoof = opts.roofTiles.filter(isFree).map(t => ({ tile: t }))
    if (freeGround.length && (Math.random() < 0.6 || freeRoof.length === 0)) return randOf(freeGround)
    if (freeRoof.length) return randOf(freeRoof)
    if (freeGround.length) return randOf(freeGround)
    return randOf([...opts.roofTiles.map(t => ({ tile: t })), ...ground.map(t => ({ tile: t }))])
  }

  function placeBirdPerch(a: Animal, tile: [number, number]) {
    a.tx = tile[0]; a.ty = tile[1]
    const c = center(a, a.tx, a.ty)
    a.sprite.x = c.x; a.sprite.y = c.y; a.baseY = c.y
    a.sprite.alpha = 1
    a.target = null; a.path = []
    a.state = 'perched'; a.stateTimer = 4000 + Math.random() * 6000
    a.fleeRequested = false
    showStatic(a)
  }

  // Entry point just outside the nearest visible screen edge, in line with the perch.
  function birdEntryPoint(p: Pt): Pt {
    const r = opts.getViewportRect()
    const left = r ? r.x : 0, top = r ? r.y : 0
    const right = r ? r.x + r.w : opts.mapW, bottom = r ? r.y + r.h : opts.mapH
    const dl = p.x - left, dr = right - p.x, dtp = p.y - top, db = bottom - p.y
    const m = Math.min(dl, dr, dtp, db)
    if (m === dl) return { x: left - 2 * T, y: p.y }
    if (m === dr) return { x: right + 2 * T, y: p.y }
    if (m === dtp) return { x: p.x, y: top - 2 * T }
    return { x: p.x, y: bottom + 2 * T }
  }

  // Send a bird gliding in from the screen edge to its perch (a.tx/ty). If the
  // perch is off-screen there is nothing to watch, so just place it instantly.
  function birdFlyIn(a: Animal) {
    a.sprite.visible = true
    const c = center(a, a.tx, a.ty)
    if (!opts.isOnScreen(c.x, c.y)) { placeBirdPerch(a, [a.tx, a.ty]); return }
    const e = birdEntryPoint(c)
    a.sprite.x = e.x; a.sprite.y = e.y; a.baseY = e.y
    a.sprite.alpha = 1
    a.movingTo = [a.tx, a.ty]; a.target = c; a.path = []
    a.fleeRequested = false
    a.state = 'flying-in'
    showStatic(a)
  }

  function birdTick(a: Animal, dt: number, avatar: Pt, npcs: { x: number; y: number }[], walkable: Set<string>) {
    if (a.state === 'perched') {
      if (a.stationary) { a.fleeRequested = false; return }
      const threats = [avatar, ...npcs, ...animals.filter(x => x !== a && (x.type === 'cat' || x.type === 'dog')).map(x => ({ x: x.sprite.x, y: x.sprite.y }))]
      const scared = a.fleeRequested || threats.some(t => Math.hypot(t.x - a.sprite.x, t.y - a.sprite.y) < BIRD_FLEE_R)
      a.stateTimer -= dt
      if (scared || a.stateTimer <= 0) startBirdFlee(a)
      return
    }
    if (a.state === 'flying-in') {
      animateWalk(a, dt)
      advance(a, dt)
      if (!a.target) placeBirdPerch(a, [a.tx, a.ty])  // reached the perch → settle
      return
    }
    animateWalk(a, dt)
    advance(a, dt)
    a.sprite.alpha = Math.max(0.5, a.sprite.alpha - dt / 1200)
    const off = a.sprite.x < -T || a.sprite.x > opts.mapW + T || a.sprite.y < -T || a.sprite.y > opts.mapH + T
    if (off || !a.target) {
      const perch = emptyPerch(avatar, npcs, walkable)
      if (perch) placeBirdPerch(a, perch.tile)
      else { a.state = 'perched'; a.stateTimer = 4000 }
    }
  }

  function startBirdFlee(a: Animal) {
    a.state = 'fleeing'
    const dl = a.sprite.x, dr = opts.mapW - a.sprite.x, dtop = a.sprite.y, db = opts.mapH - a.sprite.y
    const m = Math.min(dl, dr, dtop, db)
    let tx = a.sprite.x, ty = a.sprite.y - 3 * T
    if (m === dl) { tx = -2 * T; ty = a.sprite.y - 2 * T }
    else if (m === dr) { tx = opts.mapW + 2 * T; ty = a.sprite.y - 2 * T }
    else if (m === dtop) { tx = a.sprite.x; ty = -2 * T }
    else { tx = a.sprite.x; ty = opts.mapH + 2 * T }
    a.path = []
    a.target = { x: tx, y: ty }
  }

  // ── behaviour: butterflies ─────────────────────────────────────────────────────
  function flowerNear(a: Animal): [number, number] | null {
    const close = opts.flowerTiles.filter(([fx, fy]) => Math.abs(fx - a.tx) <= 8 && Math.abs(fy - a.ty) <= 8 && (fx !== a.tx || fy !== a.ty))
    return randOf(close.length ? close : opts.flowerTiles)
  }
  function butterflyTick(a: Animal, dt: number) {
    a.bobPhase += dt / 200
    const cat = nearestThreat(a, 3.5 * T)   // cats
    if (cat) {
      const dx = a.sprite.x - cat.sprite.x, dy = a.sprite.y - cat.sprite.y
      const len = Math.hypot(dx, dy) || 1
      a.movingTo = null
      a.target = { x: clampN(a.sprite.x + (dx / len) * 4 * T, 0, opts.mapW), y: clampN(a.sprite.y + (dy / len) * 4 * T - T, 0, opts.mapH) }
      a.path = []
      a.state = 'flee'; a.stateTimer = 1000
    } else if (!isMoving(a)) {
      a.stateTimer -= dt
      if (a.stateTimer <= 0 || a.state === 'flee') {
        const f = flowerNear(a)
        if (f) { hopTo(a, f); a.state = 'flit'; a.stateTimer = 1200 + Math.random() * 2500 }
        else a.stateTimer = 1500
      }
    }
    animateWalk(a, dt)
    advance(a, dt)
    a.sprite.y = a.baseY + Math.sin(a.bobPhase) * 3
  }

  // ── behaviour: rabbits ─────────────────────────────────────────────────────────
  function rabbitTick(a: Animal, dt: number, avatar: Pt, walkable: Set<string>) {
    if (a.stationary) return
    const dog = nearestThreat(a, 4 * T)     // dogs
    const playerNear = Math.hypot(avatar.x - a.sprite.x, avatar.y - a.sprite.y) < 2.5 * T
    if (a.state !== 'flee' && (dog || playerNear)) {
      fleeBeacon(a, dog ? { x: dog.sprite.x, y: dog.sprite.y } : avatar, 2200)
    }
    if (a.goal && !isMoving(a)) stepToward(a, walkable, 'grass-only')
    if (!isMoving(a) && !a.goal && a.stateTimer <= 0) {
      if (Math.random() < 0.45) { const g = grassTileNear(a, walkable, 3); if (g) a.goal = g; a.state = 'hop'; a.stateTimer = 1500 + Math.random() * 2500 }
      else { a.state = 'freeze'; a.stateTimer = 2000 + Math.random() * 3000 }
    }
  }

  // ── behaviour: chickens ─────────────────────────────────────────────────────────
  function chickenTick(a: Animal, dt: number, avatar: Pt, walkable: Set<string>, night: boolean) {
    const z = a.zoneRect
    if (!z) return
    // At night, chickens roost: head to the roost spot and settle there.
    if (night) {
      const roost = a.roostTile ?? [z[0] + (z[2] >> 1), z[1] + (z[3] >> 1)]
      if (a.state !== 'roost') { a.goal = roost.slice() as [number, number]; a.state = 'roost' }
      if (a.goal && !isMoving(a)) stepToward(a, walkable, 'zone', z)
      return   // huddled — no pecking or scattering
    }
    if (a.state === 'roost') { a.state = 'peck'; a.stateTimer = 500; a.goal = null }
    const dog = nearestThreat(a, 3 * T)     // dogs
    const playerNear = Math.hypot(avatar.x - a.sprite.x, avatar.y - a.sprite.y) < 3 * T
    if (a.state !== 'scatter' && (dog || playerNear)) {
      // bolt to the far corner of the pen
      const cx = a.tx < z[0] + z[2] / 2 ? z[0] + z[2] - 1 : z[0]
      const cy = a.ty < z[1] + z[3] / 2 ? z[1] + z[3] - 1 : z[1]
      a.goal = [cx, cy]; a.state = 'scatter'; a.stateTimer = 2000
    }
    if (a.goal && !isMoving(a)) stepToward(a, walkable, 'zone', z)
    if (!isMoving(a) && !a.goal && a.stateTimer <= 0) {
      if (Math.random() < 0.6) { a.state = 'peck'; a.stateTimer = 1800 + Math.random() * 3000 }
      else {
        const tx = z[0] + (Math.random() * z[2] | 0), ty = z[1] + (Math.random() * z[3] | 0)
        if (!opts.isSolidTile(tx, ty)) { a.goal = [tx, ty]; a.state = 'walk'; a.stateTimer = 1500 }
        else { a.state = 'peck'; a.stateTimer = 1500 }
      }
    }
  }

  // ── behaviour: frogs ─────────────────────────────────────────────────────────
  const pondEdgeTiles: [number, number][] = []
  {
    const seen = new Set<string>()
    for (const [px, py] of opts.pondTiles) for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = px + dx, ny = py + dy, k = key(nx, ny)
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
      if (!seen.has(k) && !opts.isSolidTile(nx, ny) && !pondSet.has(k)) { seen.add(k); pondEdgeTiles.push([nx, ny]) }
    }
  }
  const edgeNear = (a: Animal): [number, number] | null =>
    randOf(pondEdgeTiles.filter(([x, y]) => Math.abs(x - a.tx) <= 3 && Math.abs(y - a.ty) <= 3 && (x !== a.tx || y !== a.ty)))
  const nearestPond = (a: Animal): [number, number] | null => {
    let best: [number, number] | null = null, bd = Infinity
    for (const [x, y] of opts.pondTiles) { const d = Math.hypot(x - a.tx, y - a.ty); if (d < bd) { bd = d; best = [x, y] } }
    return best
  }
  function frogTick(a: Animal, dt: number, avatar: Pt) {
    a.stateTimer -= dt
    advance(a, dt)
    if (a.state === 'plop') {
      if (!isMoving(a) && a.stateTimer <= 0) {
        const e = edgeNear(a) ?? a.homeTile
        hopTo(a, e); a.sprite.alpha = 1; a.state = 'idle'; a.stateTimer = 2000 + Math.random() * 3000
      }
      return
    }
    const threat = Math.hypot(avatar.x - a.sprite.x, avatar.y - a.sprite.y) < 2.5 * T
      || nearestAnimal(a, o => o.type === 'cat' || o.type === 'dog', 2.5 * T) != null
    if (threat && !isMoving(a)) {
      const p = nearestPond(a)
      if (p) { hopTo(a, p); a.sprite.alpha = 0.5; a.state = 'plop'; a.stateTimer = 1500 }
      return
    }
    if (!isMoving(a) && a.stateTimer <= 0) {
      const e = edgeNear(a)
      if (e) hopTo(a, e)
      a.state = 'idle'; a.stateTimer = 2000 + Math.random() * 3000
    }
  }

  // ── behaviour: fireflies (glow flies) — drift slowly with a pulsing glow ──────
  function fireflyTick(a: Animal, dt: number) {
    a.bobPhase += dt / 320
    if (!isMoving(a)) {
      a.stateTimer -= dt
      if (a.stateTimer <= 0) {
        const tx = clampN(a.tx + (Math.random() * 9 | 0) - 4, 0, cols - 1)
        const ty = clampN(a.ty + (Math.random() * 9 | 0) - 4, 0, rows - 1)
        if (!opts.isSolidTile(tx, ty)) hopTo(a, [tx, ty])
        a.stateTimer = 1200 + Math.random() * 2500
      }
    }
    advance(a, dt)
    a.sprite.y = a.baseY + Math.sin(a.bobPhase) * 2
    a.sprite.alpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(performance.now() / 450 + a.bobPhase))
  }

  // ── behaviour: bats — erratic swooping across the night sky ──────────────────
  function batTick(a: Animal, dt: number) {
    a.bobPhase += dt / 120
    if (!isMoving(a)) {
      a.stateTimer -= dt
      if (a.stateTimer <= 0) {
        a.movingTo = null
        a.target = { x: Math.random() * opts.mapW, y: Math.random() * (opts.mapH * 0.7) }
        a.path = []
        a.stateTimer = 700 + Math.random() * 1400
      }
    }
    animateWalk(a, dt)
    advance(a, dt)
    a.sprite.y = a.baseY + Math.sin(a.bobPhase) * 4   // jittery flight
  }

  // ── day/night den schedule (cats & dogs with a home) ────────────────────────
  const isNightHour = (hour: number) => hour >= 20 || hour < 6

  function enterHome(a: Animal) {
    a.insideBuilding = a.homeBuildingId ?? null
    a.sprite.visible = false
    a.state = 'inside'
    a.goal = null; a.target = null; a.movingTo = null; a.path = []
    if (a.bubble) { opts.bubbleLayer.removeChild(a.bubble); a.bubble = null }
  }

  function exitHome(a: Animal) {
    const door = a.homeDoor
    if (door) {
      a.tx = door[0]; a.ty = door[1]
      const c = center(a, a.tx, a.ty)
      a.sprite.x = c.x; a.sprite.y = c.y; a.baseY = c.y
      a.sprite.zIndex = c.y
    }
    a.insideBuilding = null
    a.sprite.visible = true
    a.state = a.type === 'cat' ? 'sleep' : 'sit'
    a.stateTimer = 1000 + Math.random() * 2000
  }

  const atTile = (a: Animal, tile: [number, number]) =>
    Math.abs(a.tx - tile[0]) <= 1 && Math.abs(a.ty - tile[1]) <= 1

  function runDenSchedule(a: Animal, walkable: Set<string>, hour: number): boolean {
    if (!a.homeBuildingId || !a.homeDoor) return false
    const wantInside = isNightHour(hour)
    if (a.insideBuilding) {
      if (!wantInside) exitHome(a)
      return !!a.insideBuilding
    }
    if (wantInside) {
      if (a.state !== 'go-home') {
        a.state = 'go-home'
        if (a.type === 'cat') a.goal = a.homeDoor
        else setPath(a, [a.tx, a.ty], a.homeDoor, walkable)
      }
      if (a.type === 'cat' && a.goal && !isMoving(a)) stepToward(a, walkable, 'grass')
      if (!isMoving(a) && atTile(a, a.homeDoor)) enterHome(a)
      return true
    }
    if (a.state === 'go-home') { a.state = a.type === 'cat' ? 'sleep' : 'sit'; a.goal = null }
    return false
  }

  // ── per-frame tick ───────────────────────────────────────────────────────────
  function tick(deltaMS: number) {
    if (opts.isInteriorActive()) { overlayAnimLayer.visible = false; fishLayer.visible = false; return }
    overlayAnimLayer.visible = true; fishLayer.visible = true
    const dt = Math.min(deltaMS, 50)
    const walkable = opts.getWalkable()
    const avatar = opts.getAvatarPx()
    const npcs = opts.getNpcPositions()
    const hour = opts.getGameHour()

    const ownerMoveDist = ownerLastPx ? Math.hypot(avatar.x - ownerLastPx.x, avatar.y - ownerLastPx.y) : Infinity
    ownerStillMs = ownerMoveDist > 1 ? 0 : ownerStillMs + dt
    ownerLastPx = { x: avatar.x, y: avatar.y }
    const ownerIsStill = ownerStillMs > 400   // debounced so brief pauses/collisions don't flicker the pet in and out of sitting
    const night = isNightHour(hour)

    // Ambient critter sounds: every few seconds a nearby, visible, vocal animal
    // chirps/barks/etc. so the town feels alive without the player tapping.
    _ambientVocalTimer -= dt
    if (_ambientVocalTimer <= 0) {
      _ambientVocalTimer = 5000 + Math.random() * 5000
      const nearby = animals.filter(a =>
        ANIMAL_SFX[a.type] && a.sprite.visible && !a.insideBuilding &&
        Math.hypot(a.sprite.x - avatar.x, a.sprite.y - avatar.y) < 320)
      const pick = randOf(nearby)
      if (pick) vocalize(pick, true)
    }

    for (const a of animals) {
      // Day/night fliers: birds & butterflies vanish at night; fireflies & bats
      // only appear after dark.
      const active = ANIMAL_SPECS[a.type].active
      if (active && (active === 'night') !== night) {
        if (a.sprite.visible) a.sprite.visible = false
        if (a.bubble) { opts.bubbleLayer.removeChild(a.bubble); a.bubble = null }
        continue
      }
      if (active && !a.sprite.visible) {
        if (a.type === 'bird') birdFlyIn(a)   // birds glide back in at dawn
        else a.sprite.visible = true
      }

      if (a.bubble) {
        positionBubble(a)
        a.bubbleTimer -= dt
        if (a.bubbleTimer <= 0) { opts.bubbleLayer.removeChild(a.bubble); a.bubble = null }
      }

      if (a.indicator && a.id) {
        const st = opts.getQuestIndicator?.(a.id) ?? null
        a.indicator.visible = st !== null
        if (st !== null) {
          a.indicator.text = st === 'ready' ? '?' : '!'
          a.indicator.tint = st === 'ready' ? 0x66ddff : 0xffdd44
          const bob = Math.sin(performance.now() / 300) * 2
          a.indicator.position.set(a.sprite.x, a.sprite.y - spriteSize * a.baseScale - 6 + bob)
        }
      }

      // Day/night den schedule (cats & dogs with a home building).
      if (ANIMAL_SPECS[a.type].dens) {
        const busy = runDenSchedule(a, walkable, hour)
        if (a.insideBuilding) continue
        if (busy) {
          advance(a, dt)
          if (isMoving(a)) animateWalk(a, dt); else showStatic(a)
          continue
        }
      }

      // Custom-movement types own their advance() call.
      if (a.type === 'fish') { fishTick(a, dt); continue }
      if (a.type === 'bird') { birdTick(a, dt, avatar, npcs, walkable); continue }
      if (a.type === 'butterfly') { butterflyTick(a, dt); continue }
      if (a.type === 'frog') { frogTick(a, dt, avatar); continue }
      if (a.type === 'firefly') { fireflyTick(a, dt); continue }
      if (a.type === 'bat') { batTick(a, dt); continue }

      // Ground walkers: cat, dog, rabbit, chicken — shared advance + animation.
      advance(a, dt)
      if (isMoving(a)) animateWalk(a, dt)
      else if (a.state === 'sleep') showSleep(a)
      else showStatic(a)

      a.stateTimer -= dt
      if (a.type === 'cat' && a.ownerId !== PLAYER_OWNER_ID) {
        catTick(a, dt, walkable, npcs)
      } else if (a.type === 'rabbit') {
        rabbitTick(a, dt, avatar, walkable)
      } else if (a.type === 'chicken') {
        chickenTick(a, dt, avatar, walkable, night)
      } else if (a.state === 'fetching-out' || a.state === 'fetching-return') {
        tickFetching(a, walkable, npcs)
      } else {
        dogSocial(a, dt, npcs)
        // The player's own pet sits still (rather than roaming) whenever the
        // player is stationary, so it's a stable, easy tap target instead of
        // a constantly-moving one. Chase/fetch are left uninterrupted since
        // they're brief and often happen while the player stands still anyway.
        if (a.ownerId === PLAYER_OWNER_ID && ownerIsStill && a.state !== 'chase' && a.state !== 'fetching-out' && a.state !== 'fetching-return') {
          if (a.state !== 'sit' || isMoving(a)) {
            a.path = []; a.movingTo = null; a.target = null
            a.state = 'sit'; a.stateTimer = randomDuration('sit')
          }
          continue
        }
        dogChasePrey(a, dt)
        if (a.state === 'follow-owner' && !isMoving(a) && a.stateTimer > 0) {
          const owner = npcs.find(n => n.id === a.ownerId)
          if (owner) followToward(a, owner, walkable)
        }
        if (a.state === 'chase' && !isMoving(a) && a.stateTimer > 0) {
          const prey = nearestPrey(a, 6 * T)
          if (prey) { a.goal = [prey.tx, prey.ty]; stepToward(a, walkable, 'grass') }
          else a.stateTimer = 0
        }
        // Safety-net leash: whatever pulled the player's pet away (roam,
        // chase, etc.), never let it end up more than PLAYER_LEASH_TILES
        // from the player. Runs last so it has the final say each tick.
        if (a.ownerId === PLAYER_OWNER_ID) {
          const owner = npcs.find(n => n.id === PLAYER_OWNER_ID)
          if (owner) {
            const dtx = Math.abs(a.tx - Math.floor(owner.x / T))
            const dty = Math.abs(a.ty - Math.floor(owner.y / T))
            if (Math.max(dtx, dty) > PLAYER_LEASH_TILES) {
              a.state = 'follow-owner'; a.stateTimer = randomDuration('follow-owner')
              followToward(a, owner, walkable)
            }
          }
        }
        if (!isMoving(a) && a.stateTimer <= 0) dogIdle(a, walkable, npcs)
      }
    }
  }

  // ── fish ───────────────────────────────────────────────────────────────────
  function fishTick(a: Animal, dt: number) {
    a.bobPhase += dt / 600
    if (!isMoving(a)) {
      a.stateTimer -= dt
      if (a.stateTimer <= 0) {
        a.stateTimer = 1500 + Math.random() * 2500
        const near = tilesWithin(pondSet, a.tx, a.ty, 3)
        const dest = randOf(near)
        if (dest) { a.tx = dest[0]; a.ty = dest[1]; a.target = center(a, dest[0], dest[1]); a.path = [] }
      }
    } else {
      advance(a, dt)
    }
    a.sprite.y = a.baseY + Math.sin(a.bobPhase) * 1.5
  }

  // ── spawning ──────────────────────────────────────────────────────────────────
  async function makeAnimal(type: AnimalType, tx: number, ty: number, placed?: HubAnimal, zoneRect?: Rect, roostTile?: [number, number]): Promise<void> {
    const spec = ANIMAL_SPECS[type]
    const slug = `animal-${type}`
    const staticTex = await loadTextureUrl(`${opts.baseUrl}sprites/${slug}.svg`).catch(() => null)
    if (!staticTex || app.renderer == null) return
    const sprite = new PIXI.Sprite(staticTex)
    const px = spriteSize * spec.scale
    sprite.width = px; sprite.height = px
    const bottomAnchored = !isFloating(type)
    sprite.anchor.set(0.5, bottomAnchored ? 1 : 0.5)
    const tint = resolveVariantTint(type, placed?.variant)
    sprite.tint = tint
    const baseScale = sprite.scale.x

    const layer = spec.layer === 'overlay' ? overlayAnimLayer : spec.layer === 'pond' ? fishLayer : opts.spriteLayer
    const c = bottomAnchored ? { x: tx * T + T / 2, y: ty * T + T } : { x: tx * T + T / 2, y: ty * T + T / 2 }
    sprite.position.set(c.x, c.y)
    if (bottomAnchored) sprite.zIndex = c.y
    layer.addChild(sprite)

    const initState =
      type === 'bird' ? 'perched' : type === 'fish' ? 'swim' : type === 'butterfly' ? 'flit'
      : type === 'frog' ? 'idle' : type === 'cat' ? 'sleep' : type === 'rabbit' ? 'freeze'
      : type === 'chicken' ? 'peck' : type === 'firefly' ? 'drift' : type === 'bat' ? 'swoop' : 'sit'

    const a: Animal = {
      type, id: placed?.id, stationary: !!placed && placed.roam !== true,
      homeTile: [tx, ty], sprite, tint, bottomAnchored, baseScale,
      insideBuilding: null, zoneRect, roostTile,
      tx, ty, path: [], movingTo: null, target: null, goal: null,
      staticTex, sleepTex: null, frames: [], frameIdx: 0, frameTimer: FRAME_MS,
      state: initState, stateTimer: 500 + Math.random() * 1500,
      bubble: null, bubbleTimer: 0,
      seen: new Set(), opinion: new Map(), reactCooldown: 0, wagTimer: 0,
      fleeRequested: false, bobPhase: Math.random() * Math.PI * 2, baseY: c.y,
      indicator: null, accessorySprites: [], patternLayers: [],
    }
    // Half of the procedural cats & dogs den in a home building at night.
    if (!placed && spec.dens && opts.homes.length > 0 && Math.random() < 0.5) {
      const home = opts.homes[(Math.random() * opts.homes.length) | 0]
      a.homeBuildingId = home.buildingId
      a.homeDoor = [home.tx, home.ty]
    }
    animals.push(a)

    if (placed?.id && (placed.questGive || placed.questReceive)) {
      const ind = new PIXI.Text({ text: '!', style: { fontSize: 16, fill: '#ffdd44', fontWeight: 'bold', fontFamily: 'monospace', stroke: { color: '#1a1a1a', width: 3 } } })
      ind.anchor.set(0.5, 1)
      ind.visible = false
      opts.bubbleLayer.addChild(ind)
      a.indicator = ind
    }

    if (type === 'dog' && !a.stationary) {
      // Ambient flavour: a roaming dog latches onto a random nearby NPC. This
      // runs synchronously before makeAnimal's returned promise resolves, so
      // spawnFollowerPet's post-await override (which assigns PLAYER_OWNER_ID
      // to the player's own pet) always runs after this and wins.
      const named = opts.getNpcPositions().filter(n => n.id)
      a.ownerId = randOf(named)?.id
    }

    sprite.eventMode = 'static'
    sprite.cursor = 'pointer'
    sprite.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation()
      opts.onAnimalSeen?.(type, variantKeyForTint(type, tint))
      if (a.id) { opts.onAnimalTap(a.id); return }
      if (opts.onAmbientAnimalTap?.(type)) return
      speak(a, FLAVOUR[type])
      vocalize(a)
      if (type === 'bird' || type === 'butterfly') a.fleeRequested = true
      if (type === 'cat' && a.state !== 'flee') { a.state = 'sit'; a.stateTimer = 200 }
    })

    // Walk/fly frames for the animated types; cat also gets a sleep pose.
    if (type !== 'fish' && type !== 'frog' && type !== 'firefly') {
      loadAnimFrames(slug, 3).then(f => { a.frames = f }).catch(() => {})
    }
    if (type === 'cat') {
      loadTextureUrl(`${opts.baseUrl}sprites/animal-cat-sleep.svg`).then(t => { a.sleepTex = t }).catch(() => {})
    }

    // Coat pattern markings (tabby stripes, calico patches, ...): one animated
    // sibling layer per part, tinted independently, swapping texture in
    // lockstep with the base sprite (see texLayers()). Cats/dogs only.
    if (type === 'cat' || type === 'dog') {
      const patternDef = getPatternDef(type as PatternSpecies, placed?.pattern)
      if (patternDef) {
        for (const part of patternDef.parts) {
          const partSlug = `pattern-${type}-${patternDef.id}-${part.key}`
          const partTint = part.useBaseColor ? tint : (part.tint ?? 0xffffff)
          const layerSprite = new PIXI.Sprite()
          layerSprite.width = sprite.width
          layerSprite.height = sprite.height
          layerSprite.anchor.copyFrom(sprite.anchor)
          layerSprite.position.copyFrom(sprite.position)
          layerSprite.zIndex = sprite.zIndex + 0.1
          layerSprite.tint = partTint
          layerSprite.eventMode = 'none'  // cosmetic overlay must not block taps on the pet beneath it
          sprite.parent?.addChild(layerSprite)
          const patternLayer: TexturedLayer = { sprite: layerSprite, staticTex: null, sleepTex: null, frames: [] }
          a.patternLayers.push(patternLayer)

          loadTextureUrl(`${opts.baseUrl}sprites/${partSlug}.svg`).then(t => { patternLayer.staticTex = t }).catch(() => {})
          loadAnimFrames(partSlug, 3).then(f => { patternLayer.frames = f }).catch(() => {})
          if (type === 'cat') {
            loadTextureUrl(`${opts.baseUrl}sprites/${partSlug}-sleep.svg`).then(t => { patternLayer.sleepTex = t }).catch(() => {})
          }
        }
      }
    }

    // Birds enter by gliding in from the screen edge and landing, rather than
    // popping into existence at the perch.
    if (type === 'bird') birdFlyIn(a)
  }

  // ── procedural population ──────────────────────────────────────────────────────
  const walkable0 = opts.getWalkable()
  const walkTiles = Array.from(walkable0).map(k => k.split(',').map(Number) as [number, number])
  const grassTiles: [number, number][] = []
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!opts.isSolidTile(x, y) && !walkable0.has(key(x, y))) grassTiles.push([x, y])
  }
  const zoneTileCount = opts.chickenZones.reduce((s, z) => s + z.rect[2] * z.rect[3], 0)

  const counts = computeProceduralCounts({
    buildings: opts.buildingCount,
    npcs:      opts.npcCount,
    flowers:   opts.flowerTiles.length,
    pondTiles: opts.pondTiles.length,
    grass:     grassTiles.length,
    zones:     zoneTileCount,
  })

  for (let i = 0; i < counts.cat; i++) { const t = randOf(walkTiles); if (t) void makeAnimal('cat', t[0], t[1]) }
  for (let i = 0; i < counts.dog; i++) { const t = randOf(walkTiles); if (t) void makeAnimal('dog', t[0], t[1]) }
  for (let i = 0; i < counts.bird; i++) {
    const perch = emptyPerch(opts.getAvatarPx(), opts.getNpcPositions(), walkable0)
    const t = perch?.tile ?? randOf(opts.roofTiles) ?? randOf(walkTiles)
    if (t) void makeAnimal('bird', t[0], t[1])
  }
  for (let i = 0; i < counts.fish; i++) { const t = randOf(opts.pondTiles); if (t) void makeAnimal('fish', t[0], t[1]) }
  for (let i = 0; i < counts.butterfly; i++) { const t = randOf(opts.flowerTiles); if (t) void makeAnimal('butterfly', t[0], t[1]) }
  for (let i = 0; i < counts.rabbit; i++) { const t = randOf(grassTiles); if (t) void makeAnimal('rabbit', t[0], t[1]) }
  for (let i = 0; i < counts.frog; i++) { const t = randOf(pondEdgeTiles); if (t) void makeAnimal('frog', t[0], t[1]) }
  // Nocturnal fliers — spawned now but hidden until night by the active gate.
  const skyTiles = grassTiles.length ? grassTiles : walkTiles
  for (let i = 0; i < counts.firefly; i++) { const t = randOf(skyTiles); if (t) void makeAnimal('firefly', t[0], t[1]) }
  for (let i = 0; i < counts.bat; i++) { void makeAnimal('bat', (Math.random() * cols) | 0, (Math.random() * rows * 0.6) | 0) }
  // Chickens distributed across their pens (with the pen's roost tile).
  if (counts.chicken > 0 && opts.chickenZones.length > 0) {
    for (let i = 0; i < counts.chicken; i++) {
      const zone = opts.chickenZones[i % opts.chickenZones.length]
      const z = zone.rect
      const roost = zone.roost ?? [z[0] + (z[2] >> 1), z[1] + (z[3] >> 1)] as [number, number]
      let placed = false
      for (let tries = 0; tries < 8 && !placed; tries++) {
        const tx = z[0] + (Math.random() * z[2] | 0), ty = z[1] + (Math.random() * z[3] | 0)
        if (!opts.isSolidTile(tx, ty)) { void makeAnimal('chicken', tx, ty, undefined, z, roost); placed = true }
      }
    }
  }

  // Placed/quest animals (always rendered)
  for (const pa of opts.placedAnimals) void makeAnimal(pa.type, pa.tx, pa.ty, pa)

  function getAnimalsInBuilding(buildingId: string): { type: AnimalType; tint: number }[] {
    return animals.filter(a => a.insideBuilding === buildingId).map(a => ({ type: a.type, tint: a.tint }))
  }

  // Fireflies glow at night — hand their positions to the night overlay so it can
  // carve a small pool of light around each visible one.
  function getGlowSources(): GlowSource[] {
    const out: GlowSource[] = []
    for (const a of animals) {
      if (a.type === 'firefly' && a.sprite.visible) {
        out.push({ x: a.sprite.x, y: a.sprite.y, radius: FIREFLY_GLOW_R, pulse: true })
      }
    }
    return out
  }

  function destroy() {
    for (const a of animals) {
      if (a.bubble) opts.bubbleLayer.removeChild(a.bubble)
      if (a.indicator) opts.bubbleLayer.removeChild(a.indicator)
      for (const s of a.accessorySprites) s.destroy()
      for (const l of a.patternLayers) l.sprite.destroy()
      a.sprite.destroy()
    }
    animals.length = 0
    overlayAnimLayer.destroy({ children: true })
    fishLayer.destroy({ children: true })
  }

  function removeAnimal(id: string): void {
    const idx = animals.findIndex(a => a.id === id)
    if (idx === -1) return
    const [a] = animals.splice(idx, 1)
    if (a.bubble) opts.bubbleLayer.removeChild(a.bubble)
    if (a.indicator) opts.bubbleLayer.removeChild(a.indicator)
    for (const s of a.accessorySprites) s.destroy()
    for (const l of a.patternLayers) l.sprite.destroy()
    a.sprite.destroy()
  }

  function clearAccessorySprite(a: Animal): void {
    for (const s of a.accessorySprites) s.destroy()
    a.accessorySprites = []
  }

  // Composites the equipped accessory's parts as PIXI siblings of the pet's
  // sprite — same width/height/anchor/position every tick (see advance()) —
  // so SVGs authored in the pet sprite's 32x32 coordinate space line up
  // automatically. Multi-part accessories (e.g. a hat's crown + band) stack
  // as separate tinted sprites so each part can be recoloured independently.
  function applyAccessorySprite(a: Animal, accessoryId: string): void {
    const def = getPetAccessoryDef(accessoryId)
    if (!def) return
    Promise.all(def.parts.map(part =>
      loadTextureUrl(`${opts.baseUrl}sprites/pet-accessory-${def.asset}-${part.key}.svg`).then(tex => ({ tex, tint: part.tint })),
    )).then(loaded => {
      // The pet may have been removed, or the accessory changed again, while this loaded.
      if (!animals.includes(a)) return
      clearAccessorySprite(a)
      a.accessorySprites = loaded.map(({ tex, tint }) => {
        const sprite = new PIXI.Sprite(tex)
        sprite.width = a.sprite.width
        sprite.height = a.sprite.height
        sprite.anchor.set(a.sprite.anchor.x, a.sprite.anchor.y)
        sprite.position.copyFrom(a.sprite.position)
        sprite.scale.x = a.sprite.scale.x
        sprite.zIndex = a.sprite.zIndex + 0.5
        sprite.tint = tint
        sprite.eventMode = 'none'  // cosmetic overlay must not block taps on the pet beneath it
        a.sprite.parent?.addChild(sprite)
        return sprite
      })
    }).catch(() => {})
  }

  function setPetAccessory(assetId: string | null): void {
    const a = animals.find(x => x.id === PLAYER_PET_ANIMAL_ID)
    if (!a) return
    clearAccessorySprite(a)
    if (assetId) applyAccessorySprite(a, assetId)
  }

  function spawnFollowerPet(type: AnimalType, variant: string, pattern: string | undefined, tx: number, ty: number): void {
    removeAnimal(PLAYER_PET_ANIMAL_ID)
    void makeAnimal(type, tx, ty, { id: PLAYER_PET_ANIMAL_ID, type: type as HubAnimalType, variant, pattern, tx, ty, roam: true })
      .then(() => {
        const a = animals.find(x => x.id === PLAYER_PET_ANIMAL_ID)
        if (!a) return
        a.ownerId = PLAYER_OWNER_ID
        const equipped = getEquippedAccessoryId()
        if (equipped) applyAccessorySprite(a, equipped)
      })
  }

  function sendPetFetching(onReturn: () => void): boolean {
    const a = animals.find(x => x.id === PLAYER_PET_ANIMAL_ID)
    if (!a || a.state === 'fetching-out' || a.state === 'fetching-return') return false
    const walkable = opts.getWalkable()
    // Fetch destination is relative to the PLAYER (not the dog's own
    // position) and capped at the same leash radius, so a treat given while
    // the dog is already near the edge of the leash can't push it further out.
    const owner = opts.getNpcPositions().find(n => n.id === PLAYER_OWNER_ID)
    const otx = owner ? Math.floor(owner.x / T) : a.tx
    const oty = owner ? Math.floor(owner.y / T) : a.ty
    const far = tilesWithin(walkable, otx, oty, PLAYER_LEASH_TILES)
      .filter(([x, y]) => Math.max(Math.abs(x - a.tx), Math.abs(y - a.ty)) >= 3)
    const dest = randOf(far) ?? randOf(tilesWithin(walkable, otx, oty, PLAYER_LEASH_TILES))
    if (!dest) return false
    fetchCallback = onReturn
    a.state = 'fetching-out'
    a.stateTimer = 800
    a.goal = dest
    return true
  }

  function givePetAffection(): void {
    const a = animals.find(x => x.id === PLAYER_PET_ANIMAL_ID)
    if (!a) return
    speak(a, '♥')
    a.wagTimer = 1300
  }

  return { tick, getAnimalsInBuilding, getGlowSources, spawnFollowerPet, removeAnimal, sendPetFetching, givePetAffection, setPetAccessory, destroy }
}
