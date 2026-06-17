import { describe, it, expect } from 'vitest'
import { resolveWeather, seasonForDate, WEATHER_TYPES } from './weather'

const d = (month: number) => new Date(2026, month, 15)

describe('seasonForDate', () => {
  it('maps months to northern-hemisphere seasons', () => {
    expect(seasonForDate(d(0))).toBe('winter')   // Jan
    expect(seasonForDate(d(3))).toBe('spring')    // Apr
    expect(seasonForDate(d(6))).toBe('summer')    // Jul
    expect(seasonForDate(d(9))).toBe('autumn')    // Oct
    expect(seasonForDate(d(11))).toBe('winter')   // Dec
  })
})

describe('resolveWeather', () => {
  it('explicit type overrides everything', () => {
    expect(resolveWeather({ type: 'snow' }, 'forest', d(6))).toBe('snow')
  })

  it('seasonal mapping wins over environment default', () => {
    const cfg = { bySeason: { winter: 'snow' as const, summer: 'rain' as const } }
    expect(resolveWeather(cfg, 'desert', d(0))).toBe('snow')   // winter
    expect(resolveWeather(cfg, 'desert', d(6))).toBe('rain')   // summer
  })

  it('falls back to the season-less environment default', () => {
    expect(resolveWeather({ bySeason: { winter: 'snow' } }, 'swamp', d(6))).toBe('fog') // summer not mapped → env default
    expect(resolveWeather(undefined, 'snow', d(6))).toBe('snow')
  })

  it('defaults to clear for unknown environments / no config', () => {
    expect(resolveWeather(undefined, 'farmland', d(6))).toBe('clear')
    expect(resolveWeather(undefined, undefined, d(6))).toBe('clear')
  })

  it('only returns known weather types', () => {
    const r = resolveWeather(undefined, 'forest', d(6))
    expect(WEATHER_TYPES).toContain(r)
  })
})
