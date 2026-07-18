import React, { useMemo, useRef, useEffect, useState } from 'react'
import * as PIXI from 'pixi.js'
import { User } from 'firebase/auth'
import { emitSound } from '../../../game/sound'
import { getDiscoveredFragmentIds } from '../../../game/codex'
import { Act, QuestNode, RunState, ReplayModifier, getAvailableNodeIds, loadNodeHistory, getModifiersByCount, ALL_CONSUMABLES, loadPlayerAvatar, ARCHETYPE_DEFS, WorldMap } from '../../../game/questline'
import { spriteSlug } from '../../../game/sprites'
import { StatRow } from '../../ui/StatRow'
import { getCardUnit } from '../../../game/cards'
import { Lives } from '../../ui/Lives/Lives'
import { OverlayScreen } from '../../ui/OverlayScreen'
import { Toolbar } from '../../ui/Toolbar/Toolbar'
import { ToolbarButton } from '../../ui/Toolbar/ToolbarButton'
import { NodeMapHpBar } from '../../campaign/NodeMapHpBar'
import { ToolbarSpacer } from '../../ui/Toolbar/ToolbarSpacer'
import { ToolbarLabel } from '../../ui/Toolbar/ToolbarLabel'
import { usePixiApp } from '../../../hooks/usePixiApp'
import { loadSpriteTexture, loadAnimFrames, loadTextureUrl, loadTileTexture, makeClickable, tweenTo } from '../../../utils/pixiHelpers'
import { ENV_TILES, TILE_SIZE, type EnvTileDef } from '../../../data/tiles/tileIndex'
import { WORLD_ENV_TILES, WORLD_DECOR_FILE } from '../../../data/tiles/worldTileIndex'
import { GIFT_OWNER_UID } from '../../../game/gifts'
import { hashStr, envColors, parseRgba, sampleBezier, bezierBand } from '../../../utils/mapUtils'
import { renderPathTiles } from '../../../utils/tileLookup'
import { buildTerrainGfx, buildBgTileGfx, buildDecorGfx, buildBorderGfx } from '../../../utils/terrainLayer'
import { NODE_ICON, NODE_LABEL } from '../../ui/NodeMap/constants'
import { getCurrentWorldLocation } from '../../../game/world/worldState'
import { NodePeekModal } from '../../ui/NodeMap/NodePeekModal'

interface Props {
  id: string
  worldMap: WorldMap
  run?: RunState               // campaign mode: required when clearedNodeIds absent
  clearedNodeIds?: Set<string> // world mode: required when run absent
  restrictedNodeIds?: Set<string> // world mode: towns locked by admin town-access setting
  onFoggedTap?: (node: QuestNode) => void // world mode: tapped a restrictedNodeIds town
  mapWidth?: number            // override canvas width (world map uses 700)
  mapHeight?: number           // override canvas height (world map uses 520)
  setPeekNode: (node: QuestNode | null) => void
  showPaths: boolean
}



const COL_WIDTH      = 128
const ROW_HEIGHT     = 96
const AVATAR_PADDING = 80
const CONN_W         = 32
const AVATAR_SIZE    = 36
const WALK_DURATION  = 700
const NODE_RADIUS    = 22

// ── Game logic helpers ────────────────────────────────────────────────────────

export type NodeStatus = 'completed' | 'available' | 'skipped' | 'locked' | 'pending'

export function getNodeStatus(nodeId: string, availableIds: string[], run: RunState): NodeStatus {
  if (run.pendingNodeId === nodeId)          return 'pending'
  if (run.completedNodeIds.includes(nodeId)) return 'completed'
  if (run.skippedNodeIds.includes(nodeId))   return 'skipped'
  if (availableIds.includes(nodeId))         return 'available'
  return 'locked'
}

export function getWorldNodeStatus(node: QuestNode, clearedNodeIds: Set<string>, restrictedNodeIds?: Set<string>): NodeStatus {
  if (restrictedNodeIds?.has(node.id)) return 'locked'
  if (clearedNodeIds.has(node.id)) return 'completed'
  if (!node.requiredClears?.length) return 'available'
  const cleared = node.requiredClears.every(req => {
    if (req.includes('|')) return req.split('|').some(id => clearedNodeIds.has(id))
    return clearedNodeIds.has(req)
  })
  return cleared ? 'available' : 'locked'
}

async function buildWorldPathTiles(
  container: PIXI.Container,
  nodes: QuestNode[],
  envDef: EnvTileDef,
): Promise<void> {
  const T = TILE_SIZE
  const pathSet = new Set<string>()
  const key = (tx: number, ty: number) => `${tx},${ty}`
  const seen = new Set<string>()

  for (const node of nodes) {
    for (const connId of (node.connections ?? node.childIds)) {
      const connKey = [node.id, connId].sort().join('|')
      if (seen.has(connKey)) continue
      seen.add(connKey)

      const target = nodes.find(n => n.id === connId)
      if (!target || target.x === undefined || node.x === undefined) continue

      const aTx = Math.floor(node.x   / T), aTy = Math.floor(node.y!  / T)
      const bTx = Math.floor(target.x / T), bTy = Math.floor(target.y! / T)
      const midTx = Math.floor((node.x + target.x) / 2 / T)

      for (let tx = Math.min(aTx, midTx); tx <= Math.max(aTx, midTx); tx++)
        pathSet.add(key(tx, aTy))
      for (let ty = Math.min(aTy, bTy); ty <= Math.max(aTy, bTy); ty++)
        pathSet.add(key(midTx, ty))
      for (let tx = Math.min(midTx, bTx); tx <= Math.max(midTx, bTx); tx++)
        pathSet.add(key(tx, bTy))
    }
  }

  await renderPathTiles(container, pathSet, 'farmland', undefined, undefined, envDef)
}

function computeReachableIds(nodes: Record<string, QuestNode>, run: RunState): Set<string> {
  const skipped = new Set(run.skippedNodeIds)
  const reachable = new Set<string>()
  function visit(id: string) {
    if (reachable.has(id) || skipped.has(id)) return
    reachable.add(id)
    const node = nodes[id]
    if (!node) return
    for (const childId of node.childIds) visit(childId)
  }
  const hasParent = new Set<string>()
  for (const node of Object.values(nodes))
    for (const cid of node.childIds) hasParent.add(cid)
  for (const [id] of Object.entries(nodes))
    if (!hasParent.has(id) && !skipped.has(id)) visit(id)
  return reachable
}

function buildRows(nodes: Record<string, QuestNode>): QuestNode[][] {
  const byRow: Record<number, QuestNode[]> = {}
  for (const node of Object.values(nodes)) {
    if (!byRow[node.row]) byRow[node.row] = []
    byRow[node.row].push(node)
  }
  return Object.keys(byRow).map(Number).sort((a, b) => a - b)
    .map(r => byRow[r].sort((a, b) => a.col - b.col))
}

function computeHiddenNodeIds(nodes: Record<string, QuestNode>, run: RunState, discoveredFragIds: Set<string>): Set<string> {
  const ids = new Set<string>()
  for (const node of Object.values(nodes)) {
    if (node.type !== 'memory' || !node.fragmentId) continue
    const alreadyFound   = discoveredFragIds.has(node.fragmentId)
    const visitedThisRun = run.completedNodeIds.includes(node.id)
    if (alreadyFound && !visitedThisRun) {
      ids.add(node.id)
    } else if (!alreadyFound && !visitedThisRun) {
      if (hashStr(node.id + String(run.runSeed)) % 100 >= 20) ids.add(node.id)
    }
  }
  return ids
}

function lastCompletedNode(nodes: Record<string, QuestNode>, run: RunState): QuestNode | null {
  if (run.completedNodeIds.length === 0) return null
  const completed = new Set(run.completedNodeIds)
  for (const id of run.completedNodeIds) {
    const node = nodes[id]
    if (!node) continue
    if (!node.childIds.some(cid => completed.has(cid))) return node
  }
  return nodes[run.completedNodeIds[run.completedNodeIds.length - 1]] ?? null
}

function nodePosition(
  rowIndex: number, node: QuestNode, rowCols: number, maxRowCols: number,
): { x: number; y: number } {
  return {
    x: AVATAR_PADDING + rowIndex * (COL_WIDTH + CONN_W) + COL_WIDTH / 2,
    y: ((maxRowCols - rowCols) / 2 + node.col + 0.5) * ROW_HEIGHT,
  }
}

function startPos(mapHeight: number) { return { x: AVATAR_PADDING / 2, y: mapHeight / 2 } }

// ── Path tile renderer ────────────────────────────────────────────────────────
// Lays PATH tiles from [A]Grass_pipo along each connector route.
// Routes are L-shaped (horizontal → vertical → horizontal) snapped to the 32px
// tile grid; neighbors are checked to pick the right PATH variant at each cell.

async function buildPathTileGfx(
  container: PIXI.Container,
  environment: string,
  rows: QuestNode[][],
  maxRowCols: number,
  mapHeight: number,
): Promise<void> {
  const T = TILE_SIZE

  // Collect all tile-grid cells that lie on any connector path
  const pathSet = new Set<string>()
  const key = (tx: number, ty: number) => `${tx},${ty}`

  // Start position → first row nodes
  if (rows.length > 0) {
    const firstRow = rows[0]
    const firstRowCols = firstRow[0]?.rowCols ?? firstRow.length
    const startX = AVATAR_PADDING / 2
    const startY = mapHeight / 2
    const firstColCenterX = AVATAR_PADDING + COL_WIDTH / 2
    const midX = (startX + firstColCenterX) / 2

    const sTx = Math.floor(startX / T), sTy = Math.floor(startY / T)
    const midTx = Math.floor(midX / T)
    const fTx = Math.floor(firstColCenterX / T)

    for (const node of firstRow) {
      const vr = (maxRowCols - firstRowCols) / 2 + node.col
      const ny = (vr + 0.5) / maxRowCols * mapHeight
      const nTy = Math.floor(ny / T)

      for (let tx = Math.min(sTx, midTx); tx <= Math.max(sTx, midTx); tx++)
        pathSet.add(key(tx, sTy))
      for (let ty = Math.min(sTy, nTy); ty <= Math.max(sTy, nTy); ty++)
        pathSet.add(key(midTx, ty))
      for (let tx = Math.min(midTx, fTx); tx <= Math.max(midTx, fTx); tx++)
        pathSet.add(key(tx, nTy))
    }
  }

  // Row-to-row connector paths
  for (let ri = 0; ri < rows.length - 1; ri++) {
    const prevRow = rows[ri], nextRow = rows[ri + 1]
    const prevRowCols = prevRow[0]?.rowCols ?? prevRow.length
    const nextRowCols = nextRow[0]?.rowCols ?? nextRow.length
    const parentCenterX = AVATAR_PADDING + ri * (COL_WIDTH + CONN_W) + COL_WIDTH / 2
    const childCenterX  = AVATAR_PADDING + (ri + 1) * (COL_WIDTH + CONN_W) + COL_WIDTH / 2
    const xMid = AVATAR_PADDING + (ri + 1) * COL_WIDTH + ri * CONN_W + CONN_W / 2

    for (const parent of prevRow) {
      for (const childId of parent.childIds) {
        const child = nextRow.find(n => n.id === childId)
        if (!child) continue
        const pr = (maxRowCols - prevRowCols) / 2 + parent.col
        const cr = (maxRowCols - nextRowCols) / 2 + child.col
        const y1 = (pr + 0.5) / maxRowCols * mapHeight
        const y2 = (cr + 0.5) / maxRowCols * mapHeight

        const pTx = Math.floor(parentCenterX / T), pTy = Math.floor(y1 / T)
        const midTx = Math.floor(xMid / T)
        const cTx = Math.floor(childCenterX / T), cTy = Math.floor(y2 / T)

        // Horizontal leg: parent → midpoint column
        for (let tx = Math.min(pTx, midTx); tx <= Math.max(pTx, midTx); tx++)
          pathSet.add(key(tx, pTy))
        // Vertical leg: midpoint column, parent row → child row
        for (let ty = Math.min(pTy, cTy); ty <= Math.max(pTy, cTy); ty++)
          pathSet.add(key(midTx, ty))
        // Horizontal leg: midpoint column → child node
        for (let tx = Math.min(midTx, cTx); tx <= Math.max(midTx, cTx); tx++)
          pathSet.add(key(tx, cTy))
      }
    }
  }

  // Expand pathSet perpendicular to path direction for wide paths (e.g. canals)
  const worldEnvDef = WORLD_ENV_TILES[environment ?? ''] ?? ENV_TILES[environment ?? '']
  const pathWidth = worldEnvDef?.pathWidth ?? 1
  if (pathWidth > 1) {
    const half = Math.floor(pathWidth / 2)
    const original = new Set(pathSet)
    const extra = new Set<string>()
    for (const k of original) {
      const [tx, ty] = k.split(',').map(Number)
      const hasH = original.has(key(tx + 1, ty)) || original.has(key(tx - 1, ty))
      const hasV = original.has(key(tx, ty + 1)) || original.has(key(tx, ty - 1))
      if (hasH) for (let d = 1; d <= half; d++) { extra.add(key(tx, ty - d)); extra.add(key(tx, ty + d)) }
      if (hasV) for (let d = 1; d <= half; d++) { extra.add(key(tx - d, ty)); extra.add(key(tx + d, ty)) }
      if (hasH && hasV) for (let dx = 1; dx <= half; dx++) for (let dy = 1; dy <= half; dy++) {
        extra.add(key(tx + dx, ty + dy)); extra.add(key(tx + dx, ty - dy))
        extra.add(key(tx - dx, ty + dy)); extra.add(key(tx - dx, ty - dy))
      }
    }
    for (const k of extra) pathSet.add(k)
  }

  await renderPathTiles(container, pathSet, environment, undefined, undefined, worldEnvDef)
}

// ── Connector helpers ──────────────────────────────────────────────────────────

type LineVariant = 'trail' | 'frontier' | 'future' | 'dead'

function lineVariant(
  parentId: string, childId: string,
  statusOf: (id: string) => NodeStatus,
  reachableIds: Set<string>,
): LineVariant {
  const ps = statusOf(parentId), cs = statusOf(childId)
  if (!reachableIds.has(parentId) || !reachableIds.has(childId)) return 'dead'
  if (ps === 'completed' && (cs === 'completed' || cs === 'pending')) return 'trail'
  if (ps === 'completed' && cs === 'available')                       return 'frontier'
  return 'future'
}

function drawConnectorsGfx(
  worldLayer: PIXI.Container,
  rows: QuestNode[][],
  maxRowCols: number,
  mapHeight: number,
  statusOf: (id: string) => NodeStatus,
  reachableIds: Set<string>,
  hiddenNodeIds: Set<string>,
  environment: string | undefined,
): PIXI.Graphics[] {
  const cols = envColors(environment)
  const trail    = parseRgba(cols.trail)
  const frontier = parseRgba(cols.frontier)
  const priority: Record<LineVariant, number> = { frontier: 3, trail: 2, future: 1, dead: 0 }
  const created: PIXI.Graphics[] = []

  for (let ri = 0; ri < rows.length - 1; ri++) {
    const prevRow = rows[ri], nextRow = rows[ri + 1]
    const prevRowCols = prevRow[0]?.rowCols ?? prevRow.length
    const nextRowCols = nextRow[0]?.rowCols ?? nextRow.length
    const vrow = (node: QuestNode, rc: number) => (maxRowCols - rc) / 2 + node.col
    const nextById = new Map(nextRow.map(n => [n.id, n]))
    const best = new Map<string, { variant: LineVariant; pr: number; cr: number }>()

    for (const parent of prevRow) {
      if (hiddenNodeIds.has(parent.id)) continue
      for (const childId of parent.childIds) {
        if (hiddenNodeIds.has(childId)) continue
        const child = nextById.get(childId)
        if (!child) continue
        const pr = vrow(parent, prevRowCols), cr = vrow(child, nextRowCols)
        const key = `${pr}:${cr}`
        const v = lineVariant(parent.id, childId, statusOf, reachableIds)
        const ex = best.get(key)
        if (!ex || priority[v] > priority[ex.variant]) best.set(key, { variant: v, pr, cr })
      }
    }

    const xStart = AVATAR_PADDING + (ri + 1) * COL_WIDTH + ri * CONN_W
    const xMid   = xStart + CONN_W / 2
    const xEnd   = xStart + CONN_W
    const parentCenterX = AVATAR_PADDING + ri * (COL_WIDTH + CONN_W) + COL_WIDTH / 2
    const childCenterX  = AVATAR_PADDING + (ri + 1) * (COL_WIDTH + CONN_W) + COL_WIDTH / 2

    for (const { variant, pr, cr } of best.values()) {
      const y1 = (pr + 0.5) / maxRowCols * mapHeight
      const y2 = (cr + 0.5) / maxRowCols * mapHeight
      const gfx = new PIXI.Graphics()
      gfx.zIndex = (y1 + y2) / 2

      if (variant === 'dead') {
        gfx.moveTo(parentCenterX, y1).lineTo(xStart, y1)
          .bezierCurveTo(xMid, y1, xMid, y2, xEnd, y2)
          .lineTo(childCenterX, y2)
          .stroke({ color: 0xffffff, width: 1, alpha: 0.04 })
      } else if (variant === 'future') {
        const pts = [
          { x: parentCenterX,                y: y1 },
          { x: (parentCenterX + xStart) / 2, y: y1 },
          ...sampleBezier(xStart, y1, xMid, y1, xMid, y2, xEnd, y2),
          { x: (xEnd + childCenterX) / 2,    y: y2 },
          { x: childCenterX,                 y: y2 },
        ]
        gfx.poly(bezierBand(pts, 5)).fill({ color: 0x000000, alpha: 0.15 })
        gfx.poly(bezierBand(pts, 3)).fill({ color: trail.color, alpha: trail.alpha * 0.25 })
      } else {
        const pts = [
          { x: parentCenterX,                y: y1 },
          { x: (parentCenterX + xStart) / 2, y: y1 },
          ...sampleBezier(xStart, y1, xMid, y1, xMid, y2, xEnd, y2),
          { x: (xEnd + childCenterX) / 2,    y: y2 },
          { x: childCenterX,                 y: y2 },
        ]
        const isFront = variant === 'frontier'
        const halfOuter = isFront ? 9 : 7
        const halfInner = isFront ? 6 : 4
        const c = isFront ? frontier : trail

        gfx.poly(bezierBand(pts, halfOuter)).fill({ color: 0x000000, alpha: 0.35 })
        gfx.poly(bezierBand(pts, halfInner)).fill({ color: c.color, alpha: Math.min(c.alpha, 0.50) })

        if (isFront) {
          gfx.moveTo(xStart, y1).bezierCurveTo(xMid, y1, xMid, y2, xEnd, y2)
            .stroke({ color: c.color, width: 22, alpha: 0.18, cap: 'round' })
        }
      }

      worldLayer.addChild(gfx)
      created.push(gfx)
    }
  }

  return created
}

// ── Node markers ──────────────────────────────────────────────────────────────

function markerAlpha(status: NodeStatus, inReachable: boolean): number {
  if (status === 'available' || status === 'pending') return 1
  if (!inReachable || status === 'skipped') return 0.25
  if (status === 'completed') return 0.8
  return 0.8
}

function nodeRoadFill(status: NodeStatus, environment: string | undefined): { color: number; alpha: number } {
  const { trail, frontier } = envColors(environment)
  const t = parseRgba(trail), f = parseRgba(frontier)
  if (status === 'completed' || status === 'pending') return { color: t.color, alpha: Math.min(t.alpha, 0.85) }
  if (status === 'available')                         return { color: f.color, alpha: Math.min(f.alpha, 0.85) }
  return { color: 0x2a2a2a, alpha: 0.5 }
}

async function loadNodeIcon(node: QuestNode): Promise<PIXI.Texture | null> {
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  try {
    if (node.type === 'rest')     return await loadTextureUrl(`${base}sprites/campfire.svg`)
    if (node.type === 'merchant') return await loadTextureUrl(`${base}sprites/merchant.svg`)
    if (node.type === 'event' || node.type === 'memory')
      return await loadTextureUrl(`${base}sprites/event.svg`)
    if (node.type === 'boss' && node.bossAI)
      return await loadTextureUrl(`${base}sprites/boss-${node.bossAI}.svg`)
  } catch { /* fall through to text icon */ }
  return null
}

const WANDER_RANGE = 10

async function buildNodeMarker(
  node: QuestNode, status: NodeStatus, inReachable: boolean,
  app: PIXI.Application, environment: string | undefined,
): Promise<PIXI.Container> {
  const container = new PIXI.Container()

  // bg: two-layer ellipse matching road cross-section (dark outer + coloured inner)
  const bg = new PIXI.Graphics()
  const ry = NODE_RADIUS / 2
  const fill = nodeRoadFill(status, environment)
  bg.ellipse(0, 0, NODE_RADIUS + 2, ry + 2).fill({ color: 0x000000, alpha: 0.55 })
  bg.ellipse(0, 0, NODE_RADIUS, ry).fill({ color: fill.color, alpha: fill.alpha })
  container.addChild(bg)

  // iconLayer: icons + labels, dimmed by status independently of the bg
  const iconLayer = new PIXI.Container()
  container.addChild(iconLayer)

  // Battle/elite nodes show the first enemy unit as icon.
  // Mobile units get animated frames + sine-wave wander; buildings are static.
  const isBattleType = node.type === 'battle' || node.type === 'elite' || node.type === 'boss'
  const isBattleNode = node.type === 'battle' || node.type === 'elite'
  const unitName = isBattleNode && node.enemyDeck?.length ? node.enemyDeck[0] : null
  const isBuilding = unitName ? (getCardUnit(unitName)?.moveSpeed ?? 1) === 0 : false
  const shouldWander = !!unitName && !isBuilding
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL

  let iconAdded = false

  if (unitName && status !== 'completed') {
    if (shouldWander) {
      // Try animated walk frames first, fall back to static
      let wanderSprite: PIXI.Sprite | PIXI.AnimatedSprite | null = null
      try {
        const frames = await loadAnimFrames(unitName, 3)
        const anim = new PIXI.AnimatedSprite(frames)
        anim.animationSpeed = 0.08
        anim.play()
        wanderSprite = anim
      } catch {
        try { wanderSprite = new PIXI.Sprite(await loadSpriteTexture(unitName)) } catch { /* no sprite */ }
      }
      if (wanderSprite) {
        wanderSprite.width = wanderSprite.height = NODE_RADIUS * 1.2
        wanderSprite.anchor.set(0.5)
        iconLayer.addChild(wanderSprite)
        iconAdded = true
        // Unique per-node phase/frequency so sprites don't move in sync
        const seed = (hashStr(node.id) >>> 0) / 0xffffffff
        const phase = seed * Math.PI * 2
        const sx = 0.00065 + seed * 0.00035
        const sy = 0.00045 + ((seed * 1.618) % 1) * 0.00035
        let t = seed * 2000
        const ws = wanderSprite
        const tick = (ticker: PIXI.Ticker) => {
          t += ticker.deltaMS
          ws.x = Math.sin(t * sx + phase) * WANDER_RANGE
          ws.y = Math.cos(t * sy + phase * 1.414) * WANDER_RANGE
        }
        app.ticker.add(tick)
      }
    } else {
      // Building enemy — static sprite, no wander
      try {
        const sprite = new PIXI.Sprite(await loadSpriteTexture(unitName))
        sprite.width = sprite.height = NODE_RADIUS * 1.1
        sprite.anchor.set(0.5)
        iconLayer.addChild(sprite)
        iconAdded = true
      } catch { /* no sprite */ }
    }
  }

  if (isBattleType && status === 'completed' && !iconAdded) {
    try {
      const tomb = new PIXI.Sprite(await loadTextureUrl(`${base}sprites/tombstone.svg`))
      tomb.width = tomb.height = NODE_RADIUS * 1.1
      tomb.anchor.set(0.5)
      iconLayer.addChild(tomb)
      iconAdded = true
    } catch { /* fall through */ }
  }

  if (node.type === 'rest' && !iconAdded) {
    try {
      const frames = await loadAnimFrames('campfire', 3)
      const anim = new PIXI.AnimatedSprite(frames)
      anim.animationSpeed = 0.06; anim.play()
      anim.width = anim.height = NODE_RADIUS * 1.3; anim.anchor.set(0.5)
      iconLayer.addChild(anim); iconAdded = true
    } catch { /* fall through */ }
  }

  if ((node.type === 'event' || node.type === 'memory') && !iconAdded) {
    try {
      const frames = await loadAnimFrames('event', 3)
      const anim = new PIXI.AnimatedSprite(frames)
      anim.animationSpeed = 0.04; anim.play()
      anim.width = anim.height = NODE_RADIUS * 1.1; anim.anchor.set(0.5)
      iconLayer.addChild(anim); iconAdded = true
    } catch { /* fall through */ }
  }

  if (!iconAdded) {
    const texture = await loadNodeIcon(node)
    if (texture) {
      const sprite = new PIXI.Sprite(texture)
      sprite.width = sprite.height = NODE_RADIUS * 1.1
      sprite.anchor.set(0.5)
      iconLayer.addChild(sprite)
    } else {
      const t = new PIXI.Text({ text: NODE_ICON[node.type] ?? '?',
        style: { fontSize: 14, fill: '#ffffff', fontFamily: 'monospace' } })
      t.anchor.set(0.5)
      iconLayer.addChild(t)
    }
  }

  const badge = new PIXI.Text({ text: NODE_LABEL[node.type] ?? node.type.toUpperCase(),
    style: { fontSize: 8, fill: '#999999', fontFamily: 'monospace', fontWeight: 'bold' } })
  badge.anchor.set(0.5, 1)
  badge.y = -ry - 3
  iconLayer.addChild(badge)

  const nameLabel = new PIXI.Text({ text: node.label ?? '',
    style: { fontSize: 9, fill: '#dddddd', fontFamily: 'monospace' } })
  nameLabel.anchor.set(0.5, 0)
  nameLabel.y = ry + 4
  iconLayer.addChild(nameLabel)

  if (status === 'completed' && !isBattleType) {
    const st = new PIXI.Text({ text: '✓', style: { fontSize: 11, fill: '#44cc44' } })
    st.anchor.set(1, 1); st.position.set(NODE_RADIUS - 1, ry - 1)
    iconLayer.addChild(st)
  } else if (status === 'skipped') {
    const st = new PIXI.Text({ text: '╳', style: { fontSize: 11, fill: '#884444' } })
    st.anchor.set(1, 1); st.position.set(NODE_RADIUS - 1, ry - 1)
    iconLayer.addChild(st)
  }

  iconLayer.alpha = markerAlpha(status, inReachable)

  const DECOR_COLS_CONST = 8
  if (node.decorTiles?.length) {
    const decorBase = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
    const decorUrl  = `${decorBase}${WORLD_DECOR_FILE.slice(1)}`
    for (let i = 0; i < node.decorTiles.length; i++) {
      try {
        const tex = await loadTileTexture(decorUrl, node.decorTiles[i], DECOR_COLS_CONST)
        const sprite = new PIXI.Sprite(tex)
        const off = node.decorOffsets?.[i] ?? [-16, -16]
        sprite.position.set(off[0], off[1])
        container.addChild(sprite)
      } catch { /* tile unavailable */ }
    }
  }

  return container
}

function updateMarkerStyle(
  marker: PIXI.Container, status: NodeStatus, inReachable: boolean,
): void {
  // iconLayer is child index 1; bg (index 0) stays fully opaque
  ;(marker.getChildAt(1) as PIXI.Container).alpha = markerAlpha(status, inReachable)
}




// ── Main component ─────────────────────────────────────────────────────────────

export function NodeMapRederer({ id, run, worldMap, clearedNodeIds, restrictedNodeIds, onFoggedTap, mapWidth: mapWidthProp, mapHeight: mapHeightProp, setPeekNode, showPaths }: Props) {
  const isFreeform = useMemo(() => Object.values(worldMap.nodes).some(n => n.x !== undefined), [worldMap.nodes])

  const availableIds      = useMemo(() => run ? getAvailableNodeIds(worldMap.nodes, run) : [], [worldMap.nodes, run])
  const rows              = useMemo(() => buildRows(worldMap.nodes), [worldMap.nodes])
  const maxRowCols        = useMemo(
    () => rows.length ? Math.max(...rows.map(r => r[0]?.rowCols ?? r.length)) : 1,
    [rows]
  )
  const reachableIds      = useMemo(() => run ? computeReachableIds(worldMap.nodes, run) : new Set<string>(), [worldMap.nodes, run])
  const discoveredFragIds = useMemo(() => getDiscoveredFragmentIds(), [])
  const hiddenNodeIds     = useMemo(
    () => run ? computeHiddenNodeIds(worldMap.nodes, run, discoveredFragIds) : new Set<string>(),
    [worldMap.nodes, run, discoveredFragIds],
  )

  const mapHeight = mapHeightProp ?? (isFreeform ? 520 : maxRowCols * ROW_HEIGHT)
  const mapWidth  = mapWidthProp  ?? (isFreeform ? 700 : AVATAR_PADDING + rows.length * COL_WIDTH + Math.max(0, rows.length - 1) * CONN_W)



  const canvasRef        = useRef<HTMLDivElement>(null)
  const mapRef           = useRef<HTMLDivElement>(null)
  const appRef           = useRef<PIXI.Application | null>(null)
  const connGfxListRef   = useRef<PIXI.Graphics[]>([])
  const groundRef        = useRef<PIXI.Container | null>(null)
  const worldRef         = useRef<PIXI.Container | null>(null)
  const nodeLRef         = useRef<PIXI.Container | null>(null)
  const markersRef       = useRef<Map<string, PIXI.Container>>(new Map())
  const avatarRef    = useRef<PIXI.AnimatedSprite | null>(null)
  const isWalkingRef = useRef(false)
  const peekNodeRef  = useRef<QuestNode | null>(null)
  const deadRef      = useRef(false)

  // Always-current state for use inside async PixiJS callbacks
  const stateRef = useRef({ availableIds, reachableIds, hiddenNodeIds, run })
  stateRef.current = { availableIds, reachableIds, hiddenNodeIds, run }

  useEffect(() => () => { deadRef.current = true }, [])

  usePixiApp(canvasRef, mapWidth, mapHeight, async (app) => {
    // Reset liveness flag — deadRef may be true from React Strict Mode's first-mount cleanup
    deadRef.current = false
    appRef.current = app
    // PixiJS sets touch-action:none on the canvas; restore pan so the
    // nm-map container can still scroll when the user swipes.
    app.canvas.style.touchAction = 'pan-x pan-y'

    // ── Freeform (world map) rendering ────────────────────────────────────────
    if (isFreeform) {
      const currentLocation = getCurrentWorldLocation()
      const baseContainer  = new PIXI.Container()
      const riverContainer = new PIXI.Container()
      const bgContainer    = new PIXI.Container()
      const pathContainer  = new PIXI.Container()
      const worldLayer     = new PIXI.Container()
      app.stage.addChild(baseContainer, riverContainer, bgContainer, pathContainer, worldLayer)

      worldRef.current = worldLayer

      const envDef = WORLD_ENV_TILES.farmland
      buildTerrainGfx(baseContainer, riverContainer, worldLayer,
        { environment: 'farmland', envDef, terrainItems: [], rivers: [] },
        mapWidth, mapHeight)
      buildBorderGfx(worldLayer, { envDef }, mapWidth, mapHeight)

      buildBgTileGfx(bgContainer, { environment: 'farmland', envDef }, mapWidth, mapHeight)
        .catch(e => console.error('[NodeMapRederer] bg tiles failed', e))

      buildWorldPathTiles(pathContainer, Object.values(worldMap.nodes), envDef)
        .catch(e => console.error('[NodeMapRederer] world path tiles failed', e))

      // Node circles and decor
      const base     = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
      const decorUrl = `${base}${WORLD_DECOR_FILE.slice(1)}`
      const DECOR_COLS = 8

      for (const node of Object.values(worldMap.nodes)) {
        if (deadRef.current) return

        // Admin-disabled town: the map-wide fog overlay below hides it visually;
        // this is just an invisible hit area so a tap still reports the fog message.
        if (restrictedNodeIds?.has(node.id)) {
          const fogContainer = new PIXI.Container()
          fogContainer.position.set(node.x!, node.y!)
          fogContainer.hitArea = new PIXI.Circle(0, 0, 26)
          makeClickable(fogContainer, () => {
            if (isWalkingRef.current) return
            onFoggedTap?.(node)
          })
          worldLayer.addChild(fogContainer)
          continue
        }

        const available = getWorldNodeStatus(node, clearedNodeIds ?? new Set(), restrictedNodeIds) !== 'locked'
        const isCurrent = node.id === currentLocation
        const container = new PIXI.Container()
        container.position.set(node.x!, node.y!)

        const circle = new PIXI.Graphics()
        circle.circle(0, 0, 22)
          .fill({ color: isCurrent ? 0x1a6b1a : available ? 0x3a3a20 : 0x222218, alpha: 0.9 })
          .stroke({ color: isCurrent ? 0x66ff66 : available ? 0xccaa44 : 0x444430, width: 2 })
        container.addChild(circle)

        if (node.decorTiles?.length) {
          for (let i = 0; i < node.decorTiles.length; i++) {
            try {
              const tex = await loadTileTexture(decorUrl, node.decorTiles[i], DECOR_COLS)
              if (deadRef.current) return
              const sprite = new PIXI.Sprite(tex)
              const off = node.decorOffsets?.[i] ?? [-16, -16]
              sprite.position.set(off[0], off[1])
              container.addChild(sprite)
            } catch { /* tile unavailable */ }
          }
        }

        const status = getWorldNodeStatus(node, clearedNodeIds ?? new Set(), restrictedNodeIds)
        if (status === 'locked') {
          container.alpha = 0.38
          const lockLabel = new PIXI.Text({ text: '🔒',
            style: { fontSize: 13, fontFamily: 'monospace' } })
          lockLabel.anchor.set(0.5, 1)
          lockLabel.position.set(0, -25)
          container.addChild(lockLabel)
        }

        const label = new PIXI.Text({ text: node.label,
          style: { fontSize: 11, fill: '#ffffff', fontFamily: 'monospace',
            dropShadow: { alpha: 1, blur: 3, distance: 1, color: '#000000' } } })
        label.anchor.set(0.5, 0)
        label.position.set(0, 26)
        container.addChild(label)

        if (status !== 'locked') {
          makeClickable(container, () => {
            if (isWalkingRef.current) return
            peekNodeRef.current = null
            handleWalkFreeform(node)
          })
        }

        worldLayer.addChild(container)
      }

      // Fog of war — hides the whole map except unlocked towns and the routes
      // between them. Uses the same canvas 2D destination-out "reveal hole"
      // technique as HubTownCanvas's night overlay, drawn once (this scene is
      // static, unlike the per-frame torch light that follows the avatar).
      if (restrictedNodeIds && restrictedNodeIds.size > 0) {
        const fogCanvas = document.createElement('canvas')
        fogCanvas.width  = mapWidth
        fogCanvas.height = mapHeight
        const fogCtx = fogCanvas.getContext('2d')!
        fogCtx.fillStyle = 'rgba(195,200,210,0.94)'
        fogCtx.fillRect(0, 0, mapWidth, mapHeight)
        fogCtx.globalCompositeOperation = 'destination-out'
        fogCtx.lineCap  = 'round'
        fogCtx.lineJoin = 'round'

        const seenEdges = new Set<string>()
        for (const node of Object.values(worldMap.nodes)) {
          if (restrictedNodeIds.has(node.id) || node.x === undefined || node.y === undefined) continue

          // Soft halo revealing the unlocked town itself.
          const grad = fogCtx.createRadialGradient(node.x, node.y, 28, node.x, node.y, 85)
          grad.addColorStop(0, 'rgba(0,0,0,1)')
          grad.addColorStop(1, 'rgba(0,0,0,0)')
          fogCtx.fillStyle = grad
          fogCtx.beginPath()
          fogCtx.arc(node.x, node.y, 85, 0, Math.PI * 2)
          fogCtx.fill()

          // Soft swath revealing the route to every other unlocked, connected node.
          for (const connId of (node.connections ?? node.childIds)) {
            if (restrictedNodeIds.has(connId)) continue
            const edgeKey = [node.id, connId].sort().join('|')
            if (seenEdges.has(edgeKey)) continue
            seenEdges.add(edgeKey)
            const target = worldMap.nodes[connId]
            if (!target || target.x === undefined || target.y === undefined) continue

            // Follow the same elbow route (horizontal → vertical → horizontal via
            // the midpoint column) that buildWorldPathTiles draws the road tiles
            // along, so the reveal swath fully covers the actual bent road art
            // instead of just a straight line between the two node centers.
            const midX = (node.x + target.x) / 2
            const path = new Path2D()
            path.moveTo(node.x, node.y)
            path.lineTo(midX, node.y)
            path.lineTo(midX, target.y)
            path.lineTo(target.x, target.y)
            fogCtx.strokeStyle = 'rgba(0,0,0,1)'
            fogCtx.globalAlpha = 0.45
            fogCtx.lineWidth = 130
            fogCtx.stroke(path)
            fogCtx.globalAlpha = 1
            fogCtx.lineWidth = 60
            fogCtx.stroke(path)
          }
        }
        fogCtx.globalCompositeOperation = 'source-over'

        const fogTexture = PIXI.Texture.from(fogCanvas)
        const fogSprite  = new PIXI.Sprite(fogTexture)
        fogSprite.width     = mapWidth
        fogSprite.height    = mapHeight
        fogSprite.eventMode = 'none' // must not block taps on the (invisible) restricted-node hit areas
        app.stage.addChild(fogSprite)
      }

      // Pulsing ring on currentLocation node
      const curNode = Object.values(worldMap.nodes).find(n => n.id === currentLocation)
      if (curNode) {
        const ring = new PIXI.Graphics()
        ring.position.set(curNode.x!, curNode.y!)
        worldLayer.addChild(ring)
        let t = 0
        app.ticker.add(() => {
          t += 0.04
          ring.clear()
          ring.circle(0, 0, 25 + Math.sin(t) * 5)
            .stroke({ color: 0x55ff55, width: 2, alpha: 0.4 + Math.sin(t) * 0.25 })
        })
      }

      // Avatar
      const avatarName = loadPlayerAvatar()
      let avatarTextures: PIXI.Texture[]
      try {
        avatarTextures = await loadAnimFrames(avatarName, 3)
      } catch {
        try { avatarTextures = [await loadSpriteTexture(avatarName)] } catch { return }
      }
      if (deadRef.current) return

      const avatar = new PIXI.AnimatedSprite(avatarTextures)
      avatar.animationSpeed = 0.12
      avatar.anchor.set(0.5, 1)
      avatar.width = avatar.height = AVATAR_SIZE

      const startNode = curNode ?? Object.values(worldMap.nodes)[0]
      avatar.position.set(startNode.x!, startNode.y!)
      avatar.stop()
      worldLayer.addChild(avatar)
      avatarRef.current = avatar

      return
    }

    // ── Campaign (grid) rendering ─────────────────────────────────────────────
    if (!run) {
      console.error('[NodeMapRederer] grid mode requires run prop')
      return
    }

    const groundLayer = new PIXI.Container()
    const worldLayer  = new PIXI.Container()
    const nodeLayer   = new PIXI.Container()
    worldLayer.sortableChildren = true
    nodeLayer.sortableChildren  = true
    app.stage.addChild(groundLayer, worldLayer, nodeLayer)
    groundRef.current = groundLayer
    worldRef.current  = worldLayer
    nodeLRef.current  = nodeLayer

    // Sub-containers within groundLayer — z-order: base → bg → rivers → path → decor
    const baseContainer  = new PIXI.Container()
    const bgContainer    = new PIXI.Container()
    const riverContainer = new PIXI.Container()
    const pathContainer  = new PIXI.Container()
    const decorContainer = new PIXI.Container()
    groundLayer.addChild(baseContainer, bgContainer, riverContainer, pathContainer, decorContainer)

    const actEnvDef = WORLD_ENV_TILES[worldMap.environment ?? ''] ?? ENV_TILES[worldMap.environment ?? '']
    buildTerrainGfx(baseContainer, riverContainer, worldLayer,
      { environment: worldMap.environment, envDef: actEnvDef, terrainSeed: worldMap.terrainSeed, terrainItems: worldMap.terrainItems, rivers: worldMap.rivers, id: id },
      mapWidth, mapHeight)
    buildBgTileGfx(bgContainer, { environment: worldMap.environment, envDef: actEnvDef }, mapWidth, mapHeight)
      .catch(e => console.error('[NodeMap] bg tiles failed', e))
    buildPathTileGfx(pathContainer, worldMap.environment ?? '', rows, maxRowCols, mapHeight)
      .catch(e => console.error('[NodeMap] path tiles failed', e))
    buildDecorGfx(decorContainer, { environment: worldMap.environment, envDef: actEnvDef, id: id }, mapWidth, mapHeight)
      .catch(e => console.error('[NodeMap] decor tiles failed', e))

    // Campfire at start position
    try {
      const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
      const cfTex = await loadTextureUrl(`${base}sprites/campfire.svg`)
      if (!deadRef.current) {
        const cf = new PIXI.Sprite(cfTex)
        cf.width = cf.height = 32
        cf.anchor.set(0.5)
        const sp = startPos(mapHeight)
        cf.position.set(sp.x, sp.y)
        cf.alpha = 0.75
        cf.zIndex = sp.y
        worldLayer.addChild(cf)
      }
    } catch { /* no campfire sprite */ }

    // Connectors
    const { availableIds: aids, reachableIds: rids, hiddenNodeIds: hids } = stateRef.current
    connGfxListRef.current = drawConnectorsGfx(worldLayer, rows, maxRowCols, mapHeight,
      id => getNodeStatus(id, aids, run), rids, hids, worldMap.environment)

    // Node markers
    for (let ri = 0; ri < rows.length; ri++) {
      const rowNodes = rows[ri]
      const rowCols  = rowNodes[0]?.rowCols ?? rowNodes.length
      for (const node of rowNodes) {
        if (hids.has(node.id)) continue
        if (deadRef.current) return
        const pos    = nodePosition(ri, node, rowCols, maxRowCols)
        const status = getNodeStatus(node.id, aids, run)
        const marker = await buildNodeMarker(node, status, rids.has(node.id), app, worldMap.environment)
        if (deadRef.current) return
        makeClickable(marker, () => {
          if (isWalkingRef.current) return
          const { availableIds: a, run: rr } = stateRef.current
          if (!rr || getNodeStatus(node.id, a, rr) !== 'available') return
          handleWalk(node, pos)
        })
        marker.position.set(pos.x, pos.y)
        marker.zIndex = pos.y
        nodeLayer.addChild(marker)
        markersRef.current.set(node.id, marker)
      }
    }

    // Avatar
    const avatarName = loadPlayerAvatar()
    let avatarTextures: PIXI.Texture[]
    try {
      avatarTextures = await loadAnimFrames(avatarName, 3)
    } catch {
      try { avatarTextures = [await loadSpriteTexture(avatarName)] } catch { return }
    }
    if (deadRef.current) return

    const avatar = new PIXI.AnimatedSprite(avatarTextures)
    avatar.animationSpeed = 0.12
    avatar.anchor.set(0.5, 1)
    avatar.width = avatar.height = AVATAR_SIZE

    const sp = startPos(mapHeight)
    avatar.position.set(sp.x, sp.y)

    const lastNode = lastCompletedNode(worldMap.nodes, run)
    if (lastNode) {
      const ri = rows.findIndex(row => row.some(n => n.id === lastNode.id))
      if (ri >= 0) {
        const rowNodes = rows[ri]
        const pos = nodePosition(ri, lastNode, rowNodes[0]?.rowCols ?? rowNodes.length, maxRowCols)
        avatar.position.set(pos.x, pos.y)
      }
    }

    avatar.stop()
    avatar.zIndex = 100000
    nodeLayer.addChild(avatar)
    avatarRef.current = avatar

    app.ticker.add(() => { worldLayer.sortChildren(); nodeLayer.sortChildren() })
  })

  // Show/hide bezier path overlays
  useEffect(() => {
    for (const g of connGfxListRef.current) g.visible = showPaths
  }, [showPaths])

  // Redraw connectors + update marker styles when run state changes
  useEffect(() => {
    if (isFreeform || !run) return
    const wl = worldRef.current
    if (!wl) return
    for (const g of connGfxListRef.current) { wl.removeChild(g); g.destroy() }
    connGfxListRef.current = drawConnectorsGfx(wl, rows, maxRowCols, mapHeight,
      id => getNodeStatus(id, availableIds, run), reachableIds, hiddenNodeIds, worldMap.environment)
    for (const g of connGfxListRef.current) g.visible = showPaths
    for (const [nodeId, marker] of markersRef.current) {
      const status = getNodeStatus(nodeId, availableIds, run)
      updateMarkerStyle(marker, status, reachableIds.has(nodeId))
    }
  }, [run, availableIds, reachableIds, hiddenNodeIds]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to current node on mount
  useEffect(() => {
    if (isFreeform || !run) return
    const mapEl = mapRef.current
    const currentNodeId = run.pendingNodeId
      ?? rows.flatMap(r => r).find(n => availableIds.includes(n.id))?.id
    if (!mapEl || !currentNodeId) return
    const node = worldMap.nodes[currentNodeId]
    if (!node) return
    const ri = rows.findIndex(row => row.some(n => n.id === node.id))
    if (ri < 0) return
    const rowNodes = rows[ri]
    const pos = nodePosition(ri, node, rowNodes[0]?.rowCols ?? rowNodes.length, maxRowCols)
    mapEl.scrollLeft = pos.x - mapEl.clientWidth / 2
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to the player's current world location on mount (freeform world map)
  useEffect(() => {
    if (!isFreeform) return
    const mapEl = mapRef.current
    if (!mapEl) return
    const node = worldMap.nodes[getCurrentWorldLocation()]
    if (!node || node.x === undefined || node.y === undefined) return
    mapEl.scrollLeft = node.x - mapEl.clientWidth / 2
    mapEl.scrollTop  = node.y - mapEl.clientHeight / 2
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleWalk(node: QuestNode, pos: { x: number; y: number }) {
    const app    = appRef.current
    const avatar = avatarRef.current
    if (!app || !avatar || isWalkingRef.current) return
    isWalkingRef.current = true
    avatar.play()
    emitSound('mapFootstep')
    tweenTo(avatar, pos.x, pos.y, WALK_DURATION, app).then(() => {
      avatar.stop()
      isWalkingRef.current = false
      setPeekNode(node)
    })
  }

  function handleWalkFreeform(node: QuestNode) {
    const app    = appRef.current
    const avatar = avatarRef.current
    if (!app || !avatar || isWalkingRef.current || node.x === undefined) return
    isWalkingRef.current = true
    avatar.play()
    emitSound('mapFootstep')
    tweenTo(avatar, node.x, node.y!, WALK_DURATION, app).then(() => {
      avatar.stop()
      isWalkingRef.current = false
      setPeekNode(node)
    })
  }

  return (
        <div
          className={`nm-map u-flex u-grow u-items-c${worldMap.environment ? ` nm-map--${worldMap.environment}` : ''}`}
          ref={mapRef}
        >
          <div ref={canvasRef} style={{ display: 'block', flexShrink: 0, width: mapWidth, height: mapHeight, margin: 'auto' }} />
        </div>

  )
}
