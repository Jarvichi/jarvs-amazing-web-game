const KEY = 'jarv_hub_treasures'

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch { return new Set() }
}

function save(ids: Set<string>): void {
  try { localStorage.setItem(KEY, JSON.stringify([...ids])) } catch { /* ignore */ }
}

export function getCollectedTreasureIds(): Set<string> { return load() }
export function isTreasureCollected(id: string): boolean { return load().has(id) }
export function markTreasureCollected(id: string): void {
  const ids = load()
  ids.add(id)
  save(ids)
}
export function resetTreasures(): void {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
