import { useEffect, useRef, useState, type RefObject } from 'react'

export interface LetterboxSize {
  width: number
  height: number
}

/**
 * Measures `containerRef` via ResizeObserver and returns the largest box that
 * preserves `aspectRatio` (width / height) while fitting inside the container —
 * the same scale-to-fit letterbox math HubMinimap.tsx uses for its own canvas
 * (`Math.min(availW/targetW, availH/targetH)`), generalized to any ratio.
 * Returns null until the first measurement, so callers can avoid rendering at 0x0.
 */
export function useLetterboxSize(
  containerRef: RefObject<HTMLElement | null>,
  aspectRatio: number,
): LetterboxSize | null {
  const [size, setSize] = useState<LetterboxSize | null>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const measure = () => {
      const { width: availW, height: availH } = el.getBoundingClientRect()
      if (availW <= 0 || availH <= 0) return
      const fitted = availW / availH > aspectRatio
        ? { width: availH * aspectRatio, height: availH }
        : { width: availW, height: availW / aspectRatio }
      setSize(prev => (prev && prev.width === fitted.width && prev.height === fitted.height) ? prev : fitted)
    }

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(measure)
    })
    ro.observe(el)
    measure()
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect() }
  }, [containerRef, aspectRatio])

  return size
}
