import { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'

/**
 * Initialises a PixiJS v8 Application attached to the given canvas ref.
 * Calls onReady(app) once the app is initialised.
 * The app is automatically destroyed on unmount.
 *
 * Usage:
 *   const canvasRef = useRef<HTMLCanvasElement>(null)
 *   usePixiApp(canvasRef, width, height, app => { ... build scene ... })
 *   return <canvas ref={canvasRef} />
 */
export function usePixiApp(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  width: number,
  height: number,
  onReady: (app: PIXI.Application) => void,
) {
  const appRef = useRef<PIXI.Application | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    let destroyed = false
    const app = new PIXI.Application()
    appRef.current = app

    let initialized = false
    app.init({
      canvas,
      width,
      height,
      backgroundAlpha: 0,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(() => {
      initialized = true
      if (destroyed) {
        app.destroy(false, { children: true, texture: false })
        return
      }
      onReady(app)
    })

    return () => {
      destroyed = true
      if (initialized) {
        app.destroy(false, { children: true, texture: false })
      }
      appRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return appRef
}
