/**
 * Dev mode is enabled via URL query parameter `?dev` (any value).
 * Shows the dev menu in Settings. Run in incognito to keep main save data intact.
 */
export function isDevMode(): boolean {
  try {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).has('dev')
  } catch {
    return false
  }
}

/**
 * No-damage mode is enabled via URL query parameter `?dev=1` or `?dev=true`.
 * This avoids persisting the flag in user settings; it's intended for temporary
 * test sessions invoked by appending `?dev=1` to the URL.
 */
export function isNoDamageMode(): boolean {
  try {
    if (typeof window === 'undefined') return false
    const p = new URLSearchParams(window.location.search)
    const v = (p.get('dev') ?? p.get('devMode') ?? '').toLowerCase()
    return v === '1' || v === 'true'
  } catch {
    return false
  }
}

/**
 * Debug mode is enabled via URL query parameter `?debug` (any value).
 * Shows avoidance-area overlays on the battlefield to help investigate stuck units.
 */
export function isDebugMode(): boolean {
  try {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).has('debug')
  } catch {
    return false
  }
}

export default null
