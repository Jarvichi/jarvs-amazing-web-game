import React, { useRef, useEffect, useState, useCallback } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../hooks/usePixiApp'
import {
  buildTerrainGfx, buildBgTileGfx, buildRoadGfx, buildBorderGfx, buildDecorGfx, buildManualDecorGfx,
  buildTerrainDecorGfx, gameToPixel, pixelToGame,
} from '../../utils/terrainLayer'
import { WORLD_ENV_TILES } from '../../data/tiles/worldTileIndex'
import { ENV_TILES } from '../../data/tiles/tileIndex'
import { TERRAIN_AVOID_SHAPE } from '../../game/engine/terrain'
import { GRID_REF_WIDTH } from '../../game/engine/terrainGrid'
import { isDebugMode } from '../../game/debug'
import { LANE_WIDTH, GameState, Unit, Card } from '../../game/types'
import { buildScene } from './battlefieldCanvas/scene'
import { syncUnits, tickUnits } from './battlefieldCanvas/units'
import { syncBloodPools, syncHazards, syncAnimEvents, syncOverlays } from './battlefieldCanvas/effects'

export interface Props {
  state: GameState
  paused: boolean
  onInspect?: (u: Unit) => void
  playerAvatar: string
  opponentCommanderSlug: string
  pendingAoeCard: Card | null
  onPlayAoeCard?: (cardId: string, cx: number, cy: number) => void
  onAoeCancel: () => void
}

interface LiveProps extends Props {
  w: number
  h: number
}

// Inner component — only mounts once dimensions are known so usePixiApp gets the right size.
function CanvasInner(props: LiveProps) {
  const { w, h } = props
  // Reuses the fixed reference resolution the deterministic collision grid is
  // built against (see game/engine/terrainGrid.ts) so rendered tile density
  // stays viewport-invariant instead of just revealing more fixed-size tiles
  // on a bigger screen.
  const tileScale = w / GRID_REF_WIDTH
  const containerRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  propsRef.current = props
  const sceneRef = useRef<ReturnType<typeof buildScene> | null>(null)
  const hoverPxRef = useRef<{ x: number; y: number } | null>(null)

  const envDef = WORLD_ENV_TILES[props.state.environment ?? ''] ?? ENV_TILES[props.state.environment ?? '']

  usePixiApp(containerRef, w, h, useCallback((app: PIXI.Application) => {
    const scene = buildScene(app)
    sceneRef.current = scene

    const stage = app.stage
    stage.eventMode = 'static'
    stage.hitArea = new PIXI.Rectangle(0, 0, w, h)

    stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      const { pendingAoeCard, onPlayAoeCard, onAoeCancel } = propsRef.current
      if (!pendingAoeCard || !onPlayAoeCard) return
      const pos = e.getLocalPosition(stage)
      const { x, y } = pixelToGame(pos.x, pos.y, w, h)
      onPlayAoeCard(pendingAoeCard.id, x, y)
      onAoeCancel()
      hoverPxRef.current = null
    })
    stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (!propsRef.current.pendingAoeCard) { hoverPxRef.current = null; return }
      const pos = e.getLocalPosition(stage)
      hoverPxRef.current = { x: pos.x, y: pos.y }
    })
    stage.on('pointerleave', () => { hoverPxRef.current = null })
    stage.on('rightdown', (e: PIXI.FederatedPointerEvent) => {
      if (!propsRef.current.pendingAoeCard) return
      e.preventDefault?.()
      propsRef.current.onAoeCancel()
      hoverPxRef.current = null
    })

    app.ticker.add((ticker: PIXI.Ticker) => {
      const cur = propsRef.current
      const nowMs = performance.now()
      const s = sceneRef.current
      if (!s || app.renderer == null) return

      tickUnits(s, nowMs, ticker.deltaMS)
      syncBloodPools(s, cur.state, w, h, nowMs)
      syncHazards(s, cur.state, w, h, nowMs)
      syncAnimEvents(s, cur.state, w, h, nowMs)

      const opCmd = cur.state.field.find(u => u.isCommander && u.owner === 'opponent')
      const spellGlowPx = cur.state.pendingSpellCast
        ? (opCmd ? gameToPixel(opCmd.x, opCmd.y, w, h) : gameToPixel(LANE_WIDTH * 0.96, 0, w, h))
        : null
      syncOverlays(s, {
        hoverPx: cur.pendingAoeCard ? hoverPxRef.current : null,
        spellGlowPx: spellGlowPx ? { x: spellGlowPx.px, y: spellGlowPx.py } : null,
        nowMs,
      })

      if (isDebugMode()) {
        s.debugLayer.clear()
        for (const obs of cur.state.terrain ?? []) {
          const shape = TERRAIN_AVOID_SHAPE[obs.type]
          const ax = obs.radius * shape.fx + 4
          const ay = obs.radius * shape.fy + 4
          const { px, py } = gameToPixel(obs.x, obs.y, w, h)
          const rw = ay * 2 * (w / (80 / 0.36) / 2) // matches (ay*2)*(36/80)% of field width
          const rh = ax * 2 * (h / LANE_WIDTH)
          s.debugLayer.ellipse(px, py, rw / 2, rh / 2).fill({ color: 0xff0000, alpha: 0.25 }).stroke({ color: 0xff5050, width: 1, alpha: 0.7 })
        }
      } else {
        s.debugLayer.clear()
      }
    })

    // ── Terrain — identical to the retired BattlefieldTerrainCanvas ──
    const { state, } = propsRef.current
    buildTerrainGfx(scene.base, new PIXI.Container(), scene.world,
      { environment: state.environment, envDef, id: state.environment, rivers: [], terrainItems: [] }, w, h, tileScale)
    buildBgTileGfx(scene.bg, { environment: state.environment, envDef }, w, h, tileScale)
    buildRoadGfx(scene.road, state.roads ?? [], { environment: state.environment, envDef }, w, h, tileScale)
    buildBorderGfx(scene.border, { environment: state.environment, envDef }, w, h, tileScale)
    if (state.decor?.length) buildManualDecorGfx(scene.decor, state.decor, w, h, tileScale)
    else buildDecorGfx(scene.decor, { environment: state.environment, envDef, id: state.environment }, w, h, tileScale)
    buildTerrainDecorGfx(scene.decorObstacles, state.terrain ?? [], { environment: state.environment, envDef }, w, h, tileScale)
  }, [w, h, envDef, tileScale]))

  // Structural sync (unit/wall/moat pool diff + textures/HP bars/buffs) — once
  // per React render (game tick). Position/animation itself is ticker-driven
  // continuously (see tickUnits above), decoupled from tick rate.
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    syncUnits(scene, {
      state: props.state,
      w, h,
      paused: props.paused,
      playerAvatar: props.playerAvatar,
      opponentCommanderSlug: props.opponentCommanderSlug,
      onInspect: props.onInspect,
      nowMs: performance.now(),
    })
  })

  return <div ref={containerRef} style={{ width: w, height: h }} />
}

/**
 * WYSIWYG interactive battlefield lane canvas — supersedes BattlefieldTerrainCanvas
 * by rendering the terrain (unchanged) plus everything that used to be DOM/CSS/SVG
 * inside `.lane`: units, walls, moats, buffs, status effects, blood pools, hazards,
 * projectiles/hit-sparks/AoE rings, the AoE-targeting reticle, and the opponent
 * spell-cast telegraph glow. See battlefieldCanvas/ for the sync logic.
 *
 * Interactive DOM UI (targeting banner, spell-cast countdown/COUNTER button,
 * pause panel, hand/mana/base bars) stays outside this component in Battlefield.tsx.
 */
export function BattlefieldCanvas(props: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    let raf = 0
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width > 0 && height > 0) {
        const w = Math.ceil(width)
        const h = Math.ceil(height)
        setDims(prev => (prev && prev.w === w && prev.h === h) ? prev : { w, h })
      }
    }
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    })
    ro.observe(el)
    measure()
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
      {dims && <CanvasInner key={`${dims.w}x${dims.h}-${props.state.environment}`} {...props} w={dims.w} h={dims.h} />}
    </div>
  )
}
