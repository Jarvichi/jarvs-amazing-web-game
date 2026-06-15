const KEY = 'jarv_hub_dialogue_flags'

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function save(flags: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...flags]))
  } catch { /* ignore */ }
}

/** Persist a named dialogue flag (idempotent). */
export function setDialogueFlag(flag: string): void {
  const flags = load()
  if (flags.has(flag)) return
  flags.add(flag)
  save(flags)
}

export function hasDialogueFlag(flag: string): boolean {
  return load().has(flag)
}

export function getDialogueFlags(): string[] {
  return [...load()]
}

// ── "Seen" branch tracking ───────────────────────────────────────────────────
// Visited dialogue nodes are persisted as flags using the `seen:<treeId>:<nodeId>`
// convention so authors can gate branches on whether the player has been here.

function seenFlag(treeId: string, nodeId: string): string {
  return `seen:${treeId}:${nodeId}`
}

export function markNodeSeen(treeId: string, nodeId: string): void {
  setDialogueFlag(seenFlag(treeId, nodeId))
}

export function hasNodeSeen(treeId: string, nodeId: string): boolean {
  return hasDialogueFlag(seenFlag(treeId, nodeId))
}
