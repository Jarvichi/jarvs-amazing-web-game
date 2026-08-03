import { useRef, useState, useEffect, useCallback } from 'react'
import { ZOOM_STEPS } from './CityZoomControls'

export interface ZoomPanControls {
  wrapperRef:   React.RefObject<HTMLDivElement>
  displayScale: number
  stepZoom:     (dir: 1 | -1) => void
  zoomTo:       (targetScale: number) => void
  getCellFromPoint: (clientX: number, clientY: number, cols: number, rows: number) => number
  /** Client coords → untransformed wrapper-local pixels (the space walkers live in). */
  getLocalPoint: (clientX: number, clientY: number) => { x: number; y: number } | null
}

/**
 * Shared zoom / pan behaviour for grid-based views (city, farm).
 * @param containerRef  ref to the scrollable/clipped outer div (used for bounds)
 * @param paintBrush    when true, single-touch/mouse-drag triggers paint not pan
 * @param onPaint       called during paint drag with the cell index under the pointer
 */
export function useZoomPan(
  containerRef: React.RefObject<HTMLDivElement>,
  paintBrush = false,
  onPaint?: (index: number) => void,
): ZoomPanControls {
  const wrapperRef      = useRef<HTMLDivElement>(null)
  const tRef            = useRef({ s: 1, x: 0, y: 0 })
  const [displayScale, setDisplayScale] = useState(1)

  const isPaintingRef   = useRef(false)
  const lastPaintedRef  = useRef(-1)
  const isPanningRef    = useRef(false)
  const panStartRef     = useRef({ px: 0, py: 0, tx: 0, ty: 0 })
  const pinchStartRef   = useRef({ dist: 0, s: 1, cx: 0, cy: 0, tx: 0, ty: 0 })
  const isPinchingRef   = useRef(false)

  // Keep paintBrush visible to event handlers without re-registering them
  const paintBrushRef = useRef(paintBrush)
  useEffect(() => { paintBrushRef.current = paintBrush }, [paintBrush])
  const onPaintRef = useRef(onPaint)
  useEffect(() => { onPaintRef.current = onPaint }, [onPaint])

  function applyTransform(s = tRef.current.s, x = tRef.current.x, y = tRef.current.y) {
    if (!wrapperRef.current) return
    wrapperRef.current.style.transform = `matrix(${s},0,0,${s},${x},${y})`
  }

  function clamp(s: number, x: number, y: number) {
    const el = containerRef.current
    const cw = el?.clientWidth  ?? 300
    const ch = el?.clientHeight ?? 300
    s = Math.max(1, Math.min(4, s))
    x = s <= 1 ? 0 : Math.max(-(s - 1) * cw, Math.min(0, x))
    y = s <= 1 ? 0 : Math.max(-(s - 1) * ch, Math.min(0, y))
    return { s, x, y }
  }

  function setTransform(s: number, x: number, y: number, updateDisplay = false) {
    const t = clamp(s, x, y)
    tRef.current = t
    applyTransform(t.s, t.x, t.y)
    if (updateDisplay) setDisplayScale(t.s)
  }

  const zoomTo = useCallback((targetScale: number) => {
    const el = containerRef.current
    const cw = el?.clientWidth  ?? 300
    const ch = el?.clientHeight ?? 300
    const { s, x, y } = tRef.current
    const cx = cw / 2, cy = ch / 2
    const factor = targetScale / s
    setTransform(targetScale, cx - (cx - x) * factor, cy - (cy - y) * factor, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef])

  const stepZoom = useCallback((dir: 1 | -1) => {
    const cur = tRef.current.s
    const next = dir > 0
      ? ZOOM_STEPS.find(z => z > cur + 0.01) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]
      : [...ZOOM_STEPS].reverse().find(z => z < cur - 0.01) ?? ZOOM_STEPS[0]
    zoomTo(next)
  }, [zoomTo])

  const getLocalPoint = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const { s, x, y } = tRef.current
    return { x: (clientX - rect.left - x) / s, y: (clientY - rect.top - y) / s }
  }, [containerRef])

  const getCellFromPoint = useCallback((clientX: number, clientY: number, cols: number, rows: number): number => {
    const el = containerRef.current
    const p  = getLocalPoint(clientX, clientY)
    if (!el || !p) return -1
    const rect = el.getBoundingClientRect()
    const col = Math.floor((p.x / rect.width)  * cols)
    const row = Math.floor((p.y / rect.height) * rows)
    if (col < 0 || col >= cols || row < 0 || row >= rows) return -1
    return row * cols + col
  }, [containerRef, getLocalPoint])

  // Wheel zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { s, x, y } = tRef.current
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const delta = e.deltaY > 0 ? 0.85 : 1 / 0.85
      const sNew = Math.max(1, Math.min(4, s * delta))
      const factor = sNew / s
      setTransform(sNew, cx - (cx - x) * factor, cy - (cy - y) * factor, true)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef])

  // Touch: pinch zoom + pan + paint
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function touchDist(t: TouchList) {
      const dx = t[1].clientX - t[0].clientX
      const dy = t[1].clientY - t[0].clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    const onTouchStart = (e: TouchEvent) => {
      if ((e.target as Element).closest('.city-zoom-controls')) return
      if (e.touches.length === 1) {
        const { s } = tRef.current
        if (paintBrushRef.current) {
          isPaintingRef.current = true
          lastPaintedRef.current = -1
          e.preventDefault()
        } else if (s > 1) {
          panStartRef.current = { px: e.touches[0].clientX, py: e.touches[0].clientY, tx: tRef.current.x, ty: tRef.current.y }
        }
      } else if (e.touches.length === 2) {
        isPaintingRef.current = false
        isPanningRef.current  = false
        isPinchingRef.current = true
        const dist = touchDist(e.touches)
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
        pinchStartRef.current = { dist, s: tRef.current.s, cx, cy, tx: tRef.current.x, ty: tRef.current.y }
        e.preventDefault()
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 1) {
        if (isPaintingRef.current && paintBrushRef.current) {
          // paint index resolved by caller
        } else if (tRef.current.s > 1 && !isPinchingRef.current) {
          isPanningRef.current = true
          const { px, py, tx, ty } = panStartRef.current
          setTransform(tRef.current.s, tx + e.touches[0].clientX - px, ty + e.touches[0].clientY - py)
        }
      } else if (e.touches.length === 2 && isPinchingRef.current) {
        const dist = touchDist(e.touches)
        const { dist: d0, s: s0, cx: cx0, cy: cy0, tx: tx0, ty: ty0 } = pinchStartRef.current
        const sNew = s0 * (dist / d0)
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
        const rect = el.getBoundingClientRect()
        const pivot_x = cx0 - rect.left
        const pivot_y = cy0 - rect.top
        const factor = sNew / s0
        const xNew = pivot_x - (pivot_x - tx0) * factor + (cx - cx0)
        const yNew = pivot_y - (pivot_y - ty0) * factor + (cy - cy0)
        setTransform(sNew, xNew, yNew)
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        isPaintingRef.current = false
        isPanningRef.current  = false
        if (isPinchingRef.current) setDisplayScale(tRef.current.s)
        isPinchingRef.current = false
      } else if (e.touches.length === 1) {
        if (isPinchingRef.current) setDisplayScale(tRef.current.s)
        isPinchingRef.current = false
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd,   { passive: false })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef])

  // Mouse pan (desktop, when zoomed in)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as Element).closest('.city-zoom-controls')) return
      if (paintBrushRef.current || tRef.current.s <= 1) return
      if (e.button !== 0) return
      isPanningRef.current = true
      panStartRef.current  = { px: e.clientX, py: e.clientY, tx: tRef.current.x, ty: tRef.current.y }
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return
      const { px, py, tx, ty } = panStartRef.current
      setTransform(tRef.current.s, tx + e.clientX - px, ty + e.clientY - py)
    }
    const onMouseUp = () => { isPanningRef.current = false }
    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('mouseup',   onMouseUp)
    el.addEventListener('mouseleave', onMouseUp)
    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('mouseup',   onMouseUp)
      el.removeEventListener('mouseleave', onMouseUp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef])

  return { wrapperRef, displayScale, stepZoom, zoomTo, getCellFromPoint, getLocalPoint }
}
