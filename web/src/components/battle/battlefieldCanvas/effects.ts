import * as PIXI from 'pixi.js'
import type { GameState, AnimEvent, ProjectileType } from '../../../game/types'
import { BLOOD_POOL_FADE_MS } from '../../../game/engine/constants'
import { gameToPixel } from '../../../utils/terrainLayer'
import { unitJitterPx } from './units'
import type { Scene, EffectEntry } from './scene'

const PROJECTILE_COLOR: Record<ProjectileType, number> = {
  arrow: 0x8b5e3c,
  fireball: 0xff5000,
  icebolt: 0x64c8ff,
  poisonblob: 0x3cb43c,
  lightning: 0xc8dcff,
  magic: 0xffdc50,
  aoe: 0xc8dcff,
}
const HIT_COLOR: Record<ProjectileType, number> = {
  arrow: 0xc8a050,
  fireball: 0xff8c00,
  icebolt: 0x64c8ff,
  poisonblob: 0xb4ffb4,
  lightning: 0xc8dcff,
  magic: 0xffe650,
  aoe: 0xffe650,
}

function bloodPoolAppearScale(elapsedMs: number): { scale: number; alpha: number } {
  const t = Math.min(1, elapsedMs / 600)
  if (t < 0.4) return { scale: t / 0.4 * 0, alpha: t / 0.4 * 0.9 }
  if (t < 0.7) return { scale: ((t - 0.4) / 0.3) * 1.1, alpha: 0.9 - ((t - 0.4) / 0.3) * 0.1 }
  return { scale: 1.1 - ((t - 0.7) / 0.3) * 0.1, alpha: 0.8 - ((t - 0.7) / 0.3) * 0.1 }
}

export function syncBloodPools(scene: Scene, state: GameState, w: number, h: number, nowMs: number): void {
  const live = new Set<string>()
  for (const pool of state.bloodPools ?? []) {
    live.add(pool.id)
    let g = scene.bloodPool.get(pool.id)
    if (!g) {
      g = new PIXI.Graphics()
      g.circle(0, 0, 1).fill(0xffffff) // placeholder, redrawn below
      scene.bloodLayer.addChild(g)
      scene.bloodPool.set(pool.id, g)
      ;(g as unknown as { _spawnedAt: number })._spawnedAt = nowMs
      ;(g as unknown as { _fadeStartedAt?: number })._fadeStartedAt = undefined
    }
    const { px, py } = gameToPixel(pool.x, pool.y, w, h)
    g.position.set(px, py)
    const meta = g as unknown as { _spawnedAt: number; _fadeStartedAt?: number }
    if (pool.fadingAt !== undefined && meta._fadeStartedAt == null) meta._fadeStartedAt = nowMs

    g.clear()
    g.ellipse(0, 0, 17, 7).fill({ color: 0x8c0000, alpha: 0.95 })
    g.ellipse(0, 0, 12, 5).fill({ color: 0x500000, alpha: 0.65 })

    if (meta._fadeStartedAt != null) {
      const t = Math.min(1, (nowMs - meta._fadeStartedAt) / BLOOD_POOL_FADE_MS)
      g.alpha = 0.7 * (1 - t)
      g.scale.set(1)
    } else {
      const { scale, alpha } = bloodPoolAppearScale(nowMs - meta._spawnedAt)
      g.scale.set(Math.max(0, scale))
      g.alpha = alpha
    }
  }
  for (const [id, g] of scene.bloodPool) {
    if (!live.has(id)) { g.destroy(); scene.bloodPool.delete(id) }
  }
}

export function syncHazards(scene: Scene, state: GameState, w: number, h: number, nowMs: number): void {
  const live = new Set<string>()
  for (const hz of state.hazards ?? []) {
    live.add(hz.id)
    let entry = scene.hazardPool.get(hz.id)
    if (!entry) {
      entry = new PIXI.Container()
      const g = new PIXI.Graphics()
      g.circle(0, 0, 32).fill({ color: 0x28c828, alpha: 0.55 })
      g.circle(0, 0, 20).fill({ color: 0x50ff50, alpha: 0.3 })
      entry.addChild(g)
      scene.hazardLayer.addChild(entry)
      scene.hazardPool.set(hz.id, entry)
    }
    const { px, py } = gameToPixel(hz.x, hz.y, w, h)
    entry.position.set(px, py)
    const t = (nowMs / 2400) % 1
    entry.scale.set(0.88 + Math.sin(t * Math.PI * 2) * 0.09)
    entry.rotation = Math.sin(t * Math.PI * 2) * 0.07
    entry.alpha = 0.55 + Math.sin(t * Math.PI * 2) * 0.12
  }
  for (const [id, e] of scene.hazardPool) {
    if (!live.has(id)) { e.destroy({ children: true }); scene.hazardPool.delete(id) }
  }
}

function makeEffectVisual(kind: EffectEntry['kind'], ev: AnimEvent): PIXI.Container {
  const c = new PIXI.Container()
  const pType = ev.projectileType ?? 'magic'
  if (kind === 'gascloud') {
    const g = new PIXI.Graphics()
    g.circle(0, 0, 28).fill({ color: 0x28c828, alpha: 0.6 })
    c.addChild(g)
  } else if (kind === 'aoe') {
    const g = new PIXI.Graphics()
    g.circle(0, 0, 48).stroke({ color: 0xc8dcff, width: 3, alpha: 0.9 })
    c.addChild(g)
  } else if (kind === 'projectile') {
    const g = new PIXI.Graphics()
    g.rect(0, -1.5, 1, 3).fill({ color: PROJECTILE_COLOR[pType], alpha: 0.95 })
    c.addChild(g)
  } else {
    const g = new PIXI.Graphics()
    g.circle(0, 0, 12).fill({ color: HIT_COLOR[pType], alpha: 0.9 })
    c.addChild(g)
  }
  return c
}

/** Projectiles/hits/AOE rings/gas clouds — each event is short-lived (removed
 *  by the engine once `expiresAt` passes), so these are diffed by AnimEvent.id
 *  each sync and animated by elapsed wall-clock time since first seen. */
export function syncAnimEvents(scene: Scene, state: GameState, w: number, h: number, nowMs: number): void {
  const live = new Set<string>()
  for (const ev of state.animEvents ?? []) {
    live.add(ev.id)
    let entry = scene.effectPool.get(ev.id)
    if (!entry) {
      const container = makeEffectVisual(ev.kind, ev)
      scene.effectLayer.addChild(container)
      entry = { container, kind: ev.kind, createdAtMs: nowMs }
      scene.effectPool.set(ev.id, entry)
    }

    const fromJitter = ev.fromUnitId ? unitJitterPx(ev.fromUnitId, w, h) : { dx: 0, dy: 0 }
    const from = gameToPixel(ev.fromX, ev.fromY, w, h)
    const fromX = from.px + fromJitter.dx, fromY = from.py + fromJitter.dy
    const to = gameToPixel(ev.toX, ev.toY, w, h)

    const elapsed = nowMs - entry.createdAtMs
    if (ev.kind === 'projectile') {
      const dur = ev.projectileType === 'lightning' ? 150 : 500
      const t = Math.min(1, elapsed / dur)
      entry.container.position.set(fromX + (to.px - fromX) * t, fromY + (to.py - fromY) * t)
      const dx = to.px - fromX, dy = to.py - fromY
      entry.container.rotation = Math.atan2(dy, dx)
      const len = Math.hypot(dx, dy)
      entry.container.scale.set(Math.max(4, len * 0.15), 1)
      entry.container.alpha = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2
    } else if (ev.kind === 'hit') {
      const t = Math.min(1, elapsed / 300)
      entry.container.position.set(fromX, fromY)
      entry.container.scale.set(0.2 + t * 1.8)
      entry.container.alpha = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9
    } else if (ev.kind === 'aoe') {
      const t = Math.min(1, elapsed / 500)
      entry.container.position.set(to.px, to.py)
      entry.container.scale.set(0.1 + t * 0.9)
      entry.container.alpha = t < 0.7 ? 0.9 : 0.9 - ((t - 0.7) / 0.3) * 0.9
    } else {
      const t = (elapsed / 1900) % 1
      entry.container.position.set(to.px, to.py)
      entry.container.scale.set(0.88 + Math.sin(t * Math.PI * 2) * 0.18)
      entry.container.alpha = 0.6 + Math.sin(t * Math.PI * 2) * 0.15
    }
  }
  for (const [id, entry] of scene.effectPool) {
    if (!live.has(id)) { entry.container.destroy({ children: true }); scene.effectPool.delete(id) }
  }
}

/** AoE targeting reticle (follows pointer while a card is pending) and the
 *  opponent spell-cast telegraph glow (anchored at the opponent commander). */
export function syncOverlays(
  scene: Scene,
  opts: { hoverPx: { x: number; y: number } | null; spellGlowPx: { x: number; y: number } | null; nowMs: number },
): void {
  const { hoverPx, spellGlowPx, nowMs } = opts

  scene.aoeReticle.visible = hoverPx != null
  if (hoverPx) {
    scene.aoeReticle.clear()
    scene.aoeReticle.position.set(hoverPx.x, hoverPx.y)
    const pulse = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(nowMs / 95))
    scene.aoeReticle.circle(0, 0, 18).stroke({ color: 0xa064ff, width: 2, alpha: pulse })
    scene.aoeReticle.moveTo(0, -18).lineTo(0, 18).stroke({ color: 0xa064ff, width: 1, alpha: pulse * 0.7 })
    scene.aoeReticle.moveTo(-18, 0).lineTo(18, 0).stroke({ color: 0xa064ff, width: 1, alpha: pulse * 0.7 })
  }

  scene.spellGlow.visible = spellGlowPx != null
  if (spellGlowPx) {
    scene.spellGlow.removeChildren()
    const g = new PIXI.Graphics()
    const t = (0.5 + 0.5 * Math.sin(nowMs / 110))
    g.circle(0, 0, 45 * (0.9 + t * 0.25)).fill({ color: 0xff3c3c, alpha: 0.15 + t * 0.25 })
    scene.spellGlow.addChild(g)
    scene.spellGlow.position.set(spellGlowPx.x, spellGlowPx.y)
  }
}
