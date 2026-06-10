import rollbar from '../rollbar'

// ── WebGL context lifecycle telemetry ─────────────────────────────────────────
// Tracks how many PixiJS WebGL contexts are alive and how much GPU memory their
// canvas backing stores consume. iOS Safari kills the page (jetsam) when canvas
// memory spikes — e.g. a 2400×2240 hub map at devicePixelRatio 3 is a ~185 MB
// drawing buffer, transiently doubled while navigating away and back. These
// counters feed Rollbar so crashes can be correlated with canvas churn.

export interface GlStats {
  contextsCreatedTotal: number
  contextsDestroyedTotal: number
  liveContexts: number
  liveCanvasMB: number
  largestCanvasMB: number
}

interface ContextInfo {
  width: number
  height: number
  resolution: number
}

// Rollbar only hears about creations at or above these sizes — small canvases
// (battles, minigames, node map) would otherwise spam the quota.
const INFO_MB_THRESHOLD = 48
const WARN_MB_THRESHOLD = 100

let _createdTotal = 0
let _destroyedTotal = 0
let _liveMB: number[] = []
let _largestMB = 0

/** Estimated single-buffer size of a canvas drawing buffer, in MiB (RGBA).
 *  Real GPU cost is ~2× with double buffering; thresholds account for that. */
export function estimateCanvasMB(width: number, height: number, resolution: number): number {
  return (width * resolution) * (height * resolution) * 4 / (1024 * 1024)
}

export function getGlStats(): GlStats {
  return {
    contextsCreatedTotal: _createdTotal,
    contextsDestroyedTotal: _destroyedTotal,
    liveContexts: _liveMB.length,
    liveCanvasMB: Math.round(_liveMB.reduce((a, b) => a + b, 0)),
    largestCanvasMB: Math.round(_largestMB),
  }
}

export function noteContextCreated(info: ContextInfo): void {
  const estimatedMB = estimateCanvasMB(info.width, info.height, info.resolution)
  _createdTotal++
  _liveMB.push(estimatedMB)
  _largestMB = Math.max(_largestMB, estimatedMB)
  const stats = getGlStats()
  const payload = {
    width: info.width,
    height: info.height,
    resolution: info.resolution,
    dpr: window.devicePixelRatio || 1,
    estimatedMB: Math.round(estimatedMB),
    ...stats,
  }
  if (estimatedMB >= WARN_MB_THRESHOLD || (stats.liveContexts >= 2 && stats.liveCanvasMB >= WARN_MB_THRESHOLD)) {
    rollbar?.warn('[pixi] high GPU canvas memory', payload)
  } else if (estimatedMB >= INFO_MB_THRESHOLD || stats.liveContexts >= 2) {
    rollbar?.info('[pixi] webgl context created', payload)
  }
}

export function noteContextDestroyed(info: ContextInfo): void {
  const estimatedMB = estimateCanvasMB(info.width, info.height, info.resolution)
  _destroyedTotal++
  // Remove one live entry matching this size (closest match is fine — sizes are
  // only used in aggregate).
  let bestIdx = -1
  let bestDelta = Infinity
  for (let i = 0; i < _liveMB.length; i++) {
    const delta = Math.abs(_liveMB[i] - estimatedMB)
    if (delta < bestDelta) { bestDelta = delta; bestIdx = i }
  }
  if (bestIdx >= 0) _liveMB.splice(bestIdx, 1)
}

/** Test-only: reset module counters between cases. */
export function _resetGlStatsForTest(): void {
  _createdTotal = 0
  _destroyedTotal = 0
  _liveMB = []
  _largestMB = 0
}
