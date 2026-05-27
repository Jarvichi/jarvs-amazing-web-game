import React from 'react'
import { ModalBackdrop } from '../ui/ModalBackdrop'

interface Props {
  streak: number
  bestStreak: number
  onClose: () => void
}

export function StreakBrokenModal({ streak, bestStreak, onClose }: Props) {
  const wasPersonalBest = streak >= bestStreak

  return (
    <ModalBackdrop onClose={onClose} zIndex={600}>
      <div className="streak-broken-modal">
        <div className="streak-broken-icon">💔</div>
        <div className="streak-broken-heading">STREAK OVER</div>
        <div className="streak-broken-count">{streak}</div>
        <div className="streak-broken-label">
          win streak{streak === 1 ? '' : 's'} ended
        </div>
        {wasPersonalBest && (
          <div className="streak-broken-pb">That was your best ever.</div>
        )}
        <button className="action-btn streak-broken-btn" onClick={onClose}>
          Oof.
        </button>
      </div>
    </ModalBackdrop>
  )
}
