import React from 'react'

interface Props {
  label: string
  value: React.ReactNode
  compact?: boolean
  accent?: boolean
}

export function StatRow({ label, value, compact, accent }: Props) {
  return (
    <div className={`stat-row${compact ? ' stat-row--compact' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className={`stat-value${accent ? ' stat-value--accent' : ''}`}>{value}</span>
    </div>
  )
}
