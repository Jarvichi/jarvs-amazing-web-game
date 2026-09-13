import React from 'react'
import { TabNav, TabNavItem } from '../../ui/TabNav'

export type LeaderboardMode = 'today' | 'allTime'

const ITEMS: TabNavItem<LeaderboardMode>[] = [
  { id: 'today', label: 'TODAY' },
  { id: 'allTime', label: 'ALL TIME' },
]

interface Props {
  mode: LeaderboardMode
  onChange: (mode: LeaderboardMode) => void
  panelId?: string
}

export function LeaderboardModeTabs({ mode, onChange, panelId }: Props) {
  return (
    <TabNav
      items={ITEMS}
      activeId={mode}
      onSelect={onChange}
      ariaLabel="Leaderboard time range"
      panelId={panelId}
    />
  )
}
