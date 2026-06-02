const KEY = 'jarv_hub_inn_convos'

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function save(heard: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...heard]))
  } catch { /* ignore */ }
}

export function getHeardConvoIds(): Set<string> {
  return load()
}

export function markConvoHeard(id: string): void {
  const heard = load()
  heard.add(id)
  save(heard)
}

export function isConvoHeard(id: string): boolean {
  return load().has(id)
}
