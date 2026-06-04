const KEY = 'jarv_world_state'

interface StoredState {
  currentLocationId: string
  nodes: Record<string, { visited: boolean; cleared: boolean }>
}

function load(): StoredState {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : { currentLocationId: 'ravenwatch', nodes: {} }
  } catch {
    return { currentLocationId: 'ravenwatch', nodes: {} }
  }
}

function save(state: StoredState): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

export function getCurrentWorldLocation(): string {
  return load().currentLocationId
}

export function setCurrentWorldLocation(id: string): void {
  const state = load()
  state.currentLocationId = id
  save(state)
}

export function setWorldNodeVisited(id: string): void {
  const state = load()
  state.nodes[id] = { ...state.nodes[id] ?? { cleared: false }, visited: true }
  save(state)
}

export function markNodeCleared(id: string): void {
  const state = load()
  state.nodes[id] = { visited: true, cleared: true }
  save(state)
}

export function isNodeCleared(id: string): boolean {
  return load().nodes[id]?.cleared ?? false
}

export function isNodeVisited(id: string): boolean {
  return load().nodes[id]?.visited ?? false
}

export function getAllClearedNodeIds(): string[] {
  const state = load()
  return Object.entries(state.nodes)
    .filter(([, v]) => v.cleared)
    .map(([k]) => k)
}

export function resetWorldState(): void {
  localStorage.removeItem(KEY)
}
