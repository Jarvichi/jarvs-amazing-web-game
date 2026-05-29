import React, { useRef } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../hooks/usePixiApp'
import { HUB_INTERIORS, InteriorDecor } from '../../data/hubInteriors'
import { loadPlayerAvatar } from '../../game/questline'
import { loadTextureUrl, loadAnimFrames } from '../../utils/pixiHelpers'

const T             = 32
const WALK_PX_PER_S = 128

interface Props {
  buildingId: string
  onExit: () => void
}

function drawDecorPiece(g: PIXI.Graphics, decor: InteriorDecor): void {
  const x = decor.tx * T
  const y = decor.ty * T
  const col = decor.color
  switch (decor.type) {
    case 'shelf':
      g.rect(x + 2, y + 4, T - 4, T - 12).fill(col ?? 0x8b5e3c)
      g.rect(x + 2, y + 4, T - 4, 4).fill(col !== undefined ? Math.min(col + 0x222222, 0xffffff) : 0xaa7744)
      break
    case 'table':
      g.rect(x + 4, y + 8, T - 8, T - 16).fill(col ?? 0x9b6f4a)
      g.rect(x + 4, y + 8, T - 8, 3).fill(col !== undefined ? Math.min(col + 0x111111, 0xffffff) : 0xbb8855)
      break
    case 'counter':
      g.rect(x + 2, y + 10, T - 4, T - 14).fill(col ?? 0x7a5c38)
      g.rect(x + 2, y + 10, T - 4, 4).fill(col !== undefined ? Math.min(col + 0x222222, 0xffffff) : 0xaa8855)
      break
    case 'barrel':
      g.ellipse(x + T / 2, y + T / 2, 10, 13).fill(col ?? 0x6b4c2a)
      g.ellipse(x + T / 2, y + T / 2, 10, 13).stroke({ color: 0x3d2b15, width: 1.5 })
      g.rect(x + T / 2 - 10, y + T / 2 - 2, 20, 2).fill(0x3d2b15)
      break
    case 'chest':
      g.rect(x + 3, y + 8, T - 6, T - 14).fill(col ?? 0x7a5c38)
      g.rect(x + 3, y + 8, T - 6, 5).fill(col !== undefined ? Math.min(col + 0x111111, 0xffffff) : 0xaa8040)
      g.rect(x + T / 2 - 3, y + 10, 6, 6).fill(0xddaa22)
      break
    case 'desk':
      g.rect(x + 2, y + 6, T - 4, T - 10).fill(col ?? 0x6b8b3c)
      g.rect(x + 2, y + 6, T - 4, 3).fill(col !== undefined ? Math.min(col + 0x111111, 0xffffff) : 0x88aa55)
      g.rect(x + 4, y + 9, T - 8, T - 16).fill(0x111a0a)
      break
    case 'bed':
      g.rect(x + 2, y + 4, T - 4, T - 8).fill(col ?? 0x335588)
      g.rect(x + 2, y + 4, T - 4, 8).fill(col !== undefined ? Math.min(col + 0x222222, 0xffffff) : 0x556688)
      g.rect(x + 4, y + 6, T - 8, 4).fill(0xeeeeff)
      break
    case 'fireplace':
      g.rect(x + 4, y + 4, T - 8, T - 8).fill(0x3a2010)
      g.rect(x + 6, y + 12, T - 12, T - 18).fill(col ?? 0xcc4400)
      g.rect(x + 8, y + 14, 4, 6).fill(0xffaa22)
      g.rect(x + 14, y + 15, 4, 5).fill(0xff8800)
      break
  }
}

export function HubInteriorCanvas({ buildingId, onExit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const interior = HUB_INTERIORS[buildingId]
  const W = interior ? interior.width * T : T
  const H = interior ? interior.height * T : T

  usePixiApp(containerRef, W, H, (app) => {
    if (!interior) { onExit(); return }

    // ── Floor ──────────────────────────────────────────────────────────────────
    const floor = new PIXI.Graphics()
    for (let tx = 1; tx < interior.width - 1; tx++) {
      for (let ty = 1; ty < interior.height - 1; ty++) {
        const shade = ((tx + ty) % 2 === 0) ? 0x7c6e4a : 0x6e6040
        floor.rect(tx * T, ty * T, T, T).fill(shade)
      }
    }
    app.stage.addChild(floor)

    // ── Walls ──────────────────────────────────────────────────────────────────
    const walls = new PIXI.Graphics()
    for (let tx = 0; tx < interior.width; tx++) {
      walls.rect(tx * T, 0, T, T).fill(0x3a2e1e)
      walls.rect(tx * T, (interior.height - 1) * T, T, T).fill(0x3a2e1e)
    }
    for (let ty = 1; ty < interior.height - 1; ty++) {
      walls.rect(0, ty * T, T, T).fill(0x3a2e1e)
      walls.rect((interior.width - 1) * T, ty * T, T, T).fill(0x3a2e1e)
    }
    // Exit door — opening in south wall
    const exitTx = Math.floor(interior.width / 2)
    walls.rect(exitTx * T, (interior.height - 1) * T, T, T).fill(0x5a4a2a)
    app.stage.addChild(walls)

    // ── Decor ──────────────────────────────────────────────────────────────────
    const decorGfx = new PIXI.Graphics()
    for (const d of interior.decor) drawDecorPiece(decorGfx, d)
    app.stage.addChild(decorGfx)

    // ── Labels ─────────────────────────────────────────────────────────────────
    const nameLabel = new PIXI.Text({
      text: interior.name,
      style: { fontSize: 10, fill: '#c8e8c8', fontFamily: 'monospace' },
    })
    nameLabel.position.set(T + 4, 4)
    app.stage.addChild(nameLabel)

    const exitMarker = new PIXI.Text({
      text: '▼ EXIT',
      style: { fontSize: 8, fill: '#88ff88', fontFamily: 'monospace', fontWeight: 'bold' },
    })
    exitMarker.anchor.set(0.5, 0)
    exitMarker.position.set(exitTx * T + T / 2, (interior.height - 1) * T + 2)
    app.stage.addChild(exitMarker)

    // ── Walkable set ───────────────────────────────────────────────────────────
    const walkable = new Set<string>()
    for (let tx = 1; tx < interior.width - 1; tx++)
      for (let ty = 1; ty < interior.height - 1; ty++)
        walkable.add(`${tx},${ty}`)
    walkable.add(`${exitTx},${interior.height - 1}`)
    for (const d of interior.decor) walkable.delete(`${d.tx},${d.ty}`)

    // BFS pathfinder
    function findPath(from: [number, number], to: [number, number]): [number, number][] {
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

    // ── Avatar ─────────────────────────────────────────────────────────────────
    const base = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
    const slug = loadPlayerAvatar()
    let avatar: PIXI.Sprite | null = null
    let avatarFrames: PIXI.Texture[] = []
    let avatarBaseTexture: PIXI.Texture | null = null
    let avatarAnimTimer = 0
    let avatarAnimFrame = 0
    let currentTile: [number, number] = [exitTx, interior.height - 2]
    let walkQueue: [number, number][] = []
    let isWalking = false

    Promise.all([
      loadTextureUrl(`${base}sprites/${slug}.svg`),
      loadAnimFrames(slug, 3).catch(() => [] as PIXI.Texture[]),
    ]).then(([baseTex, frames]) => {
      if (app.renderer == null) return
      avatarBaseTexture = baseTex
      avatarFrames = frames
      const s = new PIXI.Sprite(baseTex)
      s.width = T; s.height = T
      s.anchor.set(0.5, 0.5)
      s.position.set(currentTile[0] * T + T / 2, currentTile[1] * T + T / 2)
      app.stage.addChild(s)
      avatar = s
    }).catch(() => { /* avatar optional */ })

    function tweenLinear(obj: PIXI.Container, tx: number, ty: number, ms: number): Promise<void> {
      return new Promise(resolve => {
        if (ms <= 0) { obj.x = tx; obj.y = ty; resolve(); return }
        const sx = obj.x, sy = obj.y
        let elapsed = 0
        const tick = (ticker: PIXI.Ticker) => {
          elapsed += ticker.deltaMS
          const t = Math.min(elapsed / ms, 1)
          obj.x = sx + (tx - sx) * t
          obj.y = sy + (ty - sy) * t
          if (t >= 1) { app.ticker.remove(tick); resolve() }
        }
        app.ticker.add(tick)
      })
    }

    async function processWalkQueue() {
      if (walkQueue.length === 0) { isWalking = false; return }
      isWalking = true
      const [ntx, nty] = walkQueue.shift()!
      const px = ntx * T + T / 2
      const py = nty * T + T / 2
      const av = avatar
      if (!av) { currentTile = [ntx, nty]; processWalkQueue(); return }
      if (px < av.x - 1) av.scale.x = -1
      else if (px > av.x + 1) av.scale.x = 1
      const dist = Math.hypot(px - av.x, py - av.y)
      await tweenLinear(av, px, py, (dist / WALK_PX_PER_S) * 1000)
      currentTile = [ntx, nty]
      if (ntx === exitTx && nty === interior.height - 1) {
        isWalking = false
        onExit()
        return
      }
      processWalkQueue()
    }

    // ── Input ──────────────────────────────────────────────────────────────────
    app.stage.eventMode = 'static'
    app.stage.hitArea   = new PIXI.Rectangle(0, 0, W, H)
    app.stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
      const { x, y } = e.getLocalPosition(app.stage)
      const tapTx = Math.max(1, Math.min(interior.width - 1, Math.floor(x / T)))
      const tapTy = Math.max(1, Math.min(interior.height - 1, Math.floor(y / T)))
      const target: [number, number] = [tapTx, tapTy]
      if (!walkable.has(`${tapTx},${tapTy}`) && !(tapTx === exitTx && tapTy === interior.height - 1)) return
      const path = findPath(currentTile, target)
      walkQueue = path.slice(1)
      if (!isWalking) processWalkQueue()
    })

    // ── Per-frame ──────────────────────────────────────────────────────────────
    app.ticker.add((ticker) => {
      if (avatar && isWalking && avatarFrames.length > 0) {
        avatarAnimTimer -= ticker.deltaMS
        if (avatarAnimTimer <= 0) {
          avatarAnimTimer = 200
          avatarAnimFrame = (avatarAnimFrame + 1) % avatarFrames.length
          avatar.texture = avatarFrames[avatarAnimFrame]
        }
      } else if (avatar && !isWalking && avatarBaseTexture) {
        if (avatar.texture !== avatarBaseTexture) {
          avatar.texture = avatarBaseTexture
          avatarAnimTimer = 0
          avatarAnimFrame = 0
        }
      }
    })
  })

  return (
    <div
      ref={containerRef}
      style={{ display: 'block', flexShrink: 0 }}
    />
  )
}
