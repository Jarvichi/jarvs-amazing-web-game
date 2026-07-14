import { describe, it, expect } from 'vitest'
import { getTimeOfDay } from './hubClock'

describe('getTimeOfDay', () => {
  it('buckets night hours (20:00–05:59)', () => {
    expect(getTimeOfDay(20)).toBe('night')
    expect(getTimeOfDay(23)).toBe('night')
    expect(getTimeOfDay(0)).toBe('night')
    expect(getTimeOfDay(5)).toBe('night')
  })

  it('buckets dawn hours (06:00–07:59)', () => {
    expect(getTimeOfDay(6)).toBe('dawn')
    expect(getTimeOfDay(7)).toBe('dawn')
  })

  it('buckets day hours (08:00–19:59)', () => {
    expect(getTimeOfDay(8)).toBe('day')
    expect(getTimeOfDay(12)).toBe('day')
    expect(getTimeOfDay(19)).toBe('day')
  })

  it('transitions correctly at the day/night boundary', () => {
    expect(getTimeOfDay(19)).toBe('day')
    expect(getTimeOfDay(20)).toBe('night')
  })
})
