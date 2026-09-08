// ─── Wellspring ───────────────────────────────────────────────────────────────
// The conduit-routing puzzle. Tap a piece to turn it a quarter-turn clockwise
// until water runs from the spring through every section with nothing
// spilling. Scored on taps against par — no clock, no reflexes, no luck.
//
// Surfaced only through the hub world — this is the screen behind a town's
// well, not an arcade cabinet. The depth is authored per town rather than
// chosen, and putting a well right pays crystals, clean water and standing
// with that town. See docs/minigame-wellspring.md.

import React, { useState, useMemo, useCallback } from 'react'
import { MinigameShell } from './MinigameShell'
import { MinigameResultPanel } from './MinigameResultPanel'
import { ConduitBoard } from './wellspring/ConduitBoard'
import { canonicalMask } from './wellspring/ConduitTile'
import { FlowStatusBar } from './wellspring/FlowStatusBar'
import { Button } from '../ui/Button'
import { playMinigameCorrect, playCardFlip } from '../../game/sound'
import {
  generateBoard, computeFlow, rotateCellAt, isRotatable, moveCost, dowse,
  scoreRun, getDepth, WELLSPRING_SCORING,
  type Board, type DepthId,
} from './Wellspring.logic'

/** What a restored well reports back to the hub. */
export interface WellspringResult {
  moves:      number
  par:        number
  underPar:   boolean
  depthId:    DepthId
  crystals:   number
  cleanWater: number
}

interface Props {
  onDone: (result: WellspringResult) => void
  /** Which shaft this town's well drops into — authored per town. */
  depth:  DepthId
}

/** Everything that resets together when a new board is laid. */
interface Run {
  /** The board as generated, so RESET can put it back without re-rolling. */
  opening: Board
  board:   Board
  /** Cumulative quarter-turns per cell, so a tap spins forwards. */
  spins:   number[]
  moves:   number
  dowsed:  number
  done:    boolean
}

/** Opening turn counts, so the first tap on a cell spins on from where the
 *  scramble left it rather than snapping to zero. */
function spinsFor(board: Board): number[] {
  return board.cells.map(c => canonicalMask(c.mask).steps)
}

function freshRun(depthId: DepthId): Run {
  const board = generateBoard(getDepth(depthId))
  return { opening: board, board, spins: spinsFor(board), moves: 0, dowsed: 0, done: false }
}

/**
 * Advance `spins` so cell `index` ends up congruent to `mask` while only ever
 * counting upwards — the tile turns forwards into place instead of unwinding
 * three-quarters of a turn backwards to reach the same angle.
 */
function spinToward(spins: number[], index: number, mask: number): number[] {
  const next = spins.slice()
  const to = canonicalMask(mask).steps
  next[index] += (to - (next[index] % 4) + 4) % 4
  return next
}

export function Wellspring({ onDone, depth: depthProp }: Props) {
  const depth = getDepth(depthProp)
  const depthId = depth.id
  const [run, setRun] = useState<Run>(() => freshRun(depthId))

  const { board, spins, moves, dowsed, done } = run
  const flow = useMemo(() => computeFlow(board), [board])
  const score = scoreRun(depth, board.par, moves)

  /** Put every piece back where the board opened. The taps already spent
   *  stand: there is no failure state here, so a reset is a way out of a
   *  tangle, not a free undo. */
  const resetPieces = useCallback(() => {
    setRun(r => ({
      ...r,
      board: r.opening,
      spins: r.opening.cells.reduce(
        (acc, cell, i) => spinToward(acc, i, cell.mask),
        r.spins,
      ),
    }))
  }, [])

  const handleTap = useCallback((index: number) => {
    setRun(r => {
      if (r.done) return r
      const cell = r.board.cells[index]
      if (!isRotatable(cell)) return r
      const board = rotateCellAt(r.board, index)
      if (board === r.board) return r

      const spins = r.spins.slice()
      spins[index] += 1
      const solved = computeFlow(board).solved
      return { ...r, board, spins, moves: r.moves + moveCost(cell), done: solved }
    })
  }, [])

  const handleDowse = useCallback(() => {
    setRun(r => {
      if (r.done) return r
      const hint = dowse(r.board)
      if (!hint) return r
      return {
        ...r,
        board:  hint.board,
        spins:  spinToward(r.spins, hint.index, hint.board.cells[hint.index].mask),
        moves:  r.moves + WELLSPRING_SCORING.dowseMoveCost,
        dowsed: r.dowsed + 1,
        done:   computeFlow(hint.board).solved,
      }
    })
  }, [])

  // Sound belongs to the render, not the state updater: React invokes an
  // updater twice in StrictMode, and a click that fires twice is a bug you
  // only hear in development.
  const solvedNow = flow.solved
  const lastSoundedRef = React.useRef<{ moves: number; solved: boolean }>({ moves: 0, solved: false })
  React.useEffect(() => {
    const last = lastSoundedRef.current
    if (solvedNow && !last.solved) playMinigameCorrect()
    else if (moves > last.moves) playCardFlip()
    lastSoundedRef.current = { moves, solved: solvedNow }
  }, [moves, solvedNow])

  return (
    <MinigameShell
      title="WELLSPRING"
      icon="💧"
      stat={`Moves ${moves} · Par ${board.par}`}
      className="wellspring-screen"
    >
      <p className="wellspring-depth">{depth.label} — {depth.subtitle}</p>

      <div className="wellspring-board-wrap">
        <ConduitBoard board={board} flow={flow} spins={spins} onTapCell={handleTap} />
      </div>

      <FlowStatusBar
        fed={flow.filled.filter(Boolean).length}
        total={board.cells.length}
        leaks={flow.leaks.length}
        solved={flow.solved}
      />

      {!done && (
        <>
          <div className="wellspring-actions">
            <Button onClick={handleDowse} title="Snap one piece into place">
              🔎 DOWSE (+{WELLSPRING_SCORING.dowseMoveCost} moves)
            </Button>
            <Button onClick={resetPieces} title="Put the pieces back as you found them; taps already spent still count">
              ↺ RESET
            </Button>
          </div>
          <p className="wellspring-hint">
            Tap a section to turn it. Every conduit must carry water, and nothing may spill.
          </p>
        </>
      )}

      {done && (
        <MinigameResultPanel
          headline="✨ WELLSPRING RESTORED"
          ctaLabel="LEAVE THE WELL"
          onCta={() => onDone({
            moves,
            par:        board.par,
            underPar:   score.underPar,
            depthId,
            crystals:   score.crystals,
            cleanWater: depth.cleanWater,
          })}
        >
          <div className="minigame-result-breakdown">
            <div>Moves {moves} · Par {board.par}</div>
            <div>Efficiency: {Math.round(score.efficiency * 100)}%</div>
            {dowsed > 0 && <div>Dowsed {dowsed}×</div>}
            {score.underPar && <div>Under par! +{WELLSPRING_SCORING.underParCrystals} 💎</div>}
            <div className="minigame-result-total">
              +{score.crystals} 💎 · +{depth.cleanWater} 💧 Clean Water · +{WELLSPRING_SCORING.reputation} standing
            </div>
          </div>
        </MinigameResultPanel>
      )}
    </MinigameShell>
  )
}
