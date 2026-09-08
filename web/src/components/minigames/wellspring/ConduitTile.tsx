import React from 'react'
import { DIR_BIT, rotate, pieceKind, type CellRole } from '../Wellspring.logic'

// ─── Conduit tile ─────────────────────────────────────────────────────────────
// One cell of the Wellspring board: a stone socket holding a length of
// aqueduct. Pure visual — it is told what it holds and whether water is in it,
// and reports taps back up.
//
// The piece is drawn in its canonical orientation and turned with a CSS
// transform, so a tap reads as a real quarter-turn rather than a pop. The
// parent hands down a *cumulative* turn count for that: deriving the angle
// from the mask alone would spin a piece three-quarters backwards every time
// it wrapped from 270° to 0°.

const DIR_NAMES = ['north', 'east', 'south', 'west']

/** Where an arm meets the socket edge, in the 100×100 viewBox. */
const ARM_END: [number, number][] = [[50, 0], [100, 50], [50, 100], [0, 50]]

function maskFromDirs(dirs: number[]): number {
  return dirs.reduce((mask, d) => mask | DIR_BIT[d], 0)
}

/**
 * The lowest-numbered rotation of a mask, and how many quarter-turns from it
 * back to the mask itself. Gives every piece of a kind one shape to draw.
 */
export function canonicalMask(mask: number): { base: number; steps: number } {
  let base = mask
  let steps = 0
  for (let r = 1; r < 4; r++) {
    const turned = rotate(mask, r)
    if (turned < base) {
      base = turned
      // Turning the mask by r lands on base, so base turned by (4 − r) is the mask.
      steps = (4 - r) % 4
    }
  }
  return { base, steps }
}

function armPath(mask: number): string {
  const parts: string[] = []
  for (let d = 0; d < 4; d++) {
    if (!(mask & DIR_BIT[d])) continue
    const [x, y] = ARM_END[d]
    parts.push(`M50 50L${x} ${y}`)
  }
  return parts.join('')
}

function openSidesLabel(mask: number): string {
  const names = DIR_NAMES.filter((_, d) => mask & DIR_BIT[d])
  if (names.length === 0) return 'no open sides'
  if (names.length === 1) return `open ${names[0]}`
  return `open ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

interface Props {
  /** The piece's current orientation. */
  mask:      number
  role:      CellRole
  /** Source or welded: pre-solved and never turnable. */
  fixed:     boolean
  /** Rusted in place — turns at double cost. */
  seized:    boolean
  /** Whether water reaches this cell. */
  filled:    boolean
  /** Open sides that spill, as direction indices. */
  leakDirs?: number[]
  /**
   * Cumulative quarter-turns this cell has taken, so the spin animates
   * forwards. Must be congruent to the mask's own rotation mod 4; omit for a
   * correct static render with no turn history.
   */
  spin?:     number
  /** A cross reads the same at every angle, so it is never a move. */
  rotatable: boolean
  row:       number
  col:       number
  onTap?:    () => void
}

export function ConduitTile({
  mask, role, fixed, seized, filled, leakDirs = [], spin, rotatable, row, col, onTap,
}: Props) {
  const { base, steps } = canonicalMask(mask)
  const turns = spin ?? steps
  const kind = pieceKind(mask)
  const path = armPath(base)
  // Leaks arrive in board space; the arms are drawn in the piece's canonical
  // space and turned by CSS, so a spilling arm has to be named there instead.
  const leakPath = armPath(maskFromDirs(leakDirs.map(d => (d - steps + 4) % 4)))

  const classes = [
    'conduit-tile',
    filled && 'conduit-tile--filled',
    leakDirs.length > 0 && 'conduit-tile--leaking',
    fixed && role !== 'source' && 'conduit-tile--welded',
    seized && 'conduit-tile--seized',
    role === 'source' && 'conduit-tile--source',
    role === 'basin' && 'conduit-tile--basin',
    !rotatable && 'conduit-tile--static',
  ].filter(Boolean).join(' ')

  const what = role === 'source' ? 'the spring' : role === 'basin' ? `basin, ${kind}` : kind
  const state = fixed
    ? role === 'source' ? 'fixed' : 'welded in place'
    : seized ? 'seized, costs two taps' : 'activate to rotate'
  const label = `Row ${row + 1}, column ${col + 1}: ${what}, ${openSidesLabel(mask)}. ${state}.`

  return (
    <button
      type="button"
      className={classes}
      onClick={onTap}
      disabled={!rotatable}
      aria-label={label}
      aria-disabled={!rotatable}
    >
      <svg className="conduit-piece" viewBox="0 0 100 100" aria-hidden="true">
        <g className="conduit-piece-spin" style={{ transform: `rotate(${turns * 90}deg)` }}>
          <path className="conduit-arm" d={path} pathLength={100} />
          {/* A spilling arm turns amber along its whole length. Marking the
              pipe rather than dotting its tip is what actually reads on a
              board where most arms are already blue. */}
          {leakDirs.length > 0 && <path className="conduit-arm-leak" d={leakPath} />}
          <path className="conduit-arm-flow" d={path} pathLength={100} />
          <circle className="conduit-hub" cx="50" cy="50" r="13" />
        </g>

        {role === 'source' && (
          <g className="conduit-source">
            <circle className="conduit-source-ripple" cx="50" cy="50" r="21" />
            <circle className="conduit-source-halo" cx="50" cy="50" r="20" />
            <circle className="conduit-source-core" cx="50" cy="50" r="14" />
          </g>
        )}

        {role === 'basin' && (
          <g className="conduit-basin">
            <circle className="conduit-basin-bowl" cx="50" cy="50" r="19" />
            <circle className="conduit-basin-water" cx="50" cy="50" r="14" />
          </g>
        )}
      </svg>

      {seized && <span className="conduit-seized-pip" aria-hidden="true">×2</span>}
    </button>
  )
}
