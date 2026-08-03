import React, { useRef, useEffect, useState } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../../hooks/usePixiApp'
import { buildTerrainGfx, buildBgTileGfx, buildDecorGfx } from '../../../utils/terrainLayer'
import { WORLD_ENV_TILES } from '../../../data/tiles/worldTileIndex'
import { ENV_TILES } from '../../../data/tiles/tileIndex'
import { roadCellRect, cellWear, roadStrips } from './cityRoadGeometry'
import type { RoadWearMap } from '../../../game/cityBuilder'

export interface Props {
  environment?: string
  /** Stable ID used as terrain scatter seed — use act/node ID for deterministic decoration */
  id?: string
  /**
   * Road-wear edge arrays. Drawn into this app rather than a canvas of their
   * own: roads belong behind the DOM `.city-grid`, which is exactly where the
   * terrain already sits, and a second WebGL context here would be a third one
   * in the city view (see #1569 — iOS kills pages under context pressure).
   */
  roadWear?: RoadWearMap
  cols?: number
  rows?: number
}

function drawRoads(
  g: PIXI.Graphics,
  roadWear: RoadWearMap | undefined,
  cols: number, rows: number,
  w: number, h: number,
): void {
  if (g.destroyed) return
  g.clear()
  if (!roadWear) return
  const { h: hWear = [], v: vWear = [] } = roadWear
  for (let i = 0; i < cols * rows; i++) {
    const strips = roadStrips(cellWear(i, cols, rows, hWear, vWear), roadCellRect(i, cols, rows, w, h))
    for (const s of strips) {
      g.rect(s.x, s.y, s.w, s.h).fill({ color: s.color, alpha: s.alpha })
    }
  }
}

function TerrainPixi({ environment, id, roadWear, cols, rows, w, h }: Props & { w: number; h: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const envDef = WORLD_ENV_TILES[environment ?? ''] ?? ENV_TILES[environment ?? '']
  const roadGfxRef = useRef<PIXI.Graphics | null>(null)

  usePixiApp(containerRef, w, h, (app) => {
    const base  = new PIXI.Container()
    const river = new PIXI.Container() // not added to stage — rivers suppressed in city view
    const world = new PIXI.Container()
    const bg    = new PIXI.Container()
    const decor = new PIXI.Container()
    const roads = new PIXI.Graphics()   // above the scenery, below the DOM grid
    app.stage.addChild(base, bg, decor, world, roads)
    buildTerrainGfx(base, river, world,
      { environment, envDef, id, rivers: [] },
      w, h)
    buildBgTileGfx(bg, { environment, envDef }, w, h)
    buildDecorGfx(decor, { environment, envDef, id }, w, h)
    roadGfxRef.current = roads
    drawRoads(roads, roadWear, cols ?? 1, rows ?? 1, w, h)
  })

  // Redraw when wear changes. The scene is built once in onReady, so this is
  // the only path for later updates; a context loss can destroy the Graphics
  // out from under us mid-rebuild, hence the destroyed guard in drawRoads.
  useEffect(() => {
    const g = roadGfxRef.current
    if (g) drawRoads(g, roadWear, cols ?? 1, rows ?? 1, w, h)
  }, [roadWear, cols, rows, w, h])

  return <div ref={containerRef} style={{ width: w, height: h }} />
}

/**
 * World-scale tile terrain background for the CityBuilder grid, plus the
 * road-wear overlay drawn on top of it.
 * Measures its container after mount, then renders a PixiJS tile scene.
 * Placed as the first child of city-zoom-wrapper so it scales with zoom/pan.
 */
export function CityTerrainCanvas({ environment = 'farmland', id, roadWear, cols, rows }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width > 0 && height > 0) setDims({ w: Math.ceil(width), h: Math.ceil(height) })
    }
    measure()
    const raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      ref={wrapRef}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}
    >
      {dims && (
        <TerrainPixi
          environment={environment} id={id}
          roadWear={roadWear} cols={cols} rows={rows}
          w={dims.w} h={dims.h}
        />
      )}
    </div>
  )
}
