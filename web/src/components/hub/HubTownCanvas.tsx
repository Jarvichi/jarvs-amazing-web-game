import React, { useRef } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../hooks/usePixiApp'
import { buildTerrainGfx, buildBgTileGfx, buildDecorGfx } from '../../utils/terrainLayer'
import { renderPathTiles } from '../../utils/tileLookup'
import { loadSpriteTexture, loadTextureUrl, loadAnimFrames, loadTileTexture } from '../../utils/pixiHelpers'
import { PATH_TILE, TILESET_IMAGE, TILESET_COLUMNS } from '../../data/tiles/tileIndex'
import { findPath, nearestWalkable } from '../../utils/hubPathfinder'
import { MAP_W, MAP_H, HUB_AREAS, HUB_BUILDING_TILES, HUB_STREET_TILES, AVATAR_START } from '../../data/hubLayout'
import { NPC_SPAWN_TILES, AMBIENT_NPC_SPRITES, EXTERIOR_NPCS, INTERIOR_NPCS } from '../../data/hubNpcs'
import { HUB_DOORS, HUB_INTERIORS } from '../../data/hubInteriors'
import { EXTERIOR_DECOR } from '../../data/hubConfigLoader'
import { loadPlayerAvatar } from '../../game/questline'
import type { HubNpc } from '../../data/hubConfigLoader'

const HUB_ENV       = 'camp'
const T             = 32
const WALK_PX_PER_S = 160
const COURTYARD_PX  = { x: AVATAR_START[0] * T + T / 2, y: AVATAR_START[1] * T + T / 2 }

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
  onNpcTap?:        (dialogue: string) => void
  interiorEnterRef?: React.MutableRefObject<((buildingId: string) => void) | null>
  interiorExitRef?:  React.MutableRefObject<(() => void) | null>
  onExitInterior?:   () => void
}

export function HubTownCanvas({
  onAreaEnter, onNodeInteract, onAvatarMove,
  returnRef, unitCards, onNpcTap,
  interiorEnterRef, interiorExitRef, onExitInterior,
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
  const onExitInteriorRef = useRef(onExitInterior)
  onExitInteriorRef.current = onExitInterior

  usePixiApp(containerRef, MAP_W, MAP_H, (app) => {
    app.canvas.style.touchAction = 'pan-x pan-y'

    // ── Layer hierarchy ────────────────────────────────────────────────────────
    const groundLayer        = new PIXI.Container()
    const streetLayer        = new PIXI.Container()
    const exteriorDecorLayer = new PIXI.Container()
    const buildingLayer      = new PIXI.Container()
    const nodeLayer          = new PIXI.Container()
    const npcLayer           = new PIXI.Container()
    const avatarLayer        = new PIXI.Container()
    const worldLayer         = new PIXI.Container()
    const interiorLayer      = new PIXI.Container()  // top-most; hidden except when in a building
    worldLayer.sortableChildren = true
    interiorLayer.visible = false
    app.stage.addChild(groundLayer, streetLayer, exteriorDecorLayer, buildingLayer, nodeLayer, npcLayer, avatarLayer, worldLayer, interiorLayer)

    const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL

    // ── Terrain ────────────────────────────────────────────────────────────────
    const baseContainer  = new PIXI.Container()
    const riverContainer = new PIXI.Container()
    groundLayer.addChild(baseContainer, riverContainer)

    buildTerrainGfx(baseContainer, riverContainer, worldLayer,
      { environment: HUB_ENV, id: 'hubworld' }, MAP_W, MAP_H)
    buildBgTileGfx(baseContainer, { environment: HUB_ENV }, MAP_W, MAP_H)
      .catch(e => console.error('[HubTownCanvas] bg tiles failed', e))
    buildDecorGfx(groundLayer, { environment: HUB_ENV, id: 'hubworld' }, MAP_W, MAP_H)
      .catch(e => console.error('[HubTownCanvas] decor tiles failed', e))

    // ── Pond (Greyfish Pond — SW district, between building blocks) ───────────
    {
      const g = new PIXI.Graphics()
      const px = 5 * T, py = 34 * T + T / 2
      g.ellipse(px, py, 112, 56).fill({ color: 0x1a3a6a, alpha: 0.92 })
      g.ellipse(px, py, 96, 44).fill({ color: 0x1e5090, alpha: 0.7 })
      g.ellipse(px - 24, py - 12, 32, 14).fill({ color: 0x5ab4e8, alpha: 0.22 })
      g.ellipse(px, py, 112, 56).stroke({ color: 0x2a6aaa, width: 2.5, alpha: 0.8 })
      groundLayer.addChild(g)
    }

    // ── Streets ────────────────────────────────────────────────────────────────
    const pathSet = new Set(HUB_STREET_TILES.map(([tx, ty]) => `${tx},${ty}`))
    renderPathTiles(streetLayer, pathSet, HUB_ENV)
      .catch(e => console.error('[HubTownCanvas] street tiles failed', e))

    // ── Buildings ──────────────────────────────────────────────────────────────
    const buildingSet = new Set(HUB_BUILDING_TILES.map(([tx, ty]) => `${tx},${ty}`))
    renderPathTiles(buildingLayer, buildingSet, undefined, PATH_TILE.wall2)
      .catch(e => console.error('[HubTownCanvas] building tiles failed', e))

    // ── Exterior decor (tile sprites over streets/ground) ─────────────────────
    {
      const baseChipUrl = `${base}${TILESET_IMAGE.baseChip.slice(1)}`
      const extByTile = new Map<number, [number, number][]>()
      for (const d of EXTERIOR_DECOR) {
        if (d.tileId === 666) continue
        const list = extByTile.get(d.tileId) ?? []
        list.push([d.tx, d.ty])
        extByTile.set(d.tileId, list)
      }
      for (const [tileId, positions] of extByTile) {
        loadTileTexture(baseChipUrl, tileId, TILESET_COLUMNS.baseChip).then(tex => {
          if (app.renderer == null) return
          for (const [tx, ty] of positions) {
            const s = new PIXI.Sprite(tex)
            s.position.set(tx * T, ty * T)
            s.width = T; s.height = T
            exteriorDecorLayer.addChild(s)
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
      s.width = T; s.height = T
      s.anchor.set(0.5, 0.5)
      if (interiorActive) {
        s.position.set(interiorCurrentTile[0] * T + T / 2, interiorCurrentTile[1] * T + T / 2)
        interiorLayer.addChild(s)
        avatarInInterior = true
      } else {
        const startTile: [number, number] = _savedTile ? [..._savedTile] : [...AVATAR_START]
        currentTile = startTile
        s.position.set(startTile[0] * T + T / 2, startTile[1] * T + T / 2)
        avatarLayer.addChild(s)
      }
      avatar = s
    }).catch(e => console.error('[HubTownCanvas] avatar load failed', e))

    // ── NPC dialogue index (shared across exterior and interior NPCs) ──────────
    const npcDialogueIndex = new Map<string, number>()

    // ── Exterior NPCs ─────────────────────────────────────────────────────────
    for (const npc of EXTERIOR_NPCS) {
      const cx = npc.tx * T + T / 2
      const cy = npc.ty * T + T / 2

      const npcContainer = new PIXI.Container()
      npcContainer.eventMode = 'static'
      npcContainer.cursor    = 'pointer'
      npcContainer.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation()
        if (npc.screen) {
          onNodeInteractRef.current(npc.screen)
        } else if (npc.dialogue.length > 0) {
          const idx = npcDialogueIndex.get(npc.id) ?? 0
          onNpcTapRef.current?.(npc.dialogue[idx % npc.dialogue.length])
          npcDialogueIndex.set(npc.id, idx + 1)
        }
      })
      npcLayer.addChild(npcContainer)

      loadTextureUrl(`${base}sprites/${npc.sprite}.svg`).then(tex => {
        if (app.renderer == null) return
        const s = new PIXI.Sprite(tex)
        s.width = T; s.height = T
        s.anchor.set(0.5, 0.5)
        s.position.set(cx, cy)
        npcContainer.addChild(s)
      }).catch(e => console.error(`[HubTownCanvas] NPC sprite failed: ${npc.sprite}`, e))

      const indicator = new PIXI.Text({
        text:  npc.screen ? '▶' : '!',
        style: { fontSize: 10, fill: npc.screen ? '#88ddff' : '#ffdd44', fontFamily: 'monospace', fontWeight: 'bold' },
      })
      indicator.anchor.set(0.5, 1)
      indicator.position.set(cx, cy - T / 2 - 2)
      npcLayer.addChild(indicator)
    }

    // ── Card-unit NPCs ─────────────────────────────────────────────────────────
    interface UnitNpcState {
      sprite:      PIXI.Sprite
      currentTile: [number, number]
      walkQueue:   [number, number][]
      isWalking:   boolean
      wanderTimer: number
      animFrames:  PIXI.Texture[]
      animTimer:   number
      animFrame:   number
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
      const cy = ty * T + T / 2

      const texPromise = cards.length > 0
        ? loadSpriteTexture(slug).catch(() => loadTextureUrl(`${base}sprites/hub-avatar.svg`))
        : loadTextureUrl(`${base}sprites/${slug}.svg`).catch(() => loadTextureUrl(`${base}sprites/hub-avatar.svg`))

      texPromise.then(tex => {
        if (app.renderer == null) return
        const s = new PIXI.Sprite(tex)
        s.width = T; s.height = T
        s.anchor.set(0.5, 0.5)
        s.position.set(cx, cy)
        s.alpha = 0.85
        npcLayer.addChild(s)

        const state: UnitNpcState = {
          sprite:      s,
          currentTile: [tx, ty],
          walkQueue:   [],
          isWalking:   false,
          wanderTimer: 500 + Math.random() * 500,
          animFrames:  [],
          animTimer:   0,
          animFrame:   0,
        }
        unitNpcs.push(state)

        loadAnimFrames(slug, 3)
          .then(frames => { state.animFrames = frames })
          .catch(() => {})
      })
    })

    async function processNpcWalkQueue(npc: UnitNpcState) {
      if (npc.walkQueue.length === 0) { npc.isWalking = false; return }
      npc.isWalking = true
      const [tx, ty] = npc.walkQueue.shift()!
      const targetX  = tx * T + T / 2
      const targetY  = ty * T + T / 2
      const dist     = Math.hypot(targetX - npc.sprite.x, targetY - npc.sprite.y)
      const duration = (dist / WALK_PX_PER_S) * 1000
      if (targetX < npc.sprite.x - 1) npc.sprite.scale.x = -Math.abs(npc.sprite.scale.x)
      else if (targetX > npc.sprite.x + 1) npc.sprite.scale.x = Math.abs(npc.sprite.scale.x)
      await tweenLinear(npc.sprite, targetX, targetY, duration)
      npc.currentTile = [tx, ty]
      processNpcWalkQueue(npc)
    }

    function wanderNpc(npc: UnitNpcState) {
      const options = NPC_SPAWN_TILES.filter(
        ([tx, ty]) => tx !== npc.currentTile[0] || ty !== npc.currentTile[1],
      ) as [number, number][]
      if (options.length === 0) return
      const target = options[Math.floor(Math.random() * options.length)]
      const path   = findPath(npc.currentTile, target, pathSet)
      npc.walkQueue = path.slice(1)
      if (!npc.isWalking) processNpcWalkQueue(npc)
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

      // Move avatar back to exterior door position
      if (avatar && avatarInInterior) {
        interiorLayer.removeChild(avatar)
        avatarLayer.addChild(avatar)
        avatarInInterior = false
        const door = HUB_DOORS.find(d => d.buildingId === currentInteriorId)
        if (door) {
          avatar.x = door.tx * T + T / 2
          avatar.y = door.ty * T + T / 2
          currentTile = [door.tx, door.ty]
        }
        onAvatarMoveRef.current(avatar.x, avatar.y)
      }

      interiorLayer.visible = false
      interiorLayer.removeChildren()
      currentInteriorId = null
      onExitInteriorRef.current?.()
    }

    // ── Interior enter ─────────────────────────────────────────────────────────
    const doEnterInterior = (buildingId: string) => {
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
      for (const d of interior.decor) interiorWalkable.delete(`${d.tx},${d.ty}`)

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

      // Walls: stone/brick border using path tile system
      renderPathTiles(wallContainer, wallSet, undefined, PATH_TILE.wall2)
        .catch(() => { /* wall tiles optional */ })

      // Decor — tile sprites from base chip sheet
      const decorContainer = new PIXI.Container()
      interiorLayer.addChild(decorContainer)
      const byTileId = new Map<number, [number, number][]>()
      for (const d of interior.decor) {
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
            decorContainer.addChild(s)
          }
        }).catch(() => {})
      }

      // Interior NPCs — rendered inside the room, tappable
      const interiorNpcList: HubNpc[] = INTERIOR_NPCS[buildingId] ?? []
      for (const npc of interiorNpcList) {
        loadTextureUrl(`${base}sprites/${npc.sprite}.svg`).then(tex => {
          if (!interiorActive || currentInteriorId !== buildingId) return
          const s = new PIXI.Sprite(tex)
          s.width = T; s.height = T
          s.anchor.set(0.5, 0.5)
          s.position.set(npc.tx * T + T / 2, npc.ty * T + T / 2)
          s.eventMode = 'static'
          s.cursor    = 'pointer'
          s.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
            e.stopPropagation()
            if (npc.screen) {
              onNodeInteractRef.current(npc.screen)
            } else if (npc.dialogue.length > 0) {
              const idx = npcDialogueIndex.get(npc.id) ?? 0
              onNpcTapRef.current?.(npc.dialogue[idx % npc.dialogue.length])
              npcDialogueIndex.set(npc.id, idx + 1)
            }
          })
          const indicator = new PIXI.Text({
            text:  npc.screen ? '▶' : '!',
            style: { fontSize: 10, fill: npc.screen ? '#88ddff' : '#ffdd44', fontFamily: 'monospace', fontWeight: 'bold' },
          })
          indicator.anchor.set(0.5, 1)
          indicator.position.set(npc.tx * T + T / 2, npc.ty * T - 2)
          interiorLayer.addChild(s, indicator)
        }).catch(() => {})
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

      // Move avatar into interior (on top of everything else)
      if (avatar) {
        if (!avatarInInterior) avatarLayer.removeChild(avatar)
        avatar.x = entryTile[0] * T + T / 2
        avatar.y = entryTile[1] * T + T / 2
        interiorLayer.addChild(avatar)
        avatarInInterior = true
      }

      // Scroll viewport to center on interior
      onAvatarMoveRef.current(intOffX + entryTile[0] * T + T / 2, intOffY + entryTile[1] * T + T / 2)
    }

    if (interiorEnterRef) interiorEnterRef.current = doEnterInterior
    if (interiorExitRef)  interiorExitRef.current  = doExitInterior

    // ── Interior walk queue ────────────────────────────────────────────────────
    async function processInteriorWalkQueue() {
      if (interiorWalkQueue.length === 0) { interiorIsWalking = false; return }
      interiorIsWalking = true
      const [ntx, nty] = interiorWalkQueue.shift()!
      const px = ntx * T + T / 2
      const py = nty * T + T / 2
      const av = avatar
      if (!av) { interiorCurrentTile = [ntx, nty]; processInteriorWalkQueue(); return }
      if (px < av.x - 1) av.scale.x = -1
      else if (px > av.x + 1) av.scale.x = 1
      const dist = Math.hypot(px - av.x, py - av.y)
      await tweenLinear(av, px, py, (dist / WALK_PX_PER_S) * 1000)
      interiorCurrentTile = [ntx, nty]
      if (ntx === interiorExitTile[0] && nty === interiorExitTile[1]) {
        interiorIsWalking = false
        doExitInterior()
        return
      }
      processInteriorWalkQueue()
    }

    // ── Exterior walk queue ────────────────────────────────────────────────────
    async function processWalkQueue() {
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
      const targetY  = ty * T + T / 2
      const dist     = Math.hypot(targetX - av.x, targetY - av.y)
      const duration = (dist / WALK_PX_PER_S) * 1000

      if (targetX < av.x - 1) av.scale.x = -1
      else if (targetX > av.x + 1) av.scale.x = 1

      await tweenLinear(av, targetX, targetY, duration)
      currentTile = [tx, ty]
      _savedTile  = [tx, ty]

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
    }

    function startWalk(target: [number, number], nodeScreen?: string) {
      const path = findPath(currentTile, target, pathSet)
      walkQueue = path.slice(1)
      pendingScreen = nodeScreen ?? null
      if (!isWalking) processWalkQueue()
    }

    // ── Input ──────────────────────────────────────────────────────────────────
    app.stage.eventMode = 'static'
    app.stage.hitArea   = new PIXI.Rectangle(0, 0, MAP_W, MAP_H)

    app.stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      if (interiorActive) {
        const interior = HUB_INTERIORS[currentInteriorId!]
        if (!interior) return
        const { x, y } = e.getLocalPosition(interiorLayer)
        const tapTx = Math.max(0, Math.min(interior.width - 1, Math.floor(x / T)))
        const tapTy = Math.max(0, Math.min(interior.height - 1, Math.floor(y / T)))
        const target: [number, number] = [tapTx, tapTy]
        if (!interiorWalkable.has(`${tapTx},${tapTy}`)) return
        const path = findInteriorPath(interiorCurrentTile, target, interiorWalkable)
        interiorWalkQueue = path.slice(1)
        if (!interiorIsWalking) processInteriorWalkQueue()
      } else {
        const { x, y } = e.getLocalPosition(app.stage)
        const tapTx = Math.floor(x / T)
        const tapTy = Math.floor(y / T)

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
    app.ticker.add((ticker) => {
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

      worldLayer.sortChildren()

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
        if (!npc.isWalking) {
          npc.wanderTimer -= ticker.deltaMS
          if (npc.wanderTimer <= 0) {
            npc.wanderTimer = 2000 + Math.random() * 3000
            wanderNpc(npc)
          }
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
