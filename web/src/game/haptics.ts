// ─── Haptics ──────────────────────────────────────────────────────────────
// Thin wrapper over navigator.vibrate, paired with the matching cue in
// sound.ts rather than wired to its own separate set of call sites (#2185)
// — every place the game already plays a card-play/hit/win/loss/reward sound
// is exactly the set of moments a haptic pulse belongs to.

const HAPTICS_KEY = 'jarv_haptics_enabled'

/** iOS Safari has no Vibration API at all; this makes every call below a safe no-op there. */
export function isHapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

export function isHapticsEnabled(): boolean {
  try { return localStorage.getItem(HAPTICS_KEY) !== 'false' }
  catch { return true }
}

export function setHapticsEnabled(val: boolean): void {
  try { localStorage.setItem(HAPTICS_KEY, val ? 'true' : 'false') } catch { /* ignore */ }
}

function vibrate(pattern: number | number[]): void {
  if (!isHapticsEnabled() || !isHapticsSupported()) return
  try { navigator.vibrate(pattern) } catch { /* ignore */ }
}

// Durations in ms. Short and light for frequent/minor events (a card play,
// a single hit), longer patterned bursts reserved for moments that only
// happen once per battle (win/loss) or are meant to feel like a reward.
export function hapticCardPlay(): void { vibrate(10) }
export function hapticHit(): void      { vibrate(15) }
export function hapticImpact(): void   { vibrate(25) }
export function hapticWin(): void      { vibrate([20, 40, 20, 40, 60]) }
export function hapticLoss(): void     { vibrate([40, 30, 40]) }
export function hapticReward(): void   { vibrate([15, 30, 25]) }
