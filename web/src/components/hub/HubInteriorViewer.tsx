import React, { useRef } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../hooks/usePixiApp'
import { HUB_INTERIORS, INTERIOR_NPCS } from '../../data/hub/loader'
import { TILESET_IMAGE, TILESET_COLUMNS } from '../../data/tiles/tileIndex'
import { loadTileTexture, loadTextureUrl } from '../../utils/pixiHelpers'

const T  = 32

interface Props {
  interiorId: string
  scale?: number
}

export function HubInteriorViewer({ interiorId, scale = 2 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const interior     = HUB_INTERIORS[interiorId]

  usePixiApp(containerRef, interior.width * T * scale, interior.height * T * scale, (app) => {
    app.stage.scale.set(scale)

    const base        = (import.meta as { env: { BASE_URL: string } }).env.BASE_URL
    const baseChipUrl = `${base}${TILESET_IMAGE.baseChip.slice(1)}`

    const floorLayer = new PIXI.Container()
    const wallLayer  = new PIXI.Container()
    const decorLayer = new PIXI.Container()
    const npcLayer   = new PIXI.Container()
    app.stage.addChild(floorLayer, wallLayer, decorLayer, npcLayer)

    // ── Floor ──────────────────────────────────────────────────────────────────
    const floorTileId = interior.floorTileId ?? 288
    loadTileTexture(baseChipUrl, floorTileId, TILESET_COLUMNS.baseChip).then(tex => {
      if (app.renderer == null) return
      for (let tx = 1; tx < interior.width  - 1; tx++)
        for (let ty = 1; ty < interior.height - 1; ty++) {
          const s = new PIXI.Sprite(tex)
          s.position.set(tx * T, ty * T)
          s.width = T; s.height = T
          floorLayer.addChild(s)
        }
    }).catch(() => {})

    // ── Walls (simple dark grey border) ────────────────────────────────────────
    const wall = new PIXI.Graphics()
    // top + bottom walls
    for (let tx = 0; tx < interior.width; tx++) {
      wall.rect(tx * T, 0,                         T, T).fill({ color: 0x3a3a4a })
      wall.rect(tx * T, (interior.height - 1) * T, T, T).fill({ color: 0x3a3a4a })
    }
    // left + right walls
    for (let ty = 1; ty < interior.height - 1; ty++) {
      wall.rect(0,                        ty * T, T, T).fill({ color: 0x3a3a4a })
      wall.rect((interior.width - 1) * T, ty * T, T, T).fill({ color: 0x3a3a4a })
    }
    wallLayer.addChild(wall)

    // ── Decor ──────────────────────────────────────────────────────────────────
    const byTile = new Map<number, [number, number][]>()
    for (const d of interior.decor) {
      const list = byTile.get(d.tileId) ?? []
      list.push([d.tx, d.ty])
      byTile.set(d.tileId, list)
    }
    for (const [tileId, positions] of byTile) {
      loadTileTexture(baseChipUrl, tileId, TILESET_COLUMNS.baseChip).then(tex => {
        if (app.renderer == null) return
        for (const [tx, ty] of positions) {
          const s = new PIXI.Sprite(tex)
          s.position.set(tx * T, ty * T)
          s.width = T; s.height = T
          decorLayer.addChild(s)
        }
      }).catch(() => {})
    }

    // ── NPCs ───────────────────────────────────────────────────────────────────
    for (const npc of INTERIOR_NPCS[interiorId] ?? []) {
      loadTextureUrl(`${base}sprites/${npc.sprite}.svg`).then(tex => {
        if (app.renderer == null) return
        const s = new PIXI.Sprite(tex)
        const spriteSize = T * 1.5
        s.width = spriteSize; s.height = spriteSize
        s.anchor.set(0.5, 1)
        s.position.set(npc.tx * T + T / 2, npc.ty * T + T)
        npcLayer.addChild(s)
      }).catch(() => {})
    }
  })

  return (
    <div style={{ display: 'inline-block', border: '1px solid #446644' }}>
      <div ref={containerRef} />
    </div>
  )
}
