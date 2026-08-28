import React from 'react'
import { DEEP_CAST_POWER, castDistanceLabel } from '../Fishing.physics'

// ─── Cast power meter ─────────────────────────────────────────────────────────
// The sweep the player stops to set how far the float lands. The bar is shaded
// margin → deep channel so the trade-off reads at a glance: the far end holds
// the big fish, but they fight hardest and keep you waiting longest.

interface Props {
  /** Live meter position while charging, or the locked power once cast. */
  power: number
  /** Once the float is down, the meter stops being a control and becomes a
   *  read-out of where the cast actually landed. */
  locked?: boolean
}

export function CastMeter({ power, locked = false }: Props) {
  return (
    <div className={`cast-meter${locked ? ' cast-meter--locked' : ''}`}>
      <div className="cast-meter-head">
        <span className="cast-meter-label">{locked ? 'CAST LANDED' : 'CAST POWER'}</span>
        <span className="cast-meter-distance">{castDistanceLabel(power)}</span>
      </div>

      <div className="cast-meter-track">
        <div className="cast-meter-fill" style={{ width: `${power}%` }} />
        <div className="cast-meter-deep" style={{ left: `${DEEP_CAST_POWER}%` }} />
        <div className="cast-meter-marker" style={{ left: `${power}%` }} />
      </div>

      <div className="cast-meter-foot">
        <span>◂ SHORE</span>
        <span className="cast-meter-deep-label">DEEP WATER ▸</span>
      </div>
    </div>
  )
}
