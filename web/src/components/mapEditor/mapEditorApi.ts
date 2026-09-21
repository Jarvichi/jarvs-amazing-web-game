import { isNative } from '../../platform'

// Backed by the Storybook dev-server middleware — unreachable in a native
// (Capacitor) build, so these throw a clear error instead of failing
// silently on tap (#2088).

export async function saveMap(mapId: string, data: unknown): Promise<void> {
  if (isNative()) throw new Error('Editor unavailable on native')
  const res = await fetch('/api/map-editor/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mapId, data }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Save failed: ${text}`)
  }
}

export async function saveQuestDefs(mapId: string, data: unknown): Promise<void> {
  if (isNative()) throw new Error('Editor unavailable on native')
  const res = await fetch('/api/map-editor/save-questdefs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mapId, data }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Save questDefs failed: ${text}`)
  }
}
