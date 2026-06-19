// Hub calendar — pure date→season/festival layer (issue #1605). Drives
// time-limited festival decor, quests, and the HUD badge. Builds on the
// date→season helper from the weather work. No PixiJS / React here.

import { seasonForDate, type Season } from './weather'

export type { Season }
export { seasonForDate }

interface MonthDay { month: number; day: number }   // month is 1–12

export interface Festival {
  id: string
  name: string
  icon: string
  /** Inclusive window in the calendar year; wraps the new year when start > end. */
  start: MonthDay
  end: MonthDay
}

/**
 * Festival registry — single source of truth for runtime, the map editor, and
 * Storybook. Windows are real-date driven; add an entry to introduce a festival.
 */
export const FESTIVALS: Festival[] = [
  { id: 'midsummer', name: 'Midsummer Fair',  icon: '🏮', start: { month: 6, day: 1 },  end: { month: 7, day: 15 } },
  { id: 'harvest',   name: 'Harvest Festival', icon: '🌾', start: { month: 9, day: 15 }, end: { month: 10, day: 31 } },
  { id: 'midwinter', name: 'Midwinter Feast',  icon: '❄️', start: { month: 12, day: 18 }, end: { month: 1, day: 6 } },
]

const OVERRIDE_KEY = 'jarv_hub_festival_override'

/** QA override: a festival id, `'none'` (force no festival), or null (use date). */
export function getFestivalOverride(): string | null {
  try { return localStorage.getItem(OVERRIDE_KEY) } catch { return null }
}

export function setFestivalOverride(idOrNull: string | null): void {
  try {
    if (idOrNull == null) localStorage.removeItem(OVERRIDE_KEY)
    else localStorage.setItem(OVERRIDE_KEY, idOrNull)
  } catch { /* QA convenience — fire and forget */ }
}

/** mmdd ordinal so windows compare with simple numeric tests. */
function ord(m: number, d: number): number { return m * 100 + d }

function inWindow(date: Date, f: Festival): boolean {
  const v = ord(date.getMonth() + 1, date.getDate())
  const s = ord(f.start.month, f.start.day)
  const e = ord(f.end.month, f.end.day)
  return s <= e ? (v >= s && v <= e) : (v >= s || v <= e)   // wraps the new year
}

/**
 * The active festival, honoring the QA override, else the first festival whose
 * window contains `date`. Returns null when none is active.
 */
export function getActiveFestival(date: Date = new Date()): Festival | null {
  const override = getFestivalOverride()
  if (override === 'none') return null
  if (override) return FESTIVALS.find(f => f.id === override) ?? null
  return FESTIVALS.find(f => inWindow(date, f)) ?? null
}

// Dev-only console hook so QA can force a festival without changing the date.
if (typeof window !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
  ;(window as unknown as { setFestivalOverride?: typeof setFestivalOverride }).setFestivalOverride = setFestivalOverride
}
