import React, { useRef, useEffect, useState } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../../hooks/usePixiApp'
import { buildTerrainGfx, buildBgTileGfx, buildDecorGfx, buildManualDecorGfx, buildBorderGfx, buildTerrainDecorGfx, buildRoadGfx } from '../../../utils/terrainLayer'
import { WORLD_ENV_TILES } from '../../../data/tiles/worldTileIndex'
import { ENV_TILES } from '../../../data/tiles/tileIndex'
import type { TerrainObstacle, RoadDef, BattlefieldDecorItem } from '../../../game/engine/terrain'

export interface Props {
  environment?: string
  /** Stable ID used as terrain scatter seed — use node/act ID for deterministic decoration */
  id?: string
  terrain?: TerrainObstacle[]
  /** Act/node-authored road paths. Rendered only — does not affect unit movement. */
  roads?: RoadDef[]
  /** Act/node-authored manual decor placements. When non-empty, replaces the procedural decor scatter. */
  decor?: BattlefieldDecorItem[]
}

// Inner component — only mounts once dimensions are known so usePixiApp gets the right size.
function TerrainPixi({ environment, id, terrain, roads, decor: decorItems, w, h }: Props & { w: number; h: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const envDef = WORLD_ENV_TILES[environment ?? ''] ?? ENV_TILES[environment ?? '']

  usePixiApp(containerRef, w, h, (app) => {
    const base           = new PIXI.Container()
    const river          = new PIXI.Container() // not added to stage — rivers suppressed on battlefield
    const world          = new PIXI.Container()
    const bg             = new PIXI.Container()
    const decor          = new PIXI.Container()
    const border         = new PIXI.Container()
    const decorObstacles = new PIXI.Container()
    const road           = new PIXI.Container()
    // Roads draw AFTER (on top of) terrain obstacles — matches the new default
    // z-order convention (road zIndex 1 > obstacle zIndex 0), so an ordinary
    // road crossing water/rock reads visually as a bridge with no authoring
    // effort. See RoadDef.zIndex / game/engine/terrainGrid.ts for the gameplay
    // side of this (the actual passability rule uses zIndex, not draw order).
    app.stage.addChild(base, bg, border, decor, decorObstacles, road, world)
    buildTerrainGfx(base, river, world,
      { environment, envDef, id, rivers: [], terrainItems: [] },
      w, h)
    buildBgTileGfx(bg, { environment, envDef }, w, h)
    buildRoadGfx(road, roads ?? [], { environment, envDef }, w, h)
    buildBorderGfx(border, { environment, envDef }, w, h)
    if (decorItems?.length) buildManualDecorGfx(decor, decorItems, w, h)
    else buildDecorGfx(decor, { environment, envDef, id }, w, h)
    buildTerrainDecorGfx(decorObstacles, terrain ?? [], { environment, envDef }, w, h)
  })

  return <div ref={containerRef} style={{ width: w, height: h }} />
}

/**
 * World-scale tile terrain background for the Battlefield lane.
 * Measures its container after mount, then renders a PixiJS tile scene.
 * Replaces the SVG layer approach of BattlefieldBackground.
 */
export function BattlefieldTerrainCanvas({ environment, id, terrain, roads, decor }: Props) {
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
        // Only update when the rounded size actually changes — avoids needless remounts.
        setDims(prev => (prev && prev.w === w && prev.h === h) ? prev : { w, h })
      }
    }
    // Re-measure whenever the container resizes (viewport/orientation change).
    // rAF-debounced so a burst of resize callbacks collapses into a single remount
    // at the final size. The lane no longer resizes during battle, so this is rare.
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    })
    ro.observe(el)
    measure()
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  return (
    <div
      ref={wrapRef}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}
    >
      {/* Re-key on size/environment/id so the Pixi scene remounts and rebuilds — usePixiApp's
          onReady closure only runs once per mount, so changing terrain/environment/id alone
          (with the same dimensions) would otherwise silently keep rendering the stale scene. */}
      {dims && <TerrainPixi key={`${dims.w}x${dims.h}-${environment}-${id}`} environment={environment} id={id} terrain={terrain} roads={roads} decor={decor} w={dims.w} h={dims.h} />}
    </div>
  )
}
