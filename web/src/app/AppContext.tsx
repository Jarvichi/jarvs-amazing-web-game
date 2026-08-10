import { createContext, useContext, type Dispatch, type MutableRefObject, type ReactNode, type SetStateAction } from 'react'
import type { User } from 'firebase/auth'
import type { Act, QuestNode, RunState } from '../game/questline'
import type { CommanderState } from '../game/commander'
import type { AchievementDef } from '../game/achievements'
import type { QuestChainDef } from '../game/quests'
import type { ChronicleChapterDef } from '../game/chronicle'
import type { WeeklyRewardResult } from '../game/weeklyChallenge'
import type { RewardDef } from '../game/dailyLogin'
import type { GiftDef } from '../game/gifts'
import type { SyncPrompt } from '../hooks/useCloudSync'
import type { Screen } from './screens'

/** Relic spin overlay payload — the spin screen owns its own continue action. */
export interface RelicSpinData {
  relicName:   string
  relicIcon:   string
  breaks:      boolean
  brokenName?: string
  brokenIcon?: string
  brokenDesc?: string
  onContinue:  () => void
}

export interface StreakBrokenData {
  streak:     number
  bestStreak: number
}

/**
 * Everything the route groups and overlays need from `App`, minus battle state
 * (see BattleContext — `gameState` changes every TICK_MS and would otherwise
 * re-render every screen and overlay on every tick).
 *
 * `App` still owns all of this; the context only removes the need to hand-write
 * a 40-plus-prop interface per route group. Grown a phase at a time as each
 * route group is extracted (#316) — add a field here when a consumer needs it,
 * not speculatively.
 */
export interface AppContextValue {
  // ── Navigation ────────────────────────────────────────────────────────────
  screen:          Screen
  setScreen:       Dispatch<SetStateAction<Screen>>
  returnScreen:    Screen
  setReturnScreen: Dispatch<SetStateAction<Screen>>

  // ── Player / account ──────────────────────────────────────────────────────
  user:        User | null
  authLoading: boolean
  isAdmin:     boolean
  crystals:    number
  setCrystals: Dispatch<SetStateAction<number>>
  handicap:    number
  setHandicap: Dispatch<SetStateAction<number>>
  commander:   CommanderState | null

  // ── Campaign run ──────────────────────────────────────────────────────────
  run:     RunState | null
  setRun:  Dispatch<SetStateAction<RunState | null>>
  actData: Act | null
  fatiguedCards: string[]

  // ── Overlays ──────────────────────────────────────────────────────────────
  pendingEventCard:    string | null
  setPendingEventCard: Dispatch<SetStateAction<string | null>>
  deckWarningNode:     QuestNode | null
  setDeckWarningNode:  Dispatch<SetStateAction<QuestNode | null>>
  skipDeckWarningRef:  MutableRefObject<boolean>
  campaignRestingAlert:    boolean
  setCampaignRestingAlert: Dispatch<SetStateAction<boolean>>
  campaign2AbandonConfirm:    boolean
  setCampaign2AbandonConfirm: Dispatch<SetStateAction<boolean>>
  relicSpinData: RelicSpinData | null
  integrityWarning:     boolean
  setIntegrityWarning:  Dispatch<SetStateAction<boolean>>
  achievementToasts:    AchievementDef[]
  setAchievementToasts: Dispatch<SetStateAction<AchievementDef[]>>
  syncPrompt:      SyncPrompt | null
  clearSyncPrompt: () => void
  flushPlaytimeToStorage: () => void
  pendingGifts:    GiftDef[]
  setPendingGifts: Dispatch<SetStateAction<GiftDef[]>>
  showWinCelebration:    boolean
  setShowWinCelebration: Dispatch<SetStateAction<boolean>>
  celebrationMilestone:  number
  streakBrokenData:    StreakBrokenData | null
  setStreakBrokenData: Dispatch<SetStateAction<StreakBrokenData | null>>
  timeCapsuleVisible:    boolean
  setTimeCapsuleVisible: Dispatch<SetStateAction<boolean>>
  pendingBattleFn:        (() => void) | null
  setPendingBattleFn:     Dispatch<SetStateAction<(() => void) | null>>
  pendingBattleIsCampaign: boolean
  exoticDrop:      string | null
  setExoticDrop:   Dispatch<SetStateAction<string | null>>
  questCompletes:      QuestChainDef[]
  setQuestCompletes:   Dispatch<SetStateAction<QuestChainDef[]>>
  chronicleCompletes:    ChronicleChapterDef[]
  setChronicleCompletes: Dispatch<SetStateAction<ChronicleChapterDef[]>>
  weeklyReward:    WeeklyRewardResult | null
  setWeeklyReward: Dispatch<SetStateAction<WeeklyRewardResult | null>>
  dailyReward:     RewardDef | null
  setDailyReward:  Dispatch<SetStateAction<RewardDef | null>>

  // ── Service-worker update prompt ──────────────────────────────────────────
  needRefresh:         boolean
  updateDismissed:     boolean
  setUpdateDismissed:  Dispatch<SetStateAction<boolean>>
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>

  // ── Campaign flow handlers reached from overlays ──────────────────────────
  handleSelectNode: (node: QuestNode) => void
  launchCampaign:   (startActId: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ value, children }: { value: AppContextValue; children: ReactNode }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp() called outside <AppProvider> — route groups must render inside App')
  return ctx
}
