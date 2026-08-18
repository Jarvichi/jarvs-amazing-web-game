import React from 'react'
import { Icon } from '../../ui/icons/Icon'

interface Props {
  dailyLabel: string
  dailyStreak: number
  dailyResetLabel: string
  onDaily: () => void
  weeklyLabel: string
  weeklyResetLabel: string
  onWeekly: () => void
  onLeaderboards: () => void
}

/** Time-boxed modes — Daily/Weekly challenges surface their streak and time
 *  remaining instead of looking like permanent modes; Leaderboards groups
 *  alongside them as the other competitive/periodic destination. */
export function PeriodicRow({ dailyLabel, dailyStreak, dailyResetLabel, onDaily, weeklyLabel, weeklyResetLabel, onWeekly, onLeaderboards }: Props) {
  return (
    <div className="title-periodic-row">
      <button type="button" className="title-tier-btn title-tier-btn--periodic" onClick={onDaily}>
        <Icon name="calendar" size={14} />
        <span className="title-periodic-label">{dailyLabel}</span>
        <span className="title-periodic-meta">
          {dailyStreak > 0 && <span className="title-periodic-streak">🔥{dailyStreak}</span>}
          <span className="title-periodic-reset">{dailyResetLabel}</span>
        </span>
      </button>
      <button type="button" className="title-tier-btn title-tier-btn--periodic" onClick={onWeekly}>
        <Icon name="calendar" size={14} />
        <span className="title-periodic-label">{weeklyLabel}</span>
        <span className="title-periodic-meta">
          <span className="title-periodic-reset">{weeklyResetLabel}</span>
        </span>
      </button>
      <button type="button" className="title-tier-btn title-tier-btn--periodic" onClick={onLeaderboards}>
        <Icon name="trophy" size={14} />
        <span className="title-periodic-label">LEADERBOARDS</span>
      </button>
    </div>
  )
}
