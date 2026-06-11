import { useRef, useEffect, useCallback } from 'react'
import * as PIXI from 'pixi.js'
import {
  buildingUnitCount, hpBarColor,
  TD_CELL_PX as CELL_PX, TD_COLS, TD_MAX_UPGRADES, TD_PATH, TD_ROWS,
  PATH_SET,
  TDAttackEvent, TDGameState, TDTower, TDUnit, xpToUpgrade,
} from '../../../game/towerDefence'
import { usePixiApp } from '../../../hooks/usePixiApp'
import { loadAnimFrames, loadSpriteTexture, loadTileRef } from '../../../utils/pixiHelpers'
import { PATH_TILE_LOOKUP } from '../../../utils/tileLookup'
import { TILE_SIZE } from '../../../data/tiles/tileIndex'
import { WORLD_ENV_TILES } from '../../../data/tiles/worldTileIndex'

// ── Cell colours ─────────────────────────────────────────────────────────────
const C_GRASS          = 0x2d4a1e
const C_PATH           = 0x8b6b3d
const C_START          = 0x1a5c0e
const C_END            = 0x5c0e0e
const C_IN_RANGE       = 0x224488
const C_DROPPABLE      = 0x1a3d1a
const C_TOWER_SELECTED = 0x7a5500
const C_BORDER_DARK    = 0x111111


export interface Props {
  boardWrapRef: React.RefObject<HTMLDivElement>
  game: TDGameState
  selectedTowerId: number | null
  rangeHighlight: Set<string>
  canPlaceTowers: boolean
  selected: boolean
  setHoveredTower: (tower: TDTower | null) => void
  setHoveredCell: (cell: { col: number; row: number } | null) => void
  handleCellClick: (col: number, row: number) => void
  gridScale: number
  isOnPath(col: number, row: number): boolean
  selectedTower: TDTower | null
  hoveredTower: TDTower | null
  environment?: string
}

// ── Scene object refs ─────────────────────────────────────────────────────────

interface Scene {
  terrainLayer: PIXI.Container
  cellGfx:    PIXI.Graphics
  towerLayer: PIXI.Container
  unitLayer:  PIXI.Container
  enemyLayer: PIXI.Container
  effectGfx:  PIXI.Graphics
  hazardGfx:  PIXI.Graphics
  hpGfx:      PIXI.Graphics
  // Sprite pools keyed by id
  enemySprites: Map<number, PIXI.AnimatedSprite>
  unitSprites:  Map<number, PIXI.AnimatedSprite>  // keyed by towerId
  towerSprites: Map<number, PIXI.Container>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cellLeft(col: number) { return col * CELL_PX }
function cellTop (row: number) { return row * CELL_PX }
function cellCx  (col: number) { return col * CELL_PX + CELL_PX / 2 }
function cellCy  (row: number) { return row * CELL_PX + CELL_PX / 2 }

function hpBarColorHex(frac: number): number {
  return parseInt(hpBarColor(frac).slice(1), 16)
}

// ── Draw cells ────────────────────────────────────────────────────────────────

function drawCells(
  g: PIXI.Graphics,
  rangeHighlight: Set<string>,
  selectedTowerId: number | null,
  canPlaceTowers: boolean,
  selected: boolean,
  towers: TDTower[],
) {
  if (!g || g.destroyed) return
  g.clear()
  const towerByCell = new Map(towers.map(t => [`${t.col},${t.row}`, t]))

  for (let row = 0; row < TD_ROWS; row++) {
    for (let col = 0; col < TD_COLS; col++) {
      const key    = `${col},${row}`
      const onPath = PATH_SET.has(key)
      const isStart = col === TD_PATH[0].col          && row === TD_PATH[0].row
      const isEnd   = col === TD_PATH[TD_PATH.length - 1].col && row === TD_PATH[TD_PATH.length - 1].row
      const tower   = towerByCell.get(key)
      const inRange = rangeHighlight.has(key)
      const isTowerSelected = tower?.id === selectedTowerId
      const canDrop = !onPath && !tower && ((selected && canPlaceTowers) || selectedTowerId !== null)

      const base = isStart ? C_START : isEnd ? C_END : onPath ? C_PATH : C_GRASS
      const fill = isTowerSelected ? C_TOWER_SELECTED
                 : inRange         ? C_IN_RANGE
                 : canDrop         ? C_DROPPABLE
                 : base

      const x = cellLeft(col)
      const y = cellTop(row)
      // Skip opaque fills for base grass/path — world tile layer provides the base visual.
      // Keep start/end markers and highlight overlays (semi-transparent).
      const isBaseFill = fill === C_GRASS || fill === C_PATH
      if (!isBaseFill) {
        const alpha = (fill === C_IN_RANGE || fill === C_DROPPABLE) ? 0.45 : 1.0
        g.rect(x, y, CELL_PX, CELL_PX).fill({ color: fill, alpha })
      }
      if (selected && canPlaceTowers) {
        g.rect(x, y, CELL_PX, CELL_PX).stroke({ width: 1, color: C_BORDER_DARK, alpha: 0.3 })
      }

      // IN / BASE labels
      if (isStart || isEnd) {
        // Drawn via PIXI.Text in a separate pass for legibility
      }
    }
  }
}

// ── Sync tower sprites ────────────────────────────────────────────────────────

async function syncTowers(
  layer: PIXI.Container,
  towerSprites: Map<number, PIXI.Container>,
  towers: TDTower[],
) {
  const liveIds = new Set(towers.map(t => t.id))

  // Remove stale
  for (const [id, c] of towerSprites) {
    if (!liveIds.has(id)) { layer.removeChild(c); c.destroy({ children: true }); towerSprites.delete(id) }
  }

  // Add/update
  for (const tower of towers) {
    let ctr = towerSprites.get(tower.id)
    if (!ctr) {
      ctr = new PIXI.Container()
      try {
        const tex = await loadSpriteTexture(tower.buildingName)
        const spr = new PIXI.Sprite(tex)
        spr.width = CELL_PX - 8
        spr.height = CELL_PX - 8
        spr.x = 4; spr.y = 4
        ctr.addChild(spr)
      } catch {
        // sprite missing — render a placeholder square
        const g = new PIXI.Graphics()
        g.rect(4, 4, CELL_PX - 8, CELL_PX - 8).fill(0x886600)
        ctr.addChild(g)
      }
      layer.addChild(ctr)
      towerSprites.set(tower.id, ctr)
    }
    ctr.x = cellLeft(tower.col)
    ctr.y = cellTop(tower.row)

    // Badge text (tier, ready)
    const existingBadge = ctr.getChildByLabel('badge') as PIXI.Text | null
    existingBadge?.destroy()

    if (tower.upgrades > 0) {
      const t = new PIXI.Text({ text: `★${tower.upgrades}`, style: { fontSize: 8, fill: 0xffdd00 } })
      t.label = 'badge'
      t.x = 1; t.y = 1
      ctr.addChild(t)
    }

    // Upgrade-ready indicator
    const xpNeeded = xpToUpgrade(tower)
    const existingReady = ctr.getChildByLabel('ready') as PIXI.Text | null
    existingReady?.destroy()
    if (tower.upgrades < TD_MAX_UPGRADES && tower.xp >= xpNeeded) {
      const t = new PIXI.Text({ text: '⬆', style: { fontSize: 9, fill: 0x44ff44 } })
      t.label = 'ready'
      t.x = CELL_PX - 11; t.y = 1
      ctr.addChild(t)
    }
  }
}

// ── Sync animated entity sprites ──────────────────────────────────────────────

async function syncEntitySprites(
  layer: PIXI.Container,
  sprites: Map<number, PIXI.AnimatedSprite>,
  entities: Array<{ id: number; x: number; y: number; spriteName: string }>,
  size: number,
  fps: number,
) {
  const liveIds = new Set(entities.map(e => e.id))

  for (const [id, spr] of sprites) {
    if (!liveIds.has(id)) { layer.removeChild(spr); spr.destroy(); sprites.delete(id) }
  }

  for (const ent of entities) {
    let spr = sprites.get(ent.id)
    if (!spr) {
      try {
        const frames = await loadAnimFrames(ent.spriteName, 3)
        spr = new PIXI.AnimatedSprite(frames)
        spr.animationSpeed = fps / 60
        spr.play()
      } catch {
        // fallback: static sprite
        try {
          const tex = await loadSpriteTexture(ent.spriteName)
          spr = new PIXI.AnimatedSprite([tex])
        } catch {
          spr = new PIXI.AnimatedSprite([PIXI.Texture.EMPTY])
        }
      }
      spr.width = size
      spr.height = size
      layer.addChild(spr)
      sprites.set(ent.id, spr)
    }
    spr.x = ent.x - size / 2
    spr.y = ent.y - size / 2
  }
}

// ── Draw HP bars ──────────────────────────────────────────────────────────────

function drawHpBars(
  g: PIXI.Graphics,
  enemies:  TDGameState['enemies'],
  units:    TDGameState['units'],
) {
  if (!g || g.destroyed) return
  g.clear()
  const BAR = 20

  for (const e of enemies) {
    const frac = e.hp / e.maxHp
    const col  = parseInt(hpBarColor(frac).slice(1), 16)
    const x = e.x - BAR / 2
    const y = e.y + 9
    g.rect(x, y, BAR, 3).fill(0x111111)
    if (frac > 0) g.rect(x, y, Math.round(BAR * frac), 3).fill(col)
  }

  // Units: group by tower, show at lead unit position
  const byTower = new Map<number, TDUnit[]>()
  for (const u of units) {
    const g2 = byTower.get(u.towerId) ?? []; g2.push(u); byTower.set(u.towerId, g2)
  }
  for (const group of byTower.values()) {
    if (group.length === 0) continue
    const lead     = group[0]
    const minFrac  = Math.min(...group.map(u => u.hp / u.maxHp))
    const col      = parseInt(hpBarColor(minFrac).slice(1), 16)
    const x = lead.x - BAR / 2
    const y = lead.y + 7
    g.rect(x, y, BAR, 3).fill(0x111111)
    if (minFrac > 0) g.rect(x, y, Math.round(BAR * minFrac), 3).fill(col)
  }

}

// ── Animated attack effects ───────────────────────────────────────────────────

// Wall-clock travel durations (ms), independent of game speed
const TRAVEL_MS: Partial<Record<string, number>> = {
  lightning: 80,
  arrow: 180,
  icebolt: 180,
  fireball: 200,
  poisonblob: 200,
}
const DEFAULT_TRAVEL_MS = 160
const IMPACT_MS = 120 // how long the impact burst lingers after arrival

const PROJ_COLOR: Partial<Record<string, number>> = {
  lightning:  0xaabbff,
  icebolt:    0x88eeff,
  fireball:   0xff6600,
  poisonblob: 0x88ff44,
  arrow:      0xccaa44,
}
const DEFAULT_PROJ_COLOR = 0xcc44ff

function drawAnimatedEffects(
  g: PIXI.Graphics,
  events: TDAttackEvent[],
  startTimes: Map<number, number>,
  nowMs: number,
) {
  if (!g || g.destroyed) return
  g.clear()
  for (const ev of events) {
    const startMs = startTimes.get(ev.id) ?? nowMs
    const elapsed = nowMs - startMs
    const pType = ev.projectileType ?? 'magic'
    const dx = ev.toX - ev.fromX
    const dy = ev.toY - ev.fromY
    const len = Math.hypot(dx, dy)

    if (pType === 'aoe' || (ev.aoeRadius && len < 2)) {
      // Expanding ring that fades out
      const totalMs = 350
      const t = Math.min(elapsed / totalMs, 1)
      const r = (ev.aoeRadius ?? 48) * (0.2 + 0.8 * t)
      const alpha = (1 - t) * 0.85
      g.circle(ev.toX, ev.toY, r).stroke({ width: 2, color: 0xff8800, alpha })
      g.circle(ev.toX, ev.toY, r * 0.5).fill({ color: 0xff4400, alpha: alpha * 0.4 })
    } else {
      const travelMs = TRAVEL_MS[pType] ?? DEFAULT_TRAVEL_MS
      const col = PROJ_COLOR[pType] ?? DEFAULT_PROJ_COLOR
      const tTravel = Math.min(elapsed / travelMs, 1) // 0→1 while travelling

      // Current projectile position
      const px = ev.fromX + dx * tTravel
      const py = ev.fromY + dy * tTravel

      // Trail: short line from slightly behind to current position
      const trailT = Math.max(0, tTravel - 0.25)
      const tx = ev.fromX + dx * trailT
      const ty = ev.fromY + dy * trailT
      if (tTravel > 0.01 && Math.hypot(px - tx, py - ty) > 1) {
        g.moveTo(tx, ty).lineTo(px, py).stroke({ width: 2, color: col, alpha: 0.4 })
      }

      // Projectile head (small glowing dot)
      if (tTravel < 1) {
        g.circle(px, py, 3.5).fill({ color: col, alpha: 0.95 })
        g.circle(px, py, 2).fill({ color: 0xffffff, alpha: 0.6 })
      }

      // Impact burst — appears when projectile arrives
      if (tTravel >= 1) {
        const tImpact = Math.min((elapsed - travelMs) / IMPACT_MS, 1)
        const impactR = 4 + 10 * tImpact
        const impactA = (1 - tImpact) * 0.85
        g.circle(ev.toX, ev.toY, impactR).stroke({ width: 1.5, color: col, alpha: impactA })
        g.circle(ev.toX, ev.toY, impactR * 0.5).fill({ color: 0xffffff, alpha: impactA * 0.5 })
      }
    }
  }
}

// ── Draw hazard clouds ────────────────────────────────────────────────────────

function drawHazards(g: PIXI.Graphics, hazards: TDGameState['hazards']) {
  if (!g || g.destroyed) return
  g.clear()
  for (const h of hazards) {
    // Three concentric fills approximate a radial gradient: opaque core fading to
    // transparent at the edge — no hard outline stroke.
    g.circle(h.x, h.y, h.radius).fill({ color: 0x44bb44, alpha: 0.06 })
    g.circle(h.x, h.y, h.radius * 0.70).fill({ color: 0x44bb44, alpha: 0.14 })
    g.circle(h.x, h.y, h.radius * 0.40).fill({ color: 0x66cc66, alpha: 0.22 })
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export function GameGrid({
  boardWrapRef, game, selectedTowerId, rangeHighlight, canPlaceTowers, selected,
  gridScale, isOnPath, setHoveredTower, setHoveredCell, handleCellClick,
  selectedTower, hoveredTower, environment,
}: Props) {
  const W = TD_COLS * CELL_PX
  const H = TD_ROWS * CELL_PX

  const canvasRef  = useRef<HTMLDivElement>(null)
  const sceneRef   = useRef<Scene | null>(null)
  // Maps attackEvent.id → wall-clock ms when first seen, for animation interpolation
  const projectileStartsRef = useRef<Map<number, number>>(new Map())

  // Stable callback ref so the scene-update effect doesn't re-run on each render
  const propsRef = useRef({
    game, selectedTowerId, rangeHighlight, canPlaceTowers, selected,
    isOnPath, selectedTower, hoveredTower,
    handleCellClick, setHoveredTower, setHoveredCell,
  })
  propsRef.current = {
    game, selectedTowerId, rangeHighlight, canPlaceTowers, selected,
    isOnPath, selectedTower, hoveredTower,
    handleCellClick, setHoveredTower, setHoveredCell,
  }

  // ── Initialise PixiJS once ─────────────────────────────────────────────────
  usePixiApp(canvasRef, W, H, (app) => {
    const terrainLayer = new PIXI.Container()
    const cellGfx    = new PIXI.Graphics()
    const towerLayer = new PIXI.Container()
    const unitLayer  = new PIXI.Container()
    const enemyLayer = new PIXI.Container()
    const effectGfx  = new PIXI.Graphics()
    const hazardGfx  = new PIXI.Graphics()
    const hpGfx      = new PIXI.Graphics()

    app.stage.addChild(terrainLayer) // bottom layer — world tile terrain
    app.stage.addChild(cellGfx)
    app.stage.addChild(towerLayer)
    app.stage.addChild(unitLayer)
    app.stage.addChild(enemyLayer)
    app.stage.addChild(hazardGfx)
    app.stage.addChild(effectGfx)
    app.stage.addChild(hpGfx)

    // Async: tile the background with world-scale terrain.
    // CELL_PX (48) ≠ TILE_SIZE (32), so ground and path tiles need separate handling:
    //   ground — tiled at 32px intervals across the full canvas
    //   path   — one sprite per cell, scaled to CELL_PX, with cell-space neighbor lookup
    const env = environment ?? 'ruins'
    const worldDef = WORLD_ENV_TILES[env]
    const groundId = worldDef?.ground ?? 0
    loadTileRef(groundId).then(async (groundTex) => {
      if (terrainLayer.destroyed) return

      // Ground: tile at 32px across the full canvas
      const tileCols = Math.ceil(W / TILE_SIZE)
      const tileRows = Math.ceil(H / TILE_SIZE)
      for (let r = 0; r < tileRows; r++) {
        for (let c = 0; c < tileCols; c++) {
          const s = new PIXI.Sprite(groundTex)
          s.position.set(c * TILE_SIZE, r * TILE_SIZE)
          terrainLayer.addChild(s)
        }
      }

      // Path: cell-space 8-neighbor variant lookup, sprites scaled to CELL_PX
      if (!worldDef?.pathFile) return
      const pathUrl = `${baseUrl}${worldDef.pathFile.slice(1)}`
      const hasPath = (col: number, row: number) => PATH_SET.has(`${col},${row}`)
      const cellVariant = (col: number, row: number): number => {
        const N = hasPath(col, row - 1), E = hasPath(col + 1, row)
        const S = hasPath(col, row + 1), W = hasPath(col - 1, row)
        const mask =
          (N                                   ?   1 : 0) |
          (N && E && hasPath(col + 1, row - 1) ?   2 : 0) |
          (E                                   ?   4 : 0) |
          (S && E && hasPath(col + 1, row + 1) ?   8 : 0) |
          (S                                   ?  16 : 0) |
          (S && W && hasPath(col - 1, row + 1) ?  32 : 0) |
          (W                                   ?  64 : 0) |
          (N && W && hasPath(col - 1, row - 1) ? 128 : 0)
        return PATH_TILE_LOOKUP[mask]
      }

      const byVariant = new Map<number, Array<{ col: number; row: number }>>()
      for (const k of PATH_SET) {
        const [col, row] = k.split(',').map(Number)
        const v = cellVariant(col, row)
        if (!byVariant.has(v)) byVariant.set(v, [])
        byVariant.get(v)!.push({ col, row })
      }

      await Promise.all(Array.from(byVariant.entries()).map(async ([v, cells]) => {
        const tex = await loadTileTexture(pathUrl, v, 8)
        if (terrainLayer.destroyed) return
        for (const { col, row } of cells) {
          const s = new PIXI.Sprite(tex)
          s.position.set(col * CELL_PX, row * CELL_PX)
          s.width = CELL_PX
          s.height = CELL_PX
          terrainLayer.addChild(s)
        }
      }))
    }).catch(() => { /* terrain tiles optional — solid fallback from cellGfx */ })

    // Click/hover detection on the cell layer background
    const hitArea = new PIXI.Graphics()
    hitArea.rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0 })
    hitArea.eventMode = 'static'
    hitArea.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      const local = e.getLocalPosition(hitArea)
      const col = Math.floor(local.x / CELL_PX)
      const row = Math.floor(local.y / CELL_PX)
      if (col >= 0 && col < TD_COLS && row >= 0 && row < TD_ROWS) {
        propsRef.current.handleCellClick(col, row)
      }
    })
    hitArea.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      const local = e.getLocalPosition(hitArea)
      const col = Math.floor(local.x / CELL_PX)
      const row = Math.floor(local.y / CELL_PX)
      if (col >= 0 && col < TD_COLS && row >= 0 && row < TD_ROWS) {
        const towerByCell = new Map(propsRef.current.game.towers.map(t => [`${t.col},${t.row}`, t]))
        const tower = towerByCell.get(`${col},${row}`) ?? null
        propsRef.current.setHoveredTower(tower)
        propsRef.current.setHoveredCell({ col, row })
      } else {
        propsRef.current.setHoveredTower(null)
        propsRef.current.setHoveredCell(null)
      }
    })
    hitArea.on('pointerout', () => {
      propsRef.current.setHoveredTower(null)
      propsRef.current.setHoveredCell(null)
    })
    app.stage.addChild(hitArea)

    sceneRef.current = {
      terrainLayer, cellGfx, towerLayer, unitLayer, enemyLayer,
      effectGfx, hazardGfx, hpGfx,
      enemySprites: new Map(),
      unitSprites:  new Map(),
      towerSprites: new Map(),
    }

    // Initial draw
    renderScene(sceneRef.current, propsRef.current)

    // Ticker: animates projectile effects at 60fps using wall-clock time
    app.ticker.add(() => {
      const nowMs = performance.now()
      const events = propsRef.current.game.attackEvents
      const starts = projectileStartsRef.current

      // Register new events; prune entries for events that have expired
      const activeIds = new Set(events.map(e => e.id))
      for (const id of starts.keys()) {
        if (!activeIds.has(id)) starts.delete(id)
      }
      for (const ev of events) {
        if (!starts.has(ev.id)) starts.set(ev.id, nowMs)
      }

      drawAnimatedEffects(effectGfx, events, starts, nowMs)
    })
  })

  // Clear the scene ref on unmount so the update effect below never runs against
  // a stale scene whose Graphics objects were already destroyed by usePixiApp cleanup.
  useEffect(() => {
    return () => { sceneRef.current = null }
  }, [])

  // ── Update scene when game state changes ───────────────────────────────────
  useEffect(() => {
    if (!sceneRef.current) return
    renderScene(sceneRef.current, propsRef.current)
  }) // run on every render to keep scene in sync

  // ── Canvas click/hover forwarding ──────────────────────────────────────────
  const handleMouseLeave = useCallback(() => {
    setHoveredTower(null)
    setHoveredCell(null)
  }, [setHoveredTower, setHoveredCell])

  // ── Tooltip (DOM overlay) ─────────────────────────────────────────────────
  const t = selectedTower ?? hoveredTower
  const tooltip = t ? (() => {
    const unitCount  = buildingUnitCount(t)
    const activeUnits = game.units.filter(u => u.towerId === t.id)
    const xpNeeded   = xpToUpgrade(t)
    const xpReady    = t.upgrades < TD_MAX_UPGRADES && t.xp >= xpNeeded
    return (
      <div
        className="td-tower-tooltip"
        style={{ left: t.col * CELL_PX, top: Math.max(0, t.row * CELL_PX - 56) }}
      >
        <strong>{t.buildingName}</strong>
        {t.upgrades > 0 && <span className="td-tower-tier-label u-text-gold"> {'★'.repeat(t.upgrades)}</span>}
        <div>{t.template.name} · {activeUnits.length}/{unitCount} active</div>
        {t.upgrades < TD_MAX_UPGRADES && (
          <div className={xpReady ? 'td-tooltip-xp-ready' : 'td-tooltip-xp'}>
            {xpReady ? '⬆ Upgrade ready!' : `XP ${t.xp}/${xpNeeded} kills`}
          </div>
        )}
        {t.id !== selectedTowerId && <div className="td-tooltip-hint">Tap to select</div>}
      </div>
    )
  })() : null

  return (
    <div className="td-board-wrap" ref={boardWrapRef}>
      <div
        className="td-grid-scaler"
        style={{ width: W * gridScale, height: H * gridScale}}
      >
        <div
          style={{
            width: W,
            height: H,
            transform: `scale(${gridScale})`,
            transformOrigin: 'top left',
            position: 'relative',
          }}
        >
          <div
            ref={canvasRef}
            style={{ display: 'block', width: W, height: H }}
            onMouseLeave={handleMouseLeave}
          />
          <div className="td-cell-label" style={{ left: cellCx(TD_PATH[0].col) - 8, top: cellCy(TD_PATH[0].row) - 5 }}>IN</div>
          <div className="td-cell-label" style={{ left: cellCx(TD_PATH[TD_PATH.length - 1].col) - 10, top: cellCy(TD_PATH[TD_PATH.length - 1].row) - 5 }}>BASE</div>
          {tooltip}
        </div>
      </div>
    </div>
  )
}

// ── Scene render (called on every React render) ───────────────────────────────

function renderScene(
  scene: Scene,
  props: {
    game: TDGameState
    selectedTowerId: number | null
    rangeHighlight: Set<string>
    canPlaceTowers: boolean
    selected: boolean
    isOnPath: (col: number, row: number) => boolean
    selectedTower: TDTower | null
    hoveredTower: TDTower | null
  },
) {
  const { game, selectedTowerId, rangeHighlight, canPlaceTowers, selected } = props

  drawCells(scene.cellGfx, rangeHighlight, selectedTowerId, canPlaceTowers, selected, game.towers)
  // effectGfx is driven by the Pixi ticker (drawAnimatedEffects) — not updated here
  drawHazards(scene.hazardGfx, game.hazards)
  drawHpBars(scene.hpGfx, game.enemies, game.units)

  // Async sprite sync (fire and forget — sprites appear as textures load)
  syncTowers(scene.towerLayer, scene.towerSprites, game.towers)

  const enemies = game.enemies.map(e => ({ id: e.id, x: e.x, y: e.y, spriteName: e.template.spriteName }))
  syncEntitySprites(scene.enemyLayer, scene.enemySprites, enemies, 15, 6)

  // Units: one sprite per tower-group at lead unit position
  const unitGroups = new Map<number, TDUnit[]>()
  for (const u of game.units) {
    const g = unitGroups.get(u.towerId) ?? []; g.push(u); unitGroups.set(u.towerId, g)
  }
  const unitEntities = Array.from(unitGroups.values())
    .filter(g => g.length > 0)
    .map(g => ({ id: g[0].towerId, x: g[0].x, y: g[0].y, spriteName: g[0].template.name }))
  syncEntitySprites(scene.unitLayer, scene.unitSprites, unitEntities, 11, 8)
}
