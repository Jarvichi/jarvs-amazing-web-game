import React, { useRef } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../hooks/usePixiApp'
import { buildTerrainGfx, buildBgTileGfx, buildDecorGfx } from '../../utils/terrainLayer'
import { OverlayScreen } from '../ui/OverlayScreen'

interface Props {
  onBack: () => void
}

const MAP_WIDTH  = 1200
const MAP_HEIGHT = 800
const HUB_ENV   = 'camp'

export function HubWorld({ onBack }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  usePixiApp(containerRef, MAP_WIDTH, MAP_HEIGHT, (app) => {
    app.canvas.style.touchAction = 'pan-x pan-y'

    const groundLayer = new PIXI.Container()
    const worldLayer  = new PIXI.Container()
    worldLayer.sortableChildren = true
    app.stage.addChild(groundLayer, worldLayer)

    const baseContainer  = new PIXI.Container()
    const riverContainer = new PIXI.Container()
    groundLayer.addChild(baseContainer, riverContainer)

    buildTerrainGfx(baseContainer, riverContainer, worldLayer,
      { environment: HUB_ENV, id: 'hubworld' },
      MAP_WIDTH, MAP_HEIGHT)
    buildBgTileGfx(baseContainer, { environment: HUB_ENV }, MAP_WIDTH, MAP_HEIGHT)
      .catch(e => console.error('[HubWorld] bg tiles failed', e))
    buildDecorGfx(groundLayer, { environment: HUB_ENV, id: 'hubworld' }, MAP_WIDTH, MAP_HEIGHT)
      .catch(e => console.error('[HubWorld] decor tiles failed', e))

    app.ticker.add(() => { worldLayer.sortChildren() })
  })

  return (
    <OverlayScreen onBack={onBack} title="HUB WORLD" subtitle="Coming soon">
      <div className="nm-map u-flex u-grow u-items-c nm-map--camp" style={{ overflowX: 'auto', overflowY: 'auto' }}>
        <div ref={containerRef} style={{ display: 'block', flexShrink: 0, width: MAP_WIDTH, height: MAP_HEIGHT }} />
      </div>
    </OverlayScreen>
  )
}
