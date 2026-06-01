import * as PIXI from 'pixi.js'
import { ENV_TILES, BASE_GROUND, TILESET_IMAGE, TILESET_COLUMNS, TILE_SIZE, EnvTileDef } from '../data/tiles/tileIndex'
import { loadTileTexture } from './pixiHelpers'
import { drawTerrainItem } from './terrainGfx'
import { seededRand, hashStr, getTerrainItems, type TerrainItem } from './mapUtils'

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
