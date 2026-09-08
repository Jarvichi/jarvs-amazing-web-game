import React from 'react'
import { ConduitTile } from './ConduitTile'
import { isRotatable, type Board, type Flow } from '../Wellspring.logic'

// ─── Conduit board ────────────────────────────────────────────────────────────
// The grid of aqueduct sections. Pure visual: it renders whatever board and
// flow it is handed and reports taps by cell index.

interface Props {
  board:      Board
  flow:       Flow
  /** Cumulative quarter-turns per cell, so a tap animates forwards rather than
   *  unwinding when the angle wraps. Omit for a static render. */
  spins?:     number[]
  onTapCell?: (index: number) => void
}

export function ConduitBoard({ board, flow, spins, onTapCell }: Props) {
  // Leaks arrive as a flat list; the tiles want theirs by cell.
  const leaksByCell = new Map<number, number[]>()
  for (const leak of flow.leaks) {
    const list = leaksByCell.get(leak.index)
    if (list) list.push(leak.dir)
    else leaksByCell.set(leak.index, [leak.dir])
  }

  return (
    <div
      className={`conduit-board${flow.solved ? ' conduit-board--solved' : ''}${board.wrap ? ' conduit-board--wrap' : ''}`}
      style={{
        gridTemplateColumns: `repeat(${board.w}, 1fr)`,
        aspectRatio: `${board.w} / ${board.h}`,
      }}
      role="group"
      aria-label={`Conduit grid, ${board.w} by ${board.h}${board.wrap ? ', edges wrap around' : ''}`}
    >
      {board.cells.map((cell, i) => (
        <ConduitTile
          key={i}
          mask={cell.mask}
          role={cell.role}
          fixed={cell.fixed}
          seized={cell.seized}
          filled={flow.filled[i]}
          leakDirs={leaksByCell.get(i)}
          spin={spins?.[i]}
          rotatable={isRotatable(cell)}
          row={Math.floor(i / board.w)}
          col={i % board.w}
          onTap={onTapCell ? () => onTapCell(i) : undefined}
        />
      ))}
    </div>
  )
}
