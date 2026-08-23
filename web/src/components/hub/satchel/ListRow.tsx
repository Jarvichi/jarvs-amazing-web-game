import React from 'react'

interface Props {
  icon?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Right-aligned figure — a count, price or chevron. */
  value?: React.ReactNode
  /** Draws a progress bar under the title. `tone` 'gold' marks a bounty. */
  progress?: { current: number; required: number; tone?: 'green' | 'gold' }
  onClick?: () => void
  /** Trailing controls (buttons/chips). Rendered outside the tappable area. */
  actions?: React.ReactNode
  tone?: 'default' | 'gold' | 'dim'
}

/** The workhorse row: ~40px, icon + name + optional sub-line + right-aligned
 *  figure. Archives are built from these rather than from cards — a bordered
 *  card is reserved for something the player can act on. */
export function ListRow({ icon, title, subtitle, value, progress, onClick, actions, tone = 'default' }: Props) {
  const pct = progress && progress.required > 0
    ? Math.max(0, Math.min(100, (progress.current / progress.required) * 100))
    : 0

  const body = (
    <>
      {icon != null && <span className="satchel-row__icon" aria-hidden="true">{icon}</span>}
      <span className="satchel-row__label">
        <span className="satchel-row__title">{title}</span>
        {subtitle != null && <span className="satchel-row__subtitle">{subtitle}</span>}
        {progress && (
          <span className={`satchel-row__bar satchel-row__bar--${progress.tone ?? 'green'}`}>
            <i style={{ width: `${pct}%` }} />
          </span>
        )}
      </span>
      {value != null && <span className="satchel-row__value">{value}</span>}
    </>
  )

  return (
    <div className={`satchel-row satchel-row--${tone}`}>
      {onClick
        ? <button type="button" className="satchel-row__main satchel-row__main--tappable" onClick={onClick}>{body}</button>
        : <div className="satchel-row__main">{body}</div>}
      {actions != null && <div className="satchel-row__actions">{actions}</div>}
    </div>
  )
}
