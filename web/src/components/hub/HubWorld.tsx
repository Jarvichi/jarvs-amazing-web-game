import React, { useState, useCallback } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { HubTownCanvas } from './HubTownCanvas'
import { AreaNameBadge } from './AreaNameBadge'

interface Props {
  onBack: () => void
}

export function HubWorld({ onBack }: Props) {
  const [currentArea, setCurrentArea] = useState<string | null>(null)
  const handleAreaEnter = useCallback((name: string | null) => { setCurrentArea(name) }, [])

  return (
    <OverlayScreen onBack={onBack} title="HUB WORLD" subtitle="Coming soon">
      <div
        className="nm-map nm-map--camp"
        style={{ position: 'relative', flex: 1, overflow: 'hidden' }}
      >
        <div style={{ overflowX: 'auto', overflowY: 'auto', width: '100%', height: '100%' }}>
          <HubTownCanvas onAreaEnter={handleAreaEnter} />
        </div>
        <AreaNameBadge name={currentArea} />
      </div>
    </OverlayScreen>
  )
}
