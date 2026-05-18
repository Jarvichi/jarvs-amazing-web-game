import React from 'react'
import {
  CityState, DistrictType, DISTRICT_INFO,
  cycleDistrict, getRowDistrict, setRowDistrict,
} from '../../../game/cityBuilder'

// Re-export so CityBuilder can import it cleanly
export { cycleDistrict, getRowDistrict, setRowDistrict }

interface Props {
  city:    CityState
  onSave:  (next: CityState) => void
  onBack:  () => void
}

export function ZoneEditor({ city, onSave, onBack }: Props) {
  const rows = city.rows ?? 4

  function handleCycle(row: number) {
    const current = getRowDistrict(city, row)
    onSave(setRowDistrict(city, row, cycleDistrict(current)))
  }

  return (
    <div className="city-screen u-relative u-col u-gap-2">
      <div className="city-header u-flex u-items-c u-gap-3">
        <button className="action-btn" onClick={onBack}>← BACK</button>
        <div className="city-title">🗺 CITY DISTRICTS</div>
      </div>

      <div className="city-zones-hint">
        Designate each row as a district. Buildings in their matching zone get a production or income bonus.
      </div>

      <div className="city-zones-table">
        {/* District legend */}
        <div className="city-zones-legend">
          {(Object.entries(DISTRICT_INFO) as [DistrictType, typeof DISTRICT_INFO[DistrictType]][])
            .filter(([k]) => k !== 'none')
            .map(([key, info]) => (
              <div key={key} className="city-zones-legend-row">
                <span className="city-zones-legend-icon">{info.icon}</span>
                <span className="city-zones-legend-label">{info.label}</span>
                <span className="city-zones-legend-bonus">
                  {info.goldMult  ? `+${Math.round(info.goldMult  * 100)}% gold income` : ''}
                  {info.prodMult  ? `+${Math.round(info.prodMult  * 100)}% production`  : ''}
                  {info.defBonus  ? `+${Math.round(info.defBonus  * 100)}% defense`      : ''}
                </span>
              </div>
            ))}
        </div>

        {/* Row assignments */}
        <div className="city-zones-rows">
          {Array.from({ length: rows }, (_, row) => {
            const zone = getRowDistrict(city, row)
            const info = DISTRICT_INFO[zone]
            return (
              <button
                key={row}
                className="city-zones-row-btn"
                style={{ borderLeftColor: zone === 'none' ? '#1a3a1a' : info.color.replace('0.08', '0.6') }}
                onClick={() => handleCycle(row)}
                title="Click to cycle district type"
              >
                <span className="city-zones-row-label">ROW {row + 1}</span>
                <span className="city-zones-row-zone">
                  <span className="city-zones-row-icon">{info.icon}</span>
                  <span className="city-zones-row-name">{info.label}</span>
                </span>
                <span className="city-zones-row-hint">click to change →</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
