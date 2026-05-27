import { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'

/**
 * Initialises a PixiJS v8 Application and mounts its canvas into the given container.
 * Calls onReady(app) once the app is initialised.
 * The app is automatically destroyed on unmount.
 *
 * Usage:
 *   const containerRef = useRef<HTMLDivElement>(null)
 *   usePixiApp(containerRef, width, height, app => { ... build scene ... })
 *   return <div ref={containerRef} />
 *
 * Note: PixiJS creates its own canvas element and appends it to the container.
 * This avoids the React Strict Mode double-invoke issue where two apps would share
 * the same pre-existing canvas element and fight over its WebGL context.
 */
export function usePixiApp(
  containerRef: React.RefObject<HTMLElement | null>,
  width: number,
  height: number,
  onReady: (app: PIXI.Application) => void,
) {
  const appRef = useRef<PIXI.Application | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    let destroyed = false
    const app = new PIXI.Application()
    appRef.current = app

    let initialized = false
    app.init({
      width,
      height,
      backgroundAlpha: 0,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(() => {
      initialized = true
      if (destroyed) {
        // Strict Mode cleanup ran before init resolved — canvas was never inserted.
        // Stop the ticker so this inert app consumes no CPU; it will be GC'd.
        app.ticker.stop()
        return
      }
      container.appendChild(app.canvas)
      onReady(app)
    }).catch(e => console.error('[usePixiApp] app.init failed', e))

    return () => {
      destroyed = true
      if (initialized) {
        app.destroy(true, { children: true, texture: false })
      }
      appRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return appRef
}
