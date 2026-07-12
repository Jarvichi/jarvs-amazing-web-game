// Both the map editor and bundle editor save by writing straight onto JSON
// files that are also statically imported into the running app (config.json,
// bundles.json). Vite's dev server sees the write, finds no HMR-accept
// boundary registered for the plain modules that import them, and falls back
// to a full page reload — wiping the editor's in-memory view/selection/undo
// state even though the just-saved data is already what's on disk.
//
// `markSelfSave()` is called immediately before a save's fetch call; the
// resulting `import.meta.hot.accept(...)` callback checks `isSelfSave()` to
// tell a self-triggered save (safe to no-op — memory already matches disk)
// from an external change (another tab, or a hand-edit) and warns instead of
// silently discarding any unsaved in-tab work.
let selfSaveUntil = 0

export function markSelfSave(): void {
  // Generous window: covers the fetch round-trip plus Vite's file-watcher
  // debounce before the HMR event fires.
  selfSaveUntil = Date.now() + 5000
}

export function isSelfSave(): boolean {
  return Date.now() < selfSaveUntil
}
