/**
 * Persistence for every setting on the settings screen: the localStorage
 * keys, their load/save helpers, and the `apply*` functions that push a
 * value onto the document.
 *
 * Split out of SettingsScreen.tsx when that screen was broken into tabs
 * (#2165) — the tab components need these, and importing them back out of
 * SettingsScreen.tsx would make the module graph circular. SettingsScreen
 * re-exports the ones App.tsx, TitleScreen, Battlefield and HubWorld
 * already import, so no call site outside this folder changes.
 */

const TEXT_SIZE_KEY      = 'jarv_text_size'
const TEXT_COLOR_KEY     = 'jarv_text_color'
const SKIP_INTRO_KEY     = 'jarv_skip_intro'
const EIGHTBIT_UNLOCKED_KEY = 'jarv_8bit_unlocked'
const EIGHTBIT_ENABLED_KEY  = 'jarv_8bit_enabled'
const BATTLE_POPUPS_KEY     = 'jarv_battle_popups'

export function loadSkipIntro(): boolean {
  try { return localStorage.getItem(SKIP_INTRO_KEY) === 'true' }
  catch { return false }
}

export function saveSkipIntro(val: boolean): void {
  try { localStorage.setItem(SKIP_INTRO_KEY, String(val)) } catch { /* ignore */ }
}

export function loadTextSize(): number {
  try { return parseFloat(localStorage.getItem(TEXT_SIZE_KEY) ?? '14') || 14 }
  catch { return 14 }
}

export function saveTextSize(val: number): void {
  try { localStorage.setItem(TEXT_SIZE_KEY, String(val)) } catch { /* ignore */ }
}

export function loadTextColor(): string {
  try { return localStorage.getItem(TEXT_COLOR_KEY) ?? '#33ff33' }
  catch { return '#33ff33' }
}

export function saveTextColor(val: string): void {
  try { localStorage.setItem(TEXT_COLOR_KEY, val) } catch { /* ignore */ }
}

export function load8bitUnlocked(): boolean {
  try { return localStorage.getItem(EIGHTBIT_UNLOCKED_KEY) === 'true' }
  catch { return false }
}

export function unlock8bitMode(): void {
  try { localStorage.setItem(EIGHTBIT_UNLOCKED_KEY, 'true') } catch { /* ignore */ }
}

export function load8bitEnabled(): boolean {
  try { return localStorage.getItem(EIGHTBIT_ENABLED_KEY) === 'true' }
  catch { return false }
}

export function save8bitEnabled(val: boolean): void {
  try { localStorage.setItem(EIGHTBIT_ENABLED_KEY, String(val)) } catch { /* ignore */ }
}

export function apply8bitMode(enabled: boolean): void {
  document.documentElement.classList.toggle('eightbit-mode', enabled)
  window.dispatchEvent(new Event('eightbit-change'))
}

// Light mode was retired (#2184): only 5 of 654+ hardcoded colours in the
// stylesheet actually responded to it, so it produced dark panels on a
// cream background rather than a real light theme. This clears the stale
// preference for anyone who had it on, so they land on the (correct,
// readable) dark theme instead of a setting that no longer does anything.
export function clearLegacyLightMode(): void {
  try { localStorage.removeItem('jarv_light_mode') } catch { /* ignore */ }
}

export function loadMonochromeEnabled(): boolean {
  try { return localStorage.getItem('jarv_monochrome_enabled') === 'true' }
  catch { return false }
}

export function saveMonochromeEnabled(val: boolean): void {
  try { localStorage.setItem('jarv_monochrome_enabled', String(val)) } catch { /* ignore */ }
}

export function applyMonochromeMode(enabled: boolean): void {
  document.documentElement.classList.toggle('monochrome-mode', enabled)
  window.dispatchEvent(new Event('monochrome-change'))
}

export function loadBattlePopups(): boolean {
  try { return localStorage.getItem(BATTLE_POPUPS_KEY) !== 'false' }
  catch { return true }
}

export function saveBattlePopups(val: boolean): void {
  try { localStorage.setItem(BATTLE_POPUPS_KEY, String(val)) } catch { /* ignore */ }
}

export function applyTextSettings(): void {
  const size  = loadTextSize()
  const color = loadTextColor()
  document.documentElement.style.setProperty('--game-font-size', `${size}px`)
  document.documentElement.style.setProperty('--game-text-color', color)
}

export const TEXT_COLOR_PRESETS = [
  { label: 'Terminal Green', value: '#33ff33' },
  { label: 'Amber',          value: '#ffbb33' },
  { label: 'Cyan',           value: '#33ddff' },
  { label: 'White',          value: '#e8e8e8' },
  { label: 'Pink',           value: '#ff88cc' },
]

export const isDebugMode = new URLSearchParams(window.location.search).has('debug')


export function exportLocalStorage(): void {
  const data: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) data[key] = localStorage.getItem(key) ?? ''
    }
  } catch { /* ignore */ }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `jarv-save-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
