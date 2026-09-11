// ─── Cask Sounding ────────────────────────────────────────────────────────────
// The cellar deduction puzzle. Strike a cask to hear how many bad ones touch
// it, chalk the ones you work out, and name every soured cask on the rack.
// Scored on soundings against par — no clock, no reflexes, no way to lose.
//
// Surfaced only through the hub world: this is the screen behind a town's
// cellar hatch, not an arcade cabinet. The tier is authored per town rather
// than chosen, and sorting a cellar pays crystals, cask vinegar and standing
// with that town. See docs/minigame-cask-sounding.md.

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { MinigameShell } from './MinigameShell'
import { Icon } from '../ui/icons/Icon'
import { MinigameResultPanel } from './MinigameResultPanel'
import { RackBoard } from './casksounding/RackBoard'
import { RackStatusBar } from './casksounding/RackStatusBar'
import type { TapMode } from './casksounding/CaskTile'
import { Button } from '../ui/Button'
import { playMinigameCorrect, playMinigameWrong, playCardFlip } from '../../game/sound'
import {
  generateBoard, strike, chalk, listen, isSorted, remainingSoured, isActionable,
  scoreRun, getTier, CASK_SCORING,
  type Board, type TierId,
} from './CaskSounding.logic'

/** What a sorted cellar reports back to the hub. */
export interface CaskSoundingResult {
  soundings: number
  par:       number
  underPar:  boolean
  tierId:    TierId
  crystals:  number
  vinegar:   number
  /** Chalks that rubbed off. Zero is its own achievement. */
  misread:   number
}

interface Props {
  onDone: (result: CaskSoundingResult) => void
  /** Whose cellar this is — authored per town. */
  tier:   TierId
}

/** Everything that resets together when a new rack is laid. */
interface Run {
  board:    Board
  /** Casks named by a hint rather than worked out, for the result breakdown. */
  listened: number
  /** Chalks that rubbed off — each cost the player. */
  misread:  number
  /** The cask a chalk just rubbed off, for the penalty flash. */
  rebuked:  number | null
  done:     boolean
}

function freshRun(tierId: TierId): Run {
  return {
    board: generateBoard(getTier(tierId)),
    listened: 0, misread: 0, rebuked: null, done: false,
  }
}

export function CaskSounding({ onDone, tier: tierProp }: Props) {
  const tier = getTier(tierProp)
  const tierId = tier.id

  // Laying a rack computes its par, which is real work — ~0.4s for a Vault
  // board here and several times that on a low-end phone. Generating it in an
  // effect rather than a lazy useState initialiser lets the cellar line paint
  // first, so the wait reads as opening a door rather than as a frozen tap.
  const [run, setRun] = useState<Run | null>(null)
  useEffect(() => {
    let cancelled = false
    const id = setTimeout(() => { if (!cancelled) setRun(freshRun(tierId)) }, 0)
    // Cleanup rather than a ref guard: StrictMode's double-invoke cancels the
    // first timer and schedules a second, so exactly one rack gets laid.
    return () => { cancelled = true; clearTimeout(id) }
  }, [tierId])

  const [mode, setMode] = useState<TapMode>('sound')

  const handleTap = useCallback((index: number) => {
    setRun(r => {
      if (!r || r.done) return r
      if (!isActionable(r.board.casks[index])) return r

      if (mode === 'sound') {
        const board = strike(r.board, index)
        return { ...r, board, rebuked: null, done: isSorted(board) }
      }
      const { board, wasWrong } = chalk(r.board, index)
      return {
        ...r,
        board,
        misread: r.misread + (wasWrong ? 1 : 0),
        rebuked: wasWrong ? index : null,
        done: isSorted(board),
      }
    })
  }, [mode])

  const handleListen = useCallback(() => {
    setRun(r => {
      if (!r || r.done) return r
      const hint = listen(r.board)
      if (!hint) return r
      return {
        ...r,
        board: hint.board,
        listened: r.listened + 1,
        rebuked: null,
        done: isSorted(hint.board),
      }
    })
  }, [])

  // Sound and the penalty flash belong to the render, not the state updater:
  // React invokes an updater twice in StrictMode, and a cue that fires twice is
  // a bug you only ever hear in development.
  const soundings = run?.board.soundings ?? 0
  const misread = run?.misread ?? 0
  const sorted = run?.done ?? false
  const lastRef = useRef({ soundings: 0, misread: 0, sorted: false })
  useEffect(() => {
    const last = lastRef.current
    if (sorted && !last.sorted) playMinigameCorrect()
    else if (misread > last.misread) playMinigameWrong()
    else if (soundings !== last.soundings) playCardFlip()
    lastRef.current = { soundings, misread, sorted }
  }, [soundings, misread, sorted])

  // Clear the penalty flash once it has played. The flashed cask lives in run
  // state rather than its own useState so it is set by the same update that
  // recorded the misread — deriving it by diffing boards across two effects
  // made the flash depend on which effect React happened to run first.
  const rebuked = run?.rebuked ?? null
  useEffect(() => {
    if (rebuked === null) return
    const id = setTimeout(() => setRun(r => (r ? { ...r, rebuked: null } : r)), 600)
    return () => clearTimeout(id)
  }, [rebuked])

  if (!run) {
    return (
      <MinigameShell title="CASK SOUNDING" icon="🛢️" className="cask-screen">
        <p className="cask-tier" role="status">
          {tier.label} — {tier.subtitle}
        </p>
        <p className="cask-hint">Down the cellar steps, feeling for the racks…</p>
      </MinigameShell>
    )
  }

  const { board } = run
  const score = scoreRun(tier, board.par, board.soundings)
  const named = board.souredTotal - remainingSoured(board)

  return (
    <MinigameShell
      title="CASK SOUNDING"
      icon="🛢️"
      stat={`Soundings ${board.soundings} · Par ${board.par}`}
      className="cask-screen"
    >
      <p className="cask-tier">{tier.label} — {tier.subtitle}</p>

      <div className="cask-board-wrap">
        <RackBoard board={board} mode={mode} rebuked={rebuked} onTapCask={handleTap} />
      </div>

      <RackStatusBar total={board.souredTotal} named={named} sorted={run.done} />

      {!run.done && (
        <>
          {/* The only mode in the game, and always visible: a player must never
              have to remember which verb a tap is currently spending. */}
          <div className="cask-modes" role="group" aria-label="What a tap does">
            <button
              type="button"
              className={`filter-btn${mode === 'sound' ? ' filter-btn--active' : ''}`}
              onClick={() => setMode('sound')}
              aria-pressed={mode === 'sound'}
            >
              🔨 SOUND
            </button>
            <button
              type="button"
              className={`filter-btn${mode === 'chalk' ? ' filter-btn--active' : ''}`}
              onClick={() => setMode('chalk')}
              aria-pressed={mode === 'chalk'}
            >
              ✕ CHALK
            </button>
          </div>

          <div className="cask-actions">
            <Button onClick={handleListen} title="Name one cask you could have worked out">
              👂 LISTEN (+{CASK_SCORING.listenCost} soundings)
            </Button>
          </div>

          <p className="cask-hint">
            {mode === 'sound'
              ? 'Strike a cask to hear it. A sound one tells you how many bad casks touch it.'
              : 'Chalk the casks you have worked out. Free when you are right.'}
          </p>
        </>
      )}

      {run.done && (
        <MinigameResultPanel
          headline="🛢️ CELLAR SORTED"
          ctaLabel="BACK UP THE STEPS"
          onCta={() => onDone({
            soundings: board.soundings,
            par:       board.par,
            underPar:  score.underPar,
            tierId,
            crystals:  score.crystals,
            vinegar:   tier.vinegar,
            misread:   run.misread,
          })}
        >
          <div className="minigame-result-breakdown">
            <div>Soundings {board.soundings} · Par {board.par}</div>
            <div>Efficiency: {Math.round(score.efficiency * 100)}%</div>
            {run.listened > 0 && <div>Listened {run.listened}×</div>}
            {run.misread > 0 && <div>Misread {run.misread}× (+{run.misread * CASK_SCORING.badChalkCost})</div>}
            {score.underPar && <div>Under par! +{CASK_SCORING.underParCrystals} <Icon name="crystal" size={13} /></div>}
            <div className="minigame-result-total">
              +{score.crystals} <Icon name="crystal" size={13} /> · +{tier.vinegar} 🍶 Cask Vinegar · +{CASK_SCORING.reputation} standing
            </div>
          </div>
        </MinigameResultPanel>
      )}
    </MinigameShell>
  )
}
