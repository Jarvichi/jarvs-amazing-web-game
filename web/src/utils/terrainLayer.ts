import * as PIXI from 'pixi.js'
import { ENV_TILES, BASE_GROUND, TILESET_IMAGE, TILESET_COLUMNS, TILE_SIZE, EnvTileDef, SCENERY } from '../data/tiles/tileIndex'
import { WORLD_DECOR_FILE, WORLD_DECOR, TERRAIN_DECOR_MAP, WORLD_PATH_TILE } from '../data/tiles/worldTileIndex'
import { loadTileTexture } from './pixiHelpers'
import { drawTerrainItem } from './terrainGfx'
import { seededRand, hashStr, getTerrainItems, type TerrainItem } from './mapUtils'
import { renderPathTiles } from './tileLookup'
import type { TerrainObstacle } from '../game/engine/terrain'

export interface TerrainLayerOptions {
  environment?: string
  envDef?: EnvTileDef
  terrainSeed?: number
  terrainItems?: TerrainItem[]
  rivers?: Array<{ x1: number; y1: number; x2: number; y2: number; cx1: number; cy1: number; cx2: number; cy2: number }>
  id?: string
}

export function buildTerrainGfx(
  baseContainer: PIXI.Container,
  riverContainer: PIXI.Container,
  worldLayer: PIXI.Container,
  opts: TerrainLayerOptions,
  mapWidth: number,
  mapHeight: number,
): void {
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  const { environment, envDef: envDefOverride, terrainSeed, terrainItems: explicitItems, rivers: explicitRivers, id = '' } = opts

  const def = envDefOverride ?? ENV_TILES[environment ?? '']
  if (def?.solidColor !== undefined) {
    const g = new PIXI.Graphics()
    g.rect(0, 0, mapWidth, mapHeight).fill({ color: def.solidColor })
    baseContainer.addChild(g)
  } else {
    const groundTileId = def?.ground ?? BASE_GROUND.mediumGrass
    const tileUrl = `${base}${TILESET_IMAGE.baseChip.slice(1)}`
    loadTileTexture(tileUrl, groundTileId, TILESET_COLUMNS.baseChip).then(groundTex => {
      if (baseContainer.destroyed) return
      const tileCols = Math.ceil(mapWidth / 32)
      const tileRows = Math.ceil(mapHeight / 32)
      const bg = new PIXI.Container()
      for (let r = 0; r < tileRows; r++) {
        for (let c = 0; c < tileCols; c++) {
          const s = new PIXI.Sprite(groundTex)
          s.position.set(c * 32, r * 32)
          bg.addChild(s)
        }
      }
      baseContainer.addChild(bg)
    }).catch(e => console.error('[terrainLayer] ground tile load failed', tileUrl, e))
  }

  const seed = terrainSeed ?? hashStr(id)
  const items = explicitItems ?? getTerrainItems(environment, seed, mapWidth, mapHeight)

  const riverColor = environment === 'volcano' ? 0xcc4400
                   : environment === 'fungal'  ? 0x6633aa
                   : environment === 'frost'   ? 0x88ddff : 0x2255aa

  const rc = (riverColor >> 16) & 0xff, gc = (riverColor >> 8) & 0xff, bc = riverColor & 0xff
  const riverDark  = (Math.round(rc * 0.55) << 16) | (Math.round(gc * 0.55) << 8) | Math.round(bc * 0.55)
  const riverLight = (Math.min(255, Math.round(rc * 1.45)) << 16) | (Math.min(255, Math.round(gc * 1.45)) << 8) | Math.min(255, Math.round(bc * 1.45))

  const riversToDraw: Array<{ x1: number; y1: number; x2: number; y2: number; cx1: number; cy1: number; cx2: number; cy2: number }> =
    explicitRivers ?? (() => {
      const rseed = hashStr(id + 'river')
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
    riverContainer.addChild(g)
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

export async function buildBgTileGfx(
  container: PIXI.Container,
  opts: { environment?: string; envDef?: EnvTileDef },
  mapWidth: number,
  mapHeight: number,
): Promise<void> {
  const def = opts.envDef ?? ENV_TILES[opts.environment ?? '']
  if (def?.bgTileId === undefined) return
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  const tileUrl = `${base}${def.pathFile.slice(1)}`
  const tex = await loadTileTexture(tileUrl, def.bgTileId, 8)
  if (container.destroyed) return
  const cols = Math.ceil(mapWidth / TILE_SIZE)
  const rows = Math.ceil(mapHeight / TILE_SIZE)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const s = new PIXI.Sprite(tex)
      s.position.set(c * TILE_SIZE, r * TILE_SIZE)
      container.addChild(s)
    }
  }
}

// Maps 4-bit diagonal-adjacency bitmask (NW=8 NE=4 SE=2 SW=1) → SCENERY tile frame number.
// Derived from the SCENERY constants in tileIndex.ts.
const SCENERY_LOOKUP: number[] = [
  SCENERY.single,           // 0000
  SCENERY.singleAndSW,      // 0001
  SCENERY.singleAndSE,      // 0010
  SCENERY.singleAndSESW,    // 0011
  SCENERY.singleAndNE,      // 0100
  SCENERY.singleAndNESW,    // 0101
  SCENERY.singleAndNESE,    // 0110
  SCENERY.singleAndNESESW,  // 0111
  SCENERY.singleAndNW,      // 1000
  SCENERY.singleAndNWSW,    // 1001
  SCENERY.singleAndNWSE,    // 1010
  SCENERY.singleAndNWSESW,  // 1011
  SCENERY.singleAndNWNE,    // 1100
  SCENERY.singleAndNWNESW,  // 1101
  SCENERY.singleAndNWNESE,  // 1110
  SCENERY.singleAndNWNESESW,// 1111
]

/**
 * Renders a scenery tile border strip along the left, right, and top edges of the canvas.
 * Uses envDef.borderFile as the 8-col scenery sheet and SCENERY_LOOKUP for diagonal adjacency.
 * No-ops when borderFile is absent (e.g. sky environment).
 */
export function buildBorderGfx(
  container: PIXI.Container,
  opts: { envDef?: EnvTileDef; environment?: string },
  w: number,
  h: number,
): void {
  const def = opts.envDef ?? ENV_TILES[opts.environment ?? '']
  const borderFile = def?.borderFile
  if (!borderFile) return

  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  const url  = base + borderFile.replace(/^\//, '')

  const BORDER_COLS = 2
  const BORDER_ROWS = 1
  const totalCols   = Math.ceil(w / TILE_SIZE)
  const totalRows   = Math.ceil(h / TILE_SIZE)

  function isBorder(c: number, r: number): boolean {
    if (c < 0 || r < 0 || c >= totalCols || r >= totalRows) return true
    return c < BORDER_COLS || c >= totalCols - BORDER_COLS || r < BORDER_ROWS
  }

  PIXI.Assets.load(url).then((tex: PIXI.Texture) => {
    if (container.destroyed) return
    const tileW = tex.width / 8
    const tileH = tileW

    for (let r = 0; r < totalRows; r++) {
      for (let c = 0; c < totalCols; c++) {
        if (!isBorder(c, r)) continue
        const nw = isBorder(c - 1, r - 1) ? 8 : 0
        const ne = isBorder(c + 1, r - 1) ? 4 : 0
        const se = isBorder(c + 1, r + 1) ? 2 : 0
        const sw = isBorder(c - 1, r + 1) ? 1 : 0
        const frame    = SCENERY_LOOKUP[nw | ne | se | sw]
        const frameCol = frame % 8
        const frameRow = Math.floor(frame / 8)
        const frameTex = new PIXI.Texture({
          source: tex.source,
          frame:  new PIXI.Rectangle(frameCol * tileW, frameRow * tileH, tileW, tileH),
        })
        const sprite = new PIXI.Sprite(frameTex)
        sprite.position.set(c * TILE_SIZE, r * TILE_SIZE)
        sprite.width  = TILE_SIZE
        sprite.height = TILE_SIZE
        container.addChild(sprite)
      }
    }
  }).catch(e => console.error('[terrainLayer] border tile load failed', url, e))
}

export async function buildDecorGfx(
  container: PIXI.Container,
  opts: { environment?: string; envDef?: EnvTileDef; id?: string },
  mapWidth: number,
  mapHeight: number,
): Promise<void> {
  const def = opts.envDef ?? ENV_TILES[opts.environment ?? '']
  if (!def?.decorFile || !def.decorTileIds?.length) return
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  const tileUrl = `${base}${def.decorFile.slice(1)}`
  const tileIds = def.decorTileIds
  const rand = seededRand(hashStr((opts.id ?? '') + 'decor'))
  const cols = Math.ceil(mapWidth / TILE_SIZE)
  const rows = Math.ceil(mapHeight / TILE_SIZE)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rand() > 0.15) continue
      const tileId = tileIds[Math.floor(rand() * tileIds.length)]
      const tex = await loadTileTexture(tileUrl, tileId, 8)
      if (container.destroyed) return
      const s = new PIXI.Sprite(tex)
      s.position.set(c * TILE_SIZE, r * TILE_SIZE)
      container.addChild(s)
    }
  }
}

/**
 * Renders battlefield terrain obstacles (trees, rocks, water, ruins) as
 * WORLD_DECOR tile sprites instead of SVG line-art.
 * Game coords → canvas px:
 *   cx = (0.5 + (obs.y / 80) * 0.36) * w
 *   cy = (1 - obs.x / 500) * h
 */
export async function buildTerrainDecorGfx(
  container: PIXI.Container,
  terrain: TerrainObstacle[],
  opts: { environment?: string; envDef?: EnvTileDef },
  w: number,
  h: number,
): Promise<void> {
  if (terrain.length === 0) return
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  const decorUrl = `${base}${WORLD_DECOR_FILE.slice(1)}`
  const env = opts.environment ?? ''
  const envMap = TERRAIN_DECOR_MAP[env] ?? {}

  for (const obs of terrain) {
    if (container.destroyed) return
    const cx = (0.5 + (obs.y / 80) * 0.36) * w
    const cy = (1 - obs.x / 500) * h
    const idNum = parseInt(obs.id.replace('t', ''), 10)

    const tileIds: number[] = (envMap[obs.type] ?? TERRAIN_DECOR_MAP._default[obs.type]) ?? []
    if (tileIds.length === 0) continue
    const tileId = tileIds[idNum % tileIds.length]

    // ── 2×2 mountain block (volcano rocks) ──────────────────────────────────
    if (tileId === WORLD_DECOR.mountainTopLeft) {
      const tiles = [
        { id: WORLD_DECOR.mountainTopLeft,     dx: -TILE_SIZE, dy: -TILE_SIZE },
        { id: WORLD_DECOR.mountainTopRight,    dx: 0,          dy: -TILE_SIZE },
        { id: WORLD_DECOR.mountainBottomLeft,  dx: -TILE_SIZE, dy: 0 },
        { id: WORLD_DECOR.mountainBottomRight, dx: 0,          dy: 0 },
      ]
      for (const t of tiles) {
        if (container.destroyed) return
        const tex = await loadTileTexture(decorUrl, t.id, 8)
        if (container.destroyed) return
        const s = new PIXI.Sprite(tex)
        s.position.set(cx + t.dx, cy + t.dy)
        s.width = TILE_SIZE
        s.height = TILE_SIZE
        container.addChild(s)
      }
      continue
    }

    // ── Bridge over large water obstacles ────────────────────────────────────
    if (obs.type === 'water' && obs.radius > 26) {
      const bridgeW = obs.radius * 2.8
      for (const { id, yOff } of [
        { id: WORLD_DECOR.stoneBridgeVTop,    yOff: -TILE_SIZE * 0.5 },
        { id: WORLD_DECOR.stoneBridgeVBottom, yOff:  TILE_SIZE * 0.5 },
      ]) {
        if (container.destroyed) return
        const tex = await loadTileTexture(decorUrl, id, 8)
        if (container.destroyed) return
        const s = new PIXI.Sprite(tex)
        const aspect = tex.height / tex.width
        s.width  = bridgeW
        s.height = bridgeW * aspect
        s.anchor.set(0.5)
        s.position.set(cx, cy + yOff)
        container.addChild(s)
      }
      continue
    }

    // ── Water pool (tiled area + overlay decor) ──────────────────────────────
    if (obs.type === 'water') {
      const tileRadius = Math.max(1, Math.round(obs.radius * h / (500 * TILE_SIZE)))
      const tcx = Math.round(cx / TILE_SIZE)
      const tcy = Math.round(cy / TILE_SIZE)
      const pathSet = new Set<string>()
      for (let dr = -tileRadius; dr <= tileRadius; dr++) {
        for (let dc = -tileRadius; dc <= tileRadius; dc++) {
          if (dr * dr + dc * dc <= tileRadius * tileRadius) {
            pathSet.add(`${tcx + dc},${tcy + dr}`)
          }
        }
      }
      const waterContainer = new PIXI.Container()
      container.addChild(waterContainer)
      await renderPathTiles(waterContainer, pathSet, undefined, WORLD_PATH_TILE.grass1Water1)
      if (container.destroyed) return

      // Overlay decor tile (pond/hole/whirlpool/sinkhole) centred on the pool
      const scale = (obs.radius * 2.8) / TILE_SIZE
      const tex = await loadTileTexture(decorUrl, tileId, 8)
      if (container.destroyed) return
      const s = new PIXI.Sprite(tex)
      s.anchor.set(0.5)
      s.scale.set(scale)
      s.position.set(cx, cy)
      container.addChild(s)
      continue
    }

    // ── Single decor tile (tree, rock, ruin) ─────────────────────────────────
    const scale = (obs.radius * 2.8) / TILE_SIZE
    const tex = await loadTileTexture(decorUrl, tileId, 8)
    if (container.destroyed) return
    const s = new PIXI.Sprite(tex)
    s.anchor.set(0.5)
    s.scale.set(scale)
    s.position.set(cx, cy)
    container.addChild(s)
  }
}
