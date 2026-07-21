import * as PIXI from 'pixi.js'
import { ENV_TILES, BASE_GROUND, TILESET_IMAGE, TILESET_COLUMNS, TILE_SIZE, EnvTileDef, SCENERY } from '../data/tiles/tileIndex'
import { WORLD_DECOR_FILE, WORLD_DECOR, TERRAIN_DECOR_MAP, TERRAIN_PATCH_MAP } from '../data/tiles/worldTileIndex'
import { loadTileTexture } from './pixiHelpers'
import { drawTerrainItem } from './terrainGfx'
import { seededRand, hashStr, getTerrainItems, type TerrainItem } from './mapUtils'
import { renderPathTiles } from './tileLookup'
import type { TerrainObstacle, RoadDef } from '../game/engine/terrain'

// Divisor controlling how obstacle radius (game units) maps to tile-ring radius (tiles).
// Tuned against the realistic range of obstacle radius (20-32) and lane CSS height (~318-842px)
// so clusters show real size variety instead of always rounding to a single uniform "plus" shape.
export const TILE_RADIUS_SCALE = 220

/**
 * Battlefield lane coordinate mapping: game units (x: 0–500 forward base→base,
 * y: -80..80 lateral) → canvas pixels, and back. buildRoadGfx/buildTerrainDecorGfx
 * derive their tile coordinates from gameToPixel below; the battlefield editor uses
 * pixelToGame to turn a pointer click into a game-unit waypoint/obstacle position —
 * sharing this single definition keeps the two forever in lockstep.
 */
export function gameToPixel(x: number, y: number, w: number, h: number): { px: number; py: number } {
  return { px: (0.5 + (y / 80) * 0.36) * w, py: (1 - x / 500) * h }
}

export function pixelToGame(px: number, py: number, w: number, h: number): { x: number; y: number } {
  return { x: 500 * (1 - py / h), y: 80 * ((px / w - 0.5) / 0.36) }
}

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

  const BORDER_COLS = 1
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
 * Renders act/node-authored road paths on the battlefield lane, using the same
 * renderPathTiles() autotiler as hub streets and battlefield water patches.
 * Visual only — does not affect unit movement/avoidance.
 *
 * Game coords → tile coords via gameToPixel() (see above), divided by TILE_SIZE.
 */
export async function buildRoadGfx(
  container: PIXI.Container,
  roads: RoadDef[],
  opts: { environment?: string; envDef?: EnvTileDef },
  w: number,
  h: number,
): Promise<void> {
  if (roads.length === 0) return
  const def = opts.envDef ?? ENV_TILES[opts.environment ?? '']

  const toTile = (x: number, y: number) => {
    const { px, py } = gameToPixel(x, y, w, h)
    return { tcx: Math.round(px / TILE_SIZE), tcy: Math.round(py / TILE_SIZE) }
  }

  for (const road of roads) {
    if (container.destroyed) return
    if (road.points.length < 2) continue

    // Rasterize the centerline tile-by-tile between consecutive waypoints.
    const centerline = new Set<string>()
    let prev = toTile(road.points[0].x, road.points[0].y)
    centerline.add(`${prev.tcx},${prev.tcy}`)
    for (let i = 1; i < road.points.length; i++) {
      const cur = toTile(road.points[i].x, road.points[i].y)
      const dx = cur.tcx - prev.tcx
      const dy = cur.tcy - prev.tcy
      const steps = Math.max(Math.abs(dx), Math.abs(dy))
      for (let s = 1; s <= steps; s++) {
        const tx = Math.round(prev.tcx + (dx * s) / steps)
        const ty = Math.round(prev.tcy + (dy * s) / steps)
        centerline.add(`${tx},${ty}`)
      }
      prev = cur
    }

    // Widen the centerline into a band via circular dilation — the same
    // technique buildTerrainDecorGfx uses for its obstacle ringSet. Note the
    // resulting band diameter is 2*floor(width/2)+1, so this is an
    // approximate (not exact-integer) tile width.
    const width = road.width ?? 2
    const tileRadius = Math.max(0, Math.floor(width / 2))
    const roadSet = new Set<string>()
    for (const key of centerline) {
      const [c, r] = key.split(',').map(Number)
      for (let dr = -tileRadius; dr <= tileRadius; dr++) {
        for (let dc = -tileRadius; dc <= tileRadius; dc++) {
          if (dr * dr + dc * dc > tileRadius * tileRadius) continue
          roadSet.add(`${c + dc},${r + dr}`)
        }
      }
    }

    const roadContainer = new PIXI.Container()
    container.addChild(roadContainer)
    await renderPathTiles(roadContainer, roadSet, opts.environment, road.tileFile, width > 1, def)
    if (container.destroyed) return
  }
}

// Renders a scenery-sheet patch using 4-bit diagonal SCENERY_LOOKUP.
// WORLD_SCENERY_TILE files (forest1, rocks1, mountains1, hills1) use this lookup —
// NOT the 8-bit PATH_TILE_LOOKUP used by renderPathTiles.
async function renderSceneryPatch(
  container: PIXI.Container,
  pathSet: Set<string>,
  tileFile: string,
): Promise<void> {
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  const url = base + tileFile.replace(/^\//, '')
  const tex = await PIXI.Assets.load(url) as PIXI.Texture
  if (container.destroyed) return
  const tileW = tex.width / 8
  const tileH = tileW
  for (const key of pathSet) {
    const [c, r] = key.split(',').map(Number)
    const N = pathSet.has(`${c},${r - 1}`)
    const E = pathSet.has(`${c + 1},${r}`)
    const S = pathSet.has(`${c},${r + 1}`)
    const W = pathSet.has(`${c - 1},${r}`)
    const nw = (N && W && pathSet.has(`${c - 1},${r - 1}`)) ? 8 : 0
    const ne = (N && E && pathSet.has(`${c + 1},${r - 1}`)) ? 4 : 0
    const se = (S && E && pathSet.has(`${c + 1},${r + 1}`)) ? 2 : 0
    const sw = (S && W && pathSet.has(`${c - 1},${r + 1}`)) ? 1 : 0
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

/**
 * Renders battlefield terrain obstacles using TYPE3 adjacency-tiled patches
 * (tree → forest1, rock → rocks1/mountains1, water → grass1Water1) so shapes
 * are organic rather than single scaled tiles. Ruins fall back to a single
 * WORLD_DECOR tile (gravestone, house, etc.).
 *
 * Game coords → canvas px via gameToPixel() (see above).
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
  const env = opts.environment ?? ''
  const envPatchMap = TERRAIN_PATCH_MAP[env] ?? {}
  const envDecorMap = TERRAIN_DECOR_MAP[env] ?? {}

  const toTile = (obs: TerrainObstacle) => {
    const { px, py } = gameToPixel(obs.x, obs.y, w, h)
    return { tcx: Math.round(px / TILE_SIZE), tcy: Math.round(py / TILE_SIZE) }
  }

  // terrain.ts only guarantees a minimum *game-unit* separation between obstacle
  // centers, but the canvas projection below doesn't scale 1:1 with tile distance —
  // so two obstacles' tile-rings can still end up overlapping (more often than not,
  // across types too — confirmed by brute-force search across seeds). Reserve every
  // obstacle's center cell up front so a neighboring ring can never swallow its decor
  // icon, then have each ring claim cells first-come so overlapping rings carve cleanly
  // around each other (and around centers) instead of later obstacles' tiles
  // overwriting earlier ones into a single illegible blob.
  const claimedCells = new Set<string>()
  for (const obs of terrain) {
    const { tcx, tcy } = toTile(obs)
    claimedCells.add(`${tcx},${tcy}`)
  }

  for (const obs of terrain) {
    if (container.destroyed) return
    const { tcx, tcy } = toTile(obs)
    const idNum = parseInt(obs.id.replace('t', ''), 10)

    // ── TYPE3 adjacency-tiled patch (tree / rock / water) ───────────────────
    // SCENERY/PATH tiles fill the ring; center cell is reserved for WORLD_DECOR.
    const patchFile = envPatchMap[obs.type] ?? TERRAIN_PATCH_MAP._default?.[obs.type]
    if (patchFile) {
      const tileRadius = Math.max(1, Math.round(obs.radius * h / (TILE_RADIUS_SCALE * TILE_SIZE)))
      const ringSet = new Set<string>()
      for (let dr = -tileRadius; dr <= tileRadius; dr++) {
        for (let dc = -tileRadius; dc <= tileRadius; dc++) {
          if (dr * dr + dc * dc > tileRadius * tileRadius) continue
          const key = `${tcx + dc},${tcy + dr}`
          if (claimedCells.has(key)) continue
          ringSet.add(key)
        }
      }
      for (const key of ringSet) claimedCells.add(key)

      const patchContainer = new PIXI.Container()
      container.addChild(patchContainer)
      if (obs.type === 'water') {
        await renderPathTiles(patchContainer, ringSet, undefined, patchFile)
      } else {
        await renderSceneryPatch(patchContainer, ringSet, patchFile)
      }
      if (container.destroyed) return

      // Place WORLD_DECOR tile in the center cell (separate from SCENERY/PATH ring)
      const tileIds = (envDecorMap[obs.type] ?? TERRAIN_DECOR_MAP._default?.[obs.type]) as number[] | undefined
      if (tileIds?.length) {
        const tileId = tileIds[idNum % tileIds.length]
        const decorUrl = `${base}${WORLD_DECOR_FILE.slice(1)}`
        const tex = await loadTileTexture(decorUrl, tileId, 8)
        if (container.destroyed) return
        const s = new PIXI.Sprite(tex)
        s.position.set(tcx * TILE_SIZE, tcy * TILE_SIZE)
        container.addChild(s)
      }
      continue
    }

    // ── Ruin: single WORLD_DECOR tile (gravestone, house, …) ────────────────
    if (obs.type === 'ruin') {
      const tileIds = (envDecorMap['ruin'] ?? TERRAIN_DECOR_MAP._default?.['ruin']) as number[] | undefined ?? []
      if (tileIds.length === 0) continue
      const tileId = tileIds[idNum % tileIds.length]
      const decorUrl = `${base}${WORLD_DECOR_FILE.slice(1)}`
      const tex = await loadTileTexture(decorUrl, tileId, 8)
      if (container.destroyed) return
      const s = new PIXI.Sprite(tex)
      s.position.set(tcx * TILE_SIZE, tcy * TILE_SIZE)
      container.addChild(s)
    }
  }
}
