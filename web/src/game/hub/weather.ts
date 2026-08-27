// Hub weather — pure logic. Resolves which weather a town shows, data-driven
// per town with sensible per-environment defaults and a date-driven season
// hook (for the seasonal-events tie-in, #1605). No PixiJS / DOM here.

export type WeatherType = 'clear' | 'rain' | 'snow' | 'fog'

export const WEATHER_TYPES: WeatherType[] = ['clear', 'rain', 'snow', 'fog']

/**
 * How each weather reads in the status bar. 'clear' is deliberately absent:
 * its natural glyph is the sun, which already sits beside the clock as the
 * day/night indicator, and two suns in one readout say nothing twice. Clear
 * weather is the default, so showing nothing is the honest rendering.
 */
export const WEATHER_READOUT: Partial<Record<WeatherType, { glyph: string; label: string }>> = {
  rain: { glyph: '🌧️', label: 'Rain' },
  snow: { glyph: '❄️',  label: 'Snow' },
  fog:  { glyph: '🌫️', label: 'Fog'  },
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

/**
 * Per-town weather config (optional `weather` field in config.json).
 * - `type`: force a single weather type (overrides everything).
 * - `bySeason`: pick weather from the current season.
 * - omitted entirely ⇒ environment default.
 */
export interface WeatherConfig {
  type?: WeatherType
  bySeason?: Partial<Record<Season, WeatherType>>
}

/** Northern-hemisphere season from a calendar month (0–11). */
export function seasonForDate(date: Date = new Date()): Season {
  const m = date.getMonth()
  if (m <= 1 || m === 11) return 'winter'
  if (m <= 4) return 'spring'
  if (m <= 7) return 'summer'
  return 'autumn'
}

// Default weather per town environment when no explicit config is given.
const ENVIRONMENT_DEFAULTS: Record<string, WeatherType> = {
  snow: 'snow',
  ice: 'snow',
  tundra: 'snow',
  swamp: 'fog',
  marsh: 'fog',
  graveyard: 'fog',
  ashen: 'fog',
  forest: 'rain',
  camp: 'clear',
  desert: 'clear',
}

/**
 * Resolve the active weather for a town.
 * Precedence: explicit `type` → seasonal mapping → environment default → clear.
 */
export function resolveWeather(
  cfg: WeatherConfig | undefined,
  environment: string | undefined,
  date: Date = new Date(),
): WeatherType {
  if (cfg?.type) return cfg.type
  if (cfg?.bySeason) {
    const seasonal = cfg.bySeason[seasonForDate(date)]
    if (seasonal) return seasonal
  }
  if (environment && ENVIRONMENT_DEFAULTS[environment]) return ENVIRONMENT_DEFAULTS[environment]
  return 'clear'
}
