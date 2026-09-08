import React from 'react'
import { CaskTile, type TapMode } from './CaskTile'
import { isSorted, type Board } from '../CaskSounding.logic'

// ─── Rack board ───────────────────────────────────────────────────────────────
// The rack of casks, with the cellarer's row counts chalked down its left edge.
// Pure visual: it renders whatever board it is handed and reports taps by cask
// index.
//
// A row the ledger never counted shows a "?" rather than an empty cell. Empty
// would read as zero — the single worst misreading available on this board,
// because zero is a strong deduction and "unknown" is the absence of one.

interface Props {
  board:      Board
  mode:       TapMode
  /** Index of a cask a chalk has just rubbed off, for the penalty flash. */
  rebuked?:   number | null
  onTapCask?: (index: number) => void
}

export function RackBoard({ board, mode, rebuked = null, onTapCask }: Props) {
  const { w, h, casks, rowCounts } = board
  // Derived rather than passed: it is a pure function of the board this
  // component already holds, so a `sorted` prop could only ever disagree with it.
  const sorted = isSorted(board)

  return (
    <div
      className={`rack-board${sorted ? ' rack-board--sorted' : ''}`}
      style={{ gridTemplateColumns: `auto repeat(${w}, 1fr)` }}
      role="group"
      aria-label={`Cask rack, ${w} by ${h}, ${board.souredTotal} casks soured in total`}
    >
      {Array.from({ length: h }, (_, y) => (
        <React.Fragment key={y}>
          <span
            className={`rack-row-count${rowCounts[y] === null ? ' rack-row-count--unknown' : ''}`}
            aria-hidden="true"
          >
            {rowCounts[y] === null ? '?' : rowCounts[y]}
          </span>
          {Array.from({ length: w }, (_, x) => {
            const i = y * w + x
            return (
              <CaskTile
                key={i}
                state={casks[i].state}
                gap={casks[i].gap}
                reading={casks[i].reading}
                row={y}
                col={x}
                rowCount={rowCounts[y]}
                mode={mode}
                justWrong={rebuked === i}
                onTap={onTapCask ? () => onTapCask(i) : undefined}
              />
            )
          })}
        </React.Fragment>
      ))}
    </div>
  )
}
