import { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import rollbar from '../rollbar'
import { noteContextCreated, noteContextDestroyed, getGlStats } from '../utils/pixiTelemetry'
import { createContextLossController, type ContextLossEvent, type ContextLossEventData } from './pixiContextLossController'
import { journal } from '../utils/resumeJournal'

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
 * When opts.resizeTo is given, the renderer is sized to that element (and tracks
 * window resizes via Pixi's ResizePlugin) instead of the fixed width/height,
 * which then only serve as a fallback when the element has no size yet.
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

// A browser that backgrounds a tab long enough to reclaim its GPU context often
// never fires webglcontextrestored on the old context — recovery instead relies
// on requesting a brand-new context on a brand-new canvas. Cap consecutive
// rebuild attempts (the counter re-arms after each success, and again on each
// foreground resume) so a hard GPU failure (context lost immediately on every
// new context too) pauses and logs instead of spinning in a tight loop.
const MAX_CONTEXT_REBUILD_ATTEMPTS = 3

export function usePixiApp(
  containerRef: React.RefObject<HTMLElement | null>,
  width: number,
  height: number,
  onReady: (app: PIXI.Application) => void,
  opts?: { resizeTo?: React.RefObject<HTMLElement | null> },
) {
  const appRef = useRef<PIXI.Application | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    let destroyed = false
    let initialized = false
    let contextLostHandler: ((e: Event) => void) | null = null

    const resizeEl = opts?.resizeTo?.current ?? undefined
    const initW = resizeEl?.clientWidth  || width
    const initH = resizeEl?.clientHeight || height
    const resolution = computeCappedResolution(initW, initH, window.devicePixelRatio || 1)
    const contextInfo = { width: initW, height: initH, resolution }

    // Pixi's ResizePlugin only re-measures resizeTo on the window's own `resize`
    // event, so a container that changes size on its own (a toolbar wrapping to a
    // second line, a flex sibling growing) leaves app.screen stale while the DOM
    // reports the new size. Anything mixing the two — the hub minimap reads
    // clientWidth/clientHeight while the canvas culls against app.screen — then
    // disagrees about where the viewport is. Observe the element directly.
    let resizeObserver: ResizeObserver | null = null
    const observeResizeEl = (app: PIXI.Application) => {
      if (!resizeEl || typeof ResizeObserver === 'undefined') return
      resizeObserver = new ResizeObserver(() => {
        // queueResize coalesces to the next frame, matching the plugin's own path.
        if (appRef.current === app && app.renderer) app.queueResize()
      })
      resizeObserver.observe(resizeEl)
    }
    const disconnectResizeObserver = () => {
      resizeObserver?.disconnect()
      resizeObserver = null
    }

    // Tears down a fully-initialised app and its canvas. Used both on unmount
    // and to discard a context-lost app immediately before rebuilding it.
    const teardown = (app: PIXI.Application) => {
      disconnectResizeObserver()
      // If the WebGL context was already lost (e.g. the browser evicted it
      // under context pressure from other live apps), the renderer is gone and
      // app.canvas throws. Nothing remains to tear down — just note it.
      if (!app.renderer) {
        noteContextDestroyed(contextInfo)
        return
      }
      const canvas = app.canvas as HTMLCanvasElement  // capture before destroy — destroy(true) detaches it
      if (contextLostHandler) canvas.removeEventListener('webglcontextlost', contextLostHandler)
      suppressContextLostOnce(canvas)
      app.destroy(true, { children: true, texture: false })
      releaseCanvasBackingStore(canvas)
      noteContextDestroyed(contextInfo)
    }

    // Tears down the current app (if any) and clears the hook's live-app state,
    // so a rebuild always starts from a clean slate and the unmount cleanup
    // never double-destroys.
    const teardownCurrent = () => {
      const app = appRef.current
      if (app && initialized) teardown(app)
      appRef.current = null
      initialized = false
    }

    // User-visible fallback shown when automatic recovery gives up: replaces
    // the silent black canvas with a message and a RETRY button that resets
    // the attempt budget. Removed whenever a build starts (manual retry or a
    // resume-triggered rebuild) and on unmount.
    let fallbackEl: HTMLDivElement | null = null
    const removeFallback = () => {
      fallbackEl?.remove()
      fallbackEl = null
    }
    const showFallback = () => {
      if (fallbackEl || destroyed) return
      const el = document.createElement('div')
      el.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;min-height:160px;text-align:center;'
      const msg = document.createElement('p')
      msg.textContent = 'Graphics failed to load.'
      const btn = document.createElement('button')
      btn.className = 'action-btn'
      btn.textContent = 'RETRY'
      btn.onclick = () => controller.manualRetry()
      el.append(msg, btn)
      container.appendChild(el)
      fallbackEl = el
    }

    // Maps recovery state transitions to Rollbar + the persisted resume journal.
    // Live Rollbar events fired while the tab is hidden are often never
    // delivered on mobile — the journal entries are the reliable record and are
    // flushed as one event at the next boot or foreground resume.
    const notify = (event: ContextLossEvent, data: ContextLossEventData) => {
      const payload = { ...contextInfo, ...getGlStats(), rebuildAttempts: data.attempts, visibility: document.visibilityState }
      switch (event) {
        case 'contextlost':
          journal('webglcontextlost', { hidden: data.hidden, attempts: data.attempts })
          break
        case 'rebuild-deferred':
          rollbar?.warn('[usePixiApp] webglcontextlost while hidden — deferring rebuild to resume', payload)
          journal('rebuild-deferred', { attempts: data.attempts })
          break
        case 'rebuild-started':
          rollbar?.warn('[usePixiApp] webglcontextlost — rebuilding app', payload)
          journal('rebuild-started', { attempts: data.attempts })
          break
        case 'silent-context-loss':
          rollbar?.warn('[usePixiApp] context silently lost while backgrounded — rebuilding on resume', payload)
          journal('silent-context-loss', { attempts: data.attempts })
          break
        case 'rebuild-given-up':
          rollbar?.error('[usePixiApp] webglcontextlost — giving up after repeated rebuild failures', payload)
          journal('rebuild-given-up', { attempts: data.attempts })
          showFallback()
          break
        case 'retry-scheduled':
          // The init failure itself was already reported by buildApp's catch.
          journal('init-retry-scheduled', { attempts: data.attempts, delayMs: data.delayMs })
          break
        case 'budget-rearmed':
          rollbar?.info('[usePixiApp] foreground resume after give-up — re-arming rebuild budget', payload)
          journal('budget-rearmed', {})
          break
      }
    }

    const controller = createContextLossController({
      maxAttempts: MAX_CONTEXT_REBUILD_ATTEMPTS,
      isHidden: () => document.hidden,
      teardown: teardownCurrent,
      rebuild: () => { if (!destroyed) buildApp(true) },
      notify,
    })

    // Creates and initialises a fresh Application, appending its canvas and
    // calling onReady once ready. Called on mount (isRebuild=false), and
    // again to rebuild the scene from scratch after an unrecoverable
    // webglcontextlost (isRebuild=true) — logged distinctly from the initial
    // mount so Rollbar shows whether recovery actually completed.
    const buildApp = (isRebuild: boolean) => {
      removeFallback()
      initialized = false
      const buildStartedAt = Date.now()
      const app = new PIXI.Application()
      appRef.current = app

      app.init({
        width: initW,
        height: initH,
        resizeTo: resizeEl,
        backgroundAlpha: 0,
        antialias: false,
        resolution,
        autoDensity: true,
      }).then(() => {
        initialized = true
        noteContextCreated(contextInfo)
        if (destroyed) {
          // Cleanup ran before init resolved — destroy properly to release the WebGL context.
          rollbar?.warn('[usePixiApp] init resolved after unmount — destroying orphan app', { isRebuild, rebuildAttempts: controller.attempts() })
          teardown(app)
          return
        }
        if (isRebuild) {
          const rebuildMs = Date.now() - buildStartedAt
          rollbar?.info('[usePixiApp] webgl context recovered — rebuild succeeded', {
            ...contextInfo, ...getGlStats(), rebuildAttempts: controller.attempts(), rebuildMs,
          })
          journal('rebuild-succeeded', { rebuildMs })
          controller.onRebuildSucceeded()
        }
        const canvas = app.canvas as HTMLCanvasElement
        // Intentional loss during our own teardown never reaches this listener:
        // suppressContextLostOnce registers in capture phase on that canvas and
        // stops immediate propagation before this handler would fire.
        contextLostHandler = (e: Event) => {
          e.preventDefault()  // signal we intend to recover, not abandon the canvas
          controller.onContextLost()
        }
        canvas.addEventListener('webglcontextlost', contextLostHandler)
        container.appendChild(canvas)
        observeResizeEl(app)
        onReady(app)
      }).catch(e => {
        console.error('[usePixiApp] app.init failed', e)
        rollbar?.error(isRebuild ? '[usePixiApp] rebuild after context loss failed' : '[usePixiApp] app.init failed', {
          message: (e as Error)?.message, ...contextInfo, ...getGlStats(), isRebuild, rebuildAttempts: controller.attempts(),
        })
        journal(isRebuild ? 'rebuild-failed' : 'init-failed', { message: (e as Error)?.message })
        // Release any partial WebGL context created before the failure to prevent
        // context accumulation that crashes the browser after repeated navigations.
        try {
          suppressContextLostOnce(app.canvas as HTMLCanvasElement)
          app.destroy(true, { children: true, texture: false })
          releaseCanvasBackingStore(app.canvas as HTMLCanvasElement)
        } catch { /* partial init — best effort */ }
        if (appRef.current === app) appRef.current = null
        // A failed init is usually transient memory/GPU pressure (the black-
        // screen-on-fresh-tab scenario) — retry on a backoff instead of leaving
        // a permanently empty canvas.
        if (!destroyed) controller.onInitFailed()
      })
    }

    buildApp(false)

    // iOS can reclaim a backgrounded tab's WebGL context without ever firing
    // webglcontextlost on it. Probe the context on every return to foreground
    // and rebuild if it died silently; this is also where a rebuild deferred
    // during a hidden-tab context loss actually runs.
    const isContextLost = (): boolean => {
      const app = appRef.current
      // No app at all means a failed init discarded it — the canvas is missing
      // and needs a rebuild, which is a loss for the probe's purposes.
      if (!app) return true
      if (!initialized) return false  // init still in flight — let it finish
      // Initialised app whose renderer is gone: context evicted out from under us.
      if (!app.renderer) return true
      if (app.renderer.name !== 'webgl') return false  // WebGPU/canvas renderers need different handling; not used today
      const gl = (app.renderer as PIXI.WebGLRenderer).gl
      return !gl || gl.isContextLost()
    }
    const visibilityHandler = () => {
      if (document.visibilityState !== 'visible' || destroyed) return
      controller.onVisible(isContextLost)
    }
    document.addEventListener('visibilitychange', visibilityHandler)

    return () => {
      document.removeEventListener('visibilitychange', visibilityHandler)
      destroyed = true
      controller.dispose()
      removeFallback()
      disconnectResizeObserver()  // also covers an init that never reached teardown
      if (initialized && appRef.current) {
        teardown(appRef.current)
      }
      appRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return appRef
}
