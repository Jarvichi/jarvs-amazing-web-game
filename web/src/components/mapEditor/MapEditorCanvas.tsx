import React, { useRef, useEffect, useCallback, useState } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../hooks/usePixiApp'
import { loadTileRef, loadSpriteTexture } from '../../utils/pixiHelpers'
import { BASE_CHIP_TILES } from '../../data/tiles/baseChipIndex'
import type { RawMapConfig, RawDecorItem, RawBlockedPath, RawLockedDoor, SelectedEntity, ToolMode, Zlayer } from './mapEditorTypes'
import { resolveVariantTint, AnimalType } from '../../game/hub/animals'
import { WALL_TILES } from '../../data/tiles/buildingMaterials'
import type { WallMaterial, RoofMaterial } from '../../data/tiles/buildingMaterials'
import { placeBuildingTiles, resolveBuildingVisual } from '../../data/tiles/buildingRender'
import type { BuildingDoorTile } from '../../data/tiles/buildingRender'
import { isVisibleAtLevel } from '../../data/hub/loader'
import { expandBundleDecor } from '../../data/bundles/bundleLoader'
import { RawQuestPickupItem } from '../../data/hub/hubWorldFactory'
import { resolveNpcSprite } from './spriteList'
import { isSameEntityRef } from './multiSelectHelpers'

const T           = 32
const INTERIOR_PAD = 10  // tiles of surrounding space around active room in interior view

const WALL_COLORS: Record<string, number> = {
  brick:               0x8b5e4a,
  woodWall:            0x7a5c38,
  tudorFrame:          0x6a4e2a,
  renderedBrick:       0xaa8866,
  whiteStone:          0xc8c0b0,
  darkStone:           0x4a4a5a,
  castleStone:         0x5a5a6a,
  ornateStone:         0x6a7a6a,
  reinforcedStone:     0x4a5a4a,
  woodenSlats:         0x8a6a4a,
  interiorWallStriped: 0x7a7a8a,
  interiorWallWhite:   0xc0c0c0,
  prisonRailings:      0x444444,
}

const STREET_COLOR = 0x8a7a5a
const POND_COLOR   = 0x3a6aaa
const GROUND_COLOR = 0x3a5a3a

function tileNumericId(tileId: string): number {
  return (BASE_CHIP_TILES as Record<string, number>)[tileId] ?? 0
}

function expandEntries(entries: Array<{ rect?: number[]; tile?: number[] }>): [number, number][] {
  const out: [number, number][] = []
  for (const e of entries) {
    if (e.rect) {
      const [tx1, ty1, tx2, ty2] = e.rect
      for (let tx = tx1; tx <= tx2; tx++)
        for (let ty = ty1; ty <= ty2; ty++)
          out.push([tx, ty])
    } else if (e.tile) {
      out.push([e.tile[0], e.tile[1]])
    }
  }
  return out
}

type FlatDecorItem = { tx: number; ty: number; tileId: string; zlayer: Zlayer; sourceIndex: number; minLevel: number; hideAtLevel?: number }

function flattenDecor(items: RawDecorItem[]): FlatDecorItem[] {
  const out: FlatDecorItem[] = []
  items.forEach((item, sourceIndex) => {
    if (item.tx === undefined) return // comment-only entry
    const minLevel = item.minLevel ?? 0
    const hideAtLevel = item.hideAtLevel
    if (item.bundleID) {
      const expanded = expandBundleDecor(item.bundleID, item.tx, item.ty ?? 0)
      expanded.forEach(e => {
        const tileKey = Object.keys(BASE_CHIP_TILES as Record<string, number>)
          .find(k => (BASE_CHIP_TILES as Record<string, number>)[k] === e.tileId) ?? ''
        if (tileKey) out.push({ tx: e.tx, ty: e.ty, tileId: tileKey, zlayer: (e.zlayer as Zlayer) ?? 'solid', sourceIndex, minLevel, hideAtLevel })
      })
    } else if (item.tileId) {
      out.push({ tx: item.tx, ty: item.ty ?? 0, tileId: item.tileId, zlayer: item.zlayer ?? 'solid', sourceIndex, minLevel, hideAtLevel })
    }
  })
  return out
}

interface Props {
  configData:       RawMapConfig
  tool:             ToolMode
  showGrid:         boolean
  showBuildingArt?: boolean   // render buildings as real tiles (default) vs flat colour blocks
  selectedEntities: SelectedEntity[]
  viewMode:            'exterior' | 'interior' | 'building'
  activeInteriorId:    string | null
  activeBuildingIndex: number | null
  activeLevel:      number
  previewFestivalId?: string | null
  activeTileId:     string | null
  activeBundleId:   string | null
  activeZlayer:     Zlayer
  pickActive?:      boolean
  onPickTile?:      (tx: number, ty: number) => void
  onSelectEntities: (e: SelectedEntity[]) => void
  onAddToSelection: (e: SelectedEntity) => void
  onPlaceDecor:     (tx: number, ty: number) => void
  onMoveEntities:   (moves: { entity: SelectedEntity; tx: number; ty: number }[]) => void
  onDeleteEntities: (entities: SelectedEntity[]) => void
  onAddStreet:        (tx1: number, ty1: number, tx2: number, ty2: number) => void
  onAddPondTile:      (tx1: number, ty1: number, tx2: number, ty2: number) => void
  onAddNpcSpawnTile:  (tx: number, ty: number) => void
  onAddChickenZone:   (tx1: number, ty1: number, tx2: number, ty2: number) => void
  onAddArea:           (tx1: number, ty1: number, tx2: number, ty2: number) => void
  onPlaceBuildingDoor: (buildingIndex: number, absTx: number, absTy: number) => void
  showQuestItems:     boolean
  showBlockedPaths:   boolean
  showAreas:          boolean
  showInteractables:  boolean
  blockedPaths:       RawBlockedPath[]
  questPickupItems:   RawQuestPickupItem[]
}

export function MapEditorCanvas(props: Props) {
  const {
    configData, tool, showGrid, showBuildingArt = true, selectedEntities, viewMode, activeInteriorId, activeBuildingIndex, activeLevel, previewFestivalId,
    activeTileId, activeBundleId, activeZlayer, pickActive, showQuestItems, showBlockedPaths, showAreas, showInteractables, blockedPaths, questPickupItems,
    onPlaceDecor, onAddStreet,
  } = props

  const containerRef = useRef<HTMLDivElement>(null)

  // True if the given entity is part of the current selection.
  const isEntitySelected = useCallback(
    (e: SelectedEntity): boolean => selectedEntities.some(s => isSameEntityRef(s, e)),
    [selectedEntities],
  )

  // Refs that event handlers read so they always get the latest values
  const propsRef = useRef(props)
  propsRef.current = props

  // Drag state — each selected entity is dragged together, keeping its own offset
  // from the cursor (offsetX/Y = cursor tile minus that entity's anchor tile).
  const dragRef = useRef<{
    entities: { entity: SelectedEntity; offsetX: number; offsetY: number }[]
    lastTx: number
    lastTy: number
  } | null>(null)

  // Rect-draw state (shared by all rect-draw tools: street/pond/chickenZone/area)
  type RectPreview = { sx: number; sy: number; ex: number; ey: number }
  const [rectPreview, setRectPreview] = useState<RectPreview | null>(null)
  const setRectPreviewRef = useRef(setRectPreview)
  setRectPreviewRef.current = setRectPreview
  const rectDrawRef = useRef<{ startTx: number; startTy: number; lastTx: number; lastTy: number } | null>(null)

  // Clear rect draw when tool switches away from a rect-draw tool
  useEffect(() => {
    const rectTools: ToolMode[] = ['street', 'pond', 'chickenZone', 'area']
    if (!rectTools.includes(tool)) {
      rectDrawRef.current = null
      setRectPreview(null)
    }
  }, [tool])

  // Shared pointerdown logic for entity sprites/graphics. Shift+click toggles the
  // entity in/out of the selection; a plain click selects it (or keeps an existing
  // multi-selection containing it) and, with the select tool, begins a group drag.
  // anchorTx/anchorTy is the reference tile used to compute per-entity drag offsets.
  const handleEntityPointerDown = useCallback(
    (e: PIXI.FederatedPointerEvent, entity: SelectedEntity, anchorTx: number, anchorTy: number) => {
      e.stopPropagation()
      if (e.shiftKey) { propsRef.current.onAddToSelection(entity); return }
      const selEnts = propsRef.current.selectedEntities
      const isAlreadySelected = selEnts.some(s => isSameEntityRef(s, entity))
      propsRef.current.onSelectEntities(isAlreadySelected ? selEnts : [entity])
      if (propsRef.current.tool === 'select') {
        const cfg = propsRef.current.configData
        const dragEntities = isAlreadySelected && selEnts.length > 1 ? selEnts : [entity]
        dragRef.current = {
          entities: dragEntities.map(ent => ({
            entity: ent,
            offsetX: anchorTx - getEntityTx(cfg, ent),
            offsetY: anchorTy - getEntityTy(cfg, ent),
          })),
          lastTx: anchorTx, lastTy: anchorTy,
        }
      }
    },
    [],
  )

  // Render version counter — incremented on each render, so async sprite loads can detect staleness
  const renderVersionRef = useRef(0)
  // World origin offset — non-zero in interior mode to make room for adjacent rooms above/left
  const worldOriginRef = useRef({ x: 0, y: 0 })

  const BUILDING_PAD = 2

  // Compute canvas dimensions
  const isInterior = viewMode === 'interior' && activeInteriorId
  const isBuilding = viewMode === 'building' && activeBuildingIndex != null
  const interior   = isInterior ? configData.interiors?.[activeInteriorId!] : null
  const activeBuilding = isBuilding ? (configData.buildings ?? [])[activeBuildingIndex!] ?? null : null

  const buildingAllRects = activeBuilding
    ? ((activeBuilding.rects ?? (activeBuilding.rect ? [activeBuilding.rect] : [])) as [number, number, number, number][])
    : []
  const bMinX = buildingAllRects.length ? Math.min(...buildingAllRects.map(r => r[0])) : 0
  const bMinY = buildingAllRects.length ? Math.min(...buildingAllRects.map(r => r[1])) : 0
  const bMaxX = buildingAllRects.length ? Math.max(...buildingAllRects.map(r => r[2])) : 0
  const bMaxY = buildingAllRects.length ? Math.max(...buildingAllRects.map(r => r[3])) : 0

  const mapW = isInterior
    ? ((interior?.width  ?? 12) + INTERIOR_PAD * 2) * T
    : isBuilding
      ? (bMaxX - bMinX + 1 + BUILDING_PAD * 2) * T
      : configData.mapW
  const mapH = isInterior
    ? ((interior?.height ?? 9)  + INTERIOR_PAD * 2) * T
    : isBuilding
      ? (bMaxY - bMinY + 1 + BUILDING_PAD * 2) * T
      : configData.mapH

  const appRef = usePixiApp(containerRef, mapW, mapH, useCallback((app: PIXI.Application) => {
    const stage = app.stage
    stage.eventMode = 'static'
    stage.hitArea   = new PIXI.Rectangle(0, 0, mapW, mapH)

    stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      const { tool: t, activeTileId: tid, activeBundleId: bid, viewMode: vm,
               activeInteriorId: iid, configData: cfg, showQuestItems: sqI,
               showBlockedPaths: sbp, blockedPaths: bps, showAreas: sareas,
               showInteractables: sint } = propsRef.current
      const { x: ox, y: oy } = worldOriginRef.current
      const pos = e.getLocalPosition(stage)
      const tx  = Math.floor((pos.x - ox) / T)
      const ty  = Math.floor((pos.y - oy) / T)

      // Pick-location mode overrides all tools: the click sets an entity's tile.
      if (propsRef.current.pickActive) {
        propsRef.current.onPickTile?.(tx, ty)
        return
      }

      const { activeBuildingIndex: abIdx } = propsRef.current
      if (t === 'select') {
        const entity = hitTest(cfg, tx, ty, vm, iid, abIdx, sqI, sbp, bps, sareas, sint)
        if (e.shiftKey) {
          if (entity) propsRef.current.onAddToSelection(entity)
          // shift+click on empty space: do nothing
        } else if (entity) {
          handleEntityPointerDown(e, entity, tx, ty)
        } else {
          propsRef.current.onSelectEntities([])
        }
      } else if (t === 'place' && vm === 'building' && abIdx != null && !tid && !bid) {
        // In building mode with no active tile: toggle a door on the south face
        propsRef.current.onPlaceBuildingDoor(abIdx, tx, ty)
      } else if (t === 'place' && (tid || bid)) {
        propsRef.current.onPlaceDecor(tx, ty)
      } else if (t === 'delete') {
        const entity = hitTest(cfg, tx, ty, vm, iid, abIdx, sqI, sbp, bps, sareas, sint)
        if (entity) {
          propsRef.current.onDeleteEntities([entity])
          propsRef.current.onSelectEntities([])
        }
      } else if (vm !== 'building' && (t === 'street' || t === 'pond' || t === 'chickenZone' || t === 'area')) {
        rectDrawRef.current = { startTx: tx, startTy: ty, lastTx: tx, lastTy: ty }
        setRectPreviewRef.current({ sx: tx, sy: ty, ex: tx, ey: ty })
      } else if (t === 'spawn') {
        propsRef.current.onAddNpcSpawnTile(tx, ty)
      }
    })

    stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      const { x: ox, y: oy } = worldOriginRef.current
      const pos = e.getLocalPosition(stage)
      const tx  = Math.floor((pos.x - ox) / T)
      const ty  = Math.floor((pos.y - oy) / T)

      if (dragRef.current) {
        const { entities, lastTx, lastTy } = dragRef.current
        if (tx !== lastTx || ty !== lastTy) {
          dragRef.current.lastTx = tx
          dragRef.current.lastTy = ty
          propsRef.current.onMoveEntities(
            entities.map(({ entity, offsetX, offsetY }) => ({ entity, tx: tx - offsetX, ty: ty - offsetY })),
          )
        }
      }

      if (rectDrawRef.current) {
        const { startTx, startTy, lastTx, lastTy } = rectDrawRef.current
        if (tx !== lastTx || ty !== lastTy) {
          rectDrawRef.current.lastTx = tx
          rectDrawRef.current.lastTy = ty
          setRectPreviewRef.current({
            sx: Math.min(tx, startTx), sy: Math.min(ty, startTy),
            ex: Math.max(tx, startTx), ey: Math.max(ty, startTy),
          })
        }
      }
    })

    stage.on('pointerup', (e: PIXI.FederatedPointerEvent) => {
      dragRef.current = null
      if (rectDrawRef.current) {
        const { x: ox, y: oy } = worldOriginRef.current
        const pos = e.getLocalPosition(stage)
        const upTx = Math.floor((pos.x - ox) / T)
        const upTy = Math.floor((pos.y - oy) / T)
        const { startTx, startTy } = rectDrawRef.current
        const tx1 = Math.min(upTx, startTx), ty1 = Math.min(upTy, startTy)
        const tx2 = Math.max(upTx, startTx), ty2 = Math.max(upTy, startTy)
        const { tool: t } = propsRef.current
        if      (t === 'street')      propsRef.current.onAddStreet(tx1, ty1, tx2, ty2)
        else if (t === 'pond')        propsRef.current.onAddPondTile(tx1, ty1, tx2, ty2)
        else if (t === 'chickenZone') propsRef.current.onAddChickenZone(tx1, ty1, tx2, ty2)
        else if (t === 'area')        propsRef.current.onAddArea(tx1, ty1, tx2, ty2)
        rectDrawRef.current = null
        setRectPreviewRef.current(null)
      }
    })
    stage.on('pointerupoutside', () => {
      dragRef.current = null
      if (rectDrawRef.current) {
        rectDrawRef.current = null
        setRectPreviewRef.current(null)
      }
    })
  }, [mapW, mapH])) // eslint-disable-line react-hooks/exhaustive-deps

  // Rebuild PixiJS scene on every render (configData / showGrid / selectedEntity changes)
  useEffect(() => {
    const app = appRef.current
    if (!app) return
    const stage = app.stage
    const version = ++renderVersionRef.current

    // Remove old scene children (keep stage itself)
    const toRemove: PIXI.ContainerChild[] = []
    for (let i = 0; i < stage.children.length; i++) toRemove.push(stage.children[i])
    toRemove.forEach(c => stage.removeChild(c))

    const groundLayer   = new PIXI.Container()
    const streetLayer   = new PIXI.Container()
    const buildingLayer = new PIXI.Container()
    const decorBLayer   = new PIXI.Container()
    const decorLayer    = new PIXI.Container()
    const npcLayer      = new PIXI.Container()
    const decorALayer   = new PIXI.Container()
    const questLayer    = new PIXI.Container()
    const selLayer      = new PIXI.Graphics()
    const gridLayer     = new PIXI.Graphics()

    let padX = 0, padY = 0
    if (isInterior) {
      padX = INTERIOR_PAD * T
      padY = INTERIOR_PAD * T
    } else if (isBuilding) {
      padX = (BUILDING_PAD - bMinX) * T
      padY = (BUILDING_PAD - bMinY) * T
    }
    worldOriginRef.current = { x: padX, y: padY }
    const worldContainer = new PIXI.Container()
    worldContainer.x = padX
    worldContainer.y = padY
    stage.addChild(worldContainer)
    worldContainer.addChild(groundLayer, streetLayer, buildingLayer,
                            decorBLayer, decorLayer, npcLayer, decorALayer, questLayer,
                            selLayer, gridLayer)

    if (isInterior && interior) {
      renderInterior(version, groundLayer, decorBLayer, decorLayer, decorALayer, npcLayer, questLayer, selLayer)
    } else if (isBuilding && activeBuilding) {
      renderBuilding(version, groundLayer, buildingLayer, decorBLayer, decorLayer, decorALayer, selLayer)
    } else {
      renderExterior(version, groundLayer, streetLayer, buildingLayer,
                     decorBLayer, decorLayer, npcLayer, decorALayer, selLayer)
    }
    if (!isInterior && !isBuilding && showQuestItems) {
      renderQuestItems(version, questLayer, selLayer)
    }
    if (!isInterior && !isBuilding && showBlockedPaths) {
      renderBlockedPathsOverlay(questLayer, selLayer)
    }
    if (!isInterior && !isBuilding && showAreas) {
      renderAreasOverlay(questLayer, selLayer)
    }
    if (!isInterior && !isBuilding) {
      renderChickenZonesOverlay(questLayer, selLayer)
    }
    if (!isBuilding && showInteractables) {
      renderInteractablesOverlay(version, questLayer, selLayer)
    }

    if (showGrid) drawGrid(gridLayer)
    drawSelection(selLayer)

    // Rect draw preview — drawn above all other layers
    if (!isInterior && rectPreview) {
      const { sx, sy, ex, ey } = rectPreview
      const pvGfx = new PIXI.Graphics()
      pvGfx.rect(sx * T, sy * T, (ex - sx + 1) * T, (ey - sy + 1) * T)
        .fill({ color: STREET_COLOR, alpha: 0.4 })
        .stroke({ color: 0xf0c040, width: 2 })
      worldContainer.addChild(pvGfx)
    }

    // Pick-location overlay — a transparent full-canvas catcher above every
    // sprite, so a pick click lands on whatever tile is under the cursor even
    // when an entity sprite (which stops propagation) sits there.
    if (pickActive) {
      const catcher = new PIXI.Graphics()
      catcher.rect(0, 0, mapW, mapH).fill({ color: 0x000000, alpha: 0.001 })
      catcher.eventMode = 'static'
      catcher.cursor = 'crosshair'
      catcher.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        const { x: ox, y: oy } = worldOriginRef.current
        const pos = e.getLocalPosition(stage)
        propsRef.current.onPickTile?.(Math.floor((pos.x - ox) / T), Math.floor((pos.y - oy) / T))
      })
      stage.addChild(catcher)
    }
  })

  // ── Exterior rendering ─────────────────────────────────────────────────────────
  function renderExterior(
    version: number,
    groundLayer: PIXI.Container, streetLayer: PIXI.Container, buildingLayer: PIXI.Container,
    decorBLayer: PIXI.Container, decorLayer: PIXI.Container,
    npcLayer: PIXI.Container, decorALayer: PIXI.Container,
    selLayer: PIXI.Graphics,
  ) {
    const W = Math.ceil(configData.mapW / T)
    const H = Math.ceil(configData.mapH / T)

    // Ground
    const gndGfx = new PIXI.Graphics()
    gndGfx.rect(0, 0, W * T, H * T).fill(GROUND_COLOR)
    groundLayer.addChild(gndGfx)

    // Streets
    const sGfx = new PIXI.Graphics()
    for (const s of configData.streets ?? [])
      for (const [tx, ty] of expandEntries([s]))
        sGfx.rect(tx * T, ty * T, T, T).fill(STREET_COLOR)
    streetLayer.addChild(sGfx)

    // Ponds — per-entry interactive graphics (clickable / selectable / draggable)
    ;(configData.pondTiles ?? []).forEach((pond, pIdx) => {
      const isSel = isEntitySelected({ type: 'pondTile', index: pIdx })
      const gfx = new PIXI.Graphics()
      for (const [ptx, pty] of expandEntries([pond]))
        gfx.rect(ptx * T, pty * T, T, T).fill(POND_COLOR)
      if (isSel) {
        for (const [ptx, pty] of expandEntries([pond]))
          selLayer.rect(ptx * T - 1, pty * T - 1, T + 2, T + 2).stroke({ color: 0xf0c040, width: 2 })
      }
      const anchorTx = pond.rect?.[0] ?? pond.tile?.[0] ?? 0
      const anchorTy = pond.rect?.[1] ?? pond.tile?.[1] ?? 0
      gfx.eventMode = 'static'; gfx.cursor = 'pointer'
      gfx.on('pointerdown', (e: PIXI.FederatedPointerEvent) =>
        handleEntityPointerDown(e, { type: 'pondTile', index: pIdx }, anchorTx, anchorTy))
      streetLayer.addChild(gfx)
    })

    // Spawn tiles — cyan crosshair, always visible in exterior
    ;(configData.npcSpawnTiles ?? []).forEach(([stx, sty], idx) => {
      const isSel = isEntitySelected({ type: 'npcSpawnTile', index: idx })
      const gfx = new PIXI.Graphics()
      gfx.rect(stx * T + T / 2 - 2, sty * T + 3, 4, T - 6).fill({ color: 0x40d0f0, alpha: 0.85 })
      gfx.rect(stx * T + 3, sty * T + T / 2 - 2, T - 6, 4).fill({ color: 0x40d0f0, alpha: 0.85 })
      gfx.eventMode = 'static'; gfx.cursor = 'pointer'
      gfx.on('pointerdown', (e: PIXI.FederatedPointerEvent) =>
        handleEntityPointerDown(e, { type: 'npcSpawnTile', index: idx }, stx, sty))
      if (isSel) selLayer.rect(stx * T - 2, sty * T - 2, T + 4, T + 4).stroke({ color: 0xf0c040, width: 2 })
      streetLayer.addChild(gfx)
    })

    // Buildings — rendered with real wall/roof tiles for the *current editing
    // level* (resolveBuildingVisual applies any levelVisuals overrides), so the
    // editor preview matches the in-game look. Falls back to flat colour blocks
    // when art is toggled off or the building has no wall/roof material.
    const buildings = configData.buildings ?? []
    buildings.forEach((b, bIdx) => {
      const allRects = (b.rects ?? (b.rect ? [b.rect] : [])) as [number, number, number, number][]
      const baseRect = allRects[0] ?? [0, 0, 0, 0]
      const vis = resolveBuildingVisual(
        { rect: baseRect, wall: b.wall as WallMaterial | undefined, roof: b.roof as RoofMaterial | undefined },
        b.levelVisuals as Array<{ minLevel: number; rect?: [number, number, number, number]; wall?: WallMaterial; roof?: RoofMaterial }> | undefined,
        activeLevel,
      )
      // A level footprint override replaces the whole footprint; otherwise keep
      // the building's (possibly multi-rect) base footprint.
      const levelRectActive = (b.levelVisuals ?? []).some(v => v.rect && v.minLevel <= activeLevel)
      const renderRects = levelRectActive ? [vis.rect] : allRects
      const isSel = isEntitySelected({ type: 'building', index: bIdx })

      const useArt = showBuildingArt && vis.wall && vis.roof && WALL_TILES[vis.wall as WallMaterial]
      const ox = Math.min(...allRects.map(r => r[0]))
      const oy = Math.max(...allRects.map(r => r[3]))
      const absDoors: BuildingDoorTile[] = (b.doors ?? []).flatMap(d => {
        const absTy = oy + d.ty
        if (allRects.some(r => r[3] + 1 === absTy)) return [{ tx: ox + d.tx, ty: absTy }]
        const candidate = allRects.map(r => r[3] + 1).filter(ty2p1 => ty2p1 > absTy).sort((a, b) => a - b)[0]
        if (candidate !== undefined) return [{ tx: ox + d.tx, ty: candidate, tyAdjust: candidate - absTy }]
        return []
      })
      if (useArt) {
        for (const rect of renderRects) {
          const placements = placeBuildingTiles(rect, vis.wall as WallMaterial, vis.roof as RoofMaterial, absDoors)
          for (const [tileId, positions] of placements) {
            loadTileRef(tileId).then(tex => {
              if (renderVersionRef.current !== version) return
              for (const [tx, ty] of positions) {
                const s = new PIXI.Sprite(tex)
                s.position.set(tx * T, ty * T)
                s.width = T; s.height = T
                buildingLayer.addChild(s)
              }
            }).catch(() => {})
          }
        }
        for (const w of b.windows ?? []) {
          const absTx = ox + w.tx
          const absTy = oy + w.ty + 1  // +1 matches HubTownCanvas window rendering
          loadTileRef(tileNumericId(w.tileId)).then(tex => {
            if (renderVersionRef.current !== version) return
            const s = new PIXI.Sprite(tex)
            s.position.set(absTx * T, absTy * T)
            s.width = T; s.height = T
            buildingLayer.addChild(s)
          }).catch(() => {})
        }
      } else {
        const col = WALL_COLORS[vis.wall ?? ''] ?? 0x556677
        const gfx = new PIXI.Graphics()
        for (const [tx1, ty1, tx2, ty2] of renderRects)
          gfx.rect(tx1 * T, ty1 * T, (tx2 - tx1 + 1) * T, (ty2 - ty1 + 1) * T).fill(col)
        buildingLayer.addChild(gfx)
      }

      if (isSel) {
        for (const [tx1, ty1, tx2, ty2] of renderRects)
          selLayer.rect(tx1 * T, ty1 * T, (tx2 - tx1 + 1) * T, (ty2 - ty1 + 1) * T)
            .stroke({ color: 0xf0c040, width: 2 })
      }
      if (b.id && renderRects[0]) {
        const [tx1, ty1, tx2, ty2] = renderRects[0]
        const lbl = new PIXI.Text({ text: b.id, style: { fontSize: 9, fill: 0xeeeecc, stroke: { color: 0x1a1a1a, width: 2 } } })
        lbl.x = (tx1 + (tx2 - tx1 + 1) / 2) * T - lbl.width / 2
        lbl.y = (ty1 + (ty2 - ty1 + 1) / 2) * T - lbl.height / 2
        buildingLayer.addChild(lbl)
      }
    })

    // Exterior decor tiles
    renderDecorItems(version, flattenDecor(configData.exteriorDecor ?? []),
                     decorBLayer, decorLayer, decorALayer, 'exteriorDecor', '', selLayer)

    // Per-building level decor (revealed by upgrade level; dimmed above active level)
    buildings.forEach((b, bIdx) => {
      renderBuildingLevelDecor(version, bIdx, flattenDecor(b.levelDecor ?? []),
                               decorBLayer, decorLayer, decorALayer, selLayer)
    })

    // Per-building base decor (non-interactive; relative coords resolved to absolute)
    buildings.forEach(b => {
      const bRects = (b.rects ?? (b.rect ? [b.rect] : [])) as [number, number, number, number][]
      if (bRects.length === 0 || (b.decor ?? []).length === 0) return
      const bOx = Math.min(...bRects.map(r => r[0]))
      const bOy = Math.max(...bRects.map(r => r[3]))
      for (const d of b.decor ?? []) {
        if (d.tx === undefined) continue
        const absTx = bOx + d.tx
        const absTy = bOy + (d.ty ?? 0)
        const dimmed = !isVisibleAtLevel({ minLevel: d.minLevel ?? 0, hideAtLevel: d.hideAtLevel }, activeLevel)
        if (d.bundleID) {
          for (const e of expandBundleDecor(d.bundleID, absTx, absTy)) {
            loadTileRef(e.tileId).then(tex => {
              if (renderVersionRef.current !== version) return
              const s = new PIXI.Sprite(tex)
              s.position.set(e.tx * T, e.ty * T)
              s.width = T; s.height = T
              if (dimmed) s.alpha = 0.3
              decorLayer.addChild(s)
            }).catch(() => {})
          }
        } else if (d.tileId) {
          const layer = d.zlayer === 'below' ? decorBLayer : d.zlayer === 'above' ? decorALayer : decorLayer
          loadTileRef(tileNumericId(d.tileId)).then(tex => {
            if (renderVersionRef.current !== version) return
            const s = new PIXI.Sprite(tex)
            s.position.set(absTx * T, absTy * T)
            s.width = T; s.height = T
            if (dimmed) s.alpha = 0.3
            layer.addChild(s)
          }).catch(() => {})
        }
      }
    })

    // Festival decor for the previewed festival (authoring + preview)
    if (previewFestivalId) {
      const group = (configData.festivalDecor ?? []).find(g => g.festivalId === previewFestivalId)
      if (group) renderFestivalDecor(version, previewFestivalId, flattenDecor(group.decor),
                                     decorBLayer, decorLayer, decorALayer, selLayer)
    }

    // NPCs
    const npcs = configData.npcs ?? []
    npcs.forEach((npc, nIdx) => {
      if (npc.building) return
      const isSel = isEntitySelected({ type: 'npc', index: nIdx })
      loadSpriteTexture(resolveNpcSprite(npc.sprite)).then(tex => {
        if (renderVersionRef.current !== version) return
        const sp = new PIXI.Sprite(tex)
        sp.width  = T * 1.5; sp.height = T * 1.5
        sp.x      = npc.tx * T - T * 0.25
        sp.y      = npc.ty * T - T * 0.5
        sp.eventMode = 'static'; sp.cursor = 'pointer'
        sp.on('pointerdown', (e: PIXI.FederatedPointerEvent) =>
          handleEntityPointerDown(e, { type: 'npc', index: nIdx }, npc.tx, npc.ty))
        if (isSel) {
          selLayer.rect(sp.x - 2, sp.y - 2, sp.width + 4, sp.height + 4)
            .stroke({ color: 0xf0c040, width: 2 })
        }
        npcLayer.addChild(sp)
      }).catch(() => {
        if (renderVersionRef.current !== version) return
        const g = new PIXI.Graphics()
        g.circle(npc.tx * T + T / 2, npc.ty * T + T / 2, T / 3).fill(0xff88aa)
        npcLayer.addChild(g)
      })
    })

    // Animals (exterior — no building field)
    ;(configData.animals ?? []).forEach((animal, aIdx) => {
      if (animal.building) return
      const isSel = isEntitySelected({ type: 'animal', index: aIdx })
      const tint = resolveVariantTint(animal.type as AnimalType, animal.variant)
      loadSpriteTexture(`animal-${animal.type}`).then(tex => {
        if (renderVersionRef.current !== version) return
        const sp = new PIXI.Sprite(tex)
        sp.width  = T * 1.5; sp.height = T * 1.5
        sp.x      = animal.tx * T - T * 0.25
        sp.y      = animal.ty * T - T * 0.5
        sp.tint   = tint
        sp.eventMode = 'static'; sp.cursor = 'pointer'
        sp.on('pointerdown', (e: PIXI.FederatedPointerEvent) =>
          handleEntityPointerDown(e, { type: 'animal', index: aIdx }, animal.tx, animal.ty))
        if (isSel) {
          selLayer.rect(sp.x - 2, sp.y - 2, sp.width + 4, sp.height + 4)
            .stroke({ color: 0xf0c040, width: 2 })
        }
        npcLayer.addChild(sp)
      }).catch(() => {
        if (renderVersionRef.current !== version) return
        const g = new PIXI.Graphics()
        g.circle(animal.tx * T + T / 2, animal.ty * T + T / 2, T / 3).fill(0x88ffaa)
        npcLayer.addChild(g)
      })
    })
  }

  // ── Interior rendering ─────────────────────────────────────────────────────────
  type RawInterior = NonNullable<RawMapConfig['interiors']>[string]

  function buildGapSet(width: number, height: number, exits: RawInterior['exits']) {
    const gapSet = new Set<string>()
    for (const exit of exits ?? []) {
      if (exit.direction === 'left')  gapSet.add(`0,${exit.ty}`)
      if (exit.direction === 'right') gapSet.add(`${width - 1},${exit.ty}`)
      if (exit.direction === 'front') gapSet.add(`${exit.tx},${height - 1}`)
      if (exit.direction === 'back')  { gapSet.add(`${exit.tx},0`); gapSet.add(`${exit.tx},1`) }
    }
    return gapSet
  }

  function drawWallsWithGaps(gfx: PIXI.Graphics, width: number, height: number, color: number, gapSet: Set<string>) {
    for (let tx = 0; tx < width; tx++) {
      if (!gapSet.has(`${tx},0`))          gfx.rect(tx * T, 0,              T, T).fill(color)
      if (!gapSet.has(`${tx},1`))          gfx.rect(tx * T, T,              T, T).fill(color)
      if (!gapSet.has(`${tx},${height-1}`)) gfx.rect(tx * T, (height-1) * T, T, T).fill(color)
    }
    for (let ty = 2; ty < height - 1; ty++) {
      if (!gapSet.has(`0,${ty}`))           gfx.rect(0,              ty * T, T, T).fill(color)
      if (!gapSet.has(`${width-1},${ty}`))  gfx.rect((width-1) * T, ty * T, T, T).fill(color)
    }
  }

  function renderWallMaterial(
    version: number,
    wallTileId: string | undefined,
    width: number,
    container: PIXI.Container,
    gapSet: Set<string>,
  ) {
    if (!wallTileId) return
    const wTiles = WALL_TILES[wallTileId as WallMaterial]
    if (!wTiles) return
    const byTile = new Map<number, [number, number][]>()
    for (let tx = 0; tx < width; tx++) {
      if (gapSet.has(`${tx},0`)) continue
      const faceId = tx === 0 ? wTiles.leftBottom : tx === width - 1 ? wTiles.rightBottom : wTiles.middleBottom
      const crownId = tx === 0 ? wTiles.leftTop   : tx === width - 1 ? wTiles.rightTop   : wTiles.middleTop
      ;(byTile.get(faceId)  ?? (byTile.set(faceId,  []), byTile.get(faceId)!)).push([tx,  0])
      ;(byTile.get(crownId) ?? (byTile.set(crownId, []), byTile.get(crownId)!)).push([tx, -1])
    }
    for (const [tileId, positions] of byTile) {
      loadTileRef(tileId).then(tex => {
        if (renderVersionRef.current !== version) return
        for (const [tx, ty] of positions) {
          const sp = new PIXI.Sprite(tex)
          sp.x = tx * T; sp.y = ty * T
          container.addChild(sp)
        }
      }).catch(() => {})
    }
  }

  function renderAdjacentRoom(version: number, room: RawInterior, container: PIXI.Container) {
    const { width, height } = room
    const bg = new PIXI.Graphics()
    bg.rect(0, 0, width * T, height * T).fill(0x5a4a3a)
    container.addChild(bg)
    if (room.floorTileId) {
      const fid = tileNumericId(room.floorTileId)
      loadTileRef(fid).then(tex => {
        if (renderVersionRef.current !== version) return
        for (let tx = 0; tx < width; tx++)
          for (let ty = 0; ty < height; ty++) {
            const sp = new PIXI.Sprite(tex)
            sp.x = tx * T; sp.y = ty * T
            container.addChild(sp)
          }
      }).catch(() => {})
    }
    const gapSet = buildGapSet(width, height, room.exits)
    const wallColor = room.wallTileId ? (WALL_COLORS[room.wallTileId] ?? 0x3a3a4a) : 0x3a3a4a
    const wallGfx = new PIXI.Graphics()
    drawWallsWithGaps(wallGfx, width, height, wallColor, gapSet)
    container.addChild(wallGfx)
    renderWallMaterial(version, room.wallTileId, width, container, gapSet)
  }

  // ── Building editor rendering ──────────────────────────────────────────────────
  function renderBuilding(
    version: number,
    groundLayer: PIXI.Container, buildingLayer: PIXI.Container,
    decorBLayer: PIXI.Container, decorLayer: PIXI.Container, decorALayer: PIXI.Container,
    selLayer: PIXI.Graphics,
  ) {
    if (!activeBuilding) return
    const b = activeBuilding
    const bIdx = activeBuildingIndex!
    const allRects = buildingAllRects
    const ox = Math.min(...allRects.map(r => r[0]))
    const oy = Math.max(...allRects.map(r => r[3]))

    // Surround fill (dark ground)
    const canvasW = (bMaxX - bMinX + 1 + BUILDING_PAD * 2) * T
    const canvasH = (bMaxY - bMinY + 1 + BUILDING_PAD * 2) * T
    const bg = new PIXI.Graphics()
    bg.rect(bMinX * T - BUILDING_PAD * T, bMinY * T - BUILDING_PAD * T, canvasW, canvasH).fill(0x1a2030)
    groundLayer.addChild(bg)

    // Building tiles
    const useArt = showBuildingArt && b.wall && b.roof && WALL_TILES[b.wall as WallMaterial]
    const absDoors: BuildingDoorTile[] = (b.doors ?? []).flatMap(d => {
      const absTy = oy + d.ty
      if (allRects.some(r => r[3] + 1 === absTy)) return [{ tx: ox + d.tx, ty: absTy }]
      const candidate = allRects.map(r => r[3] + 1).filter(ty2p1 => ty2p1 > absTy).sort((a, c) => a - c)[0]
      if (candidate !== undefined) return [{ tx: ox + d.tx, ty: candidate, tyAdjust: candidate - absTy }]
      return []
    })

    if (useArt) {
      for (const rect of allRects) {
        const placements = placeBuildingTiles(rect, b.wall as WallMaterial, b.roof as RoofMaterial, absDoors)
        for (const [tileId, positions] of placements) {
          loadTileRef(tileId).then(tex => {
            if (renderVersionRef.current !== version) return
            for (const [tx, ty] of positions) {
              const s = new PIXI.Sprite(tex)
              s.position.set(tx * T, ty * T)
              s.width = T; s.height = T
              buildingLayer.addChild(s)
            }
          }).catch(() => {})
        }
      }
      for (const w of b.windows ?? []) {
        const absTx = ox + w.tx
        const absTy = oy + w.ty + 1
        loadTileRef(tileNumericId(w.tileId)).then(tex => {
          if (renderVersionRef.current !== version) return
          const s = new PIXI.Sprite(tex)
          s.position.set(absTx * T, absTy * T)
          s.width = T; s.height = T
          buildingLayer.addChild(s)
        }).catch(() => {})
      }
    } else {
      const col = WALL_COLORS[b.wall ?? ''] ?? 0x556677
      const gfx = new PIXI.Graphics()
      for (const [tx1, ty1, tx2, ty2] of allRects)
        gfx.rect(tx1 * T, ty1 * T, (tx2 - tx1 + 1) * T, (ty2 - ty1 + 1) * T).fill(col)
      buildingLayer.addChild(gfx)
    }

    // Doors — interactive hit zones at their rendered positions
    for (let di = 0; di < (b.doors ?? []).length; di++) {
      const d = b.doors![di]
      const absTx = ox + d.tx
      const absTy = oy + d.ty  // rendered tile row (south face + 1)
      const entity: SelectedEntity = { type: 'buildingDoor', buildingIndex: bIdx, index: di }
      const isSel = isEntitySelected(entity)
      const hitGfx = new PIXI.Graphics()
      hitGfx.rect(absTx * T, absTy * T, T, T).fill({ color: 0xffffff, alpha: 0.01 })
      hitGfx.eventMode = 'static'; hitGfx.cursor = 'pointer'
      hitGfx.on('pointerdown', (e: PIXI.FederatedPointerEvent) => handleEntityPointerDown(e, entity, absTx, absTy))
      buildingLayer.addChild(hitGfx)
      if (isSel) selLayer.rect(absTx * T - 1, absTy * T - 1, T + 2, T + 2).stroke({ color: 0xf0c040, width: 2 })
    }

    // Windows — interactive
    if (useArt) {
      for (let wi = 0; wi < (b.windows ?? []).length; wi++) {
        const w = b.windows![wi]
        const absTx = ox + w.tx
        const absTy = oy + w.ty + 1
        const entity: SelectedEntity = { type: 'buildingWindow', buildingIndex: bIdx, index: wi }
        const isSel = isEntitySelected(entity)
        const hitGfx = new PIXI.Graphics()
        hitGfx.rect(absTx * T, absTy * T, T, T).fill({ color: 0xffffff, alpha: 0.01 })
        hitGfx.eventMode = 'static'; hitGfx.cursor = 'pointer'
        hitGfx.on('pointerdown', (e: PIXI.FederatedPointerEvent) => handleEntityPointerDown(e, entity, absTx, absTy))
        buildingLayer.addChild(hitGfx)
        if (isSel) selLayer.rect(absTx * T - 1, absTy * T - 1, T + 2, T + 2).stroke({ color: 0xf0c040, width: 2 })
      }
    }

    // Base decor (b.decor) — interactive
    for (let di = 0; di < (b.decor ?? []).length; di++) {
      const d = b.decor![di]
      if (d.tx === undefined) continue
      const absTx = ox + d.tx
      const absTy = oy + (d.ty ?? 0)
      const entity: SelectedEntity = { type: 'buildingDecor', buildingIndex: bIdx, index: di }
      const isSel = isEntitySelected(entity)
      const dimmed = !isVisibleAtLevel({ minLevel: d.minLevel ?? 0, hideAtLevel: d.hideAtLevel }, activeLevel)
      const layer = d.zlayer === 'below' ? decorBLayer : d.zlayer === 'above' ? decorALayer : decorLayer
      if (d.bundleID) {
        for (const e of expandBundleDecor(d.bundleID, absTx, absTy)) {
          loadTileRef(e.tileId).then(tex => {
            if (renderVersionRef.current !== version) return
            const s = new PIXI.Sprite(tex)
            s.position.set(e.tx * T, e.ty * T)
            s.width = T; s.height = T
            if (dimmed) s.alpha = 0.3
            s.eventMode = 'static'; s.cursor = 'pointer'
            s.on('pointerdown', (ev: PIXI.FederatedPointerEvent) => handleEntityPointerDown(ev, entity, absTx, absTy))
            decorLayer.addChild(s)
          }).catch(() => {})
        }
      } else if (d.tileId) {
        loadTileRef(tileNumericId(d.tileId)).then(tex => {
          if (renderVersionRef.current !== version) return
          const s = new PIXI.Sprite(tex)
          s.position.set(absTx * T, absTy * T)
          s.width = T; s.height = T
          if (dimmed) s.alpha = 0.3
          s.eventMode = 'static'; s.cursor = 'pointer'
          s.on('pointerdown', (ev: PIXI.FederatedPointerEvent) => handleEntityPointerDown(ev, entity, absTx, absTy))
          layer.addChild(s)
        }).catch(() => {})
      }
      if (isSel) selLayer.rect(absTx * T - 1, absTy * T - 1, T + 2, T + 2).stroke({ color: 0xf0c040, width: 2 })
    }

    // Level decor — interactive (reuse existing buildingLevelDecor entity type)
    renderBuildingLevelDecor(version, bIdx, flattenDecor(b.levelDecor ?? []),
                             decorBLayer, decorLayer, decorALayer, selLayer)
  }

  function renderInterior(
    version: number,
    groundLayer: PIXI.Container,
    decorBLayer: PIXI.Container, decorLayer: PIXI.Container, decorALayer: PIXI.Container,
    npcLayer: PIXI.Container,
    questLayer: PIXI.Container,
    selLayer: PIXI.Graphics,
  ) {
    if (!interior) return
    const { width, height } = interior
    const cfg = propsRef.current.configData
    const iid = activeInteriorId ?? ''

    // ── Adjacent rooms (dimmed) ────────────────────────────────────────────────
    // Collect forward exits (exits defined on this room) and reverse links (rooms that exit here)
    const seen = new Set<string>()
    const adjRooms: { room: RawInterior; ox: number; oy: number }[] = []

    function addAdj(id: string, room: RawInterior, ox: number, oy: number) {
      if (seen.has(id)) return
      seen.add(id)
      adjRooms.push({ room, ox, oy })
    }

    for (const exit of interior.exits ?? []) {
      const adj = cfg.interiors?.[exit.toInteriorId]
      if (!adj || exit.toInteriorId === iid || !exit.direction) continue
      const entryTx = exit.entryTx ?? Math.floor(adj.width / 2)
      const entryTy = exit.entryTy ?? (adj.height - 2)
      let ox = 0, oy = 0
      if      (exit.direction === 'right') { ox = (width    - entryTx) * T; oy = (exit.ty - entryTy) * T }
      else if (exit.direction === 'left')  { ox = -(1 + entryTx)      * T; oy = (exit.ty - entryTy) * T }
      else if (exit.direction === 'up')    { ox = (exit.tx - entryTx) * T; oy = -(1 + entryTy)      * T }
      else if (exit.direction === 'down')  { ox = (exit.tx - entryTx) * T; oy = (height   - entryTy) * T }
      else if (exit.direction === 'front') { ox = (exit.tx - entryTx) * T; oy = (height   - entryTy) * T }
      else if (exit.direction === 'back')  { ox = (exit.tx - entryTx) * T; oy = -(1 + entryTy)      * T }
      addAdj(exit.toInteriorId, adj, ox, oy)
    }

    for (const [id, room] of Object.entries(cfg.interiors ?? {})) {
      if (id === iid) continue
      for (const exit of room.exits ?? []) {
        if (exit.toInteriorId !== iid || !exit.direction) continue
        const entryTx = exit.entryTx ?? Math.floor(width / 2)
        const entryTy = exit.entryTy ?? (height - 2)
        let ox = 0, oy = 0
        if      (exit.direction === 'right') { ox = (entryTx - room.width)  * T; oy = (entryTy - exit.ty) * T }
        else if (exit.direction === 'left')  { ox = (entryTx + 1)           * T; oy = (entryTy - exit.ty) * T }
        else if (exit.direction === 'up')    { ox = (entryTx - exit.tx)     * T; oy = (entryTy + 1)       * T }
        else if (exit.direction === 'down')  { ox = (entryTx - exit.tx)     * T; oy = (entryTy - room.height) * T }
        else if (exit.direction === 'front') { ox = (entryTx - exit.tx)     * T; oy = (entryTy - room.height) * T }
        else if (exit.direction === 'back')  { ox = (entryTx - exit.tx)     * T; oy = (entryTy + 1)           * T }
        addAdj(id, room, ox, oy)
      }
    }

    for (const { room, ox, oy } of adjRooms) {
      const c = new PIXI.Container()
      c.alpha = 0.28
      c.x = ox; c.y = oy
      groundLayer.addChild(c)
      renderAdjacentRoom(version, room, c)
    }

    // ── Current room ──────────────────────────────────────────────────────────
    const floorGfx = new PIXI.Graphics()
    floorGfx.rect(0, 0, width * T, height * T).fill(0x5a4a3a)
    groundLayer.addChild(floorGfx)

    // Compute gapSet before async floor load so the closure can use it
    const gapSet = buildGapSet(width, height, interior.exits)

    // Floor tiles — skip wall-edge positions unless they're a doorway gap
    if (interior.floorTileId) {
      const fid = tileNumericId(interior.floorTileId)
      loadTileRef(fid).then(tex => {
        if (renderVersionRef.current !== version) return
        for (let tx = 0; tx < width; tx++) {
          for (let ty = 0; ty < height; ty++) {
            const isEdge = ty <= 1 || ty >= height - 1 || tx === 0 || tx === width - 1
            if (isEdge && !gapSet.has(`${tx},${ty}`)) continue
            const sp = new PIXI.Sprite(tex)
            sp.x = tx * T; sp.y = ty * T
            groundLayer.addChild(sp)
          }
        }
      }).catch(() => {})
    }

    // Walls with gaps at directional exits
    const wallColor = interior.wallTileId ? (WALL_COLORS[interior.wallTileId] ?? 0x3a3a4a) : 0x3a3a4a
    const wallGfx = new PIXI.Graphics()
    drawWallsWithGaps(wallGfx, width, height, wallColor, gapSet)
    groundLayer.addChild(wallGfx)
    renderWallMaterial(version, interior.wallTileId, width, groundLayer, gapSet)

    // Green outlines on up/down exit tiles so they're easy to spot and click
    const exitOverlay = new PIXI.Graphics()
    for (const exit of interior.exits ?? []) {
      if (exit.direction === 'up' || exit.direction === 'down') {
        exitOverlay.rect(exit.tx * T + 1, exit.ty * T + 1, T - 2, T - 2).stroke({ width: 2, color: 0x44ff44 })
      }
    }
    groundLayer.addChild(exitOverlay)

    renderDecorItems(version, flattenDecor(interior.decor),
                     decorBLayer, decorLayer, decorALayer, 'interiorDecor', iid, selLayer)

    // ── Interior NPCs ────────────────────────────────────────────────────────
    ;(configData.npcs ?? []).forEach((npc, nIdx) => {
      if (npc.building !== iid) return
      const isSel = isEntitySelected({ type: 'npc', index: nIdx })
      const dimmed = !isVisibleAtLevel(npc, activeLevel)  // NPC absent at this upgrade level (below minLevel or past hideAtLevel)
      loadSpriteTexture(resolveNpcSprite(npc.sprite)).then(tex => {
        if (renderVersionRef.current !== version) return
        const sp = new PIXI.Sprite(tex)
        sp.width = T * 1.5; sp.height = T * 1.5
        sp.x = npc.tx * T - T * 0.25
        sp.y = npc.ty * T - T * 0.5
        if (dimmed) sp.alpha = 0.3
        sp.eventMode = 'static'; sp.cursor = 'pointer'
        sp.on('pointerdown', (e: PIXI.FederatedPointerEvent) =>
          handleEntityPointerDown(e, { type: 'npc', index: nIdx }, npc.tx, npc.ty))
        if (isSel) selLayer.rect(sp.x - 2, sp.y - 2, sp.width + 4, sp.height + 4).stroke({ color: 0xf0c040, width: 2 })
        npcLayer.addChild(sp)
      }).catch(() => {
        if (renderVersionRef.current !== version) return
        const g = new PIXI.Graphics()
        g.circle(npc.tx * T + T / 2, npc.ty * T + T / 2, T / 3).fill(0xff88aa)
        npcLayer.addChild(g)
      })
    })

    // Interior animals
    ;(configData.animals ?? []).forEach((animal, aIdx) => {
      if (animal.building !== iid) return
      const isSel = isEntitySelected({ type: 'animal', index: aIdx })
      const tint = resolveVariantTint(animal.type as AnimalType, animal.variant)
      loadSpriteTexture(`animal-${animal.type}`).then(tex => {
        if (renderVersionRef.current !== version) return
        const sp = new PIXI.Sprite(tex)
        sp.width  = T * 1.5; sp.height = T * 1.5
        sp.x      = animal.tx * T - T * 0.25
        sp.y      = animal.ty * T - T * 0.5
        sp.tint   = tint
        sp.eventMode = 'static'; sp.cursor = 'pointer'
        sp.on('pointerdown', (e: PIXI.FederatedPointerEvent) =>
          handleEntityPointerDown(e, { type: 'animal', index: aIdx }, animal.tx, animal.ty))
        if (isSel) {
          selLayer.rect(sp.x - 2, sp.y - 2, sp.width + 4, sp.height + 4)
            .stroke({ color: 0xf0c040, width: 2 })
        }
        npcLayer.addChild(sp)
      }).catch(() => {
        if (renderVersionRef.current !== version) return
        const g = new PIXI.Graphics()
        g.circle(animal.tx * T + T / 2, animal.ty * T + T / 2, T / 3).fill(0x88ffaa)
        npcLayer.addChild(g)
      })
    })

    // ── Interior quest items ─────────────────────────────────────────────────
    if (showQuestItems) {
      const renderQuestItem = (
        itemTx: number, itemTy: number, tileId: string,
        entity: SelectedEntity, tintColor: number,
      ) => {
        const isSel = isEntitySelected(entity)
        const handler = (e: PIXI.FederatedPointerEvent) => handleEntityPointerDown(e, entity, itemTx, itemTy)
        const border = new PIXI.Graphics()
        border.rect(itemTx * T, itemTy * T, T, T).stroke({ color: tintColor, width: 2 })
        border.eventMode = 'static'; border.cursor = 'pointer'
        border.on('pointerdown', handler)
        questLayer.addChild(border)
        if (isSel) selLayer.rect(itemTx * T - 2, itemTy * T - 2, T + 4, T + 4).stroke({ color: 0xf0c040, width: 2 })
        loadTileRef(tileNumericId(tileId)).then(tex => {
          if (renderVersionRef.current !== version) return
          const sp = new PIXI.Sprite(tex)
          sp.x = itemTx * T; sp.y = itemTy * T
          sp.tint = tintColor
          sp.eventMode = 'static'; sp.cursor = 'pointer'
          sp.on('pointerdown', handler)
          questLayer.addChild(sp)
          questLayer.addChild(border)
        }).catch(() => {})
      }
      ;(configData.treasures ?? []).forEach((t, i) => {
        if (t.buildingId === iid) renderQuestItem(t.tx, t.ty, t.tileId, { type: 'treasure', index: i }, 0xf0c040)
      })
      questPickupItems.forEach((p, i) => {
        if (p.building === iid) renderQuestItem(p.tx, p.ty, p.tileId, { type: 'pickupItem', index: i }, 0x40d0f0)
      })
    }
  }

  // ── Decor tile rendering ───────────────────────────────────────────────────────
  function renderDecorItems(
    version: number,
    items: FlatDecorItem[],
    decorBLayer: PIXI.Container, decorLayer: PIXI.Container, decorALayer: PIXI.Container,
    entityType: 'exteriorDecor' | 'interiorDecor',
    interiorId: string,
    selLayer: PIXI.Graphics,
  ) {
    items.forEach(({ tx, ty, tileId, zlayer, sourceIndex, minLevel, hideAtLevel }) => {
      const numId = tileNumericId(tileId)
      const layer = zlayer === 'below' ? decorBLayer : zlayer === 'above' ? decorALayer : decorLayer
      const dimmed = !isVisibleAtLevel({ minLevel, hideAtLevel }, activeLevel)  // absent at this upgrade level
      const entity: SelectedEntity = entityType === 'exteriorDecor'
        ? { type: 'exteriorDecor', index: sourceIndex }
        : { type: 'interiorDecor', index: sourceIndex, interiorId }
      const isSel = isEntitySelected(entity)

      loadTileRef(numId).then(tex => {
        if (renderVersionRef.current !== version) return
        const sp = new PIXI.Sprite(tex)
        sp.x = tx * T; sp.y = ty * T
        if (dimmed) sp.alpha = 0.3
        sp.eventMode = 'static'; sp.cursor = 'pointer'
        sp.on('pointerdown', (e: PIXI.FederatedPointerEvent) =>
          handleEntityPointerDown(e, entity, tx, ty))
        if (isSel) {
          selLayer.rect(tx * T - 1, ty * T - 1, T + 2, T + 2)
            .stroke({ color: 0xf0c040, width: 2 })
        }
        layer.addChild(sp)
      }).catch(() => {
        if (renderVersionRef.current !== version) return
        const g = new PIXI.Graphics()
        g.rect(tx * T + 4, ty * T + 4, T - 8, T - 8).fill(0x884422)
        layer.addChild(g)
      })
    })
  }

  // ── Building level-decor rendering (exterior, per-building, level-gated) ───────
  function renderBuildingLevelDecor(
    version: number,
    buildingIndex: number,
    items: FlatDecorItem[],
    decorBLayer: PIXI.Container, decorLayer: PIXI.Container, decorALayer: PIXI.Container,
    selLayer: PIXI.Graphics,
  ) {
    items.forEach(({ tx, ty, tileId, zlayer, sourceIndex, minLevel, hideAtLevel }) => {
      const numId = tileNumericId(tileId)
      const layer = zlayer === 'below' ? decorBLayer : zlayer === 'above' ? decorALayer : decorLayer
      const dimmed = !isVisibleAtLevel({ minLevel, hideAtLevel }, activeLevel)
      const entity: SelectedEntity = { type: 'buildingLevelDecor', buildingIndex, index: sourceIndex }
      const isSel = isEntitySelected(entity)

      loadTileRef(numId).then(tex => {
        if (renderVersionRef.current !== version) return
        const sp = new PIXI.Sprite(tex)
        sp.x = tx * T; sp.y = ty * T
        if (dimmed) sp.alpha = 0.3
        sp.eventMode = 'static'; sp.cursor = 'pointer'
        sp.on('pointerdown', (e: PIXI.FederatedPointerEvent) =>
          handleEntityPointerDown(e, entity, tx, ty))
        if (isSel) {
          selLayer.rect(tx * T - 1, ty * T - 1, T + 2, T + 2).stroke({ color: 0xf0c040, width: 2 })
        }
        layer.addChild(sp)
      }).catch(() => {
        if (renderVersionRef.current !== version) return
        const g = new PIXI.Graphics()
        g.rect(tx * T + 4, ty * T + 4, T - 8, T - 8).fill(0x884422)
        if (dimmed) g.alpha = 0.3
        layer.addChild(g)
      })
    })
  }

  // ── Festival decor rendering (exterior, date-gated; here shown for preview) ────
  function renderFestivalDecor(
    version: number,
    festivalId: string,
    items: FlatDecorItem[],
    decorBLayer: PIXI.Container, decorLayer: PIXI.Container, decorALayer: PIXI.Container,
    selLayer: PIXI.Graphics,
  ) {
    items.forEach(({ tx, ty, tileId, zlayer, sourceIndex }) => {
      const numId = tileNumericId(tileId)
      const layer = zlayer === 'below' ? decorBLayer : zlayer === 'above' ? decorALayer : decorLayer
      const entity: SelectedEntity = { type: 'festivalDecor', festivalId, index: sourceIndex }
      const isSel = isEntitySelected(entity)
      loadTileRef(numId).then(tex => {
        if (renderVersionRef.current !== version) return
        const sp = new PIXI.Sprite(tex)
        sp.x = tx * T; sp.y = ty * T
        sp.eventMode = 'static'; sp.cursor = 'pointer'
        sp.on('pointerdown', (e: PIXI.FederatedPointerEvent) =>
          handleEntityPointerDown(e, entity, tx, ty))
        if (isSel) selLayer.rect(tx * T - 1, ty * T - 1, T + 2, T + 2).stroke({ color: 0xf0c040, width: 2 })
        layer.addChild(sp)
      }).catch(() => {
        if (renderVersionRef.current !== version) return
        const g = new PIXI.Graphics()
        g.rect(tx * T + 4, ty * T + 4, T - 8, T - 8).fill(0xc080d0)
        layer.addChild(g)
      })
    })
  }

  // ── Quest items (treasures + pickupItems) rendering ───────────────────────────
  function renderQuestItems(version: number, questLayer: PIXI.Container, selLayer: PIXI.Graphics) {
    const TREASURE_COLOR = 0xf0c040
    const PICKUP_COLOR   = 0x40d0f0

    const renderItem = (
      itemTx: number, itemTy: number, tileId: string,
      entity: SelectedEntity, tintColor: number,
    ) => {
      const isSel = isEntitySelected(entity)
      const numId = tileNumericId(tileId)
      const handler = (e: PIXI.FederatedPointerEvent) => handleEntityPointerDown(e, entity, itemTx, itemTy)

      // Immediate border (visible before sprite loads)
      const border = new PIXI.Graphics()
      border.rect(itemTx * T, itemTy * T, T, T).stroke({ color: tintColor, width: 2 })
      border.eventMode = 'static'; border.cursor = 'pointer'
      border.on('pointerdown', handler)
      questLayer.addChild(border)

      if (isSel) {
        selLayer.rect(itemTx * T - 2, itemTy * T - 2, T + 4, T + 4)
          .stroke({ color: 0xf0c040, width: 2 })
      }

      loadTileRef(numId).then(tex => {
        if (renderVersionRef.current !== version) return
        const sp = new PIXI.Sprite(tex)
        sp.x = itemTx * T; sp.y = itemTy * T
        sp.tint = tintColor
        sp.eventMode = 'static'; sp.cursor = 'pointer'
        sp.on('pointerdown', handler)
        questLayer.addChild(sp)
        questLayer.addChild(border) // keep border on top of sprite
      }).catch(() => {})
    }

    ;(configData.treasures ?? []).forEach((t, i) => {
      if (!t.buildingId) renderItem(t.tx, t.ty, t.tileId, { type: 'treasure', index: i }, TREASURE_COLOR)
    })
    // Quest pickup items come from questDefs.json (passed via prop), not configData
    questPickupItems.forEach((p, i) => {
      if (!p.building) renderItem(p.tx, p.ty, p.tileId, { type: 'pickupItem', index: i }, PICKUP_COLOR)
    })
  }

  // ── Areas overlay ──────────────────────────────────────────────────────────────
  function renderAreasOverlay(layer: PIXI.Container, selLayer: PIXI.Graphics) {
    const { configData: cfg } = propsRef.current
    ;(cfg.areas ?? []).forEach((area, aIdx) => {
      const isSel = isEntitySelected({ type: 'area', index: aIdx })
      const gfx = new PIXI.Graphics()
      gfx.rect(area.tx * T, area.ty * T, area.tw * T, area.th * T)
        .fill({ color: 0x8855cc, alpha: 0.12 })
        .stroke({ color: isSel ? 0xf0c040 : 0xaa66ff, width: isSel ? 2 : 1 })
      gfx.eventMode = 'static'; gfx.cursor = 'pointer'
      gfx.on('pointerdown', (e: PIXI.FederatedPointerEvent) =>
        handleEntityPointerDown(e, { type: 'area', index: aIdx }, area.tx, area.ty))
      layer.addChild(gfx)
      const lbl = new PIXI.Text({ text: area.name, style: { fontSize: 9, fill: isSel ? 0xf0c040 : 0xaa66ff } })
      lbl.x = area.tx * T + 4; lbl.y = area.ty * T + 4
      layer.addChild(lbl)
    })
  }

  // ── Chicken zones overlay (always visible in exterior) ─────────────────────────
  function renderChickenZonesOverlay(layer: PIXI.Container, selLayer: PIXI.Graphics) {
    ;(propsRef.current.configData.chickenZones ?? []).forEach((zone, zIdx) => {
      const isSel = isEntitySelected({ type: 'chickenZone', index: zIdx })
      const [x1, y1, x2, y2] = zone.rect
      const gfx = new PIXI.Graphics()
      gfx.rect(x1 * T, y1 * T, (x2 - x1 + 1) * T, (y2 - y1 + 1) * T)
        .fill({ color: 0xffaa00, alpha: 0.10 })
        .stroke({ color: isSel ? 0xf0c040 : 0xffaa00, width: isSel ? 2 : 1 })
      gfx.eventMode = 'static'; gfx.cursor = 'pointer'
      gfx.on('pointerdown', (e: PIXI.FederatedPointerEvent) =>
        handleEntityPointerDown(e, { type: 'chickenZone', index: zIdx }, x1, y1))
      layer.addChild(gfx)
      const lbl = new PIXI.Text({ text: `🐔×${zone.count ?? 1}`, style: { fontSize: 9, fill: isSel ? 0xf0c040 : 0xffaa00 } })
      lbl.x = x1 * T + 4; lbl.y = y1 * T + 4
      layer.addChild(lbl)
    })
  }

  // ── Interactables overlay ──────────────────────────────────────────────────────
  function renderInteractablesOverlay(version: number, layer: PIXI.Container, selLayer: PIXI.Graphics) {
    const { configData: cfg } = propsRef.current
    const iid = activeInteriorId ?? ''
    ;(cfg.interactables ?? []).forEach((it, idx) => {
      // Exterior view shows world interactables; interior view shows those owned by the open room.
      if (isInterior ? it.building !== iid : !!it.building) return
      const isSel = isEntitySelected({ type: 'interactable', index: idx })
      // Render the owned decor tiles (so the object is visible like in-game).
      for (const d of it.decor ?? []) {
        const numId = tileNumericId(d.tileId)
        loadTileRef(numId).then(tex => {
          if (renderVersionRef.current !== version) return
          const sp = new PIXI.Sprite(tex)
          sp.x = (it.tx + d.dx) * T; sp.y = (it.ty + d.dy) * T
          sp.width = T; sp.height = T
          layer.addChild(sp)
        }).catch(() => {})
      }
      // Hit-rect box (purple) + click target.
      const w = it.hitRect?.w ?? (it.decor && it.decor.length ? Math.max(...it.decor.map(d => d.dx)) + 1 : 1)
      const h = it.hitRect?.h ?? (it.decor && it.decor.length ? Math.max(...it.decor.map(d => d.dy)) + 1 : 1)
      const gfx = new PIXI.Graphics()
      gfx.rect(it.tx * T, it.ty * T, w * T, h * T)
        .fill({ color: 0x33bbee, alpha: 0.10 })
        .stroke({ color: isSel ? 0xf0c040 : 0x33bbee, width: isSel ? 2 : 1 })
      gfx.eventMode = 'static'; gfx.cursor = 'pointer'
      gfx.on('pointerdown', (e: PIXI.FederatedPointerEvent) =>
        handleEntityPointerDown(e, { type: 'interactable', index: idx }, it.tx, it.ty))
      layer.addChild(gfx)
      const lbl = new PIXI.Text({ text: it.id, style: { fontSize: 8, fill: isSel ? 0xf0c040 : 0x66ccff } })
      lbl.x = it.tx * T + 2; lbl.y = it.ty * T + 2
      layer.addChild(lbl)
    })
  }

  // ── Blocked paths / locked doors overlay ──────────────────────────────────────
  function renderBlockedPathsOverlay(layer: PIXI.Container, selLayer: PIXI.Graphics) {
    const { blockedPaths: bps, configData: cfg } = propsRef.current

    // Blocked path tiles — red overlay
    bps.forEach((bp, bpIdx) => {
      const isSel = isEntitySelected({ type: 'blockedPath', index: bpIdx })
      const gfx = new PIXI.Graphics()
      for (const [btx, bty] of bp.blockedTiles) {
        gfx.rect(btx * T, bty * T, T, T).fill({ color: 0xff3300, alpha: 0.35 })
        gfx.rect(btx * T, bty * T, T, T).stroke({ color: 0xff6644, width: 1 })
        if (isSel) {
          selLayer.rect(btx * T - 2, bty * T - 2, T + 4, T + 4).stroke({ color: 0xf0c040, width: 2 })
        }
      }
      gfx.eventMode = 'static'; gfx.cursor = 'pointer'
      gfx.on('pointerdown', () => propsRef.current.onSelectEntities([{ type: 'blockedPath', index: bpIdx }]))
      layer.addChild(gfx)
      // Label: questId above first tile
      if (bp.blockedTiles[0]) {
        const [btx, bty] = bp.blockedTiles[0]
        const lbl = new PIXI.Text({ text: bp.questId || bp.id, style: { fontSize: 8, fill: isSel ? 0xf0c040 : 0xff9977 } })
        lbl.x = btx * T + 2; lbl.y = bty * T + 2
        layer.addChild(lbl)
      }
    })

    // Locked doors — orange outline on buildings
    const lockedDoors = cfg.lockedDoors ?? []
    lockedDoors.forEach((door, dIdx) => {
      const isSel = isEntitySelected({ type: 'lockedDoor', index: dIdx })
      const bIdx = (cfg.buildings ?? []).findIndex(b => b.id === door.buildingId)
      if (bIdx < 0) return
      const b = cfg.buildings![bIdx]
      const rects = b.rects ?? (b.rect ? [b.rect] : [])
      const borderColor = isSel ? 0xf0c040 : 0xffaa00
      for (const [tx1, ty1, tx2, ty2] of rects) {
        const gfx = new PIXI.Graphics()
        gfx.rect(tx1 * T, ty1 * T, (tx2 - tx1 + 1) * T, (ty2 - ty1 + 1) * T)
          .stroke({ color: borderColor, width: 2, alpha: 0.9 })
        gfx.eventMode = 'static'; gfx.cursor = 'pointer'
        gfx.on('pointerdown', () => propsRef.current.onSelectEntities([{ type: 'lockedDoor', index: dIdx }]))
        layer.addChild(gfx)
      }
      // Lock label
      if (rects[0]) {
        const [tx1, ty1] = rects[0]
        const lbl = new PIXI.Text({ text: `🔒 ${door.lockedBy}`, style: { fontSize: 8, fill: isSel ? 0xf0c040 : 0xffaa00 } })
        lbl.x = tx1 * T + 2; lbl.y = ty1 * T + 2
        layer.addChild(lbl)
      }
    })
  }

  // ── Grid overlay ───────────────────────────────────────────────────────────────
  function drawGrid(gfx: PIXI.Graphics) {
    const wTiles = Math.ceil(mapW / T)
    const hTiles = Math.ceil(mapH / T)
    for (let x = 0; x <= wTiles; x++)
      gfx.moveTo(x * T, 0).lineTo(x * T, hTiles * T).stroke({ color: 0x333355, width: 0.5, alpha: 0.4 })
    for (let y = 0; y <= hTiles; y++)
      gfx.moveTo(0, y * T).lineTo(wTiles * T, y * T).stroke({ color: 0x333355, width: 0.5, alpha: 0.4 })
  }

  // ── Selection highlight ────────────────────────────────────────────────────────
  function drawSelection(gfx: PIXI.Graphics) {
    for (const selectedEntity of selectedEntities) {
      if (selectedEntity.type === 'street') {
        const entry = configData.streets?.[selectedEntity.index]
        if (entry?.rect) {
          const [tx1, ty1, tx2, ty2] = entry.rect
          gfx.rect(tx1 * T - 2, ty1 * T - 2, (tx2 - tx1 + 1) * T + 4, (ty2 - ty1 + 1) * T + 4)
            .stroke({ color: 0xf0c040, width: 2 })
        } else if (entry?.tile) {
          gfx.rect(entry.tile[0] * T - 2, entry.tile[1] * T - 2, T + 4, T + 4)
            .stroke({ color: 0xf0c040, width: 2 })
        }
        continue
      }
      let tx = -1, ty = -1
      if (selectedEntity.type === 'exteriorDecor') {
        const item = configData.exteriorDecor?.[selectedEntity.index]
        if (item?.tx !== undefined) { tx = item.tx; ty = item.ty ?? 0 }
      } else if (selectedEntity.type === 'npc') {
        const npc = configData.npcs?.[selectedEntity.index]
        if (npc) { tx = npc.tx; ty = npc.ty }
      } else if (selectedEntity.type === 'animal') {
        const a = configData.animals?.[selectedEntity.index]
        if (a) { tx = a.tx; ty = a.ty }
      } else if (selectedEntity.type === 'treasure') {
        const t = configData.treasures?.[selectedEntity.index]
        if (t) { tx = t.tx; ty = t.ty }
      } else if (selectedEntity.type === 'pickupItem') {
        const p = configData.pickupItems?.[selectedEntity.index]
        if (p) { tx = p.tx; ty = p.ty }
      } else if (selectedEntity.type === 'npcSpawnTile') {
        const s = configData.npcSpawnTiles?.[selectedEntity.index]
        if (s) { tx = s[0]; ty = s[1] }
      } else if (selectedEntity.type === 'interiorDecor' && selectedEntity.interiorId === activeInteriorId) {
        const item = configData.interiors?.[selectedEntity.interiorId]?.decor[selectedEntity.index]
        if (item?.tx !== undefined) { tx = item.tx; ty = item.ty ?? 0 }
      } else if (selectedEntity.type === 'area') {
        const area = configData.areas?.[selectedEntity.index]
        if (area) {
          gfx.rect(area.tx * T - 2, area.ty * T - 2, area.tw * T + 4, area.th * T + 4)
            .stroke({ color: 0xf0c040, width: 2 })
        }
        continue
      } else if (selectedEntity.type === 'lockedDoor') {
        const door = configData.lockedDoors?.[selectedEntity.index]
        if (door) {
          const b = (configData.buildings ?? []).find(bd => bd.id === door.buildingId)
          if (b) {
            const rects = b.rects ?? (b.rect ? [b.rect] : [])
            for (const [tx1, ty1, tx2, ty2] of rects)
              gfx.rect(tx1 * T - 2, ty1 * T - 2, (tx2 - tx1 + 1) * T + 4, (ty2 - ty1 + 1) * T + 4)
                .stroke({ color: 0xf0c040, width: 2 })
          }
        }
        continue
      }
      // blockedPath, pondTile, npcSpawnTile, chickenZone etc. draw their own
      // highlight inline in their render functions.
      if (tx >= 0) {
        gfx.rect(tx * T - 2, ty * T - 2, T + 4, T + 4).stroke({ color: 0xf0c040, width: 2 })
      }
    }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#0a0a1a', position: 'relative' }}>
      <div ref={containerRef} style={{ display: 'inline-block' }} />
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function hitTest(
  cfg: RawMapConfig, tx: number, ty: number,
  viewMode: string, activeInteriorId: string | null, activeBuildingIndex: number | null,
  showQuestItems = false,
  showBlockedPaths = false,
  blockedPaths: RawBlockedPath[] = [],
  showAreas = false,
  showInteractables = false,
): SelectedEntity | null {
  if (viewMode === 'building' && activeBuildingIndex != null) {
    const b = cfg.buildings?.[activeBuildingIndex]
    if (!b) return null
    const allRects = (b.rects ?? (b.rect ? [b.rect] : [])) as [number, number, number, number][]
    const ox = Math.min(...allRects.map(r => r[0]))
    const oy = Math.max(...allRects.map(r => r[3]))
    // Level decor (absolute coords)
    const ld = b.levelDecor ?? []
    for (let i = ld.length - 1; i >= 0; i--) {
      if (ld[i].tx === tx && ld[i].ty === ty)
        return { type: 'buildingLevelDecor', buildingIndex: activeBuildingIndex, index: i }
    }
    // Base decor (relative coords)
    const decor = b.decor ?? []
    for (let i = decor.length - 1; i >= 0; i--) {
      if (ox + (decor[i].tx ?? 0) === tx && oy + (decor[i].ty ?? 0) === ty)
        return { type: 'buildingDecor', buildingIndex: activeBuildingIndex, index: i }
    }
    // Windows (relative coords, rendered with +1 ty)
    const windows = b.windows ?? []
    for (let i = windows.length - 1; i >= 0; i--) {
      if (ox + windows[i].tx === tx && oy + windows[i].ty + 1 === ty)
        return { type: 'buildingWindow', buildingIndex: activeBuildingIndex, index: i }
    }
    // Doors (relative coords, stored as south-face relative)
    const doors = b.doors ?? []
    for (let i = doors.length - 1; i >= 0; i--) {
      if (ox + doors[i].tx === tx && oy + doors[i].ty === ty)
        return { type: 'buildingDoor', buildingIndex: activeBuildingIndex, index: i }
    }
    return null
  }
  if (viewMode === 'interior' && activeInteriorId) {
    const npcs = cfg.npcs ?? []
    for (let i = npcs.length - 1; i >= 0; i--) {
      if (npcs[i].building === activeInteriorId && npcs[i].tx === tx && npcs[i].ty === ty)
        return { type: 'npc', index: i }
    }
    if (showQuestItems) {
      const treasures = cfg.treasures ?? []
      for (let i = treasures.length - 1; i >= 0; i--) {
        if (treasures[i].buildingId === activeInteriorId && treasures[i].tx === tx && treasures[i].ty === ty)
          return { type: 'treasure', index: i }
      }
      const pickupItems = cfg.pickupItems ?? []
      for (let i = pickupItems.length - 1; i >= 0; i--) {
        if (pickupItems[i].building === activeInteriorId && pickupItems[i].tx === tx && pickupItems[i].ty === ty)
          return { type: 'pickupItem', index: i }
      }
    }
    const interiorAnimals = cfg.animals ?? []
    for (let i = interiorAnimals.length - 1; i >= 0; i--) {
      if (interiorAnimals[i].building === activeInteriorId && interiorAnimals[i].tx === tx && interiorAnimals[i].ty === ty)
        return { type: 'animal', index: i }
    }
    const decor = cfg.interiors?.[activeInteriorId]?.decor ?? []
    for (let i = decor.length - 1; i >= 0; i--) {
      if (decor[i].tx === tx && decor[i].ty === ty)
        return { type: 'interiorDecor', index: i, interiorId: activeInteriorId }
    }
    return null
  }
  if (showInteractables) {
    const interactables = cfg.interactables ?? []
    for (let i = interactables.length - 1; i >= 0; i--) {
      const it = interactables[i]
      if (!it.building && it.tx === tx && it.ty === ty)
        return { type: 'interactable', index: i }
    }
  }
  if (showBlockedPaths) {
    for (let i = 0; i < blockedPaths.length; i++) {
      if (blockedPaths[i].blockedTiles.some(([btx, bty]) => btx === tx && bty === ty))
        return { type: 'blockedPath', index: i }
    }
  }
  const extDecor = cfg.exteriorDecor ?? []
  for (let i = extDecor.length - 1; i >= 0; i--) {
    if (extDecor[i].tx === tx && extDecor[i].ty === ty)
      return { type: 'exteriorDecor', index: i }
  }
  const npcs = cfg.npcs ?? []
  for (let i = npcs.length - 1; i >= 0; i--) {
    if (!npcs[i].building && npcs[i].tx === tx && npcs[i].ty === ty)
      return { type: 'npc', index: i }
  }
  const animals = cfg.animals ?? []
  for (let i = animals.length - 1; i >= 0; i--) {
    if (!animals[i].building && animals[i].tx === tx && animals[i].ty === ty)
      return { type: 'animal', index: i }
  }
  const buildings = cfg.buildings ?? []
  for (let i = buildings.length - 1; i >= 0; i--) {
    const rects = buildings[i].rects ?? (buildings[i].rect ? [buildings[i].rect!] : [])
    for (const [tx1, ty1, tx2, ty2] of rects) {
      if (tx >= tx1 && tx <= tx2 && ty >= ty1 && ty <= ty2) {
        if (showBlockedPaths) {
          const lockedDoors = cfg.lockedDoors ?? []
          const dIdx = lockedDoors.findIndex(d => d.buildingId === buildings[i].id)
          if (dIdx >= 0) return { type: 'lockedDoor', index: dIdx }
        }
        return { type: 'building', index: i }
      }
    }
  }
  if (showQuestItems) {
    const treasures = cfg.treasures ?? []
    for (let i = treasures.length - 1; i >= 0; i--) {
      if (!treasures[i].buildingId && treasures[i].tx === tx && treasures[i].ty === ty)
        return { type: 'treasure', index: i }
    }
    const pickupItems = cfg.pickupItems ?? []
    for (let i = pickupItems.length - 1; i >= 0; i--) {
      if (!pickupItems[i].building && pickupItems[i].tx === tx && pickupItems[i].ty === ty)
        return { type: 'pickupItem', index: i }
    }
  }
  const streets = cfg.streets ?? []
  for (let i = streets.length - 1; i >= 0; i--) {
    const entry = streets[i]
    if (entry.rect) {
      const [tx1, ty1, tx2, ty2] = entry.rect
      if (tx >= tx1 && tx <= tx2 && ty >= ty1 && ty <= ty2)
        return { type: 'street', index: i }
    } else if (entry.tile && entry.tile[0] === tx && entry.tile[1] === ty) {
      return { type: 'street', index: i }
    }
  }
  const pondTiles = cfg.pondTiles ?? []
  for (let i = pondTiles.length - 1; i >= 0; i--) {
    const entry = pondTiles[i]
    if (entry.rect) {
      const [tx1, ty1, tx2, ty2] = entry.rect
      if (tx >= tx1 && tx <= tx2 && ty >= ty1 && ty <= ty2)
        return { type: 'pondTile', index: i }
    } else if (entry.tile && entry.tile[0] === tx && entry.tile[1] === ty) {
      return { type: 'pondTile', index: i }
    }
  }
  const spawnTiles = cfg.npcSpawnTiles ?? []
  for (let i = spawnTiles.length - 1; i >= 0; i--) {
    if (spawnTiles[i][0] === tx && spawnTiles[i][1] === ty) return { type: 'npcSpawnTile', index: i }
  }
  const chickenZones = cfg.chickenZones ?? []
  for (let i = chickenZones.length - 1; i >= 0; i--) {
    const [x1, y1, x2, y2] = chickenZones[i].rect
    if (tx >= x1 && tx <= x2 && ty >= y1 && ty <= y2) return { type: 'chickenZone', index: i }
  }
  if (showAreas) {
    const areas = cfg.areas ?? []
    for (let i = areas.length - 1; i >= 0; i--) {
      const a = areas[i]
      if (tx >= a.tx && tx < a.tx + a.tw && ty >= a.ty && ty < a.ty + a.th)
        return { type: 'area', index: i }
    }
  }
  return null
}

function getEntityTx(cfg: RawMapConfig, entity: SelectedEntity): number {
  if (entity.type === 'exteriorDecor') return cfg.exteriorDecor?.[entity.index]?.tx ?? 0
  if (entity.type === 'npc') return cfg.npcs?.[entity.index]?.tx ?? 0
  if (entity.type === 'animal') return cfg.animals?.[entity.index]?.tx ?? 0
  if (entity.type === 'interiorDecor') return cfg.interiors?.[entity.interiorId]?.decor[entity.index]?.tx ?? 0
  if (entity.type === 'buildingLevelDecor') return cfg.buildings?.[entity.buildingIndex]?.levelDecor?.[entity.index]?.tx ?? 0
  if (entity.type === 'buildingDecor') {
    const b = cfg.buildings?.[entity.buildingIndex]
    if (!b) return 0
    const allRects = (b.rects ?? (b.rect ? [b.rect] : [])) as [number, number, number, number][]
    return Math.min(...allRects.map(r => r[0])) + (b.decor?.[entity.index]?.tx ?? 0)
  }
  if (entity.type === 'buildingWindow') {
    const b = cfg.buildings?.[entity.buildingIndex]
    if (!b) return 0
    const allRects = (b.rects ?? (b.rect ? [b.rect] : [])) as [number, number, number, number][]
    return Math.min(...allRects.map(r => r[0])) + (b.windows?.[entity.index]?.tx ?? 0)
  }
  if (entity.type === 'buildingDoor') {
    const b = cfg.buildings?.[entity.buildingIndex]
    if (!b) return 0
    const allRects = (b.rects ?? (b.rect ? [b.rect] : [])) as [number, number, number, number][]
    return Math.min(...allRects.map(r => r[0])) + (b.doors?.[entity.index]?.tx ?? 0)
  }
  if (entity.type === 'festivalDecor') {
    const g = cfg.festivalDecor?.find(grp => grp.festivalId === entity.festivalId)
    return g?.decor[entity.index]?.tx ?? 0
  }
  if (entity.type === 'building') {
    const b = cfg.buildings?.[entity.index]
    const rects = b?.rects ?? (b?.rect ? [b.rect] : [])
    return rects[0]?.[0] ?? 0
  }
  if (entity.type === 'street') {
    const e = cfg.streets?.[entity.index]
    return e?.rect?.[0] ?? e?.tile?.[0] ?? 0
  }
  if (entity.type === 'pondTile') {
    const e = cfg.pondTiles?.[entity.index]
    return e?.rect?.[0] ?? e?.tile?.[0] ?? 0
  }
  if (entity.type === 'npcSpawnTile') return cfg.npcSpawnTiles?.[entity.index]?.[0] ?? 0
  if (entity.type === 'chickenZone') return cfg.chickenZones?.[entity.index]?.rect?.[0] ?? 0
  if (entity.type === 'interactable') return cfg.interactables?.[entity.index]?.tx ?? 0
  if (entity.type === 'exitTile') return cfg.exitTiles?.[entity.index]?.tx ?? 0
  if (entity.type === 'treasure') return cfg.treasures?.[entity.index]?.tx ?? 0
  if (entity.type === 'pickupItem') return cfg.pickupItems?.[entity.index]?.tx ?? 0
  if (entity.type === 'area') return cfg.areas?.[entity.index]?.tx ?? 0
  return 0
}

function getEntityTy(cfg: RawMapConfig, entity: SelectedEntity): number {
  if (entity.type === 'exteriorDecor') return cfg.exteriorDecor?.[entity.index]?.ty ?? 0
  if (entity.type === 'npc') return cfg.npcs?.[entity.index]?.ty ?? 0
  if (entity.type === 'animal') return cfg.animals?.[entity.index]?.ty ?? 0
  if (entity.type === 'interiorDecor') return cfg.interiors?.[entity.interiorId]?.decor[entity.index]?.ty ?? 0
  if (entity.type === 'buildingLevelDecor') return cfg.buildings?.[entity.buildingIndex]?.levelDecor?.[entity.index]?.ty ?? 0
  if (entity.type === 'buildingDecor') {
    const b = cfg.buildings?.[entity.buildingIndex]
    if (!b) return 0
    const allRects = (b.rects ?? (b.rect ? [b.rect] : [])) as [number, number, number, number][]
    return Math.max(...allRects.map(r => r[3])) + (b.decor?.[entity.index]?.ty ?? 0)
  }
  if (entity.type === 'buildingWindow') {
    const b = cfg.buildings?.[entity.buildingIndex]
    if (!b) return 0
    const allRects = (b.rects ?? (b.rect ? [b.rect] : [])) as [number, number, number, number][]
    return Math.max(...allRects.map(r => r[3])) + (b.windows?.[entity.index]?.ty ?? 0) + 1
  }
  if (entity.type === 'buildingDoor') {
    const b = cfg.buildings?.[entity.buildingIndex]
    if (!b) return 0
    const allRects = (b.rects ?? (b.rect ? [b.rect] : [])) as [number, number, number, number][]
    return Math.max(...allRects.map(r => r[3])) + (b.doors?.[entity.index]?.ty ?? 0)
  }
  if (entity.type === 'festivalDecor') {
    const g = cfg.festivalDecor?.find(grp => grp.festivalId === entity.festivalId)
    return g?.decor[entity.index]?.ty ?? 0
  }
  if (entity.type === 'building') {
    const b = cfg.buildings?.[entity.index]
    const rects = b?.rects ?? (b?.rect ? [b.rect] : [])
    return rects[0]?.[1] ?? 0
  }
  if (entity.type === 'street') {
    const e = cfg.streets?.[entity.index]
    return e?.rect?.[1] ?? e?.tile?.[1] ?? 0
  }
  if (entity.type === 'pondTile') {
    const e = cfg.pondTiles?.[entity.index]
    return e?.rect?.[1] ?? e?.tile?.[1] ?? 0
  }
  if (entity.type === 'npcSpawnTile') return cfg.npcSpawnTiles?.[entity.index]?.[1] ?? 0
  if (entity.type === 'chickenZone') return cfg.chickenZones?.[entity.index]?.rect?.[1] ?? 0
  if (entity.type === 'interactable') return cfg.interactables?.[entity.index]?.ty ?? 0
  if (entity.type === 'exitTile') return cfg.exitTiles?.[entity.index]?.ty ?? 0
  if (entity.type === 'treasure') return cfg.treasures?.[entity.index]?.ty ?? 0
  if (entity.type === 'pickupItem') return cfg.pickupItems?.[entity.index]?.ty ?? 0
  if (entity.type === 'area') return cfg.areas?.[entity.index]?.ty ?? 0
  return 0
}
