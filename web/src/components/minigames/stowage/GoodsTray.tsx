import React from 'react'
import { goodCells, anchorOf, turnPeriod, type Good } from '../Stowage.logic'

// ─── Goods tray ───────────────────────────────────────────────────────────────
// The goods still waiting to go in. Each is drawn as a mini grid of its own
// slots at its current turn, in the hue it will wear once stowed, so a player
// can match tray to crate at a glance.
//
// The anchor — the first slot of the good's top row — carries a dot, because it
// is the slot a tap lands on and that rule has to be visible rather than
// learned by surprise. Tapping the good you are already holding turns it, so
// the common case never leaves the tray.

interface Props {
  /** Goods still in the tray, in board order. */
  goods:  Good[]
  selectedId?: number | null
  onSelect?: (id: number) => void
}

export function GoodsTray({ goods, selectedId = null, onSelect }: Props) {
  if (goods.length === 0) {
    return (
      <div className="goods-tray goods-tray--empty" role="status">
        <span>Tray empty — every good is in the crate.</span>
      </div>
    )
  }

  return (
    <div className="goods-tray" role="group" aria-label={`Tray, ${goods.length} goods left to stow`}>
      {goods.map(good => {
        const cells = goodCells(good)
        const w = Math.max(...cells.map(c => c.x)) + 1
        const h = Math.max(...cells.map(c => c.y)) + 1
        const anchor = anchorOf(cells)
        const filled = new Set(cells.map(c => `${c.x},${c.y}`))
        const selected = selectedId === good.id
        const period = turnPeriod(good)

        return (
          <button
            key={good.id}
            type="button"
            className={`tray-good${selected ? ' tray-good--selected' : ''} tray-good--hue${good.id % 8}`}
            aria-pressed={selected}
            aria-label={
              `Goods ${good.id + 1}: ${cells.length} slots, ${w} by ${h}.` +
              (period === 1 ? ' Square — turning does nothing.' : '') +
              (selected ? ' Held. Activate to turn.' : ' Activate to pick up.')
            }
            onClick={() => onSelect?.(good.id)}
          >
            <span
              className="tray-good-shape"
              style={{ gridTemplateColumns: `repeat(${w}, 1fr)`, gridTemplateRows: `repeat(${h}, 1fr)` }}
              aria-hidden="true"
            >
              {Array.from({ length: h }, (_, y) =>
                Array.from({ length: w }, (_, x) => {
                  const here = filled.has(`${x},${y}`)
                  const isAnchor = here && anchor.x === x && anchor.y === y
                  return (
                    <span
                      key={`${x},${y}`}
                      className={[
                        'tray-slot',
                        here && 'tray-slot--filled',
                        isAnchor && 'tray-slot--anchor',
                      ].filter(Boolean).join(' ')}
                    />
                  )
                }),
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
