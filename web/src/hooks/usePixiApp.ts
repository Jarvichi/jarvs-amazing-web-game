import { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import rollbar from '../rollbar'
import { noteContextCreated, noteContextDestroyed, getGlStats } from '../utils/pixiTelemetry'

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

// Cap on the drawing-buffer size (device pixels). Large hub maps (Ravenwatch is
// 2400×2240 CSS px) at devicePixelRatio 3 would otherwise allocate a 7200×6720
// buffer ≈ 185 MB of GPU memory — enough for iOS Safari to kill the page when
// the buffer is transiently doubled while navigating away and back.
export const RENDERER_PIXEL_BUDGET = 4096 * 4096

/**
 * Resolution for a canvas of width×height CSS px: the devicePixelRatio, clamped
 * to 2 (indistinguishable from 3 for 32px pixel art, halves GPU memory) and to
 * whatever keeps the drawing buffer within RENDERER_PIXEL_BUDGET.
 */
export function computeCappedResolution(
  width: number,
  height: number,
  dpr: number,
  budget: number = RENDERER_PIXEL_BUDGET,
): number {
  const area = Math.max(1, width * height)
  return Math.min(dpr || 1, 2, Math.sqrt(budget / area))
}

// Shrink the drawing buffer so iOS Safari frees its GPU memory immediately
// instead of when the canvas is garbage collected. Pixi's destroy() already
// loses the WebGL context, but a lost context keeps its backing store until GC
// — long enough for a remount's new buffer to transiently double GPU memory.
function releaseCanvasBackingStore(canvas: HTMLCanvasElement) {
  try {
    canvas.width = 1
    canvas.height = 1
  } catch { /* best effort */ }
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

    const resolution = computeCappedResolution(width, height, window.devicePixelRatio || 1)
    const contextInfo = { width, height, resolution }
    const onContextLost = () => {
      rollbar?.error('[usePixiApp] webglcontextlost during app lifetime', { ...contextInfo, ...getGlStats() })
    }
    const destroyApp = () => {
      const canvas = app.canvas as HTMLCanvasElement  // capture before destroy — destroy(true) detaches it
      canvas.removeEventListener('webglcontextlost', onContextLost)
      suppressContextLostOnce(canvas)
      app.destroy(true, { children: true, texture: false })
      releaseCanvasBackingStore(canvas)
      noteContextDestroyed(contextInfo)
    }

    let initialized = false
    app.init({
      width,
      height,
      backgroundAlpha: 0,
      antialias: false,
      resolution,
      autoDensity: true,
    }).then(() => {
      initialized = true
      noteContextCreated(contextInfo)
      if (destroyed) {
        // Cleanup ran before init resolved — destroy properly to release the WebGL context.
        rollbar?.warn('[usePixiApp] init resolved after unmount — destroying orphan app')
        destroyApp()
        return
      }
      // Report unexpected context loss while the app is live. Intentional loss
      // during teardown never reaches this listener: suppressContextLostOnce
      // registers in capture phase and stops immediate propagation.
      ;(app.canvas as HTMLCanvasElement).addEventListener('webglcontextlost', onContextLost)
      container.appendChild(app.canvas)
      onReady(app)
    }).catch(e => {
      console.error('[usePixiApp] app.init failed', e)
      rollbar?.error('[usePixiApp] app.init failed', { message: (e as Error)?.message, ...contextInfo, ...getGlStats() })
      // Release any partial WebGL context created before the failure to prevent
      // context accumulation that crashes the browser after repeated navigations.
      try {
        suppressContextLostOnce(app.canvas as HTMLCanvasElement)
        app.destroy(true, { children: true, texture: false })
        releaseCanvasBackingStore(app.canvas as HTMLCanvasElement)
      } catch { /* partial init — best effort */ }
      appRef.current = null
    })

    return () => {
      destroyed = true
      if (initialized) {
        destroyApp()
      }
      appRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return appRef
}
