import { markSelfSave } from '../../utils/hotReloadGuard'

// Persist the edited bundle registry back to src/data/bundles/bundles.json.
// Backed by the dev-server middleware registered in .storybook/middleware.mjs.
export async function saveBundles(data: unknown): Promise<void> {
  markSelfSave()
  const res = await fetch('/api/bundle-editor/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Save failed: ${text}`)
  }
}

export interface BundleTileRaw {
  tileID: string
  x: number
  y: number
  zlayer?: string
  glow?: boolean
  glowRadius?: number
  pulse?: boolean
  flame?: boolean
  flameType?: string    // FlameType — plain string so JSON round-trips don't widen-fail
  flameColor?: string   // FlameColor — plain string so JSON round-trips don't widen-fail
}

/** Append or replace a single bundle in bundles.json (reads current file server-side). */
export async function appendBundle(bundleId: string, tiles: BundleTileRaw[]): Promise<void> {
  markSelfSave()
  const res = await fetch('/api/bundle-editor/append', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bundleId, tiles }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Save failed: ${text}`)
  }
}
