import { markSelfSave } from '../../utils/hotReloadGuard'

// Persist the edited bundle registry back to src/data/bundles/battlefieldBundles.json.
// Backed by the dev-server middleware registered in .storybook/middleware.mjs.
export async function saveBattlefieldBundles(data: unknown): Promise<void> {
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
