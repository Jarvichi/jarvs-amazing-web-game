import React, { useRef, useState, useEffect } from 'react'
import * as PIXI from 'pixi.js'
import { Act } from '../../game/questline'
import { usePixiApp } from '../../hooks/usePixiApp'
import { drawTerrainItem } from '../../utils/terrainGfx'

// ── Types (mirror the Act field shapes) ────────────────────────────────────────

export interface TerrainItemDef { kind: string; x: number; y: number; scale: number }
export interface RiverDef {
  x1: number; y1: number; x2: number; y2: number
  cx1: number; cy1: number; cx2: number; cy2: number
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TERRAIN_KINDS = [
  'mountain', 'tree', 'deadtree', 'crystal', 'mushroom',
  'lava', 'wave', 'cloud', 'tower', 'pillar', 'dune',
]
const KIND_ICONS: Record<string, string> = {
  mountain: '⛰', tree: '🌲', deadtree: '🪵', crystal: '💎', mushroom: '🍄',
  lava: '🌋', wave: '🌊', cloud: '☁', tower: '🏰', pillar: '🗿', dune: '🏜',
}

const COL_WIDTH = 112, ROW_HEIGHT = 112, AVATAR_PADDING = 72, CONN_W = 44

// ── River colour helpers (mirrors NodeMap.tsx) ─────────────────────────────────

function riverColors(env: string | undefined) {
  const base = env === 'volcano' ? 0xcc4400 : env === 'fungal' ? 0x6633aa : env === 'frost' ? 0x88ddff : 0x2255aa
  const r = (base >> 16) & 0xff, g = (base >> 8) & 0xff, b = base & 0xff
  return {
    base,
    dark:  (Math.round(r * 0.55) << 16) | (Math.round(g * 0.55) << 8) | Math.round(b * 0.55),
    light: (Math.min(255, Math.round(r * 1.45)) << 16) | (Math.min(255, Math.round(g * 1.45)) << 8) | Math.min(255, Math.round(b * 1.45)),
  }
}

function drawRiverOnGfx(
  gfx: PIXI.Graphics,
  r: RiverDef,
  colors: ReturnType<typeof riverColors>,
  alpha = 1,
) {
  const { x1, y1, cx1, cy1, cx2, cy2, x2, y2 } = r
  gfx.moveTo(x1, y1).bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2).stroke({ color: colors.dark,  width: 20, alpha: 0.65 * alpha, cap: 'round' })
  gfx.moveTo(x1, y1).bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2).stroke({ color: colors.base,  width: 13, alpha: 0.75 * alpha, cap: 'round' })
  gfx.moveTo(x1, y1).bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2).stroke({ color: colors.light, width: 7,  alpha: 0.55 * alpha, cap: 'round' })
  gfx.moveTo(x1, y1).bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2).stroke({ color: 0xffffff,     width: 2,  alpha: 0.38 * alpha, cap: 'round' })
}

// ── Node background preview ────────────────────────────────────────────────────

function drawNodeBg(
  container: PIXI.Container,
  act: Act,
  rowNums: number[],
  maxRowCols: number,
  mapWidth: number,
  mapHeight: number,
) {
  const g = new PIXI.Graphics()
  // Faint background
  g.rect(0, 0, mapWidth, mapHeight).fill({ color: 0x000000, alpha: 0.55 })

  const NODE_COLORS: Record<string, number> = {
    battle: 0xdd5050, elite: 0xddbb30, boss: 0xff2222,
    rest: 0x33cc55, event: 0x5588ff, merchant: 0xccaa30,
  }

  for (const node of Object.values(act.nodes)) {
    const rowIndex = rowNums.indexOf(node.row)
    const rowCols = node.rowCols ?? 1
    const x = AVATAR_PADDING + rowIndex * (COL_WIDTH + CONN_W) + COL_WIDTH / 2
    const y = ((maxRowCols - rowCols) / 2 + node.col + 0.5) * ROW_HEIGHT
    const col = NODE_COLORS[node.type] ?? 0x888888
    g.circle(x, y, 14).fill({ color: col, alpha: 0.22 })
    g.circle(x, y, 14).stroke({ color: col, alpha: 0.45, width: 1.5 })
  }
  container.addChild(g)
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  act: Act
  onUpdate: (terrainItems: TerrainItemDef[], rivers: RiverDef[]) => void
}

export function TerrainEditorPanel({ act, onUpdate }: Props) {
  // Map dimensions
  const allNodes = Object.values(act.nodes)
  const rowNums = [...new Set(allNodes.map(n => n.row))].sort((a, b) => a - b)
  const maxRowCols = Math.max(1, ...allNodes.map(n => n.rowCols ?? 1))
  const mapHeight = maxRowCols * ROW_HEIGHT
  const mapWidth  = AVATAR_PADDING + rowNums.length * COL_WIDTH + Math.max(0, rowNums.length - 1) * CONN_W

  // Editor state
  const [toolMode,      setToolMode]      = useState<string>('select')
  const [items,         setItems]         = useState<TerrainItemDef[]>(() => act.terrainItems ?? [])
  const [rivers,        setRivers]        = useState<RiverDef[]>(() => act.rivers ?? [])
  const [selectedItem,  setSelectedItem]  = useState<number | null>(null)
  const [selectedRiver, setSelectedRiver] = useState<number | null>(null)
  const [riverPoints,   setRiverPoints]   = useState<{ x: number; y: number }[]>([])

  // Reset when act changes
  useEffect(() => {
    setItems(act.terrainItems ?? [])
    setRivers(act.rivers ?? [])
    setSelectedItem(null)
    setSelectedRiver(null)
    setRiverPoints([])
    setToolMode('select')
  }, [act.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent whenever editor state changes
  useEffect(() => {
    onUpdate(items, rivers)
  }, [items, rivers]) // eslint-disable-line react-hooks/exhaustive-deps

  // PixiJS layer refs
  const canvasRef     = useRef<HTMLDivElement>(null)
  const itemsLayerRef = useRef<PIXI.Container | null>(null)
  const riverLayerRef = useRef<PIXI.Container | null>(null)
  const overlayLayerRef = useRef<PIXI.Container | null>(null)

  // Drag state
  const dragRef = useRef<{
    idx: number
    startItemPos: { x: number; y: number }
    startPtrPos:  { x: number; y: number }
  } | null>(null)
  const isDraggingRef = useRef(false)

  // Always-current state accessible from PixiJS handlers
  const stateRef = useRef({ toolMode, items, selectedItem, selectedRiver, riverPoints })
  stateRef.current = { toolMode, items, selectedItem, selectedRiver, riverPoints }

  // ── PixiJS init (once) ────────────────────────────────────────────────────────
  usePixiApp(canvasRef, mapWidth, mapHeight, (app) => {
    app.canvas.style.touchAction = 'pan-x pan-y'

    const bgLayer      = new PIXI.Container()
    const riverLayer   = new PIXI.Container()
    const itemsLayer   = new PIXI.Container()
    itemsLayer.sortableChildren = true
    const overlayLayer = new PIXI.Container()

    app.stage.addChild(bgLayer, riverLayer, itemsLayer, overlayLayer)
    riverLayerRef.current   = riverLayer
    itemsLayerRef.current   = itemsLayer
    overlayLayerRef.current = overlayLayer

    drawNodeBg(bgLayer, act, rowNums, maxRowCols, mapWidth, mapHeight)

    // Stage hit area
    app.stage.eventMode = 'static'
    app.stage.hitArea = new PIXI.Rectangle(0, 0, mapWidth, mapHeight)

    app.stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      const { toolMode: mode } = stateRef.current
      if (mode === 'select') {
        setSelectedItem(null)
        setSelectedRiver(null)
        return
      }
      const pt = { x: Math.round(e.global.x), y: Math.round(e.global.y) }
      if (mode === 'river') {
        setRiverPoints(prev => {
          const next = [...prev, pt]
          if (next.length === 4) {
            setRivers(r => [...r, {
              x1: next[0].x, y1: next[0].y,
              cx1: next[1].x, cy1: next[1].y,
              cx2: next[2].x, cy2: next[2].y,
              x2: next[3].x, y2: next[3].y,
            }])
            return []
          }
          return next
        })
        return
      }
      // Place mode — add item
      setItems(prev => [...prev, { kind: mode, x: pt.x, y: pt.y, scale: 1.0 }])
    })

    // Drag move
    app.stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const il = itemsLayerRef.current
      if (!il) return
      const dx = e.global.x - drag.startPtrPos.x
      const dy = e.global.y - drag.startPtrPos.y
      const c = il.children[drag.idx] as PIXI.Container | undefined
      if (c) c.position.set(drag.startItemPos.x + dx, drag.startItemPos.y + dy)
    })

    // Drag commit
    app.stage.on('pointerup', (e: PIXI.FederatedPointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const dx = e.global.x - drag.startPtrPos.x
      const dy = e.global.y - drag.startPtrPos.y
      dragRef.current = null
      isDraggingRef.current = false
      setItems(prev => prev.map((it, i) => i === drag.idx
        ? { ...it, x: Math.round(drag.startItemPos.x + dx), y: Math.round(drag.startItemPos.y + dy) }
        : it
      ))
    })

    app.stage.on('pointerupoutside', () => {
      if (!dragRef.current) return
      dragRef.current = null
      isDraggingRef.current = false
    })

    app.ticker.add(() => { itemsLayer.sortChildren() })
  })

  // ── Rebuild items layer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isDraggingRef.current) return
    const il = itemsLayerRef.current
    if (!il) return
    il.removeChildren()

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const container = new PIXI.Container()
      container.position.set(item.x, item.y)
      container.zIndex   = item.y
      container.eventMode = 'static'
      container.cursor   = 'pointer'
      container.hitArea  = new PIXI.Circle(0, 0, Math.max(20, item.scale * 28))

      const g = new PIXI.Graphics()
      drawTerrainItem(g, item.kind, item.scale, act.environment, i)
      container.addChild(g)

      if (i === selectedItem) {
        const ring = new PIXI.Graphics()
        ring.circle(0, 0, Math.max(22, item.scale * 28)).stroke({ color: 0x44ff44, width: 2.5, alpha: 0.9 })
        container.addChild(ring)
      }

      const idx = i
      container.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        if (stateRef.current.toolMode !== 'select') return
        e.stopPropagation()
        setSelectedItem(idx)
        setSelectedRiver(null)
        isDraggingRef.current = true
        dragRef.current = {
          idx,
          startItemPos: { x: item.x, y: item.y },
          startPtrPos:  { x: e.global.x, y: e.global.y },
        }
      })

      il.addChild(container)
    }
  }, [items, selectedItem, act.environment]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rebuild river layer ────────────────────────────────────────────────────────
  useEffect(() => {
    const rl = riverLayerRef.current
    const ol = overlayLayerRef.current
    if (!rl || !ol) return
    rl.removeChildren()
    ol.removeChildren()

    const colors = riverColors(act.environment)

    for (let i = 0; i < rivers.length; i++) {
      const g = new PIXI.Graphics()
      drawRiverOnGfx(g, rivers[i], colors)

      if (i === selectedRiver) {
        const { x1, y1, x2, y2 } = rivers[i]
        g.circle((x1 + x2) / 2, (y1 + y2) / 2, 10).stroke({ color: 0x44ff44, width: 2.5, alpha: 0.9 })
      }

      g.eventMode = 'static'
      const riv = rivers[i]
      g.hitArea = new PIXI.Rectangle(
        Math.min(riv.x1, riv.x2) - 12, Math.min(riv.y1, riv.y2) - 12,
        Math.abs(riv.x2 - riv.x1) + 24, Math.abs(riv.y2 - riv.y1) + 24,
      )
      const ri = i
      g.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        if (stateRef.current.toolMode !== 'select') return
        e.stopPropagation()
        setSelectedRiver(ri)
        setSelectedItem(null)
      })
      rl.addChild(g)
    }

    // In-progress river overlay
    if (riverPoints.length > 0) {
      const og = new PIXI.Graphics()
      for (const pt of riverPoints) {
        og.circle(pt.x, pt.y, 6).fill({ color: 0xffaa00, alpha: 0.9 })
      }
      for (let i = 1; i < riverPoints.length; i++) {
        og.moveTo(riverPoints[i-1].x, riverPoints[i-1].y)
          .lineTo(riverPoints[i].x, riverPoints[i].y)
          .stroke({ color: 0xffaa00, width: 1.5, alpha: 0.55, cap: 'round' })
      }
      ol.addChild(og)
    }
  }, [rivers, selectedRiver, riverPoints, act.environment]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItem !== null) {
          setItems(prev => prev.filter((_, i) => i !== selectedItem))
          setSelectedItem(null)
        } else if (selectedRiver !== null) {
          setRivers(prev => prev.filter((_, i) => i !== selectedRiver))
          setSelectedRiver(null)
        }
      }
      if (e.key === 'Escape') {
        setRiverPoints([])
        if (toolMode === 'river') setToolMode('select')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedItem, selectedRiver, toolMode])

  // ── JSON output ───────────────────────────────────────────────────────────────
  const selectedItemDef = selectedItem !== null ? items[selectedItem] ?? null : null

  const jsonOutput = JSON.stringify({
    ...(items.length  > 0 ? { terrainItems: items }  : {}),
    ...(rivers.length > 0 ? { rivers }               : {}),
  }, null, 2)

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Mode toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button
          className={`action-btn${toolMode === 'select' ? ' action-btn--gold' : ''}`}
          onClick={() => setToolMode('select')}
        >
          SELECT
        </button>
        <button
          className={`action-btn${toolMode === 'river' ? ' action-btn--gold' : ''}`}
          onClick={() => { setToolMode('river'); setRiverPoints([]) }}
        >
          RIVER{riverPoints.length > 0 ? ` (${riverPoints.length}/4)` : ''}
        </button>
        {TERRAIN_KINDS.map(k => (
          <button
            key={k}
            className={`action-btn${toolMode === k ? ' action-btn--gold' : ''}`}
            onClick={() => setToolMode(k)}
          >
            {KIND_ICONS[k]} {k.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Instruction line */}
      <div className="settings-sublabel" style={{ fontSize: 11 }}>
        {toolMode === 'select'
          ? 'Click item to select • Drag to move • Delete key or button to remove'
          : toolMode === 'river'
          ? `Click 4 points: start → control1 → control2 → end  (${riverPoints.length}/4)  •  ESC to cancel`
          : `Click map to place ${toolMode}  •  switch to SELECT to move/delete`}
      </div>

      {/* Scale / delete for selected item */}
      {selectedItemDef && (
        <div className="settings-row u-flex u-items-c u-gap-4">
          <div className="settings-label" style={{ minWidth: 50 }}>Scale</div>
          <input
            type="range" min="0.3" max="2.5" step="0.05"
            value={selectedItemDef.scale}
            onChange={e => {
              const s = parseFloat(e.target.value)
              setItems(prev => prev.map((it, i) => i === selectedItem ? { ...it, scale: s } : it))
            }}
            style={{ flex: 1 }}
          />
          <div className="settings-sublabel" style={{ minWidth: 36 }}>{selectedItemDef.scale.toFixed(2)}</div>
          <button className="action-btn" onClick={() => { setItems(p => p.filter((_, i) => i !== selectedItem)); setSelectedItem(null) }}>
            DELETE
          </button>
        </div>
      )}

      {/* Delete selected river */}
      {selectedRiver !== null && (
        <div className="settings-row u-flex u-items-c u-gap-4">
          <div className="settings-label">River {selectedRiver + 1} selected</div>
          <button className="action-btn" onClick={() => { setRivers(p => p.filter((_, i) => i !== selectedRiver)); setSelectedRiver(null) }}>
            DELETE
          </button>
        </div>
      )}

      {/* Canvas */}
      <div style={{ overflowX: 'auto' }}>
        <div ref={canvasRef} style={{ display: 'block', width: mapWidth, height: mapHeight }} />
      </div>

      {/* Actions + JSON */}
      <div className="u-flex u-gap-4 u-items-c" style={{ flexWrap: 'wrap' }}>
        <button className="action-btn" onClick={() => { setItems([]); setRivers([]); setSelectedItem(null); setSelectedRiver(null) }}>
          CLEAR ALL
        </button>
        <button
          className="action-btn action-btn--gold"
          onClick={() => navigator.clipboard?.writeText(jsonOutput).catch(() => undefined)}
        >
          COPY JSON
        </button>
        <div className="settings-sublabel">{items.length} item{items.length !== 1 ? 's' : ''}, {rivers.length} river{rivers.length !== 1 ? 's' : ''}</div>
      </div>

      <textarea
        readOnly
        value={jsonOutput || '(empty — place items to generate JSON)'}
        style={{
          width: '100%', height: 130,
          background: '#0a0a0a', color: '#aaa',
          fontSize: 11, fontFamily: 'monospace',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 4, padding: 8, resize: 'vertical',
        }}
      />
    </div>
  )
}
