// Imperative PixiJS manager for hub-world weather (issue #1604).
//
// Renders a screen-space overlay (rain streaks, drifting snow, layered fog) that
// always covers the viewport, so no world-space culling is needed. Particle
// pools are capped and recycled as they leave the viewport. Weather selection is
// data-driven per town — the pure logic lives in `web/src/game/hub/weather.ts`;
// this file owns the sprites and the per-frame loop.

import * as PIXI from 'pixi.js'
import type { WeatherType } from '../../game/hub/weather'

export interface WeatherSystemOptions {
  /** Screen-space container (added to the stage, not the scrolling world root). */
  layer: PIXI.Container
  /** Current viewport size in CSS pixels. */
  getScreen: () => { width: number; height: number }
  /** Weather pauses (hides) while this returns true — e.g. inside a building. */
  isPaused?: () => boolean
}

export interface WeatherSystem {
  setWeather: (type: WeatherType) => void
  getWeather: () => WeatherType
  tick: (deltaMS: number) => void
  destroy: () => void
}

// Hard caps keep the overlay cheap regardless of viewport size.
const MAX_RAIN = 240
const MAX_SNOW = 200
const FOG_BANDS = 3

interface Particle {
  gfx: PIXI.Graphics
  x: number
  y: number
  vx: number
  vy: number
  /** snow phase for gentle sway */
  phase: number
}

export function createWeatherSystem(opts: WeatherSystemOptions): WeatherSystem {
  const { layer, getScreen, isPaused } = opts

  let weather: WeatherType = 'clear'
  let wind = 0                 // horizontal drift shared by all particle kinds
  let windTarget = 0
  let windTimer = 0

  const rain: Particle[] = []
  const snow: Particle[] = []
  const fogBands: { gfx: PIXI.Graphics; x: number; speed: number }[] = []
  let lastW = 0
  let lastH = 0

  // ── Particle factories ─────────────────────────────────────────────────────
  function makeRainDrop(): Particle {
    const g = new PIXI.Graphics()
    g.moveTo(0, 0).lineTo(0, 8).stroke({ color: 0x99bbdd, width: 1, alpha: 0.5 })
    layer.addChild(g)
    return { gfx: g, x: 0, y: 0, vx: 0, vy: 0, phase: 0 }
  }
  function makeSnowFlake(): Particle {
    const g = new PIXI.Graphics()
    const r = 1 + Math.random() * 1.5
    g.circle(0, 0, r).fill({ color: 0xffffff, alpha: 0.85 })
    layer.addChild(g)
    return { gfx: g, x: 0, y: 0, vx: 0, vy: 0, phase: Math.random() * Math.PI * 2 }
  }

  function resetRain(p: Particle, screen: { width: number; height: number }, fromTop: boolean) {
    p.x = Math.random() * (screen.width + 200) - 100
    p.y = fromTop ? -10 : Math.random() * screen.height
    p.vy = 9 + Math.random() * 4       // px per frame (~60fps baseline)
    p.vx = 1.2
  }
  function resetSnow(p: Particle, screen: { width: number; height: number }, fromTop: boolean) {
    p.x = Math.random() * (screen.width + 100) - 50
    p.y = fromTop ? -10 : Math.random() * screen.height
    p.vy = 1.0 + Math.random() * 1.2
    p.vx = 0.3
    p.phase = Math.random() * Math.PI * 2
  }

  // ── Pool sizing per weather type ────────────────────────────────────────────
  function ensurePools() {
    const screen = getScreen()
    if (weather === 'rain') {
      while (rain.length < MAX_RAIN) { const p = makeRainDrop(); resetRain(p, screen, false); rain.push(p) }
    }
    if (weather === 'snow') {
      while (snow.length < MAX_SNOW) { const p = makeSnowFlake(); resetSnow(p, screen, false); snow.push(p) }
    }
    if (weather === 'fog') {
      while (fogBands.length < FOG_BANDS) {
        const g = new PIXI.Graphics()
        layer.addChild(g)
        fogBands.push({ gfx: g, x: Math.random() * screen.width, speed: 0.15 + fogBands.length * 0.1 })
      }
      drawFog()
    }
  }

  function drawFog() {
    const screen = getScreen()
    fogBands.forEach((band, i) => {
      band.gfx.clear()
      const h = screen.height * (0.5 + i * 0.18)
      const y = screen.height - h
      band.gfx.rect(0, y, screen.width, h).fill({ color: 0xc8d0d8, alpha: 0.06 + i * 0.03 })
    })
  }

  function clearKind(arr: { gfx: PIXI.Graphics }[]) {
    for (const p of arr) { layer.removeChild(p.gfx); p.gfx.destroy() }
    arr.length = 0
  }

  function setWeather(type: WeatherType) {
    if (type === weather) return
    weather = type
    clearKind(rain); clearKind(snow); clearKind(fogBands)
    ensurePools()
  }

  // ── Per-frame loop ──────────────────────────────────────────────────────────
  function tick(deltaMS: number) {
    const paused = isPaused?.() ?? false
    layer.visible = !paused && weather !== 'clear'
    if (paused || weather === 'clear') return

    const screen = getScreen()
    // Redraw fog bands when the viewport size changes (cheap; 3 rects).
    if (weather === 'fog' && (screen.width !== lastW || screen.height !== lastH)) drawFog()
    lastW = screen.width; lastH = screen.height
    // dt in 60fps-frame units, clamped so a stutter doesn't teleport particles.
    const dt = Math.min(deltaMS, 50) / 16.667

    // Wind drifts slowly toward a new random target every few seconds.
    windTimer -= deltaMS
    if (windTimer <= 0) { windTimer = 3000 + Math.random() * 4000; windTarget = (Math.random() * 2 - 1) * 2.5 }
    wind += (windTarget - wind) * 0.02 * dt

    if (weather === 'rain') {
      for (const p of rain) {
        p.y += p.vy * dt
        p.x += (p.vx + wind * 1.5) * dt
        if (p.y > screen.height || p.x < -120 || p.x > screen.width + 120) resetRain(p, screen, true)
        p.gfx.position.set(p.x, p.y)
        p.gfx.rotation = Math.atan2(p.vy, p.vx + wind * 1.5) - Math.PI / 2
      }
    } else if (weather === 'snow') {
      for (const p of snow) {
        p.phase += 0.04 * dt
        p.y += p.vy * dt
        p.x += (p.vx + wind + Math.sin(p.phase) * 0.6) * dt
        if (p.y > screen.height || p.x < -60 || p.x > screen.width + 60) resetSnow(p, screen, true)
        p.gfx.position.set(p.x, p.y)
      }
    } else if (weather === 'fog') {
      for (const band of fogBands) {
        band.x += (band.speed + wind * 0.3) * dt
        if (band.x > screen.width) band.x = 0
        // Subtle horizontal shimmer via container offset (re-draw only on resize).
        band.gfx.x = (band.x % screen.width) * 0.05
      }
    }
  }

  function destroy() {
    clearKind(rain); clearKind(snow); clearKind(fogBands)
  }

  return { setWeather, getWeather: () => weather, tick, destroy }
}
