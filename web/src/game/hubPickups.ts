const KEY = 'jarv_hub_pickups'

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function save(ids: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]))
  } catch { /* ignore */ }
}

export function getPickedUpIds(): Set<string> {
  return load()
}

export function isPickedUp(id: string): boolean {
  return load().has(id)
}

export function markPickedUp(id: string): void {
  const ids = load()
  ids.add(id)
  save(ids)
}
