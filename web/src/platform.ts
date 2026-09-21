// ─── Native-shell detection seam (#2084) ───────────────────────────────────
// Single import point for "are we running inside a native shell" so native
// branching (service worker gating, dev-surface gating, the Android back
// button, ...) never spreads as ad-hoc user-agent sniffing.
//
// Stubbed until the Capacitor project lands (#2093): both always report
// "web" so every call site this seam unblocks stays a safe no-op in the web
// build. Swap the body for `Capacitor.isNativePlatform()` /
// `Capacitor.getPlatform()` once `@capacitor/core` is installed.

export function isNative(): boolean {
  return false
}

export function nativePlatform(): 'ios' | 'android' | 'web' {
  return 'web'
}
