import { describe, it, expect } from 'vitest'
import {
  castMeterPower, castDistanceLabel, castTierWeights, pickWeightedIndex, biteWaitMs,
  createFightConfig, createFightState, stepFight, fightOutcome, fishInBand,
  CAST_SWEEP_MS, MIN_BITE_WAIT_MS, MAX_BITE_WAIT_MS, FIGHT_TIMEOUT_MS,
  FIGHT_GRACE_MS, FIGHT_START_GAUGE,
} from './Fishing.physics'

const CHANCES = [40, 30, 15, 9, 5, 1]

describe('cast meter', () => {
  it('sweeps 0 → 100 → 0 across one cycle and repeats', () => {
    expect(castMeterPower(0)).toBe(0)
    expect(castMeterPower(CAST_SWEEP_MS / 2)).toBe(100)
    expect(castMeterPower(CAST_SWEEP_MS)).toBe(0)
    expect(castMeterPower(CAST_SWEEP_MS * 1.5)).toBe(100)
    expect(castMeterPower(CAST_SWEEP_MS * 0.25)).toBe(50)
    expect(castMeterPower(CAST_SWEEP_MS * 0.75)).toBe(50)
  })

  it('labels every power without gaps', () => {
    for (let p = 0; p <= 100; p += 5) expect(castDistanceLabel(p)).toMatch(/^[A-Z ]+$/)
  })
})

describe('castTierWeights', () => {
  it('leaves the authored chances untouched at neutral power', () => {
    expect(castTierWeights(CHANCES, 50)).toEqual(CHANCES)
  })

  it('a full-power cast favours the big tiers over the small ones', () => {
    const w = castTierWeights(CHANCES, 100)
    expect(w[5] / w[0]).toBeGreaterThan(CHANCES[5] / CHANCES[0])
    expect(w[0]).toBeLessThan(CHANCES[0])
    expect(w[5]).toBeGreaterThan(CHANCES[5])
  })

  it('a weak cast favours the small tiers', () => {
    const w = castTierWeights(CHANCES, 0)
    expect(w[0]).toBeGreaterThan(CHANCES[0])
    expect(w[5]).toBeLessThan(CHANCES[5])
  })

  it('never zeroes a tier out — any cast can still hook anything', () => {
    for (const power of [0, 25, 75, 100]) {
      for (const w of castTierWeights(CHANCES, power)) expect(w).toBeGreaterThan(0)
    }
  })

  it('is monotonic in power for the top and bottom tier', () => {
    const powers = [0, 20, 40, 60, 80, 100]
    const top = powers.map(p => castTierWeights(CHANCES, p)[5])
    const bottom = powers.map(p => castTierWeights(CHANCES, p)[0])
    for (let i = 1; i < powers.length; i++) {
      expect(top[i]).toBeGreaterThan(top[i - 1])
      expect(bottom[i]).toBeLessThan(bottom[i - 1])
    }
  })

  it('handles a single-tier list', () => {
    expect(castTierWeights([7], 100)).toEqual([7])
  })
})

describe('pickWeightedIndex', () => {
  it('selects proportionally across the weight bands', () => {
    expect(pickWeightedIndex([50, 50], 0)).toBe(0)
    expect(pickWeightedIndex([50, 50], 0.49)).toBe(0)
    expect(pickWeightedIndex([50, 50], 0.5)).toBe(1)
    expect(pickWeightedIndex([50, 50], 0.999)).toBe(1)
  })

  it('clamps a roll of exactly 1 into the last band', () => {
    expect(pickWeightedIndex([1, 1, 1], 1)).toBe(2)
  })

  it('falls back to the first index when every weight is zero', () => {
    expect(pickWeightedIndex([0, 0], 0.5)).toBe(0)
  })
})

describe('biteWaitMs', () => {
  it('waits longer for a longer cast', () => {
    expect(biteWaitMs(100, 0.5)).toBeGreaterThan(biteWaitMs(0, 0.5))
  })

  it('stays inside the tuned envelope for any roll', () => {
    for (const power of [0, 50, 100]) {
      for (const roll of [0, 0.5, 0.999]) {
        const ms = biteWaitMs(power, roll)
        expect(ms).toBeGreaterThanOrEqual(MIN_BITE_WAIT_MS * 0.75)
        expect(ms).toBeLessThanOrEqual(MAX_BITE_WAIT_MS * 1.25)
      }
    }
  })
})

describe('fight difficulty', () => {
  it('gives bigger fish a narrower band, a faster fish and a harsher drain', () => {
    const easy = createFightConfig(0, 6)
    const hard = createFightConfig(5, 6)
    expect(hard.bandSize).toBeLessThan(easy.bandSize)
    expect(hard.fishAccel).toBeGreaterThan(easy.fishAccel)
    expect(hard.fishRetargetMs).toBeLessThan(easy.fishRetargetMs)
    expect(hard.gaugeGain).toBeLessThan(easy.gaugeGain)
    expect(hard.gaugeDrain).toBeGreaterThan(easy.gaugeDrain)
  })

  it('keeps every tier playable — the band never closes and gain stays positive', () => {
    for (let i = 0; i < 6; i++) {
      const cfg = createFightConfig(i, 6)
      expect(cfg.bandSize).toBeGreaterThan(0.1)
      expect(cfg.gaugeGain).toBeGreaterThan(0)
    }
  })
})

describe('stepFight', () => {
  const cfg = createFightConfig(0, 6)

  it('holding lifts the band and releasing drops it', () => {
    let s = createFightState()
    for (let i = 0; i < 40; i++) s = stepFight(s, cfg, true, 16, () => 0.5)
    const lifted = s.bandPos
    expect(lifted).toBeGreaterThan(createFightState().bandPos)
    for (let i = 0; i < 40; i++) s = stepFight(s, cfg, false, 16, () => 0.5)
    expect(s.bandPos).toBeLessThan(lifted)
  })

  it('keeps the band inside the run however long the player holds', () => {
    let s = createFightState()
    for (let i = 0; i < 600; i++) s = stepFight(s, cfg, true, 16, () => 0.5)
    expect(s.bandPos).toBeLessThanOrEqual(1)
    for (let i = 0; i < 600; i++) s = stepFight(s, cfg, false, 16, () => 0.5)
    expect(s.bandPos).toBeGreaterThanOrEqual(0)
  })

  it('keeps the fish inside the run', () => {
    let s = createFightState()
    const rng = () => (s.elapsedMs % 320 < 160 ? 0 : 1)
    for (let i = 0; i < 400; i++) s = stepFight(s, cfg, false, 16, rng)
    expect(s.fishPos).toBeGreaterThanOrEqual(0)
    expect(s.fishPos).toBeLessThanOrEqual(1)
  })

  it('fills the gauge while the fish is held in the band', () => {
    // Pin the fish where the band starts and never retarget it away.
    let s = { ...createFightState(), fishPos: 0.25, fishTarget: 0.25 }
    expect(fishInBand(s, cfg)).toBe(true)
    const before = s.gauge
    for (let i = 0; i < 10; i++) s = stepFight(s, cfg, false, 16, () => 0.25)
    expect(s.gauge).toBeGreaterThan(before)
  })

  it('drains the gauge to zero when the fish is left out of the band', () => {
    let s = { ...createFightState(), bandPos: 0, bandVel: 0, fishPos: 1, fishTarget: 1 }
    // Bounded by the fight's own timeout rather than a step count, so a change
    // to the drain rate can't quietly make this stop reaching the outcome it
    // is asserting (a slower drain did exactly that).
    while (fightOutcome(s) === 'fighting' && s.elapsedMs < FIGHT_TIMEOUT_MS) {
      s = stepFight(s, cfg, false, 16, () => 1)
    }
    expect(s.gauge).toBe(0)
    expect(fightOutcome(s)).toBe('lost')
  })

  it('clamps a huge delta so a backgrounded tab cannot skip the fight', () => {
    const s = stepFight(createFightState(), cfg, false, 60000, () => 0.5)
    expect(s.gauge).toBeGreaterThan(0)
    expect(s.gauge).toBeLessThan(1)
  })
})

describe('fightOutcome', () => {
  it('reports landed, lost and fighting from the gauge', () => {
    const base = createFightState()
    expect(fightOutcome(base)).toBe('fighting')
    expect(fightOutcome({ ...base, gauge: 1 })).toBe('landed')
    expect(fightOutcome({ ...base, gauge: 0 })).toBe('lost')
  })

  it('times a stalemate out as a loss', () => {
    expect(fightOutcome({ ...createFightState(), elapsedMs: FIGHT_TIMEOUT_MS })).toBe('lost')
  })
})

// ── Winnability ───────────────────────────────────────────────────────────────
// A fight nobody can win is indistinguishable from a broken one, and the tuning
// is a handful of coupled constants — so pin the difficulty curve down by
// actually playing it. `lagMs` is how often the player re-reads the screen and
// changes their mind: 16ms is a machine, 350ms is someone half paying attention.
// The controller is deliberately naive (hold whenever the fish is above the
// band, never anticipate), so a real player should beat these numbers.

function playFight(tierIndex: number, lagMs: number, seed: number, delayMs = 0): boolean {
  return timedFight(tierIndex, lagMs, seed, delayMs).landed
}

function timedFight(tierIndex: number, lagMs: number, seed: number, delayMs = 0): { landed: boolean; ms: number } {
  let rngState = seed
  const rng = () => { rngState = (rngState * 1103515245 + 12345) % 2147483648; return rngState / 2147483648 }
  const cfg = createFightConfig(tierIndex, 6)
  let state = createFightState()
  let holding = false
  let sinceDecision = 0
  for (let i = 0; i < 3000; i++) {
    sinceDecision += 16
    const awake = state.elapsedMs >= delayMs
    if (awake && sinceDecision >= lagMs) { sinceDecision = 0; holding = state.fishPos > state.bandPos }
    state = stepFight(state, cfg, awake && holding, 16, rng)
    const outcome = fightOutcome(state)
    if (outcome !== 'fighting') return { landed: outcome === 'landed', ms: state.elapsedMs }
  }
  return { landed: false, ms: state.elapsedMs }
}

function landRate(tierIndex: number, lagMs: number, delayMs = 0): number {
  let wins = 0
  for (let seed = 1; seed <= 40; seed++) if (playFight(tierIndex, lagMs, seed * 7919, delayMs)) wins++
  return wins / 40
}

/** Median time to land, over the seeds a competent player actually wins. */
function medianLandingMs(tierIndex: number, lagMs: number, delayMs: number): number {
  const times: number[] = []
  for (let seed = 1; seed <= 40; seed++) {
    const r = timedFight(tierIndex, lagMs, seed * 7919, delayMs)
    if (r.landed) times.push(r.ms)
  }
  if (times.length === 0) return Infinity
  times.sort((a, b) => a - b)
  return times[Math.floor(times.length / 2)]
}

/** How long a player who never touches the controls survives. */
function idleSurvivalMs(tierIndex: number): number {
  const cfg = createFightConfig(tierIndex, 6)
  let state = createFightState()
  while (fightOutcome(state) === 'fighting' && state.elapsedMs < FIGHT_TIMEOUT_MS) {
    state = stepFight(state, cfg, false, 16, () => 0.5)
  }
  return state.elapsedMs
}

describe('fight winnability', () => {
  it('is landable at every tier by a player who is paying attention', () => {
    for (let tier = 0; tier < 6; tier++) expect(landRate(tier, 16)).toBeGreaterThan(0.6)
  })

  it('lets the smallest tier be landed even by a distracted player', () => {
    expect(landRate(0, 350)).toBeGreaterThan(0.8)
  })

  it('makes the top tiers a real scrap — distracted play loses them', () => {
    // Sloppy means slow to notice AND slow to correct. Control lag alone is
    // too weak a proxy now that a fight opens in the player's favour: someone
    // reacting instantly but coarsely can still muscle a Legendary in.
    expect(landRate(5, 350, 1500)).toBeLessThan(0.2)
    expect(landRate(5, 16)).toBeGreaterThan(landRate(5, 200, 1500))
  })

  // The bug this pins down: the fight used to start with the fish OUTSIDE the
  // band, so the gauge drained from the first frame and the whole thing was
  // over in 0.9-2.0s. Every controller above starts reacting instantly, so
  // none of them noticed — a real player who took a beat to read the screen
  // lost every tier, every time.
  it('never ends before a player has had time to react', () => {
    // Two guarantees stack: FIGHT_GRACE_MS where nothing can hurt you, then a
    // visible drain before the line goes. Doing nothing at all should still
    // lose — it just must never lose before the player can act.
    for (let tier = 0; tier < 6; tier++) {
      expect(idleSurvivalMs(tier)).toBeGreaterThan(FIGHT_GRACE_MS + 800)
    }
  })

  it('opens with the fish already inside the band', () => {
    for (let tier = 0; tier < 6; tier++) {
      expect(fishInBand(createFightState(), createFightConfig(tier, 6))).toBe(true)
    }
  })

  it('cannot lose ground during the opening grace beat', () => {
    const cfg = createFightConfig(5, 6)
    // Park the band at the floor so the fish is out of it as soon as it can move.
    let state = { ...createFightState(), bandPos: 0, fishPos: 1, fishTarget: 1 }
    while (state.elapsedMs < FIGHT_GRACE_MS) state = stepFight(state, cfg, false, 16, () => 1)
    expect(state.gauge).toBeGreaterThanOrEqual(FIGHT_START_GAUGE)
  })

  it('is still landable by a player who takes a beat to react', () => {
    // The everyday tiers — 94% of what gets hooked — should not punish a
    // player for spending the first beat working out what is happening.
    for (let tier = 0; tier < 4; tier++) {
      expect(landRate(tier, 200, 700)).toBeGreaterThan(0.9)
    }
    // Trophy and Legendary stay a genuine contest at that pace: reachable,
    // never a formality. A Legendary that often gets away is the point.
    expect(landRate(4, 200, 700)).toBeGreaterThan(0.6)
    expect(landRate(5, 200, 700)).toBeGreaterThan(0.25)
    expect(landRate(5, 200, 700)).toBeLessThan(0.8)
  })

  // Requested shape of the fight: an easy fish should still be a ~7.5s piece
  // of play rather than a formality, and the hardest should run to around 30s
  // without tipping past it into the stalemate cutoff. Measured against a
  // competent player — someone who takes a beat to react and corrects a few
  // times a second — since that is who the numbers are meant to describe.
  const COMPETENT = { lag: 200, delay: 700 }

  it('cannot be landed faster than 7.5s even with flawless play', () => {
    // Structural, not statistical: the gauge climbs from FIGHT_START_GAUGE to
    // full at gaugeGain, so this is the floor for every tier no matter how
    // perfectly the fish is held. Pin the fish to the band and time it.
    for (let tier = 0; tier < 6; tier++) {
      const cfg = createFightConfig(tier, 6)
      let state = createFightState()
      while (fightOutcome(state) === 'fighting' && state.elapsedMs < FIGHT_TIMEOUT_MS) {
        // Keep the fish exactly on the band centre — the best any player could do.
        state = { ...stepFight(state, cfg, false, 16, () => 0.5), fishPos: state.bandPos }
      }
      expect(fightOutcome(state)).toBe('landed')
      expect(state.elapsedMs).toBeGreaterThanOrEqual(7500)
    }
  })

  it('runs an easy fish for at least the intended 7.5s', () => {
    for (let tier = 0; tier < 3; tier++) {
      expect(medianLandingMs(tier, COMPETENT.lag, COMPETENT.delay)).toBeGreaterThanOrEqual(7500)
    }
  })

  it('keeps the hardest fish around the intended 30s ceiling', () => {
    const hardest = medianLandingMs(5, COMPETENT.lag, COMPETENT.delay)
    expect(hardest).toBeGreaterThan(20000)
    expect(hardest).toBeLessThan(36000)
    // A fight that legitimately runs to the ceiling must not be cut off as a
    // stalemate — the timeout is a backstop, not the difficulty.
    expect(hardest).toBeLessThan(FIGHT_TIMEOUT_MS * 0.8)
  })

  it('takes longer the bigger the fish is', () => {
    const times = [0, 2, 4, 5].map(t => medianLandingMs(t, COMPETENT.lag, COMPETENT.delay))
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1])
  })

  it('gets harder monotonically as the tiers get bigger', () => {
    const rates = [0, 1, 2, 3, 4, 5].map(t => landRate(t, 200))
    expect(rates[0]).toBeGreaterThanOrEqual(rates[5])
    expect(rates[5]).toBeLessThan(rates[2])
  })
})
