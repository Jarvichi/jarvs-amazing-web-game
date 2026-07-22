import * as PIXI from 'pixi.js'
import type { GameState, Unit } from '../../../game/types'
import { MAX_UPGRADE_LEVEL } from '../../../game/engine/cards'
import { DAMAGE_FLASH_MS, SPAWN_GROW_MS } from '../../../game/engine/constants'
import { DEATH_LINGER_MS, KILL_FLASH_MS } from '../../../game/engine/combat'
import { loadSpriteTexture, loadAnimFrames, drawHpBar, makeClickable } from '../../../utils/pixiHelpers'
import { gameToPixel } from '../../../utils/terrainLayer'
import { drawMoat, drawWall, MOAT_H, WALL_H } from './moatWall'
import type { Scene, UnitEntry } from './scene'

const ANIM_FPS = 6
const ANIM_FRAME_MS = 1000 / ANIM_FPS
const BUFF_GLYPH: Record<string, string> = { atk: '⚔', spd: '▶', hp: '♥', range: '◎' }

/** Stable per-unit pixel offset derived from ID so overlapping units don't pile up
 *  — direct port of Battlefield.tsx's unitJitter(), scaled to pixels instead of %. */
export function unitJitterPx(id: string, w: number, h: number): { dx: number; dy: number } {
  let hh = 0
  for (let i = 0; i < id.length; i++) hh = (hh * 31 + id.charCodeAt(i)) & 0xffff
  const dxPct = ((hh & 0xff) / 255 - 0.5) * 10
  const dyPct = (((hh >> 8) & 0xff) / 255 - 0.5) * 10
  return { dx: (dxPct / 100) * w, dy: (dyPct / 100) * h }
}

function damageTint(hp: number, maxHp: number): number {
  if (maxHp <= 0 || hp >= maxHp) return 0xffffff
  const ratio = hp / maxHp
  if (ratio < 0.25) return 0xff6666
  if (ratio < 0.5) return 0xff9999
  return 0xffcccc
}

function ease(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2
}

function getOrCreateEntry(scene: Scene, id: string, kind: UnitEntry['kind']): { entry: UnitEntry; isNew: boolean } {
  let entry = scene.unitPool.get(id)
  if (entry) return { entry, isNew: false }
  const container = new PIXI.Container()
  entry = { container, kind, loadToken: 0, renderX: 0, renderY: 0, hasRenderPos: false }
  scene.unitPool.set(id, entry)
  scene.unitLayer.addChild(container)
  return { entry, isNew: true }
}

function ensureHpBar(entry: UnitEntry): PIXI.Graphics {
  if (!entry.hpBar) {
    entry.hpBar = new PIXI.Graphics()
    entry.container.addChild(entry.hpBar)
  }
  return entry.hpBar
}

function ensureBuffText(entry: UnitEntry): PIXI.Text {
  if (!entry.buffText) {
    entry.buffText = new PIXI.Text({ text: '', style: { fontSize: 9, fill: 0xffffff, align: 'center' } })
    entry.buffText.anchor.set(0.5, 1)
    entry.container.addChild(entry.buffText)
  }
  return entry.buffText
}

function ensureNameText(entry: UnitEntry): PIXI.Text {
  if (!entry.nameText) {
    entry.nameText = new PIXI.Text({ text: '', style: { fontSize: 8, fill: 0xffffff, fontWeight: 'bold' } })
    entry.nameText.anchor.set(0.5, 0)
    entry.container.addChild(entry.nameText)
  }
  return entry.nameText
}

async function ensureSprite(entry: UnitEntry, spriteName: string, animated: boolean): Promise<void> {
  if (entry.loadedSpriteName === spriteName + (animated ? '#a' : '#s')) return
  const token = ++entry.loadToken
  entry.loadedSpriteName = spriteName + (animated ? '#a' : '#s')
  try {
    if (animated) {
      const frames = await loadAnimFrames(spriteName, 3)
      if (entry.loadToken !== token) return
      const old = entry.sprite
      const sprite = new PIXI.AnimatedSprite(frames)
      sprite.animationSpeed = 0 // driven manually per-frame below (matches the 6fps DOM cadence)
      sprite.anchor.set(0.5, 1)
      entry.container.addChildAt(sprite, 0)
      old?.destroy()
      entry.sprite = sprite
    } else {
      const tex = await loadSpriteTexture(spriteName)
      if (entry.loadToken !== token) return
      const old = entry.sprite
      const sprite = new PIXI.Sprite(tex)
      sprite.anchor.set(0.5, 1)
      entry.container.addChildAt(sprite, 0)
      old?.destroy()
      entry.sprite = sprite
    }
  } catch { /* texture failed to load — leave prior sprite (or none) in place */ }
}

interface SyncOneOpts {
  w: number; h: number
  stackIndex: number
  paused: boolean
  onInspect?: (u: Unit) => void
  celebrating: boolean
  spriteOverride?: string
  nowMs: number
}

function applyClick(entry: UnitEntry, unit: Unit, paused: boolean, onInspect: ((u: Unit) => void) | undefined) {
  if (!(entry as { _clickWired?: boolean })._clickWired) {
    (entry as { _clickWired?: boolean })._clickWired = true
    makeClickable(entry.container, () => {
      const live = (entry as { _latestPaused?: boolean; _latestOnInspect?: (u: Unit) => void; _latestUnit?: Unit })
      if (live._latestPaused && live._latestOnInspect && live._latestUnit) live._latestOnInspect(live._latestUnit)
    })
  }
  const live = entry as unknown as { _latestPaused?: boolean; _latestOnInspect?: (u: Unit) => void; _latestUnit?: Unit }
  live._latestPaused = paused
  live._latestOnInspect = onInspect
  live._latestUnit = unit
  entry.container.cursor = paused && onInspect ? 'pointer' : 'default'
}

function syncUnitVisualState(entry: UnitEntry, unit: Unit, opts: SyncOneOpts) {
  const isStructure = unit.moveSpeed === 0
  const isDying = unit.dyingTimer != null
  const isDamageFlash = unit.damageFlashTimer != null && unit.damageFlashTimer > 0
  const isKillFlash = unit.killFlashTimer != null && unit.killFlashTimer > 0
  const isCelebrating = opts.celebrating && !isDying && !isStructure
  const isBurning = !isDying && !!unit.burnTimer && unit.burnTimer > 0
  const isFrozen = !isDying && !!unit.freezeTimer && unit.freezeTimer > 0
  const isPoisoned = !isDying && !!unit.poisonTimer && unit.poisonTimer > 0
  const isShocked = !isDying && !!unit.stunTimer && unit.stunTimer > 0 && !isBurning && !isFrozen && !isPoisoned

  // Edge-detect flash/dying starts so their wall-clock-driven decay (matching the
  // CSS keyframes' own fixed durations, decoupled from the actual engine timer's
  // real countdown length — see units.ts module doc) starts exactly once.
  if (isDying && entry.dyingStartedAt == null) entry.dyingStartedAt = opts.nowMs
  if (!isDying) entry.dyingStartedAt = undefined
  if (isDamageFlash && !entry.wasDamageFlash) entry.damageFlashStartedAt = opts.nowMs
  entry.wasDamageFlash = isDamageFlash
  if (isKillFlash && !entry.wasKillFlash) entry.killFlashStartedAt = opts.nowMs
  entry.wasKillFlash = isKillFlash

  entry.isCelebrating = isCelebrating
  entry.isClimbing = !!unit.climbing
  entry.isBurning = isBurning
  entry.isFrozen = isFrozen
  entry.isPoisoned = isPoisoned
  entry.isShocked = isShocked
  entry.isDying = isDying
  entry.isInvisible = !!unit.invisTimer && unit.invisTimer > 0
  entry.baseTint = damageTint(unit.hp, unit.maxHp)
  entry.cardVariant = unit.cardVariant
  entry.isHero = !!unit.isHero
  entry.isAttacking = unit.attack > 0 && unit.attackCooldownMs > 0 && unit.attackTimer > unit.attackCooldownMs * 0.6
}

function syncMobileOrStructure(scene: Scene, unit: Unit, opts: SyncOneOpts) {
  const isStructure = unit.moveSpeed === 0
  const { entry, isNew } = getOrCreateEntry(scene, unit.id, isStructure ? 'structure' : 'mobile')
  if (isNew) { entry.container.eventMode = 'static' }

  // ── Position (target — actual container.x/y interpolates toward this in the ticker) ──
  let targetX: number, targetY: number
  if (isStructure) {
    const { px } = gameToPixel(0, unit.y, opts.w, opts.h)
    const BUILDINGS_PER_ROW = 6
    const row = Math.floor(opts.stackIndex / BUILDINGS_PER_ROW)
    const rowDepthPx = row * 44
    targetX = px
    targetY = unit.owner === 'player' ? opts.h - (5 + rowDepthPx) : (5 + rowDepthPx)
  } else {
    const { px, py } = gameToPixel(unit.x, unit.y, opts.w, opts.h)
    const spawning = unit.spawnGrowTimer != null && unit.spawnGrowTimer > 0
    const jitter = spawning ? { dx: 0, dy: 0 } : unitJitterPx(unit.id, opts.w, opts.h)
    targetX = px + jitter.dx
    targetY = py + jitter.dy
  }
  entry.targetX = targetX
  entry.targetY = targetY
  if (!entry.hasRenderPos) {
    entry.container.x = targetX; entry.container.y = targetY
    entry.renderX = targetX; entry.renderY = targetY
    entry.hasRenderPos = true
  }

  const growScale = !isStructure && unit.spawnGrowTimer != null && unit.spawnGrowTimer > 0
    ? Math.max(0.05, 1 - unit.spawnGrowTimer / SPAWN_GROW_MS)
    : 1
  entry.growScale = growScale

  // ── Sprite ──
  const spriteName = opts.spriteOverride ?? unit.spriteName ?? unit.name
  void ensureSprite(entry, spriteName, !isStructure)

  // ── HP bar + level badge ──
  const hpBar = ensureHpBar(entry)
  hpBar.visible = !entry.isDying
  if (hpBar.visible) {
    hpBar.clear()
    const barW = 30
    hpBar.position.set(-barW / 2, 4)
    drawHpBar(hpBar, 0, 0, barW, unit.hp / unit.maxHp)
  }

  // ── Buffs ──
  const buffTxt = ensureBuffText(entry)
  const glyphs = (unit.buffs ?? []).map(t => BUFF_GLYPH[t] ?? '◎').join(' ')
  const full = glyphs + (unit.affinityActive ? (glyphs ? ' ✦' : '✦') : '')
  buffTxt.text = full
  buffTxt.position.set(0, -30)

  // ── Name (only while paused, matching current showName={paused}) ──
  const nameTxt = ensureNameText(entry)
  nameTxt.visible = opts.paused
  if (nameTxt.visible) { nameTxt.text = unit.name; nameTxt.position.set(0, 4) }

  syncUnitVisualState(entry, unit, opts)
  applyClick(entry, unit, opts.paused, opts.onInspect)
}

function syncMoat(scene: Scene, unit: Unit, w: number, h: number, paused: boolean, onInspect?: (u: Unit) => void) {
  const { entry, isNew } = getOrCreateEntry(scene, unit.id, 'moat')
  if (isNew) {
    entry.strip = new PIXI.Graphics()
    entry.container.addChild(entry.strip)
    scene.moatLayer.addChild(entry.container) // reparent from unitLayer into the moat z-slot
  }
  const { py } = gameToPixel(unit.x, 0, w, h)
  entry.container.x = 0
  entry.container.y = py - MOAT_H / 2
  drawMoat(entry.strip!, unit.owner, unit.name, w)
  entry.container.eventMode = 'none' // moats are pointer-events:none in the DOM version
  void onInspect; void paused
}

function syncWallGroup(
  scene: Scene, key: string, group: Unit[], w: number, h: number,
  paused: boolean, onInspect?: (u: Unit) => void,
) {
  let entry = scene.wallGroupPool.get(key)
  if (!entry) {
    const container = new PIXI.Container()
    const strip = new PIXI.Graphics()
    container.addChild(strip)
    entry = { container, kind: 'wall', strip, loadToken: 0, renderX: 0, renderY: 0, hasRenderPos: false }
    scene.wallGroupPool.set(key, entry)
    scene.wallLayer.addChild(container)
    container.eventMode = 'static'
  }
  const lead = group[0]
  const { py } = gameToPixel(lead.x, 0, w, h)
  entry.container.x = 0
  entry.container.y = py - WALL_H / 2
  const hp = group.reduce((s, u) => s + u.hp, 0)
  const maxHp = group.reduce((s, u) => s + u.maxHp, 0)
  drawWall(entry.strip!, hp, maxHp, lead.owner, group.map(u => u.name), w)
  applyClick(entry, lead, paused, onInspect)
}

export interface UnitsSyncOpts {
  state: GameState
  w: number
  h: number
  paused: boolean
  playerAvatar: string
  opponentCommanderSlug: string
  onInspect?: (u: Unit) => void
  nowMs: number
}

/** Diffs state.field into the unit/wall-group pools and updates every visual
 *  property. Called once per React render (game tick) from a no-deps
 *  useEffect — see BattlefieldCanvas.tsx. Position/animation interpolation
 *  itself happens continuously in tickUnits(), driven by the Pixi ticker. */
export function syncUnits(scene: Scene, opts: UnitsSyncOpts): void {
  const { state, w, h, paused, playerAvatar, opponentCommanderSlug, onInspect, nowMs } = opts
  const playerWon = (state.phase.type === 'gameOver' || state.phase.type === 'celebration') && state.phase.winner === 'player'

  const wallGroups = new Map<string, Unit[]>()
  for (const u of state.field) {
    if (!u.isWall) continue
    const key = `${u.owner}:${Math.round(u.x)}`
    if (!wallGroups.has(key)) wallGroups.set(key, [])
    wallGroups.get(key)!.push(u)
  }

  const liveUnitIds = new Set<string>()
  const liveWallGroupIds = new Set<string>()

  state.field.forEach((u, i) => {
    if (u.isWall) {
      const key = `${u.owner}:${Math.round(u.x)}`
      const group = wallGroups.get(key)!
      if (group[0].id !== u.id) return
      liveWallGroupIds.add(key)
      syncWallGroup(scene, key, group, w, h, paused, onInspect)
      return
    }
    if (u.isMoat) {
      liveUnitIds.add(u.id)
      syncMoat(scene, u, w, h, paused, onInspect)
      return
    }
    liveUnitIds.add(u.id)
    const stackIndex = u.moveSpeed === 0
      ? state.field.slice(0, i).filter(o => o.moveSpeed === 0 && !o.isWall && !o.isMoat && o.owner === u.owner).length
      : 0
    const commanderSprite = u.isCommander ? (u.owner === 'player' ? playerAvatar : opponentCommanderSlug) : undefined
    syncMobileOrStructure(scene, u, {
      w, h, stackIndex, paused, onInspect,
      celebrating: playerWon && u.owner === 'player',
      spriteOverride: commanderSprite,
      nowMs,
    })
  })

  for (const [id, entry] of scene.unitPool) {
    if (!liveUnitIds.has(id)) { entry.container.destroy({ children: true }); scene.unitPool.delete(id) }
  }
  for (const [key, entry] of scene.wallGroupPool) {
    if (!liveWallGroupIds.has(key)) { entry.container.destroy({ children: true }); scene.wallGroupPool.delete(key) }
  }
}

/** Ticker-driven per-frame update: position smoothing, sprite frame cycling,
 *  and every timer/loop-based visual (spawn-grow, dying, damage/kill flash,
 *  celebrating bounce, climbing wobble, status tints). Runs every animation
 *  frame regardless of game-tick rate — this is what makes movement/flashes
 *  read as smooth rather than snapping once per tick. */
export function tickUnits(scene: Scene, nowMs: number, deltaMS: number): void {
  for (const entry of scene.unitPool.values()) {
    if (entry.kind === 'moat') continue
    // Position lerp — approximates the DOM's `transition: top 0.1s linear`.
    const lerpFactor = Math.min(1, deltaMS / 100)
    if (entry.targetX != null && entry.targetY != null) {
      entry.renderX += (entry.targetX - entry.renderX) * lerpFactor
      entry.renderY += (entry.targetY - entry.renderY) * lerpFactor
    }

    let ox = 0, oy = 0, rotation = 0, scale = entry.growScale ?? 1, alpha = 1

    if (entry.isDying && entry.dyingStartedAt != null) {
      const t = Math.min(1, (nowMs - entry.dyingStartedAt) / DEATH_LINGER_MS)
      rotation = ease(t) * (Math.PI / 2) // 0 → 90deg
      ox = -t * 10; oy = -t * 18
      alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4
    } else if (entry.isCelebrating) {
      const t = ((nowMs / 700) % 1)
      const bounce = Math.sin(t * Math.PI * 2) * (t < 0.5 ? 1 : 0.5)
      oy = -Math.max(0, bounce) * 16
      rotation = Math.sin(t * Math.PI * 4) * 0.08
    } else if (entry.isClimbing) {
      rotation = Math.sin(nowMs / 65) * 0.1
    }

    if (entry.sprite) {
      entry.sprite.position.set(ox, oy)
      entry.sprite.rotation = rotation
      entry.sprite.scale.set(scale)
      entry.sprite.alpha = alpha

      // Sprite frame cycling for AnimatedSprite (manual — driven at ANIM_FPS to
      // match AnimatedSpriteImg's cadence rather than Pixi's own animationSpeed
      // clock, since frame count/timing needs to stay in lockstep across units).
      if (entry.sprite instanceof PIXI.AnimatedSprite) {
        entry.frameAccumMs = (entry.frameAccumMs ?? 0) + deltaMS
        if (entry.frameAccumMs >= ANIM_FRAME_MS) {
          entry.frameAccumMs = 0
          const as = entry.sprite
          as.currentFrame = (as.currentFrame + 1) % as.totalFrames
        }
      }

      // Tint: flash effects take priority over persistent status/damage tinting.
      let tint = entry.baseTint ?? 0xffffff
      if (entry.wasKillFlash && entry.killFlashStartedAt != null) {
        const t = Math.min(1, (nowMs - entry.killFlashStartedAt) / KILL_FLASH_MS)
        tint = t < 1 ? 0xffdd66 : tint
        entry.sprite.alpha = alpha
      } else if (entry.wasDamageFlash && entry.damageFlashStartedAt != null) {
        const t = Math.min(1, (nowMs - entry.damageFlashStartedAt) / DAMAGE_FLASH_MS)
        tint = t < 1 ? 0xff8888 : tint
      } else if (entry.isFrozen) {
        tint = 0xaaddff
      } else if (entry.isBurning) {
        tint = 0xffaa55
      } else if (entry.isPoisoned) {
        tint = 0x99ee88
      } else if (entry.isShocked) {
        tint = 0xddeeff
      }
      entry.sprite.tint = tint
      if (entry.isInvisible) entry.sprite.alpha = Math.min(entry.sprite.alpha, 0.28)

      if (entry.cardVariant) {
        const pulse = 0.85 + 0.15 * Math.sin(nowMs / 260)
        entry.sprite.alpha = Math.min(entry.sprite.alpha, entry.cardVariant === 'glass' ? 0.88 : 1) * pulse
      }
    }

    entry.container.x = entry.renderX
    entry.container.y = entry.renderY
    entry.container.zIndex = entry.kind === 'structure' ? 1 : 0
  }
}

void MAX_UPGRADE_LEVEL // referenced for parity with DOM level-badge cap; UI text uses it directly where needed
