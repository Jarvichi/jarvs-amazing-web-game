import React, { useRef } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../hooks/usePixiApp'
import { buildTerrainGfx, buildBgTileGfx, buildDecorGfx } from '../../utils/terrainLayer'
import { renderPathTiles } from '../../utils/tileLookup'
import { loadSpriteTexture, loadTextureUrl, loadAnimFrames, loadTileTexture } from '../../utils/pixiHelpers'
import { PATH_TILE, TILESET_IMAGE, TILESET_COLUMNS } from '../../data/tiles/tileIndex'
import { findPath, nearestWalkable } from '../../utils/hubPathfinder'
import { MAP_W, MAP_H, HUB_AREAS, HUB_STREET_TILES, HUB_STREET_GROUPS, HUB_BUILDINGS, AVATAR_START, NPC_SPAWN_TILES, AMBIENT_NPC_SPRITES, EXTERIOR_NPCS, INTERIOR_NPCS, HUB_DOORS, HUB_INTERIORS, EXTERIOR_DECOR, HUB_WINDOWS, HUB_POND_TILES, HUB_PICKUP_ITEMS, HUB_LOCKED_DOORS, HUB_BLOCKED_PATHS, HUB_TREASURES } from '../../data/hub/loader'
import { getWallTile, ROOF_TILES, WALL_TILES, ROOF_ROWS } from '../../data/tiles/buildingMaterials'
import type { WallMaterial, RoofMaterial } from '../../data/tiles/buildingMaterials'
import { loadPlayerAvatar } from '../../game/questline'
import type { HubNpc } from '../../data/hub/loader'
import { CommanderState } from '../../game/commander'
import rollbar from '../../rollbar'


const HUB_ENV           = 'camp'
const T                 = 32
const SPRITE_SIZE       = T * 1.5
const WALK_PX_PER_S     = 160
const NPC_WALK_PX_PER_S = 80
const COURTYARD_PX  = { x: AVATAR_START[0] * T + T / 2, y: AVATAR_START[1] * T + T }

let _savedTile: [number, number] | null = null
export function getSavedHubTile(): [number, number] | null { return _savedTile }

// ── Interior BFS pathfinder ────────────────────────────────────────────────────
function findInteriorPath(
  from: [number, number],
  to: [number, number],
  walkable: Set<string>,
): [number, number][] {
  const key = (t: [number, number]) => `${t[0]},${t[1]}`
  const queue: [number, number][][] = [[from]]
  const visited = new Set([key(from)])
  while (queue.length > 0) {
    const path = queue.shift()!
    const cur = path[path.length - 1]
    if (cur[0] === to[0] && cur[1] === to[1]) return path
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const next: [number, number] = [cur[0] + dx, cur[1] + dy]
      if (walkable.has(key(next)) && !visited.has(key(next))) {
        visited.add(key(next))
        queue.push([...path, next])
      }
    }
  }
  return [from]
}

interface Props {
  onAreaEnter:      (areaName: string | null) => void
  onNodeInteract:   (screen: string) => void
  onAvatarMove:     (px: number, py: number) => void
  returnRef?:       React.MutableRefObject<(() => void) | null>
  unitCards?:       string[]
  commander?:       CommanderState
  onNpcTap?:        (dialogue: string, npcId: string) => void
  interiorEnterRef?: React.MutableRefObject<((buildingId: string) => void) | null>
  interiorExitRef?:  React.MutableRefObject<(() => void) | null>
  onExitInterior?:   () => void
  onTileTap?:        (tx: number, ty: number) => void
  pickedUpIds?:      Set<string>
  onItemPickup?:     (id: string, questId?: string) => void
  doorKeys?:         Set<string>
  onDoorLocked?:     (buildingId: string, requiredItem: string) => void
  questNpcState?:        React.MutableRefObject<Map<string, 'offer' | 'ready' | null>>
  activeQuestIdsRef?:    React.MutableRefObject<Set<string>>
  completedQuestIdsRef?: React.MutableRefObject<Set<string>>
  collectedTreasureIds?: Set<string>
  onTreasureStep?:       (id: string) => void
  gameHour?:             number
  isNight?:              boolean
}

export function HubTownCanvas({
  onAreaEnter, onNodeInteract, onAvatarMove,
  returnRef, unitCards, commander, onNpcTap,
  interiorEnterRef, interiorExitRef, onExitInterior, onTileTap,
  pickedUpIds, onItemPickup, doorKeys, onDoorLocked, questNpcState, activeQuestIdsRef,
  completedQuestIdsRef, collectedTreasureIds, onTreasureStep,
  gameHour, isNight,
}: Props) {
  const containerRef      = useRef<HTMLDivElement>(null)
  const onAreaRef         = useRef(onAreaEnter)
  onAreaRef.current       = onAreaEnter
  const onNodeInteractRef = useRef(onNodeInteract)
  onNodeInteractRef.current = onNodeInteract
  const onAvatarMoveRef   = useRef(onAvatarMove)
  onAvatarMoveRef.current = onAvatarMove
  const onNpcTapRef       = useRef(onNpcTap)
  onNpcTapRef.current     = onNpcTap
  const unitCardsRef      = useRef(unitCards)
  unitCardsRef.current    = unitCards
  const onExitInteriorRef   = useRef(onExitInterior)
  onExitInteriorRef.current = onExitInterior
  const onTileTapRef        = useRef(onTileTap)
  onTileTapRef.current      = onTileTap
  const onItemPickupRef     = useRef(onItemPickup)
  onItemPickupRef.current   = onItemPickup
  const onDoorLockedRef     = useRef(onDoorLocked)
  onDoorLockedRef.current   = onDoorLocked
  const doorKeysRef         = useRef(doorKeys)
  doorKeysRef.current       = doorKeys
  // Tracks picked-up IDs imperatively within PixiJS context
  const pickedUpRef           = useRef<Set<string>>(pickedUpIds ?? new Set())
  const collectedTreasureRef  = useRef<Set<string>>(new Set(collectedTreasureIds))
  const onTreasureStepRef     = useRef(onTreasureStep)
  onTreasureStepRef.current   = onTreasureStep
  const isNightRef            = useRef(isNight ?? false)
  isNightRef.current          = isNight ?? false

  usePixiApp(containerRef, MAP_W, MAP_H, (app) => {
    app.canvas.style.touchAction = 'pan-x pan-y'

    // ── Layer hierarchy ────────────────────────────────────────────────────────
    const groundLayer   = new PIXI.Container()
    const streetLayer   = new PIXI.Container()
    const pondLayer     = new PIXI.Container()
    const belowAvatarLayer = new PIXI.Container()  // fixed decor always below sprites (e.g. stairs)
    const pickupLayer   = new PIXI.Container()  // ground-level collectible items
    const spriteLayer   = new PIXI.Container()  // avatar + NPCs + decor, Y-sorted
    const buildingLayer = new PIXI.Container()
    const windowLayer   = new PIXI.Container()
    const nodeLayer     = new PIXI.Container()
    const worldLayer    = new PIXI.Container()
    const interiorLayer = new PIXI.Container()  // top-most; hidden except when in a building
    const bubbleLayer   = new PIXI.Container()  // speech bubbles — above everything
    spriteLayer.sortableChildren = true
    worldLayer.sortableChildren  = true
    interiorLayer.visible = false
    const highlightGfx = new PIXI.Graphics()
    // Keep legacy aliases so existing code below compiles unchanged
    const npcLayer    = spriteLayer
    const avatarLayer = spriteLayer
    const exteriorDecorLayer = spriteLayer
    app.stage.addChild(groundLayer, streetLayer, pondLayer, buildingLayer, windowLayer, belowAvatarLayer, spriteLayer, pickupLayer, nodeLayer, worldLayer, interiorLayer, bubbleLayer, highlightGfx)

    // Keyed by pickupId; used to imperatively show/hide sprites when items are collected
    const pickupSprites  = new Map<string, PIXI.Sprite>()
    const pickupQuestIds = new Map<string, string>()  // pickupId → questId, for ticker gating

    const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL

    // ── Terrain ────────────────────────────────────────────────────────────────
    const baseContainer  = new PIXI.Container()
    const riverContainer = new PIXI.Container()
    groundLayer.addChild(baseContainer, riverContainer)

    buildTerrainGfx(baseContainer, riverContainer, worldLayer,
      { environment: HUB_ENV, id: 'hubworld', terrainItems: [] }, MAP_W, MAP_H)
    buildBgTileGfx(baseContainer, { environment: HUB_ENV }, MAP_W, MAP_H)
      .catch(e => rollbar.error('[HubTownCanvas] bg tiles failed', { error: String(e) }))
    buildDecorGfx(groundLayer, { environment: HUB_ENV, id: 'hubworld' }, MAP_W, MAP_H)
      .catch(e => rollbar.error('[HubTownCanvas] decor tiles failed', { error: String(e) }))

    // ── Pond (Greyfish Pond) — water path tiles ───────────────────────────────
    {
      const pondSet = new Set(HUB_POND_TILES.map(([tx, ty]) => `${tx},${ty}`))
      renderPathTiles(pondLayer, pondSet, undefined, PATH_TILE.water1, true)
        .catch(e => rollbar.error('[HubTownCanvas] pond tiles failed', { error: String(e) }))
    }

    // ── Streets ────────────────────────────────────────────────────────────────
    const pathSet = new Set(HUB_STREET_TILES.map(([tx, ty]) => `${tx},${ty}`))
    for (const group of HUB_STREET_GROUPS) {
      const groupSet = new Set(group.tiles.map(([tx, ty]) => `${tx},${ty}`))
      const tileOverride = group.pathType ? PATH_TILE[group.pathType as keyof typeof PATH_TILE] : undefined
      renderPathTiles(streetLayer, groupSet, tileOverride ? undefined : HUB_ENV, tileOverride)
        .catch(e => rollbar.error('[HubTownCanvas] street tiles failed', { error: String(e) }))
    }

    // Building tile set — derived from HUB_BUILDINGS, used for tap routing
    const buildingSet = new Set<string>()
    for (const b of HUB_BUILDINGS)
      for (let tx = b.rect[0]; tx <= b.rect[2]; tx++)
        for (let ty = b.rect[1]; ty <= b.rect[3]; ty++)
          buildingSet.add(`${tx},${ty}`)

    // ── Buildings ──────────────────────────────────────────────────────────────
    {
      const baseChipUrl = `${base}${TILESET_IMAGE.baseChip.slice(1)}`
      const cols = TILESET_COLUMNS.baseChip

      // Collect placements: tileId → [(tx, ty), …]
      // Insertion order determines render order — wall tiles first, door tiles
      // last so they overdraw the wall tiles at shared positions.
      const placements = new Map<number, [number, number][]>()
      const place = (tileId: number, tx: number, ty: number) => {
        const list = placements.get(tileId) ?? []
        list.push([tx, ty])
        placements.set(tileId, list)
      }

      const fallbackPromises: Promise<void>[] = []

      for (const building of HUB_BUILDINGS) {
        const [x1, y1, x2, y2] = building.rect

        if (!building.wall || !building.roof) {
          const buildingTileSet = new Set<string>()
          for (let tx = x1; tx <= x2; tx++)
            for (let ty = y1; ty <= y2; ty++)
              buildingTileSet.add(`${tx},${ty}`)
          fallbackPromises.push(renderPathTiles(buildingLayer, buildingTileSet, undefined, PATH_TILE.wall2))
          continue
        }

        const wall = building.wall as WallMaterial
        const roof = building.roof as RoofMaterial
        const roofTileIds = ROOF_TILES[roof]
        const width = x2 - x1 + 1

        // Roof pass — top 4 rows
        for (let row = 1; row < ROOF_ROWS; row++)
          for (let tx = x1; tx <= x2; tx++)
            place(roofTileIds[row], tx, y1 + row)

        // Wall pass — remaining rows (top tiles repeat for middle rows)
        const firstWallRow = y1 + ROOF_ROWS
        for (let ty = firstWallRow; ty <= y2; ty++) {
          for (let tx = x1; tx <= x2; tx++) {
            const isPillarCol      = tx === x1 + 1 || tx === x2 - 1
            const isShadowCol      = width >= 5 && tx === x1 + 2
            const isShadowRightCol = width >= 5 && tx === x2 
            const isBottomRow =  ty === y2
            const drawRow = true
            if (drawRow){
              const tileId = getWallTile(
                wall, isBottomRow,
                tx === x1,
                isPillarCol,
                isShadowCol,
                tx === x2,
                isShadowRightCol,
              )
              place(tileId, tx, ty)
            }
          }
        }

        // Door pass — south-facing doors, inserted after wall tiles so they overdraw
        const wallTiles = WALL_TILES[wall]
        for (const door of HUB_DOORS) {
          if (door.ty !== y2 + 1 || door.tx < x1 || door.tx > x2) continue
          const adj = door.tyAdjust ?? 0
          place(wallTiles.doorArchTop, door.tx, y2 - 1 - adj)
          place(wallTiles.doorTop,     door.tx, y2 - 1 - adj)
          place(wallTiles.doorBottom,  door.tx, y2 - 0 - adj)
        }
      }

      // Render: load each unique tileId once, reuse texture for all positions
      for (const [tileId, positions] of placements) {
        loadTileTexture(baseChipUrl, tileId, cols).then(tex => {
          if (app.renderer == null) return
          for (const [tx, ty] of positions) {
            const s = new PIXI.Sprite(tex)
            s.position.set(tx * T, ty * T)
            s.width = T; s.height = T
            buildingLayer.addChild(s)
          }
        }).catch(() => {})
      }

      Promise.all(fallbackPromises).catch(e => rollbar.error('[HubTownCanvas] building tiles failed', { error: String(e) }))
    }

    // ── Door signs ─────────────────────────────────────────────────────────────
    {
      // Map each building to a thematic sign tile from the base chip sheet
      const DOOR_SIGN_TILE: Record<string, number> = {
        'card-shop':         667,  // bookSign
        'augment-shop':      662,  // magicSign
        'supply-shop':       658,  // bagSign
        'scholars-hall':     667,  // bookSign
        'scholars-north-w':  667,  // bookSign
        'scholars-north-e':  667,  // bookSign
        'scholars-hall-w':   667,  // bookSign
        'home':              671,  // blankSign
        'trader-den':        668,  // goldSign
        'sw-building-b':     664,  // innSign
        'traders-building':  668,  // goldSign
        'market-building':   658,  // bagSign
        'arcade-building-e': 668,  // goldSign
        'arcade-building-w': 660,  // drinkSign
        'barracks-north':    657,  // armourSign
        'barracks-south':    656,  // weaponsSign
      }

      const baseChipUrl = `${base}${TILESET_IMAGE.baseChip.slice(1)}`

      // Group doors by sign tileId so we only load each texture once
      const byTile = new Map<number, { door: typeof HUB_DOORS[0]; name: string }[]>()
      for (const door of HUB_DOORS) {
        const name = HUB_INTERIORS[door.buildingId]?.name
        if (!name) continue
        const tileId = DOOR_SIGN_TILE[door.buildingId] ?? 234  // smallSign fallback
        const list = byTile.get(tileId) ?? []
        list.push({ door, name })
        byTile.set(tileId, list)
      }

      for (const [tileId, entries] of byTile) {
        loadTileTexture(baseChipUrl, tileId, TILESET_COLUMNS.baseChip).then(tex => {
          if (app.renderer == null) return
          for (const { door, name } of entries) {
            // Sign tile sits at the door arch row (door.ty - 2)
            const signTx = door.tx * T
            const signTy = (door.ty - 3) * T
            const sprite = new PIXI.Sprite(tex)
            sprite.position.set(signTx, signTy)
            sprite.width = T; sprite.height = T
            nodeLayer.addChild(sprite)

            // Small name label floats just above the sign tile
            const label = new PIXI.Text({
              text: name,
              style: { fontSize: 12, fill: '#f0e8c8', fontFamily: 'monospace', fontWeight: 'bold' },
            })
            label.anchor.set(0.5, 1)
            label.position.set(door.tx * T + T / 2, signTy - 1)

            const pad = 4
            const lbg = new PIXI.Graphics()
            lbg.roundRect(-label.width / 2 - pad, -label.height - pad, label.width + pad * 2, label.height + pad * 2, 2)
              .fill({ color: 0x1a1a2a, alpha: 0.8 })
            lbg.position.copyFrom(label.position)

            nodeLayer.addChild(lbg, label)
          }
        }).catch(() => {})
      }
    }

    // ── Exterior decor (tile sprites over streets/ground) ─────────────────────
    {
      const baseChipUrl    = `${base}${TILESET_IMAGE.baseChip.slice(1)}`
      const extNormal      = new Map<number, [number, number][]>()
      const extBelowAvatar = new Map<number, [number, number][]>()
      for (const d of EXTERIOR_DECOR) {
        if (d.tileId === 666) continue
        const map  = d.zlayer === 'below-avatar' ? extBelowAvatar : extNormal
        const list = map.get(d.tileId) ?? []
        list.push([d.tx, d.ty])
        map.set(d.tileId, list)
      }
      for (const [tileId, positions] of extNormal) {
        loadTileTexture(baseChipUrl, tileId, TILESET_COLUMNS.baseChip).then(tex => {
          if (app.renderer == null) return
          for (const [tx, ty] of positions) {
            const s = new PIXI.Sprite(tex)
            s.position.set(tx * T, ty * T)
            s.width = T; s.height = T
            s.zIndex = ty * T + T + 1
            exteriorDecorLayer.addChild(s)
          }
        }).catch(() => {})
      }
      for (const [tileId, positions] of extBelowAvatar) {
        loadTileTexture(baseChipUrl, tileId, TILESET_COLUMNS.baseChip).then(tex => {
          if (app.renderer == null) return
          for (const [tx, ty] of positions) {
            const s = new PIXI.Sprite(tex)
            s.position.set(tx * T, ty * T)
            s.width = T; s.height = T
            belowAvatarLayer.addChild(s)
          }
        }).catch(() => {})
      }
    }

    // ── Blocked paths (quest-gated obstructions) ──────────────────────────────
    interface BlockedNpcEntry {
      root: PIXI.Container
      tx: number
      ty: number
      proximityDialogue: { atDistance: number; text: string }[]
      bubble: PIXI.Container | null
      lastBubbleText: string | null
    }
    interface BlockedPathEntry {
      blockedDecor: PIXI.Sprite[]
      clearedDecor: PIXI.Sprite[]
      blockedNpcs: BlockedNpcEntry[]
      clearedNpcs: { root: PIXI.Container }[]
    }
    const blockedPathEntries = new Map<string, BlockedPathEntry>()
    {
      const baseChipUrl = `${base}${TILESET_IMAGE.baseChip.slice(1)}`
      for (const bp of HUB_BLOCKED_PATHS) {
        const isCleared = completedQuestIdsRef?.current.has(bp.questId) ?? false
        const entry: BlockedPathEntry = { blockedDecor: [], clearedDecor: [], blockedNpcs: [], clearedNpcs: [] }

        for (const d of bp.blocked.decor ?? []) {
          if (d.tileId === 666) continue
          loadTileTexture(baseChipUrl, d.tileId, TILESET_COLUMNS.baseChip).then(tex => {
            if (app.renderer == null) return
            const s = new PIXI.Sprite(tex)
            s.position.set(d.tx * T, d.ty * T)
            s.width = T; s.height = T
            s.visible = !isCleared
            belowAvatarLayer.addChild(s)
            entry.blockedDecor.push(s)
          }).catch(() => {})
        }

        for (const d of bp.cleared.decor ?? []) {
          if (d.tileId === 666) continue
          loadTileTexture(baseChipUrl, d.tileId, TILESET_COLUMNS.baseChip).then(tex => {
            if (app.renderer == null) return
            const s = new PIXI.Sprite(tex)
            s.position.set(d.tx * T, d.ty * T)
            s.width = T; s.height = T
            s.visible = isCleared
            belowAvatarLayer.addChild(s)
            entry.clearedDecor.push(s)
          }).catch(() => {})
        }

        for (const npc of bp.blocked.npcs ?? []) {
          const cx = npc.tx * T + T / 2
          const cy = npc.ty * T + T
          const npcContainer = new PIXI.Container()
          npcContainer.zIndex = cy
          npcContainer.visible = !isCleared
          npcContainer.eventMode = 'static'
          npcContainer.cursor = 'pointer'
          npcContainer.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
            e.stopPropagation()
            if (npc.tapDialogue) onNpcTapRef.current?.(npc.tapDialogue, npc.id)
          })
          loadTextureUrl(`${base}sprites/${npc.sprite}.svg`).then(tex => {
            if (app.renderer == null) return
            const s = new PIXI.Sprite(tex)
            s.width = SPRITE_SIZE; s.height = SPRITE_SIZE
            s.anchor.set(0.5, 1)
            s.position.set(cx, cy)
            npcContainer.addChild(s)
          }).catch(() => {})
          npcLayer.addChild(npcContainer)
          entry.blockedNpcs.push({ root: npcContainer, tx: npc.tx, ty: npc.ty, proximityDialogue: npc.proximityDialogue ?? [], bubble: null, lastBubbleText: null })
        }

        for (const npc of bp.cleared.npcs ?? []) {
          const cx = npc.tx * T + T / 2
          const cy = npc.ty * T + T
          const npcContainer = new PIXI.Container()
          npcContainer.zIndex = cy
          npcContainer.visible = isCleared
          npcContainer.eventMode = 'static'
          npcContainer.cursor = 'pointer'
          npcContainer.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
            e.stopPropagation()
            if (npc.tapDialogue) onNpcTapRef.current?.(npc.tapDialogue, npc.id)
          })
          loadTextureUrl(`${base}sprites/${npc.sprite}.svg`).then(tex => {
            if (app.renderer == null) return
            const s = new PIXI.Sprite(tex)
            s.width = SPRITE_SIZE; s.height = SPRITE_SIZE
            s.anchor.set(0.5, 1)
            s.position.set(cx, cy)
            npcContainer.addChild(s)
          }).catch(() => {})
          npcLayer.addChild(npcContainer)
          entry.clearedNpcs.push({ root: npcContainer })
        }

        blockedPathEntries.set(bp.id, entry)
      }
    }

    // ── Treasure chests (step-on collectibles, no quest required) ─────────────
    const treasureSprites     = new Map<string, PIXI.Sprite>()          // id → sprite
    const treasureCollectedTex = new Map<string, PIXI.Texture | null>() // id → collected texture (null = hide)
    const treasureByTile      = new Map<string, string>()               // "tx,ty" → id
    {
      const baseChipUrl = `${base}${TILESET_IMAGE.baseChip.slice(1)}`
      for (const t of HUB_TREASURES) {
        if (collectedTreasureRef.current.has(t.id)) {
          // Already collected — show the collected tile or nothing
          if (t.collectedTileId) {
            loadTileTexture(baseChipUrl, t.collectedTileId, TILESET_COLUMNS.baseChip).then(tex => {
              if (app.renderer == null) return
              const s = new PIXI.Sprite(tex)
              s.position.set(t.tx * T, t.ty * T)
              s.width = T; s.height = T
              belowAvatarLayer.addChild(s)
            }).catch(() => {})
          }
          continue
        }
        treasureByTile.set(`${t.tx},${t.ty}`, t.id)
        // Pre-load both textures; store collected texture (or null = hide)
        const collectedTexPromise = t.collectedTileId
          ? loadTileTexture(baseChipUrl, t.collectedTileId, TILESET_COLUMNS.baseChip).catch(() => null)
          : Promise.resolve(null)
        loadTileTexture(baseChipUrl, t.tileId, TILESET_COLUMNS.baseChip).then(async tex => {
          if (app.renderer == null) return
          const collectedTex = await collectedTexPromise
          const s = new PIXI.Sprite(tex)
          s.position.set(t.tx * T, t.ty * T)
          s.width = T; s.height = T
          belowAvatarLayer.addChild(s)
          treasureSprites.set(t.id, s)
          treasureCollectedTex.set(t.id, collectedTex)
        }).catch(() => {})
      }
    }

    // ── Exterior pickup items ──────────────────────────────────────────────────
    {
      const baseChipUrl  = `${base}${TILESET_IMAGE.baseChip.slice(1)}`
      const exteriorPickups = HUB_PICKUP_ITEMS.filter(p => !p.building)
      const byTile = new Map<number, typeof exteriorPickups>()
      for (const p of exteriorPickups) {
        if (p.tileId === 666) continue
        const list = byTile.get(p.tileId) ?? []
        list.push(p)
        byTile.set(p.tileId, list)
      }
      for (const [tileId, pickups] of byTile) {
        loadTileTexture(baseChipUrl, tileId, TILESET_COLUMNS.baseChip).then(tex => {
          if (app.renderer == null) return
          for (const pickup of pickups) {
            // Skip already-collected items; also skip chain items whose prerequisite isn't done
            if (pickedUpRef.current.has(pickup.id)) continue
            if (pickup.chain && !pickedUpRef.current.has(pickup.chain)) continue
            const s = new PIXI.Sprite(tex)
            s.position.set(pickup.tx * T, pickup.ty * T)
            s.width = T; s.height = T
            s.visible = !pickup.questId || (activeQuestIdsRef?.current.has(pickup.questId) ?? true)
            if (pickup.questId) pickupQuestIds.set(pickup.id, pickup.questId)
            if (!pickup.requireTouch) {
              s.eventMode = 'static'
              s.cursor    = 'pointer'
              s.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
                e.stopPropagation()
                s.visible = false
                pickedUpRef.current.add(pickup.id)
                // Reveal any chained item now that this one is collected
                for (const [pid, sprite] of pickupSprites) {
                  const def = HUB_PICKUP_ITEMS.find(p => p.id === pid)
                  if (def?.chain === pickup.id) sprite.visible = true
                }
                onItemPickupRef.current?.(pickup.id, pickup.questId)
              })
            }
            pickupLayer.addChild(s)
            pickupSprites.set(pickup.id, s)
          }
        }).catch(() => {})
      }
    }

    // ── Windows (transparent tile overlays on building walls) ─────────────────
    {
      const baseChipUrl = `${base}${TILESET_IMAGE.baseChip.slice(1)}`
      const byTile = new Map<number, [number, number][]>()
      for (const w of HUB_WINDOWS) {
        const list = byTile.get(w.tileId) ?? []
        list.push([w.tx, w.ty + 1])
        byTile.set(w.tileId, list)
      }
      for (const [tileId, positions] of byTile) {
        loadTileTexture(baseChipUrl, tileId, TILESET_COLUMNS.baseChip).then(tex => {
          if (app.renderer == null) return
          for (const [tx, ty] of positions) {
            const s = new PIXI.Sprite(tex)
            s.position.set(tx * T, ty * T)
            s.width = T; s.height = T
            windowLayer.addChild(s)
          }
        }).catch(() => {})
      }
    }

    // ── Avatar ─────────────────────────────────────────────────────────────────
    let avatar: PIXI.Sprite | null = null
    let avatarFrames: PIXI.Texture[] = []
    let avatarBaseTexture: PIXI.Texture | null = null
    let avatarAnimTimer = 0
    let avatarAnimFrame = 0
    let avatarInInterior = false
    const avatarSlug = loadPlayerAvatar()
    Promise.all([
      loadTextureUrl(`${base}sprites/${avatarSlug}.svg`),
      loadAnimFrames(avatarSlug, 3).catch(() => [] as PIXI.Texture[]),
    ]).then(([baseTex, frames]) => {
      if (app.renderer == null) return
      avatarBaseTexture = baseTex
      avatarFrames = frames
      const s = new PIXI.Sprite(baseTex)
      s.width = SPRITE_SIZE; s.height = SPRITE_SIZE
      s.anchor.set(0.5, 1)
      if (interiorActive) {
        s.position.set(interiorCurrentTile[0] * T + T / 2, interiorCurrentTile[1] * T + T)
        interiorLayer.addChild(s)
        avatarInInterior = true
      } else {
        const startTile: [number, number] = _savedTile ? [..._savedTile] : [...AVATAR_START]
        currentTile = startTile
        s.position.set(startTile[0] * T + T / 2, startTile[1] * T + T)
        avatarLayer.addChild(s)
      }
      avatar = s
    }).catch(e => rollbar.error('[HubTownCanvas] avatar load failed', { error: String(e) }))

    // ── NPC dialogue index (shared across exterior and interior NPCs) ──────────
    const npcDialogueIndex = new Map<string, number>()

    // ── Exterior NPCs ─────────────────────────────────────────────────────────
    // Quest indicators: keyed by npcId, updated imperatively in the ticker
    const questIndicators     = new Map<string, PIXI.Text>()
    const questIndicatorBaseY = new Map<string, number>()
    // Interior quest indicators: rebuilt each time we enter a building
    const interiorQuestIndicators     = new Map<string, PIXI.Text>()
    const interiorIndicatorBaseY      = new Map<string, number>()

    const npcBubbleTargets: { npc: HubNpc; cx: number; cy: number }[] = []
    for (const npc of EXTERIOR_NPCS) {
      const cx = npc.tx * T + T / 2
      const cy = npc.ty * T + T
      const isCommanderNpc = npc.id === 'commander-post'

      const npcContainer = new PIXI.Container()
      npcContainer.zIndex = cy
      npcContainer.eventMode = 'static'
      npcContainer.cursor    = 'pointer'
      npcContainer.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation()
        if (npc.dialogue.length > 0 || npc.screen || npc.questGive || npc.questReceive) {
          const idx = npcDialogueIndex.get(npc.id) ?? 0
          onNpcTapRef.current?.(npc.dialogue[idx % npc.dialogue.length] ?? '', npc.id)
          npcDialogueIndex.set(npc.id, idx + 1)
        }
      })
      npcLayer.addChild(npcContainer)
      if (npc.dialogue.length > 0) npcBubbleTargets.push({ npc, cx, cy })

      if (npc.questGive || npc.questReceive) {
        const indBaseY = cy - SPRITE_SIZE - 22
        const ind = new PIXI.Text({ text: '!', style: { fontSize: 16, fill: '#ffdd44', fontWeight: 'bold', fontFamily: 'monospace', stroke: { color: '#1a1a1a', width: 3 } } })
        ind.anchor.set(0.5, 1)
        ind.position.set(cx, indBaseY)
        ind.visible = false
        bubbleLayer.addChild(ind)
        questIndicators.set(npc.id, ind)
        questIndicatorBaseY.set(npc.id, indBaseY)
      }

      const npcSpriteSlug = isCommanderNpc ? (commander !== undefined ? commander.cardName : avatarSlug) : npc.sprite

      // Commander slug is a card name (e.g. "Jarv Knight") — must go through
      // loadSpriteTexture so spriteSlug() converts it to a valid filename.
      // Hub NPC sprites are already filename slugs so loadTextureUrl is fine.
      const texLoader = isCommanderNpc
        ? loadSpriteTexture(npcSpriteSlug).catch(() => loadTextureUrl(`${base}sprites/hub-avatar.svg`))
        : loadTextureUrl(`${base}sprites/${npcSpriteSlug}.svg`)

      texLoader.then(tex => {
        if (app.renderer == null) return
        const s = new PIXI.Sprite(tex)
        s.width = SPRITE_SIZE; s.height = SPRITE_SIZE
        s.anchor.set(0.5, 1)
        s.position.set(cx, cy)
        npcContainer.addChild(s)

        if (isCommanderNpc) {
          loadAnimFrames(npcSpriteSlug, 3).then(frames => {
            if (!frames.length || app.renderer == null) return
            let cmdAnimTimer = 0
            let cmdAnimFrame = 0
            app.ticker.add((ticker: PIXI.Ticker) => {
              cmdAnimTimer -= ticker.deltaMS
              if (cmdAnimTimer <= 0) {
                cmdAnimTimer = 250
                cmdAnimFrame = (cmdAnimFrame + 1) % frames.length
                s.texture = frames[cmdAnimFrame]
              }
            })
          }).catch(() => {})
        }
      }).catch(e => rollbar.error('[HubTownCanvas] NPC sprite failed', { sprite: npcSpriteSlug, error: String(e) }))
    }

    // ── NPC name tags (show within 5 tiles of avatar) ─────────────────────────
    const npcNameTags: { tx: number; ty: number; tag: PIXI.Container }[] = []
    for (const { npc, cx, cy } of npcBubbleTargets) {
      const tag = createNameTag(npc.name, cx, cy)
      tag.visible = false
      bubbleLayer.addChild(tag)
      npcNameTags.push({ tx: npc.tx, ty: npc.ty, tag })
    }

    // ── Card-unit NPCs ─────────────────────────────────────────────────────────
    const SCARED_PHRASES = [
      'Did you see that?!', 'Is someone there…?', 'Something is wrong…',
      'A ghost!! A ghost!!', "Did it just get cold?", 'Please no please no',
      "What was THAT?!", "I can't feel my legs…", 'Run!! RUN!!',
    ]

    interface UnitNpcState {
      sprite:             PIXI.Sprite
      currentTile:        [number, number]
      walkQueue:          [number, number][]
      isWalking:          boolean
      isGhost:            boolean
      wanderTimer:        number
      animFrames:         PIXI.Texture[]
      animTimer:          number
      animFrame:          number
      scaredBubble:       PIXI.Container | null
      scaredBubbleTimer:  number
      scaredBubbleCooldown: number
    }

    const unitNpcs: UnitNpcState[] = []
    const cards = unitCardsRef.current ?? []

    const effectiveCards = cards.length > 0
      ? cards
      : AMBIENT_NPC_SPRITES.length > 0 ? AMBIENT_NPC_SPRITES : ['hub-avatar']
    const spawnCount = Math.min(NPC_SPAWN_TILES.length, Math.max(effectiveCards.length * 3, 4))
    const slots = NPC_SPAWN_TILES.slice(0, spawnCount)

    slots.forEach(([tx, ty], i) => {
      const slug = effectiveCards[i % effectiveCards.length]
      const cx = tx * T + T / 2
      const cy = ty * T + T

      const texPromise = cards.length > 0
        ? loadSpriteTexture(slug).catch(() => loadTextureUrl(`${base}sprites/hub-avatar.svg`))
        : loadTextureUrl(`${base}sprites/${slug}.svg`).catch(() => loadTextureUrl(`${base}sprites/hub-avatar.svg`))

      texPromise.then(tex => {
        if (app.renderer == null) return
        const isGhost = Math.random() < (isNightRef.current ? 0.10 : 0.01)
        const s = new PIXI.Sprite(tex)
        s.width = SPRITE_SIZE; s.height = SPRITE_SIZE
        s.anchor.set(0.5, 1)
        s.position.set(cx, cy)
        s.zIndex = cy
        s.alpha = isGhost ? 0.4 : 1.0
        if (isGhost) s.tint = 0xaaccff
        npcLayer.addChild(s)

        const state: UnitNpcState = {
          sprite:               s,
          currentTile:          [tx, ty],
          walkQueue:            [],
          isWalking:            false,
          wanderTimer:          500 + Math.random() * 500,
          animFrames:           [],
          animTimer:            0,
          animFrame:            0,
          isGhost:              isGhost,
          scaredBubble:         null,
          scaredBubbleTimer:    0,
          scaredBubbleCooldown: 0,
        }
        unitNpcs.push(state)

        loadAnimFrames(slug, 3)
          .then(frames => { state.animFrames = frames })
          .catch(() => {})
      })
    })

    // Door tiles — NPCs that arrive here despawn (simulate entering a building)
    const doorTileSet = new Set(HUB_DOORS.map(d => `${d.tx},${d.ty}`))
    // Spawn tiles that aren't doors — used for respawning so NPCs don't immediately despawn
    const nonDoorSpawnTiles = NPC_SPAWN_TILES.filter(([tx, ty]) => !doorTileSet.has(`${tx},${ty}`))
    const TARGET_NPC_COUNT = 12
    let respawnTimer = 2000

    async function processNpcWalkQueue(npc: UnitNpcState) {
      try {
        if (npc.walkQueue.length === 0) { npc.isWalking = false; return }
        npc.isWalking = true
        const [tx, ty] = npc.walkQueue.shift()!
        const targetX  = tx * T + T / 2
        const targetY  = ty * T + T
        const dist     = Math.hypot(targetX - npc.sprite.x, targetY - npc.sprite.y)
        const duration = (dist / NPC_WALK_PX_PER_S) * 1000
        if (targetX < npc.sprite.x - 1) npc.sprite.scale.x = -Math.abs(npc.sprite.scale.x)
        else if (targetX > npc.sprite.x + 1) npc.sprite.scale.x = Math.abs(npc.sprite.scale.x)
        await tweenLinear(npc.sprite, targetX, targetY, duration)
        npc.currentTile = [tx, ty]
        // Despawn NPCs that reach a building door — they "go inside"
        if (doorTileSet.has(`${tx},${ty}`)) {
          npc.sprite.parent?.removeChild(npc.sprite)
          const idx = unitNpcs.indexOf(npc)
          if (idx !== -1) unitNpcs.splice(idx, 1)
          return
        }
        processNpcWalkQueue(npc)
      } catch (e) {
        npc.isWalking = false
        rollbar.error('[HubTownCanvas] processNpcWalkQueue error', { error: String(e) })
      }
    }

    function wanderNpc(npc: UnitNpcState) {
      const effectivePathSet = new Set(pathSet)
      for (const bp of HUB_BLOCKED_PATHS) {
        if (!(completedQuestIdsRef?.current.has(bp.questId) ?? false)) {
          for (const [btx, bty] of bp.blockedTiles) effectivePathSet.delete(`${btx},${bty}`)
        }
      }
      const ghosts = npc.isGhost ? [] : unitNpcs.filter(n => n.isGhost)
      const allOptions = NPC_SPAWN_TILES.filter(
        ([tx, ty]) => tx !== npc.currentTile[0] || ty !== npc.currentTile[1],
      ) as [number, number][]
      if (allOptions.length === 0) return
      // Non-ghost NPCs avoid tiles within 5 tiles of any ghost
      const options = ghosts.length === 0 ? allOptions : (
        allOptions.filter(([tx, ty]) =>
          ghosts.every(g => Math.max(Math.abs(tx - g.currentTile[0]), Math.abs(ty - g.currentTile[1])) > 5)
        ).length > 0
          ? allOptions.filter(([tx, ty]) =>
              ghosts.every(g => Math.max(Math.abs(tx - g.currentTile[0]), Math.abs(ty - g.currentTile[1])) > 5)
            )
          : allOptions
      )
      const target = options[Math.floor(Math.random() * options.length)]
      const path   = findPath(npc.currentTile, target, effectivePathSet)
      npc.walkQueue = path.slice(1)
      if (!npc.isWalking) processNpcWalkQueue(npc)
    }

    function spawnAmbientNpc() {
      if (nonDoorSpawnTiles.length === 0) return
      const [tx, ty] = nonDoorSpawnTiles[Math.floor(Math.random() * nonDoorSpawnTiles.length)]
      const cx = tx * T + T / 2
      const cy = ty * T + T
      const slug = effectiveCards[Math.floor(Math.random() * effectiveCards.length)]
      const texPromise = cards.length > 0
        ? loadSpriteTexture(slug).catch(() => loadTextureUrl(`${base}sprites/hub-avatar.svg`))
        : loadTextureUrl(`${base}sprites/${slug}.svg`).catch(() => loadTextureUrl(`${base}sprites/hub-avatar.svg`))
      texPromise.then(tex => {
        if (app.renderer == null) return
        const isGhost = Math.random() < (isNightRef.current ? 0.10 : 0.01)
        const s = new PIXI.Sprite(tex)
        s.width = SPRITE_SIZE; s.height = SPRITE_SIZE
        s.anchor.set(0.5, 1)
        s.position.set(cx, cy)
        s.zIndex = cy
        s.alpha = isGhost ? 0.4 : 1.0
        if (isGhost) s.tint = 0xaaccff
        npcLayer.addChild(s)
        const state: UnitNpcState = {
          sprite:               s,
          currentTile:          [tx, ty],
          walkQueue:            [],
          isWalking:            false,
          wanderTimer:          1000 + Math.random() * 2000,
          animFrames:           [],
          animTimer:            0,
          animFrame:            0,
          isGhost:              isGhost,
          scaredBubble:         null,
          scaredBubbleTimer:    0,
          scaredBubbleCooldown: 0,
        }
        unitNpcs.push(state)
        loadAnimFrames(slug, 3).then(frames => { state.animFrames = frames }).catch(() => {})
      }).catch(() => {})
    }

    // ── Exterior walk state ────────────────────────────────────────────────────
    let currentTile: [number, number] = [...AVATAR_START]
    let walkQueue:   [number, number][] = []
    let isWalking    = false
    let pendingScreen: string | null = null

    // ── Interior state ─────────────────────────────────────────────────────────
    let interiorActive      = false
    let currentInteriorId: string | null = null
    let interiorCurrentTile: [number, number] = [0, 0]
    let interiorWalkable    = new Set<string>()
    let interiorWalkQueue:  [number, number][] = []
    let interiorIsWalking   = false
    let interiorExitTile:   [number, number] = [0, 0]
    let intOffX = 0
    let intOffY = 0

    // ── Tween (shared by exterior and interior walk) ───────────────────────────
    function tweenLinear(
      obj: PIXI.Container,
      targetX: number,
      targetY: number,
      durationMs: number,
    ): Promise<void> {
      return new Promise(resolve => {
        if (durationMs <= 0) { obj.x = targetX; obj.y = targetY; resolve(); return }
        const sx = obj.x, sy = obj.y
        let elapsed = 0
        const tick = (ticker: PIXI.Ticker) => {
          elapsed += ticker.deltaMS
          const t = Math.min(elapsed / durationMs, 1)
          obj.x = sx + (targetX - sx) * t
          obj.y = sy + (targetY - sy) * t
          if (t >= 1) { app.ticker.remove(tick); resolve() }
        }
        app.ticker.add(tick)
      })
    }

    // ── Interior exit ──────────────────────────────────────────────────────────
    const doExitInterior = () => {
      try {
        if (!interiorActive) return
        interiorActive = false
        interiorIsWalking = false
        interiorWalkQueue = []

        // Restore exterior
        groundLayer.visible   = true
        streetLayer.visible   = true
        buildingLayer.visible = true
        nodeLayer.visible     = true
        npcLayer.visible      = true
        bubbleLayer.visible   = true

        // Move avatar back to exterior door position
        if (avatar && avatarInInterior) {
          interiorLayer.removeChild(avatar)
          avatarLayer.addChild(avatar)
          avatarInInterior = false
          const door = HUB_DOORS.find(d => d.buildingId === currentInteriorId)
          if (door) {
            avatar.x = door.tx * T + T / 2
            avatar.y = door.ty * T + T
            currentTile = [door.tx, door.ty]
          }
          onAvatarMoveRef.current(avatar.x, avatar.y)
        }

        interiorLayer.visible = false
        interiorLayer.removeChildren()
        currentInteriorId = null
        highlightGfx.clear()
        onExitInteriorRef.current?.()
      } catch (e) {
        rollbar.error('[HubTownCanvas] doExitInterior error', { error: String(e) })
      }
    }

    // ── Interior enter ─────────────────────────────────────────────────────────
    const doEnterInterior = (buildingId: string) => {
      try {
      // Locked door check — block entry if key not in inventory
      const lock = HUB_LOCKED_DOORS.find(l => l.buildingId === buildingId)
      if (lock && !doorKeysRef.current?.has(lock.lockedBy)) {
        onDoorLockedRef.current?.(buildingId, lock.lockedBy)
        return
      }

      const interior = HUB_INTERIORS[buildingId]
      if (!interior) return

      const intW = interior.width * T
      const intH = interior.height * T
      intOffX = Math.floor((MAP_W - intW) / 2)
      intOffY = Math.floor((MAP_H - intH) / 2)

      // Hide exterior layers
      groundLayer.visible   = false
      streetLayer.visible   = false
      buildingLayer.visible = false
      nodeLayer.visible     = false
      npcLayer.visible      = false
      bubbleLayer.visible   = false

      // Clean up any exterior bubbles/scared-bubbles before entering
      for (const slot of activeBubbles) bubbleLayer.removeChild(slot.container)
      activeBubbles.length = 0
      for (const npc of unitNpcs) {
        if (npc.scaredBubble) {
          bubbleLayer.removeChild(npc.scaredBubble)
          npc.scaredBubble = null
          npc.scaredBubbleTimer = 0
        }
      }

      // Prepare interior layer
      interiorLayer.removeChildren()
      interiorLayer.position.set(intOffX, intOffY)
      interiorLayer.visible = true

      // Dark background covering the full map (masks transparent canvas outside room)
      const bg = new PIXI.Graphics()
      bg.rect(-intOffX, -intOffY, MAP_W, MAP_H).fill({ color: 0x0a0a18, alpha: 1 })
      interiorLayer.addChild(bg)

      // Set interior state
      const exitTx: number = Math.floor(interior.width / 2)
      const entryTile: [number, number] = [exitTx, interior.height - 2]
      interiorCurrentTile = entryTile
      currentInteriorId   = buildingId
      interiorExitTile    = [exitTx, interior.height - 1]
      interiorActive      = true
      interiorIsWalking   = false
      interiorWalkQueue   = []

      // Build walkable set
      interiorWalkable = new Set<string>()
      for (let tx = 1; tx < interior.width - 1; tx++)
        for (let ty = 1; ty < interior.height - 1; ty++)
          interiorWalkable.add(`${tx},${ty}`)
      interiorWalkable.add(`${exitTx},${interior.height - 1}`)
      for (const d of interior.decor) {
        if (!d.zlayer || d.zlayer === 'solid') interiorWalkable.delete(`${d.tx},${d.ty}`)
      }

      // Floor tile set (all inner tiles + exit door tile)
      const floorSet = new Set<string>()
      for (let tx = 1; tx < interior.width - 1; tx++)
        for (let ty = 1; ty < interior.height - 1; ty++)
          floorSet.add(`${tx},${ty}`)
      floorSet.add(`${exitTx},${interior.height - 1}`)  // exit door opening

      // Wall tile set (border, minus exit door opening)
      const wallSet = new Set<string>()
      for (let tx = 0; tx < interior.width; tx++) {
        wallSet.add(`${tx},0`)
        wallSet.add(`${tx},${interior.height - 1}`)
      }
      for (let ty = 1; ty < interior.height - 1; ty++) {
        wallSet.add(`0,${ty}`)
        wallSet.add(`${interior.width - 1},${ty}`)
      }
      wallSet.delete(`${exitTx},${interior.height - 1}`)  // open door gap

      // Render tile layers (async — tiles appear as they load)
      const floorContainer = new PIXI.Container()
      const wallContainer  = new PIXI.Container()
      interiorLayer.addChild(floorContainer, wallContainer)

      // Floor: proper interior tile from base chip sheet (wood, stone, parquet, etc.)
      const floorTileId  = interior.floorTileId ?? 288
      const baseChipUrl  = `${base}${TILESET_IMAGE.baseChip.slice(1)}`
      loadTileTexture(baseChipUrl, floorTileId, TILESET_COLUMNS.baseChip).then(floorTex => {
        if (!interiorActive || currentInteriorId !== buildingId) return
        for (let tx = 1; tx < interior.width - 1; tx++) {
          for (let ty = 1; ty < interior.height - 1; ty++) {
            const s = new PIXI.Sprite(floorTex)
            s.position.set(tx * T, ty * T)
            floorContainer.addChild(s)
          }
        }
        // Exit door tile also gets floor
        const exitFloor = new PIXI.Sprite(floorTex)
        exitFloor.position.set(exitTx * T, (interior.height - 1) * T)
        floorContainer.addChild(exitFloor)
      }).catch(() => {
        renderPathTiles(floorContainer, floorSet, undefined, PATH_TILE.dirt1).catch(() => {})
      })

      // Walls: side columns use default path tiles; top/bottom rows use wallMaterial if set
      const sideWallSet       = new Set<string>()
      const horizontalWallSet = new Set<string>()
      for (const key of wallSet) {
        const [wx, wy] = key.split(',').map(Number)
        if (wx > 0 && wx < interior.width - 1 && (wy === 0 || wy === interior.height - 1)) horizontalWallSet.add(key)
        else {sideWallSet.add(`${wx},${wy-1}`); sideWallSet.add(`${wx},${wy}`)}
      }
      renderPathTiles(wallContainer, sideWallSet, undefined, PATH_TILE.wall2).catch(() => {})

      if (interior.wallMaterial) {
        // Bottom row keeps default tile; top row uses middleBottom; a visual-only row above (ty=-1) uses middleTop
        renderPathTiles(wallContainer, new Set([...horizontalWallSet].filter(k => parseInt(k.split(',')[1]) !== 0)), undefined, PATH_TILE.wall2).catch(() => {})
        const wTiles = WALL_TILES[interior.wallMaterial]
        // ty=0 row → middleBottom; ty=-1 (above room, visual only) → middleTop
        const byTileId = new Map<number, [number, number][]>()
        for (const key of horizontalWallSet) {
          const [wx, wy] = key.split(',').map(Number)
          if (wy !== 0) continue
          const list = byTileId.get(wTiles.middleBottom) ?? []; list.push([wx, 0]); byTileId.set(wTiles.middleBottom, list)
          const topList = byTileId.get(wTiles.middleTop) ?? []; topList.push([wx, -1]); byTileId.set(wTiles.middleTop, topList)
        }
        for (const [tileId, positions] of byTileId) {
          loadTileTexture(baseChipUrl, tileId, TILESET_COLUMNS.baseChip).then(tex => {
            if (!interiorActive || currentInteriorId !== buildingId) return
            for (const [wx, wy] of positions) {
              const s = new PIXI.Sprite(tex)
              s.position.set(wx * T, wy * T)
              s.width = T; s.height = T
              wallContainer.addChild(s)
            }
          }).catch(() => {})
        }
      } else {
        renderPathTiles(wallContainer, horizontalWallSet, undefined, PATH_TILE.wall2).catch(() => {})
      }

      // Decor — split into below-avatar (solid/below) and above-avatar containers
      const decorBelowContainer = new PIXI.Container()
      const decorAboveContainer = new PIXI.Container()  // added to interiorLayer after avatar
      interiorLayer.addChild(decorBelowContainer)

      function renderDecorItems(items: typeof interior.decor, target: PIXI.Container) {
        const byTileId = new Map<number, [number, number][]>()
        for (const d of items) {
          if (d.tileId === 666) continue
          const list = byTileId.get(d.tileId) ?? []
          list.push([d.tx, d.ty])
          byTileId.set(d.tileId, list)
        }
        for (const [tileId, positions] of byTileId) {
          loadTileTexture(baseChipUrl, tileId, TILESET_COLUMNS.baseChip).then(tex => {
            if (!interiorActive || currentInteriorId !== buildingId) return
            for (const [dtx, dty] of positions) {
              const s = new PIXI.Sprite(tex)
              s.width = T; s.height = T
              s.position.set(dtx * T, dty * T)
              target.addChild(s)
            }
          }).catch(() => {})
        }
      }

      renderDecorItems(interior.decor.filter(d => d.zlayer !== 'above'), decorBelowContainer)
      // above-avatar decor rendered after avatar is added (below)

      // Interior pickup items — rendered in room, disappear when tapped
      {
        const intBaseChipUrl = `${base}${TILESET_IMAGE.baseChip.slice(1)}`
        const intPickups = HUB_PICKUP_ITEMS.filter(p => p.building === buildingId)
        const intByTile = new Map<number, typeof intPickups>()
        for (const p of intPickups) {
          if (p.tileId === 666) continue
          const list = intByTile.get(p.tileId) ?? []
          list.push(p)
          intByTile.set(p.tileId, list)
        }
        for (const [tileId, pickups] of intByTile) {
          loadTileTexture(intBaseChipUrl, tileId, TILESET_COLUMNS.baseChip).then(tex => {
            if (!interiorActive || currentInteriorId !== buildingId) return
            for (const pickup of pickups) {
              if (pickedUpRef.current.has(pickup.id)) continue
              if (pickup.chain && !pickedUpRef.current.has(pickup.chain)) continue
              const s = new PIXI.Sprite(tex)
              s.position.set(pickup.tx * T, pickup.ty * T)
              s.width = T; s.height = T
              s.visible = !pickup.questId || (activeQuestIdsRef?.current.has(pickup.questId) ?? true)
              if (pickup.questId) pickupQuestIds.set(pickup.id, pickup.questId)
              if (!pickup.requireTouch) {
                s.eventMode = 'static'
                s.cursor    = 'pointer'
                s.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
                  e.stopPropagation()
                  s.visible = false
                  pickedUpRef.current.add(pickup.id)
                  // Reveal chained exterior pickups if applicable
                  for (const [pid, sprite] of pickupSprites) {
                    const def = HUB_PICKUP_ITEMS.find(p => p.id === pid)
                    if (def?.chain === pickup.id) sprite.visible = true
                  }
                  onItemPickupRef.current?.(pickup.id, pickup.questId)
                })
              }
              interiorLayer.addChild(s)
              pickupSprites.set(pickup.id, s)
            }
          }).catch(() => {})
        }
      }

      // Interior NPCs — rendered inside the room, tappable
      const interiorNpcList: HubNpc[] = INTERIOR_NPCS[buildingId] ?? []
      for (const npc of interiorNpcList) {
        loadTextureUrl(`${base}sprites/${npc.sprite}.svg`).then(tex => {
          if (!interiorActive || currentInteriorId !== buildingId) return
          const s = new PIXI.Sprite(tex)
          s.width = SPRITE_SIZE; s.height = SPRITE_SIZE
          s.anchor.set(0.5, 1)
          s.position.set(npc.tx * T + T / 2, npc.ty * T + T)
          s.eventMode = 'static'
          s.cursor    = 'pointer'
          s.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
            e.stopPropagation()
            if (npc.dialogue.length > 0 || npc.screen || npc.questGive || npc.questReceive) {
              const idx = npcDialogueIndex.get(npc.id) ?? 0
              onNpcTapRef.current?.(npc.dialogue[idx % npc.dialogue.length] ?? '', npc.id)
              npcDialogueIndex.set(npc.id, idx + 1)
            }
          })
          interiorLayer.addChild(s)
        }).catch(() => {})
      }

      // Quest indicators for interior NPCs
      interiorQuestIndicators.clear()
      interiorIndicatorBaseY.clear()
      for (const npc of interiorNpcList) {
        if (!npc.questGive && !npc.questReceive) continue
        const indBaseY = npc.ty * T + T - SPRITE_SIZE - 8
        const ind = new PIXI.Text({ text: '!', style: { fontSize: 16, fill: '#ffdd44', fontWeight: 'bold', fontFamily: 'monospace', stroke: { color: '#1a1a1a', width: 3 } } })
        ind.anchor.set(0.5, 1)
        ind.position.set(npc.tx * T + T / 2, indBaseY)
        ind.visible = false
        interiorLayer.addChild(ind)
        interiorQuestIndicators.set(npc.id, ind)
        interiorIndicatorBaseY.set(npc.id, indBaseY)
      }

      // Room name label
      const nameLabel = new PIXI.Text({
        text: interior.name,
        style: { fontSize: 10, fill: '#c8e8c8', fontFamily: 'monospace' },
      })
      nameLabel.position.set(T + 4, 4)
      interiorLayer.addChild(nameLabel)

      // Exit marker
      const exitMarker = new PIXI.Text({
        text: '▼ EXIT',
        style: { fontSize: 8, fill: '#88ff88', fontFamily: 'monospace', fontWeight: 'bold' },
      })
      exitMarker.anchor.set(0.5, 0)
      exitMarker.position.set(exitTx * T + T / 2, (interior.height - 1) * T + 2)
      interiorLayer.addChild(exitMarker)

      // Move avatar into interior (on top of solid/below decor)
      if (avatar) {
        if (!avatarInInterior) avatarLayer.removeChild(avatar)
        avatar.x = entryTile[0] * T + T / 2
        avatar.y = entryTile[1] * T + T
        interiorLayer.addChild(avatar)
        avatarInInterior = true
      }

      // Above-avatar decor — added after avatar so it renders on top
      interiorLayer.addChild(decorAboveContainer)
      renderDecorItems(interior.decor.filter(d => d.zlayer === 'above'), decorAboveContainer)

      // Interior treasures — chests defined in the treasures array with a matching buildingId
      for (const t of HUB_TREASURES.filter(tr => tr.buildingId === buildingId)) {
        const isCollected = collectedTreasureRef.current.has(t.id)
        const displayTileId = isCollected && t.collectedTileId != null ? t.collectedTileId : t.tileId
        const collectedTexPromise = t.collectedTileId
          ? loadTileTexture(baseChipUrl, t.collectedTileId, TILESET_COLUMNS.baseChip).catch(() => null)
          : Promise.resolve(null)
        loadTileTexture(baseChipUrl, displayTileId, TILESET_COLUMNS.baseChip).then(async tex => {
          if (!interiorActive || currentInteriorId !== buildingId) return
          const collectedTex = await collectedTexPromise
          const s = new PIXI.Sprite(tex)
          s.position.set(t.tx * T, t.ty * T)
          s.width = T; s.height = T
          if (!isCollected) {
            s.eventMode = 'static'
            s.cursor    = 'pointer'
            s.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
              e.stopPropagation()
              collectedTreasureRef.current.add(t.id)
              if (collectedTex) s.texture = collectedTex
              else              s.visible = false
              s.eventMode = 'none'
              onTreasureStepRef.current?.(t.id)
            })
          }
          interiorLayer.addChild(s)
        }).catch(() => {})
      }

      // Scroll viewport to center on interior
      onAvatarMoveRef.current(intOffX + entryTile[0] * T + T / 2, intOffY + entryTile[1] * T + T / 2)
      } catch (e) {
        rollbar.error('[HubTownCanvas] doEnterInterior error', { buildingId, error: String(e) })
      }
    }

    if (interiorEnterRef) interiorEnterRef.current = doEnterInterior
    if (interiorExitRef)  interiorExitRef.current  = doExitInterior

    // ── Interior walk queue ────────────────────────────────────────────────────
    async function processInteriorWalkQueue() {
      try {
        if (interiorWalkQueue.length === 0) { interiorIsWalking = false; return }
        interiorIsWalking = true
        const [ntx, nty] = interiorWalkQueue.shift()!
        const px = ntx * T + T / 2
        const py = nty * T + T
        const av = avatar
        if (!av) { interiorCurrentTile = [ntx, nty]; processInteriorWalkQueue(); return }
        if (px < av.x - 1) av.scale.x = -Math.abs(av.scale.x)
        else if (px > av.x + 1) av.scale.x = Math.abs(av.scale.x)
        const dist = Math.hypot(px - av.x, py - av.y)
        await tweenLinear(av, px, py, (dist / WALK_PX_PER_S) * 1000)
        interiorCurrentTile = [ntx, nty]

        // Touch-pickup: collect requireTouch interior items when avatar walks onto their tile
        for (const [pid, sprite] of pickupSprites) {
          if (!sprite.visible) continue
          const def = HUB_PICKUP_ITEMS.find(p => p.id === pid && p.building === currentInteriorId)
          if (def?.requireTouch && def.tx === ntx && def.ty === nty) {
            sprite.visible = false
            pickedUpRef.current.add(pid)
            for (const [cpid, csprite] of pickupSprites) {
              const cdef = HUB_PICKUP_ITEMS.find(p => p.id === cpid)
              if (cdef?.chain === pid) csprite.visible = true
            }
            onItemPickupRef.current?.(pid, def.questId)
          }
        }

        if (ntx === interiorExitTile[0] && nty === interiorExitTile[1]) {
          interiorIsWalking = false
          doExitInterior()
          return
        }
        processInteriorWalkQueue()
      } catch (e) {
        interiorIsWalking = false
        rollbar.error('[HubTownCanvas] processInteriorWalkQueue error', { error: String(e) })
      }
    }

    // ── Idle speech bubble state ───────────────────────────────────────────────
    const IDLE_THRESHOLD_MS = 5000
    const BUBBLE_SHOW_MS    = 10_000
    const BUBBLE_FADE_MS    = 500
    const SLOT_STAGGER_MS   = 4_000
    const MAX_BUBBLES       = 3

    interface BubbleSlot { container: PIXI.Container; timer: number; phase: 'showing' | 'fading' }
    const activeBubbles: BubbleSlot[] = []
    let lastMovedMs    = performance.now()
    let nextSpawnTimer = 0
    let lastBubbleIdx  = -1

    function createSpeechBubble(text: string, cx: number, cy: number): PIXI.Container {
      const c   = new PIXI.Container()
      const lbl = new PIXI.Text({
        text,
        style: { fontSize: 11, fill: '#111111', fontFamily: 'monospace', wordWrap: true, wordWrapWidth: 160 },
      })
      lbl.anchor.set(0.5, 0.5)
      const pad = 6
      const bw  = lbl.width  + pad * 2
      const bh  = lbl.height + pad * 2
      lbl.position.set(0, -bh / 2)
      const bg  = new PIXI.Graphics()
      bg.roundRect(-bw / 2, -bh, bw, bh, 6).fill({ color: 0xffffff, alpha: 1 })
      bg.roundRect(-bw / 2, -bh, bw, bh, 6).stroke({ color: 0x000000, width: 1.5 })
      bg.moveTo(-6, 0).lineTo(6, 0).lineTo(0, 8).closePath().fill({ color: 0xffffff })
      bg.moveTo(-6, 0).lineTo(6, 0).lineTo(0, 8).closePath().stroke({ color: 0x000000, width: 1.5 })
      c.addChild(bg, lbl)
      c.position.set(cx, cy - SPRITE_SIZE - 4)
      return c
    }

    function createNameTag(name: string, cx: number, cy: number): PIXI.Container {
      const c   = new PIXI.Container()
      const lbl = new PIXI.Text({
        text: name,
        style: { fontSize: 9, fill: '#111111', fontFamily: 'monospace', fontWeight: 'bold' },
      })
      lbl.anchor.set(0.5, 0.5)
      const pad = 3
      const bw  = lbl.width  + pad * 2
      const bh  = lbl.height + pad * 2
      const bg  = new PIXI.Graphics()
      bg.roundRect(-bw / 2, -bh / 2, bw, bh, 3).fill({ color: 0xffffff, alpha: 0.9 })
      bg.roundRect(-bw / 2, -bh / 2, bw, bh, 3).stroke({ color: 0x000000, width: 1 })
      c.addChild(bg, lbl)
      c.position.set(cx, cy - SPRITE_SIZE - 4)
      return c
    }

    // ── Exterior walk queue ────────────────────────────────────────────────────
    async function processWalkQueue() {
      try {
        if (walkQueue.length === 0) {
          isWalking = false
          if (pendingScreen) {
            const s = pendingScreen
            pendingScreen = null
            onNodeInteractRef.current(s)
          }
          return
        }
        isWalking = true
        const [tx, ty] = walkQueue.shift()!
        const av = avatar
        if (!av) { currentTile = [tx, ty]; processWalkQueue(); return }

        const targetX  = tx * T + T / 2
        const targetY  = ty * T + T
        const dist     = Math.hypot(targetX - av.x, targetY - av.y)
        const duration = (dist / WALK_PX_PER_S) * 1000

        if (targetX < av.x - 1) av.scale.x = -Math.abs(av.scale.x)
        else if (targetX > av.x + 1) av.scale.x = Math.abs(av.scale.x)

        await tweenLinear(av, targetX, targetY, duration)
        currentTile = [tx, ty]
        _savedTile  = [tx, ty]

        // Touch-pickup: collect requireTouch items when avatar walks onto their tile
        for (const [pid, sprite] of pickupSprites) {
          if (!sprite.visible) continue
          const def = HUB_PICKUP_ITEMS.find(p => p.id === pid)
          if (def?.requireTouch && def.tx === tx && def.ty === ty) {
            sprite.visible = false
            pickedUpRef.current.add(pid)
            for (const [cpid, csprite] of pickupSprites) {
              const cdef = HUB_PICKUP_ITEMS.find(p => p.id === cpid)
              if (cdef?.chain === pid) csprite.visible = true
            }
            onItemPickupRef.current?.(pid, def.questId)
          }
        }

        // Treasure step-on: collect chest when avatar walks onto its tile
        const treasureId = treasureByTile.get(`${tx},${ty}`)
        if (treasureId && !collectedTreasureRef.current.has(treasureId)) {
          collectedTreasureRef.current.add(treasureId)
          treasureByTile.delete(`${tx},${ty}`)
          const tSprite = treasureSprites.get(treasureId)
          if (tSprite) {
            const collectedTex = treasureCollectedTex.get(treasureId)
            if (collectedTex) tSprite.texture = collectedTex  // swap to open/empty tile
            else               tSprite.visible = false         // no collected tile — vanish
          }
          onTreasureStepRef.current?.(treasureId)
        }

        // Update area name on each tile step (works on mobile where pointermove doesn't fire)
        const tilePixX = tx * T + T / 2
        const tilePixY = ty * T + T / 2
        const walkedArea = HUB_AREAS.find(
          a => tilePixX >= a.x && tilePixX < a.x + a.w && tilePixY >= a.y && tilePixY < a.y + a.h
        )
        if (walkedArea) onAreaRef.current(walkedArea.name)

        // Door detection — entering a building triggers interior view
        const door = HUB_DOORS.find(d => d.tx === currentTile[0] && d.ty === currentTile[1])
        if (door) {
          isWalking     = false
          walkQueue     = []
          pendingScreen = null
          onNodeInteractRef.current(`interior:${door.buildingId}`)
          return
        }

        processWalkQueue()
      } catch (e) {
        isWalking = false
        rollbar.error('[HubTownCanvas] processWalkQueue error', { error: String(e) })
      }
    }

    function startWalk(target: [number, number], nodeScreen?: string) {
      for (const s of activeBubbles) bubbleLayer.removeChild(s.container)
      activeBubbles.length = 0
      nextSpawnTimer = 0
      lastMovedMs = performance.now()
      const effectivePathSet = new Set(pathSet)
      for (const bp of HUB_BLOCKED_PATHS) {
        if (!(completedQuestIdsRef?.current.has(bp.questId) ?? false)) {
          for (const [btx, bty] of bp.blockedTiles) effectivePathSet.delete(`${btx},${bty}`)
        }
      }
      const path = findPath(currentTile, target, effectivePathSet)
      walkQueue = path.slice(1)
      pendingScreen = nodeScreen ?? null
      if (!isWalking) processWalkQueue()
    }

    // ── Input ──────────────────────────────────────────────────────────────────
    app.stage.eventMode = 'static'
    app.stage.hitArea   = new PIXI.Rectangle(0, 0, MAP_W, MAP_H)

    function drawTileHighlight(stageX: number, stageY: number) {
      highlightGfx.clear()
      const bw = 2
      highlightGfx.rect(stageX, stageY, T, T).fill({ color: 0x00ff44, alpha: 0.18 })
      highlightGfx.rect(stageX, stageY, T, bw).fill({ color: 0x00ff44, alpha: 1 })
      highlightGfx.rect(stageX, stageY + T - bw, T, bw).fill({ color: 0x00ff44, alpha: 1 })
      highlightGfx.rect(stageX, stageY, bw, T).fill({ color: 0x00ff44, alpha: 1 })
      highlightGfx.rect(stageX + T - bw, stageY, bw, T).fill({ color: 0x00ff44, alpha: 1 })
    }

    app.stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      if (interiorActive) {
        const interior = HUB_INTERIORS[currentInteriorId!]
        if (!interior) return
        const { x, y } = e.getLocalPosition(interiorLayer)
        const tapTx = Math.max(0, Math.min(interior.width - 1, Math.floor(x / T)))
        const tapTy = Math.max(0, Math.min(interior.height - 1, Math.floor(y / T)))
        if (onTileTapRef.current) {
          onTileTapRef.current(tapTx, tapTy)
          drawTileHighlight(intOffX + tapTx * T, intOffY + tapTy * T)
        }
        const target: [number, number] = [tapTx, tapTy]
        if (!interiorWalkable.has(`${tapTx},${tapTy}`)) return
        const path = findInteriorPath(interiorCurrentTile, target, interiorWalkable)
        interiorWalkQueue = path.slice(1)
        if (!interiorIsWalking) processInteriorWalkQueue()
      } else {
        const { x, y } = e.getLocalPosition(app.stage)
        const tapTx = Math.floor(x / T)
        const tapTy = Math.floor(y / T)
        if (onTileTapRef.current) {
          onTileTapRef.current(tapTx, tapTy)
          drawTileHighlight(tapTx * T, tapTy * T)
        }

        // If tap lands on a building tile, route to the nearest door
        if (buildingSet.has(`${tapTx},${tapTy}`)) {
          const nearestDoor = HUB_DOORS.reduce(
            (best, door) => {
              const d = Math.hypot(door.tx - tapTx, door.ty - tapTy)
              return d < best.d ? { door, d } : best
            },
            { door: HUB_DOORS[0], d: Infinity },
          ).door
          startWalk([nearestDoor.tx, nearestDoor.ty])
          return
        }

        const node   = EXTERIOR_NPCS.find(n => n.tx === tapTx && n.ty === tapTy && n.screen)
        const target = nearestWalkable(x, y, pathSet, T)
        startWalk(target, node?.screen)
      }
    })

    app.stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      if (interiorActive) return
      const { x, y } = e.getLocalPosition(app.stage)
      const area = HUB_AREAS.find(
        a => x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h,
      )
      onAreaRef.current(area?.name ?? null)
    })
    app.stage.on('pointerleave', () => { onAreaRef.current(null) })

    // ── Return to courtyard ────────────────────────────────────────────────────
    if (returnRef) returnRef.current = () => {
      if (interiorActive) doExitInterior()
      walkQueue     = []
      pendingScreen = null
      isWalking     = false
      currentTile   = [...AVATAR_START]
      _savedTile    = null
      if (avatar) { avatar.x = COURTYARD_PX.x; avatar.y = COURTYARD_PX.y }
      onAvatarMoveRef.current(COURTYARD_PX.x, COURTYARD_PX.y)
    }

    // ── Per-frame ──────────────────────────────────────────────────────────────
    let _tickerErrorTs = 0
    app.ticker.add((ticker) => {
      try {
      // Avatar animation + position report
      if (avatar) {
        // Report stage-space position (accounts for interior layer offset)
        const reportX = avatarInInterior ? intOffX + avatar.x : avatar.x
        const reportY = avatarInInterior ? intOffY + avatar.y : avatar.y
        onAvatarMoveRef.current(reportX, reportY)

        const walking = isWalking || interiorIsWalking
        if (walking && avatarFrames.length > 0) {
          avatarAnimTimer -= ticker.deltaMS
          if (avatarAnimTimer <= 0) {
            avatarAnimTimer = 200
            avatarAnimFrame = (avatarAnimFrame + 1) % avatarFrames.length
            avatar.texture = avatarFrames[avatarAnimFrame]
          }
        } else if (!walking && avatarBaseTexture && avatar.texture !== avatarBaseTexture) {
          avatar.texture = avatarBaseTexture
          avatarAnimTimer = 0
          avatarAnimFrame = 0
        }
      }

      if (avatar && !avatarInInterior) avatar.zIndex = avatar.y
      for (const npc of unitNpcs) npc.sprite.zIndex = npc.sprite.y
      spriteLayer.sortChildren()
      worldLayer.sortChildren()

      // NPC name tag proximity (exterior only)
      if (!interiorActive) {
        const [atx, aty] = currentTile
        for (const { tx, ty, tag } of npcNameTags) {
          tag.visible = Math.max(Math.abs(tx - atx), Math.abs(ty - aty)) <= 5
        }

        // Blocked path visibility and proximity speech bubbles
        for (const [pathId, entry] of blockedPathEntries) {
          const bp = HUB_BLOCKED_PATHS.find(b => b.id === pathId)
          if (!bp) continue
          const cleared = completedQuestIdsRef?.current.has(bp.questId) ?? false
          for (const s of entry.blockedDecor) s.visible = !cleared
          for (const s of entry.clearedDecor) s.visible = cleared
          for (const n of entry.clearedNpcs) n.root.visible = cleared
          for (const n of entry.blockedNpcs) {
            n.root.visible = !cleared
            const dist = Math.max(Math.abs(n.tx - atx), Math.abs(n.ty - aty))
            const match = n.proximityDialogue
              .filter(p => dist <= p.atDistance)
              .sort((a, b) => a.atDistance - b.atDistance)[0]
            const newText = (!cleared && match) ? match.text : null
            if (newText !== n.lastBubbleText) {
              if (n.bubble) { bubbleLayer.removeChild(n.bubble); n.bubble = null }
              if (newText !== null) {
                const cx = n.tx * T + T / 2
                const cy = n.ty * T + T
                n.bubble = createSpeechBubble(newText, cx, cy)
                bubbleLayer.addChild(n.bubble)
              }
              n.lastBubbleText = newText
            }
          }
        }
      }

      // Quest indicators — update visibility + bounce animation from questNpcState ref
      const activeIndicators = interiorActive ? interiorQuestIndicators : questIndicators
      const activeBaseY      = interiorActive ? interiorIndicatorBaseY  : questIndicatorBaseY
      for (const [npcId, ind] of activeIndicators) {
        const state = questNpcState?.current.get(npcId) ?? null
        ind.visible = state !== null
        ind.text    = state === 'ready' ? '?' : '!'
        if (state !== null) {
          const baseY = activeBaseY.get(npcId) ?? ind.y
          ind.y = baseY + Math.sin(performance.now() / 400) * 3
        }
      }

      // Quest pickup visibility — only show while the associated quest is active
      for (const [pickupId, sprite] of pickupSprites) {
        if (pickedUpRef.current.has(pickupId)) continue
        const questId = pickupQuestIds.get(pickupId)
        sprite.visible = !questId || (activeQuestIdsRef?.current.has(questId) ?? true)
      }

      for (const npc of unitNpcs) {
        if (npc.isWalking && npc.animFrames.length > 0) {
          npc.animTimer -= ticker.deltaMS
          if (npc.animTimer <= 0) {
            npc.animTimer = 200
            npc.animFrame = (npc.animFrame + 1) % npc.animFrames.length
            npc.sprite.texture = npc.animFrames[npc.animFrame]
          }
        } else if (!npc.isWalking && npc.animFrames.length > 0 && npc.animFrame !== 0) {
          npc.sprite.texture = npc.animFrames[0]
          npc.animFrame = 0
          npc.animTimer = 0
        }
        // Ghost glow: pulse alpha
        if (npc.isGhost) {
          npc.sprite.alpha = 0.25 + 0.2 * Math.sin(performance.now() / 600 + npc.currentTile[0])
        }

        if (!npc.isWalking) {
          npc.wanderTimer -= ticker.deltaMS
          if (npc.wanderTimer <= 0) {
            npc.wanderTimer = 2000 + Math.random() * 3000
            wanderNpc(npc)
          }
        }

        // Scared bubble: non-ghost NPCs near a ghost
        if (!npc.isGhost && !interiorActive) {
          const nearbyGhost = unitNpcs.find(g =>
            g.isGhost &&
            Math.max(Math.abs(npc.currentTile[0] - g.currentTile[0]), Math.abs(npc.currentTile[1] - g.currentTile[1])) <= 10
          )
          if (nearbyGhost) {
            if (npc.scaredBubbleCooldown > 0) npc.scaredBubbleCooldown -= ticker.deltaMS
            if (!npc.scaredBubble && npc.scaredBubbleCooldown <= 0) {
              const phrase = SCARED_PHRASES[Math.floor(Math.random() * SCARED_PHRASES.length)]
              const bubble = createSpeechBubble(phrase, npc.sprite.x, npc.sprite.y - SPRITE_SIZE)
              bubble.zIndex = npc.sprite.zIndex + 1
              bubbleLayer.addChild(bubble)
              npc.scaredBubble      = bubble
              npc.scaredBubbleTimer = 10_000
            }
          } else {
            // Ghost left — remove bubble immediately and reset cooldown
            if (npc.scaredBubble) {
              bubbleLayer.removeChild(npc.scaredBubble)
              npc.scaredBubble = null
            }
            npc.scaredBubbleCooldown = 0
          }
          if (npc.scaredBubble) {
            npc.scaredBubbleTimer -= ticker.deltaMS
            npc.scaredBubble.position.set(npc.sprite.x, npc.sprite.y - SPRITE_SIZE)
            if (npc.scaredBubbleTimer <= 0) {
              bubbleLayer.removeChild(npc.scaredBubble)
              npc.scaredBubble         = null
              npc.scaredBubbleTimer    = 0
              npc.scaredBubbleCooldown = 10_000  // don't re-spawn while ghost is still nearby
            }
          }
        }
      }

      // Respawn ambient NPCs to maintain population between TARGET_NPC_COUNT ± a few
      if (!interiorActive && unitNpcs.length < TARGET_NPC_COUNT) {
        respawnTimer -= ticker.deltaMS
        if (respawnTimer <= 0) {
          spawnAmbientNpc()
          respawnTimer = 1500 + Math.random() * 1500  // stagger spawns 1.5–3s apart
        }
      } else {
        respawnTimer = Math.min(respawnTimer, 3000)
      }

      // Idle speech bubble state machine (exterior only)
      if (!interiorActive && npcBubbleTargets.length > 0) {
        const now = performance.now()
        if (isWalking) lastMovedMs = now

        if (now - lastMovedMs >= IDLE_THRESHOLD_MS && activeBubbles.length < MAX_BUBBLES) {
          nextSpawnTimer -= ticker.deltaMS
          if (nextSpawnTimer <= 0) {
            lastBubbleIdx = (lastBubbleIdx + 1) % npcBubbleTargets.length
            const { npc, cx, cy } = npcBubbleTargets[lastBubbleIdx]
            const didx = npcDialogueIndex.get(npc.id) ?? 0
            const line = npc.dialogue[didx % npc.dialogue.length]
            const container = createSpeechBubble(line, cx, cy)
            bubbleLayer.addChild(container)
            activeBubbles.push({ container, timer: BUBBLE_SHOW_MS, phase: 'showing' })
            nextSpawnTimer = SLOT_STAGGER_MS
          }
        }

        for (let i = activeBubbles.length - 1; i >= 0; i--) {
          const slot = activeBubbles[i]
          slot.timer -= ticker.deltaMS
          if (slot.phase === 'showing' && slot.timer <= 0) {
            slot.phase = 'fading'; slot.timer = BUBBLE_FADE_MS
          } else if (slot.phase === 'fading') {
            slot.container.alpha = Math.max(0, slot.timer / BUBBLE_FADE_MS)
            if (slot.timer <= 0) {
              bubbleLayer.removeChild(slot.container)
              activeBubbles.splice(i, 1)
            }
          }
        }
      }
      } catch (e) {
        const now = Date.now()
        if (now - _tickerErrorTs > 5000) {
          _tickerErrorTs = now
          rollbar.error('[HubTownCanvas] ticker error', { error: String(e) })
        }
      }
    })
  })

  return (
    <div
      ref={containerRef}
      style={{ display: 'block', flexShrink: 0, width: MAP_W, height: MAP_H }}
    />
  )
}
