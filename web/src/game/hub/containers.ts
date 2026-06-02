const KEY = 'hub_opened_containers'

export function getOpenedContainerIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]')) } catch { return new Set() }
}

export function markContainerOpened(id: string): void {
  try {
    const ids = getOpenedContainerIds()
    ids.add(id)
    localStorage.setItem(KEY, JSON.stringify([...ids]))
  } catch {}
}
