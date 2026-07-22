import * as PIXI from 'pixi.js'

/** Per-unit pooled Pixi objects, keyed by unit.id (walls instead keyed by group
 *  in Scene.wallGroupPool). Reused across renders; only destroyed when the
 *  unit/group leaves state.field. */
export interface UnitEntry {
  container: PIXI.Container
  kind: 'mobile' | 'structure' | 'wall' | 'moat'
  sprite?: PIXI.AnimatedSprite | PIXI.Sprite
  shadow?: PIXI.Graphics
  strip?: PIXI.Graphics       // wall/moat strip graphic
  hpBar?: PIXI.Graphics
  buffText?: PIXI.Text
  nameText?: PIXI.Text
  statusOverlay?: PIXI.Graphics
  loadedSpriteName?: string   // last sprite name a texture was loaded for (avoid redundant loads)
  loadToken: number           // bumped on every texture (re)load; async loads check this before applying
  /** Smoothed on-screen position (px) — lerps toward the true game-position target each frame. */
  renderX: number
  renderY: number
  hasRenderPos: boolean
  /** True game-space target position (px), set every sync; tickUnits() lerps renderX/Y toward this. */
  targetX?: number
  targetY?: number
  /** Spawn grow-in scale (0.05→1), recomputed directly from Unit.spawnGrowTimer each sync. */
  growScale?: number
  /** Uniform scale that fits the loaded texture's native pixel size into the
   *  unit's target on-screen box (mirrors the DOM's `max-width`/`max-height`
   *  CSS on `.lane-unit-sprite` — texture art is drawn much larger than its
   *  rendered size). Recomputed whenever a new texture loads; combined
   *  (multiplied) with growScale/animation scale each tick. */
  baseScale?: number
  /** AnimatedSprite manual frame-cycling accumulator (ms). */
  frameAccumMs?: number
  // Wall-clock timestamps (ms, performance.now()) recording when a flash/dying
  // state was first observed — mirrors how the DOM's CSS keyframe animations
  // play once over their own fixed duration, decoupled from the actual engine
  // timer's real countdown length. Undefined when not currently active.
  dyingStartedAt?: number
  damageFlashStartedAt?: number
  killFlashStartedAt?: number
  wasDamageFlash?: boolean
  wasKillFlash?: boolean
  // Latest-observed boolean/derived visual state, refreshed every sync and
  // consumed every tick.
  isDying?: boolean
  isCelebrating?: boolean
  isClimbing?: boolean
  isBurning?: boolean
  isFrozen?: boolean
  isPoisoned?: boolean
  isShocked?: boolean
  isInvisible?: boolean
  isHero?: boolean
  isAttacking?: boolean
  baseTint?: number
  cardVariant?: string
}

export interface EffectEntry {
  container: PIXI.Container
  kind: 'projectile' | 'hit' | 'aoe' | 'gascloud'
  createdAtMs: number
}

export interface Scene {
  app: PIXI.Application
  // Terrain layers (bottom → top), built once via the existing terrainLayer.ts functions.
  base: PIXI.Container
  bg: PIXI.Container
  road: PIXI.Container
  border: PIXI.Container
  decor: PIXI.Container
  decorObstacles: PIXI.Container
  world: PIXI.Container
  // Battle content layers (bottom → top).
  debugLayer: PIXI.Graphics
  bloodLayer: PIXI.Container
  hazardLayer: PIXI.Container
  moatLayer: PIXI.Container
  wallLayer: PIXI.Container
  unitLayer: PIXI.Container
  effectLayer: PIXI.Container
  overlayLayer: PIXI.Container   // AoE reticle + spell-cast glow
  // Pools.
  unitPool: Map<string, UnitEntry>
  wallGroupPool: Map<string, UnitEntry>   // keyed by `${owner}:${roundedX}` — one composite strip per group
  bloodPool: Map<string, PIXI.Graphics>
  hazardPool: Map<string, PIXI.Container>
  effectPool: Map<string, EffectEntry>
  aoeReticle: PIXI.Graphics
  spellGlow: PIXI.Container
}

/** Builds the persistent layer stack + pools once, inside usePixiApp's onReady. */
export function buildScene(app: PIXI.Application): Scene {
  const base = new PIXI.Container()
  const bg = new PIXI.Container()
  const road = new PIXI.Container()
  const border = new PIXI.Container()
  const decor = new PIXI.Container()
  const decorObstacles = new PIXI.Container()
  const world = new PIXI.Container()
  const debugLayer = new PIXI.Graphics()
  const bloodLayer = new PIXI.Container()
  const hazardLayer = new PIXI.Container()
  const moatLayer = new PIXI.Container()
  const wallLayer = new PIXI.Container()
  const unitLayer = new PIXI.Container()
  const effectLayer = new PIXI.Container()
  const overlayLayer = new PIXI.Container()
  const aoeReticle = new PIXI.Graphics()
  const spellGlow = new PIXI.Container()

  aoeReticle.visible = false
  spellGlow.visible = false
  overlayLayer.addChild(spellGlow, aoeReticle)

  // z-order: terrain (base→world) → debug → blood → hazards → moats → walls →
  // units → effects → overlays (reticle/glow), matching AGENTS.md's documented
  // background→grid→buildings→units→effects→HUD convention.
  app.stage.addChild(
    base, bg, road, border, decor, decorObstacles, world,
    debugLayer, bloodLayer, hazardLayer, moatLayer, wallLayer, unitLayer,
    effectLayer, overlayLayer,
  )

  return {
    app,
    base, bg, road, border, decor, decorObstacles, world,
    debugLayer, bloodLayer, hazardLayer, moatLayer, wallLayer, unitLayer,
    effectLayer, overlayLayer,
    unitPool: new Map(),
    wallGroupPool: new Map(),
    bloodPool: new Map(),
    hazardPool: new Map(),
    effectPool: new Map(),
    aoeReticle,
    spellGlow,
  }
}
