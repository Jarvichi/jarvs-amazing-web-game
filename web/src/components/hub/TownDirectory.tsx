import React, { useState } from 'react'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import type { HubLocationBundle } from '../../data/hub/loader'
import { useHubClock } from '../../hooks/useHubClock'
import { resolveNpcPlace } from '../../game/hub/npcLocator'
import { getFriendshipLevel } from '../../game/hub/friendship'

interface Props {
  onClose:      () => void
  locationData: HubLocationBundle
  pinnedNpcId:  string | null
  onTogglePin:  (npcId: string) => void
}

export function TownDirectory({ onClose, locationData, pinnedNpcId, onTogglePin }: Props) {
  const { gameHour } = useHubClock()
  const [onlyMet, setOnlyMet] = useState(false)

  // Named NPCs only (skip ambient/unnamed). De-dupe by id for safety.
  const seen = new Set<string>()
  const named = locationData.HUB_NPCS.filter(n => {
    if (!n.name?.trim() || seen.has(n.id)) return false
    seen.add(n.id)
    return true
  })

  const visible = (onlyMet ? named.filter(n => getFriendshipLevel(n.id) > 0) : named)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="town-directory">
        <div className="town-directory__header">
          <span>🧭 Where is…?</span>
          <span className="town-directory__meta">
            {visible.length} {visible.length === 1 ? 'person' : 'people'}
            <button className="town-directory__close" onClick={onClose}>✕</button>
          </span>
        </div>

        <button
          className={`town-directory__filter${onlyMet ? ' town-directory__filter--on' : ''}`}
          onClick={() => setOnlyMet(v => !v)}
        >
          {onlyMet ? '☑' : '☐'} Only people I've met
        </button>

        {visible.length === 0 ? (
          <div className="town-directory__empty">
            {onlyMet ? "You haven't met anyone yet — explore the town." : 'No one is around right now.'}
          </div>
        ) : (
          <div className="town-directory__list">
            {visible.map(npc => {
              const place  = resolveNpcPlace(npc, gameHour, locationData)
              const pinned = pinnedNpcId === npc.id
              return (
                <div key={npc.id} className="town-directory__row">
                  <div className="town-directory__info">
                    <span className="town-directory__name">{npc.name}</span>
                    <span className="town-directory__place">📍 {place.name}</span>
                  </div>
                  <button
                    className={`town-directory__pin-btn${pinned ? ' town-directory__pin-btn--on' : ''}`}
                    onClick={() => onTogglePin(npc.id)}
                    title={pinned ? 'Hide on minimap' : 'Show on minimap'}
                  >
                    {pinned ? '📌 Pinned' : '📍 Show on map'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </ModalBackdrop>
  )
}
