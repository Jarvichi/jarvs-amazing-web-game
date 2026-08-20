import { useState, useCallback, useEffect, useRef, useMemo, useReducer, Suspense } from 'react'
import { ScreenLoadingFallback } from './components/ScreenLoadingFallback'
import { IconSprite } from './components/ui/icons/IconSprite'
import { ToastProvider } from './components/ui/Toast'
import { resolvedNodeOpts, loadHandicap } from './game/campaignHelpers'
import { usePlaytime } from './hooks/usePlaytime'
import { recordScreen } from './utils/crashSentinel'
import { useStartupData } from './hooks/useStartupData'
import { useCloudSync } from './hooks/useCloudSync'
import { useServiceWorkerUpdate } from './hooks/useServiceWorkerUpdate'
import { useTabVisibility } from './hooks/useTabVisibility'
import { useScreenGuards } from './hooks/useScreenGuards'
import { useTownAccess } from './hooks/useTownAccess'
import { useBattleTelemetry } from './hooks/useBattleTelemetry'
import { AppProvider, type AppContextValue } from './app/AppContext'
import { AppOverlays } from './app/AppOverlays'
import { AdminRoutes } from './app/routes/AdminRoutes'
import { CollectionRoutes } from './app/routes/CollectionRoutes'
import { HubRoutes } from './app/routes/HubRoutes'
import { EntryRoutes } from './app/routes/EntryRoutes'
import { BattleRoutes } from './app/routes/BattleRoutes'
import { useShopFlow } from './app/useShopFlow'
import { useBattleControls } from './app/useBattleControls'
import { useQuickBattleFlow } from './app/useQuickBattleFlow'
import { useCampaignFlow } from './app/useCampaignFlow'
import { CampaignRoutes } from './app/routes/CampaignRoutes'
import { BattleProvider, type BattleContextValue } from './app/BattleContext'
import { GameState } from './game/types'
import { newGame } from './game/engine'
import { syncPlayerCommanderToBase } from './game/engine/helpers'
import { battleReducer, INITIAL_BATTLE_STATE, TICK_MS } from './game/battleReducer'
import {
  loadDeck,
  buildDeckCards,
  loadCollection,
  loadCrystals,
  saveCrystals,
  addCardsToCollection,
  incrementTotalWins,
} from './game/collection'
import {
  loadRunRaw,
  saveRun,
  clearRun,
  isActComplete,
  generateEndlessRewardChoices,
  loadAct,
  getCachedAct,
  loadFatigued,
  clearFatigued,
  loadRunCount,
  EventData,
  CutscenePanel,
  QuestNode,
  RunState,
  Act,
  loadPlayerName,
  getModifiersByCount,
  setLastRunFailed,
  loadPlayerArchetype,
} from './game/questline'
import type { MerchantItem } from './components/campaign/MerchantScreen'
import { MemoryFragment, isHubWorldUnlocked, loadHubDefault } from './game/codex'
import type { QuickBattleMode } from './components/screens/QuickBattleScreen'
import { applyTextSettings, loadSkipIntro, load8bitEnabled, apply8bitMode, clearLegacyLightMode } from './components/screens/SettingsScreen'
import { addToInventory, RewardDef } from './game/dailyLogin'
import { GIFT_OWNER_UID } from './game/gifts'
import {
  getDailyChallengeState,
  saveDailyChallengeResult,
  recordDailyWin,
  publishDailyResult,
  publishEndlessResult,
} from './game/dailyChallenge'
import {
  getWeeklyChallengeState,
  saveWeeklyChallengeResult,
  grantWeeklyReward,
  publishWeeklyResult,
  WeeklyRewardResult,
} from './game/weeklyChallenge'
import { getRelicDef, removeEarnedRelic, addBrokenRelic } from './game/relics'
import { recordQuestWin, QuestChainDef } from './game/quests'
import { recordChronicleWin, ChronicleChapterDef } from './game/chronicle'
import { playBattleStart, playVictory, playDefeat, stopBattleMusic } from './game/sound'
import { useMusic } from './hooks/useMusic'
import { getIntegrityViolations, clearIntegrityViolations } from './game/integrity'
import { useRareEvents } from './hooks/useRareEvents'
import { useAchievements } from './hooks/useAchievements'
import { loadBattleState, clearBattleState } from './game/battleState'
import { loadCommander, CommanderState } from './game/commander'

import { setCurrentWorldLocation, getCurrentWorldLocation, markNodeCleared } from './game/world/worldState'
import { incrementAchievementProgress, setAchievementProgress, AchievementDef } from './game/achievements'
import type { SubScreen } from './components/screens/MiniGamesMenu'
import './styles/index.css'
import { publishSecretRareWin, type SecretRarityType } from './game/secretRareNews'
import rollbar, { updateRollbarPerson } from './rollbar'
import { useAuth } from './hooks/useAuth'
import { auth } from './firebase'
import { uploadSave } from './game/cloudSave'
import { getHubWorldData, type HubWorldData } from './data/hub/hubWorldFactory'
import type { Screen } from './app/screens'
import { WIDE_SCREENS } from './app/screens'
import { BROKEN_RELIC_ITEMS } from './app/merchantItems'

// Apply saved display settings on load
applyTextSettings()
apply8bitMode(load8bitEnabled())
clearLegacyLightMode()

// Screen union, stance rules and the visibility threshold live in ./app/screens;
// merchant item construction in ./app/merchantItems (#316).
export default function App() {

  // ── Startup: auto-resume a pending campaign battle on page refresh ──────────
  // If the player refreshed mid-battle, pendingNodeId is still set. We build the
  // game state immediately so they land straight back in the battle.
  //
  // Act data is now lazy-loaded (see questline.ts loadAct), so it is never
  // available synchronously this early at boot — getCachedAct always misses
  // here, so the two branches below that need it (pendingNodeId battle-resume,
  // and the isActComplete check) fall through exactly like they would if the
  // act had failed to load, showing a provisional screen. The resume effect
  // further down finishes the job once the act has actually loaded, correcting
  // the screen/gameState if a resume was warranted. Every other branch here
  // (0-lives, pendingActComplete/pendingRelicSelect, hubworld-default,
  // endless-restore, plain intro/title) needs no act data and is unaffected.
  const [_startup] = useState(() => {
    const savedRun = loadRunRaw()
    // Guard: a run drained to 0 lives is unplayable. Normally hitting 0 lives clears
    // the run via the campaign-failed flow, so a *persisted* 0-life run is a corrupted
    // /zombie state (e.g. from the pre-#1702 bug where losing a non-campaign battle
    // drained campaign lives). Treat it as a failed run — record the failure so the
    // next run gets mercy tiers, clear it, and show the campaign-failed screen —
    // rather than leaving a soft-locked "Continue Run".
    if (savedRun && savedRun.livesRemaining <= 0) {
      rollbar.error('Campaign run loaded at 0 lives — auto-failing', { actId: savedRun.actId })
      setLastRunFailed()
      clearRun()
      return { screen: 'campaignfailed' as Screen, gameState: null as GameState | null, run: null as RunState | null, isCampaign: false }
    }
    if (savedRun?.pendingNodeId) {
      const act  = getCachedAct(savedRun.actId)
      const node = act?.nodes[savedRun.pendingNodeId]
      if (node && (node.type === 'battle' || node.type === 'boss' || node.type === 'elite')) {
        // If a mid-battle save exists, restore it exactly — no fresh start for cheaters
        const startupArch = loadPlayerArchetype()
        const savedBattle = loadBattleState()
        if (savedBattle) {
          incrementAchievementProgress('misc:refresh_cheat')
          if (startupArch) savedBattle.archetypePassive = startupArch
          return { screen: 'playing' as Screen, gameState: savedBattle, run: savedRun, isCampaign: true }
        }
        const collection  = loadCollection()
        const fatigued    = loadFatigued()
        const deckEntries = loadDeck().filter(e => !fatigued.includes(e.cardName))
        const playerCards = buildDeckCards(deckEntries, collection)
        const earnedEntries = (savedRun.earnedCards ?? []).map(n => ({ cardName: n, count: 1 }))
        if (earnedEntries.length > 0) playerCards.push(...buildDeckCards(earnedEntries, collection))
        const mods = act ? getModifiersByCount(act, savedRun.activeModifierCount) : []
        const state = newGame({ playerCards, ...resolvedNodeOpts(node, act, loadRunCount(), mods) })
        state.playerBase = { hp: savedRun.playerHp, maxHp: savedRun.maxHp }
        if (savedRun.activeRelic) getRelicDef(savedRun.activeRelic)?.applyToGame(state)
        syncPlayerCommanderToBase(state)
        if (startupArch) state.archetypePassive = startupArch
        return { screen: 'playing' as Screen, gameState: state as GameState | null, run: savedRun, isCampaign: true }
      }
    }
    // If the player refreshed while on the act-complete screen, restore it directly.
    if (savedRun?.pendingActComplete) {
      return { screen: 'actcomplete' as Screen, gameState: null as GameState | null, run: savedRun, isCampaign: false }
    }
    // If the player exited while on the relic-select screen between acts, restore to
    // actcomplete so they can pick a relic again via the normal Continue flow.
    if (savedRun?.pendingRelicSelect) {
      return { screen: 'actcomplete' as Screen, gameState: null as GameState | null, run: savedRun, isCampaign: false }
    }
    // If the act is complete but pendingActComplete was cleared, also restore to actcomplete.
    const savedAct = savedRun ? getCachedAct(savedRun.actId) : null
    if (savedRun && savedAct && isActComplete(savedAct, savedRun)) {
      return { screen: 'actcomplete' as Screen, gameState: null as GameState | null, run: savedRun, isCampaign: false }
    }
    if (isHubWorldUnlocked() && loadHubDefault() !== 'title' && loadSkipIntro()) return { screen: 'hubworld' as Screen, gameState: null as GameState | null, run: savedRun as RunState | null, isCampaign: false }
    // Restore an in-progress endless run interrupted by a page reload (e.g. SW auto-update)
    const savedEndless = loadBattleState()
    if (savedEndless?.endlessMode && savedEndless.phase?.type !== 'gameOver') {
      const endlessArch = loadPlayerArchetype()
      if (endlessArch) savedEndless.archetypePassive = endlessArch
      return { screen: 'playing' as Screen, gameState: savedEndless, run: null as RunState | null, isCampaign: false }
    }
    return { screen: (loadSkipIntro() ? 'title' : 'intro') as Screen, gameState: null as GameState | null, run: savedRun as RunState | null, isCampaign: false }
  })

  const [screen, setScreen]             = useState<Screen>(_startup.screen)
  // ── PWA update (prompt mode) ──────────────────────────────────────────────────
  const { needRefresh, updateDismissed, setUpdateDismissed, updateServiceWorker, checkForUpdates } =
    useServiceWorkerUpdate(screen)
  const [returnScreen, setReturnScreen]  = useState<Screen>('title')
  const [shopBuildingId, setShopBuildingId] = useState<string | undefined>(undefined)
  const [shopTappedNpc, setShopTappedNpc] = useState<{ name: string; dialogue?: string[]; sprite?: string } | undefined>(undefined)
  // Restore the town the player was last in (persisted in worldState). The saved
  // value is a world-map node id; for town nodes that id equals the hub data's
  // locationRegistry key. Hub data is lazy-loaded (see hubData below), so this
  // can't validate against it synchronously — an effect corrects an invalid
  // saved id back to ravenwatch once hub data has loaded.
  const [currentLocationKey, setCurrentLocationKey] = useState<string>(() => getCurrentWorldLocation() || 'ravenwatch')

  // ── Hub town data (lazy-loaded) ──────────────────────────────────────────────
  // All 13 towns' config/quest data (~1.5MB) is only fetched once the player
  // actually heads toward the hub — never at boot.
  const [hubData, setHubData] = useState<HubWorldData | null>(null)
  useEffect(() => {
    if (hubData) return
    if (screen === 'hubworld' || screen === 'location' || screen === 'worldmap') {
      getHubWorldData().then(setHubData)
    }
  }, [screen, hubData])
  useEffect(() => {
    if (hubData && !hubData.locationRegistry[currentLocationKey]) setCurrentLocationKey('ravenwatch')
  }, [hubData, currentLocationKey])
  const [miniGamesEntry, setMiniGamesEntry] = useState<'menu' | 'citybuilder'>('menu')
  const [hubMiniGameEntry, setHubMiniGameEntry] = useState<SubScreen>('menu')
  const [showTitleLoginModal, setShowTitleLoginModal] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  // ── Battle state (all ephemeral state that exists only during a battle) ──────
  const [battle, dispatch] = useReducer(battleReducer, {
    ...INITIAL_BATTLE_STATE,
    gameState: _startup.gameState,
  })
  const { gameState, summaryStats, speedMultiplier } = battle

  // Initialise battle state and transition to the playing screen in one call so
  // the two state updates are always kept together (React 18 batches them into a
  // single render within the same synchronous handler).
  const startBattle = useCallback((gs: GameState) => {
    const arch = loadPlayerArchetype()
    if (arch) gs.archetypePassive = arch
    dispatch({ type: 'START', gameState: gs })
    setScreen('playing')
    playBattleStart()
  }, [])

  /**
   * Compatibility wrapper so existing code that calls setGameState(x) or
   * setGameState(s => ...) continues to work during the migration.
   * Uses gameStateRef to avoid stale-closure issues with functional updates.
   */
  const setGameState = useCallback(
    (updater: GameState | null | ((s: GameState | null) => GameState | null)) => {
      if (updater === null) {
        dispatch({ type: 'END' })
      } else if (typeof updater === 'function') {
        const next = updater(gameStateRef.current)
        if (next === null) dispatch({ type: 'END' })
        else dispatch({ type: 'SET_GAME_STATE', gameState: next })
      } else {
        dispatch({ type: 'SET_GAME_STATE', gameState: updater })
      }
    },
    [],
  )

  const [handicap, setHandicap]   = useState<number>(loadHandicap)
  const [crystals, setCrystals]   = useState<number>(loadCrystals)
  const [quickPlayRewardClaimed, setQuickPlayRewardClaimed] = useState(false)

  // Campaign run state
  const [run, setRun]                   = useState<RunState | null>(_startup.run)
  const runRef                          = useRef<RunState | null>(_startup.run)
  const [rewardChoices,  setRewardChoices]  = useState<string[]>([])
  const [rewardCrystals, setRewardCrystals] = useState(0)
  const [worldMapKey,    setWorldMapKey]    = useState(0)
  const isCampaignRef       = useRef(_startup.isCampaign)   // true while playing a campaign battle
  const isDailyChallengeRef = useRef(false)                  // true while playing the daily challenge
  const isWeeklyChallengeRef = useRef(false)                 // true while playing the weekly challenge
  const isTrainingModeRef   = useRef(false)                  // true while playing a training battle
  const isDraftModeRef      = useRef(false)                  // true while playing a Card Draft battle
   const quickBattleModeRef = useRef<QuickBattleMode>('easy')                //  Quick Battle Mode
  const worldBattleNodeIdRef = useRef<string | null>(null)
  const isWandererBattleRef  = useRef(false)                 // true while playing a wandering-NPC duel (#2149)

  // ── Current run's act data (lazy-loaded) ────────────────────────────────────
  // Loaded async whenever run.actId changes; actDataFailed distinguishes "still
  // loading" from "genuinely invalid actId" for the data-guard effect below.
  const [actData, setActData]             = useState<Act | null>(() => run ? getCachedAct(run.actId) ?? null : null)
  const [actDataFailed, setActDataFailed] = useState(false)
  const [hasNextAct, setHasNextAct]       = useState(false)

  useEffect(() => {
    if (!run) { setActData(null); setActDataFailed(false); return }
    const cached = getCachedAct(run.actId)
    if (cached) { setActData(cached); setActDataFailed(false); return }
    setActData(null)
    setActDataFailed(false)
    let cancelled = false
    loadAct(run.actId)
      .then(act => { if (!cancelled) { setActData(act); setActDataFailed(false) } })
      .catch(() => { if (!cancelled) { setActData(null); setActDataFailed(true) } })
    return () => { cancelled = true }
  }, [run?.actId])

  // Whether a next act exists after the current one — used by the ActComplete screen.
  useEffect(() => {
    const nextActId = actData?.nextActId
    if (!nextActId) { setHasNextAct(false); return }
    let cancelled = false
    loadAct(nextActId)
      .then(() => { if (!cancelled) setHasNextAct(true) })
      .catch(() => { if (!cancelled) setHasNextAct(false) })
    return () => { cancelled = true }
  }, [actData?.nextActId])

  // ── Startup resume, part 2 ───────────────────────────────────────────────────
  // Finishes what the synchronous _startup initializer above couldn't: the
  // pendingNodeId battle-resume and the isActComplete check both need act data,
  // which is never available synchronously at boot. Runs once on mount; every
  // other startup branch (0-lives, pendingActComplete/pendingRelicSelect,
  // hubworld-default, endless-restore, plain intro/title) needed no act data
  // and was already decided correctly by the synchronous initializer.
  useEffect(() => {
    const savedRun = _startup.run
    if (!savedRun) return
    let cancelled = false
    ;(async () => {
      if (savedRun.pendingNodeId) {
        const act  = await loadAct(savedRun.actId).catch(() => undefined)
        const node = act?.nodes[savedRun.pendingNodeId]
        if (node && (node.type === 'battle' || node.type === 'boss' || node.type === 'elite')) {
          if (cancelled) return
          const startupArch = loadPlayerArchetype()
          const savedBattle = loadBattleState()
          isCampaignRef.current = true
          if (savedBattle) {
            incrementAchievementProgress('misc:refresh_cheat')
            if (startupArch) savedBattle.archetypePassive = startupArch
            dispatch({ type: 'START', gameState: savedBattle })
            setRun(savedRun)
            setScreen('playing')
            return
          }
          const collection  = loadCollection()
          const fatigued    = loadFatigued()
          const deckEntries = loadDeck().filter(e => !fatigued.includes(e.cardName))
          const playerCards = buildDeckCards(deckEntries, collection)
          const earnedEntries = (savedRun.earnedCards ?? []).map(n => ({ cardName: n, count: 1 }))
          if (earnedEntries.length > 0) playerCards.push(...buildDeckCards(earnedEntries, collection))
          const mods = act ? getModifiersByCount(act, savedRun.activeModifierCount) : []
          const state = newGame({ playerCards, ...resolvedNodeOpts(node, act, loadRunCount(), mods) })
          state.playerBase = { hp: savedRun.playerHp, maxHp: savedRun.maxHp }
          if (savedRun.activeRelic) getRelicDef(savedRun.activeRelic)?.applyToGame(state)
          syncPlayerCommanderToBase(state)
          if (startupArch) state.archetypePassive = startupArch
          dispatch({ type: 'START', gameState: state })
          setRun(savedRun)
          setScreen('playing')
          return
        }
        // Act missing or node not a battle node — fall through, exactly like the
        // synchronous initializer's fallthrough when act data was unavailable.
      }
      if (savedRun.pendingActComplete || savedRun.pendingRelicSelect) return // already resolved synchronously
      const act = getCachedAct(savedRun.actId) ?? (await loadAct(savedRun.actId).catch(() => undefined))
      if (cancelled) return
      if (act && isActComplete(act, savedRun)) {
        setRun(savedRun)
        setScreen('actcomplete')
      }
      // hubworld-default / endless-restore / plain intro-title fallback need no
      // act data and were already decided correctly by the sync initializer.
    })()
    return () => { cancelled = true }
    // Intentionally runs once on mount only — _startup is captured from the
    // initial render and never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cutscenes & boss dialogue
  const [cutscenePanels, setCutscenePanels]   = useState<CutscenePanel[]>([])
  const cutsceneDoneRef     = useRef<() => void>(() => {})
  const epilogueDoneRef     = useRef<(() => void) | null>(null)
  const summaryDoneRef      = useRef<() => void>(() => {})
  const relicSelectDoneRef  = useRef<(relicName: string | null) => void>(() => {})
  const cardRestActDoneRef  = useRef<(() => void) | null>(null)           // set during mid-act card rest; null at campaign end
  const brokenRelicRef      = useRef<{ name: string; icon: string } | null>(null)
  const [relicSpinData, setRelicSpinData] = useState<{ relicName: string; relicIcon: string; breaks: boolean; brokenName?: string; brokenIcon?: string; brokenDesc?: string; onContinue: () => void } | null>(null)
  const [bossDialogueNode, setBossDialogueNode] = useState<QuestNode | null>(null)
  const [showBossSplash, setShowBossSplash] = useState(false)
  const prevBossCardActiveRef = useRef(false)
  const [deckWarningNode, setDeckWarningNode] = useState<QuestNode | null>(null)
  const skipDeckWarningRef = useRef(false)

  // Active campaign event
  const [activeEvent, setActiveEvent] = useState<EventData | null>(null)
  // Card revealed after a gainCard event choice
  const [pendingEventCard, setPendingEventCard] = useState<string | null>(null)

  // Active merchant
  const [merchantItems, setMerchantItems] = useState<MerchantItem[]>([])
  const merchantBoughtRef = useRef(0)
  const [mysteryReward, setMysteryReward] = useState<RewardDef | null>(null)
  const [activeMemoryFragment, setActiveMemoryFragment] = useState<{ fragment: MemoryFragment; alreadyFound: boolean; shardBonus: boolean } | null>(null)
  const [activeCharacterEncounter, setActiveCharacterEncounter] = useState<{ nodeId: string; characterId: string } | null>(null)
  const [activeNarratorLog, setActiveNarratorLog] = useState<string | null>(null)
  const [campNode, setCampNode] = useState<QuestNode | null>(null)
  const [campResult, setCampResult] = useState<string | null>(null)
  // Replay briefing state — stored so onBegin can proceed with the correct context
  const replayBriefingRef = useRef<{
    actId: string
    completionCount: number
    lastRunFailed: boolean
    actHasUncollectedFragment: boolean
    proceed: (chosenCount: number) => void
  } | null>(null)
  const [foundItem, setFoundItem] = useState<Omit<import('./game/dailyLogin').UselessItem, 'acquiredDate'> | null>(null)
  const [exoticDrop, setExoticDrop] = useState<string | null>(null)
  const [questCompletes, setQuestCompletes] = useState<QuestChainDef[]>([])
  const [chronicleCompletes, setChronicleCompletes] = useState<ChronicleChapterDef[]>([])
  const [weeklyReward, setWeeklyReward] = useState<WeeklyRewardResult | null>(null)
  const [epiloguePanels, setEpiloguePanels] = useState<CutscenePanel[]>([])

  // Card fatigue
  const [fatiguedCards, setFatiguedCards]       = useState<string[]>(loadFatigued)
  const [cardRestCandidates, setCardRestCandidates] = useState<string[]>([])
  const [cardRestPlayCounts, setCardRestPlayCounts] = useState<Record<string, number>>({})
  const [bonusPackCards, setBonusPackCards]     = useState<string[]>([])
  const [campaignRestingAlert, setCampaignRestingAlert] = useState(false)
  const [campaign2AbandonConfirm, setCampaign2AbandonConfirm] = useState(false)
  const [streakBrokenData, setStreakBrokenData] = useState<{ streak: number; bestStreak: number } | null>(null)
  // Secret 5 — Time Capsule on 100th battle
  const [timeCapsuleVisible, setTimeCapsuleVisible] = useState(false)
  // Secret 10 — 100 Wins Celebration
  const [showWinCelebration, setShowWinCelebration] = useState(false)
  const [celebrationMilestone, setCelebrationMilestone] = useState(100)

  // Deck selector modal (shown before quick battle / endless when Deck B has cards)
  const [pendingBattleFn, setPendingBattleFn] = useState<null | (() => void)>(null)
  const [pendingBattleIsCampaign, setPendingBattleIsCampaign] = useState(false)
  const campaignPlayCountsRef = useRef<Record<string, number>>({})  // per-battle play tracking
  const gameStateRef = useRef<GameState | null>(null)  // always-current snapshot for callbacks
  const screenRef = useRef<Screen>(screen)  // always-current snapshot for the visibility handler below
  const currentLocationKeyRef = useRef<string>(currentLocationKey)

  // Unit death tracking
  const prevPlayerUnitsRef   = useRef<Map<string, string>>(new Map())
  const prevOpponentUnitsRef = useRef<Map<string, string>>(new Map())
  // Commander HP tracking (null = not yet sampled this battle)
  // Opponent spell-cast key tracking, so the speed-drop below fires once per cast

  // Achievement toast notifications
  const { achievementToasts, setAchievementToasts } = useAchievements()

  // Integrity warning (set on mount if tampered data is detected)
  const [integrityWarning, setIntegrityWarning] = useState(() => {
    const v = getIntegrityViolations()
    if (v.length > 0) { clearIntegrityViolations(); return true }
    return false
  })

  // Firebase auth
  const { user, authLoading } = useAuth()
  const isAdmin = user?.uid === GIFT_OWNER_UID

  // Admin-controlled hub-world town access, and the derived fogged-node set.
  const { enabledTownIds, previewAsPlayer, setPreviewAsPlayer, bypassTownAccess, restrictedTownNodeIds } =
    useTownAccess(isAdmin)

  // Per-battle misc achievement flags
  const battleFlawlessRef    = useRef(true)
  const battleUsedStructure  = useRef(false)
  const battleUsedMobileUnit = useRef(false)
  const battleAllLegendaryRef = useRef(false)  // true if every card in the starting deck is legendary

  // Commander (virtual pet)
  const [commander, setCommander] = useState<CommanderState | null>(loadCommander)

  const { dailyReward, setDailyReward, pendingGifts, setPendingGifts, newsUnreadCount, setNewsUnreadCount } = useStartupData()

  const [isUserPaused, setIsUserPaused] = useState(false)
  // Reset the user-pause flag whenever we leave the battle screen so it doesn't
  // linger into the next game (e.g. pause → Give Up → start new battle).
  useEffect(() => {
    if (screen !== 'playing') setIsUserPaused(false)
  }, [screen])
  // Reset returnScreen when the user lands on title so stale hub-origin doesn't
  // affect screens reached later via the title screen's own navigation.
  useEffect(() => {
    if (screen === 'title') setReturnScreen('title')
  }, [screen])
  // When hub is unlocked and set as default, redirect title→hub automatically.
  // saveHubDefault('title') must be called before setScreen('title') to bypass this.
  useEffect(() => {
    if (screen === 'title' && isHubWorldUnlocked() && loadHubDefault() !== 'title') {
      setScreen('hubworld')
    }
  }, [screen])
  const { activeRareEvent, isGamePaused: isRareEventPaused, rollRareEvent, handleRareEventDone } = useRareEvents({
    gameState, screen, setGameState, setCrystals, setAchievementToasts,
  })
  const isGamePaused = isRareEventPaused || isUserPaused

  // Keep gameStateRef in sync so callbacks can read current state without stale closures
  gameStateRef.current = gameState
  runRef.current = run
  screenRef.current = screen
  currentLocationKeyRef.current = currentLocationKey

  // ── Crash sentinel: record screen transitions so unclean exits (iOS page
  // kills) report where the player was when the page died ──
  useEffect(() => {
    recordScreen(screen, currentLocationKey)
  }, [screen, currentLocationKey])

  // ── Page visibility: pause game loop when tab is hidden ──
  const isTabHidden = useTabVisibility({ screenRef, currentLocationKeyRef })

  // ── Playtime tracking ─────────────────────────────────────────────────────
  const { flushPlaytimeToStorage } = usePlaytime({ screen, isTabHidden, setAchievementToasts })

  // ── Game loop ────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'playing' || !gameState) return
    if (gameState.phase.type === 'gameOver') return
    if (gameState.phase.type === 'celebration') return
    if (gameState.phase.type === 'fingerSmash') return
    if (gameState.phase.type === 'waveReward') return
    if (isGamePaused) return
    if (isTabHidden) return
    const id = setInterval(() => {
      dispatch({ type: 'TICK' })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [screen, gameState?.phase.type, isGamePaused, isTabHidden])

  // Clear the saved battle state as soon as the battle ends, then sync to cloud.
  useEffect(() => {
    if (gameState?.phase.type !== 'gameOver') return
    clearBattleState()
    const uid = auth.currentUser?.uid
    if (uid && !auth.currentUser?.isAnonymous) {
      flushPlaytimeToStorage()
      uploadSave(uid).catch(() => { /* silent — non-critical */ })
    }
  }, [gameState?.phase.type, flushPlaytimeToStorage])

  // Keep Rollbar person context up to date with the player's current act/run.
  useEffect(() => {
    if (run) updateRollbarPerson({ actId: run.actId, runCount: loadRunCount() })
  }, [run?.actId])

  const { syncPrompt, clearSyncPrompt } = useCloudSync({ user, screen, flushPlaytimeToStorage })

  useScreenGuards({
    screen, setScreen, run, setRun, actDataFailed,
    cutscenePanels, epiloguePanels, bossDialogueNode, activeEvent,
    merchantItems, mysteryReward, foundItem,
  })

  // Show boss fight splash when phase 2 triggers.
  useEffect(() => {
    const active = gameState?.bossCardActive ?? false
    if (active && !prevBossCardActiveRef.current) {
      setShowBossSplash(true)
      setTimeout(() => setShowBossSplash(false), 2500)
      dispatch({ type: 'SHOW_BOSS_SHOCKWAVE' })
    }
    prevBossCardActiveRef.current = active
  }, [gameState?.bossCardActive])

  // On sudden death: force Attack stance and reset speed to x1 (speed button stays enabled).
  useEffect(() => {
    if (gameState?.suddenDeath) {
      dispatch({ type: 'SET_STANCE', stance: 'attack' })
      dispatch({ type: 'SET_SPEED', multiplier: 1 })
    }
  }, [gameState?.suddenDeath])

  // Save daily challenge result the moment the battle ends
  useEffect(() => {
    if (isDailyChallengeRef.current && gameState?.phase.type === 'gameOver') {
      const won        = gameState.phase.winner === 'player'
      const prevState  = getDailyChallengeState()
      const firstWin   = won && prevState.won !== true
      // Snapshot the final display state before saving so GameOver always shows
      // the correct attempt count regardless of subsequent re-renders.
      dispatch({ type: 'SET_DC_GAME_OVER', state: { date: prevState.date, won, attempts: prevState.attempts + 1 } })
      saveDailyChallengeResult(won)

      if (firstWin) {
        const toasts: AchievementDef[] = []
        toasts.push(...incrementAchievementProgress('daily:wins'))
        if (prevState.attempts === 0) toasts.push(...incrementAchievementProgress('daily:first_try'))
        const streak = recordDailyWin()
        toasts.push(...setAchievementProgress('daily:win_streak', streak))
        if (toasts.length > 0) setAchievementToasts(prev => [...prev, ...toasts])

        // Publish to Firestore leaderboard (attempts after save = prevState.attempts + 1)
        const uid = auth.currentUser?.uid
        if (uid && navigator.onLine) {
          const playerId = localStorage.getItem('jarv_player_id') ?? uid
          publishDailyResult({
            uid,
            playerId,
            characterName: loadPlayerName(),
            attempts: prevState.attempts + 1,
          }).catch(() => { /* non-critical */ })
        }
      }
    }
  }, [gameState?.phase.type])

  // Save weekly challenge result the moment the battle ends
  useEffect(() => {
    if (isWeeklyChallengeRef.current && gameState?.phase.type === 'gameOver') {
      const won       = gameState.phase.winner === 'player'
      const prevState = getWeeklyChallengeState()
      const firstWin  = won && prevState.won !== true
      saveWeeklyChallengeResult(won)

      if (firstWin) {
        // Grant the Chronicle Fragment (and shard fusion at 3) and show the reward overlay
        setWeeklyReward(grantWeeklyReward())

        // Publish to Firestore leaderboard (attempts after save = prevState.attempts + 1)
        const uid = auth.currentUser?.uid
        if (uid && navigator.onLine) {
          publishWeeklyResult({
            uid,
            characterName: loadPlayerName(),
            attempts: prevState.attempts + 1,
          }).catch(() => { /* non-critical */ })
        }
      }
    }
  }, [gameState?.phase.type])

  // Track endless mode survival achievements and publish to leaderboard when the battle ends
  useEffect(() => {
    if (gameState?.endlessMode && gameState.phase.type === 'gameOver') {
      const toasts: AchievementDef[] = []
      const survivalSec = Math.floor((gameState.endlessSurvivalMs ?? 0) / 1000)
      const wave = gameState.endlessWave ?? 1
      toasts.push(...setAchievementProgress('endless:survival_sec', survivalSec))
      toasts.push(...setAchievementProgress('endless:best_wave', wave))
      if (toasts.length > 0) setAchievementToasts(prev => [...prev, ...toasts])

      const uid = auth.currentUser?.uid
      if (uid && navigator.onLine) {
        publishEndlessResult({
          uid,
          characterName: loadPlayerName(),
          wave,
          survivalMs: gameState.endlessSurvivalMs ?? 0,
        }).catch(() => { /* non-critical */ })
      }
    }
  }, [gameState?.phase.type])

  // Trigger finger smash animation and pre-generate reward choices when an endless wave is cleared
  useEffect(() => {
    if (gameState?.phase.type === 'fingerSmash') {
      const fp = gameState.phase as { type: 'fingerSmash'; wave: number; smashedNames: string[]; rewardDue: boolean }
      dispatch({ type: 'ENTER_FINGER_SMASH', names: fp.smashedNames, wave: fp.wave, rewardDue: fp.rewardDue })
      return
    }
    dispatch({ type: 'DISMISS_FINGER_SMASH' })
    if (gameState?.phase.type === 'waveReward') {
      const phase = gameState.phase as { type: 'waveReward'; wave: number; smashedNames: string[] }
      dispatch({ type: 'SET_WAVE_REWARD_CHOICES', choices: generateEndlessRewardChoices(phase.wave) })
    }
  }, [gameState?.phase.type])

  // Victory celebration: auto-transition to gameOver after 3 seconds
  useEffect(() => {
    if (gameState?.phase.type !== 'celebration') return
    playVictory()
    const t = setTimeout(() => {
      const gs = gameStateRef.current
      if (gs?.phase.type === 'celebration') {
        dispatch({ type: 'SET_GAME_STATE', gameState: { ...gs, phase: { type: 'gameOver', winner: 'player' } } })
      }
    }, 3000)
    return () => clearTimeout(t)
  }, [gameState?.phase.type])

  // Defeat fanfare: play when player loses
  useEffect(() => {
    if (gameState?.phase.type !== 'gameOver') return
    if ((gameState.phase as { type: 'gameOver'; winner: string }).winner !== 'player') playDefeat()
  }, [gameState?.phase.type])

  useMusic(screen, gameState, run, actData)

  // ── Free play ────────────────────────────────────────────

  const {
    handlePlay, handleDraftComplete, handleEndless,
    handleDailyChallenge, handleWeeklyChallenge, handleEndlessLeaderboard,
    handleStartDailyChallenge, handleDailyChallengeRetry, handleStartWeeklyChallenge,
    handleStreakReset, handlePlayAgain, handleStartTraining, handleStartWandererBattle,
  } = useQuickBattleFlow({
    gameState, handicap, setHandicap, setScreen, dispatch, startBattle, rollRareEvent,
    setWorldMapKey, setStreakBrokenData, setPendingBattleFn, setPendingBattleIsCampaign,
    setQuickPlayRewardClaimed,
    isCampaignRef, isDailyChallengeRef, isWeeklyChallengeRef, isTrainingModeRef,
    isDraftModeRef, quickBattleModeRef, worldBattleNodeIdRef, isWandererBattleRef,
    battleFlawlessRef, battleAllLegendaryRef, battleUsedStructure, battleUsedMobileUnit,
    prevPlayerUnitsRef, prevOpponentUnitsRef,
  })

  // ── Campaign ─────────────────────────────────────────────

  const handleMainMenu = useCallback(() => {
    if (worldBattleNodeIdRef.current !== null) {
      const nodeId = worldBattleNodeIdRef.current
      worldBattleNodeIdRef.current = null
      if (gameState?.phase.type === 'gameOver' && gameState.phase.winner === 'player') {
        markNodeCleared(nodeId)
        setCurrentWorldLocation(nodeId)
      }
      clearBattleState()
      dispatch({ type: 'END' })
      setWorldMapKey(k => k + 1)
      setScreen('worldmap')
      return
    }
    const wasInCampaign = isCampaignRef.current
    isCampaignRef.current = false
    isDailyChallengeRef.current = false
    isWeeklyChallengeRef.current = false
    isDraftModeRef.current = false
    isWandererBattleRef.current = false
    const currentRun = run

    const isLoss = gameState?.phase.type === 'gameOver' && gameState.phase.winner !== 'player'
    // Only campaign-battle losses cost a life / record a node failure. Without the
    // wasInCampaign guard, losing a non-campaign battle (weekly/daily challenge,
    // quick battle, endless) while a campaign run exists would wrongly burn a life
    // and fail the node, silently corrupting the saved run.
    if (wasInCampaign && currentRun && isLoss) {
      // Decrement a life and record the node failure
      const nodeId = currentRun.pendingNodeId
      const prevCount = nodeId ? (currentRun.nodeFailCounts[nodeId] ?? 0) : 0
      const newLives = Math.max(0, currentRun.livesRemaining - 1)
      const withFail: RunState = {
        ...currentRun,
        nodeFailCounts: nodeId
          ? { ...currentRun.nodeFailCounts, [nodeId]: prevCount + 1 }
          : currentRun.nodeFailCounts,
        livesRemaining: newLives,
      }
      saveRun(withFail)
      setRun(withFail)

      if (newLives === 0 && wasInCampaign) {
        const crystalReward = 50
        const next = loadCrystals() + crystalReward
        saveCrystals(next)
        setCrystals(next)
        const failUnlocked = incrementAchievementProgress('misc:campaign_failed')
        if (failUnlocked.length > 0) setAchievementToasts(prev => [...prev, ...failUnlocked])
        handleStreakReset()
        setLastRunFailed()
        clearRun()
        setRun(null)
        clearFatigued()
        setFatiguedCards([])
        setBonusPackCards([])
        dispatch({ type: 'END' })
        setScreen('campaignfailed')
        return
      }

      // Clear pendingNodeId so the node is selectable again when the player returns
      if (withFail.pendingNodeId) {
        const cleared = { ...withFail, pendingNodeId: null }
        saveRun(cleared)
        setRun(cleared)
      }
      clearBattleState()
      setScreen(returnScreen === 'hubworld' && isHubWorldUnlocked() ? 'hubworld' : 'title')
      dispatch({ type: 'END' })
      return
    }

    // Clear pendingNodeId so the node is selectable again when the player returns
    // via "Continue Campaign" (covers mid-battle quit from node map).
    if (currentRun?.pendingNodeId) {
      const cleared = { ...currentRun, pendingNodeId: null }
      saveRun(cleared)
      setRun(cleared)
    }
    clearBattleState()
    setScreen(returnScreen === 'hubworld' && isHubWorldUnlocked() ? 'hubworld' : 'title')
    dispatch({ type: 'END' })
  }, [run, gameState, returnScreen])

  const {
    launchCampaign, handleCampaign, handleCampaign2, handleWorldBattle, goToWorldLocation,
    handleWorldBattleRetry, handleSelectNode, handleBossDialogueDone, handleEventChoice,
    handleMerchantBuy, handleMerchantDone, handleMysteryCollect, handleCharacterDone,
    handleMemoryCollect, handleUseConsumable, handleCampaignWin, handleRewardPick,
    handleRewardSkip, handleCampChoice, handleCampContinue, handleActComplete,
    handleCardRestConfirm, handleStarterPackPick, handleCampaignRetry, handleAbandonRun,
  } = useCampaignFlow({
    run, setRun, runRef, actData, gameState, dispatch, setScreen, setCrystals,
    setFatiguedCards, startBattle, rollRareEvent, handleStreakReset, handleMainMenu, hubData,
    enabledTownIds, bypassTownAccess, setCurrentLocationKey, bossDialogueNode,
    setBossDialogueNode, setActiveEvent, merchantItems, setMerchantItems, mysteryReward,
    setMysteryReward, activeMemoryFragment, setActiveMemoryFragment,
    activeCharacterEncounter, setActiveCharacterEncounter, campNode, setCampNode,
    setCampResult, setFoundItem, setCutscenePanels, setEpiloguePanels, setRewardChoices,
    setRewardCrystals, setCardRestCandidates, setCardRestPlayCounts, setBonusPackCards,
    setRelicSpinData, setDeckWarningNode, setCampaignRestingAlert,
    setCampaign2AbandonConfirm, setPendingEventCard, setPendingBattleFn,
    setPendingBattleIsCampaign, setExoticDrop, setAchievementToasts, setQuestCompletes,
    cutsceneDoneRef, epilogueDoneRef, relicSelectDoneRef, cardRestActDoneRef, brokenRelicRef,
    merchantBoughtRef, skipDeckWarningRef, replayBriefingRef, isCampaignRef,
    isDailyChallengeRef, isWeeklyChallengeRef, worldBattleNodeIdRef, battleFlawlessRef,
    battleAllLegendaryRef, battleUsedStructure, battleUsedMobileUnit, campaignPlayCountsRef,
    prevPlayerUnitsRef, prevOpponentUnitsRef,
  })

  const handleGiveUp = useCallback(() => {
    if (isTrainingModeRef.current) {
      isTrainingModeRef.current = false
      dispatch({ type: 'END' })
      setScreen('training')
      return
    }
    if (worldBattleNodeIdRef.current !== null) {
      worldBattleNodeIdRef.current = null
      clearBattleState()
      dispatch({ type: 'END' })
      setScreen('worldmap')
      return
    }
    if (isCampaignRef.current) {
      isCampaignRef.current = false
      const currentRun = runRef.current
      dispatch({ type: 'END' })
      if (!currentRun) {
        setScreen('title')
        return
      }
      // Treat give-up as a loss: decrement a life and record the node failure
      const nodeId = currentRun.pendingNodeId
      const prevCount = nodeId ? (currentRun.nodeFailCounts[nodeId] ?? 0) : 0
      const newLives = Math.max(0, currentRun.livesRemaining - 1)
      const withFail: RunState = {
        ...currentRun,
        nodeFailCounts: nodeId
          ? { ...currentRun.nodeFailCounts, [nodeId]: prevCount + 1 }
          : currentRun.nodeFailCounts,
        livesRemaining: newLives,
      }
      saveRun(withFail)
      setRun(withFail)
      if (newLives === 0) {
        stopBattleMusic()
        const next = loadCrystals() + 50
        saveCrystals(next)
        setCrystals(next)
        const failUnlocked = incrementAchievementProgress('misc:campaign_failed')
        if (failUnlocked.length > 0) setAchievementToasts(prev => [...prev, ...failUnlocked])
        handleStreakReset()
        setLastRunFailed()
        clearRun()
        setRun(null)
        clearFatigued()
        setFatiguedCards([])
        setBonusPackCards([])
        setScreen('campaignfailed')
      } else {
        // Clear pendingNodeId so the node is selectable again on the node map
        if (withFail.pendingNodeId) {
          const cleared = { ...withFail, pendingNodeId: null }
          saveRun(cleared)
          setRun(cleared)
        }
        setScreen('title')
      }
      return
    } else {
      // Exiting endless mode mid-run counts as a defeat: log achievements and publish result
      const gs = gameStateRef.current
      if (gs?.endlessMode && gs.phase.type !== 'gameOver') {
        const survivalSec = Math.floor((gs.endlessSurvivalMs ?? 0) / 1000)
        const wave = gs.endlessWave ?? 1
        const toasts: AchievementDef[] = []
        toasts.push(...setAchievementProgress('endless:survival_sec', survivalSec))
        toasts.push(...setAchievementProgress('endless:best_wave', wave))
        if (toasts.length > 0) setAchievementToasts(prev => [...prev, ...toasts])

        const uid = auth.currentUser?.uid
        if (uid && navigator.onLine) {
          publishEndlessResult({
            uid,
            characterName: loadPlayerName(),
            wave,
            survivalMs: gs.endlessSurvivalMs ?? 0,
          }).catch(() => { /* non-critical */ })
        }
      }
      if (isDailyChallengeRef.current) {
        saveDailyChallengeResult(false)
      }
      if (isWeeklyChallengeRef.current) {
        saveWeeklyChallengeResult(false)
      }
      isDailyChallengeRef.current = false
      isWeeklyChallengeRef.current = false
      clearBattleState()
      dispatch({ type: 'END' })
      setScreen('title')
    }
  }, [handleAbandonRun, setAchievementToasts])

  // Per-tick battle observation: deaths, kill achievements, flawless flag,
  // auto-slowdown rules, and the two late-night/battle-count secrets.
  useBattleTelemetry({
    gameState, screen, speedMultiplier, dispatch, gameStateRef,
    prevPlayerUnitsRef, prevOpponentUnitsRef, battleFlawlessRef,
    setAchievementToasts, setQuestCompletes, setTimeCapsuleVisible,
  })

  // Track misc achievements at battle end
  useEffect(() => {
    if (!gameState || gameState.phase.type !== 'gameOver') return
    // Training mode: no achievements, rewards, or crystal grants
    if (isTrainingModeRef.current) return
    if (gameState.phase.winner !== 'player') {
      // Reset per-battle flags on next game start (done via handlePlay / handlePlayAgain)
      return
    }
    const toasts: AchievementDef[] = []
    // Quick battle win
    if (!isCampaignRef.current) {
      toasts.push(...incrementAchievementProgress('misc:quick_win'))
      toasts.push(...incrementAchievementProgress(`qb:win:${quickBattleModeRef.current}`))
    }
    // Flawless
    if (battleFlawlessRef.current) {
      toasts.push(...incrementAchievementProgress('misc:flawless_win'))
    }
    // Underdog (1 HP)
    if (gameState.playerBase.hp <= 1) {
      toasts.push(...incrementAchievementProgress('misc:underdog_win'))
    }
    // No structure used
    if (!battleUsedStructure.current) {
      toasts.push(...incrementAchievementProgress('misc:no_structure_win'))
    }
    // Pacifist (no mobile unit used)
    if (!battleUsedMobileUnit.current) {
      toasts.push(...incrementAchievementProgress('misc:pacifist_win'))
    }
    // Sudden death win
    if (gameState.suddenDeath) {
      toasts.push(...incrementAchievementProgress('misc:sudden_death_win'))
    }
    // All-legendary deck win
    if (battleAllLegendaryRef.current) {
      toasts.push(...incrementAchievementProgress('misc:all_legendary_win'))
    }
    // One-card win (total cards played across the whole battle = 1)
    const totalPlayed = Object.values(gameState.battleStats?.cardsPlayed ?? {}).reduce((a, b) => a + b, 0)
    if (totalPlayed === 1) {
      toasts.push(...incrementAchievementProgress('misc:one_card_win'))
    }
    if (toasts.length > 0) setAchievementToasts(prev => [...prev, ...toasts])

    // Exotic quest chains: win-battle steps (any mode except training)
    const questDone = recordQuestWin()
    if (questDone.length > 0) setQuestCompletes(prev => [...prev, ...questDone])

    // Fracture Chronicle: chapter challenge progress (any mode except training)
    const chronicleDone = recordChronicleWin(Object.keys(gameState.battleStats?.cardsPlayed ?? {}))
    if (chronicleDone.length > 0) {
      setChronicleCompletes(prev => [...prev, ...chronicleDone])
      setCrystals(loadCrystals())  // chapter rewards may grant crystals
    }

    // Secret 10 — Wins Celebration: fires at every 100-win milestone, scales with tier
    const totalWins = incrementTotalWins()
    if (totalWins > 0 && totalWins % 100 === 0) {
      setCelebrationMilestone(totalWins)
      setShowWinCelebration(true)
    }
    
  }, [gameState?.phase.type])

  // Track secret-rarity achievements at any battle end (win or loss)
  useEffect(() => {
    if (!gameState || gameState.phase.type !== 'gameOver') return
    if (isTrainingModeRef.current) return

    const toasts: AchievementDef[] = []

    // Secret rare cards drawn this game
    const obtained = gameState.secretRaresObtained ?? []
    if (obtained.length > 0) {
      // Drawing a secret-rare card only conjures it into the battle hand — grant it
      // into the permanent collection too, or the news feed announces a card the
      // player can never actually see in their collection.
      addCardsToCollection(obtained.map(cardName => ({ cardName, count: 1 })))

      const TYPES_KEY = 'jarv_secret_types_seen'
      let seenTypes: Set<string>
      try {
        const raw = localStorage.getItem(TYPES_KEY)
        seenTypes = raw ? new Set(JSON.parse(raw) as string[]) : new Set()
      } catch { seenTypes = new Set() }

      const playerName = loadPlayerName() || 'A player'
      for (const cardName of obtained) {
        toasts.push(...incrementAchievementProgress('secret:any'))
        let rarityType: SecretRarityType = 'mythic'
        if (cardName.startsWith('Shiny ')) {
          toasts.push(...incrementAchievementProgress('secret:shiny'))
          seenTypes.add('shiny')
          rarityType = 'shiny'
        } else if (cardName.startsWith('Holo ')) {
          toasts.push(...incrementAchievementProgress('secret:holofoil'))
          seenTypes.add('holofoil')
          rarityType = 'holofoil'
        } else if (cardName.startsWith('Glass ')) {
          toasts.push(...incrementAchievementProgress('secret:glass'))
          seenTypes.add('glass')
          rarityType = 'glass'
        } else {
          toasts.push(...incrementAchievementProgress('secret:mythic'))
          seenTypes.add('mythic')
        }
        publishSecretRareWin(playerName, cardName, rarityType)
      }

      try { localStorage.setItem(TYPES_KEY, JSON.stringify([...seenTypes])) } catch { /* ignore */ }
      toasts.push(...setAchievementProgress('secret:types_seen', seenTypes.size))
    }

    // Glass shatter count
    const shatterCount = gameState.glassShatterCount ?? 0
    if (shatterCount > 0) {
      toasts.push(...incrementAchievementProgress('secret:glass_shattered', shatterCount))
    }

    if (toasts.length > 0) setAchievementToasts(prev => [...prev, ...toasts])
  }, [gameState?.phase.type])


  // ── Pack ─────────────────────────────────────────────────


  const {
    handlePlayCard, handlePlayAoeCard, handleSetStance, handleSetSpeed,
    handleWaveRewardPick, handleWaveRewardSkip,
  } = useBattleControls({
    gameStateRef, dispatch,
    isTrainingModeRef, isCampaignRef, campaignPlayCountsRef,
    battleUsedStructure, battleUsedMobileUnit,
    setAchievementToasts, setQuestCompletes,
  })

  const { packs, handleOpenPack, handleBuyCrystalPack, handleCrystalsChanged, handlePackDone } =
    useShopFlow({ setScreen, setCrystals, quickBattleModeRef, setQuickPlayRewardClaimed })


  // ── Game over routing ────────────────────────────────────

  const isCampaign = isCampaignRef.current

  const handleGameOverPrimary = useCallback(() => {
    if (!gameState || gameState.phase.type !== 'gameOver') return

    if (worldBattleNodeIdRef.current !== null) {
      const nodeId = worldBattleNodeIdRef.current
      worldBattleNodeIdRef.current = null
      if (gameState.phase.winner === 'player') markNodeCleared(nodeId)
      clearBattleState()
      dispatch({ type: 'END' })
      setWorldMapKey(k => k + 1)
      setScreen('worldmap')
      return
    }

    if (isCampaignRef.current) {
      if (gameState.phase.winner === 'player') {
        handleCampaignWin()
      } else {
        // lose/draw: show relic spin screen (33% break chance) if relic equipped
        const equippedRelic = run?.activeRelic
        if (equippedRelic) {
          const willBreak = Math.random() < 0.33
          const broken = BROKEN_RELIC_ITEMS[equippedRelic]
          const relicDef = getRelicDef(equippedRelic)
          setRelicSpinData({
            relicName:  relicDef?.name ?? equippedRelic,
            relicIcon:  relicDef?.icon ?? '🛡️',
            breaks:     willBreak,
            brokenName: broken?.name,
            brokenIcon: broken?.icon,
            brokenDesc: broken?.desc,
            onContinue: () => {
              setRelicSpinData(null)
              if (willBreak) {
                removeEarnedRelic(equippedRelic)
                addBrokenRelic(equippedRelic)
                addToInventory({
                  id: `broken-relic-${equippedRelic.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
                  name: broken?.name ?? `Cracked ${equippedRelic}`,
                  icon: broken?.icon ?? '🪨',
                  desc: broken?.desc ?? `A cracked ${equippedRelic} — it held until it didn't.`,
                  lore: '',
                })
              }
              handleCampaignRetry()
            },
          })
        } else {
          handleCampaignRetry()
        }
      }
    } else {
      handlePlayAgain()
    }
  }, [gameState, run, handleCampaignWin, handleCampaignRetry, handlePlayAgain])

  // ─── Reset game ──────────────────────────────────────────
  const handleResetGame = useCallback(() => {
    const KEYS = [
      'jarv_collection', 'jarv_deck', 'jarv_crystals',
      'jarv_run', 'jarv_card_stats', 'jarv_fatigued',
      'jarv_seen_intros', 'jarvs_handicap', 'jarv_run_count', 'jarv_battle_state',
    ]
    KEYS.forEach(k => { try { localStorage.removeItem(k) } catch { /* ignore */ } })
    window.location.reload()
  }, [])

  // ── Render ───────────────────────────────────────────────

  const actTheme = run?.actId

  // Context values for the extracted route groups (#316). Battle state is kept
  // separate so a per-tick gameState change doesn't re-render every screen.
  const appContextValue = useMemo<AppContextValue>(() => ({
    screen, setScreen, returnScreen, setReturnScreen,
    user, authLoading, isAdmin, crystals, setCrystals, handicap, setHandicap, commander,
    run, setRun, actData, fatiguedCards,
    pendingEventCard, setPendingEventCard,
    deckWarningNode, setDeckWarningNode, skipDeckWarningRef,
    campaignRestingAlert, setCampaignRestingAlert,
    campaign2AbandonConfirm, setCampaign2AbandonConfirm,
    relicSpinData,
    integrityWarning, setIntegrityWarning,
    achievementToasts, setAchievementToasts,
    needRefresh, updateDismissed, setUpdateDismissed, updateServiceWorker,
    syncPrompt, clearSyncPrompt, flushPlaytimeToStorage,
    pendingGifts, setPendingGifts,
    showWinCelebration, setShowWinCelebration, celebrationMilestone,
    streakBrokenData, setStreakBrokenData,
    timeCapsuleVisible, setTimeCapsuleVisible,
    pendingBattleFn, setPendingBattleFn, pendingBattleIsCampaign,
    exoticDrop, setExoticDrop,
    questCompletes, setQuestCompletes,
    chronicleCompletes, setChronicleCompletes,
    weeklyReward, setWeeklyReward,
    dailyReward, setDailyReward,
    newsUnreadCount, feedbackOpen, showTitleLoginModal,
    handleDailyChallenge, handleWeeklyChallenge, handleEndlessLeaderboard,
    handlePlay, handleDraftComplete, handleStartDailyChallenge,
    handleStartWeeklyChallenge, handleStartTraining, handleStartWandererBattle, handleResetGame, checkForUpdates,
    hubData, currentLocationKey, worldMapKey, restrictedTownNodeIds,
    miniGamesEntry, setMiniGamesEntry, hubMiniGameEntry, setHubMiniGameEntry,
    setShopBuildingId, setShopTappedNpc, setShowTitleLoginModal, setFeedbackOpen,
    setActiveNarratorLog, goToWorldLocation, handleWorldBattle,
    handleCampaign, handleCampaign2, handleEndless,
    setCommander, packs, shopBuildingId, shopTappedNpc,
    handleCrystalsChanged, handleBuyCrystalPack, handlePackDone,
    setNewsUnreadCount, previewAsPlayer, setPreviewAsPlayer,
    setFatiguedCards, handleUseConsumable, handleMainMenu,
    rewardChoices, rewardCrystals, summaryStats, handleRewardPick, handleRewardSkip,
    handleActComplete, hasNextAct,
    cutscenePanels, cutsceneDoneRef, epiloguePanels, setEpiloguePanels, epilogueDoneRef,
    bossDialogueNode, handleBossDialogueDone,
    activeEvent, handleEventChoice,
    merchantItems, handleMerchantBuy, handleMerchantDone,
    mysteryReward, handleMysteryCollect,
    activeMemoryFragment, setActiveMemoryFragment, handleMemoryCollect,
    activeCharacterEncounter, handleCharacterDone, activeNarratorLog,
    campNode, campResult, handleCampChoice, handleCampContinue,
    foundItem, setFoundItem,
    replayBriefingRef, brokenRelicRef, relicSelectDoneRef,
    cardRestCandidates, cardRestPlayCounts, handleCardRestConfirm,
    handleStarterPackPick, bonusPackCards, setBonusPackCards,
    handleSelectNode, launchCampaign,
  }), [
    screen, returnScreen, user, authLoading, isAdmin, crystals, handicap, commander,
    run, actData, fatiguedCards, pendingEventCard, deckWarningNode,
    campaignRestingAlert, campaign2AbandonConfirm, relicSpinData, integrityWarning,
    achievementToasts, needRefresh, updateDismissed, updateServiceWorker,
    syncPrompt, clearSyncPrompt, flushPlaytimeToStorage, pendingGifts,
    showWinCelebration, celebrationMilestone, streakBrokenData, timeCapsuleVisible,
    pendingBattleFn, pendingBattleIsCampaign, exoticDrop, questCompletes,
    chronicleCompletes, weeklyReward, dailyReward, handleSelectNode, launchCampaign,
    setPendingGifts, setDailyReward, setNewsUnreadCount, previewAsPlayer,
    packs, shopBuildingId, shopTappedNpc, handleCrystalsChanged,
    handleBuyCrystalPack, handlePackDone,
    hubData, currentLocationKey, worldMapKey, restrictedTownNodeIds,
    miniGamesEntry, hubMiniGameEntry, goToWorldLocation, handleWorldBattle,
    handleCampaign, handleCampaign2, handleEndless, setCommander,
    newsUnreadCount, feedbackOpen, showTitleLoginModal, handleDailyChallenge,
    handleWeeklyChallenge, handleEndlessLeaderboard, handlePlay, handleDraftComplete,
    handleStartDailyChallenge, handleStartWeeklyChallenge, handleStartTraining, handleStartWandererBattle,
    handleResetGame, checkForUpdates,
    handleUseConsumable, handleMainMenu, rewardChoices, rewardCrystals, summaryStats,
    handleRewardPick, handleRewardSkip, handleActComplete, hasNextAct,
    cutscenePanels, epiloguePanels, bossDialogueNode, handleBossDialogueDone,
    activeEvent, handleEventChoice, merchantItems, handleMerchantBuy, handleMerchantDone,
    mysteryReward, handleMysteryCollect, activeMemoryFragment, handleMemoryCollect,
    activeCharacterEncounter, handleCharacterDone, activeNarratorLog,
    campNode, campResult, handleCampChoice, handleCampContinue, foundItem,
    cardRestCandidates, cardRestPlayCounts, handleCardRestConfirm,
    handleStarterPackPick, bonusPackCards,
  ])

  const battleContextValue = useMemo<BattleContextValue>(() => ({
    battle, gameState, dispatch,
    showBossSplash, actTheme, isCampaign, quickPlayRewardClaimed,
    activeRareEvent, handleRareEventDone,
    isCampaignRef, worldBattleNodeIdRef, isDailyChallengeRef, isWeeklyChallengeRef, isWandererBattleRef,
    gameStateRef, summaryDoneRef,
    handlePlayCard, handlePlayAoeCard, handleGiveUp, setIsUserPaused,
    handleSetStance, handleSetSpeed, handleWaveRewardPick, handleWaveRewardSkip,
    handleOpenPack, handleCampaignWin, handleCampaignRetry, handleDailyChallengeRetry,
    handlePlayAgain, handleWorldBattleRetry, handleMainMenu, handleAbandonRun,
  }), [
    battle, gameState, showBossSplash, actTheme, isCampaign, quickPlayRewardClaimed,
    activeRareEvent, handleRareEventDone,
    handlePlayCard, handlePlayAoeCard, handleGiveUp, handleSetStance, handleSetSpeed,
    handleWaveRewardPick, handleWaveRewardSkip, handleOpenPack, handleCampaignWin,
    handleCampaignRetry, handleDailyChallengeRetry, handlePlayAgain,
    handleWorldBattleRetry, handleMainMenu, handleAbandonRun,
  ])

  return (
    <ToastProvider>
    <AppProvider value={appContextValue}>
    <BattleProvider value={battleContextValue}>
    <div className={`game-container${WIDE_SCREENS.has(screen) ? ' game-container--wide' : ''}`}>
      <IconSprite />
      <div className="game-title">JARV'S AMAZING WEB GAME</div>

      <Suspense fallback={<ScreenLoadingFallback />}>

      <EntryRoutes />
      <CampaignRoutes />
      <BattleRoutes />
      <HubRoutes />
      <CollectionRoutes />
      <AdminRoutes />
      <AppOverlays />
      </Suspense>
    </div>
    </BattleProvider>
    </AppProvider>
    </ToastProvider>
  )
}
