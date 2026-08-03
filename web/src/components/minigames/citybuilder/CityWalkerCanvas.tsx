import React, { useRef, useEffect } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../../hooks/usePixiApp'
import { loadAnimFramesOrStatic } from '../../../utils/pixiHelpers'

/**
 * One moving sprite on the city canvas — a resident, a builder, or a carrier.
 * Deliberately flat and game-agnostic: the caller flattens its own state into
 * these, so this component stays purely visual.
 */
export interface CitySprite {
  /** Stable identity across ticks — sprites are pooled by this. */
  key:    string
  /** Sprite name, resolved through the usual slug rules. */
  name:   string
  /** Centre position, in untransformed wrapper pixels. */
  x:      number
  y:      number
  /** Walk-cycle speed, frames per second. */
  fps:    number
  /** Drawn size in px before `scale`. */
  size?:  number
  scale?: number
  /** Unhappy residents: dimmed and desaturated. */
  faded?: boolean
}

export interface Props {
  sprites: CitySprite[]
}

const DEFAULT_SIZE = 20

// Residents move on a 100 ms game tick, so raw positions would step 10 times a
// second. Easing toward the target each rendered frame turns that into smooth
// motion without the canvas needing to know anything about the simulation.
const EASE_PER_FRAME = 0.28
/** Beyond this, a move is a teleport (respawn, un-hide) and should not glide. */
const SNAP_DISTANCE = 60

// One shared filter — a per-sprite instance would mean a render target each.
const desaturate = new PIXI.ColorMatrixFilter()
desaturate.desaturate()

interface PooledSprite {
  view:   PIXI.Container
  sprite: PIXI.AnimatedSprite
  targetX: number
  targetY: number
  faded:  boolean
}

function WalkerPixi({ sprites, w, h }: Props & { w: number; h: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const layerRef     = useRef<PIXI.Container | null>(null)
  const poolRef      = useRef<Map<string, PooledSprite>>(new Map())
  // Bumped when the Pixi app becomes ready, to drive the first sync: init is
  // async, so the sync effect below usually runs before there is a layer.
  // Also re-fires after a context-loss rebuild, which starts a fresh scene.
  const [ready, setReady] = React.useState(0)

  usePixiApp(containerRef, w, h, (app) => {
    // A rebuild after context loss lands here with the old scene destroyed;
    // the pool still references those dead sprites, so start it over.
    poolRef.current.clear()
    const layer = new PIXI.Container()
    app.stage.addChild(layer)
    layerRef.current = layer
    setReady(n => n + 1)

    const tick = () => {
      for (const p of poolRef.current.values()) {
        if (p.view.destroyed) continue
        const dx = p.targetX - p.view.x
        const dy = p.targetY - p.view.y
        if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05) {
          p.view.x = p.targetX
          p.view.y = p.targetY
        } else {
          p.view.x += dx * EASE_PER_FRAME
          p.view.y += dy * EASE_PER_FRAME
        }
      }
    }
    app.ticker.add(tick)
  })

  // Sync the sprite pool to the latest list. Runs on each 100 ms tick of the
  // caller's simulation; the ticker above handles the frames in between.
  useEffect(() => {
    const layer = layerRef.current
    if (!layer || layer.destroyed) return
    const pool = poolRef.current

    const live = new Set(sprites.map(s => s.key))
    for (const [key, p] of pool) {
      if (!live.has(key)) {
        layer.removeChild(p.view)
        p.view.destroy({ children: true })
        pool.delete(key)
      }
    }

    for (const s of sprites) {
      const size = s.size ?? DEFAULT_SIZE
      let p = pool.get(s.key)

      if (!p) {
        // Register synchronously with a placeholder frame so a second sync
        // arriving before the textures load reuses this sprite rather than
        // adding a duplicate that would then be orphaned.
        const view   = new PIXI.Container()
        const sprite = new PIXI.AnimatedSprite([PIXI.Texture.EMPTY])
        sprite.anchor.set(0.5)
        sprite.width  = size
        sprite.height = size
        view.addChild(sprite)
        view.x = s.x
        view.y = s.y
        layer.addChild(view)
        p = { view, sprite, targetX: s.x, targetY: s.y, faded: false }
        pool.set(s.key, p)

        loadAnimFramesOrStatic(s.name, 3).then(frames => {
          if (sprite.destroyed || !frames.length) return
          sprite.textures = frames
          // The EMPTY placeholder baked a scale against a 1×1 texture, so the
          // size has to be re-applied once real frames are in.
          sprite.width  = size
          sprite.height = size
          sprite.animationSpeed = s.fps / 60
          if (frames.length > 1) sprite.play()
        }).catch(() => { /* no sprite art for this name — keep the placeholder */ })
      }

      // A jump too large to be a walk step is a respawn — land it, don't glide.
      if (Math.hypot(s.x - p.targetX, s.y - p.targetY) > SNAP_DISTANCE) {
        p.view.x = s.x
        p.view.y = s.y
      }
      p.targetX = s.x
      p.targetY = s.y

      p.view.scale.set(s.scale ?? 1)
      const faded = !!s.faded
      if (faded !== p.faded) {
        p.sprite.alpha   = faded ? 0.45 : 1
        p.sprite.filters = faded ? [desaturate] : []
        p.faded = faded
      }

    }
  }, [sprites, ready])

  return <div ref={containerRef} style={{ width: w, height: h }} />
}

/**
 * Canvas layer for the city's moving sprites, replacing one absolutely
 * positioned `<div>` + swapping `<img>` per walker.
 *
 * Measures its container after mount, exactly as CityTerrainCanvas does, then
 * renders the sprites at wrapper scale so zoom/pan carries it along.
 *
 * The canvas is `pointer-events: none` so it never swallows taps meant for the
 * grid cells underneath — walker hit-testing is done by the parent against the
 * same positions it passes in here.
 *
 * Sprites only: text badges and bubbles stay in the DOM. Beyond being easier to
 * style, `PIXI.Text` releases a pooled canvas texture when it unloads, which
 * throws if the renderer has already gone — and `usePixiApp`'s teardown
 * destroys the stage's children on the way out.
 */
export function CityWalkerCanvas({ sprites }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = React.useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width > 0 && height > 0) setDims({ w: Math.ceil(width), h: Math.ceil(height) })
    }
    measure()
    const raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      ref={wrapRef}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      {dims && <WalkerPixi sprites={sprites} w={dims.w} h={dims.h} />}
    </div>
  )
}
