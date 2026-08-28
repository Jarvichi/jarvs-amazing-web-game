import React from 'react'

// ─── Reel gauge ───────────────────────────────────────────────────────────────
// The fight HUD: a vertical run showing where the fish is, where the player's
// reel band currently sits, and how full the landing gauge is. Hold REEL to
// lift the band; let go and it sinks. Overlap the fish to fill the gauge.

interface Props {
  /** Centre of the reel band, 0 (bottom) … 1 (top). */
  bandPos: number
  /** Band height as a fraction of the run. */
  bandSize: number
  /** The fish, same axis. */
  fishPos: number
  /** Landing gauge, 0 … 1. */
  gauge: number
  /** True while the fish is inside the band — the whole thing lights up. */
  holding: boolean
}

function pct(v: number) {
  return `${Math.min(100, Math.max(0, v * 100))}%`
}

export function ReelGauge({ bandPos, bandSize, fishPos, gauge, holding }: Props) {
  const bandBottom = Math.min(1 - bandSize, Math.max(0, bandPos - bandSize / 2))

  return (
    <div className={`reel-gauge${holding ? ' reel-gauge--hooked' : ''}`}>
      <div className="reel-run">
        <div className="reel-band" style={{ bottom: pct(bandBottom), height: pct(bandSize) }} />
        <div className="reel-fish" style={{ bottom: pct(fishPos) }}>🐟</div>
      </div>

      <div className="reel-progress">
        <div className="reel-progress-fill" style={{ height: pct(gauge) }} />
      </div>

      <div className="reel-gauge-labels">
        <span className="reel-gauge-label">LINE</span>
        <span className="reel-gauge-label">LANDED</span>
      </div>
    </div>
  )
}
