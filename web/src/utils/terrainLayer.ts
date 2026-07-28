import * as PIXI from 'pixi.js'
import { ENV_TILES, BASE_GROUND, TILESET_IMAGE, TILESET_COLUMNS, TILE_SIZE, EnvTileDef, SCENERY } from '../data/tiles/tileIndex'
import { WORLD_DECOR_FILE, WORLD_DECOR, TERRAIN_DECOR_MAP } from '../data/tiles/worldTileIndex'
import { getBattlefieldBundleById } from '../data/bundles/battlefieldBundleLoader'
import { loadTileTexture } from './pixiHelpers'
import { planTerrainPatches } from './terrainPatchPlan'
import { drawTerrainItem } from './terrainGfx'
import { seededRand, hashStr, getTerrainItems, type TerrainItem } from './mapUtils'
import { renderPathTiles } from './tileLookup'
import type { TerrainObstacle, RoadDef, BattlefieldDecorItem } from '../game/engine/terrain'

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
  tileScale: number = 1,
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
      const T = TILE_SIZE * tileScale
      const tileCols = Math.ceil(mapWidth / T)
      const tileRows = Math.ceil(mapHeight / T)
      const bg = new PIXI.Container()
      for (let r = 0; r < tileRows; r++) {
        for (let c = 0; c < tileCols; c++) {
          const s = new PIXI.Sprite(groundTex)
          s.position.set(c * T, r * T)
          s.width = T
          s.height = T
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
  tileScale: number = 1,
): Promise<void> {
  const def = opts.envDef ?? ENV_TILES[opts.environment ?? '']
  if (def?.bgTileId === undefined) return
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  const tileUrl = `${base}${def.pathFile.slice(1)}`
  const tex = await loadTileTexture(tileUrl, def.bgTileId, 8)
  if (container.destroyed) return
  const T = TILE_SIZE * tileScale
  const cols = Math.ceil(mapWidth / T)
  const rows = Math.ceil(mapHeight / T)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const s = new PIXI.Sprite(tex)
      s.position.set(c * T, r * T)
      s.width = T
      s.height = T
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
  tileScale: number = 1,
): void {
  const def = opts.envDef ?? ENV_TILES[opts.environment ?? '']
  const borderFile = def?.borderFile
  if (!borderFile) return

  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  const url  = base + borderFile.replace(/^\//, '')

  const T = TILE_SIZE * tileScale
  const BORDER_COLS = 1
  const BORDER_ROWS = 1
  const totalCols   = Math.ceil(w / T)
  const totalRows   = Math.ceil(h / T)

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
        sprite.position.set(c * T, r * T)
        sprite.width  = T
        sprite.height = T
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
  tileScale: number = 1,
): Promise<void> {
  const def = opts.envDef ?? ENV_TILES[opts.environment ?? '']
  if (!def?.decorFile || !def.decorTileIds?.length) return
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  const tileUrl = `${base}${def.decorFile.slice(1)}`
  const tileIds = def.decorTileIds
  const rand = seededRand(hashStr((opts.id ?? '') + 'decor'))
  const T = TILE_SIZE * tileScale
  const cols = Math.ceil(mapWidth / T)
  const rows = Math.ceil(mapHeight / T)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rand() > 0.15) continue
      const tileId = tileIds[Math.floor(rand() * tileIds.length)]
      const tex = await loadTileTexture(tileUrl, tileId, 8)
      if (container.destroyed) return
      const s = new PIXI.Sprite(tex)
      s.position.set(c * T, r * T)
      s.width = T
      s.height = T
      container.addChild(s)
    }
  }
}

/**
 * Renders act/node-authored decor placements (see BattlefieldDecorItem) — a
 * fixed list of WORLD_DECOR sprites, as opposed to buildDecorGfx's random
 * scatter. Callers should use this INSTEAD of buildDecorGfx when a non-empty
 * manual decor array is present for the act/node (manual placement replaces
 * the procedural scatter, it doesn't layer on top of it).
 *
 * Game coords → tile coords via gameToPixel() (see above), snapped to the tile
 * grid the same way buildTerrainDecorGfx does, so manually-placed items line
 * up with the rest of the battlefield's tile-aligned art.
 */
export async function buildManualDecorGfx(
  container: PIXI.Container,
  decorItems: BattlefieldDecorItem[],
  mapWidth: number,
  mapHeight: number,
  tileScale: number = 1,
): Promise<void> {
  if (decorItems.length === 0) return
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  const tileUrl = `${base}${WORLD_DECOR_FILE.slice(1)}`
  const T = TILE_SIZE * tileScale
  // Draw lowest zIndex first so higher-zIndex decor ends up on top.
  const sortedDecorItems = [...decorItems].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
  for (const item of sortedDecorItems) {
    if (container.destroyed) return
    const { px, py } = gameToPixel(item.x, item.y, mapWidth, mapHeight)
    const tcx0 = Math.round(px / T)
    const tcy0 = Math.round(py / T)
    if (item.bundleId) {
      const bundle = getBattlefieldBundleById(item.bundleId)
      if (!bundle) continue
      for (const t of bundle.tiles) {
        if (container.destroyed) return
        const tex = await loadTileTexture(tileUrl, t.tileId, 8)
        if (container.destroyed) return
        const s = new PIXI.Sprite(tex)
        s.position.set((tcx0 + t.dtx) * T, (tcy0 + t.dty) * T)
        s.width = T
        s.height = T
        container.addChild(s)
      }
      continue
    }
    const tex = await loadTileTexture(tileUrl, item.tileId, 8)
    if (container.destroyed) return
    const s = new PIXI.Sprite(tex)
    s.position.set(tcx0 * T, tcy0 * T)
    s.width = T
    s.height = T
    container.addChild(s)
  }
}

/**
 * Renders act/node-authored road paths on the battlefield lane, using the same
 * renderPathTiles() autotiler as hub streets and battlefield water patches.
 * Visual only — does not affect unit movement/avoidance.
 *
 * Roads sharing the same effective tileset (tileFile + canal-width class) are
 * unioned into a single tile set before autotiling, so overlapping/touching
 * roads render as one seamless shape (the autotiler picks interior tiles at
 * the seam) instead of each road drawing its own independently-edged patch —
 * two separate roads sharing an edge would otherwise double-draw that edge.
 *
 * Game coords → tile coords via gameToPixel() (see above), divided by TILE_SIZE.
 */
export async function buildRoadGfx(
  container: PIXI.Container,
  roads: RoadDef[],
  opts: { environment?: string; envDef?: EnvTileDef },
  w: number,
  h: number,
  tileScale: number = 1,
): Promise<void> {
  if (roads.length === 0) return
  const def = opts.envDef ?? ENV_TILES[opts.environment ?? '']
  const T = TILE_SIZE * tileScale

  const toTile = (x: number, y: number) => {
    const { px, py } = gameToPixel(x, y, w, h)
    return { tcx: Math.round(px / T), tcy: Math.round(py / T) }
  }

  // Group by effective tileFile only — every road sharing a tileFile is treated
  // as one continuous material and merges into a single autotiled shape
  // regardless of width, so a width=1 path crossing a width=6 canal reads as
  // one connected crossing rather than two independently-drawn, non-merging
  // patches (grouping key uses '' for the default/undefined tileFile).
  const groups = new Map<string, { tileFile: string | undefined; tiles: Set<string> }>()

  for (const road of roads) {
    if (road.points.length < 2) continue

    // Rasterize the centerline tile-by-tile between consecutive waypoints.
    // Stepping both axes at once for a ~45° segment would otherwise produce
    // tiles that only touch at a corner — the autotiler only recognizes
    // cardinal (N/E/S/W) adjacency, so a diagonal-only chain never reads as
    // connected. A width≥2 road hides this (dilation overlaps the gap), but a
    // width=1 road (no dilation margin) renders as disconnected single tiles.
    // Inserting a cardinal "elbow" tile at each diagonal step bridges it.
    const centerline = new Set<string>()
    let prev = toTile(road.points[0].x, road.points[0].y)
    centerline.add(`${prev.tcx},${prev.tcy}`)
    for (let i = 1; i < road.points.length; i++) {
      const cur = toTile(road.points[i].x, road.points[i].y)
      const dx = cur.tcx - prev.tcx
      const dy = cur.tcy - prev.tcy
      const steps = Math.max(Math.abs(dx), Math.abs(dy))
      let stepPrevTx = prev.tcx
      let stepPrevTy = prev.tcy
      for (let s = 1; s <= steps; s++) {
        const tx = Math.round(prev.tcx + (dx * s) / steps)
        const ty = Math.round(prev.tcy + (dy * s) / steps)
        if (tx !== stepPrevTx && ty !== stepPrevTy) {
          centerline.add(`${tx},${stepPrevTy}`)
        }
        centerline.add(`${tx},${ty}`)
        stepPrevTx = tx
        stepPrevTy = ty
      }
      prev = cur
    }

    // Widen the centerline into a band that's exactly `width` tiles across in
    // both directions — a square (not circular) window per centerline point,
    // biased one extra tile toward the positive side when width is even (no
    // exact centre tile exists then). Diagonal/corner stretches of the path
    // end up a little fatter at the joints (square corners overlapping), the
    // same trade-off the old circular version had, but the straight-run width
    // — and importantly, two roads' widths matching exactly — is now exact.
    const width = road.width ?? 2
    const tileRadiusLo = Math.max(0, Math.floor((width - 1) / 2))
    const tileRadiusHi = Math.max(0, width - 1 - tileRadiusLo)
    const key = road.tileFile ?? ''
    let group = groups.get(key)
    if (!group) {
      group = { tileFile: road.tileFile, tiles: new Set() }
      groups.set(key, group)
    }
    for (const centerKey of centerline) {
      const [c, r] = centerKey.split(',').map(Number)
      for (let dr = -tileRadiusLo; dr <= tileRadiusHi; dr++) {
        for (let dc = -tileRadiusLo; dc <= tileRadiusHi; dc++) {
          group.tiles.add(`${c + dc},${r + dr}`)
        }
      }
    }
  }

  for (const group of groups.values()) {
    if (container.destroyed) return
    const roadContainer = new PIXI.Container()
    container.addChild(roadContainer)
    // isCanal no longer varies per road/group — all roads render as one shared
    // material now, so autotile continuity works regardless of authored width.
    await renderPathTiles(roadContainer, group.tiles, opts.environment, group.tileFile, false, def, tileScale)
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
  tileScale: number = 1,
): Promise<void> {
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  const url = base + tileFile.replace(/^\//, '')
  const tex = await PIXI.Assets.load(url) as PIXI.Texture
  if (container.destroyed) return
  const T = TILE_SIZE * tileScale
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
    sprite.position.set(c * T, r * T)
    sprite.width  = T
    sprite.height = T
    container.addChild(sprite)
  }
}

/**
 * Renders battlefield terrain obstacles using TYPE3 adjacency-tiled patches
 * (tree → forest1, rock → rocks1/mountains1, water → grass1Water1) so shapes
 * are organic rather than single scaled tiles. Ruins fall back to a single
 * WORLD_DECOR tile (gravestone, house, etc.).
 *
 * Obstacles sharing a tileset are unioned into one tile set by
 * planTerrainPatches() and autotiled together, so touching patches render as
 * one continuous shape — a chain of overlapping water circles becomes a single
 * lake with one shoreline, rather than each circle edging against its
 * neighbours. This mirrors what buildRoadGfx does for overlapping roads.
 *
 * Game coords → canvas px via gameToPixel() (see above).
 */
export async function buildTerrainDecorGfx(
  container: PIXI.Container,
  terrain: TerrainObstacle[],
  opts: { environment?: string; envDef?: EnvTileDef },
  w: number,
  h: number,
  tileScale: number = 1,
): Promise<void> {
  if (terrain.length === 0) return
  const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
  const env = opts.environment ?? ''
  const envDecorMap = TERRAIN_DECOR_MAP[env] ?? {}
  const T = TILE_SIZE * tileScale

  const toTile = (obs: TerrainObstacle) => {
    const { px, py } = gameToPixel(obs.x, obs.y, w, h)
    return { tcx: Math.round(px / T), tcy: Math.round(py / T) }
  }
  const tileRadiusOf = (obs: TerrainObstacle) =>
    Math.max(1, Math.round(obs.radius * h / (TILE_RADIUS_SCALE * T)))

  const { groups, decor } = planTerrainPatches(terrain, toTile, tileRadiusOf, env)

  // ── TYPE3 adjacency-tiled patches (tree / rock / water), one draw per tileset ──
  for (const group of groups) {
    if (container.destroyed) return
    const patchContainer = new PIXI.Container()
    container.addChild(patchContainer)
    if (group.isPathTiles) {
      await renderPathTiles(patchContainer, group.tiles, undefined, group.patchFile, undefined, undefined, tileScale)
    } else {
      await renderSceneryPatch(patchContainer, group.tiles, group.patchFile, tileScale)
    }
  }

  // ── WORLD_DECOR icons (tree/rock centres, ruins) — drawn last so they sit on top ──
  const decorUrl = `${base}${WORLD_DECOR_FILE.slice(1)}`
  for (const { type, idNum, tcx, tcy } of decor) {
    if (container.destroyed) return
    const tileIds = (envDecorMap[type] ?? TERRAIN_DECOR_MAP._default?.[type]) as number[] | undefined
    if (!tileIds?.length) continue
    const tileId = tileIds[idNum % tileIds.length]
    const tex = await loadTileTexture(decorUrl, tileId, 8)
    if (container.destroyed) return
    const s = new PIXI.Sprite(tex)
    s.position.set(tcx * T, tcy * T)
    s.width = T
    s.height = T
    container.addChild(s)
  }
}
