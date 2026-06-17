import { useRef, useEffect } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../hooks/usePixiApp'
import { createWeatherSystem, WeatherSystem } from './hubWeather'
import type { WeatherType } from '../../game/hub/weather'

interface Props {
  type: WeatherType
  width?: number
  height?: number
}

/**
 * Standalone canvas that renders one weather type — used for Storybook
 * inspection of the weather overlay. In-game weather is driven directly by
 * `createWeatherSystem` inside `HubTownCanvas`; this wrapper is purely visual.
 */
export function HubWeather({ type, width = 480, height = 320 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const systemRef = useRef<WeatherSystem | null>(null)

  usePixiApp(containerRef, width, height, (app) => {
    // Dark backdrop so light particles (rain/snow/fog) are visible.
    const bg = new PIXI.Graphics()
    bg.rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0x223044 })
    app.stage.addChild(bg)

    const layer = new PIXI.Container()
    app.stage.addChild(layer)
    const system = createWeatherSystem({
      layer,
      getScreen: () => ({ width: app.screen.width, height: app.screen.height }),
    })
    system.setWeather(type)
    systemRef.current = system
    app.ticker.add((ticker) => system.tick(ticker.deltaMS))
  })

  // Update weather when the story arg changes (app persists across re-renders).
  useEffect(() => { systemRef.current?.setWeather(type) }, [type])

  return <div ref={containerRef} style={{ width, height }} />
}
