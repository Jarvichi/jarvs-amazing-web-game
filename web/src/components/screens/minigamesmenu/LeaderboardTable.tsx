import React from 'react'
import { MiniGameLeaderboardEntry } from '../../../game/miniGames'
import { EmptyState } from '../../ui/EmptyState'

interface Props {
  loading: boolean
  entries: MiniGameLeaderboardEntry[]
}

export function LeaderboardTable({ loading, entries }: Props) {
  if (loading) return <div className="lb-loading">Loading...</div>
  if (entries.length === 0) return <EmptyState size="sm" hint="Be the first!">No scores yet.</EmptyState>
  return (
    <ol className="lb-list">
      {entries.map((e, i) => (
        <li key={e.uid} className="lb-entry">
          <span className="lb-rank">{i + 1}</span>
          <span className="lb-name">{e.characterName}</span>
          <span className="lb-score">{e.score} 🎫</span>
        </li>
      ))}
    </ol>
  )
}
