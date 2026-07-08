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

export const AI_DIFFICULTY_EASY = 0.85 // sharpens AI timing less when the player is struggling
export const AI_DIFFICULTY_HARD = 1.15 // sharpens AI timing more when the player is rowing near-perfectly

// Maps the player's rolling rhythm quality (skillEma, 0..1) to an AI difficulty
// multiplier: ease off on a struggling player, tighten up on a skilled one so
// consistently perfect rowing doesn't trivialise the race.
export function aiDifficultyMultiplier(skillEma: number): number {
  const t = Math.max(0, Math.min(1, skillEma))
  return AI_DIFFICULTY_EASY + (AI_DIFFICULTY_HARD - AI_DIFFICULTY_EASY) * t
}

export interface AiConfig {
  timingStdDevMs: number // this boat's natural rhythm sloppiness
  mistakeChance: number  // per-stroke chance of fumbling (repeating the same oar)
}

const AI_TIMING_STDDEV_MIN_MS = 60
const AI_TIMING_STDDEV_MAX_MS = 220
const AI_MISTAKE_CHANCE_MIN = 0.05
const AI_MISTAKE_CHANCE_MAX = 0.15

// Randomised once per race per AI boat, so each rival keeps a distinct pace
// and consistency for the whole race instead of everyone converging on the
// same average (which is what a per-frame-random continuous speed model did).
export function createAiConfig(): AiConfig {
  return {
    timingStdDevMs: AI_TIMING_STDDEV_MIN_MS + Math.random() * (AI_TIMING_STDDEV_MAX_MS - AI_TIMING_STDDEV_MIN_MS),
    mistakeChance: AI_MISTAKE_CHANCE_MIN + Math.random() * (AI_MISTAKE_CHANCE_MAX - AI_MISTAKE_CHANCE_MIN),
  }
}

// Cheap roughly-gaussian noise via the sum of two uniforms (no new dependency).
function sampledTimingErrorMs(stdDevMs: number): number {
  const u1 = Math.random() - 0.5
  const u2 = Math.random() - 0.5
  return (u1 + u2) * stdDevMs
}

// Simulate one AI oar stroke through the exact same scoring function the
// player's own taps go through, so AI pace/veer/lateral clamping all come
// from one code path. The oar side alternates like a real rower, occasionally
// repeating (a "crab") per `config.mistakeChance`; the next stroke is
// scheduled around TARGET_STROKE_MS with per-boat timing noise, tightened by
// `difficultyMultiplier` as the player's own rhythm improves.
// Non-deterministic — not unit tested, same convention as the model it replaces.
export function simulateAiStroke(
  state: RowState, config: AiConfig, now: number, difficultyMultiplier: number,
): { state: RowState; nextTapAt: number } {
  const fumble = state.lastSide !== null && Math.random() < config.mistakeChance
  const side: OarSide = fumble
    ? state.lastSide as OarSide
    : (state.lastSide === 'left' ? 'right' : state.lastSide === 'right' ? 'left' : (Math.random() < 0.5 ? 'left' : 'right'))

  const nextState = applyStroke(state, side, now)

  const effectiveStdDev = config.timingStdDevMs / Math.max(0.5, difficultyMultiplier)
  const interval = TARGET_STROKE_MS + sampledTimingErrorMs(effectiveStdDev)
  const nextTapAt = now + Math.max(120, interval)

  return { state: nextState, nextTapAt }
}
