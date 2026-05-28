import React, { useRef } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../hooks/usePixiApp'
import { buildTerrainGfx, buildBgTileGfx, buildDecorGfx } from '../../utils/terrainLayer'
import { renderPathTiles } from '../../utils/tileLookup'
import {
  MAP_W, MAP_H,
  HUB_AREAS,
  HUB_BUILDINGS,
  HUB_INTERACTION_POINTS,
  HUB_STREET_TILES,
} from '../../data/hubLayout'

const HUB_ENV = 'camp'

// Building fill colour — dark stone, slightly warm
const BUILDING_COLOR  = 0x1a1810
const BUILDING_BORDER = 0x4a4030
// Interaction-point ellipse colours (matches NodeMap node style)
const MARKER_FILL     = 0x2a3a2a
const MARKER_STROKE   = 0x88cc88
const MARKER_GLOW     = 0x44aa44

interface Props {
  onAreaEnter: (areaName: string | null) => void
}

export function HubTownCanvas({ onAreaEnter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onAreaRef    = useRef(onAreaEnter)
  onAreaRef.current  = onAreaEnter

  usePixiApp(containerRef, MAP_W, MAP_H, (app) => {
    app.canvas.style.touchAction = 'pan-x pan-y'

    // ── Layer hierarchy ────────────────────────────────────────────────────────
    const groundLayer  = new PIXI.Container()
    const streetLayer  = new PIXI.Container()
    const buildingLayer = new PIXI.Container()
    const markerLayer  = new PIXI.Container()
    const worldLayer   = new PIXI.Container()
    worldLayer.sortableChildren = true
    app.stage.addChild(groundLayer, streetLayer, buildingLayer, markerLayer, worldLayer)

    // ── Terrain (camp environment) ─────────────────────────────────────────────
    const baseContainer  = new PIXI.Container()
    const riverContainer = new PIXI.Container()
    groundLayer.addChild(baseContainer, riverContainer)

    buildTerrainGfx(baseContainer, riverContainer, worldLayer,
      { environment: HUB_ENV, id: 'hubworld' }, MAP_W, MAP_H)
    buildBgTileGfx(baseContainer, { environment: HUB_ENV }, MAP_W, MAP_H)
      .catch(e => console.error('[HubTownCanvas] bg tiles failed', e))
    buildDecorGfx(groundLayer, { environment: HUB_ENV, id: 'hubworld' }, MAP_W, MAP_H)
      .catch(e => console.error('[HubTownCanvas] decor tiles failed', e))

    // ── Streets ───────────────────────────────────────────────────────────────
    const pathSet = new Set(HUB_STREET_TILES.map(([tx, ty]) => `${tx},${ty}`))
    renderPathTiles(streetLayer, pathSet, HUB_ENV)
      .catch(e => console.error('[HubTownCanvas] street tiles failed', e))

    // ── Buildings ─────────────────────────────────────────────────────────────
    const bldGfx = new PIXI.Graphics()
    for (const b of HUB_BUILDINGS) {
      bldGfx
        .rect(b.x, b.y, b.w, b.h)
        .fill({ color: BUILDING_COLOR })
        .rect(b.x, b.y, b.w, b.h)
        .stroke({ color: BUILDING_BORDER, width: 1 })
    }
    buildingLayer.addChild(bldGfx)

    // ── Interaction-point ellipses (district entrances) ────────────────────────
    const T = 32
    for (const pt of HUB_INTERACTION_POINTS) {
      const g   = new PIXI.Graphics()
      const cx  = pt.tx * T + T / 2
      const cy  = pt.ty * T + T / 2
      // glow ring
      g.ellipse(cx, cy, 14, 8).fill({ color: MARKER_GLOW, alpha: 0.25 })
      // body
      g.ellipse(cx, cy, 10, 6).fill({ color: MARKER_FILL })
      g.ellipse(cx, cy, 10, 6).stroke({ color: MARKER_STROKE, width: 1.5 })
      // highlight
      g.ellipse(cx - 2, cy - 2, 5, 3).fill({ color: MARKER_STROKE, alpha: 0.4 })
      markerLayer.addChild(g)
    }

    // ── Area name on pointer move ──────────────────────────────────────────────
    app.stage.eventMode = 'static'
    app.stage.hitArea   = new PIXI.Rectangle(0, 0, MAP_W, MAP_H)
    app.stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      const { x, y } = e.getLocalPosition(app.stage)
      const area = HUB_AREAS.find(
        a => x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h,
      )
      onAreaRef.current(area?.name ?? null)
    })
    app.stage.on('pointerleave', () => { onAreaRef.current(null) })

    app.ticker.add(() => { worldLayer.sortChildren() })
  })

  return (
    <div
      ref={containerRef}
      style={{ display: 'block', flexShrink: 0, width: MAP_W, height: MAP_H }}
    />
  )
}
