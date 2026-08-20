import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Tracks an element's rendered height via ResizeObserver, rAF-debounced — the
 * same measure-and-store shape as useLetterboxSize, narrowed to one axis.
 *
 * Exists so a layout can reserve space for a box by *measuring* it rather than
 * hardcoding what someone once measured by hand. The battlefield reserved its
 * HUD bands as fixed pixel constants in three breakpoint tiers; the HUD then
 * grew past them and the bars silently began overlapping the play area. Numbers
 * like that are only ever correct on the day they are written.
 *
 * Returns null until the first measurement so callers can fall back to a CSS
 * default for the first paint instead of collapsing to 0.
 */
export function useMeasuredHeight(ref: RefObject<HTMLElement | null>): number | null {
  const [height, setHeight] = useState<number | null>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      // Round up: a fractional height that rounds down leaves a sub-pixel of the
      // cluster outside its own reserved band — the exact bug this hook prevents.
      const next = Math.ceil(el.getBoundingClientRect().height)
      if (next > 0) setHeight(prev => (prev === next ? prev : next))
    }

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(measure)
    })
    ro.observe(el)
    measure()
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect() }
  }, [ref])

  return height
}
