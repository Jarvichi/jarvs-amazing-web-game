import React, { useMemo, useRef, useEffect, useState } from 'react'
import * as PIXI from 'pixi.js'
import { User } from 'firebase/auth'
import { emitSound } from '../../../game/sound'
import { getDiscoveredFragmentIds } from '../../../game/codex'
import { Act, QuestNode, RunState, ReplayModifier, getAvailableNodeIds, getProtectedFragmentNodeIds, loadNodeHistory, getModifiersByCount, ALL_CONSUMABLES, loadPlayerAvatar, ARCHETYPE_DEFS, WorldMap } from '../../../game/questline'
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
import { loadSpriteTexture, loadAnimFrames, loadTextureUrl, loadTileTexture, makeClickable, tweenAlongPath } from '../../../utils/pixiHelpers'
import { ENV_TILES, TILE_SIZE, type EnvTileDef } from '../../../data/tiles/tileIndex'
import { WORLD_ENV_TILES, WORLD_DECOR_FILE } from '../../../data/tiles/worldTileIndex'
import { GIFT_OWNER_UID } from '../../../game/gifts'
import { hashStr, envColors, parseRgba, sampleBezier, bezierBand } from '../../../utils/mapUtils'
import { renderPathTiles } from '../../../utils/tileLookup'
import { buildTerrainGfx, buildBgTileGfx, buildDecorGfx, buildBorderGfx } from '../../../utils/terrainLayer'
import { NODE_ICON, NODE_LABEL, mapLabelStyle } from '../../ui/NodeMap/constants'
import { COL_WIDTH, ROW_HEIGHT, AVATAR_PADDING, CONN_W, nodeCenter, startPos,
  elbowCorners, edgeCorners, cornerPolyline, fillCornerPath, worldWalkRoute,
  type PixelPoint } from '../../ui/NodeMap/nodeLayout'
import { getCurrentWorldLocation } from '../../../game/world/worldState'
import { NodePeekModal } from '../../ui/NodeMap/NodePeekModal'
import { PALETTE_HEX } from '../../../theme'

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



const AVATAR_SIZE    = 36
const WALK_DURATION  = 700
// Pace calibrated so a straight hop between adjacent grid columns still takes
// WALK_DURATION; longer routes take proportionally longer rather than sprinting.
const WALK_SPEED     = (COL_WIDTH + CONN_W) / WALK_DURATION
const WALK_MIN_MS    = 400
const WALK_MAX_MS    = 2400
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

function routeDuration(route: PixelPoint[]): number {
  let len = 0
  for (let i = 1; i < route.length; i++)
    len += Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y)
  return Math.min(Math.max(len / WALK_SPEED, WALK_MIN_MS), WALK_MAX_MS)
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

      const corners = edgeCorners(
        { x: node.x, y: node.y! }, { x: target.x, y: target.y! },
        node.connectionWaypoints?.[connId], T,
      )
      fillCornerPath(pathSet, key, corners)
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

function computeHiddenNodeIds(nodes: Record<string, QuestNode>, run: RunState, discoveredFragIds: Set<string>, protectedNodeIds: Set<string>): Set<string> {
  const ids = new Set<string>()
  for (const node of Object.values(nodes)) {
    if (node.type !== 'memory' || !node.fragmentId) continue
    if (protectedNodeIds.has(node.id)) continue // Memory Charm guarantees visibility
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
  return nodeCenter(rowIndex, node.col, rowCols, maxRowCols)
}

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
    const sp = startPos(mapHeight)
    const startX = sp.x
    const startY = sp.y
    const firstColCenterX = nodeCenter(0, 0, firstRowCols, maxRowCols).x
    const midX = (startX + firstColCenterX) / 2

    const sTx = Math.floor(startX / T), sTy = Math.floor(startY / T)
    const midTx = Math.floor(midX / T)
    const fTx = Math.floor(firstColCenterX / T)

    for (const node of firstRow) {
      const ny = nodeCenter(0, node.col, firstRowCols, maxRowCols).y
      const nTy = Math.floor(ny / T)

      for (let tx = Math.min(sTx, midTx); tx <= Math.max(sTx, midTx); tx++)
        pathSet.add(key(tx, sTy))
      for (let ty = Math.min(sTy, nTy); ty <= Math.max(sTy, nTy); ty++)
        pathSet.add(key(midTx, ty))
      for (let tx = Math.min(midTx, fTx); tx <= Math.max(midTx, fTx); tx++)
        pathSet.add(key(tx, nTy))
    }
  }

  // Row-to-row connector paths. Built from a global id -> row-index lookup
  // (not just adjacent rows) so a child living 2+ columns ahead of its
  // parent still gets a path laid all the way to it.
  const nodeRowIndex = new Map<string, { ri: number; rowCols: number; node: QuestNode }>()
  for (let ri = 0; ri < rows.length; ri++) {
    const rowCols = rows[ri][0]?.rowCols ?? rows[ri].length
    for (const node of rows[ri]) nodeRowIndex.set(node.id, { ri, rowCols, node })
  }

  for (const row of rows) {
    for (const parent of row) {
      const parentEntry = nodeRowIndex.get(parent.id)!
      for (const childId of parent.childIds) {
        const childEntry = nodeRowIndex.get(childId)
        if (!childEntry || childEntry.ri <= parentEntry.ri) continue

        const p = nodeCenter(parentEntry.ri, parent.col, parentEntry.rowCols, maxRowCols)
        const c = nodeCenter(childEntry.ri, childEntry.node.col, childEntry.rowCols, maxRowCols)
        const parentCenterX = p.x, childCenterX = c.x
        const xMid = (parentCenterX + COL_WIDTH / 2 + childCenterX - COL_WIDTH / 2) / 2

        const y1 = p.y
        const y2 = c.y

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

  // Global id -> row-index lookup (not just adjacent rows) so a child living
  // 2+ columns ahead of its parent still gets a connector drawn to it.
  const nodeIndex = new Map<string, { ri: number; rowCols: number; node: QuestNode }>()
  for (let ri = 0; ri < rows.length; ri++) {
    const rowCols = rows[ri][0]?.rowCols ?? rows[ri].length
    for (const node of rows[ri]) nodeIndex.set(node.id, { ri, rowCols, node })
  }
  const best = new Map<string, { variant: LineVariant; parentRi: number; childRi: number; pCol: number; cCol: number; pRowCols: number; cRowCols: number }>()
  for (const { node: parent, ri: parentRi, rowCols: parentRowCols } of nodeIndex.values()) {
    if (hiddenNodeIds.has(parent.id)) continue
    for (const childId of parent.childIds) {
      if (hiddenNodeIds.has(childId)) continue
      const childEntry = nodeIndex.get(childId)
      if (!childEntry || childEntry.ri <= parentRi) continue
      const key = `${parentRi}:${parent.col}:${parentRowCols}:${childEntry.ri}:${childEntry.node.col}:${childEntry.rowCols}`
      const v = lineVariant(parent.id, childId, statusOf, reachableIds)
      const ex = best.get(key)
      if (!ex || priority[v] > priority[ex.variant]) best.set(key, {
        variant: v, parentRi, childRi: childEntry.ri,
        pCol: parent.col, cCol: childEntry.node.col,
        pRowCols: parentRowCols, cRowCols: childEntry.rowCols,
      })
    }
  }

  for (const { variant, parentRi, childRi, pCol, cCol, pRowCols, cRowCols } of best.values()) {
    const p = nodeCenter(parentRi, pCol, pRowCols, maxRowCols)
    const c = nodeCenter(childRi, cCol, cRowCols, maxRowCols)
    const parentCenterX = p.x, childCenterX = c.x
    const xStart = parentCenterX + COL_WIDTH / 2
    const xEnd   = childCenterX  - COL_WIDTH / 2
    const xMid   = (xStart + xEnd) / 2
    const y1 = p.y
    const y2 = c.y
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

  return created
}

// ── Node markers ──────────────────────────────────────────────────────────────

function markerAlpha(status: NodeStatus, inReachable: boolean): number {
  if (status === 'available' || status === 'pending') return 1
  if (!inReachable || status === 'skipped') return 0.25
  if (status === 'completed') return 0.8
  return 0.8
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

// Kept under half the 32px road width — with no marker pad beneath them,
// wandering enemy sprites would otherwise stray visibly off the road.
const WANDER_RANGE = 6

async function buildNodeMarker(
  node: QuestNode, status: NodeStatus, inReachable: boolean,
  app: PIXI.Application, environment: string | undefined,
): Promise<PIXI.Container> {
  const container = new PIXI.Container()

  // bg: no marker pad — a filled ellipse here was wider than the 32px road it sat
  // on and read as a hole punched through bright terrain (the sky acts' cloud
  // floor especially). All that is left is a soft contact shadow to ground the
  // icon on the road, plus a frontier-coloured ring on nodes you can actually
  // travel to — the one piece of status the pad's fill used to carry.
  const bg = new PIXI.Graphics()
  const ry = NODE_RADIUS / 2
  bg.ellipse(0, ry - 2, 14, 5).fill({ color: 0x000000, alpha: 0.28 })
  bg.ellipse(0, ry - 2, 9, 3).fill({ color: 0x000000, alpha: 0.22 })
  if (status === 'available' || status === 'pending') {
    const f = parseRgba(envColors(environment).frontier)
    bg.ellipse(0, 0, NODE_RADIUS - 4, ry + 2)
      .stroke({ color: 0x000000, width: 3, alpha: 0.35 })
    bg.ellipse(0, 0, NODE_RADIUS - 4, ry + 2)
      .stroke({ color: f.color, width: 1.5, alpha: Math.min(f.alpha, 0.85) })
  }
  container.addChild(bg)

  // iconLayer: icons + labels, dimmed by status independently of the bg
  const iconLayer = new PIXI.Container()
  iconLayer.label = 'icons'
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
        // The sprite load above is awaited, so the app can already have been
        // destroyed by the time we get here — its ticker is null then.
        app.ticker?.add(tick)
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
        style: mapLabelStyle(16), resolution: 2 })
      t.anchor.set(0.5)
      iconLayer.addChild(t)
    }
  }

  const badge = new PIXI.Text({ text: NODE_LABEL[node.type] ?? node.type.toUpperCase(),
    style: { ...mapLabelStyle(9), fontWeight: 'bold' }, resolution: 2 })
  badge.anchor.set(0.5, 1)
  badge.y = -ry - 3
  iconLayer.addChild(badge)

  const nameLabel = new PIXI.Text({ text: node.label ?? '',
    style: mapLabelStyle(10), resolution: 2 })
  nameLabel.anchor.set(0.5, 0)
  nameLabel.y = ry + 4
  iconLayer.addChild(nameLabel)

  if (status === 'completed' && !isBattleType) {
    const st = new PIXI.Text({ text: '✓', style: mapLabelStyle(11, '#66ff66'), resolution: 2 })
    st.anchor.set(1, 1); st.position.set(NODE_RADIUS - 1, ry - 1)
    iconLayer.addChild(st)
  } else if (status === 'skipped') {
    const st = new PIXI.Text({ text: '╳', style: mapLabelStyle(11, '#ff8888'), resolution: 2 })
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
  // bg (the contact shadow) stays fully opaque; only the icons + labels dim
  const iconLayer = marker.getChildByLabel('icons')
  if (iconLayer) iconLayer.alpha = markerAlpha(status, inReachable)
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
  const protectedNodeIds  = useMemo(
    () => run ? getProtectedFragmentNodeIds(worldMap.nodes, run, discoveredFragIds) : new Set<string>(),
    [worldMap.nodes, run, discoveredFragIds],
  )
  const hiddenNodeIds     = useMemo(
    () => run ? computeHiddenNodeIds(worldMap.nodes, run, discoveredFragIds, protectedNodeIds) : new Set<string>(),
    [worldMap.nodes, run, discoveredFragIds, protectedNodeIds],
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
  // Where the avatar actually stands on the world map. Tracked separately from
  // getCurrentWorldLocation(), which only advances once travel is confirmed —
  // peeking a town and backing out still leaves the avatar standing there.
  const avatarNodeIdRef = useRef<string>(getCurrentWorldLocation())
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
          .stroke({ color: isCurrent ? 0x66ff66 : available ? PALETTE_HEX.accentGold : 0x444430, width: 2 })
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
          style: mapLabelStyle(11), resolution: 2 })
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
            const nodeX = node.x, nodeY = node.y, targetX = target.x, targetY = target.y

            // Follow the exact same corner list buildWorldPathTiles draws the
            // road tiles along (including any hand-authored connectionWaypoints),
            // so the reveal swath fully covers the actual bent road art instead
            // of a straight line — and can never drift out of sync with it,
            // since both come from the same edgeCorners() call.
            const from = { x: nodeX, y: nodeY }, to = { x: targetX, y: targetY }
            const pts = cornerPolyline(
              edgeCorners(from, to, node.connectionWaypoints?.[connId], TILE_SIZE), from, to,
            )
            const path = new Path2D()
            pts.forEach((p, i) => (i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y)))
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
    connGfxListRef.current = drawConnectorsGfx(worldLayer, rows, maxRowCols,
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
    connGfxListRef.current = drawConnectorsGfx(wl, rows, maxRowCols,
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

  // Walks the avatar along `route` at a steady pace instead of teleporting it in
  // a straight line, then opens the node's peek modal.
  function walkRoute(node: QuestNode, route: PixelPoint[]) {
    const app    = appRef.current
    const avatar = avatarRef.current
    if (!app || !avatar || isWalkingRef.current || route.length < 2) return
    isWalkingRef.current = true
    avatar.play()
    emitSound('mapFootstep')
    tweenAlongPath(avatar, route, routeDuration(route), app).then(() => {
      avatar.stop()
      isWalkingRef.current = false
      setPeekNode(node)
    })
  }

  function handleWalk(node: QuestNode, pos: { x: number; y: number }) {
    const avatar = avatarRef.current
    if (!avatar) return
    // The road tiles between two grid nodes are laid along elbowCorners() of the
    // same two points, so walking that elbow puts the avatar on the drawn road.
    const from = { x: avatar.x, y: avatar.y }
    walkRoute(node, cornerPolyline(elbowCorners(from, pos, TILE_SIZE), from, pos))
  }

  function handleWalkFreeform(node: QuestNode) {
    const avatar = avatarRef.current
    if (!avatar || node.x === undefined || node.y === undefined) return
    // Travel is not restricted to adjacent towns, so the route is stitched from
    // the roads through every town in between — otherwise a hop to a distant
    // town would still cut straight across the map.
    const from = { x: avatar.x, y: avatar.y }
    walkRoute(node, worldWalkRoute(worldMap.nodes, avatarNodeIdRef.current, node.id, from))
    avatarNodeIdRef.current = node.id
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
