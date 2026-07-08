import { describe, it, expect } from 'vitest'
import {
  createRowState, applyStroke, decayLateral,
  TARGET_STROKE_MS, MAX_LATERAL,
} from './HarbourRegatta.physics'

describe('Harbour Regatta physics', () => {
  it('perfect alternation cancels lateral drift and keeps rowing straight', () => {
    let state = createRowState()
    let now = 1000
    const sides: Array<'left' | 'right'> = ['left', 'right', 'left', 'right', 'left', 'right']
    for (const side of sides) {
      state = applyStroke(state, side, now)
      now += TARGET_STROKE_MS
    }
    expect(state.lateralOffset).toBe(0)
    expect(state.progress).toBeGreaterThan(0)
  })

  it('hammering the same oar drifts the skiff toward that side and eventually clamps', () => {
    let state = createRowState()
    let now = 1000
    for (let i = 0; i < 3; i++) {
      state = applyStroke(state, 'right', now)
      now += TARGET_STROKE_MS
    }
    expect(state.lateralOffset).toBeGreaterThan(0)
    expect(state.lateralOffset).toBeLessThanOrEqual(MAX_LATERAL)

    for (let i = 0; i < 10; i++) {
      state = applyStroke(state, 'right', now)
      now += TARGET_STROKE_MS
    }
    expect(state.lateralOffset).toBe(MAX_LATERAL)
  })

  it('steady-interval alternating strokes yield more progress than ragged timing', () => {
    let steady = createRowState()
    let now = 1000
    const sides: Array<'left' | 'right'> = ['left', 'right', 'left', 'right', 'left', 'right']
    for (const side of sides) {
      steady = applyStroke(steady, side, now)
      now += TARGET_STROKE_MS
    }

    let ragged = createRowState()
    now = 1000
    const raggedIntervals = [50, 900, 60, 1200, 40, 950]
    for (let i = 0; i < sides.length; i++) {
      ragged = applyStroke(ragged, sides[i], now)
      now += raggedIntervals[i]
    }

    expect(steady.progress).toBeGreaterThan(ragged.progress)
  })

  it('repeated-oar strokes give reduced thrust compared to well-timed alternation', () => {
    let now = 1000
    let alternating = createRowState()
    alternating = applyStroke(alternating, 'left', now)
    now += TARGET_STROKE_MS
    const alternatingResult = applyStroke(alternating, 'right', now)

    now = 1000
    let repeating = createRowState()
    repeating = applyStroke(repeating, 'left', now)
    now += TARGET_STROKE_MS
    const repeatingResult = applyStroke(repeating, 'left', now)

    const alternatingGain = alternatingResult.progress - alternating.progress
    const repeatingGain = repeatingResult.progress - repeating.progress
    expect(alternatingGain).toBeGreaterThan(repeatingGain)
  })

  it('decayLateral pulls lateralOffset back toward the centreline over time', () => {
    let state = applyStroke(createRowState(), 'right', 1000)
    const offsetBefore = state.lateralOffset
    state = decayLateral(state, 2000)
    expect(state.lateralOffset).toBeGreaterThan(0)
    expect(state.lateralOffset).toBeLessThan(offsetBefore)
  })

  it('decayLateral is a no-op for non-positive dt', () => {
    const state = applyStroke(createRowState(), 'left', 1000)
    expect(decayLateral(state, 0)).toEqual(state)
  })
})
