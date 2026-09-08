// ─── Stowage ──────────────────────────────────────────────────────────────────
// The crate packing puzzle. Take a good out of the tray, turn it in your head,
// and put it where it goes — until every slot in the crate is covered and
// nothing is left over. Scored on stows against par: no clock, no reflexes, no
// way to lose.
//
// Surfaced only through the hub world: this is the screen behind a town's
// crate, not an arcade cabinet. The tier is authored per town rather than
// chosen, and packing a crate pays crystals, barrelled salt and standing with
// that town. See docs/minigame-stowage.md.

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { MinigameShell } from './MinigameShell'
import { MinigameResultPanel } from './MinigameResultPanel'
import { CrateGrid } from './stowage/CrateGrid'
import { GoodsTray } from './stowage/GoodsTray'
import { StowStatusBar } from './stowage/StowStatusBar'
import { Button } from '../ui/Button'
import { playMinigameCorrect, playMinigameWrong, playCardFlip } from '../../game/sound'
import {
  generateBoard, stow, lift, turnGood, emptyCrate, manifest,
  occupantAt, openSlots, stowedCount, isPacked, turnPeriod,
  scoreRun, getTier, STOWAGE_SCORING,
  type Board, type Cell, type TierId,
} from './Stowage.logic'

/** What a packed crate reports back to the hub. */
export interface StowageResult {
  stows:     number
  par:       number
  /** Every good stowed right the first time. */
  cleanStow: boolean
  tierId:    TierId
  crystals:  number
  salt:      number
  /** Goods the manifest placed, for the breakdown. */
  manifested: number
}

interface Props {
  onDone: (result: StowageResult) => void
  /** Whose load this is — authored per town. */
  tier:   TierId
}

/** Everything that resets together when a crate is tipped out and re-laid. */
interface Run {
  board:    Board
  /** Stows the crate refused, for the "that does not fit" nudge. */
  refusals: number
}

export function Stowage({ onDone, tier: tierProp }: Props) {
  const tier = getTier(tierProp)
  const tierId = tier.id

  // Laying a crate costs 1-3 ms (docs §8), so unlike Cask Sounding there is no
  // reason to defer it into an effect — a lazy initialiser paints a ready crate
  // on the first frame.
  const [run, setRun] = useState<Run>(() => ({ board: generateBoard(tier), refusals: 0 }))
  const [held, setHeld] = useState<number | null>(null)
  const [hovered, setHovered] = useState<Cell | null>(null)

  const { board } = run
  const packed = isPacked(board)
  const heldGood = held === null ? null : board.goods.find(g => g.id === held && !g.at) ?? null

  // Every handler computes its next board from the board this render is
  // showing and hands the result over whole. Nothing decides anything inside a
  // state updater: React invokes those twice in StrictMode, and both `manifest`
  // (which rolls a die) and the paired `setHeld` calls below would run twice
  // for one tap.
  const handleTapSlot = useCallback((x: number, y: number) => {
    if (packed) return
    const occupant = occupantAt(board, x, y)
    if (occupant !== null) {
      // Lifting a good picks it back up, so the common "that is nearly right,
      // let me turn it" loop never has to go via the tray.
      setHeld(occupant)
      setRun({ ...run, board: lift(board, occupant) })
      return
    }
    if (held === null) return
    const next = stow(board, held, x, y)
    if (next === board) { setRun({ ...run, refusals: run.refusals + 1 }); return }
    setHeld(null)
    setRun({ ...run, board: next })
  }, [board, held, packed, run])

  const handleSelect = useCallback((id: number) => {
    // Tapping the good you are already holding turns it — one gesture for both
    // verbs, so picking up and orienting never means hunting for a second
    // control. The ↻ button below does the same thing for anyone who wants it.
    if (held === id) setRun({ ...run, board: turnGood(board, id) })
    else setHeld(id)
  }, [board, held, run])

  const handleTurn = useCallback(() => {
    if (held === null) return
    setRun({ ...run, board: turnGood(board, held) })
  }, [board, held, run])

  const handleManifest = useCallback(() => {
    if (packed) return
    const hint = manifest(board)
    if (!hint) return
    setHeld(null)
    setRun({ ...run, board: hint.board })
  }, [board, packed, run])

  const handleEmpty = useCallback(() => {
    setHeld(null)
    setRun({ ...run, board: emptyCrate(board) })
  }, [board, run])

  // Sound belongs to the render, not the state updater: React invokes an
  // updater twice in StrictMode, and a cue that fires twice is a bug you only
  // ever hear in development.
  const lastRef = useRef({ stows: 0, refusals: 0, packed: false })
  useEffect(() => {
    const last = lastRef.current
    if (packed && !last.packed) playMinigameCorrect()
    else if (run.refusals > last.refusals) playMinigameWrong()
    else if (board.stows !== last.stows) playCardFlip()
    lastRef.current = { stows: board.stows, refusals: run.refusals, packed }
  }, [board.stows, run.refusals, packed])

  const score = scoreRun(tier, board.par, board.stows)
  const loose = board.goods.filter(g => !g.at)
  const canTurn = heldGood !== null && turnPeriod(heldGood) > 1

  return (
    <MinigameShell
      title="STOWAGE"
      icon="📦"
      stat={`Stows ${board.stows} · Par ${board.par}`}
      className="stow-screen"
    >
      <p className="stow-tier">{tier.label} — {tier.subtitle}</p>

      <div className="stow-board-wrap">
        <CrateGrid
          board={board}
          held={heldGood}
          hovered={hovered}
          packed={packed}
          onHoverSlot={setHovered}
          onTapSlot={handleTapSlot}
        />
      </div>

      <StowStatusBar
        stowed={stowedCount(board)}
        total={board.goods.length}
        open={openSlots(board)}
        packed={packed}
      />

      {!packed && (
        <>
          <GoodsTray goods={loose} selectedId={held} onSelect={handleSelect} />

          <div className="stow-actions">
            <Button onClick={handleTurn} disabled={!canTurn} title="Turn the held goods a quarter turn">
              ↻ TURN
            </Button>
            <Button onClick={handleManifest} title="Stow one good where the manifest says it goes">
              📜 MANIFEST (+{STOWAGE_SCORING.manifestCost} stows)
            </Button>
            <Button onClick={handleEmpty} title="Tip the crate out and start again">
              ↺ EMPTY IT
            </Button>
          </div>

          <p className="stow-hint">
            {heldGood
              ? 'Tap a slot to stow it — the marked corner lands where you tap. Tap the goods again to turn them.'
              : 'Take a good from the tray, or tap one in the crate to lift it back out. Turning and lifting are free.'}
          </p>
        </>
      )}

      {packed && (
        <MinigameResultPanel
          headline="📦 PACKED SQUARE"
          ctaLabel="HAND IT OVER"
          onCta={() => onDone({
            stows:     board.stows,
            par:       board.par,
            cleanStow: score.cleanStow,
            tierId,
            crystals:  score.crystals,
            salt:      tier.salt,
            manifested: board.manifested,
          })}
        >
          <div className="minigame-result-breakdown">
            <div>Stows {board.stows} · Par {board.par}</div>
            <div>Efficiency: {Math.round(score.efficiency * 100)}%</div>
            {board.manifested > 0 && <div>Manifest read {board.manifested}×</div>}
            {score.cleanStow && <div>Clean stow! +{STOWAGE_SCORING.cleanStowCrystals} 💎</div>}
            <div className="minigame-result-total">
              +{score.crystals} 💎 · +{tier.salt} 🧂 Barrelled Salt · +{STOWAGE_SCORING.reputation} standing
            </div>
          </div>
        </MinigameResultPanel>
      )}
    </MinigameShell>
  )
}
