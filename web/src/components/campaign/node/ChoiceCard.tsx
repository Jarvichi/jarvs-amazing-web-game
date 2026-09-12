import React from 'react'
import { Button } from '../../ui/Button'

interface Props {
  icon: React.ReactNode
  name: string
  desc: string
  chosen: boolean
  exotic?: boolean
  onClick?: () => void
  disabled?: boolean
  title?: string
  /** Extra class(es) — e.g. the relic picker's "no relic" card, which dims
   *  itself until chosen. */
  className?: string
  /** Staggered entrance delay for a grid of these — `{ animationDelay: '60ms' }`. */
  style?: React.CSSProperties
}

/** One pickable card in a single-select grid — the relic picker and the
 *  permanent-stat-upgrade screen both offer "choose one of these" and were
 *  each hand-rolling the same card shape. */
export function ChoiceCard({ icon, name, desc, chosen, exotic, onClick, disabled, title, className, style }: Props) {
  return (
    <Button
      className={`relic-select-card${exotic ? ' relic-select-card--exotic' : ''}${chosen ? ' relic-select-card--chosen' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {exotic && <div className="relic-exotic-tag">EXOTIC</div>}
      <div className="relic-select-icon">{icon}</div>
      <div className="relic-select-name">{name}</div>
      <div className="relic-select-desc">{desc}</div>
    </Button>
  )
}
