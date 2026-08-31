import React from 'react'
import { OverlayScreen } from '../../ui/OverlayScreen'
import { EmptyState } from '../../ui/EmptyState'

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
          <EmptyState hint="Build, expand, and defend your city.">No events recorded yet.</EmptyState>
        ) : (
          chronicle.map((entry, i) => (
            <div key={i} className="city-chronicle-entry">{entry}</div>
          ))
        )}
      </div>
    </OverlayScreen>
  )
}
