/// <reference types="vite/client" />
import React, { useState, useEffect, useRef } from 'react'
import { spriteSlug } from '../game/sprites'

const BASE = import.meta.env.BASE_URL

// Canvas pixel size for 8-bit mode — sprites are drawn at this resolution then
// CSS scales them up to their normal display size with image-rendering: pixelated.
const EIGHTBIT_PX = 16

function is8bitMode(): boolean {
  return document.documentElement.classList.contains('eightbit-mode')
}

/** Draws src onto a tiny canvas and subscribes to 8-bit mode changes. */
function EightbitCanvas({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const img = new window.Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, EIGHTBIT_PX, EIGHTBIT_PX)
      ctx.drawImage(img, 0, 0, EIGHTBIT_PX, EIGHTBIT_PX)
    }
    img.src = src
  }, [src])

  return (
    <canvas
      ref={canvasRef}
      width={EIGHTBIT_PX}
      height={EIGHTBIT_PX}
      className={className}
      aria-label={alt}
    />
  )
}

interface Props {
  /** Unit or building name — used to derive the sprite slug. */
  name: string
  /** Optional secondary name to try if the primary name has no sprite file. */
  fallbackName?: string
  className?: string
}

/**
 * Tries to load `sprites/{slug}.png`, then `sprites/{slug}.svg`, then
 * `sprites/{fallbackSlug}.svg` (if fallbackName provided), then
 * `sprites/fallback.svg`. Renders nothing only if all fail.
 * In 8-bit mode renders via a low-res canvas for a pixelated look.
 */
export function SpriteImg({ name, fallbackName, className }: Props) {
  const slug            = spriteSlug(name)
  const pngSrc          = `${BASE}sprites/${slug}.png`
  const svgSrc          = `${BASE}sprites/${slug}.svg`
  const fallbackNameSrc = fallbackName ? `${BASE}sprites/${spriteSlug(fallbackName)}.svg` : null
  const genericSrc      = `${BASE}sprites/fallback.svg`

  const [src,     setSrc]     = useState(pngSrc)
  const [loaded,  setLoaded]  = useState(false)
  const [failed,  setFailed]  = useState(false)
  const [eightbit, setEightbit] = useState(is8bitMode)

  useEffect(() => {
    const handler = () => setEightbit(is8bitMode())
    window.addEventListener('eightbit-change', handler)
    return () => window.removeEventListener('eightbit-change', handler)
  }, [])

  if (failed) return null

  if (eightbit && loaded) {
    return <EightbitCanvas src={src} alt={name} className={className} />
  }

  return (
    <img
      src={src}
      alt={name}
      className={className}
      style={{ display: loaded ? undefined : 'none' }}
      onLoad={() => setLoaded(true)}
      onError={() => {
        if (src === pngSrc) setSrc(svgSrc)
        else if (src === svgSrc) setSrc(fallbackNameSrc ?? genericSrc)
        else if (fallbackNameSrc && src === fallbackNameSrc) setSrc(genericSrc)
        else setFailed(true)
      }}
    />
  )
}

interface AnimatedProps {
  /** Unit name — used to derive sprite slug and frame files like `{slug}-1.svg`. */
  name: string
  /** Number of animation frames (e.g. 3 for goblin-1/2/3). */
  frameCount: number
  /** Frames per second for the walking animation. */
  fps: number
  className?: string
}

/**
 * Cycles through `sprites/{slug}-1.svg … sprites/{slug}-{frameCount}.svg`.
 * Falls back to `SpriteImg` (static sprite) if frame files are missing.
 * In 8-bit mode renders each frame via a low-res canvas.
 */
export function AnimatedSpriteImg({ name, frameCount, fps, className }: AnimatedProps) {
  const slug = spriteSlug(name)
  const [frame,       setFrame]       = useState(1)
  const [useFallback, setUseFallback] = useState(false)
  const [eightbit,    setEightbit]    = useState(is8bitMode)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const handler = () => setEightbit(is8bitMode())
    window.addEventListener('eightbit-change', handler)
    return () => window.removeEventListener('eightbit-change', handler)
  }, [])

  useEffect(() => {
    if (useFallback) return
    intervalRef.current = setInterval(() => {
      setFrame(f => (f % frameCount) + 1)
    }, 1000 / fps)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [frameCount, fps, useFallback])

  if (useFallback) {
    return <SpriteImg name={name} className={className} />
  }

  const src = `${BASE}sprites/${slug}-${frame}.svg`

  if (eightbit) {
    return <EightbitCanvas src={src} alt={name} className={className} />
  }

  return (
    <img
      src={src}
      alt={name}
      className={className}
      onError={() => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setUseFallback(true)
      }}
    />
  )
}
