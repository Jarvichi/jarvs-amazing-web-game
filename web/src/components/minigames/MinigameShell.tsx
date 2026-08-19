import React from 'react'

interface Props {
  title: string
  icon?: string
  /** Right-aligned score/state readout (tickets, lives, credits, timer…). */
  stat?: React.ReactNode
  /** Extra class appended alongside "minigame-screen", for a game that needs
   *  a little of its own layout on top of the shared frame (e.g. a gap
   *  between scene/status/controls sections). */
  className?: string
  children: React.ReactNode
}

/**
 * Shared minigame frame — title/icon on the left, a score-or-state readout
 * on the right, body below. Formalizes the "minigame-screen" convention
 * already used ad-hoc by nearly every arcade game so headers read the same
 * everywhere instead of each game hand-rolling its own title row.
 */
export function MinigameShell({ title, icon, stat, className, children }: Props) {
  return (
    <div className={['minigame-screen', className].filter(Boolean).join(' ')}>
      <div className="minigame-header">
        <div className="minigame-title">{icon ? `${icon} ` : ''}{title}</div>
        {stat && <div className="minigame-header-stat">{stat}</div>}
      </div>
      {children}
    </div>
  )
}
