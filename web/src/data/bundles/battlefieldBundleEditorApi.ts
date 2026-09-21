import { markSelfSave } from '../../utils/hotReloadGuard'
import { isNative } from '../../platform'

// Persist the edited bundle registry back to src/data/bundles/battlefieldBundles.json.
// Backed by the dev-server middleware registered in .storybook/middleware.mjs
// — unreachable in a native (Capacitor) build, so this throws a clear error
// instead of failing silently on tap (#2088).
export async function saveBattlefieldBundles(data: unknown): Promise<void> {
  if (isNative()) throw new Error('Editor unavailable on native')
  markSelfSave()
  const res = await fetch('/api/battlefield-bundle-editor/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Save failed: ${text}`)
  }
}
