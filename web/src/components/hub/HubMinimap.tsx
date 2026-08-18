import React, { useEffect, useRef, useState } from 'react'
import type { HubLocationBundle } from '../../data/hub/loader'
import { edgeArrowPlacement, isOnScreen, minimapTransform, type ViewportRect } from './hubMinimapMath'

const T = 32

const MM_W = 100
const MM_H = 100
const PAD  = 0          // inner padding inside the minimap canvas

const STORE_KEY = 'jarv_hub_minimap_on'

export interface MinimapObjective {
  x:    number              // world pixel coords (centre of the target tile)
  y:    number
  kind: 'pickup' | 'npc' | 'directory'
}

interface Props {
  locationData: HubLocationBundle
  objectives:   MinimapObjective[]
  playerRef:    React.RefObject<{ x: number; y: number }>
  viewportRef:  React.RefObject<HTMLDivElement | null>
}

function loadVisible(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) !== 'off'
  } catch {
    return true
  }
}

function saveVisible(on: boolean): void {
  try {
    localStorage.setItem(STORE_KEY, on ? 'on' : 'off')
  } catch { /* ignore */ }
}

export function HubMinimap({ locationData, objectives, playerRef, viewportRef }: Props) {
  const { MAP_W, MAP_H, HUB_BUILDINGS } = locationData

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(loadVisible)
  // Off-screen edge arrow, positioned in px within this component's containing
  // block (.nm-map) + angle, or null when the objective is on-screen. Pixels, not
  // percentages: .nm-map carries 16px of top padding that the scroll viewport does
  // not, so a percentage of the containing block lands ~16px above the true spot.
  const [arrow, setArrow] = useState<{ left: number; top: number; angle: number } | null>(null)

  // World → minimap scale (letterboxed to preserve aspect ratio).
  const { scale, drawW, drawH, offX, offY, toMmX, toMmY } =
    minimapTransform(MAP_W, MAP_H, MM_W, MM_H, PAD)

  // Redraw loop — runs only while the minimap is visible. Repaints when the
  // player tile, objectives, or viewport window change (keeps work minimal).
  useEffect(() => {
    if (!visible) { setArrow(null); return }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Hi-DPI crispness.
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width  = MM_W * dpr
    canvas.height = MM_H * dpr
    ctx.scale(dpr, dpr)

    let raf = 0
    let lastSig = ''

    const objSig = objectives.map(o => `${o.kind}:${Math.round(o.x)},${Math.round(o.y)}`).join('|')

    const frame = () => {
      const p  = playerRef.current ?? { x: 0, y: 0 }
      const vp = viewportRef.current

      // Visible world window (for the edge-arrow on-screen test).
      const vx = vp?.scrollLeft ?? 0
      const vy = vp?.scrollTop  ?? 0
      const vw = vp?.clientWidth  ?? MAP_W
      const vh = vp?.clientHeight ?? MAP_H
      // Where the game view sits inside this component's containing block.
      const ox = vp?.offsetLeft ?? 0
      const oy = vp?.offsetTop  ?? 0

      const sig = `${Math.round(p.x)},${Math.round(p.y)}|${objSig}|${Math.round(vx)},${Math.round(vy)},${vw},${vh},${ox},${oy}`
      if (sig !== lastSig) {
        lastSig = sig
        draw(ctx, p, { vx, vy, vw, vh, ox, oy })
      }
      raf = requestAnimationFrame(frame)
    }

    const draw = (
      c: CanvasRenderingContext2D,
      player: { x: number; y: number },
      view: ViewportRect & { ox: number; oy: number },
    ) => {
      c.clearRect(0, 0, MM_W, MM_H)

      // Map outline.
      c.fillStyle   = 'rgba(20,34,20,0.1)'
      c.strokeStyle = '#446644'
      c.lineWidth   = 1
      c.fillRect(offX, offY, drawW, drawH)

      // Buildings.
      c.fillStyle = 'rgba(120,150,120,0.55)'
      for (const b of HUB_BUILDINGS) {
        const [tx1, ty1, tx2, ty2] = b.rect
        const bx = toMmX(tx1 * T)
        const by = toMmY(ty1 * T)
        const bw = (tx2 - tx1 + 1) * T * scale
        const bh = (ty2 - ty1 + 1) * T * scale
        c.fillRect(bx, by, bw, bh)
      }

      c.strokeRect(offX, offY, drawW, drawH)

      // Viewport window indicator.
      c.strokeStyle = 'rgba(212,234,212,0.35)'
      c.strokeRect(
        toMmX(view.vx), toMmY(view.vy),
        view.vw * scale, view.vh * scale,
      )

      // Objective pins. Directory pins (user "show on map") are larger + cyan with
      // a halo ring so they stand out from quest pins.
      for (const o of objectives) {
        const directory = o.kind === 'directory'
        const color = directory ? '#55ddee' : o.kind === 'pickup' ? '#ffcc00' : '#66cc66'
        if (directory) {
          c.beginPath()
          c.arc(toMmX(o.x), toMmY(o.y), 7, 0, Math.PI * 2)
          c.strokeStyle = 'rgba(85,221,238,0.6)'
          c.lineWidth   = 1.5
          c.stroke()
        }
        // Soft halo behind every pin so it reads at a glance against busy map fill.
        c.beginPath()
        c.arc(toMmX(o.x), toMmY(o.y), (directory ? 4.2 : 3.5) + 2, 0, Math.PI * 2)
        c.fillStyle = `${color}33`
        c.fill()
        c.beginPath()
        c.arc(toMmX(o.x), toMmY(o.y), directory ? 4.2 : 3.5, 0, Math.PI * 2)
        c.fillStyle = color
        c.fill()
        c.lineWidth   = 1
        c.strokeStyle = 'rgba(8,14,8,0.9)'
        c.stroke()
      }

      // Player marker.
      c.beginPath()
      c.arc(toMmX(player.x), toMmY(player.y), 5.5, 0, Math.PI * 2)
      c.fillStyle = 'rgba(255,255,255,0.25)'
      c.fill()
      c.beginPath()
      c.arc(toMmX(player.x), toMmY(player.y), 3.4, 0, Math.PI * 2)
      c.fillStyle = '#ffffff'
      c.fill()
      c.lineWidth   = 1.4
      c.strokeStyle = '#ffcc00'
      c.stroke()

      // ── Off-screen edge arrow: nearest objective outside the viewport ──────
      let nearest: MinimapObjective | null = null
      let nearestD = Infinity
      for (const o of objectives) {
        const d = (o.x - player.x) ** 2 + (o.y - player.y) ** 2
        if (d < nearestD) { nearestD = d; nearest = o }
      }
      if (nearest && !isOnScreen(nearest, view)) {
        const { fx, fy, angle } = edgeArrowPlacement(nearest, view)
        // Offset by the scroll viewport's own position so the arrow is placed
        // against the game view, not against .nm-map's larger padding box.
        setArrow({ left: view.ox + fx * view.vw, top: view.oy + fy * view.vh, angle })
      } else {
        setArrow(null)
      }
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, objectives, locationData])

  const toggle = () => {
    setVisible(v => { saveVisible(!v); return !v })
  }

  return (
    <>
      {/* Off-screen objective edge arrow */}
      {visible && arrow && (
        <div
          className="hub-minimap-arrow"
          style={{
            left:      arrow.left,
            top:       arrow.top,
            transform: `translate(-50%, -50%) rotate(${arrow.angle}rad)`,
          }}
          aria-hidden
        >
          ➤
        </div>
      )}

      {/* Corner minimap */}
      <div className="hub-minimap-wrap">
        {visible && (
          <canvas
            ref={canvasRef}
            className="hub-minimap-canvas"
            style={{ width: MM_W, height: MM_H }}
          />
        )}
        <button
          className="hub-minimap-toggle"
          onClick={toggle}
          title={visible ? 'Hide minimap' : 'Show minimap'}
        >
          🗺
        </button>
      </div>
    </>
  )
}
