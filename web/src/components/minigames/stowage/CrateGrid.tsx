import React from 'react'
import {
  occupancy, slotIndex, footprint, canStow, originForTap,
  type Board, type Cell, type Good,
} from '../Stowage.logic'

// ─── Crate grid ───────────────────────────────────────────────────────────────
// The crate the goods go into. Pure visual: it renders whatever board it is
// handed and reports taps by slot.
//
// A stowed good has to read as one object rather than four loose squares, so a
// filled slot draws its border only on the edges where the neighbour is *not*
// the same good. That is the whole trick — no per-shape geometry, no SVG, and
// it is correct for any polyomino including ones with a notch.
//
// The ghost is computed with the same `footprint`/`canStow` the stow itself
// uses. A ghost that disagrees with where the piece actually lands is the worst
// bug available here, so there is deliberately no second copy of that geometry.

interface Props {
  board: Board
  /** The good the player is holding, if any — drives the ghost preview. */
  held?:    Good | null
  /** The slot the pointer or keyboard focus is over, if any. */
  hovered?: Cell | null
  onHoverSlot?: (slot: Cell | null) => void
  onTapSlot?:   (x: number, y: number) => void
  /** Suppresses interaction once the crate is packed. */
  packed?:  boolean
}

/** Which sides of this slot face something that is not the same good. */
function edges(board: Board, taken: (number | null)[], x: number, y: number): string[] {
  const id = taken[slotIndex(board, x, y)]
  const same = (nx: number, ny: number) =>
    nx >= 0 && ny >= 0 && nx < board.w && ny < board.h && taken[slotIndex(board, nx, ny)] === id
  const out: string[] = []
  if (!same(x, y - 1)) out.push('n')
  if (!same(x + 1, y)) out.push('e')
  if (!same(x, y + 1)) out.push('s')
  if (!same(x - 1, y)) out.push('w')
  return out
}

export function CrateGrid({
  board, held = null, hovered = null, onHoverSlot, onTapSlot, packed = false,
}: Props) {
  const taken = occupancy(board)

  // The held good's footprint if it were stowed on the hovered slot, and
  // whether that stow would actually be allowed.
  let ghost = new Set<number>()
  let ghostFits = false
  if (held && hovered) {
    const origin = originForTap(held, hovered.x, hovered.y)
    ghostFits = canStow(board, held, origin.x, origin.y)
    ghost = new Set(
      footprint(held, origin.x, origin.y)
        .filter(c => c.x >= 0 && c.y >= 0 && c.x < board.w && c.y < board.h)
        .map(c => slotIndex(board, c.x, c.y)),
    )
  }

  return (
    <div
      className={`crate-grid${packed ? ' crate-grid--packed' : ''}`}
      style={{ gridTemplateColumns: `repeat(${board.w}, 1fr)` }}
      role="group"
      aria-label={`Crate, ${board.w} by ${board.h}`}
      onPointerLeave={() => onHoverSlot?.(null)}
    >
      {Array.from({ length: board.h }, (_, y) =>
        Array.from({ length: board.w }, (_, x) => {
          const i = slotIndex(board, x, y)
          const timber = board.dunnage[i]
          const occupant = taken[i]
          const inGhost = ghost.has(i)

          const classes = [
            'crate-slot',
            timber && 'crate-slot--dunnage',
            occupant !== null && 'crate-slot--filled',
            occupant !== null && `crate-slot--hue${occupant % 8}`,
            inGhost && (ghostFits ? 'crate-slot--ghost' : 'crate-slot--ghost-bad'),
            ...(occupant !== null ? edges(board, taken, x, y).map(e => `crate-slot--edge-${e}`) : []),
          ].filter(Boolean).join(' ')

          const what = timber
            ? 'packing timber'
            : occupant !== null ? `goods ${occupant + 1}` : 'empty'
          const verb = timber || packed
            ? ''
            : occupant !== null
              ? ' Activate to lift them out.'
              : held ? ' Activate to stow the held goods.' : ''

          return (
            <button
              key={i}
              type="button"
              className={classes}
              disabled={timber || packed}
              aria-disabled={timber || packed}
              aria-label={`Row ${y + 1}, column ${x + 1}: ${what}.${verb}`}
              onPointerEnter={() => onHoverSlot?.({ x, y })}
              onFocus={() => onHoverSlot?.({ x, y })}
              onClick={() => onTapSlot?.(x, y)}
            >
              {timber && (
                <svg className="crate-timber" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M2 6H18M2 14H18M6 2V18M14 2V18" />
                </svg>
              )}
            </button>
          )
        }),
      )}
    </div>
  )
}
