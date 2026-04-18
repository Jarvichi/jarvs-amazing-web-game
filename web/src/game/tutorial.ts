const KEY = 'jarv_tutorials_seen'

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch { /* ignore */ }
  return new Set()
}

export function hasSeen(id: string): boolean {
  return readSeen().has(id)
}

export function markSeen(id: string): void {
  const seen = readSeen()
  seen.add(id)
  try { localStorage.setItem(KEY, JSON.stringify([...seen])) } catch { /* ignore */ }
}
