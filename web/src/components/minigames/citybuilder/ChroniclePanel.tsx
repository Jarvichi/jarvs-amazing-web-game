import React from 'react'

export interface Props {
  chronicle: string[]
  onBack:    () => void
}

export function ChroniclePanel({ chronicle, onBack }: Props) {
  return (
    <div className="city-screen u-relative u-col u-gap-2">
      <div className="city-header u-flex u-items-c u-gap-3">
        <button className="action-btn" onClick={onBack}>← BACK</button>
        <div className="city-title">📜 CITY CHRONICLE</div>
      </div>

      <div className="city-chronicle-list">
        {chronicle.length === 0 ? (
          <div className="city-chronicle-empty">No events recorded yet. Build, expand, and defend your city!</div>
        ) : (
          chronicle.map((entry, i) => (
            <div key={i} className="city-chronicle-entry">{entry}</div>
          ))
        )}
      </div>
    </div>
  )
}
