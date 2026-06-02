import React, { useRef, useEffect, useState } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../../hooks/usePixiApp'
import { buildTerrainGfx, buildBgTileGfx, buildDecorGfx, buildBorderGfx } from '../../../utils/terrainLayer'
import { WORLD_ENV_TILES } from '../../../data/tiles/worldTileIndex'
import { ENV_TILES } from '../../../data/tiles/tileIndex'

export interface Props {
  environment?: string
  /** Stable ID used as terrain scatter seed — use node/act ID for deterministic decoration */
  id?: string
}

// Inner component — only mounts once dimensions are known so usePixiApp gets the right size.
function TerrainPixi({ environment, id, w, h }: Props & { w: number; h: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const envDef = WORLD_ENV_TILES[environment ?? ''] ?? ENV_TILES[environment ?? '']

  usePixiApp(containerRef, w, h, (app) => {
    const base   = new PIXI.Container()
    const river  = new PIXI.Container() // not added to stage — rivers suppressed on battlefield
    const world  = new PIXI.Container()
    const bg     = new PIXI.Container()
    const decor  = new PIXI.Container()
    const border = new PIXI.Container()
    app.stage.addChild(base, bg, border, decor, world)
    buildTerrainGfx(base, river, world,
      { environment, envDef, id, rivers: [] },
      w, h)
    buildBgTileGfx(bg, { environment, envDef }, w, h)
    buildBorderGfx(border, { environment, envDef }, w, h)
    buildDecorGfx(decor, { environment, envDef, id }, w, h)
  })

  return <div ref={containerRef} style={{ width: w, height: h }} />
}

/**
 * World-scale tile terrain background for the Battlefield lane.
 * Measures its container after mount, then renders a PixiJS tile scene.
 * Replaces the SVG layer approach of BattlefieldBackground.
 */
export function BattlefieldTerrainCanvas({ environment, id }: Props) {
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
    // Retry after paint in case layout hasn't settled yet
    const raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      ref={wrapRef}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}
    >
      {dims && <TerrainPixi environment={environment} id={id} w={dims.w} h={dims.h} />}
    </div>
  )
}
