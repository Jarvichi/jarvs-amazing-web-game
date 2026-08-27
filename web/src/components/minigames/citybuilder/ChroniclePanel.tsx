import React from 'react'
import { OverlayScreen } from '../../ui/OverlayScreen'

export interface Props {
  chronicle: string[]
  onBack:    () => void
}

export function ChroniclePanel({ chronicle, onBack }: Props) {
  return (
    <OverlayScreen
      title="📜 CITY CHRONICLE"
      onBack={onBack}
      className="city-screen u-relative u-col u-gap-2"
    >
      <div className="city-chronicle-list">
        {chronicle.length === 0 ? (
          <div className="city-chronicle-empty">No events recorded yet. Build, expand, and defend your city!</div>
        ) : (
          chronicle.map((entry, i) => (
            <div key={i} className="city-chronicle-entry">{entry}</div>
          ))
        )}
      </div>
    </OverlayScreen>
  )
}
