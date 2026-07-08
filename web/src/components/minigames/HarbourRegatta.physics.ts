// ─── Harbour Regatta physics ──────────────────────────────────────────────────
// Pure functions for the skill-based rowing mechanic: alternate LEFT/RIGHT oar
// taps in a steady rhythm to row straight; favour one oar and the skiff veers
// that way. Kept separate from the component so the stroke/drift/AI-pacing
// math can be unit tested without rendering.

export type OarSide = 'left' | 'right'

export interface RowState {
  lateralOffset: number       // drift from centreline; clamped to +/- MAX_LATERAL
  progress: number            // distance rowed so far
  lastSide: OarSide | null
  lastTapAt: number | null    // ms timestamp of the previous stroke
  skillEma: number            // 0..1 rolling average of recent alternating-stroke timing quality
}

export const COURSE_LENGTH      = 700    // progress units at the finish line
export const MAX_LATERAL        = 60     // clamp before hitting the buoy line / bank
export const TARGET_STROKE_MS   = 420    // ideal interval between alternating strokes
export const STROKE_TOLERANCE_MS = 260   // timing window for full thrust
export const MIN_TIMING_FACTOR  = 0.2    // ragged timing never drops thrust to zero
export const BASE_THRUST        = 16     // progress gained per well-timed alternating stroke
export const REPEAT_THRUST_FACTOR = 0.35 // thrust penalty for hammering the same oar
export const VEER_STEP          = 14     // lateral push per stroke, signed by oar side
export const BANK_PENALTY_FACTOR = 0.4   // thrust penalty when the clamp is hit
export const DRAG_PER_MS        = 0.0016 // exponential decay pulling lateralOffset to 0
export const SKILL_EMA_ALPHA    = 0.25   // smoothing factor for the rolling skill average

export function createRowState(): RowState {
  return { lateralOffset: 0, progress: 0, lastSide: null, lastTapAt: null, skillEma: 0.5 }
}

// Apply one oar tap. Each side always pushes the skiff toward that side (left
// oar -> veer left, right oar -> veer right); alternating sides cancels the
// push out over a pair of strokes, so a steady L-R-L-R rhythm rows straight.
// Repeating the same oar skips the thrust-timing bonus (rhythm requires
// alternation), and drifting past MAX_LATERAL costs a landing/bank penalty.
export function applyStroke(state: RowState, side: OarSide, now: number): RowState {
  const isRepeat = state.lastSide === side
  const veerDelta = VEER_STEP * (side === 'right' ? 1 : -1)
  let lateralOffset = state.lateralOffset + veerDelta

  let thrust: number
  let skillEma = state.skillEma
  if (isRepeat) {
    thrust = BASE_THRUST * REPEAT_THRUST_FACTOR
  } else {
    const interval = state.lastTapAt === null ? TARGET_STROKE_MS : now - state.lastTapAt
    const timingError = Math.abs(interval - TARGET_STROKE_MS)
    const timingFactor = Math.max(MIN_TIMING_FACTOR, 1 - timingError / STROKE_TOLERANCE_MS)
    thrust = BASE_THRUST * timingFactor
    skillEma = skillEma + (timingFactor - skillEma) * SKILL_EMA_ALPHA
  }

  let hitBank = false
  if (lateralOffset > MAX_LATERAL) { lateralOffset = MAX_LATERAL; hitBank = true }
  if (lateralOffset < -MAX_LATERAL) { lateralOffset = -MAX_LATERAL; hitBank = true }
  if (hitBank) thrust *= BANK_PENALTY_FACTOR

  return {
    lateralOffset,
    progress: state.progress + thrust,
    lastSide: side,
    lastTapAt: now,
    skillEma,
  }
}

// Self-righting drag pulling lateralOffset back toward the centreline each frame.
export function decayLateral(state: RowState, dtMs: number): RowState {
  if (dtMs <= 0) return state
  const decay = Math.exp(-DRAG_PER_MS * dtMs)
  return { ...state, lateralOffset: state.lateralOffset * decay }
}

const AI_BASE_SPEED_PER_MS = 0.030 // tuned so a well-rowed player finishes around the same time
const AI_STALL_CHANCE_PER_SEC = 0.12
const AI_SPEED_JITTER = 0.3 // +/- fraction of base speed per frame

export const AI_DIFFICULTY_EASY = 0.85 // AI pace multiplier when the player is struggling with rhythm
export const AI_DIFFICULTY_HARD = 1.15 // AI pace multiplier when the player is rowing near-perfectly

// Maps the player's rolling rhythm quality (skillEma, 0..1) to an AI pace
// multiplier: ease off on a struggling player, speed back up on a skilled one
// so consistently perfect rowing doesn't trivialise the race.
export function aiDifficultyMultiplier(skillEma: number): number {
  const t = Math.max(0, Math.min(1, skillEma))
  return AI_DIFFICULTY_EASY + (AI_DIFFICULTY_HARD - AI_DIFFICULTY_EASY) * t
}

// Advance an AI skiff's progress by dtMs, with light randomised pacing/stalls
// echoing MarbleRace's obstacle-chance drama (not deterministic — not unit tested).
export function advanceAiProgress(progress: number, dtMs: number, speedMultiplier = 1): number {
  if (dtMs <= 0) return progress
  const stallChance = AI_STALL_CHANCE_PER_SEC * (dtMs / 1000)
  if (Math.random() < stallChance) return progress
  const jitter = 1 + (Math.random() * 2 - 1) * AI_SPEED_JITTER
  return progress + AI_BASE_SPEED_PER_MS * speedMultiplier * dtMs * jitter
}
