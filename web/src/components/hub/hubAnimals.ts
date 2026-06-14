// Imperative PixiJS manager for hub-world animals (issue #1592).
//
// Spawns and ticks cats, dogs, birds, and fish. Procedural animals are derived
// from town geometry (see `computeProceduralCounts`); placed/quest animals come
// from `HUB_ANIMALS`. Pure maths/behaviour tables live in
// `web/src/game/hub/animals.ts`; this file owns sprites and the per-frame loop.

import * as PIXI from 'pixi.js'
import { findPath } from '../../utils/hubPathfinder'
import { loadAnimFrames, loadTextureUrl } from '../../utils/pixiHelpers'
import type { HubAnimal } from '../../data/hub/loader'
import {
  AnimalType,
  CAT_IDLE_WEIGHTS,
  DOG_IDLE_WEIGHTS,
  computeProceduralCounts,
  pickWeighted,
  randomDuration,
  resolveVariantTint,
} from '../../game/hub/animals'

const FRAME_MS = 160

// Movement speeds, px/s.
const SPEED: Record<AnimalType, number> = { cat: 55, dog: 72, bird: 230, fish: 26 }
// Sprite size as a fraction of the NPC sprite size.
const SCALE: Record<AnimalType, number> = { cat: 0.62, dog: 0.72, bird: 0.5, fish: 0.5 }

interface Pt { x: number; y: number }

interface Animal {
  type: AnimalType
  id?: string                 // placed/quest animals only
  stationary: boolean         // placed animal with roam !== true
  homeTile: [number, number]
  sprite: PIXI.Sprite
  bottomAnchored: boolean
  baseScale: number
  tx: number
  ty: number
  path: [number, number][]
  movingTo: [number, number] | null
  target: Pt | null
  staticTex: PIXI.Texture | null
  sleepTex: PIXI.Texture | null
  frames: PIXI.Texture[]
  frameIdx: number
  frameTimer: number
  state: string
  stateTimer: number
  bubble: PIXI.Container | null
  bubbleTimer: number
  indicator: PIXI.Text | null
  // dog social memory
  ownerId?: string
  seen: Set<string>
  opinion: Map<string, boolean>
  reactCooldown: number
  wagTimer: number
  // bird
  fleeRequested: boolean
  // fish bob
  bobPhase: number
  baseY: number
}

export interface AnimalSystemOptions {
  app: PIXI.Application
  /** Y-sorted layer shared with the avatar (cats & dogs live here). */
  spriteLayer: PIXI.Container
  /** Layer rendered above buildings (birds nest in a child container here). */
  overlayLayer: PIXI.Container
  /** Pond/water layer (fish nest in a child container here). */
  pondLayer: PIXI.Container
  bubbleLayer: PIXI.Container
  baseUrl: string
  T: number
  spriteSize: number
  mapW: number
  mapH: number
  /** Current walkable street tiles ("tx,ty"), recomputed each call. */
  getWalkable: () => Set<string>
  pondTiles: [number, number][]
  roofTiles: [number, number][]
  placedAnimals: HubAnimal[]
  buildingCount: number
  npcCount: number
  getAvatarPx: () => Pt
  /** Pixel positions of named (id'd) + ambient NPCs. */
  getNpcPositions: () => { id?: string; x: number; y: number }[]
  /** Routes a placed animal tap to quest handling. */
  onAnimalTap: (animalId: string) => void
  /** Quest indicator state for a placed animal id ('offer'|'ready'|null). */
  getQuestIndicator?: (animalId: string) => 'offer' | 'ready' | null
  isInteriorActive: () => boolean
}

export interface AnimalSystem {
  tick: (deltaMS: number) => void
  destroy: () => void
}

const FLAVOUR: Record<AnimalType, string> = { cat: 'Meow', dog: 'Woof!', bird: 'Chirp!', fish: 'blub' }

export function createAnimalSystem(opts: AnimalSystemOptions): AnimalSystem {
  const { app, T, spriteSize } = opts
  const animals: Animal[] = []

  const birdLayer = new PIXI.Container()
  const fishLayer = new PIXI.Container()
  opts.overlayLayer.addChild(birdLayer)
  opts.pondLayer.addChild(fishLayer)

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

  // ── movement integration ─────────────────────────────────────────────────────
  function advance(a: Animal, dt: number) {
    if (!a.target) return
    const dx = a.target.x - a.sprite.x
    const dy = a.target.y - a.sprite.y
    const dist = Math.hypot(dx, dy)
    const step = (a.type === 'bird' && a.state === 'fleeing' ? SPEED.bird : SPEED[a.type]) * (dt / 1000)
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
  }

  const isMoving = (a: Animal) => a.target !== null

  // ── textures / pose ──────────────────────────────────────────────────────────
  function showStatic(a: Animal) {
    if (a.staticTex) a.sprite.texture = a.staticTex
    a.frameIdx = 0
  }
  function showSleep(a: Animal) {
    a.sprite.texture = a.sleepTex ?? a.staticTex ?? a.sprite.texture
  }

  function animateWalk(a: Animal, dt: number) {
    if (a.frames.length === 0) return
    a.frameTimer -= dt
    if (a.frameTimer <= 0) {
      a.frameTimer = FRAME_MS
      a.frameIdx = (a.frameIdx + 1) % a.frames.length
      a.sprite.texture = a.frames[a.frameIdx]
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

  // ── behaviour: cats ──────────────────────────────────────────────────────────
  function catIdle(a: Animal, walkable: Set<string>, avatar: Pt) {
    const choice = a.stationary ? (Math.random() < 0.5 ? 'sit' : 'sleep') : pickWeighted(CAT_IDLE_WEIGHTS)
    a.state = choice
    a.stateTimer = randomDuration(choice)
    if (choice === 'sit') showStatic(a)
    else if (choice === 'sleep') showSleep(a)
    else if (choice === 'wander') {
      const dest = randOf(tilesWithin(walkable, a.tx, a.ty, 5))
      if (dest) setPath(a, [a.tx, a.ty], dest, walkable)
      showStatic(a)
    } else if (choice === 'follow-player') {
      showStatic(a)
      followToward(a, avatar, walkable)
    }
  }

  function catEvents(a: Animal, dt: number, walkable: Set<string>, avatar: Pt, perchedBirds: Animal[]) {
    if (a.state === 'flee' || a.state === 'chase-bird') return
    const dAv = Math.hypot(avatar.x - a.sprite.x, avatar.y - a.sprite.y)
    if (dAv < 3 * T && Math.random() < (dt / 1000) * 0.6) {
      // run away
      a.state = 'flee'; a.stateTimer = 2400
      const avTile: [number, number] = [Math.floor(avatar.x / T), Math.floor(avatar.y / T)]
      const opt = tilesWithin(walkable, a.tx, a.ty, 6)
      let best: [number, number] | null = null, bestD = -1
      for (const t of opt) {
        const d = Math.abs(t[0] - avTile[0]) + Math.abs(t[1] - avTile[1])
        if (d > bestD) { bestD = d; best = t }
      }
      if (best) setPath(a, [a.tx, a.ty], best, walkable)
      return
    }
    if (!a.stationary) {
      const bird = perchedBirds.find(b => Math.hypot(b.sprite.x - a.sprite.x, b.sprite.y - a.sprite.y) < 5 * T)
      if (bird && Math.random() < (dt / 1000) * 0.4) {
        a.state = 'chase-bird'; a.stateTimer = 3000
        bird.fleeRequested = true
        setPath(a, [a.tx, a.ty], [bird.tx, bird.ty], walkable)
      }
    }
  }

  function followToward(a: Animal, target: Pt, walkable: Set<string>) {
    const tt: [number, number] = [Math.floor(target.x / T), Math.floor(target.y / T)]
    // step toward a walkable tile nearest the target, staying a tile back
    const near = tilesWithin(walkable, tt[0], tt[1], 2)
    const dest = randOf(near) ?? (walkable.has(key(tt[0], tt[1])) ? tt : null)
    if (dest) setPath(a, [a.tx, a.ty], dest, walkable)
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
    if (!a.seen.has(near.id)) {
      a.seen.add(near.id)
      a.opinion.set(near.id, Math.random() < 0.5)
    }
    const likes = a.opinion.get(near.id)
    a.reactCooldown = 5000
    if (likes) { speak(a, '♥'); a.wagTimer = 1300 }
    else speak(a, 'Woof!')
  }

  // ── behaviour: birds ─────────────────────────────────────────────────────────
  function emptyPerch(avatar: Pt, npcs: { x: number; y: number }[], walkable: Set<string>): { tile: [number, number]; kind: 'roof' | 'ground' } | null {
    const ground = tilesWithin(walkable, Math.floor(opts.mapW / 2 / T), Math.floor(opts.mapH / 2 / T), 999)
    const candidates: { tile: [number, number]; kind: 'roof' | 'ground' }[] = [
      ...opts.roofTiles.map(t => ({ tile: t, kind: 'roof' as const })),
      ...ground.map(t => ({ tile: t, kind: 'ground' as const })),
    ]
    const blockers = [avatar, ...npcs, ...animals.filter(a => a.type === 'cat' || a.type === 'dog').map(a => ({ x: a.sprite.x, y: a.sprite.y }))]
    const free = candidates.filter(c => {
      const px = c.tile[0] * T + T / 2, py = c.tile[1] * T + T / 2
      return blockers.every(b => Math.hypot(b.x - px, b.y - py) > 3 * T)
    })
    return randOf(free.length ? free : candidates)
  }

  function placeBirdPerch(a: Animal, perch: { tile: [number, number]; kind: 'roof' | 'ground' }) {
    a.tx = perch.tile[0]; a.ty = perch.tile[1]
    const c = center(a, a.tx, a.ty)
    a.sprite.x = c.x; a.sprite.y = c.y; a.baseY = c.y
    a.sprite.alpha = 1
    a.target = null; a.path = []
    a.state = 'perched'; a.stateTimer = 4000 + Math.random() * 6000
    a.fleeRequested = false
    showStatic(a)
  }

  function birdTick(a: Animal, dt: number, avatar: Pt, npcs: { x: number; y: number }[], walkable: Set<string>) {
    if (a.state === 'perched') {
      animateWalk(a, dt) // perched: keep static (no frames cycle since we showStatic), cheap no-op
      const threats = [avatar, ...npcs, ...animals.filter(x => x !== a && (x.type === 'cat' || x.type === 'dog')).map(x => ({ x: x.sprite.x, y: x.sprite.y }))]
      const scared = a.fleeRequested || threats.some(t => Math.hypot(t.x - a.sprite.x, t.y - a.sprite.y) < 4 * T)
      a.stateTimer -= dt
      if (scared || a.stateTimer <= 0) startBirdFlee(a)
      return
    }
    // fleeing
    a.frameTimer -= dt
    if (a.frameTimer <= 0 && a.frames.length) {
      a.frameTimer = FRAME_MS
      a.frameIdx = (a.frameIdx + 1) % a.frames.length
      a.sprite.texture = a.frames[a.frameIdx]
    }
    advance(a, dt)
    a.sprite.alpha = Math.max(0.5, a.sprite.alpha - dt / 1200)
    const off = a.sprite.x < -T || a.sprite.x > opts.mapW + T || a.sprite.y < -T || a.sprite.y > opts.mapH + T
    if (off || !a.target) {
      const perch = emptyPerch(avatar, npcs, walkable)
      if (perch) placeBirdPerch(a, perch)
      else { a.state = 'perched'; a.stateTimer = 4000 }
    }
  }

  function startBirdFlee(a: Animal) {
    a.state = 'fleeing'
    // pick nearest screen edge to fly off
    const dl = a.sprite.x, dr = opts.mapW - a.sprite.x, dt2 = a.sprite.y, db = opts.mapH - a.sprite.y
    const m = Math.min(dl, dr, dt2, db)
    let tx = a.sprite.x, ty = a.sprite.y - 3 * T
    if (m === dl) { tx = -2 * T; ty = a.sprite.y - 2 * T }
    else if (m === dr) { tx = opts.mapW + 2 * T; ty = a.sprite.y - 2 * T }
    else if (m === dt2) { tx = a.sprite.x; ty = -2 * T }
    else { tx = a.sprite.x; ty = opts.mapH + 2 * T }
    a.path = []
    a.target = { x: tx, y: ty }
  }

  // ── behaviour: fish ──────────────────────────────────────────────────────────
  const pondSet = new Set(opts.pondTiles.map(([x, y]) => key(x, y)))
  function fishTick(a: Animal, dt: number) {
    a.bobPhase += dt / 600
    if (!isMoving(a)) {
      a.stateTimer -= dt
      if (a.stateTimer <= 0) {
        a.stateTimer = 1500 + Math.random() * 2500
        const near = tilesWithin(pondSet, a.tx, a.ty, 3)
        const dest = randOf(near)
        if (dest) { a.tx = dest[0]; a.ty = dest[1]; const c = center(a, dest[0], dest[1]); a.target = c; a.path = [] }
      }
    } else {
      advance(a, dt)
    }
    a.sprite.y = a.baseY + Math.sin(a.bobPhase) * 1.5
  }

  // ── per-frame tick ───────────────────────────────────────────────────────────
  function tick(deltaMS: number) {
    if (opts.isInteriorActive()) { birdLayer.visible = false; fishLayer.visible = false; return }
    birdLayer.visible = true; fishLayer.visible = true
    const dt = Math.min(deltaMS, 50)
    const walkable = opts.getWalkable()
    const avatar = opts.getAvatarPx()
    const npcs = opts.getNpcPositions()
    const perchedBirds = animals.filter(a => a.type === 'bird' && a.state === 'perched')

    for (const a of animals) {
      // bubble lifetime
      if (a.bubble) {
        positionBubble(a)
        a.bubbleTimer -= dt
        if (a.bubbleTimer <= 0) { opts.bubbleLayer.removeChild(a.bubble); a.bubble = null }
      }

      // quest indicator
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

      if (a.type === 'fish') { fishTick(a, dt); continue }
      if (a.type === 'bird') { birdTick(a, dt, avatar, npcs, walkable); continue }

      // cats & dogs
      advance(a, dt)
      if (isMoving(a)) animateWalk(a, dt)
      else if (a.state !== 'sleep') showStatic(a)

      a.stateTimer -= dt
      if (a.type === 'cat') {
        catEvents(a, dt, walkable, avatar, perchedBirds)
        if (a.state === 'follow-player' && !isMoving(a) && a.stateTimer > 0) followToward(a, avatar, walkable)
        if (!isMoving(a) && a.stateTimer <= 0) catIdle(a, walkable, avatar)
      } else {
        dogSocial(a, dt, npcs)
        if (a.state === 'follow-owner' && !isMoving(a) && a.stateTimer > 0) {
          const owner = npcs.find(n => n.id === a.ownerId)
          if (owner) followToward(a, owner, walkable)
        }
        if (!isMoving(a) && a.stateTimer <= 0) dogIdle(a, walkable, npcs)
      }
    }
  }

  // ── spawning ──────────────────────────────────────────────────────────────────
  async function makeAnimal(
    type: AnimalType, tx: number, ty: number, placed?: HubAnimal,
  ): Promise<void> {
    const slug = `animal-${type}`
    const staticTex = await loadTextureUrl(`${opts.baseUrl}sprites/${slug}.svg`).catch(() => null)
    if (!staticTex || app.renderer == null) return
    const sprite = new PIXI.Sprite(staticTex)
    const px = spriteSize * SCALE[type]
    sprite.width = px; sprite.height = px
    const bottomAnchored = type !== 'fish'
    sprite.anchor.set(0.5, bottomAnchored ? 1 : 0.5)
    sprite.tint = resolveVariantTint(type, placed?.variant)
    const baseScale = sprite.scale.x

    const layer = type === 'bird' ? birdLayer : type === 'fish' ? fishLayer : opts.spriteLayer
    const c = bottomAnchored ? { x: tx * T + T / 2, y: ty * T + T } : { x: tx * T + T / 2, y: ty * T + T / 2 }
    sprite.position.set(c.x, c.y)
    if (bottomAnchored) sprite.zIndex = c.y
    layer.addChild(sprite)

    const a: Animal = {
      type, id: placed?.id, stationary: !!placed && placed.roam !== true,
      homeTile: [tx, ty], sprite, bottomAnchored, baseScale,
      tx, ty, path: [], movingTo: null, target: null,
      staticTex, sleepTex: null, frames: [], frameIdx: 0, frameTimer: FRAME_MS,
      state: type === 'bird' ? 'perched' : type === 'fish' ? 'swim' : 'sit',
      stateTimer: 500 + Math.random() * 1500,
      bubble: null, bubbleTimer: 0,
      seen: new Set(), opinion: new Map(), reactCooldown: 0, wagTimer: 0,
      fleeRequested: false, bobPhase: Math.random() * Math.PI * 2, baseY: c.y,
      indicator: null,
    }
    animals.push(a)

    // Quest indicator ('!') for placed animals that can give/complete quests.
    if (placed?.id && (placed.questGive || placed.questReceive)) {
      const ind = new PIXI.Text({ text: '!', style: { fontSize: 16, fill: '#ffdd44', fontWeight: 'bold', fontFamily: 'monospace', stroke: { color: '#1a1a1a', width: 3 } } })
      ind.anchor.set(0.5, 1)
      ind.visible = false
      opts.bubbleLayer.addChild(ind)
      a.indicator = ind
    }

    // dogs pick an owner from current named NPCs
    if (type === 'dog' && !a.stationary) {
      const named = opts.getNpcPositions().filter(n => n.id)
      a.ownerId = randOf(named)?.id
    }

    // tap handling
    sprite.eventMode = 'static'
    sprite.cursor = 'pointer'
    sprite.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation()
      if (a.id) { opts.onAnimalTap(a.id); return }
      speak(a, FLAVOUR[type])
      if (type === 'bird') a.fleeRequested = true
      if (type === 'cat' && a.state !== 'flee') { a.state = 'sit'; a.stateTimer = 200 }
    })

    // load walk/fly frames + cat sleep pose
    if (type !== 'fish') {
      loadAnimFrames(slug, 3).then(f => { a.frames = f }).catch(() => {})
    }
    if (type === 'cat') {
      loadTextureUrl(`${opts.baseUrl}sprites/animal-cat-sleep.svg`).then(t => { a.sleepTex = t }).catch(() => {})
    }
  }

  // Procedural population
  const counts = computeProceduralCounts(opts.buildingCount, opts.npcCount, opts.pondTiles.length)
  const walkable0 = opts.getWalkable()
  const walkTiles = Array.from(walkable0).map(k => k.split(',').map(Number) as [number, number])
  for (let i = 0; i < counts.cat; i++) { const t = randOf(walkTiles); if (t) void makeAnimal('cat', t[0], t[1]) }
  for (let i = 0; i < counts.dog; i++) { const t = randOf(walkTiles); if (t) void makeAnimal('dog', t[0], t[1]) }
  for (let i = 0; i < counts.bird; i++) {
    const roof = randOf(opts.roofTiles)
    const t = roof ?? randOf(walkTiles)
    if (t) void makeAnimal('bird', t[0], t[1])
  }
  for (let i = 0; i < counts.fish; i++) { const t = randOf(opts.pondTiles); if (t) void makeAnimal('fish', t[0], t[1]) }

  // Placed/quest animals (always rendered)
  for (const pa of opts.placedAnimals) void makeAnimal(pa.type, pa.tx, pa.ty, pa)

  function destroy() {
    for (const a of animals) {
      if (a.bubble) opts.bubbleLayer.removeChild(a.bubble)
      if (a.indicator) opts.bubbleLayer.removeChild(a.indicator)
      a.sprite.destroy()
    }
    animals.length = 0
    birdLayer.destroy({ children: true })
    fishLayer.destroy({ children: true })
  }

  return { tick, destroy }
}
