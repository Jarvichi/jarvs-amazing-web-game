// Hub world clock — 30 real minutes = 1 full game day.
// Game hour is derived from device time modulo 30 minutes so that all
// players on the same device see the same time, and it advances smoothly.

/** Returns the current game hour (0–23). */
export function getGameHour(): number {
  const now = new Date()
  const realMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  return Math.floor((realMinutes % 30) / 30 * 24)
}

/** Returns the current game minute within the hour (0–59). */
export function getGameMinute(): number {
  const now = new Date()
  const realMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  const gameFraction = (realMinutes % 30) / 30  // 0–1 through the day
  const totalGameMinutes = gameFraction * 24 * 60
  return Math.floor(totalGameMinutes % 60)
}

/** Returns a display string like "14:30". */
export function formatGameTime(): string {
  const h = getGameHour()
  const m = getGameMinute()
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Night: 20:00–05:59. */
export function isNight(hour = getGameHour()): boolean {
  return hour >= 20 || hour < 6
}

/** Dawn: 06:00–07:59. */
export function isDawn(hour = getGameHour()): boolean {
  return hour >= 6 && hour < 8
}

/** Inn gathering hours: 20:00–23:59. */
export function isInnHours(hour = getGameHour()): boolean {
  return hour >= 20 && hour < 24
}

/** Returns true if the given hour range contains `hour` (wraps midnight). */
export function hourInRange(hour: number, start: number, end: number): boolean {
  if (start <= end) return hour >= start && hour < end
  // wraps midnight, e.g. start=22 end=6
  return hour >= start || hour < end
}
