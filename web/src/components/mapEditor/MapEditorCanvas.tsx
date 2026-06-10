import React, { useRef, useEffect, useCallback, useState } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../hooks/usePixiApp'
import { loadTileTexture, loadSpriteTexture } from '../../utils/pixiHelpers'
import { BASE_CHIP_TILES } from '../../data/tiles/baseChipIndex'
import { TILESET_IMAGE, TILESET_COLUMNS } from '../../data/tiles/tileIndex'
import type { RawMapConfig, RawDecorItem,  SelectedEntity, ToolMode, Zlayer } from './mapEditorTypes'
import { WALL_TILES } from '../../data/tiles/buildingMaterials'
import type { WallMaterial } from '../../data/tiles/buildingMaterials'
import { expandBundleDecor } from '../../data/bundles/bundleLoader'
import { RawQuestPickupItem } from '../../data/hub/hubWorldFactory'

const T           = 32
const INTERIOR_PAD = 10  // tiles of surrounding space around active room in interior view
const BASE_URL  = TILESET_IMAGE.baseChip
const BASE_COLS = TILESET_COLUMNS.baseChip

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

type FlatDecorItem = { tx: number; ty: number; tileId: string; zlayer: Zlayer; sourceIndex: number }

function flattenDecor(items: RawDecorItem[]): FlatDecorItem[] {
  const out: FlatDecorItem[] = []
  items.forEach((item, sourceIndex) => {
    if (item.tx === undefined) return // comment-only entry
    if (item.bundleID) {
      const expanded = expandBundleDecor(item.bundleID, item.tx, item.ty ?? 0)
      expanded.forEach(e => {
        const tileKey = Object.keys(BASE_CHIP_TILES as Record<string, number>)
          .find(k => (BASE_CHIP_TILES as Record<string, number>)[k] === e.tileId) ?? ''
        if (tileKey) out.push({ tx: e.tx, ty: e.ty, tileId: tileKey, zlayer: (e.zlayer as Zlayer) ?? 'solid', sourceIndex })
      })
    } else if (item.tileId) {
      out.push({ tx: item.tx, ty: item.ty ?? 0, tileId: item.tileId, zlayer: item.zlayer ?? 'solid', sourceIndex })
    }
  })
  return out
}

interface Props {
  configData:       RawMapConfig
  tool:             ToolMode
  showGrid:         boolean
  selectedEntity:   SelectedEntity | null
  viewMode:         'exterior' | 'interior'
  activeInteriorId: string | null
  activeTileId:     string | null
  activeBundleId:   string | null
  activeZlayer:     Zlayer
  onSelectEntity:   (e: SelectedEntity | null) => void
  onPlaceDecor:     (tx: number, ty: number) => void
  onMoveEntity:     (entity: SelectedEntity, tx: number, ty: number) => void
  onDeleteEntity:   (entity: SelectedEntity) => void
  onAddStreet:        (tx1: number, ty1: number, tx2: number, ty2: number) => void
  showQuestItems:     boolean
  questPickupItems:   RawQuestPickupItem[]
}

export function MapEditorCanvas(props: Props) {
  const {
    configData, tool, showGrid, selectedEntity, viewMode, activeInteriorId,
    activeTileId, activeBundleId, activeZlayer, showQuestItems, questPickupItems,
    onSelectEntity, onPlaceDecor, onMoveEntity, onDeleteEntity, onAddStreet,
  } = props

  const containerRef = useRef<HTMLDivElement>(null)

  // Refs that event handlers read so they always get the latest values
  const propsRef = useRef(props)
  propsRef.current = props

  // Drag state — offsetX/Y = click position minus entity anchor, for non-point entities like buildings
  const dragRef = useRef<{ entity: SelectedEntity; lastTx: number; lastTy: number; offsetX: number; offsetY: number } | null>(null)

  // Street draw state
  type StreetPreview = { sx: number; sy: number; ex: number; ey: number }
  const [streetPreview, setStreetPreview] = useState<StreetPreview | null>(null)
  const setStreetPreviewRef = useRef(setStreetPreview)
  setStreetPreviewRef.current = setStreetPreview
  const streetDrawRef = useRef<{ startTx: number; startTy: number; lastTx: number; lastTy: number } | null>(null)

  // Clear street draw when tool switches away
  useEffect(() => {
    if (tool !== 'street') {
      streetDrawRef.current = null
      setStreetPreview(null)
    }
  }, [tool])

  // Render version counter — incremented on each render, so async sprite loads can detect staleness
  const renderVersionRef = useRef(0)
  // World origin offset — non-zero in interior mode to make room for adjacent rooms above/left
  const worldOriginRef = useRef({ x: 0, y: 0 })

  // Compute canvas dimensions
  const isInterior = viewMode === 'interior' && activeInteriorId
  const interior   = isInterior ? configData.interiors?.[activeInteriorId!] : null
  const mapW = isInterior ? ((interior?.width  ?? 12) + INTERIOR_PAD * 2) * T : configData.mapW
  const mapH = isInterior ? ((interior?.height ?? 9)  + INTERIOR_PAD * 2) * T : configData.mapH

  const appRef = usePixiApp(containerRef, mapW, mapH, useCallback((app: PIXI.Application) => {
    const stage = app.stage
    stage.eventMode = 'static'
    stage.hitArea   = new PIXI.Rectangle(0, 0, mapW, mapH)

    stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      const { tool: t, activeTileId: tid, activeBundleId: bid, viewMode: vm,
               activeInteriorId: iid, configData: cfg, showQuestItems: sqI } = propsRef.current
      const { x: ox, y: oy } = worldOriginRef.current
      const pos = e.getLocalPosition(stage)
      const tx  = Math.floor((pos.x - ox) / T)
      const ty  = Math.floor((pos.y - oy) / T)

      if (t === 'select') {
        const entity = hitTest(cfg, tx, ty, vm, iid, sqI)
        propsRef.current.onSelectEntity(entity)
        if (entity) {
          const etx = getEntityTx(cfg, entity)
          const ety = getEntityTy(cfg, entity)
          dragRef.current = { entity, lastTx: tx, lastTy: ty, offsetX: tx - etx, offsetY: ty - ety }
        }
      } else if (t === 'place' && (tid || bid)) {
        propsRef.current.onPlaceDecor(tx, ty)
      } else if (t === 'delete') {
        const entity = hitTest(cfg, tx, ty, vm, iid, sqI)
        if (entity) {
          propsRef.current.onDeleteEntity(entity)
          propsRef.current.onSelectEntity(null)
        }
      } else if (t === 'street') {
        streetDrawRef.current = { startTx: tx, startTy: ty, lastTx: tx, lastTy: ty }
        setStreetPreviewRef.current({ sx: tx, sy: ty, ex: tx, ey: ty })
      }
    })

    stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      const { x: ox, y: oy } = worldOriginRef.current
      const pos = e.getLocalPosition(stage)
      const tx  = Math.floor((pos.x - ox) / T)
      const ty  = Math.floor((pos.y - oy) / T)

      if (dragRef.current) {
        const { entity, lastTx, lastTy, offsetX, offsetY } = dragRef.current
        if (tx !== lastTx || ty !== lastTy) {
          dragRef.current.lastTx = tx
          dragRef.current.lastTy = ty
          propsRef.current.onMoveEntity(entity, tx - offsetX, ty - offsetY)
        }
      }

      if (streetDrawRef.current) {
        const { startTx, startTy, lastTx, lastTy } = streetDrawRef.current
        if (tx !== lastTx || ty !== lastTy) {
          streetDrawRef.current.lastTx = tx
          streetDrawRef.current.lastTy = ty
          setStreetPreviewRef.current({
            sx: Math.min(tx, startTx), sy: Math.min(ty, startTy),
            ex: Math.max(tx, startTx), ey: Math.max(ty, startTy),
          })
        }
      }
    })

    stage.on('pointerup', (e: PIXI.FederatedPointerEvent) => {
      dragRef.current = null
      if (streetDrawRef.current) {
        const { x: ox, y: oy } = worldOriginRef.current
        const pos = e.getLocalPosition(stage)
        const tx = Math.floor((pos.x - ox) / T)
        const ty = Math.floor((pos.y - oy) / T)
        const { startTx, startTy } = streetDrawRef.current
        propsRef.current.onAddStreet(
          Math.min(tx, startTx), Math.min(ty, startTy),
          Math.max(tx, startTx), Math.max(ty, startTy),
        )
        streetDrawRef.current = null
        setStreetPreviewRef.current(null)
      }
    })
    stage.on('pointerupoutside', () => {
      dragRef.current = null
      if (streetDrawRef.current) {
        streetDrawRef.current = null
        setStreetPreviewRef.current(null)
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

    const pad = isInterior ? INTERIOR_PAD * T : 0
    worldOriginRef.current = { x: pad, y: pad }
    const worldContainer = new PIXI.Container()
    worldContainer.x = pad
    worldContainer.y = pad
    stage.addChild(worldContainer)
    worldContainer.addChild(groundLayer, streetLayer, buildingLayer,
                            decorBLayer, decorLayer, npcLayer, decorALayer, questLayer,
                            selLayer, gridLayer)

    if (isInterior && interior) {
      renderInterior(version, groundLayer, decorBLayer, decorLayer, decorALayer, selLayer)
    } else {
      renderExterior(version, groundLayer, streetLayer, buildingLayer,
                     decorBLayer, decorLayer, npcLayer, decorALayer, selLayer)
    }
    if (!isInterior && showQuestItems) {
      renderQuestItems(version, questLayer, selLayer)
    }

    if (showGrid) drawGrid(gridLayer)
    drawSelection(selLayer)

    // Street draw preview — drawn above all other layers
    if (!isInterior && streetPreview) {
      const { sx, sy, ex, ey } = streetPreview
      const pvGfx = new PIXI.Graphics()
      pvGfx.rect(sx * T, sy * T, (ex - sx + 1) * T, (ey - sy + 1) * T)
        .fill({ color: STREET_COLOR, alpha: 0.4 })
        .stroke({ color: 0xf0c040, width: 2 })
      worldContainer.addChild(pvGfx)
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

    // Ponds
    const pGfx = new PIXI.Graphics()
    for (const p of configData.pondTiles ?? [])
      for (const [tx, ty] of expandEntries([p]))
        pGfx.rect(tx * T, ty * T, T, T).fill(POND_COLOR)
    streetLayer.addChild(pGfx)

    // Buildings
    const buildings = configData.buildings ?? []
    buildings.forEach((b, bIdx) => {
      const rects = b.rects ?? (b.rect ? [b.rect] : [])
      const col   = WALL_COLORS[b.wall ?? ''] ?? 0x556677
      const isSel = selectedEntity?.type === 'building' && selectedEntity.index === bIdx
      const gfx   = new PIXI.Graphics()
      for (const [tx1, ty1, tx2, ty2] of rects) {
        gfx.rect(tx1 * T, ty1 * T, (tx2 - tx1 + 1) * T, (ty2 - ty1 + 1) * T).fill(col)
        if (isSel)
          gfx.rect(tx1 * T, ty1 * T, (tx2 - tx1 + 1) * T, (ty2 - ty1 + 1) * T)
            .stroke({ color: 0xf0c040, width: 2 })
      }
      buildingLayer.addChild(gfx)
      if (b.id && rects[0]) {
        const [tx1, ty1, tx2, ty2] = rects[0]
        const lbl = new PIXI.Text({ text: b.id, style: { fontSize: 9, fill: 0xeeeecc } })
        lbl.x = (tx1 + (tx2 - tx1 + 1) / 2) * T - lbl.width / 2
        lbl.y = (ty1 + (ty2 - ty1 + 1) / 2) * T - lbl.height / 2
        buildingLayer.addChild(lbl)
      }
    })

    // Exterior decor tiles
    renderDecorItems(version, flattenDecor(configData.exteriorDecor ?? []),
                     decorBLayer, decorLayer, decorALayer, 'exteriorDecor', '', selLayer)

    // NPCs
    const npcs = configData.npcs ?? []
    npcs.forEach((npc, nIdx) => {
      if (npc.building) return
      const isSel = selectedEntity?.type === 'npc' && selectedEntity.index === nIdx
      loadSpriteTexture(npc.sprite).then(tex => {
        if (renderVersionRef.current !== version) return
        const sp = new PIXI.Sprite(tex)
        sp.width  = T * 1.5; sp.height = T * 1.5
        sp.x      = npc.tx * T - T * 0.25
        sp.y      = npc.ty * T - T * 0.5
        sp.eventMode = 'static'; sp.cursor = 'pointer'
        sp.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
          e.stopPropagation()
          const entity: SelectedEntity = { type: 'npc', index: nIdx }
          propsRef.current.onSelectEntity(entity)
          if (propsRef.current.tool === 'select')
            dragRef.current = { entity, lastTx: npc.tx, lastTy: npc.ty, offsetX: 0, offsetY: 0 }
        })
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
      loadTileTexture(BASE_URL, tileId, BASE_COLS).then(tex => {
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
      loadTileTexture(BASE_URL, fid, BASE_COLS).then(tex => {
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

  function renderInterior(
    version: number,
    groundLayer: PIXI.Container,
    decorBLayer: PIXI.Container, decorLayer: PIXI.Container, decorALayer: PIXI.Container,
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

    // Floor tiles
    if (interior.floorTileId) {
      const fid = tileNumericId(interior.floorTileId)
      loadTileTexture(BASE_URL, fid, BASE_COLS).then(tex => {
        if (renderVersionRef.current !== version) return
        for (let tx = 0; tx < width; tx++) {
          for (let ty = 0; ty < height; ty++) {
            const sp = new PIXI.Sprite(tex)
            sp.x = tx * T; sp.y = ty * T
            groundLayer.addChild(sp)
          }
        }
      }).catch(() => {})
    }

    // Walls with gaps at directional exits
    const gapSet = buildGapSet(width, height, interior.exits)
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
    items.forEach(({ tx, ty, tileId, zlayer, sourceIndex }) => {
      const numId = tileNumericId(tileId)
      const layer = zlayer === 'below' ? decorBLayer : zlayer === 'above' ? decorALayer : decorLayer
      const isSel = selectedEntity?.type === entityType &&
        (entityType === 'exteriorDecor'
          ? (selectedEntity as { index: number }).index === sourceIndex
          : (selectedEntity as { index: number; interiorId: string }).index === sourceIndex &&
            (selectedEntity as { interiorId: string }).interiorId === interiorId)

      loadTileTexture(BASE_URL, numId, BASE_COLS).then(tex => {
        if (renderVersionRef.current !== version) return
        const sp = new PIXI.Sprite(tex)
        sp.x = tx * T; sp.y = ty * T
        sp.eventMode = 'static'; sp.cursor = 'pointer'
        sp.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
          e.stopPropagation()
          const entity: SelectedEntity = entityType === 'exteriorDecor'
            ? { type: 'exteriorDecor', index: sourceIndex }
            : { type: 'interiorDecor', index: sourceIndex, interiorId }
          propsRef.current.onSelectEntity(entity)
          if (propsRef.current.tool === 'select')
            dragRef.current = { entity, lastTx: tx, lastTy: ty, offsetX: 0, offsetY: 0 }
        })
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

  // ── Quest items (treasures + pickupItems) rendering ───────────────────────────
  function renderQuestItems(version: number, questLayer: PIXI.Container, selLayer: PIXI.Graphics) {
    const TREASURE_COLOR = 0xf0c040
    const PICKUP_COLOR   = 0x40d0f0

    const renderItem = (
      itemTx: number, itemTy: number, tileId: string,
      entity: SelectedEntity, tintColor: number,
    ) => {
      const isSel = selectedEntity?.type === entity.type && selectedEntity.index === entity.index
      const numId = tileNumericId(tileId)
      const handler = (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation()
        propsRef.current.onSelectEntity(entity)
        if (propsRef.current.tool === 'select')
          dragRef.current = { entity, lastTx: itemTx, lastTy: itemTy, offsetX: 0, offsetY: 0 }
      }

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

      loadTileTexture(BASE_URL, numId, BASE_COLS).then(tex => {
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
    if (!selectedEntity) return
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
      return
    }
    let tx = -1, ty = -1
    if (selectedEntity.type === 'exteriorDecor') {
      const item = configData.exteriorDecor?.[selectedEntity.index]
      if (item?.tx !== undefined) { tx = item.tx; ty = item.ty ?? 0 }
    } else if (selectedEntity.type === 'npc') {
      const npc = configData.npcs?.[selectedEntity.index]
      if (npc) { tx = npc.tx; ty = npc.ty }
    } else if (selectedEntity.type === 'treasure') {
      const t = configData.treasures?.[selectedEntity.index]
      if (t) { tx = t.tx; ty = t.ty }
    } else if (selectedEntity.type === 'pickupItem') {
      const p = configData.pickupItems?.[selectedEntity.index]
      if (p) { tx = p.tx; ty = p.ty }
    } else if (selectedEntity.type === 'interiorDecor' && selectedEntity.interiorId === activeInteriorId) {
      const item = configData.interiors?.[selectedEntity.interiorId]?.decor[selectedEntity.index]
      if (item?.tx !== undefined) { tx = item.tx; ty = item.ty ?? 0 }
    }
    if (tx >= 0) {
      gfx.rect(tx * T - 2, ty * T - 2, T + 4, T + 4).stroke({ color: 0xf0c040, width: 2 })
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
  viewMode: string, activeInteriorId: string | null,
  showQuestItems = false,
): SelectedEntity | null {
  if (viewMode === 'interior' && activeInteriorId) {
    const decor = cfg.interiors?.[activeInteriorId]?.decor ?? []
    for (let i = decor.length - 1; i >= 0; i--) {
      if (decor[i].tx === tx && decor[i].ty === ty)
        return { type: 'interiorDecor', index: i, interiorId: activeInteriorId }
    }
    return null
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
  const buildings = cfg.buildings ?? []
  for (let i = buildings.length - 1; i >= 0; i--) {
    const rects = buildings[i].rects ?? (buildings[i].rect ? [buildings[i].rect!] : [])
    for (const [tx1, ty1, tx2, ty2] of rects) {
      if (tx >= tx1 && tx <= tx2 && ty >= ty1 && ty <= ty2)
        return { type: 'building', index: i }
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
  return null
}

function getEntityTx(cfg: RawMapConfig, entity: SelectedEntity): number {
  if (entity.type === 'exteriorDecor') return cfg.exteriorDecor?.[entity.index]?.tx ?? 0
  if (entity.type === 'npc') return cfg.npcs?.[entity.index]?.tx ?? 0
  if (entity.type === 'interiorDecor') return cfg.interiors?.[entity.interiorId]?.decor[entity.index]?.tx ?? 0
  if (entity.type === 'building') {
    const b = cfg.buildings?.[entity.index]
    const rects = b?.rects ?? (b?.rect ? [b.rect] : [])
    return rects[0]?.[0] ?? 0
  }
  if (entity.type === 'street') {
    const e = cfg.streets?.[entity.index]
    return e?.rect?.[0] ?? e?.tile?.[0] ?? 0
  }
  if (entity.type === 'treasure') return cfg.treasures?.[entity.index]?.tx ?? 0
  if (entity.type === 'pickupItem') return cfg.pickupItems?.[entity.index]?.tx ?? 0
  return 0
}

function getEntityTy(cfg: RawMapConfig, entity: SelectedEntity): number {
  if (entity.type === 'exteriorDecor') return cfg.exteriorDecor?.[entity.index]?.ty ?? 0
  if (entity.type === 'npc') return cfg.npcs?.[entity.index]?.ty ?? 0
  if (entity.type === 'interiorDecor') return cfg.interiors?.[entity.interiorId]?.decor[entity.index]?.ty ?? 0
  if (entity.type === 'building') {
    const b = cfg.buildings?.[entity.index]
    const rects = b?.rects ?? (b?.rect ? [b.rect] : [])
    return rects[0]?.[1] ?? 0
  }
  if (entity.type === 'street') {
    const e = cfg.streets?.[entity.index]
    return e?.rect?.[1] ?? e?.tile?.[1] ?? 0
  }
  if (entity.type === 'treasure') return cfg.treasures?.[entity.index]?.ty ?? 0
  if (entity.type === 'pickupItem') return cfg.pickupItems?.[entity.index]?.ty ?? 0
  return 0
}
