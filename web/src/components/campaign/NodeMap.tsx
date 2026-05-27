import React, { useMemo, useRef, useEffect, useState } from 'react'
import * as PIXI from 'pixi.js'
import { User } from 'firebase/auth'
import { emitSound } from '../../game/sound'
import { getDiscoveredFragmentIds } from '../../game/codex'
import { Act, QuestNode, RunState, ReplayModifier, getAvailableNodeIds, loadNodeHistory, getModifiersByCount, ALL_CONSUMABLES, loadPlayerAvatar, ARCHETYPE_DEFS } from '../../game/questline'
import { spriteSlug } from '../../game/sprites'
import { StatRow } from '../ui/StatRow'
import { getCardUnit } from '../../game/cards'
import { Lives } from '../ui/Lives/Lives'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Toolbar } from '../ui/Toolbar/Toolbar'
import { ToolbarButton } from '../ui/Toolbar/ToolbarButton'
import { NodeMapHpBar } from './NodeMapHpBar'
import { ToolbarSpacer } from '../ui/Toolbar/ToolbarSpacer'
import { ToolbarLabel } from '../ui/Toolbar/ToolbarLabel'
import { usePixiApp } from '../../hooks/usePixiApp'
import { loadSpriteTexture, loadAnimFrames, loadTextureUrl, makeClickable, tweenTo } from '../../utils/pixiHelpers'
import { drawTerrainItem } from '../../utils/terrainGfx'
import { GIFT_OWNER_UID } from '../../game/gifts'

interface Props {
  act: Act
  run: RunState
  onSelectNode: (node: QuestNode) => void
  onUseConsumable: (id: string) => void
  onBack: () => void
  user?: User | null
}

const NODE_ICON: Record<string, string> = {
  battle: '⚔', elite: '★', boss: '☠', rest: '⛺',
  event: '?', merchant: '⚖', memory: '◆',
}

const NODE_LABEL: Record<string, string> = {
  battle: 'BATTLE', elite: 'ELITE', boss: 'BOSS', rest: 'REST',
  event: 'EVENT', merchant: 'SHOP', memory: 'MEMORY',
}

const COL_WIDTH      = 112
const ROW_HEIGHT     = 112
const AVATAR_PADDING = 72
const CONN_W         = 44
const AVATAR_SIZE    = 36
const WALK_DURATION  = 700
const NODE_RADIUS    = 22

// ── Game logic helpers ────────────────────────────────────────────────────────

type NodeStatus = 'completed' | 'available' | 'skipped' | 'locked' | 'pending'

function getNodeStatus(nodeId: string, availableIds: string[], run: RunState): NodeStatus {
  if (run.pendingNodeId === nodeId)          return 'pending'
  if (run.completedNodeIds.includes(nodeId)) return 'completed'
  if (run.skippedNodeIds.includes(nodeId))   return 'skipped'
  if (availableIds.includes(nodeId))         return 'available'
  return 'locked'
}

function computeReachableIds(act: Act, run: RunState): Set<string> {
  const skipped = new Set(run.skippedNodeIds)
  const reachable = new Set<string>()
  function visit(id: string) {
    if (reachable.has(id) || skipped.has(id)) return
    reachable.add(id)
    const node = act.nodes[id]
    if (!node) return
    for (const childId of node.childIds) visit(childId)
  }
  const hasParent = new Set<string>()
  for (const node of Object.values(act.nodes))
    for (const cid of node.childIds) hasParent.add(cid)
  for (const [id] of Object.entries(act.nodes))
    if (!hasParent.has(id) && !skipped.has(id)) visit(id)
  return reachable
}

function buildRows(act: Act): QuestNode[][] {
  const byRow: Record<number, QuestNode[]> = {}
  for (const node of Object.values(act.nodes)) {
    if (!byRow[node.row]) byRow[node.row] = []
    byRow[node.row].push(node)
  }
  return Object.keys(byRow).map(Number).sort((a, b) => a - b)
    .map(r => byRow[r].sort((a, b) => a.col - b.col))
}

function computeHiddenNodeIds(act: Act, run: RunState, discoveredFragIds: Set<string>): Set<string> {
  const ids = new Set<string>()
  for (const node of Object.values(act.nodes)) {
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

function lastCompletedNode(act: Act, run: RunState): QuestNode | null {
  if (run.completedNodeIds.length === 0) return null
  const completed = new Set(run.completedNodeIds)
  for (const id of run.completedNodeIds) {
    const node = act.nodes[id]
    if (!node) continue
    if (!node.childIds.some(cid => completed.has(cid))) return node
  }
  return act.nodes[run.completedNodeIds[run.completedNodeIds.length - 1]] ?? null
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

// ── Terrain helpers ────────────────────────────────────────────────────────────

function seededRand(seed: number) {
  let s = seed | 0
  return (): number => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
    s ^= (s >>> 16)
    return (s >>> 0) / 0xffffffff
  }
}

function hashStr(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 33) ^ str.charCodeAt(i)) | 0
  return Math.abs(h)
}

interface TerrainItem { x: number; y: number; scale: number; kind: string }

function getTerrainItems(env: string | undefined, seed: number, w: number, h: number): TerrainItem[] {
  const r = seededRand(seed)
  const rf = (lo: number, hi: number) => lo + r() * (hi - lo)
  const pad = 30
  const items: TerrainItem[] = []
  const scatter = (kind: string, count: number, minS: number, maxS: number) => {
    for (let i = 0; i < count; i++)
      items.push({ kind, x: rf(pad, w - pad), y: rf(pad, h - pad), scale: rf(minS, maxS) })
  }
  switch (env) {
    case 'forest':   scatter('tree', 14, 0.8, 1.5); scatter('mountain', 4, 0.5, 0.9); scatter('river', 1, 1, 1); break
    case 'citadel':  scatter('tower', 10, 0.8, 1.4); scatter('mountain', 5, 0.5, 1.0); break
    case 'ruins':    scatter('pillar', 9, 0.8, 1.3); scatter('tree', 4, 0.5, 0.9); scatter('river', 1, 1, 1); break
    case 'ashen':    scatter('mountain', 10, 0.7, 1.4); scatter('deadtree', 6, 0.8, 1.3); break
    case 'farmland': scatter('tree', 8, 0.7, 1.1); scatter('mountain', 4, 0.4, 0.7); scatter('river', 1, 1, 1); break
    case 'frost':    scatter('crystal', 12, 0.8, 1.4); scatter('mountain', 6, 0.7, 1.2); scatter('river', 1, 1, 1); break
    case 'volcano':  scatter('mountain', 10, 0.8, 1.5); scatter('lava', 5, 0.7, 1.2); break
    case 'sand':     scatter('dune', 10, 0.7, 1.3); scatter('mountain', 4, 0.5, 0.9); break
    case 'reef':
    case 'coast':    scatter('wave', 10, 0.8, 1.4); scatter('mountain', 4, 0.5, 0.9); scatter('river', 1, 1, 1); break
    case 'sky':      scatter('cloud', 12, 0.8, 1.5); scatter('mountain', 4, 0.4, 0.8); break
    case 'fungal':   scatter('mushroom', 12, 0.8, 1.5); scatter('deadtree', 4, 0.5, 0.9); scatter('river', 1, 1, 1); break
    case 'vault':
    case 'camp':     scatter('pillar', 8, 0.7, 1.2); scatter('mountain', 4, 0.5, 0.9); break
    default:         scatter('mountain', 10, 0.6, 1.2); scatter('tree', 4, 0.6, 1.0)
  }
  return items
}

// ── PixiJS terrain builder ─────────────────────────────────────────────────────
// Rivers go into groundLayer; all other items go into worldLayer for Y-sorting.

function buildTerrainGfx(
  groundLayer: PIXI.Container,
  worldLayer: PIXI.Container,
  act: Act,
  mapWidth: number,
  mapHeight: number,
): void {
  const { environment, terrainSeed, terrainItems: explicitItems, rivers: explicitRivers } = act
  const seed = terrainSeed ?? hashStr(act.id)
  const items = explicitItems ?? getTerrainItems(environment, seed, mapWidth, mapHeight)

  const riverColor = environment === 'volcano' ? 0xcc4400
                   : environment === 'fungal'  ? 0x6633aa
                   : environment === 'frost'   ? 0x88ddff : 0x2255aa

  const rc = (riverColor >> 16) & 0xff, gc = (riverColor >> 8) & 0xff, bc = riverColor & 0xff
  const riverDark  = (Math.round(rc * 0.55) << 16) | (Math.round(gc * 0.55) << 8) | Math.round(bc * 0.55)
  const riverLight = (Math.min(255, Math.round(rc * 1.45)) << 16) | (Math.min(255, Math.round(gc * 1.45)) << 8) | Math.min(255, Math.round(bc * 1.45))

  // Explicit rivers override the random scatter; fall back to seeded random
  const riversToDraw: Array<{ x1: number; y1: number; x2: number; y2: number; cx1: number; cy1: number; cx2: number; cy2: number }> =
    explicitRivers ?? (() => {
      const rseed = hashStr(act.id + 'river')
      const rr = seededRand(rseed)
      const rrf = (lo: number, hi: number) => lo + rr() * (hi - lo)
      return items.filter(i => i.kind === 'river').map(() => ({
        x1: rrf(0, mapWidth * 0.25),   y1: rrf(0, mapHeight),
        x2: rrf(mapWidth * 0.75, mapWidth), y2: rrf(0, mapHeight),
        cx1: rrf(mapWidth * 0.2, mapWidth * 0.5), cy1: rrf(0, mapHeight),
        cx2: rrf(mapWidth * 0.5, mapWidth * 0.8), cy2: rrf(0, mapHeight),
      }))
    })()

  for (const { x1, y1, x2, y2, cx1, cy1, cx2, cy2 } of riversToDraw) {
    const g = new PIXI.Graphics()
    g.moveTo(x1, y1).bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2)
      .stroke({ color: riverDark, width: 20, alpha: 0.65, cap: 'round' })
    g.moveTo(x1, y1).bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2)
      .stroke({ color: riverColor, width: 13, alpha: 0.75, cap: 'round' })
    g.moveTo(x1, y1).bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2)
      .stroke({ color: riverLight, width: 7, alpha: 0.55, cap: 'round' })
    g.moveTo(x1, y1).bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2)
      .stroke({ color: 0xffffff, width: 2, alpha: 0.38, cap: 'round' })
    groundLayer.addChild(g)
  }

  const terrainItems = items.filter(i => i.kind !== 'river')
  for (let i = 0; i < terrainItems.length; i++) {
    const { x, y, scale, kind } = terrainItems[i]
    const g = new PIXI.Graphics()
    g.position.set(x, y)
    drawTerrainItem(g, kind, scale, environment, hashStr(`${kind}-${i}${x}`) % 18)
    g.zIndex = y
    worldLayer.addChild(g)
  }
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

function envColors(env?: string): { trail: string; frontier: string } {
  switch (env) {
    case 'forest':   return { trail: 'rgba(80,140,60,0.6)',    frontier: 'rgba(100,220,80,0.9)'   }
    case 'citadel':
    case 'ruins':    return { trail: 'rgba(120,120,140,0.55)', frontier: 'rgba(180,180,210,0.9)'  }
    case 'ashen':    return { trail: 'rgba(160,80,40,0.55)',   frontier: 'rgba(240,120,60,0.9)'   }
    case 'farmland': return { trail: 'rgba(140,160,60,0.55)',  frontier: 'rgba(200,220,80,0.9)'   }
    case 'frost':    return { trail: 'rgba(80,160,200,0.55)',  frontier: 'rgba(120,220,255,0.9)'  }
    case 'volcano':  return { trail: 'rgba(200,80,20,0.6)',    frontier: 'rgba(255,120,30,0.95)'  }
    case 'sand':     return { trail: 'rgba(200,160,60,0.55)',  frontier: 'rgba(240,200,80,0.9)'   }
    case 'reef':
    case 'coast':    return { trail: 'rgba(40,140,180,0.55)',  frontier: 'rgba(60,200,240,0.9)'   }
    case 'sky':      return { trail: 'rgba(100,140,200,0.55)', frontier: 'rgba(140,190,255,0.9)'  }
    case 'fungal':   return { trail: 'rgba(120,60,160,0.55)',  frontier: 'rgba(180,80,240,0.9)'   }
    case 'vault':
    case 'camp':     return { trail: 'rgba(140,120,80,0.55)',  frontier: 'rgba(200,180,100,0.9)'  }
    default:         return { trail: 'rgba(120,120,120,0.45)', frontier: 'rgba(51,255,51,0.85)'   }
  }
}

function parseRgba(s: string): { color: number; alpha: number } {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(s)
  if (!m) return { color: 0xffffff, alpha: 1 }
  return {
    color: (parseInt(m[1]) << 16) | (parseInt(m[2]) << 8) | parseInt(m[3]),
    alpha: m[4] ? parseFloat(m[4]) : 1,
  }
}

function sampleBezier(
  x0: number, y0: number, cx1: number, cy1: number,
  cx2: number, cy2: number, x1: number, y1: number,
  n = 20,
): Array<{ x: number; y: number }> {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, mt = 1 - t
    return {
      x: mt**3*x0 + 3*mt**2*t*cx1 + 3*mt*t**2*cx2 + t**3*x1,
      y: mt**3*y0 + 3*mt**2*t*cy1 + 3*mt*t**2*cy2 + t**3*y1,
    }
  })
}

function bezierBand(pts: Array<{ x: number; y: number }>, halfW: number): number[] {
  const left: number[] = [], right: Array<{ x: number; y: number }> = []
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)]
    const tx = next.x - prev.x, ty = next.y - prev.y
    const len = Math.sqrt(tx * tx + ty * ty) || 1
    const nx = -ty / len, ny = tx / len
    left.push(pts[i].x + nx * halfW, pts[i].y + ny * halfW)
    right.push({ x: pts[i].x - nx * halfW, y: pts[i].y - ny * halfW })
  }
  const rightFlat = right.reverse().flatMap(p => [p.x, p.y])
  return [...left, ...rightFlat]
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
        gfx.poly(bezierBand(pts, 5)).fill({ color: 0x000000, alpha: 0.25 })
        gfx.poly(bezierBand(pts, 3)).fill({ color: trail.color, alpha: trail.alpha * 0.35 })
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

        gfx.poly(bezierBand(pts, halfOuter)).fill({ color: 0x000000, alpha: 0.55 })
        gfx.poly(bezierBand(pts, halfInner)).fill({ color: c.color, alpha: Math.min(c.alpha, 0.85) })

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
  if (status === 'completed') return 0.55
  return 0.4
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
  return container
}

function updateMarkerStyle(
  marker: PIXI.Container, status: NodeStatus, inReachable: boolean,
): void {
  // iconLayer is child index 1; bg (index 0) stays fully opaque
  ;(marker.getChildAt(1) as PIXI.Container).alpha = markerAlpha(status, inReachable)
}

// ── Reward / difficulty helpers ───────────────────────────────────────────────

function rewardSummary(node: QuestNode): string {
  switch (node.type) {
    case 'battle':   return '1 card reward'
    case 'elite':    return 'Pick 1 of 3 rare+ cards'
    case 'boss':     return 'Relic + card pack + crystals'
    case 'rest':     return `+${node.restHeal ?? 5} HP`
    case 'event':    return 'Random event — choose wisely'
    case 'merchant': return 'Spend crystals to buy cards'
    default:         return ''
  }
}

const DIFFICULTY_LABELS = ['Easy', 'Easy', 'Medium', 'Medium', 'Hard', 'Hard', 'Very Hard', 'Brutal']
function difficultyLabel(handicap: number | undefined): string {
  return DIFFICULTY_LABELS[Math.min(handicap ?? 0, DIFFICULTY_LABELS.length - 1)]
}
function difficultyColor(handicap: number | undefined): string {
  const h = handicap ?? 0
  return h <= 1 ? '#33ff33' : h <= 3 ? '#ffcc00' : h <= 5 ? '#ff8844' : '#ff4444'
}

const BOSS_AI_DESCRIPTIONS: Record<string, string> = {
  thornlord: 'Builds walls every turn — floods the field with structures and outlasts you.',
}
function playstyleDescription(node: QuestNode): string {
  if (node.bossAI && BOSS_AI_DESCRIPTIONS[node.bossAI]) return BOSS_AI_DESCRIPTIONS[node.bossAI]
  if (node.enemyDeck?.length) return `Deck: ${node.enemyDeck.join(', ')}`
  return 'Plays a standard shuffled deck.'
}

function collapseModifiers(modifiers: ReplayModifier[]): ReplayModifier[] {
  const byType = new Map<string, number>()
  for (const m of modifiers) byType.set(m.type, (byType.get(m.type) ?? 0) + m.value)
  return Array.from(byType.entries()).map(([type, total]) => {
    switch (type) {
      case 'enemyHpPercent':  return { type: type as ReplayModifier['type'], value: total, label: `+${total}% enemy HP` }
      case 'crystalBonus':    return { type: type as ReplayModifier['type'], value: total, label: `+${total} crystals per battle` }
      case 'enemyHandBonus':  return { type: type as ReplayModifier['type'], value: total, label: `Enemies start +${total} card${total !== 1 ? 's' : ''}` }
      default:                return modifiers.find(m => m.type === type)!
    }
  })
}

// ── Node Peek Modal ────────────────────────────────────────────────────────────

interface PeekModalProps {
  node: QuestNode; actId: string; nodeHistory: Set<string>
  activeModifiers: ReplayModifier[]; onEnter: () => void; onClose: () => void
}

function NodePeekModal({ node, actId, nodeHistory, activeModifiers, onEnter, onClose }: PeekModalProps) {
  const hasPreviouslyCompleted = nodeHistory.has(`${actId}:${node.id}`)
  const isBattle = node.type === 'battle' || node.type === 'elite' || node.type === 'boss'
  return (
    <div className="nm-peek-backdrop" onClick={onClose}>
      <div className="nm-peek-panel" onClick={e => e.stopPropagation()}>
        <div className="nm-peek-header u-col u-items-c u-gap-1">
          <span className={`nm-peek-type nm-node-type-badge--${node.type}`}>
            {NODE_LABEL[node.type] ?? node.type.toUpperCase()}
          </span>
          <span className="nm-peek-icon">{NODE_ICON[node.type] ?? '?'}</span>
          <span className="nm-peek-name">{node.label}</span>
        </div>
        {node.description && <div className="nm-peek-desc">{node.description}</div>}
        <StatRow label="REWARD" value={<span className="nm-peek-reward">{rewardSummary(node)}</span>} />
        {isBattle && (
          <StatRow label="DIFFICULTY"
            value={<span style={{ color: difficultyColor(node.handicap) }}>{difficultyLabel(node.handicap)}</span>} />
        )}
        {hasPreviouslyCompleted && isBattle && (
          <div className="nm-peek-history u-col u-gap-2">
            <div className="nm-peek-history-label">— INTEL (from previous run) —</div>
            <div className="nm-peek-history-body">{playstyleDescription(node)}</div>
          </div>
        )}
        {isBattle && activeModifiers.length > 0 && (
          <div className="nm-peek-modifiers">
            <div className="nm-peek-modifiers-label">— REPLAY MODIFIERS —</div>
            {collapseModifiers(activeModifiers).map((m, i) => (
              <div key={i} className="nm-peek-modifier-row u-flex u-items-c u-gap-3">
                <span className="nm-peek-modifier-icon">⚠</span>
                <span className="nm-peek-modifier-text">{m.label}</span>
              </div>
            ))}
          </div>
        )}
        <div className="nm-peek-actions u-flex u-gap-4">
          {(isBattle || node.type === 'event' || node.type === 'merchant') ? (
            <button className="action-btn nm-peek-enter-btn u-grow" onClick={onEnter}>
              {node.type === 'merchant' ? 'ENTER SHOP' : node.type === 'event' ? 'APPROACH' : 'ENTER BATTLE'}
            </button>
          ) : (
            <button className="action-btn nm-peek-enter-btn u-grow" onClick={onEnter}>
              {node.type === 'rest' ? 'REST HERE' : 'PROCEED'}
            </button>
          )}
          <button className="action-btn nm-peek-back-btn" onClick={onClose}>BACK</button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function NodeMap({ act, run, onSelectNode, onUseConsumable, onBack, user }: Props) {
  const availableIds      = useMemo(() => getAvailableNodeIds(act, run), [act, run])
  const rows              = useMemo(() => buildRows(act), [act])
  const maxRowCols        = useMemo(() => Math.max(...rows.map(r => r[0]?.rowCols ?? r.length)), [rows])
  const reachableIds      = useMemo(() => computeReachableIds(act, run), [act, run])
  const discoveredFragIds = useMemo(() => getDiscoveredFragmentIds(), [])
  const hiddenNodeIds     = useMemo(
    () => computeHiddenNodeIds(act, run, discoveredFragIds),
    [act, run, discoveredFragIds],
  )

  const mapHeight = maxRowCols * ROW_HEIGHT
  const mapWidth  = AVATAR_PADDING + rows.length * COL_WIDTH + Math.max(0, rows.length - 1) * CONN_W

  const [peekNode, setPeekNode] = useState<QuestNode | null>(null)
  const nodeHistory = useMemo(() => loadNodeHistory(), [])

  const canvasRef        = useRef<HTMLCanvasElement>(null)
  const mapRef           = useRef<HTMLDivElement>(null)
  const appRef           = useRef<PIXI.Application | null>(null)
  const connGfxListRef   = useRef<PIXI.Graphics[]>([])
  const groundRef        = useRef<PIXI.Container | null>(null)
  const worldRef         = useRef<PIXI.Container | null>(null)
  const nodeLRef         = useRef<PIXI.Container | null>(null)
  const markersRef       = useRef<Map<string, PIXI.Container>>(new Map())
  const avatarRef    = useRef<PIXI.AnimatedSprite | null>(null)
  const isWalkingRef = useRef(false)
  const deadRef      = useRef(false)

  // Always-current state for use inside async PixiJS callbacks
  const stateRef = useRef({ availableIds, reachableIds, hiddenNodeIds, run })
  stateRef.current = { availableIds, reachableIds, hiddenNodeIds, run }

  useEffect(() => () => { deadRef.current = true }, [])

  usePixiApp(canvasRef, mapWidth, mapHeight, async (app) => {
    appRef.current = app
    // PixiJS sets touch-action:none on the canvas; restore pan so the
    // nm-map container can still scroll when the user swipes.
    app.canvas.style.touchAction = 'pan-x pan-y'

    const groundLayer = new PIXI.Container()
    const worldLayer  = new PIXI.Container()
    const nodeLayer   = new PIXI.Container()
    worldLayer.sortableChildren = true
    nodeLayer.sortableChildren  = true
    app.stage.addChild(groundLayer, worldLayer, nodeLayer)
    groundRef.current = groundLayer
    worldRef.current  = worldLayer
    nodeLRef.current  = nodeLayer

    // Terrain
    buildTerrainGfx(groundLayer, worldLayer, act, mapWidth, mapHeight)

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
    const { availableIds: aids, reachableIds: rids, hiddenNodeIds: hids, run: r } = stateRef.current
    connGfxListRef.current = drawConnectorsGfx(worldLayer, rows, maxRowCols, mapHeight,
      id => getNodeStatus(id, aids, r), rids, hids, act.environment)

    // Node markers
    for (let ri = 0; ri < rows.length; ri++) {
      const rowNodes = rows[ri]
      const rowCols  = rowNodes[0]?.rowCols ?? rowNodes.length
      for (const node of rowNodes) {
        if (hids.has(node.id)) continue
        if (deadRef.current) return
        const pos    = nodePosition(ri, node, rowCols, maxRowCols)
        const status = getNodeStatus(node.id, aids, r)
        const marker = await buildNodeMarker(node, status, rids.has(node.id), app, act.environment)
        if (deadRef.current) return
        makeClickable(marker, () => {
          if (isWalkingRef.current) return
          const { availableIds: a, run: rr } = stateRef.current
          if (getNodeStatus(node.id, a, rr) !== 'available') return
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

    const lastNode = lastCompletedNode(act, stateRef.current.run)
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

  // Redraw connectors + update marker styles when run state changes
  useEffect(() => {
    const wl = worldRef.current
    if (!wl) return
    for (const g of connGfxListRef.current) { wl.removeChild(g); g.destroy() }
    connGfxListRef.current = drawConnectorsGfx(wl, rows, maxRowCols, mapHeight,
      id => getNodeStatus(id, availableIds, run), reachableIds, hiddenNodeIds, act.environment)
    for (const [nodeId, marker] of markersRef.current) {
      const status = getNodeStatus(nodeId, availableIds, run)
      updateMarkerStyle(marker, status, reachableIds.has(nodeId))
    }
  }, [run, availableIds, reachableIds, hiddenNodeIds]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to current node on mount
  useEffect(() => {
    const mapEl = mapRef.current
    const currentNodeId = run.pendingNodeId
      ?? rows.flatMap(r => r).find(n => availableIds.includes(n.id))?.id
    if (!mapEl || !currentNodeId) return
    const node = act.nodes[currentNodeId]
    if (!node) return
    const ri = rows.findIndex(row => row.some(n => n.id === node.id))
    if (ri < 0) return
    const rowNodes = rows[ri]
    const pos = nodePosition(ri, node, rowNodes[0]?.rowCols ?? rowNodes.length, maxRowCols)
    mapEl.scrollLeft = pos.x - mapEl.clientWidth / 2
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

  const handlePeekEnter = () => {
    if (!peekNode) return
    setPeekNode(null)
    onSelectNode(peekNode)
  }

  const statusOf = (id: string) => getNodeStatus(id, availableIds, run)

  return (
    <OverlayScreen onBack={onBack} title={act.title} subtitle={act.subtitle}>
      <div className="nodemap u-col u-grow">

        <Toolbar>
          {run.archetype && (() => {
            const def = ARCHETYPE_DEFS.find(d => d.id === run.archetype)
            return def ? <ToolbarLabel>{def.icon} {def.name}</ToolbarLabel> : null
          })()}
          <ToolbarLabel>Items</ToolbarLabel>
          {ALL_CONSUMABLES.map(def => {
            const rc    = run.consumables?.find(c => c.id === def.id)
            const count = rc?.count ?? 0
            return (
              <React.Fragment key={def.id}>
                <ToolbarButton
                  label={`${def.name} ×${count}`}
                  icon={def.icon}
                  disabled={count === 0}
                  onClick={() => onUseConsumable(def.id)}
                />
              </React.Fragment>
            )
          })}
          <ToolbarSpacer />
          {user?.uid === GIFT_OWNER_UID && (
            <ToolbarButton
              label="Copy Debug State"
              icon="🐞"
              onClick={() => {
                const nodeStatuses: Record<string, string> = {}
                for (const node of Object.values(act.nodes))
                  nodeStatuses[node.id] = `${node.type} → ${statusOf(node.id)}`
                const state = {
                  actId: run.actId, pendingNodeId: run.pendingNodeId,
                  completedNodeIds: run.completedNodeIds, skippedNodeIds: run.skippedNodeIds,
                  availableIds, nodeStatuses,
                }
                console.log('[NodeMap debug]', state)
                navigator.clipboard?.writeText(JSON.stringify(state, null, 2)).catch(() => undefined)
                alert('Debug state copied to clipboard (also logged to console).')
              }}
            />
          )}
        </Toolbar>

        <div
          className={`nm-map u-flex u-grow u-items-c${act.environment ? ` nm-map--${act.environment}` : ''}`}
          ref={mapRef}
        >
          <canvas ref={canvasRef} style={{ display: 'block', flexShrink: 0, width: mapWidth, height: mapHeight }} />
        </div>

        {peekNode && (
          <NodePeekModal
            node={peekNode}
            actId={act.id}
            nodeHistory={nodeHistory}
            activeModifiers={getModifiersByCount(act, run.activeModifierCount)}
            onEnter={handlePeekEnter}
            onClose={() => setPeekNode(null)}
          />
        )}
      </div>

      <Toolbar>
        <ToolbarSpacer />
        <div className="u-col u-gap-1 u-mg-t-lg u-mg-b-md">
          <NodeMapHpBar hp={run.playerHp} maxHp={run.maxHp} />
          <div className="nm-lives-area u-flex u-items-end u-just-end u-gap-1"
            title="Lives remaining — lose them all and the campaign ends">
            <Lives maxLives={run.maxLives ?? 3} currentLives={run.livesRemaining ?? 3} />
          </div>
        </div>
      </Toolbar>
    </OverlayScreen>
  )
}
