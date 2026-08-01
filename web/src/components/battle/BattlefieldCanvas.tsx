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
import {
  GRID_REF_HEIGHT, GRID_REF_WIDTH, laneTileBounds, buildObstacleTileMap, buildRoadTileMap,
  isTilePassable, type MovementProfile,
} from '../../game/engine/terrainGrid'
import { projectUnitRoute } from '../../game/engine/projectRoute'
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
  /** Dev-only: shade collision tiles green/red, draw the tile grid, and project
   *  the selected unit's route while paused. See DevMenu's toggle. */
  debugOverlay?: boolean
  /** Unit currently tapped in the inspect panel — the one whose route is drawn. */
  selectedUnitId?: string | null
}

interface LiveProps extends Props {
  w: number
  h: number
}

const TILE_REF_SIZE = 32   // mirrors terrainGrid.ts's private TILE_SIZE

/**
 * Shades every collision tile and draws the tile grid.
 *
 * Tiles are drawn where the COLLISION grid puts them, not where the terrain art
 * is: `gameToTile` rounds, so tile `tcx` owns reference pixels
 * `[tcx*32 - 16, tcx*32 + 16)` and is centred on `tcx*32`. Reference pixels
 * scale linearly to screen pixels because both coordinate systems share the
 * same form (see gameToPixel in terrainGrid.ts vs utils/terrainLayer.ts), so a
 * plain ratio converts them. Any visible mismatch against the drawn terrain is
 * therefore a real discrepancy, which is the entire point of this overlay.
 */
function drawPassabilityTiles(
  g: PIXI.Graphics, state: GameState, w: number, h: number, profile: MovementProfile, swims: boolean,
): void {
  g.clear()
  const obstacleTiles = state.terrainGridCache?.obstacleTiles ?? buildObstacleTileMap(state.terrain ?? [])
  const roadTiles = state.terrainGridCache?.roadTiles ?? buildRoadTileMap(state.roads ?? [])
  const { tcxLo, tcxHi, tcyLo, tcyHi } = laneTileBounds()
  const sx = w / GRID_REF_WIDTH
  const sy = h / GRID_REF_HEIGHT
  const half = TILE_REF_SIZE / 2

  for (let tcy = tcyLo; tcy <= tcyHi; tcy++) {
    for (let tcx = tcxLo; tcx <= tcxHi; tcx++) {
      const passable = isTilePassable(obstacleTiles, roadTiles, tcx, tcy, profile, swims)
      const x = (tcx * TILE_REF_SIZE - half) * sx
      const y = (tcy * TILE_REF_SIZE - half) * sy
      g.rect(x, y, TILE_REF_SIZE * sx, TILE_REF_SIZE * sy)
        .fill({ color: passable ? 0x33ff66 : 0xff3333, alpha: passable ? 0.15 : 0.30 })
        .stroke({ color: 0xffffff, width: 1, alpha: 0.15 })
    }
  }
}

/** Strokes a projected route (game coords) as a white polyline with an end dot. */
function drawRoute(g: PIXI.Graphics, route: Array<{ x: number; y: number }>, w: number, h: number): void {
  g.clear()
  if (route.length < 2) return
  const first = gameToPixel(route[0].x, route[0].y, w, h)
  g.moveTo(first.px, first.py)
  for (let i = 1; i < route.length; i++) {
    const { px, py } = gameToPixel(route[i].x, route[i].y, w, h)
    g.lineTo(px, py)
  }
  g.stroke({ color: 0xffffff, width: 2, alpha: 0.9 })
  const end = gameToPixel(route[route.length - 1].x, route[route.length - 1].y, w, h)
  g.circle(end.px, end.py, 4).fill({ color: 0xffffff, alpha: 0.9 })
}

// Inner component — only mounts once dimensions are known so usePixiApp gets the right size.
function CanvasInner(props: LiveProps) {
  const { w, h } = props
  // Tile size is derived from the lane's HEIGHT against the reference grid's
  // height (see game/engine/terrainGrid.ts), so the lane always spans the same
  // fixed number of tile ROWS and each tile simply scales to fit — a 250px-tall
  // lane gets ~10px tiles, a 500px-tall one ~20px. Height (not width) is the
  // anchor because the battlefield editor previews the full 9:19.5 frame while
  // the live lane is that frame minus the reserved HUD bands: matching on rows
  // keeps forward-axis (game x) layout identical between the two, so authored
  // scenes aren't vertically squashed or pushed off the bottom edge in game.
  const tileScale = h / GRID_REF_HEIGHT
  const containerRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  propsRef.current = props
  const sceneRef = useRef<ReturnType<typeof buildScene> | null>(null)
  const hoverPxRef = useRef<{ x: number; y: number } | null>(null)
  // Cache keys so the dev overlay redraws on change rather than every frame.
  const tileOverlayKeyRef = useRef<string | null>(null)
  const routeKeyRef = useRef<string | null>(null)

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

      // ── Dev passability overlay ───────────────────────────────────────────
      // Terrain never changes mid-battle, so the tile shading is redrawn only
      // when the toggle flips or the terrain identity changes — not per frame
      // like the ellipses above, which would be hundreds of rects every tick.
      const overlayOn = !!cur.debugOverlay
      const selected = overlayOn && cur.paused && cur.selectedUnitId
        ? cur.state.field.find(u => u.id === cur.selectedUnitId && u.hp > 0)
        : undefined
      const profile: MovementProfile = selected?.flying ? 'flying'
        : selected?.tags?.includes('burrowing') ? 'burrowing' : 'ground'
      const swims = selected?.tags?.includes('swim') ?? false
      const tileKey = overlayOn ? `${profile}|${swims}|${cur.state.terrain?.length ?? 0}` : null
      if (tileKey !== tileOverlayKeyRef.current) {
        tileOverlayKeyRef.current = tileKey
        if (tileKey) drawPassabilityTiles(s.tileDebugLayer, cur.state, w, h, profile, swims)
        else s.tileDebugLayer.clear()
      }

      // Route projection runs the real engine forward, so recompute it only when
      // the selection changes — never every frame.
      const routeKey = selected ? `${selected.id}|${Math.round(selected.x)}|${Math.round(selected.y)}` : null
      if (routeKey !== routeKeyRef.current) {
        routeKeyRef.current = routeKey
        if (selected) drawRoute(s.routeLayer, projectUnitRoute(cur.state, selected.id), w, h)
        else s.routeLayer.clear()
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
