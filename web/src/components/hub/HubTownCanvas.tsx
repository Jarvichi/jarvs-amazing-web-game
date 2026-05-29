import React, { useRef } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../hooks/usePixiApp'
import { buildTerrainGfx, buildBgTileGfx, buildDecorGfx } from '../../utils/terrainLayer'
import { renderPathTiles } from '../../utils/tileLookup'
import { loadSpriteTexture, loadTextureUrl, loadAnimFrames } from '../../utils/pixiHelpers'
import { PATH_TILE } from '../../data/tiles/tileIndex'
import { findPath, nearestWalkable } from '../../utils/hubPathfinder'
import {
  MAP_W, MAP_H,
  HUB_AREAS,
  HUB_BUILDING_TILES,
  HUB_NODES,
  HUB_STREET_TILES,
  AVATAR_START,
} from '../../data/hubLayout'
import { QUEST_GIVER_NPCS, NPC_SPAWN_TILES } from '../../data/hubNpcs'
import { HUB_DOORS } from '../../data/hubInteriors'
import { loadPlayerAvatar } from '../../game/questline'

const HUB_ENV       = 'camp'
const T             = 32
const WALK_PX_PER_S = 160   // pixels per second
const COURTYARD_PX  = { x: AVATAR_START[0] * T + T / 2, y: AVATAR_START[1] * T + T / 2 }

const NODE_GLOW   = 0x44aa44
const NODE_FILL   = 0x1e2e1e
const NODE_STROKE = 0x88cc88

interface Props {
  onAreaEnter:    (areaName: string | null) => void
  onNodeInteract: (screen: string) => void
  onAvatarMove:   (px: number, py: number) => void
  returnRef?:     React.MutableRefObject<(() => void) | null>
  unitCards?:     string[]
  onNpcTap?:      (dialogue: string) => void
}

export function HubTownCanvas({ onAreaEnter, onNodeInteract, onAvatarMove, returnRef, unitCards, onNpcTap }: Props) {
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

  usePixiApp(containerRef, MAP_W, MAP_H, (app) => {
    app.canvas.style.touchAction = 'pan-x pan-y'

    // ── Layer hierarchy ────────────────────────────────────────────────────────
    const groundLayer   = new PIXI.Container()
    const streetLayer   = new PIXI.Container()
    const buildingLayer = new PIXI.Container()
    const nodeLayer     = new PIXI.Container()
    const npcLayer      = new PIXI.Container()
    const avatarLayer   = new PIXI.Container()
    const worldLayer    = new PIXI.Container()
    worldLayer.sortableChildren = true
    app.stage.addChild(groundLayer, streetLayer, buildingLayer, nodeLayer, npcLayer, avatarLayer, worldLayer)

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
      // Deep water fill
      g.ellipse(px, py, 112, 56).fill({ color: 0x1a3a6a, alpha: 0.92 })
      // Mid-water shimmer
      g.ellipse(px, py, 96, 44).fill({ color: 0x1e5090, alpha: 0.7 })
      // Highlight
      g.ellipse(px - 24, py - 12, 32, 14).fill({ color: 0x5ab4e8, alpha: 0.22 })
      // Shore fringe
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

    // ── Location nodes ─────────────────────────────────────────────────────────
    for (const node of HUB_NODES) {
      const cx = node.tx * T + T / 2
      const cy = node.ty * T + T / 2

      const g = new PIXI.Graphics()
      g.ellipse(cx, cy, 16, 10).fill({ color: NODE_GLOW, alpha: 0.18 })
      g.ellipse(cx, cy, 11, 7).fill({ color: NODE_FILL })
      g.ellipse(cx, cy, 11, 7).stroke({ color: NODE_STROKE, width: 1.5 })
      g.ellipse(cx - 3, cy - 2, 4, 2.5).fill({ color: NODE_STROKE, alpha: 0.45 })
      nodeLayer.addChild(g)

      const label = new PIXI.Text({
        text: node.label,
        style: { fontSize: 9, fill: '#c8e8c8', fontFamily: 'monospace', align: 'center' },
      })
      label.anchor.set(0.5, 1)
      label.position.set(cx, cy - 13)
      nodeLayer.addChild(label)
    }

    // ── Avatar ─────────────────────────────────────────────────────────────────
    let avatar: PIXI.Sprite | null = null
    let avatarFrames: PIXI.Texture[] = []
    let avatarBaseTexture: PIXI.Texture | null = null
    let avatarAnimTimer = 0
    let avatarAnimFrame = 0
    const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
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
      s.position.set(COURTYARD_PX.x, COURTYARD_PX.y)
      avatarLayer.addChild(s)
      avatar = s
    }).catch(e => console.error('[HubTownCanvas] avatar load failed', e))

    // ── Quest-giver NPCs ───────────────────────────────────────────────────────
    for (const npc of QUEST_GIVER_NPCS) {
      const cx = npc.tx * T + T / 2
      const cy = npc.ty * T + T / 2

      const npcContainer = new PIXI.Container()
      npcContainer.eventMode = 'static'
      npcContainer.cursor    = 'pointer'
      npcContainer.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
        e.stopPropagation()
        if (npc.screen) {
          onNodeInteractRef.current(npc.screen)
        } else {
          onNpcTapRef.current?.(npc.dialogue)
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

      // "!" for dialogue NPCs, "▶" arrow for shop NPCs
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

    if (cards.length > 0) {
      const spawnCount = Math.min(NPC_SPAWN_TILES.length, cards.length * 3)  // allow repeats up to 3x
      const slots = NPC_SPAWN_TILES.slice(0, Math.min(spawnCount, NPC_SPAWN_TILES.length))

      slots.forEach(([tx, ty], i) => {
        const cardName = cards[i % cards.length]
        const cx = tx * T + T / 2
        const cy = ty * T + T / 2

        loadSpriteTexture(cardName)
          .catch(() => loadTextureUrl(`${base}sprites/hub-avatar.svg`))
          .then(tex => {
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
              wanderTimer: 500 + Math.random() * 500,   // initial delay 0.5–1 s
              animFrames:  [],
              animTimer:   0,
              animFrame:   0,
            }
            unitNpcs.push(state)

            loadAnimFrames(cardName, 3)
              .then(frames => { state.animFrames = frames })
              .catch(() => { /* no walk animation */ })
          })
      })
    }

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

    // ── Walk state ─────────────────────────────────────────────────────────────
    let currentTile: [number, number] = [...AVATAR_START]
    let walkQueue:   [number, number][] = []
    let isWalking    = false
    let pendingScreen: string | null = null

    // Linear tween (constant speed — no ease-in/out — for smooth chained walking).
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

      // Flip sprite to face walk direction
      if (targetX < av.x - 1) av.scale.x = -1
      else if (targetX > av.x + 1) av.scale.x = 1

      await tweenLinear(av, targetX, targetY, duration)
      currentTile = [tx, ty]

      // Door detection — entering a building triggers interior view
      const door = HUB_DOORS.find(d => d.tx === currentTile[0] && d.ty === currentTile[1])
      if (door) {
        isWalking = false
        walkQueue = []
        pendingScreen = null
        onNodeInteractRef.current(`interior:${door.buildingId}`)
        return
      }

      processWalkQueue()
    }

    function startWalk(target: [number, number], nodeScreen?: string) {
      const path = findPath(currentTile, target, pathSet)
      walkQueue = path.slice(1)    // drop start tile (avatar is already there)
      pendingScreen = nodeScreen ?? null
      if (!isWalking) processWalkQueue()
    }

    // ── Input ──────────────────────────────────────────────────────────────────
    app.stage.eventMode = 'static'
    app.stage.hitArea   = new PIXI.Rectangle(0, 0, MAP_W, MAP_H)

    app.stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      const { x, y } = e.getLocalPosition(app.stage)
      const tapTx = Math.floor(x / T)
      const tapTy = Math.floor(y / T)

      const node = HUB_NODES.find(n => n.tx === tapTx && n.ty === tapTy)
      const target = nearestWalkable(x, y, pathSet, T)
      startWalk(target, node?.screen)
    })

    app.stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
      const { x, y } = e.getLocalPosition(app.stage)
      const area = HUB_AREAS.find(
        a => x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h,
      )
      onAreaRef.current(area?.name ?? null)
    })
    app.stage.on('pointerleave', () => { onAreaRef.current(null) })

    // ── Return to courtyard ────────────────────────────────────────────────────
    if (returnRef) returnRef.current = () => {
      walkQueue     = []
      pendingScreen = null
      isWalking     = false
      currentTile   = [...AVATAR_START]
      if (avatar) { avatar.x = COURTYARD_PX.x; avatar.y = COURTYARD_PX.y }
      onAvatarMoveRef.current(COURTYARD_PX.x, COURTYARD_PX.y)
    }

    // ── Per-frame ──────────────────────────────────────────────────────────────
    app.ticker.add((ticker) => {
      // Avatar animation + position report
      if (avatar) {
        onAvatarMoveRef.current(avatar.x, avatar.y)
        if (isWalking && avatarFrames.length > 0) {
          avatarAnimTimer -= ticker.deltaMS
          if (avatarAnimTimer <= 0) {
            avatarAnimTimer = 200
            avatarAnimFrame = (avatarAnimFrame + 1) % avatarFrames.length
            avatar.texture = avatarFrames[avatarAnimFrame]
          }
        } else if (!isWalking && avatarBaseTexture && avatar.texture !== avatarBaseTexture) {
          avatar.texture = avatarBaseTexture
          avatarAnimTimer = 0
          avatarAnimFrame = 0
        }
      }

      worldLayer.sortChildren()

      for (const npc of unitNpcs) {
        // Walk animation
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
        // Wander
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
