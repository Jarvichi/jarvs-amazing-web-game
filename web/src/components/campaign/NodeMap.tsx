import React, { useMemo, useRef, useEffect, useState } from 'react'
import { emitSound } from '../../game/sound'
import { getDiscoveredFragmentIds } from '../../game/codex'
import { Act, QuestNode, RunState, ReplayModifier, getAvailableNodeIds, loadNodeHistory, getModifiersByCount, ALL_CONSUMABLES, loadPlayerAvatar, ARCHETYPE_DEFS } from '../../game/questline'
import { spriteSlug } from '../../game/sprites'
import { StatRow } from '../ui/StatRow'
import { AnimatedSpriteImg } from '../ui/SpriteImg'
import { getCardUnit } from '../../game/cards'
import { Lives } from '../ui/Lives/Lives'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Toolbar } from '../ui/Toolbar/Toolbar'
import { ToolbarButton } from '../ui/Toolbar/ToolbarButton'
import { NodeMapHpBar } from './NodeMapHpBar'
import { ToolbarSubComponent } from '../ui/Toolbar/ToolbarSubComponent'
import { ToolbarSpacer } from '../ui/Toolbar/ToolbarSpacer'
import { ToolbarLabel } from '../ui/Toolbar/ToolbarLabel'

interface Props {
  act: Act
  run: RunState
  onSelectNode: (node: QuestNode) => void
  onUseConsumable: (id: string) => void
  onBack: () => void
}

const NODE_ICON: Record<string, string> = {
  battle:   '⚔',
  elite:    '★',
  boss:     '☠',
  rest:     '⛺',
  event:    '?',
  merchant: '⚖',
  memory:   '◆',
}

const COL_WIDTH      = 112 // fixed pixel width per map column slot
const ROW_HEIGHT     = 112 // fixed pixel height per vertical node slot within a column
const AVATAR_PADDING = 72  // left space in nm-map-inner for the "node 0" start position
const CONN_W         = 44  // connector gap width between columns
const AVATAR_SIZE    = 36  // px avatar width/height
const WALK_DURATION  = 700 // ms for the walk animation

function startPosition(mapHeight: number): { x: number; y: number } {
  return { x: AVATAR_PADDING / 2, y: mapHeight / 2 }
}

function getRelativeCenter(el: HTMLElement, container: HTMLElement): { x: number; y: number } {
  const er = el.getBoundingClientRect()
  const cr = container.getBoundingClientRect()
  return {
    x: er.left - cr.left + er.width  / 2,
    y: er.top  - cr.top  + er.height / 2,
  }
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

const NODE_LABEL: Record<string, string> = {
  battle:   'BATTLE',
  elite:    'ELITE',
  boss:     'BOSS',
  rest:     'REST',
  event:    'EVENT',
  merchant: 'SHOP',
  memory:   'MEMORY',
}

function nodeSprite(node: QuestNode): string | null {
  if (node.type === 'rest')     return '/sprites/campfire.svg'
  if (node.type === 'merchant') return '/sprites/merchant.svg'
  if (node.type === 'event')    return '/sprites/event.svg'
  if (node.type === 'memory')   return '/sprites/event.svg'
  if (node.type === 'boss' && node.bossAI)
    return `/sprites/boss-${node.bossAI}.svg`
  if ((node.type === 'battle' || node.type === 'elite') && node.enemyDeck?.length)
    return `/sprites/${spriteSlug(node.enemyDeck[0])}.svg`
  return null
}

type NodeStatus = 'completed' | 'available' | 'skipped' | 'locked' | 'pending'

function getNodeStatus(
  nodeId: string,
  availableIds: string[],
  run: RunState,
): NodeStatus {
  if (run.pendingNodeId === nodeId)          return 'pending'
  if (run.completedNodeIds.includes(nodeId)) return 'completed'
  if (run.skippedNodeIds.includes(nodeId))   return 'skipped'
  if (availableIds.includes(nodeId))         return 'available'
  return 'locked'
}

/**
 * BFS from start nodes (parentIds === []) following non-skipped edges.
 * Returns the set of node IDs that can still be reached in the current run.
 * Completed, available, and future-path nodes are all included; skipped and
 * their descendants that have no other parent are excluded.
 */
function computeReachableIds(act: Act, run: RunState): Set<string> {
  const skipped = new Set(run.skippedNodeIds)
  const reachable = new Set<string>()

  function visit(id: string) {
    if (reachable.has(id) || skipped.has(id)) return
    reachable.add(id)
    const node = act.nodes[id]
    if (!node) return
    for (const childId of node.childIds) {
      visit(childId)
    }
  }

  // Build reverse map to find start nodes (those with no parents)
  const hasParent = new Set<string>()
  for (const node of Object.values(act.nodes)) {
    for (const cid of node.childIds) hasParent.add(cid)
  }
  for (const [id] of Object.entries(act.nodes)) {
    if (!hasParent.has(id) && !skipped.has(id)) visit(id)
  }
  return reachable
}

// Rows sorted top→bottom (row 0 first; boss last)
function buildRows(act: Act): QuestNode[][] {
  const byRow: Record<number, QuestNode[]> = {}
  for (const node of Object.values(act.nodes)) {
    if (!byRow[node.row]) byRow[node.row] = []
    byRow[node.row].push(node)
  }
  return Object.keys(byRow)
    .map(Number)
    .sort((a, b) => a - b)
    .map(r => byRow[r].sort((a, b) => a.col - b.col))
}

// ── Terrain decoration layer ─────────────────────────────────────────────────

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
  const r   = seededRand(seed)
  const rf  = (lo: number, hi: number) => lo + r() * (hi - lo)
  const pad = 30
  const items: TerrainItem[] = []

  const scatter = (kind: string, count: number, minS: number, maxS: number) => {
    for (let i = 0; i < count; i++)
      items.push({ kind, x: rf(pad, w - pad), y: rf(pad, h - pad), scale: rf(minS, maxS) })
  }

  switch (env) {
    case 'forest':
      scatter('tree',     14, 0.8, 1.5)
      scatter('mountain',  4, 0.5, 0.9)
      scatter('river',     1, 1,   1  )
      break
    case 'citadel':
      scatter('tower',    10, 0.8, 1.4)
      scatter('mountain',  5, 0.5, 1.0)
      break
    case 'ruins':
      scatter('pillar',    9, 0.8, 1.3)
      scatter('tree',      4, 0.5, 0.9)
      scatter('river',     1, 1,   1  )
      break
    case 'ashen':
      scatter('mountain', 10, 0.7, 1.4)
      scatter('deadtree',  6, 0.8, 1.3)
      break
    case 'farmland':
      scatter('tree',      8, 0.7, 1.1)
      scatter('mountain',  4, 0.4, 0.7)
      scatter('river',     1, 1,   1  )
      break
    case 'frost':
      scatter('crystal',  12, 0.8, 1.4)
      scatter('mountain',  6, 0.7, 1.2)
      scatter('river',     1, 1,   1  )
      break
    case 'volcano':
      scatter('mountain', 10, 0.8, 1.5)
      scatter('lava',      5, 0.7, 1.2)
      break
    case 'sand':
      scatter('dune',     10, 0.7, 1.3)
      scatter('mountain',  4, 0.5, 0.9)
      break
    case 'reef':
    case 'coast':
      scatter('wave',     10, 0.8, 1.4)
      scatter('mountain',  4, 0.5, 0.9)
      scatter('river',     1, 1,   1  )
      break
    case 'sky':
      scatter('cloud',    12, 0.8, 1.5)
      scatter('mountain',  4, 0.4, 0.8)
      break
    case 'fungal':
      scatter('mushroom', 12, 0.8, 1.5)
      scatter('deadtree',  4, 0.5, 0.9)
      scatter('river',     1, 1,   1  )
      break
    case 'vault':
    case 'camp':
      scatter('pillar',    8, 0.7, 1.2)
      scatter('mountain',  4, 0.5, 0.9)
      break
    default:
      scatter('mountain', 10, 0.6, 1.2)
      scatter('tree',      4, 0.6, 1.0)
  }

  return items
}

function drawTerrainCanvas(
  ctx: CanvasRenderingContext2D,
  environment: string | undefined,
  actId: string,
  width: number,
  height: number,
): void {
  const items = getTerrainItems(environment, hashStr(actId), width, height)

  const riverColor =
    environment === 'volcano' ? '#cc4400' :
    environment === 'fungal'  ? '#6633aa' :
    environment === 'frost'   ? '#88ddff' : '#2255aa'

  const riverItems   = items.filter(it => it.kind === 'river')
  const terrainItems = items.filter(it => it.kind !== 'river')

  const rseed = hashStr(actId + 'river')
  const rr    = seededRand(rseed)
  const rrf   = (lo: number, hi: number) => lo + rr() * (hi - lo)

  for (const _ of riverItems) {
    const x1  = rrf(0, width * 0.25),          y1  = rrf(0, height)
    const x2  = rrf(width * 0.75, width),       y2  = rrf(0, height)
    const cx1 = rrf(width * 0.2, width * 0.5), cy1 = rrf(0, height)
    const cx2 = rrf(width * 0.5, width * 0.8), cy2 = rrf(0, height)
    ctx.save()
    ctx.globalAlpha = 0.28
    ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2)
    ctx.strokeStyle = riverColor; ctx.lineWidth = 6; ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2)
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.stroke()
    ctx.restore()
  }

  for (let i = 0; i < terrainItems.length; i++) {
    const { x, y, scale, kind } = terrainItems[i]
    const k = `${kind}-${i}`
    switch (kind) {
      case 'mountain': {
        const w = scale * 44, h = scale * 32
        const col = environment === 'frost'   ? '#8ab8cc'
                  : environment === 'volcano' ? '#6a3020'
                  : environment === 'sand'    ? '#a08040' : '#5a6050'
        ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = col
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+w*0.45, y-h); ctx.lineTo(x+w, y); ctx.closePath(); ctx.fill()
        ctx.beginPath(); ctx.moveTo(x+w*0.3, y); ctx.lineTo(x+w*0.72, y-h*0.75); ctx.lineTo(x+w*1.1, y); ctx.closePath(); ctx.fill()
        if (environment === 'frost') {
          ctx.fillStyle = 'rgba(255,255,255,0.55)'
          ctx.beginPath(); ctx.moveTo(x+w*0.2, y-h*0.55); ctx.lineTo(x+w*0.45, y-h); ctx.lineTo(x+w*0.7, y-h*0.55); ctx.closePath(); ctx.fill()
        }
        ctx.restore(); break
      }
      case 'tree': {
        const h = scale * 28, tw = scale * 14
        const col = environment === 'farmland' ? '#4a7a28'
                  : environment === 'ruins'    ? '#3a6028' : '#2a7020'
        ctx.save(); ctx.globalAlpha = 0.24
        ctx.fillStyle = '#6b4226'; ctx.fillRect(x - scale*2, y - scale*8, scale*4, scale*9)
        ctx.fillStyle = col
        ctx.beginPath(); ctx.moveTo(x, y-h); ctx.lineTo(x-tw, y-scale*6); ctx.lineTo(x+tw, y-scale*6); ctx.closePath(); ctx.fill()
        ctx.beginPath(); ctx.moveTo(x, y-h*0.62); ctx.lineTo(x-tw*1.1, y-scale*2); ctx.lineTo(x+tw*1.1, y-scale*2); ctx.closePath(); ctx.fill()
        ctx.restore(); break
      }
      case 'deadtree': {
        const h = scale * 28
        ctx.save(); ctx.globalAlpha = 0.2; ctx.strokeStyle = '#5a4030'; ctx.lineCap = 'round'
        ctx.lineWidth = scale*3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y-h); ctx.stroke()
        ctx.lineWidth = scale*2; ctx.beginPath(); ctx.moveTo(x, y-h*0.6); ctx.lineTo(x-scale*12, y-h*0.85); ctx.stroke()
        ctx.lineWidth = scale*1.5; ctx.beginPath(); ctx.moveTo(x, y-h*0.5); ctx.lineTo(x+scale*10, y-h*0.72); ctx.stroke()
        ctx.restore(); break
      }
      case 'crystal': {
        const h = scale * 26
        ctx.save(); ctx.globalAlpha = 0.28
        ctx.fillStyle = '#88ddff'
        ctx.beginPath(); ctx.moveTo(x, y-h); ctx.lineTo(x-scale*5, y); ctx.lineTo(x+scale*5, y); ctx.closePath(); ctx.fill()
        ctx.fillStyle = '#aaeeff'
        ctx.beginPath(); ctx.moveTo(x, y-h*0.7); ctx.lineTo(x-scale*7, y+h*0.3); ctx.lineTo(x+scale*7, y+h*0.3); ctx.closePath(); ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = scale*1.5
        ctx.beginPath(); ctx.moveTo(x, y-h); ctx.lineTo(x, y+h*0.3); ctx.stroke()
        ctx.restore(); break
      }
      case 'mushroom': {
        const h = scale * 22, rw = scale * 12
        ctx.save(); ctx.globalAlpha = 0.24
        ctx.fillStyle = '#8a7060'; ctx.fillRect(x - scale*2.5, y-h, scale*5, h)
        ctx.fillStyle = '#9a40ee'; ctx.beginPath(); ctx.ellipse(x, y-h, rw, scale*8, 0, 0, Math.PI*2); ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(x-scale*3, y-h-scale*2, scale*4, scale*3, 0, 0, Math.PI*2); ctx.fill()
        ctx.restore(); break
      }
      case 'lava': {
        ctx.save(); ctx.globalAlpha = 0.22
        ctx.fillStyle = '#cc3300'; ctx.beginPath(); ctx.ellipse(x, y, scale*20, scale*10, 0, 0, Math.PI*2); ctx.fill()
        ctx.fillStyle = '#ff6600'; ctx.beginPath(); ctx.ellipse(x, y, scale*12, scale*6, 0, 0, Math.PI*2); ctx.fill()
        ctx.globalAlpha = 0.22 * 0.7
        ctx.fillStyle = '#ffaa00'; ctx.beginPath(); ctx.ellipse(x+scale*4, y-scale*2, scale*5, scale*3, 0, 0, Math.PI*2); ctx.fill()
        ctx.restore(); break
      }
      case 'wave': {
        const ww = scale * 50
        ctx.save(); ctx.globalAlpha = 0.22; ctx.lineCap = 'round'
        ctx.strokeStyle = '#4499cc'; ctx.lineWidth = scale*3
        ctx.beginPath(); ctx.moveTo(x, y)
        ctx.quadraticCurveTo(x+ww*0.25, y-scale*9, x+ww*0.5, y)
        ctx.quadraticCurveTo(x+ww*0.75, y+scale*9, x+ww, y); ctx.stroke()
        ctx.globalAlpha = 0.22 * 0.6
        ctx.strokeStyle = '#66bbee'; ctx.lineWidth = scale*2
        ctx.beginPath(); ctx.moveTo(x+scale*5, y+scale*7)
        ctx.quadraticCurveTo(x+ww*0.3, y-scale*5, x+ww*0.6, y+scale*7); ctx.stroke()
        ctx.restore(); break
      }
      case 'cloud': {
        ctx.save(); ctx.globalAlpha = 0.15; ctx.fillStyle = 'white'
        ctx.beginPath(); ctx.ellipse(x, y, scale*22, scale*13, 0, 0, Math.PI*2); ctx.fill()
        ctx.beginPath(); ctx.ellipse(x+scale*14, y+scale*4, scale*18, scale*11, 0, 0, Math.PI*2); ctx.fill()
        ctx.beginPath(); ctx.ellipse(x-scale*12, y+scale*5, scale*16, scale*10, 0, 0, Math.PI*2); ctx.fill()
        ctx.restore(); break
      }
      case 'tower': {
        const h = scale * 30, tw = scale * 10
        ctx.save(); ctx.globalAlpha = 0.2
        ctx.fillStyle = '#6a6a7a'; ctx.fillRect(x-tw/2, y-h, tw, h)
        ctx.fillStyle = '#8a8a9a'; ctx.fillRect(x-tw/2-scale*2, y-h, tw+scale*4, scale*5)
        ctx.fillStyle = '#6a6a7a'; ctx.fillRect(x-scale*2, y-h-scale*6, scale*4, scale*6)
        ctx.fillStyle = '#7a7a8a'; ctx.fillRect(x-tw/2-scale*2, y-h-scale*6, tw+scale*4, scale*3)
        ctx.restore(); break
      }
      case 'pillar': {
        const h = scale * (16 + hashStr(`${k}${x}`) % 18), pw = scale * 7
        ctx.save(); ctx.globalAlpha = 0.18
        ctx.fillStyle = '#888'; ctx.fillRect(x-pw/2, y-h, pw, h)
        ctx.fillStyle = '#aaa'; ctx.fillRect(x-pw/2-scale*2, y-h, pw+scale*4, scale*4)
        ctx.fillStyle = '#aaa'; ctx.fillRect(x-pw/2-scale*2, y-scale*4, pw+scale*4, scale*4)
        ctx.restore(); break
      }
      case 'dune': {
        const dw = scale * 55
        ctx.save(); ctx.globalAlpha = 0.2
        ctx.fillStyle = '#c8a040'; ctx.beginPath(); ctx.ellipse(x, y, dw*0.5, scale*10, 0, 0, Math.PI*2); ctx.fill()
        ctx.fillStyle = '#b89030'; ctx.beginPath(); ctx.ellipse(x+dw*0.35, y+scale*4, dw*0.35, scale*8, 0, 0, Math.PI*2); ctx.fill()
        ctx.restore(); break
      }
    }
  }
}

function drawConnectorsCanvas(
  ctx: CanvasRenderingContext2D,
  rows: QuestNode[][],
  maxRowCols: number,
  mapHeight: number,
  statusOf: (id: string) => NodeStatus,
  reachableIds: Set<string>,
  hiddenNodeIds: Set<string>,
  environment: string | undefined,
): void {
  const colors = envColors(environment)
  const variantPriority: Record<LineVariant, number> = { frontier: 3, trail: 2, future: 1, dead: 0 }

  for (let rowIndex = 0; rowIndex < rows.length - 1; rowIndex++) {
    const prevRow     = rows[rowIndex]
    const nextRow     = rows[rowIndex + 1]
    const prevRowCols = prevRow[0]?.rowCols ?? prevRow.length
    const nextRowCols = nextRow[0]?.rowCols ?? nextRow.length
    const visualRow   = (node: QuestNode, rc: number) => (maxRowCols - rc) / 2 + node.col

    const nextById = new Map(nextRow.map(n => [n.id, n]))
    const best     = new Map<string, { variant: LineVariant; pr: number; cr: number }>()

    for (const parent of prevRow) {
      if (hiddenNodeIds.has(parent.id)) continue
      for (const childId of parent.childIds) {
        if (hiddenNodeIds.has(childId)) continue
        const child = nextById.get(childId)
        if (!child) continue
        const pr  = visualRow(parent, prevRowCols)
        const cr  = visualRow(child, nextRowCols)
        const key = `${pr}:${cr}`
        const v   = lineVariant(parent.id, childId, statusOf, reachableIds)
        const ex  = best.get(key)
        if (!ex || variantPriority[v] > variantPriority[ex.variant]) best.set(key, { variant: v, pr, cr })
      }
    }

    if (best.size === 0) continue

    const xStart = AVATAR_PADDING + (rowIndex + 1) * COL_WIDTH + rowIndex * CONN_W
    const xMid   = xStart + CONN_W / 2
    const xEnd   = xStart + CONN_W

    ctx.lineCap = 'round'

    for (const { variant, pr, cr } of best.values()) {
      const y1 = (pr + 0.5) / maxRowCols * mapHeight
      const y2 = (cr + 0.5) / maxRowCols * mapHeight

      const drawPath = () => {
        ctx.beginPath()
        ctx.moveTo(xStart, y1)
        ctx.bezierCurveTo(xMid, y1, xMid, y2, xEnd, y2)
      }

      if (variant === 'future') {
        drawPath(); ctx.strokeStyle = 'rgba(255,255,255,0.13)'; ctx.lineWidth = 2
        ctx.setLineDash([1.76, 2.64]); ctx.stroke(); ctx.setLineDash([])
      } else if (variant === 'dead') {
        drawPath(); ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1; ctx.stroke()
      } else {
        const surfaceColor = variant === 'frontier' ? colors.frontier : colors.trail
        const edgeColor    = variant === 'frontier' ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.5)'
        const outerWidth   = variant === 'frontier' ? 18 : 14
        const innerWidth   = variant === 'frontier' ? 11 : 8
        drawPath(); ctx.strokeStyle = edgeColor;    ctx.lineWidth = outerWidth; ctx.stroke()
        drawPath(); ctx.strokeStyle = surfaceColor; ctx.lineWidth = innerWidth; ctx.stroke()
      }
    }
  }
}

interface NodeMapCanvasProps {
  environment?: string
  actId: string
  mapWidth: number
  mapHeight: number
  maxRowCols: number
  rows: QuestNode[][]
  availableIds: string[]
  run: RunState
  reachableIds: Set<string>
  hiddenNodeIds: Set<string>
}

function NodeMapCanvas({
  environment, actId, mapWidth, mapHeight, maxRowCols,
  rows, availableIds, run, reachableIds, hiddenNodeIds,
}: NodeMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width  = mapWidth  * dpr
    canvas.height = mapHeight * dpr
    canvas.style.width  = `${mapWidth}px`
    canvas.style.height = `${mapHeight}px`
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, mapWidth, mapHeight)
    drawTerrainCanvas(ctx, environment, actId, mapWidth, mapHeight)
    const statusOf = (id: string) => getNodeStatus(id, availableIds, run)
    drawConnectorsCanvas(ctx, rows, maxRowCols, mapHeight, statusOf, reachableIds, hiddenNodeIds, environment)
  }, [environment, actId, mapWidth, mapHeight, maxRowCols, rows, availableIds, run, reachableIds, hiddenNodeIds])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    />
  )
}

// ── Node connector helpers ───────────────────────────────────────────────────

type LineVariant = 'trail' | 'frontier' | 'future' | 'dead'

function lineVariant(
  parentId: string, childId: string,
  statusOf: (id: string) => NodeStatus,
  reachableIds: Set<string>,
): LineVariant {
  const ps = statusOf(parentId)
  const cs = statusOf(childId)
  if (!reachableIds.has(parentId) || !reachableIds.has(childId)) return 'dead'
  if (ps === 'completed' && (cs === 'completed' || cs === 'pending')) return 'trail'
  if (ps === 'completed' && cs === 'available')                       return 'frontier'
  return 'future'
}

function envColors(env?: string): { trail: string; frontier: string } {
  switch (env) {
    case 'forest':   return { trail: 'rgba(80,140,60,0.6)',   frontier: 'rgba(100,220,80,0.9)'  }
    case 'citadel':
    case 'ruins':    return { trail: 'rgba(120,120,140,0.55)', frontier: 'rgba(180,180,210,0.9)' }
    case 'ashen':    return { trail: 'rgba(160,80,40,0.55)',   frontier: 'rgba(240,120,60,0.9)'  }
    case 'farmland': return { trail: 'rgba(140,160,60,0.55)',  frontier: 'rgba(200,220,80,0.9)'  }
    case 'frost':    return { trail: 'rgba(80,160,200,0.55)',  frontier: 'rgba(120,220,255,0.9)' }
    case 'volcano':  return { trail: 'rgba(200,80,20,0.6)',    frontier: 'rgba(255,120,30,0.95)' }
    case 'sand':     return { trail: 'rgba(200,160,60,0.55)',  frontier: 'rgba(240,200,80,0.9)'  }
    case 'reef':
    case 'coast':    return { trail: 'rgba(40,140,180,0.55)',  frontier: 'rgba(60,200,240,0.9)'  }
    case 'sky':      return { trail: 'rgba(100,140,200,0.55)', frontier: 'rgba(140,190,255,0.9)' }
    case 'fungal':   return { trail: 'rgba(120,60,160,0.55)',  frontier: 'rgba(180,80,240,0.9)'  }
    case 'vault':
    case 'camp':     return { trail: 'rgba(140,120,80,0.55)',  frontier: 'rgba(200,180,100,0.9)' }
    default:         return { trail: 'rgba(120,120,120,0.45)', frontier: 'rgba(51,255,51,0.85)'  }
  }
}

// ── Reward summary ───────────────────────────────────────────────────────────

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
  const h = handicap ?? 0
  return DIFFICULTY_LABELS[Math.min(h, DIFFICULTY_LABELS.length - 1)]
}

function difficultyColor(handicap: number | undefined): string {
  const h = handicap ?? 0
  if (h <= 1) return '#33ff33'
  if (h <= 3) return '#ffcc00'
  if (h <= 5) return '#ff8844'
  return '#ff4444'
}

const BOSS_AI_DESCRIPTIONS: Record<string, string> = {
  thornlord: 'Builds walls every turn — floods the field with structures and outlasts you.',
}

function playstyleDescription(node: QuestNode): string {
  if (node.bossAI && BOSS_AI_DESCRIPTIONS[node.bossAI]) {
    return BOSS_AI_DESCRIPTIONS[node.bossAI]
  }
  if (node.enemyDeck && node.enemyDeck.length > 0) {
    return `Deck: ${node.enemyDeck.join(', ')}`
  }
  return 'Plays a standard shuffled deck.'
}

/** Collapse multiple modifiers of the same type into one row with summed values. */
function collapseModifiers(modifiers: ReplayModifier[]): ReplayModifier[] {
  const byType = new Map<string, number>()
  for (const m of modifiers) {
    byType.set(m.type, (byType.get(m.type) ?? 0) + m.value)
  }
  return Array.from(byType.entries()).map(([type, total]) => {
    switch (type) {
      case 'enemyHpPercent':         return { type: type as ReplayModifier['type'], value: total, label: `+${total}% enemy HP` }
      case 'crystalBonus':           return { type: type as ReplayModifier['type'], value: total, label: `+${total} crystals per battle` }
      case 'enemyHandBonus':         return { type: type as ReplayModifier['type'], value: total, label: `Enemies start +${total} card${total !== 1 ? 's' : ''}` }
      case 'enemyIntervalReduction': return modifiers.find(m => m.type === type)!
      default:                       return modifiers.find(m => m.type === type)!
    }
  })
}

// ── Wandering sprite ─────────────────────────────────────────────────────────

const WANDER_RANGE = 10 // px radius from centre

function WanderingSprite({ name }: { name: string }) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dur, setDur] = useState(1200)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    function step() {
      const x = (Math.random() * 2 - 1) * WANDER_RANGE
      const y = (Math.random() * 2 - 1) * WANDER_RANGE
      const d = 600 + Math.random() * 1200
      setPos({ x, y })
      setDur(d)
      timer = setTimeout(step, d + 80)
    }
    // Stagger startup so sprites don't all move in sync
    timer = setTimeout(step, Math.random() * 1200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{ transform: `translate(${pos.x}px,${pos.y}px)`, transition: `transform ${dur}ms ease-in-out` }}>
      <AnimatedSpriteImg name={name} frameCount={3} fps={6} className="nm-node-sprite" />
    </div>
  )
}

// ── Node Peek Modal ──────────────────────────────────────────────────────────

interface PeekModalProps {
  node: QuestNode
  actId: string
  nodeHistory: Set<string>
  activeModifiers: ReplayModifier[]
  onEnter: () => void
  onClose: () => void
}

function NodePeekModal({ node, actId, nodeHistory, activeModifiers, onEnter, onClose }: PeekModalProps) {
  const hasPreviouslyCompleted = nodeHistory.has(`${actId}:${node.id}`)
  const isBattle = node.type === 'battle' || node.type === 'elite' || node.type === 'boss'

  return (
    <div className="nm-peek-backdrop" onClick={onClose}>
      <div className="nm-peek-panel" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="nm-peek-header u-col u-items-c u-gap-1">
          <span className={`nm-peek-type nm-node-type-badge--${node.type}`}>
            {NODE_LABEL[node.type] ?? node.type.toUpperCase()}
          </span>
          <span className="nm-peek-icon">{NODE_ICON[node.type] ?? '?'}</span>
          <span className="nm-peek-name">{node.label}</span>
        </div>

        {/* Description */}
        {node.description && (
          <div className="nm-peek-desc">{node.description}</div>
        )}

        {/* Reward */}
        <StatRow label="REWARD" value={<span className="nm-peek-reward">{rewardSummary(node)}</span>} />

        {/* Difficulty (battle nodes only) */}
        {isBattle && (
          <StatRow
            label="DIFFICULTY"
            value={<span style={{ color: difficultyColor(node.handicap) }}>{difficultyLabel(node.handicap)}</span>}
          />
        )}

        {/* Previously completed — reveal opponent deck */}
        {hasPreviouslyCompleted && isBattle && (
          <div className="nm-peek-history u-col u-gap-2">
            <div className="nm-peek-history-label">— INTEL (from previous run) —</div>
            <div className="nm-peek-history-body">{playstyleDescription(node)}</div>
          </div>
        )}

        {/* Active modifiers (battle nodes only) — same-type entries are summed */}
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

        {/* Actions */}
        <div className="nm-peek-actions u-flex u-gap-4">
          {(isBattle || node.type === 'event' || node.type === 'merchant') ? (
            <button className="action-btn nm-peek-enter-btn u-grow" onClick={onEnter}>
              {node.type === 'rest' ? 'REST' : node.type === 'merchant' ? 'ENTER SHOP' : node.type === 'event' ? 'APPROACH' : 'ENTER BATTLE'}
            </button>
          ) : (
            <button className="action-btn nm-peek-enter-btn u-grow" onClick={onEnter}>
              {node.type === 'rest' ? 'REST HERE' : 'PROCEED'}
            </button>
          )}
          <button className="action-btn nm-peek-back-btn" onClick={onClose}>
            BACK
          </button>
        </div>

      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function NodeMap({ act, run, onSelectNode, onUseConsumable, onBack }: Props) {
  const availableIds       = useMemo(() => getAvailableNodeIds(act, run), [act, run])
  const rows               = useMemo(() => buildRows(act), [act])
  const maxRowCols         = useMemo(() => Math.max(...rows.map(r => r[0]?.rowCols ?? r.length)), [rows])
  const reachableIds       = useMemo(() => computeReachableIds(act, run), [act, run])
  const discoveredFragIds  = useMemo(() => getDiscoveredFragmentIds(), [])
  const hiddenNodeIds      = useMemo(() => {
    const ids = new Set<string>()
    for (const node of Object.values(act.nodes)) {
      if (node.type !== 'memory' || !node.fragmentId) continue
      const alreadyFound = discoveredFragIds.has(node.fragmentId)
      const visitedThisRun = run.completedNodeIds.includes(node.id)
      if (alreadyFound && !visitedThisRun) {
        // Collected in a previous run — always hide
        ids.add(node.id)
      } else if (!alreadyFound && !visitedThisRun) {
        // Not yet collected — 20% chance to appear this run
        const roll = hashStr(node.id + String(run.runSeed)) % 100
        if (roll >= 20) ids.add(node.id)
      }
    }
    return ids
  }, [act, discoveredFragIds, run])

  const mapHeight = maxRowCols * ROW_HEIGHT
  const mapWidth  = AVATAR_PADDING + rows.length * COL_WIDTH + Math.max(0, rows.length - 1) * 44

  const statusOf = (id: string): NodeStatus => getNodeStatus(id, availableIds, run)

  // Node peek state
  const [peekNode, setPeekNode] = useState<QuestNode | null>(null)
  const nodeHistory = useMemo(() => loadNodeHistory(), [])

  // Avatar state
  const [avatarPos, setAvatarPos] = useState<{ x: number; y: number } | null>(null)
  const [isWalking, setIsWalking] = useState(false)
  const [walkFrame, setWalkFrame] = useState(0)

  const mapRef         = useRef<HTMLDivElement>(null)
  const mapInnerRef    = useRef<HTMLDivElement>(null)
  const currentRef     = useRef<HTMLDivElement>(null)
  const nodeButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const currentNodeId = run.pendingNodeId
    ?? rows.flatMap(r => r).find(n => availableIds.includes(n.id))?.id

  // On mount: scroll to current node, then place avatar using DOM measurement
  useEffect(() => {
    const mapEl      = mapRef.current
    const mapInnerEl = mapInnerRef.current
    const scrollToEl = currentRef.current

    if (mapEl && scrollToEl) {
      const mapRect  = mapEl.getBoundingClientRect()
      const nodeRect = scrollToEl.getBoundingClientRect()
      mapEl.scrollLeft += nodeRect.left - mapRect.left - (mapRect.width - nodeRect.width) / 2
    }

    if (!mapInnerEl) {
      setAvatarPos(startPosition(mapHeight))
      return
    }
    const lastNode = lastCompletedNode(act, run)
    if (lastNode) {
      const nodeBtn = nodeButtonRefs.current[lastNode.id]
      if (nodeBtn) {
        setAvatarPos(getRelativeCenter(nodeBtn, mapInnerEl))
        return
      }
    }
    setAvatarPos(startPosition(mapHeight))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNodeClick = (node: QuestNode) => {
    if (isWalking) return
    const mapInnerEl = mapInnerRef.current
    const nodeBtn    = nodeButtonRefs.current[node.id]
    if (!mapInnerEl || !nodeBtn) return
    const target = getRelativeCenter(nodeBtn, mapInnerEl)

    setIsWalking(true)
    setAvatarPos(target)  // CSS transition animates the move
    const frameTimer = setInterval(() => setWalkFrame(f => (f % 3) + 1), 175)
    emitSound('mapFootstep')
    const stepTimer  = setInterval(() => emitSound('mapFootstep'), 350)

    setTimeout(() => {
      clearInterval(frameTimer)
      clearInterval(stepTimer)
      setWalkFrame(0)
      setIsWalking(false)
      setPeekNode(node)
    }, WALK_DURATION)
  }

  const handlePeekEnter = () => {
    if (!peekNode) return
    setPeekNode(null)
    onSelectNode(peekNode)
  }

  return (
    <OverlayScreen 
    onBack={onBack}
     title={act.title} 
     subtitle={act.subtitle}
     >


    <div className="nodemap u-col u-grow">

      {/* Consumables bar */}
      <Toolbar>
        {run.archetype && (() => {
          const def = ARCHETYPE_DEFS.find(d => d.id === run.archetype)
          return def ? <ToolbarLabel>{def.icon} {def.name}</ToolbarLabel> : null
        })()}
        <ToolbarLabel>Items</ToolbarLabel>

      
        {ALL_CONSUMABLES.map(def => {
          const rc = run.consumables?.find(c => c.id === def.id)
          const count = rc?.count ?? 0
          return (
            <>
            <ToolbarButton key={def.id}
            label={`${def.name} ×${count}`}
            icon={def.icon}
            disabled={count === 0} 
            onClick={() => onUseConsumable(def.id)}
            />
            </>
          )
        })}

        <ToolbarSpacer />
        <ToolbarButton
          label="Copy Debug State"
          icon="🐞"
          onClick={() => {
            const nodeStatuses: Record<string, string> = {}
            for (const node of Object.values(act.nodes)) {
              nodeStatuses[node.id] = `${node.type} → ${statusOf(node.id)}`
            }
            const state = {
              actId:            run.actId,
              pendingNodeId:    run.pendingNodeId,
              completedNodeIds: run.completedNodeIds,
              skippedNodeIds:   run.skippedNodeIds,
              availableIds,
              nodeStatuses,
            }
            const text = JSON.stringify(state, null, 2)
            console.log('[NodeMap debug]', state)
            navigator.clipboard?.writeText(text).catch(() => undefined)
            alert('Debug state copied to clipboard (also logged to console).')
          }}
        />
      </Toolbar>


      {/* Map — left-to-right: each act row renders as a vertical column */}
      <div className={`nm-map u-flex u-grow u-items-c${act.environment ? ` nm-map--${act.environment}` : ''}`} ref={mapRef}>
        <div className="nm-map-inner u-row u-items-c" ref={mapInnerRef} style={{ height: `${mapHeight}px`, paddingLeft: `${AVATAR_PADDING}px`, position: 'relative', gap: `${CONN_W}px` }}>
          <NodeMapCanvas
            environment={act.environment}
            actId={act.id}
            mapWidth={mapWidth}
            mapHeight={mapHeight}
            maxRowCols={maxRowCols}
            rows={rows}
            availableIds={availableIds}
            run={run}
            reachableIds={reachableIds}
            hiddenNodeIds={hiddenNodeIds}
          />
          {/* Node-0 campfire marker */}
          <img
            src="/sprites/campfire.svg"
            alt=""
            style={{
              position: 'absolute',
              left: startPosition(mapHeight).x - 18,
              top:  startPosition(mapHeight).y - 18,
              width: 36, height: 36,
              opacity: 0.75,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
          {/* Player avatar */}
          {avatarPos && (
            <div
              className={isWalking ? 'nm-avatar nm-avatar--walking' : 'nm-avatar'}
              style={{
                left: avatarPos.x - AVATAR_SIZE / 2,
                top:  avatarPos.y - AVATAR_SIZE / 2,
                transition: isWalking
                  ? `left ${WALK_DURATION}ms ease-in-out, top ${WALK_DURATION}ms ease-in-out`
                  : undefined,
              }}
            >
              <img
                src={`/sprites/${loadPlayerAvatar()}.svg`}
                alt="Jarv"
                style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, imageRendering: 'pixelated' }}
              />
            </div>
          )}
          {rows.map((rowNodes, rowIndex) => {
            const rowCols = rowNodes[0]?.rowCols ?? rowNodes.length
            return (
              <React.Fragment key={rowIndex}>
                {/* Column of nodes — fixed-height rows, centred in the container */}
                <div
                  className="nm-col"
                  style={{
                    gridTemplateRows: `repeat(${rowCols}, ${ROW_HEIGHT}px)`,
                    height: `${rowCols * ROW_HEIGHT}px`,
                    width: `${COL_WIDTH}px`,
                    margin: 'auto 0',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  {rowNodes.map((node) => {
                    if (hiddenNodeIds.has(node.id)) {
                      return <div key={node.id} style={{ gridRow: node.col + 1 }} />
                    }

                    const status    = getNodeStatus(node.id, availableIds, run)
                    const clickable = status === 'available'
                    const dim = status === 'completed'
                             || status === 'skipped'
                             || (status === 'locked' && !reachableIds.has(node.id))
                    const isCurrent = node.id === currentNodeId

                    return (
                      <div
                        key={node.id}
                        ref={isCurrent ? currentRef : undefined}
                        style={{ gridRow: node.col + 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                      >
                        <button
                          ref={el => { nodeButtonRefs.current[node.id] = el }}
                          className={[
                            'nm-node',
                            `nm-node--${node.type}`,
                            `nm-node--${status}`,
                            dim ? 'nm-node--dim' : '',
                          ].filter(Boolean).join(' ')}
                          onClick={clickable && !isWalking ? () => handleNodeClick(node) : undefined}
                          disabled={!clickable}
                          title={node.description}
                        >
                          <span className={`nm-node-type-badge nm-node-type-badge--${node.type}`}>
                            {NODE_LABEL[node.type] ?? node.type.toUpperCase()}
                          </span>
                          {(() => {
                            if ((node.type === 'battle' || node.type === 'elite') && node.enemyDeck?.length) {
                              const unitName = node.enemyDeck[0]
                              if (status === 'completed') {
                                return <span className="nm-node-icon">🪦</span>
                              }
                              const isBuilding = (getCardUnit(unitName)?.moveSpeed ?? 1) === 0
                              if (isBuilding) {
                                const slug = spriteSlug(unitName)
                                return <img src={`/sprites/${slug}.svg`} alt="" className="nm-node-sprite"
                                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                              }
                              return <WanderingSprite name={unitName} />
                            }
                            const sprite = nodeSprite(node)
                            return sprite
                              ? <img src={sprite} alt="" className="nm-node-sprite"
                                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                              : <span className="nm-node-icon">{NODE_ICON[node.type] ?? '?'}</span>
                          })()}
                          <span className="nm-node-name">{node.label}</span>
                          <span className="nm-node-status">
                            {status === 'completed' && '✓'}
                            {status === 'pending'   && '…'}
                            {status === 'skipped'   && '╳'}
                            {status === 'available' && node.type === 'rest'
                              ? `+${node.restHeal} HP`
                              : status === 'available' ? '' : ''}
                          </span>
                        </button>
                      </div>
                    )
                  })}
                </div>

              </React.Fragment>
            )
          })}
        </div>
      </div>


      {/* Node peek modal */}
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
        <div className="nm-lives-area u-flex u-items-end u-just-end u-gap-1 " title="Lives remaining — lose them all and the campaign ends">
          <Lives maxLives={run.maxLives ?? 3} currentLives={run.livesRemaining ?? 3} />
        </div>
      </div>
      </Toolbar>
    </OverlayScreen>
  )
}
