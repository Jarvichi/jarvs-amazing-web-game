/// <reference types="vite/client" />
import React, { useState, useEffect, useRef } from 'react'
import { spriteSlug } from '../../game/sprites'

const BASE = import.meta.env.BASE_URL

// Canvas pixel size for 8-bit mode — sprites are drawn at this resolution then
// CSS scales them up to their normal display size with image-rendering: pixelated.
const EIGHTBIT_PX = 16

function is8bitMode(): boolean {
  return document.documentElement.classList.contains('eightbit-mode')
}

function isMonochromeMode(): boolean {
  return document.documentElement.classList.contains('monochrome-mode')
}

/** Draws src onto a tiny canvas and subscribes to 8-bit mode changes. */
function EightbitCanvas({ src, alt, className, style, onError }: { src: string; alt: string; className?: string; style?: React.CSSProperties; onError?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    const img = new window.Image()
    img.onload = () => {
      if (cancelled) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, EIGHTBIT_PX, EIGHTBIT_PX)
      ctx.drawImage(img, 0, 0, EIGHTBIT_PX, EIGHTBIT_PX)
    }
    img.onerror = () => { if (!cancelled) onError?.() }
    img.src = src
    return () => { cancelled = true }
  }, [src, onError])

  return (
    <canvas
      ref={canvasRef}
      width={EIGHTBIT_PX}
      height={EIGHTBIT_PX}
      className={className}
      style={style}
      aria-label={alt}
    />
  )
}

/** Draws src onto a black and white canvas. */
function MonochromeCanvas({ src, alt, className, style, onError }: { src: string; alt: string; className?: string; style?: React.CSSProperties; onError?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    const img = new window.Image()
    img.onload = () => {
      if (cancelled) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      canvas.width  = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      for (let i = 0; i < imageData.data.length; i += 4) {
        const gray = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3
        imageData.data[i] = imageData.data[i + 1] = imageData.data[i + 2] = gray
      }
      ctx.putImageData(imageData, 0, 0)
    }
    img.onerror = () => { if (!cancelled) onError?.() }
    img.src = src
    return () => { cancelled = true }
  }, [src, onError])

  return <canvas ref={canvasRef} className={className} style={style} aria-label={alt} />
}


interface Props {
  /** Unit or building name — used to derive the sprite slug. */
  name: string
  /** Optional secondary name to try if the primary name has no sprite file. */
  fallbackName?: string
  className?: string
  style?: React.CSSProperties
}

/**
 * Tries to load `sprites/{slug}.png`, then `sprites/{slug}.svg`, then
 * `sprites/{fallbackSlug}.svg` (if fallbackName provided), then
 * `sprites/fallback.svg`. Renders nothing only if all fail.
 * In 8-bit mode renders via a low-res canvas for a pixelated look.
 */
export function SpriteImg({ name, fallbackName, className, style }: Props) {
  const slug            = spriteSlug(name)
  const pngSrc          = `${BASE}sprites/${slug}.png`
  const svgSrc          = `${BASE}sprites/${slug}.svg`
  const fallbackNameSrc = fallbackName ? `${BASE}sprites/${spriteSlug(fallbackName)}.svg` : null
  const genericSrc      = `${BASE}sprites/fallback.svg`

  const [src,     setSrc]     = useState(pngSrc)
  const [loaded,  setLoaded]  = useState(false)
  const [failed,  setFailed]  = useState(false)
  const [eightbit, setEightbit] = useState(is8bitMode)
  const [monochrome, setMonochrome] = useState(isMonochromeMode)
  const prevNameRef = useRef(name)

  useEffect(() => {
    const handler = () => setEightbit(is8bitMode())
    window.addEventListener('eightbit-change', handler)
    return () => window.removeEventListener('eightbit-change', handler)
  }, [])

  useEffect(() => {
    const handler = () => setMonochrome(isMonochromeMode())
    window.addEventListener('monochrome-change', handler)
    return () => window.removeEventListener('monochrome-change', handler)
  }, [])

  // When name changes, preload the new image before swapping src so the old
  // sprite stays visible (no flash) until the new one is ready.
  useEffect(() => {
    if (name === prevNameRef.current) return
    prevNameRef.current = name
    const newSlug   = spriteSlug(name)
    const newPng    = `${BASE}sprites/${newSlug}.png`
    const newSvg    = `${BASE}sprites/${newSlug}.svg`
    const newFb     = fallbackName ? `${BASE}sprites/${spriteSlug(fallbackName)}.svg` : genericSrc
    let cancelled   = false
    const tryLoad = (srcs: string[], idx = 0) => {
      if (cancelled || idx >= srcs.length) return
      const img = new window.Image()
      img.onload  = () => { if (!cancelled) { setFailed(false); setSrc(srcs[idx]) } }
      img.onerror = () => tryLoad(srcs, idx + 1)
      img.src = srcs[idx]
    }
    tryLoad([newPng, newSvg, newFb, genericSrc])
    return () => { cancelled = true }
  }, [name, fallbackName, genericSrc])

  if (failed) return null

  if (eightbit && loaded) {
    return <EightbitCanvas src={src} alt={name} className={className} style={style} />
  }
  if (monochrome && loaded) {
    return <MonochromeCanvas src={src} alt={name} className={className} style={style} />
  }

  return (
    <img
      src={src}
      alt={name}
      className={className}
      style={{ display: loaded ? undefined : 'none', ...style }}
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
  style?: React.CSSProperties
}

/**
 * Cycles through `sprites/{slug}-1.svg … sprites/{slug}-{frameCount}.svg`.
 * Falls back to `SpriteImg` (static sprite) if frame files are missing.
 * In 8-bit mode renders each frame via a low-res canvas.
 */
export function AnimatedSpriteImg({ name, frameCount, fps, className, style }: AnimatedProps) {
  const slug = spriteSlug(name)
  const [frame,       setFrame]       = useState(1)
  const [useFallback, setUseFallback] = useState(false)
  const [eightbit,    setEightbit]    = useState(is8bitMode)
  const [monochrome, setMonochrome]    = useState(isMonochromeMode)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const handler = () => setEightbit(is8bitMode())
    window.addEventListener('eightbit-change', handler)
    return () => window.removeEventListener('eightbit-change', handler)
  }, [])
  useEffect(() => {
    const handler = () => setMonochrome(isMonochromeMode())
    window.addEventListener('monochrome-change', handler)
    return () => window.removeEventListener('monochrome-change', handler)
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
    return <SpriteImg name={name} className={className} style={style} />
  }

  const src = `${BASE}sprites/${slug}-${frame}.svg`

  const handleFrameError = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setUseFallback(true)
  }

  if (eightbit) {
    return <EightbitCanvas src={src} alt={name} className={className} style={style} onError={handleFrameError} />
  }
  if (monochrome) {
    return <MonochromeCanvas src={src} alt={name} className={className} style={style} onError={handleFrameError} />
  }


  return (
    <img
      src={src}
      alt={name}
      className={className}
      style={style}
      onError={() => {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setUseFallback(true)
      }}
    />
  )
}
