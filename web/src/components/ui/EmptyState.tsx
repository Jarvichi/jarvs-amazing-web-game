import React from 'react'

interface Props {
  /** The message. Keep it a sentence, not a shout — "No saved decks yet." */
  children: React.ReactNode
  /** Optional glyph above the message. An emoji string or an <Icon>. */
  icon?: React.ReactNode
  /** Optional second line: what the player can do about it. */
  hint?: React.ReactNode
  /**
   * `md` (default) fills a panel or a screen's content area. `sm` is for a
   * message inside a list or a short section, where `md`'s padding would
   * push the surrounding chrome around.
   */
  size?: 'sm' | 'md'
  className?: string
}

/**
 * "There's nothing here yet."
 *
 * Every screen used to answer this its own way — 19 classes across 44 call
 * sites, disagreeing on colour (eight of them), size (seven), padding (six)
 * and even alignment: most centred, but the inventory, the endless
 * leaderboard and both challenge screens left-aligned, so the same message
 * sat in a different place depending on where you hit it.
 *
 * Colour resolves through `--empty-state-color`, so a surface with its own
 * palette (a hub modal, the satchel sheet, a city-builder panel) retints it
 * from an ancestor rather than restyling it. See `.empty-state` in panels.css.
 */
export function EmptyState({ children, icon, hint, size = 'md', className }: Props) {
  const classes = ['empty-state', `empty-state--${size}`, className].filter(Boolean).join(' ')
  return (
    <div className={classes}>
      {icon && <div className="empty-state__icon" aria-hidden="true">{icon}</div>}
      <div className="empty-state__msg">{children}</div>
      {hint && <div className="empty-state__hint">{hint}</div>}
    </div>
  )
}
