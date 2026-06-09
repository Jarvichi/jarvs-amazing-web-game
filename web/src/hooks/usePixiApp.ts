import { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import rollbar from '../rollbar'

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
// Suppress the webglcontextlost error PixiJS logs when we intentionally release
// the context via app.destroy(). This is expected teardown, not a GPU crash.
// We register in capture phase (before PixiJS's bubble-phase listener) and
// call stopImmediatePropagation so PixiJS's handler never fires.
function suppressContextLostOnce(canvas: HTMLCanvasElement) {
  const handler = (e: Event) => { e.stopImmediatePropagation() }
  canvas.addEventListener('webglcontextlost', handler, { capture: true, once: true })
}

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
        // Cleanup ran before init resolved — destroy properly to release the WebGL context.
        rollbar?.warn('[usePixiApp] init resolved after unmount — destroying orphan app')
        suppressContextLostOnce(app.canvas as HTMLCanvasElement)
        app.destroy(true, { children: true, texture: false })
        return
      }
      container.appendChild(app.canvas)
      onReady(app)
    }).catch(e => {
      console.error('[usePixiApp] app.init failed', e)
      rollbar?.error('[usePixiApp] app.init failed', { message: (e as Error)?.message })
      // Release any partial WebGL context created before the failure to prevent
      // context accumulation that crashes the browser after repeated navigations.
      try {
        suppressContextLostOnce(app.canvas as HTMLCanvasElement)
        app.destroy(true, { children: true, texture: false })
      } catch { /* partial init — best effort */ }
      appRef.current = null
    })

    return () => {
      destroyed = true
      if (initialized) {
        suppressContextLostOnce(app.canvas as HTMLCanvasElement)
        app.destroy(true, { children: true, texture: false })
      }
      appRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return appRef
}
