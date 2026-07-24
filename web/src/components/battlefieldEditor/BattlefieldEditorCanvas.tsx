import React, { useRef, useEffect, useCallback } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../hooks/usePixiApp'
import { useLetterboxSize } from '../../hooks/useLetterboxSize'
import {
  buildTerrainGfx, buildBgTileGfx, buildBorderGfx, buildDecorGfx, buildManualDecorGfx,
  buildRoadGfx, buildTerrainDecorGfx, gameToPixel, pixelToGame,
} from '../../utils/terrainLayer'
import { TILE_SIZE, EnvTileDef } from '../../data/tiles/tileIndex'
import { TERRAIN_CLEAR_Y, expandTerrainPathsToObstacles } from '../../game/engine/terrain'
import { BATTLEFIELD_ASPECT_RATIO } from '../../game/types'
import type { RoadDef, TerrainObstacle, TerrainType, ToolMode, SelectedEntity, BattlefieldDecorItem, TerrainPathDef } from './battlefieldEditorTypes'

export interface Props {
  environment: string
  envDef?: EnvTileDef
  /** Stable key for WYSIWYG decor scatter — pass actId+nodeId. */
  id: string
  roads: RoadDef[]
  terrain: TerrainObstacle[]
  decor: BattlefieldDecorItem[]
  terrainPaths: TerrainPathDef[]
  tool: ToolMode
  activeObstacleType: TerrainType
  activeDecorTileId: number
  activePathType: TerrainType
  inProgressRoadIndex: number | null
  inProgressPathIndex: number | null
  selectedEntities: SelectedEntity[]
  showGuides: boolean
  onSelectEntities: (entities: SelectedEntity[]) => void
  onRoadClick: (x: number, y: number) => void
  onObstacleClick: (x: number, y: number) => void
  onDecorClick: (x: number, y: number) => void
  onPathClick: (x: number, y: number) => void
  onMoveRoadPoint: (roadIndex: number, pointIndex: number, x: number, y: number) => void
  onMoveObstacle: (index: number, x: number, y: number) => void
  onMoveDecor: (index: number, x: number, y: number) => void
  onMovePathPoint: (pathIndex: number, pointIndex: number, x: number, y: number) => void
  onDeleteRoad: (roadIndex: number) => void
  onDeleteRoadPoint: (roadIndex: number, pointIndex: number) => void
  onDeleteObstacle: (index: number) => void
  onDeleteDecor: (index: number) => void
  onDeletePath: (pathIndex: number) => void
  onDeletePathPoint: (pathIndex: number, pointIndex: number) => void
}

const HANDLE_RADIUS = 8
const SELECTED_COLOR = 0xffcc33
const HANDLE_COLOR = 0x33ccff
const OBSTACLE_COLOR = 0xff5566
const DECOR_COLOR = 0x66ffcc
const PATH_COLOR = 0xcc99ff

type Drag =
  | { kind: 'roadPoint'; roadIndex: number; pointIndex: number }
  | { kind: 'obstacle'; index: number }
  | { kind: 'decor'; index: number }
  | { kind: 'pathPoint'; pathIndex: number; pointIndex: number }

// Inner component — only mounts once dimensions are known so usePixiApp gets the right size.
function EditorPixi(props: Props & { w: number; h: number }) {
  const { w, h } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  propsRef.current = props
  const dragRef = useRef<Drag | null>(null)

  const appRef = usePixiApp(containerRef, w, h, useCallback((app: PIXI.Application) => {
    const stage = app.stage
    stage.eventMode = 'static'
    stage.hitArea = new PIXI.Rectangle(0, 0, w, h)

    stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      const { tool, onRoadClick, onObstacleClick, onDecorClick, onPathClick, onSelectEntities } = propsRef.current
      const pos = e.getLocalPosition(stage)
      const { x, y } = pixelToGame(pos.x, pos.y, w, h)
      if (tool === 'road') { onRoadClick(x, y); return }
      if (tool === 'obstacle') { onObstacleClick(x, y); return }
      if (tool === 'decor') { onDecorClick(x, y); return }
      if (tool === 'path') { onPathClick(x, y); return }
      if (tool === 'select') { onSelectEntities([]) }
    })

    stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const pos = e.getLocalPosition(stage)
      const { x, y } = pixelToGame(pos.x, pos.y, w, h)
      if (drag.kind === 'roadPoint') propsRef.current.onMoveRoadPoint(drag.roadIndex, drag.pointIndex, x, y)
      else if (drag.kind === 'obstacle') propsRef.current.onMoveObstacle(drag.index, x, y)
      else if (drag.kind === 'decor') propsRef.current.onMoveDecor(drag.index, x, y)
      else propsRef.current.onMovePathPoint(drag.pathIndex, drag.pointIndex, x, y)
    })

    const endDrag = () => { dragRef.current = null }
    stage.on('pointerup', endDrag)
    stage.on('pointerupoutside', endDrag)
  }, [w, h]))

  // Rebuilds the scene whenever anything render-affecting changes. Mirrors
  // MapEditorCanvas.tsx: tear down stage children and redraw, rather than
  // remounting the whole PixiJS Application (which usePixiApp only does when
  // w/h change).
  useEffect(() => {
    const app = appRef.current
    if (!app) return
    const stage = app.stage

    // Destroy (not just detach) old children so their in-flight async texture
    // loads (container.destroyed checks in the build*Gfx helpers) abort cleanly
    // instead of resolving into a detached, unreachable container.
    for (const child of [...stage.children]) {
      stage.removeChild(child)
      child.destroy({ children: true })
    }

    const base           = new PIXI.Container()
    const bg             = new PIXI.Container()
    const road           = new PIXI.Container()
    const border         = new PIXI.Container()
    const decorLayer     = new PIXI.Container()
    const decorObstacles = new PIXI.Container()
    const world          = new PIXI.Container()
    const guides         = new PIXI.Graphics()
    const editOverlay    = new PIXI.Container()
    stage.addChild(base, bg, road, border, decorLayer, decorObstacles, world, guides, editOverlay)

    const { environment, envDef, id, roads, terrain, decor, terrainPaths } = props
    buildTerrainGfx(base, new PIXI.Container(), world, { environment, envDef, id, rivers: [], terrainItems: [] }, w, h)
    buildBgTileGfx(bg, { environment, envDef }, w, h)
    buildRoadGfx(road, roads, { environment, envDef }, w, h)
    buildBorderGfx(border, { environment, envDef }, w, h)
    if (decor.length > 0) buildManualDecorGfx(decorLayer, decor, w, h)
    else buildDecorGfx(decorLayer, { environment, envDef, id }, w, h)
    // WYSIWYG: terrainPaths expand into the exact same TerrainObstacle circles
    // the engine adds at battle start, so drawn paths render (and dedup edges
    // against hand-placed obstacles) identically here and in the live game.
    buildTerrainDecorGfx(decorObstacles, [...terrain, ...expandTerrainPathsToObstacles(terrainPaths)], { environment, envDef }, w, h)

    if (props.showGuides) drawGuides(guides, w, h)
    drawEditOverlay(editOverlay, props, w, h, dragRef)
  })

  return <div ref={containerRef} style={{ width: w, height: h }} />
}

function drawGuides(g: PIXI.Graphics, w: number, h: number) {
  const cols = Math.ceil(w / TILE_SIZE)
  const rows = Math.ceil(h / TILE_SIZE)
  for (let c = 0; c <= cols; c++) g.moveTo(c * TILE_SIZE, 0).lineTo(c * TILE_SIZE, h)
  for (let r = 0; r <= rows; r++) g.moveTo(0, r * TILE_SIZE).lineTo(w, r * TILE_SIZE)
  g.stroke({ color: 0xffffff, width: 1, alpha: 0.06 })

  // TERRAIN_CLEAR_Y corridors are lateral (y-axis) positions procedural terrain
  // avoids — lateral y maps to screen-x (gameToPixel's px depends only on y),
  // so each corridor is a vertical line spanning the full forward (x) extent.
  for (const cy of TERRAIN_CLEAR_Y) {
    const { px } = gameToPixel(0, cy, w, h)
    g.moveTo(px, 0).lineTo(px, h).stroke({ color: 0x33ff99, width: 2, alpha: 0.35 })
  }
}

function isRoadSelected(sel: SelectedEntity[], roadIndex: number): boolean {
  return sel.some(s => (s.type === 'road' && s.index === roadIndex) || (s.type === 'roadPoint' && s.roadIndex === roadIndex))
}
function isPointSelected(sel: SelectedEntity[], roadIndex: number, pointIndex: number): boolean {
  return sel.some(s => s.type === 'roadPoint' && s.roadIndex === roadIndex && s.pointIndex === pointIndex)
}
function isObstacleSelected(sel: SelectedEntity[], index: number): boolean {
  return sel.some(s => s.type === 'obstacle' && s.index === index)
}
function isDecorSelected(sel: SelectedEntity[], index: number): boolean {
  return sel.some(s => s.type === 'decor' && s.index === index)
}
function isPathSelected(sel: SelectedEntity[], pathIndex: number): boolean {
  return sel.some(s => (s.type === 'terrainPath' && s.index === pathIndex) || (s.type === 'terrainPathPoint' && s.pathIndex === pathIndex))
}
function isPathPointSelected(sel: SelectedEntity[], pathIndex: number, pointIndex: number): boolean {
  return sel.some(s => s.type === 'terrainPathPoint' && s.pathIndex === pathIndex && s.pointIndex === pointIndex)
}

function drawEditOverlay(
  container: PIXI.Container,
  props: Props,
  w: number,
  h: number,
  dragRef: React.MutableRefObject<Drag | null>,
) {
  const {
    roads, terrain, decor, terrainPaths, selectedEntities, tool, onSelectEntities,
    onDeleteRoad, onDeleteRoadPoint, onDeleteObstacle, onDeleteDecor, onDeletePath, onDeletePathPoint,
  } = props

  // Road strokes + waypoint handles
  roads.forEach((road, roadIndex) => {
    const pts = road.points.map(p => gameToPixel(p.x, p.y, w, h))
    if (pts.length >= 2) {
      const line = new PIXI.Graphics()
      line.moveTo(pts[0].px, pts[0].py)
      for (let i = 1; i < pts.length; i++) line.lineTo(pts[i].px, pts[i].py)
      line.stroke({ color: isRoadSelected(selectedEntities, roadIndex) ? SELECTED_COLOR : HANDLE_COLOR, width: 3, alpha: 0.85 })
      line.eventMode = 'static'
      line.cursor = 'pointer'
      line.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation()
        if (tool === 'delete') { onDeleteRoad(roadIndex); return }
        onSelectEntities([{ type: 'road', index: roadIndex }])
      })
      container.addChild(line)
    }

    road.points.forEach((_, pointIndex) => {
      const { px, py } = pts[pointIndex]
      const handle = new PIXI.Graphics()
      const selected = isPointSelected(selectedEntities, roadIndex, pointIndex)
      handle.circle(0, 0, HANDLE_RADIUS).fill({ color: selected ? SELECTED_COLOR : HANDLE_COLOR, alpha: 0.95 })
      handle.position.set(px, py)
      handle.eventMode = 'static'
      handle.cursor = 'pointer'
      handle.hitArea = new PIXI.Circle(0, 0, HANDLE_RADIUS * 2)
      handle.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation()
        if (tool === 'delete') { onDeleteRoadPoint(roadIndex, pointIndex); return }
        onSelectEntities([{ type: 'roadPoint', roadIndex, pointIndex }])
        dragRef.current = { kind: 'roadPoint', roadIndex, pointIndex }
      })
      container.addChild(handle)
    })
  })

  // Obstacle drag handles
  terrain.forEach((obs, index) => {
    const { px, py } = gameToPixel(obs.x, obs.y, w, h)
    const selected = isObstacleSelected(selectedEntities, index)
    const handle = new PIXI.Graphics()
    handle.circle(0, 0, HANDLE_RADIUS).stroke({ color: selected ? SELECTED_COLOR : OBSTACLE_COLOR, width: 3, alpha: 0.95 })
    handle.position.set(px, py)
    handle.eventMode = 'static'
    handle.cursor = 'pointer'
    handle.hitArea = new PIXI.Circle(0, 0, HANDLE_RADIUS * 2)
    handle.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation()
      if (tool === 'delete') { onDeleteObstacle(index); return }
      onSelectEntities([{ type: 'obstacle', index }])
      dragRef.current = { kind: 'obstacle', index }
    })
    container.addChild(handle)
  })

  // Decor drag handles
  decor.forEach((item, index) => {
    const { px, py } = gameToPixel(item.x, item.y, w, h)
    const selected = isDecorSelected(selectedEntities, index)
    const handle = new PIXI.Graphics()
    handle.circle(0, 0, HANDLE_RADIUS).stroke({ color: selected ? SELECTED_COLOR : DECOR_COLOR, width: 3, alpha: 0.95 })
    handle.position.set(px, py)
    handle.eventMode = 'static'
    handle.cursor = 'pointer'
    handle.hitArea = new PIXI.Circle(0, 0, HANDLE_RADIUS * 2)
    handle.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation()
      if (tool === 'delete') { onDeleteDecor(index); return }
      onSelectEntities([{ type: 'decor', index }])
      dragRef.current = { kind: 'decor', index }
    })
    container.addChild(handle)
  })

  // Terrain-path strokes + waypoint handles (mirrors road strokes/handles above)
  terrainPaths.forEach((path, pathIndex) => {
    const pts = path.points.map(p => gameToPixel(p.x, p.y, w, h))
    if (pts.length >= 2) {
      const line = new PIXI.Graphics()
      line.moveTo(pts[0].px, pts[0].py)
      for (let i = 1; i < pts.length; i++) line.lineTo(pts[i].px, pts[i].py)
      line.stroke({ color: isPathSelected(selectedEntities, pathIndex) ? SELECTED_COLOR : PATH_COLOR, width: 3, alpha: 0.85 })
      line.eventMode = 'static'
      line.cursor = 'pointer'
      line.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation()
        if (tool === 'delete') { onDeletePath(pathIndex); return }
        onSelectEntities([{ type: 'terrainPath', index: pathIndex }])
      })
      container.addChild(line)
    }

    path.points.forEach((_, pointIndex) => {
      const { px, py } = pts[pointIndex]
      const handle = new PIXI.Graphics()
      const selected = isPathPointSelected(selectedEntities, pathIndex, pointIndex)
      handle.circle(0, 0, HANDLE_RADIUS).fill({ color: selected ? SELECTED_COLOR : PATH_COLOR, alpha: 0.95 })
      handle.position.set(px, py)
      handle.eventMode = 'static'
      handle.cursor = 'pointer'
      handle.hitArea = new PIXI.Circle(0, 0, HANDLE_RADIUS * 2)
      handle.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation()
        if (tool === 'delete') { onDeletePathPoint(pathIndex, pointIndex); return }
        onSelectEntities([{ type: 'terrainPathPoint', pathIndex, pointIndex }])
        dragRef.current = { kind: 'pathPoint', pathIndex, pointIndex }
      })
      container.addChild(handle)
    })
  })
}

/**
 * WYSIWYG, editable battlefield lane canvas — mirrors BattlefieldTerrainCanvas's
 * sizing (ResizeObserver-measured, no fixed grid) and renders through the exact
 * same terrainLayer build*Gfx functions the live game uses, plus an editable
 * overlay for roads/obstacles.
 */
export function BattlefieldEditorCanvas(props: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const rawSize = useLetterboxSize(stageRef, BATTLEFIELD_ASPECT_RATIO)
  const dims = rawSize ? { w: Math.floor(rawSize.width), h: Math.floor(rawSize.height) } : null

  return (
    <div
      ref={stageRef}
      style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
    >
      {dims && <EditorPixi key={`${dims.w}x${dims.h}`} {...props} w={dims.w} h={dims.h} />}
    </div>
  )
}
