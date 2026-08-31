import React from 'react'
import { Icon } from './icons/Icon'

export type CloseButtonVariant = 'ghost' | 'framed'

interface Props {
  onClick: () => void
  /**
   * `ghost` (default) — borderless, inherits the surface's colour. `framed`
   * is the standard Modal shell's bordered square.
   */
  variant?: CloseButtonVariant
  /** Accessible name. Defaults to "Close". */
  label?: string
  /** Icon size in px. 14 suits a dense header row; 16 a full-width sheet. */
  size?: number
  className?: string
}

/**
 * The dismiss control on any surface that has one.
 *
 * There used to be five: four byte-identical copies across the hub modals
 * (`.pet-modal__close`, `.quests-modal__close`, `.bounty-board-modal__close`,
 * `.town-directory__close`), plus `.cdm-close`, `.satchel-sheet__close` and
 * the framed `.modal-shell-close`. They disagreed on size, colour, shape and
 * even on the mark itself — three call sites of `.cdm-close` rendered a `✕`
 * glyph while a fourth rendered `<Icon name="close">` — so the ✕ shifted and
 * changed weight as you moved between modals.
 *
 * Every one but the satchel's was also a ~14px glyph with 2px of padding,
 * well under a usable tap target. The satchel's treatment is the one kept:
 * pad out to 44px with a matching negative margin, so the hit area is
 * thumb-sized while the glyph gains no visual weight (see `.close-btn` in
 * buttons.css).
 *
 * The icon draws in `currentColor`, so a surface with its own palette
 * retints the control by setting `--close-btn-color` / `--close-btn-color-on`
 * rather than restyling it — the hub modals and the satchel sheet both do.
 */
export function CloseButton({
  onClick, variant = 'ghost', label = 'Close', size = 14, className,
}: Props) {
  const classes = ['close-btn', `close-btn--${variant}`, className].filter(Boolean).join(' ')
  return (
    <button type="button" className={classes} onClick={onClick} title={label} aria-label={label}>
      <Icon name="close" size={size} />
    </button>
  )
}
