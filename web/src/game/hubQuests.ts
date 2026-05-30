const KEY = 'jarv_hub_quests'

export type QuestStatus = 'available' | 'active' | 'completed'

export interface HubQuestSave {
  status: QuestStatus
  progress: Record<string, number>
  completedAt?: number
}

type QuestStore = Record<string, HubQuestSave>

function load(): QuestStore {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as QuestStore) : {}
  } catch {
    return {}
  }
}

function save(store: QuestStore): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch { /* ignore */ }
}

export function loadAllQuestStates(): QuestStore {
  return load()
}

export function getQuestState(questId: string): HubQuestSave {
  return load()[questId] ?? { status: 'available', progress: {} }
}

export function setQuestStatus(questId: string, status: QuestStatus): void {
  const store = load()
  const entry = store[questId] ?? { status: 'available', progress: {} }
  entry.status = status
  if (status === 'completed') entry.completedAt = Date.now()
  store[questId] = entry
  save(store)
}

export function incrementQuestProgress(questId: string, key: string, by = 1): void {
  const store = load()
  const entry = store[questId] ?? { status: 'active', progress: {} }
  entry.progress[key] = (entry.progress[key] ?? 0) + by
  store[questId] = entry
  save(store)
}

export function getQuestProgress(questId: string, key: string): number {
  return load()[questId]?.progress[key] ?? 0
}
