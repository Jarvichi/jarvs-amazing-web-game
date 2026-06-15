import React from 'react'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import {
  MAX_RELATIONSHIP_LEVEL,
  relationshipProgress,
  type RelationshipEntry,
  type RelationshipTrack,
} from '../../game/hub/relationships'

interface Props {
  npcName: string
  entry:   RelationshipEntry
  onClose: () => void
}

const TRACK_META: Record<RelationshipTrack, { icon: string; label: string; hint: string }> = {
  ally:    { icon: '🤝', label: 'Ally',    hint: 'Keep helping out — loyal allies open up unique requests.' },
  rival:   { icon: '⚔️', label: 'Rival',   hint: 'A heated rivalry — push back to unlock their challenges.' },
  romance: { icon: '💗', label: 'Romance', hint: 'Warm words are noticed — keep flirting to grow closer.' },
}

export function RelationshipView({ npcName, entry, onClose }: Props) {
  const meta = entry.track ? TRACK_META[entry.track] : null
  const { points, nextThreshold } = relationshipProgress(entry)

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="town-directory">
        <div className="town-directory__header">
          <span>{meta ? meta.icon : '🙂'} {npcName}</span>
          <button className="town-directory__close" onClick={onClose}>✕</button>
        </div>

        <div className="town-directory__list">
          <div className="town-directory__row">
            <div className="town-directory__info">
              <span className="town-directory__name">
                {meta ? `${meta.label} · Level ${entry.level}` : 'Acquaintance'}
              </span>
              <span className="town-directory__place">
                {meta
                  ? (nextThreshold !== null
                      ? `${points} / ${nextThreshold} pts to next level`
                      : `Maxed out (level ${MAX_RELATIONSHIP_LEVEL})`)
                  : 'You haven’t formed a bond yet — talk to them to begin.'}
              </span>
            </div>
          </div>

          {meta && (
            <div className="town-directory__row">
              <div className="town-directory__info">
                <span className="town-directory__place">💡 {meta.hint}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalBackdrop>
  )
}
