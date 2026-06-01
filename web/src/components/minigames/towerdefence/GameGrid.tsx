import { useRef, useEffect, useCallback } from 'react'
import * as PIXI from 'pixi.js'
import {
  buildingUnitCount, hpBarColor,
  TD_CELL_PX as CELL_PX, TD_COLS, TD_MAX_UPGRADES, TD_PATH, TD_ROWS,
  PATH_SET,
  TDGameState, TDTower, TDUnit, xpToUpgrade,
} from '../../../game/towerDefence'
import { usePixiApp } from '../../../hooks/usePixiApp'
import { loadAnimFrames, loadSpriteTexture, loadTileTexture } from '../../../utils/pixiHelpers'
import { renderPathTiles } from '../../../utils/tileLookup'
import { TILESET_IMAGE, TILESET_COLUMNS } from '../../../data/tiles/tileIndex'
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
      g.rect(x, y, CELL_PX, CELL_PX).stroke({ width: 1, color: C_BORDER_DARK, alpha: 0.3 })

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

// ── Draw attack effects ───────────────────────────────────────────────────────

function drawEffects(g: PIXI.Graphics, attackEvents: TDGameState['attackEvents']) {
  g.clear()
  for (const ev of attackEvents) {
    const pType = ev.projectileType ?? 'magic'
    const dx = ev.toX - ev.fromX
    const dy = ev.toY - ev.fromY
    const len = Math.hypot(dx, dy)

    if (pType === 'aoe' || (ev.aoeRadius && len < 2)) {
      const r = ev.aoeRadius ?? 48
      g.circle(ev.toX, ev.toY, r).stroke({ width: 2, color: 0xff8800, alpha: 0.7 })
      g.circle(ev.toX, ev.toY, r * 0.6).fill({ color: 0xff4400, alpha: 0.3 })
    } else {
      const col = pType === 'lightning' ? 0xaabbff
               : pType === 'icebolt'   ? 0x88eeff
               : pType === 'fireball'  ? 0xff6600
               : pType === 'poisonblob'? 0x88ff44
               : pType === 'arrow'     ? 0xccaa44
               : 0xcc44ff // magic default
      g.moveTo(ev.fromX, ev.fromY).lineTo(ev.toX, ev.toY)
        .stroke({ width: 2, color: col, alpha: 0.85 })
      // Hit burst
      g.circle(ev.toX, ev.toY, 5).fill({ color: col, alpha: 0.6 })
    }
  }
}

// ── Draw hazard clouds ────────────────────────────────────────────────────────

function drawHazards(g: PIXI.Graphics, hazards: TDGameState['hazards']) {
  g.clear()
  for (const h of hazards) {
    g.circle(h.x, h.y, h.radius).fill({ color: 0x44bb44, alpha: 0.35 })
    g.circle(h.x, h.y, h.radius).stroke({ width: 1, color: 0x88ff88, alpha: 0.5 })
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

    // Async: tile the background with world-scale terrain
    const env = environment ?? 'forest'
    const worldDef = WORLD_ENV_TILES[env]
    const groundId = worldDef?.ground ?? 0
    const baseUrl = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
    const groundUrl = `${baseUrl}${TILESET_IMAGE.baseChip.slice(1)}`
    loadTileTexture(groundUrl, groundId, TILESET_COLUMNS.baseChip).then(groundTex => {
      if (terrainLayer.destroyed) return
      for (let row = 0; row < TD_ROWS; row++) {
        for (let col = 0; col < TD_COLS; col++) {
          const s = new PIXI.Sprite(groundTex)
          s.position.set(col * CELL_PX, row * CELL_PX)
          terrainLayer.addChild(s)
        }
      }
      return renderPathTiles(terrainLayer, PATH_SET, env, undefined, false, worldDef)
    }).catch(() => { /* terrain tiles optional — solid fallback from cellGfx */ })

    // Cell labels for start/end
    const startLabel = new PIXI.Text({ text: 'IN',   style: { fontSize: 9, fill: 0xffffff, fontWeight: 'bold' } })
    const endLabel   = new PIXI.Text({ text: 'BASE', style: { fontSize: 8, fill: 0xffffff, fontWeight: 'bold' } })
    startLabel.x = cellCx(TD_PATH[0].col) - 8
    startLabel.y = cellCy(TD_PATH[0].row) - 5
    endLabel.x   = cellCx(TD_PATH[TD_PATH.length - 1].col) - 10
    endLabel.y   = cellCy(TD_PATH[TD_PATH.length - 1].row) - 5
    app.stage.addChild(startLabel)
    app.stage.addChild(endLabel)

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
  })

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
        style={{ width: W * gridScale, height: H * gridScale }}
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
  drawEffects(scene.effectGfx, game.attackEvents)
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
