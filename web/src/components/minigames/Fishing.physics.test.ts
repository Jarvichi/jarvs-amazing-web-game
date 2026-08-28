import { describe, it, expect } from 'vitest'
import {
  castMeterPower, castDistanceLabel, castTierWeights, pickWeightedIndex, biteWaitMs,
  createFightConfig, createFightState, stepFight, fightOutcome, fishInBand,
  CAST_SWEEP_MS, MIN_BITE_WAIT_MS, MAX_BITE_WAIT_MS, FIGHT_TIMEOUT_MS,
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
    for (let i = 0; i < 400 && fightOutcome(s) === 'fighting'; i++) {
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
