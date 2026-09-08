import React from 'react'
import type { CaskState } from '../CaskSounding.logic'

// ─── Cask tile ────────────────────────────────────────────────────────────────
// One cask on the rack. Pure visual — it is told what the player has
// established about the cask and reports taps back up. It is never told
// whether an *unresolved* cask is soured, so there is nothing here for a
// curious player to read out of the DOM.
//
// The four states carry the whole tutorial: a rung cask shows its number, a
// struck-bad one goes dark and stained, a chalked one wears its ✕. Nothing
// explains the rules in words because the rack does it.

export type TapMode = 'sound' | 'chalk'

interface Props {
  state:   CaskState
  /** An empty slot in the rack: nothing to strike, and not a neighbour. */
  gap:     boolean
  /** Soured neighbours, once the cask has rung. */
  reading: number | null
  row:     number
  col:     number
  /** Soured casks in this row, or null where the ledger never counted it. */
  rowCount: number | null
  mode:    TapMode
  /** Flashes the penalty when a chalk has just rubbed off this cask. */
  justWrong?: boolean
  onTap?:  () => void
}

const STATE_WORD: Record<CaskState, string> = {
  unknown: 'unresolved',
  rung:    'sound',
  soured:  'soured, struck',
  chalked: 'soured, chalked',
}

export function CaskTile({
  state, gap, reading, row, col, rowCount, mode, justWrong = false, onTap,
}: Props) {
  if (gap) {
    return <div className="cask-tile cask-tile--gap" aria-hidden="true" />
  }

  const actionable = state === 'unknown'
  const classes = [
    'cask-tile',
    `cask-tile--${state}`,
    justWrong && 'cask-tile--rebuked',
  ].filter(Boolean).join(' ')

  // Each cask describes itself, including its row's count — the rack's row
  // labels are decoration for a sighted player, so the figure has to travel
  // with the button for anyone reading it a cask at a time.
  const where = rowCount === null
    ? `Row ${row + 1}, uncounted`
    : `Row ${row + 1}, ${rowCount} soured`
  const verb = mode === 'sound' ? 'Activate to strike' : 'Activate to chalk as soured'
  const label = `${where}, cask ${col + 1}: ${STATE_WORD[state]}${
    state === 'rung' ? `, ${reading} soured touching it` : ''
  }.${actionable ? ` ${verb}.` : ''}`

  return (
    <button
      type="button"
      className={classes}
      onClick={onTap}
      disabled={!actionable}
      aria-label={label}
      aria-disabled={!actionable}
    >
      <svg className="cask-face" viewBox="0 0 100 100" aria-hidden="true">
        {/* The cask itself: a barrel end with two hoops. Drawn for every state
            so the rack keeps its shape as casks resolve — a resolved cask
            recedes, it does not vanish and leave a hole. */}
        <ellipse className="cask-body" cx="50" cy="50" rx="34" ry="38" />
        <path className="cask-hoop" d="M18 36H82" />
        <path className="cask-hoop" d="M18 64H82" />

        {/* A struck-bad cask and a chalked one are the same fact — this cask is
            soured and the player has named it — so they share the ✕, and only
            the material differs: chalk for one you worked out, a stain burned
            into the wood for one you had to spend a sounding on. They started
            as unrelated glyphs (a chalk cross against a drip) and the rack read
            as two separate categories, which is the one thing a player scanning
            it should never have to untangle. */}
        {(state === 'chalked' || state === 'soured') && (
          <g className={`cask-mark cask-mark--${state === 'chalked' ? 'chalk' : 'stain'}`}>
            {/* Deliberately off-square: a hand drew this, not a printer. */}
            <path className="cask-mark-stroke" d="M31 28L70 73" />
            <path className="cask-mark-stroke" d="M70 27L29 72" />
          </g>
        )}
      </svg>

      {state === 'rung' && (
        <span className={`cask-reading cask-reading--n${reading ?? 0}`}>{reading}</span>
      )}
    </button>
  )
}
