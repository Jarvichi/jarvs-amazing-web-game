import React, { useState, useCallback, useEffect, useRef } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { HubTownCanvas } from './HubTownCanvas'
import { AreaNameBadge } from './AreaNameBadge'
import { HubReturnButton } from './HubReturnButton'
import { AVATAR_START, MAP_W, MAP_H } from '../../data/hubLayout'

const T = 32
const INITIAL_SCROLL = {
  x: AVATAR_START[0] * T + T / 2,
  y: AVATAR_START[1] * T + T / 2,
}

interface Props {
  onBack:       () => void
  onNavigate?:  (screen: string) => void
}

export function HubWorld({ onBack, onNavigate }: Props) {
  const [currentArea, setCurrentArea] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const returnRef = useRef(null) as React.MutableRefObject<(() => void) | null>

  // Centre viewport on avatar's pixel position.
  const handleAvatarMove = useCallback((px: number, py: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = px - el.clientWidth  / 2
    el.scrollTop  = py - el.clientHeight / 2
  }, [])

  // Set initial scroll to courtyard on mount.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = INITIAL_SCROLL.x - el.clientWidth  / 2
    el.scrollTop  = INITIAL_SCROLL.y - el.clientHeight / 2
  }, [])

  const handleNodeInteract = useCallback((screen: string) => {
    onNavigate?.(screen)
  }, [onNavigate])

  const handleReturn = useCallback(() => {
    returnRef.current?.()
  }, [])

  return (
    <OverlayScreen onBack={onBack} title="HUB WORLD" subtitle="Coming soon">
      <div
        className="nm-map nm-map--camp"
        style={{ position: 'relative', flex: 1, overflow: 'hidden' }}
      >
        <div
          ref={scrollRef}
          style={{ overflowX: 'auto', overflowY: 'auto', width: '100%', height: '100%' }}
        >
          <HubTownCanvas
            onAreaEnter={setCurrentArea}
            onNodeInteract={handleNodeInteract}
            onAvatarMove={handleAvatarMove}
            returnRef={returnRef}
          />
        </div>
        <AreaNameBadge name={currentArea} />
        <HubReturnButton onClick={handleReturn} />
      </div>
    </OverlayScreen>
  )
}
