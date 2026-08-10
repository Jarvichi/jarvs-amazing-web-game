import { createContext, useContext, type Dispatch, type MutableRefObject, type ReactNode, type SetStateAction } from 'react'
import type { User } from 'firebase/auth'
import type { Act, QuestNode, RunState } from '../game/questline'
import type { Card } from '../game/types'
import type { QuickBattleMode } from '../components/screens/QuickBattleScreen'
import type { CommanderState } from '../game/commander'
import type { AchievementDef } from '../game/achievements'
import type { QuestChainDef } from '../game/quests'
import type { ChronicleChapterDef } from '../game/chronicle'
import type { WeeklyRewardResult } from '../game/weeklyChallenge'
import type { RewardDef } from '../game/dailyLogin'
import type { GiftDef } from '../game/gifts'
import type { SyncPrompt } from '../hooks/useCloudSync'
import type { HubWorldData } from '../data/hub/hubWorldFactory'
import type { WorldNodeDef } from '../data/world/worldMapDef'
import type { Screen, SubScreen } from './screens'

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

  // ── Entry screens (intro / title / settings) ──────────────────────────────
  newsUnreadCount:        number
  feedbackOpen:           boolean
  showTitleLoginModal:    boolean
  handleDailyChallenge:      () => void
  handleWeeklyChallenge:     () => void
  handleEndlessLeaderboard:  () => void
  handlePlay:                (mode: QuickBattleMode) => void
  handleDraftComplete:       (pickedCardNames: string[]) => void
  handleStartDailyChallenge: () => void
  handleStartWeeklyChallenge: () => void
  handleStartTraining:       (enemyUnitName: string, playerCards: Card[]) => void
  handleResetGame:           () => void
  checkForUpdates:           () => Promise<void>

  // ── Hub world ─────────────────────────────────────────────────────────────
  hubData:               HubWorldData | null
  currentLocationKey:    string
  worldMapKey:           number
  restrictedTownNodeIds: Set<string>
  miniGamesEntry:        'menu' | 'citybuilder'
  setMiniGamesEntry:     Dispatch<SetStateAction<'menu' | 'citybuilder'>>
  hubMiniGameEntry:      SubScreen
  setHubMiniGameEntry:   Dispatch<SetStateAction<SubScreen>>
  setShopBuildingId:     Dispatch<SetStateAction<string | undefined>>
  setShopTappedNpc:      Dispatch<SetStateAction<{ name: string; dialogue?: string[]; sprite?: string } | undefined>>
  setShowTitleLoginModal: Dispatch<SetStateAction<boolean>>
  setFeedbackOpen:       Dispatch<SetStateAction<boolean>>
  setActiveNarratorLog:  Dispatch<SetStateAction<string | null>>
  goToWorldLocation:     (id: string) => void
  handleWorldBattle:     (worldNode: WorldNodeDef) => void
  handleCampaign:        () => void
  handleCampaign2:       () => void
  handleEndless:         () => void

  // ── Collection / shop ─────────────────────────────────────────────────────
  setCommander:    Dispatch<SetStateAction<CommanderState | null>>
  packs:           string[][]
  shopBuildingId:  string | undefined
  shopTappedNpc:   { name: string; dialogue?: string[]; sprite?: string } | undefined
  handleCrystalsChanged: (n: number) => void
  handleBuyCrystalPack:  (qty?: number, returnScreen?: Screen) => void
  handlePackDone:        () => void

  // ── Admin / news ──────────────────────────────────────────────────────────
  setNewsUnreadCount: Dispatch<SetStateAction<number>>
  previewAsPlayer:    boolean
  setPreviewAsPlayer: Dispatch<SetStateAction<boolean>>

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
