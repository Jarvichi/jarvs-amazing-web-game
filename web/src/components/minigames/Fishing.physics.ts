// ─── Fishing physics ──────────────────────────────────────────────────────────
// Pure functions for the two skill mechanics layered onto the fishing minigame:
//
//  1. The cast — a power meter sweeps 0→100→0 and the player taps to lock it in.
//     A longer cast reaches deeper water, biasing the tier roll toward bigger
//     fish (and lengthening the wait for a bite, so it is a real trade-off).
//  2. The fight — once hooked, the fish darts up and down a vertical run while
//     the player holds REEL to lift a band and keep the fish inside it. In-band
//     time fills the landing gauge; out-of-band time drains it. Empty the gauge
//     and the line goes slack and the fish is gone.
//
// Kept separate from the component (mirroring HarbourRegatta.physics.ts) so the
// weighting and fight math can be unit tested without rendering.

// ── Cast ──────────────────────────────────────────────────────────────────────

/** Full sweep of the cast meter, 0 → 100 → 0. */
export const CAST_SWEEP_MS = 1400
/** Power at or above this reaches the deep water where the big fish hold. */
export const DEEP_CAST_POWER = 70
/** Strongest tier multiplier at either end of the power range (see below). */
export const CAST_BIAS_STRENGTH = 3
/** Bite wait at zero power / at full power — a long cast takes longer to fish. */
export const MIN_BITE_WAIT_MS = 1600
export const MAX_BITE_WAIT_MS = 5200

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

/** Meter position (0-100) at `elapsedMs` into the sweep — a triangle wave, so
 *  the meter ramps up and back down and the player picks a moment on either
 *  limb. */
export function castMeterPower(elapsedMs: number): number {
  const t = (elapsedMs % CAST_SWEEP_MS) / CAST_SWEEP_MS
  return Math.round((t < 0.5 ? t * 2 : (1 - t) * 2) * 100)
}

/** Distance label for the HUD — purely cosmetic, but keeps the power number
 *  meaningful to the player ("where did my float land?"). */
export function castDistanceLabel(power: number): string {
  if (power < 25) return 'MARGIN'
  if (power < 50) return 'NEAR SHELF'
  if (power < DEEP_CAST_POWER) return 'MID WATER'
  if (power < 90) return 'DEEP CHANNEL'
  return 'FAR HORIZON'
}

/** Per-tier weights for a cast of `power`, in the same order as `chances`.
 *
 *  Power 50 leaves the published tier chances exactly as authored. Above that,
 *  weights tilt toward the back of the list (the big tiers) and away from the
 *  front; below it, the reverse. The tilt is a smooth exponential in
 *  CAST_BIAS_STRENGTH so no tier is ever zeroed out — a full-power cast can
 *  still turn up a minnow, and a dribbled one can still turn up a monster. */
export function castTierWeights(chances: number[], power: number): number[] {
  if (chances.length <= 1) return chances.slice()
  const tilt = clamp(power, 0, 100) / 50 - 1        // -1 (weakest) … +1 (strongest)
  return chances.map((chance, i) => {
    const rank = (i / (chances.length - 1)) * 2 - 1  // -1 (smallest tier) … +1 (largest)
    return chance * Math.pow(CAST_BIAS_STRENGTH, tilt * rank)
  })
}

/** Index into `weights` for `roll` ∈ [0,1) — proportional selection over the
 *  (unnormalised) weights returned by castTierWeights. */
export function pickWeightedIndex(weights: number[], roll: number): number {
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return 0
  const target = clamp(roll, 0, 0.999999) * total
  let cum = 0
  for (let i = 0; i < weights.length; i++) {
    cum += weights[i]
    if (target < cum) return i
  }
  return weights.length - 1
}

/** How long the float sits before a bite. Farther out = longer wait. */
export function biteWaitMs(power: number, roll: number): number {
  const base = MIN_BITE_WAIT_MS + (MAX_BITE_WAIT_MS - MIN_BITE_WAIT_MS) * (clamp(power, 0, 100) / 100)
  return Math.round(base * (0.75 + roll * 0.5))
}

// ── Fight ─────────────────────────────────────────────────────────────────────

export interface FightConfig {
  /** Height of the reel band as a fraction of the run (0-1). */
  bandSize: number
  /** How hard the fish pulls toward its current target position. */
  fishAccel: number
  /** Milliseconds between the fish picking a new place to bolt for. */
  fishRetargetMs: number
  /** Gauge filled per second while the fish is inside the band. */
  gaugeGain: number
  /** Gauge lost per second while it is outside. */
  gaugeDrain: number
}

export interface FightState {
  /** Centre of the player's reel band, 0 (bottom) … 1 (surface). */
  bandPos: number
  bandVel: number
  /** The fish, on the same axis. */
  fishPos: number
  fishVel: number
  fishTarget: number
  sinceRetargetMs: number
  /** Landing gauge, 0 (lost) … 1 (landed). */
  gauge: number
  elapsedMs: number
}

export type FightOutcome = 'fighting' | 'landed' | 'lost'

/** Band physics — hold REEL to accelerate the band up, release and gravity
 *  drops it back down. Deliberately floaty so it takes anticipation, not
 *  reflexes. */
export const BAND_LIFT      = 2.6   // units/s² while holding
export const BAND_GRAVITY   = 1.5   // units/s² always
export const BAND_DAMPING   = 3.2   // velocity decay per second
export const FIGHT_START_GAUGE = 0.35
export const FIGHT_TIMEOUT_MS  = 30000

/** Fight difficulty from the fish's tier index (0 = smallest tier). A Tiddler
 *  is a formality; a Legendary is a genuine scrap on a narrow band. */
export function createFightConfig(tierIndex: number, tierCount: number): FightConfig {
  const d = tierCount > 1 ? clamp(tierIndex / (tierCount - 1), 0, 1) : 0
  return {
    bandSize:       0.34 - 0.18 * d,
    fishAccel:      1.8 + 3.4 * d,
    fishRetargetMs: 900 - 480 * d,
    gaugeGain:      0.55 - 0.18 * d,
    gaugeDrain:     0.20 + 0.30 * d,
  }
}

export function createFightState(): FightState {
  return {
    bandPos: 0.25, bandVel: 0,
    fishPos: 0.55, fishVel: 0, fishTarget: 0.55, sinceRetargetMs: 0,
    gauge: FIGHT_START_GAUGE, elapsedMs: 0,
  }
}

/** True while the fish is within the player's band. */
export function fishInBand(state: FightState, cfg: FightConfig): boolean {
  return Math.abs(state.fishPos - state.bandPos) <= cfg.bandSize / 2
}

/** Advance the fight by `dtMs`. `rng` is injected so tests can drive the fish
 *  deterministically. */
export function stepFight(
  state: FightState, cfg: FightConfig, holding: boolean, dtMs: number, rng: () => number,
): FightState {
  const dt = Math.min(dtMs, 100) / 1000   // clamp so a backgrounded tab can't teleport the sim

  // Player band
  let bandVel = state.bandVel + (holding ? BAND_LIFT : 0) * dt - BAND_GRAVITY * dt
  bandVel -= bandVel * Math.min(1, BAND_DAMPING * dt)
  let bandPos = state.bandPos + bandVel * dt
  if (bandPos <= 0) { bandPos = 0; bandVel = Math.max(0, bandVel) }
  if (bandPos >= 1) { bandPos = 1; bandVel = Math.min(0, bandVel) }

  // Fish — bolts toward a target it re-picks on a timer
  let sinceRetargetMs = state.sinceRetargetMs + dtMs
  let fishTarget = state.fishTarget
  if (sinceRetargetMs >= cfg.fishRetargetMs) {
    sinceRetargetMs = 0
    fishTarget = rng()
  }
  let fishVel = state.fishVel + (fishTarget - state.fishPos) * cfg.fishAccel * dt
  fishVel -= fishVel * Math.min(1, 2.4 * dt)
  let fishPos = state.fishPos + fishVel * dt
  if (fishPos <= 0) { fishPos = 0; fishVel = Math.abs(fishVel) * 0.4 }
  if (fishPos >= 1) { fishPos = 1; fishVel = -Math.abs(fishVel) * 0.4 }

  const next: FightState = {
    bandPos, bandVel, fishPos, fishVel, fishTarget, sinceRetargetMs,
    gauge: state.gauge, elapsedMs: state.elapsedMs + dtMs,
  }
  const delta = fishInBand(next, cfg) ? cfg.gaugeGain : -cfg.gaugeDrain
  next.gauge = clamp(state.gauge + delta * dt, 0, 1)
  return next
}

export function fightOutcome(state: FightState): FightOutcome {
  if (state.gauge >= 1) return 'landed'
  if (state.gauge <= 0) return 'lost'
  if (state.elapsedMs >= FIGHT_TIMEOUT_MS) return 'lost'
  return 'fighting'
}
