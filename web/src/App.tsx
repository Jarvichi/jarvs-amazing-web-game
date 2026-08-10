import { useState, useCallback, useEffect, useRef, useMemo, useReducer, Suspense } from 'react'
import { CardRestSelect, CampScreen, EventScreen, MysteryScreen, MemoryFragmentScreen, CharacterEncounterScreen,
  NarratorJournalScreen, CharacterScreen, CutsceneScreen, BossDialogueScreen, Battlefield, GameOver,
  PostBattleReward, ActComplete, RelicSelectScreen, ReplayBriefingScreen,
  StarterPackSelect, FakeCrashEvent, BlackjackEvent, WrongNumberEvent, NarratorEvent, LiarsDiceEvent, GamblerEvent,
  DevBuildEvent, GlitchedCardEvent, ConfusedTouristEvent, BossEpilogueScreen, FingerSmash, BossShockwave, BattleSummary,
  VictoryPanel, CampaignVictoryScreen, ToBeContinuedScreen, CampaignFailedScreen,
  StatUpgradeScreen
} from './app/lazyScreens'
import { ScreenLoadingFallback } from './components/ScreenLoadingFallback'
import { resolvedNodeOpts, loadHandicap, HANDICAP_KEY, buildQuickBattleOpts, loadCurrentDeckInfo, carryHpAfterBattle, applyRestHeal, applyEventHeal } from './game/campaignHelpers'
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
import { BattleProvider, type BattleContextValue } from './app/BattleContext'
import { GameState, Card, Archetype, SECRET_RARITIES } from './game/types'
import { newGame, MAX_HANDICAP } from './game/engine'
import { playCard, playAoeCard } from './game/engine/cards'
import { syncPlayerCommanderToBase } from './game/engine/helpers'
import { makeNodeDeck } from './game/cards'
import { battleReducer, INITIAL_BATTLE_STATE, TICK_MS } from './game/battleReducer'
import {
  loadDeck, saveDeck, buildDeckCards, generatePack,
  loadCollection, loadCrystals, saveCrystals,
  recordCardPlayed, addCardsToCollection,
  getOwnedCount, DECK_MAX, CRYSTAL_PACK_COST, DeckEntry,
  deckTotalCards, STARTER_DECK,
  loadWinStreak, loadBestStreak, incrementWinStreak, resetWinStreak, incrementTotalWins,
  generateSeededPack,
} from './game/collection'
import { getCardCatalog } from './game/cards'
import { applyStatUpgrade } from './game/playerStats'
import {
  loadRun, loadRunRaw, saveRun, clearRun, newRun, LIVES_START, LIVES_MAX,
  getAvailableNodeIds, skipSiblings, isActComplete, getProtectedFragmentNodeIds,
  generateRewardChoices, generateEndlessRewardChoices, MERCHANT_PRICES,
  loadAct, getCachedAct, getCampaignForAct,
  loadFatigued, saveFatigued, clearFatigued, getTopPlayedCards,
  hasSeenIntro, markIntroSeen,
  loadRunCount, incrementRunCount, getAct1Intro,
  loadBattleCount,
  generateEventFromConfig, EventChoice, EventData,
  CutscenePanel, QuestNode, RunState, Act, ReplayModifier,
  getActiveModifiers, loadActCount, incrementActCount,
  recordNodeComplete, loadPlayerName, applyPlayerName,
  useConsumable,
  getModifiersByCount, getModifierMax,
  setLastRunFailed, loadLastRunFailed, clearLastRunFailed,
  ARCHETYPE_STARTER_PACK, loadPlayerArchetype,
} from './game/questline'
import type { CampChoice } from './components/campaign/CampScreen'
import { MerchantScreen, MerchantItem } from './components/campaign/MerchantScreen'
import { MemoryFragment, isFragmentDiscovered, markFragmentDiscovered, isHubWorldUnlocked, unlockHubWorld, areAllCampaignFragmentsDiscovered, loadHubDefault, getDiscoveredFragmentIds } from './game/codex'
import { getConsumables, addConsumable } from './game/itemStore'
import { CharacterChoice, recordCharacterEncounter, getCharacterEncounterChance, resolveCharacterEncounterId } from './game/characters'
import memoryFragmentsData from './data/memoryFragments.json'
import { ItemFoundScreen }    from './components/modals/ItemFoundScreen'
import type { QuickBattleMode } from './components/screens/QuickBattleScreen'
import { NodeMap }            from './components/campaign/NodeMap'
import { applyTextSettings, loadSkipIntro, load8bitEnabled, apply8bitMode, applyLightMode, loadLightMode } from './components/screens/SettingsScreen'
import { addToInventory, computeReward, loadInventory, RewardDef, ALL_ITEMS } from './game/dailyLogin'
import { GIFT_OWNER_UID } from './game/gifts'
import { isTownAccessible } from './game/townAccess'
import { loadDeckSlot } from './game/collection'
import { getDailyPlayerDeck, getDailyOpponentDeck, getDailyChallengeState, getDailyTerrainSeed, saveDailyChallengeResult, recordDailyWin, publishDailyResult, publishEndlessResult, DailyChallengeState } from './game/dailyChallenge'
import { getWeeklyPlayerDeck, getWeeklyOpponentDeck, getWeeklyChallengeState, getWeeklyTerrainSeed, saveWeeklyChallengeResult, grantWeeklyReward, publishWeeklyResult, WeeklyRewardResult } from './game/weeklyChallenge'
import { getRelicDef, addEarnedRelic, removeEarnedRelic, loadEarnedRelics, addBrokenRelic, rollExoticDrop } from './game/relics'
import { recordQuestWin, recordQuestCardPlayed, recordQuestBossDefeat, QuestChainDef } from './game/quests'
import { recordChronicleWin, ChronicleChapterDef } from './game/chronicle'
import bossEpiloguesData from './data/bossEpilogues.json'
import { playCardPlay, playButtonClick, playBattleEvent, playCardFlip, playRestHeal, playBattleStart, playVictory, playDefeat, stopBattleMusic, stopGameOverMusic } from './game/sound'
import { useMusic } from './hooks/useMusic'
import { getIntegrityViolations, clearIntegrityViolations } from './game/integrity'
import { useRareEvents } from './hooks/useRareEvents'
import { useAchievements } from './hooks/useAchievements'
import { isNoDamageMode } from './game/debug'
import { isAdminUser } from './game/admin'
import { saveBattleState, loadBattleState, clearBattleState } from './game/battleState'
import { loadCommander, CommanderState } from './game/commander'

import { WORLD_MAP_NODES, type WorldNodeDef } from './data/world/worldMapDef'
import { setCurrentWorldLocation, getCurrentWorldLocation, markNodeCleared } from './game/world/worldState'
import {
  incrementAchievementProgress, setAchievementProgress, AchievementDef,
} from './game/achievements'
import type { SubScreen } from './components/screens/MiniGamesMenu'
import './styles.css'
import { publishSecretRareWin, type SecretRarityType } from './game/secretRareNews'
import rollbar, { updateRollbarPerson } from './rollbar'
import { useAuth } from './hooks/useAuth'
import { auth } from './firebase'
import { uploadSave } from './game/cloudSave'
import { getHubWorldData, type HubWorldData } from './data/hub/hubWorldFactory'
import type { Screen } from './app/screens'
import { STANCE_RULES_BY_NODE_TYPE } from './app/screens'
import { BROKEN_RELIC_ITEMS, buildMerchantItems } from './app/merchantItems'

// Apply saved display settings on load
applyTextSettings()
apply8bitMode(load8bitEnabled())
applyLightMode(loadLightMode())

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
  const { gameState, showBossShockwave, dcGameOverState, summaryStats, showFingerSmash, fingerSmashNames, waveRewardChoices, speedMultiplier } = battle

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

  const [packs, setPacks]         = useState<string[][]>([])
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

  const launchQuickBattle = useCallback((mode: QuickBattleMode) => {
    isCampaignRef.current = false
    isDailyChallengeRef.current = false
    isWeeklyChallengeRef.current = false
    quickBattleModeRef.current = mode
    battleFlawlessRef.current = true
    battleUsedStructure.current = false
    battleUsedMobileUnit.current = false
    prevOpponentUnitsRef.current = new Map()
    prevPlayerUnitsRef.current = new Map()
    const { opts, playerCards } = buildQuickBattleOpts(mode, handicap)
    battleAllLegendaryRef.current = playerCards.length > 0 && playerCards.every(c => c.rarity === 'legendary')
    startBattle(newGame(opts))
    rollRareEvent()
  }, [handicap])

  const handlePlay = useCallback((mode: QuickBattleMode) => {
    if (loadDeckSlot('b').length > 0) {
      setPendingBattleIsCampaign(false)
      setPendingBattleFn(() => () => launchQuickBattle(mode))
    } else {
      launchQuickBattle(mode)
    }
  }, [launchQuickBattle])

  const handleDraftComplete = useCallback((pickedCardNames: string[]) => {
    isCampaignRef.current = false
    isDailyChallengeRef.current = false
    isWeeklyChallengeRef.current = false
    isDraftModeRef.current = true
    quickBattleModeRef.current = 'draft'
    setQuickPlayRewardClaimed(false)
    battleFlawlessRef.current = true
    battleUsedStructure.current = false
    battleUsedMobileUnit.current = false
    prevOpponentUnitsRef.current = new Map()
    prevPlayerUnitsRef.current = new Map()
    const draftedCards = makeNodeDeck(pickedCardNames.flatMap(name => [name, name, name]))
    const opponentCardPool = getCardCatalog().filter(c => !SECRET_RARITIES.has(c.rarity))
    battleAllLegendaryRef.current = draftedCards.length > 0 && draftedCards.every(c => c.rarity === 'legendary')
    startBattle(newGame({ playerCards: draftedCards, opponentHandicap: handicap, opponentCardPool }))
    rollRareEvent()
  }, [handicap])

  const launchEndless = useCallback(() => {
    clearBattleState()
    isCampaignRef.current = false
    isDailyChallengeRef.current = false
    isWeeklyChallengeRef.current = false
    battleFlawlessRef.current = true
    battleUsedStructure.current = false
    battleUsedMobileUnit.current = false
    prevOpponentUnitsRef.current = new Map()
    prevPlayerUnitsRef.current = new Map()
    const { playerCards, deckBonus } = loadCurrentDeckInfo()
    battleAllLegendaryRef.current = playerCards.length > 0 && playerCards.every(c => c.rarity === 'legendary')
    startBattle(newGame({ playerCards, opponentHandicap: Math.min(MAX_HANDICAP, handicap + deckBonus), endlessMode: true }))
    rollRareEvent()
  }, [handicap])

  const handleEndless = useCallback(() => {
    if (loadDeckSlot('b').length > 0) {
      setPendingBattleIsCampaign(false)
      setPendingBattleFn(() => launchEndless)
    } else {
      launchEndless()
    }
  }, [launchEndless])

  const handleDailyChallenge = useCallback(() => {
    setScreen('dailychallenge')
  }, [])

  const handleEndlessLeaderboard = useCallback(() => {
    setScreen('endlessleaderboard')
  }, [])

  const handleStartDailyChallenge = useCallback(() => {
    isCampaignRef.current       = false
    isDailyChallengeRef.current = true
    isWeeklyChallengeRef.current = false
    battleFlawlessRef.current   = true
    battleUsedStructure.current = false
    battleUsedMobileUnit.current = false

    prevOpponentUnitsRef.current = new Map()
    prevPlayerUnitsRef.current   = new Map()
    const playerCards   = getDailyPlayerDeck()
    const opponentCards = getDailyOpponentDeck()
    battleAllLegendaryRef.current = playerCards.length > 0 && playerCards.every(c => c.rarity === 'legendary')
    // Debatable as to whether the reducer state here should be called "START_DAILY_CHALLENGE" instead of "START"
    startBattle(newGame({
      prebuiltPlayerDeck:   playerCards,
      prebuiltOpponentDeck: opponentCards,
      opponentHandicap: 0,
      quickStart: true,
      isDailyChallenge: true,
      terrainSeed: getDailyTerrainSeed(),
    }))
    rollRareEvent()
  }, [])

  const handleDailyChallengeRetry = useCallback(() => {
    isCampaignRef.current        = false
    isDailyChallengeRef.current  = true
    isWeeklyChallengeRef.current = false
    battleFlawlessRef.current    = true
    battleUsedStructure.current  = false
    battleUsedMobileUnit.current = false

    prevOpponentUnitsRef.current = new Map()
    prevPlayerUnitsRef.current   = new Map()
    const playerCards   = getDailyPlayerDeck()
    const opponentCards = getDailyOpponentDeck()
    battleAllLegendaryRef.current = playerCards.length > 0 && playerCards.every(c => c.rarity === 'legendary')
    // Debatable as to whether the reducer state here should be called "START_DAILY_CHALLENGE" instead of "START"
    startBattle(newGame({
      prebuiltPlayerDeck:   playerCards,
      prebuiltOpponentDeck: opponentCards,
      opponentHandicap: 0,
      quickStart: true,
      isDailyChallenge: true,
      terrainSeed: getDailyTerrainSeed(),
    }))
    rollRareEvent()
  }, [])

  const handleWeeklyChallenge = useCallback(() => {
    setScreen('weeklychallenge')
  }, [])

  // Start and retry are identical: the weekly decks are fixed for the week.
  const handleStartWeeklyChallenge = useCallback(() => {
    isCampaignRef.current        = false
    isDailyChallengeRef.current  = false
    isWeeklyChallengeRef.current = true
    battleFlawlessRef.current    = true
    battleUsedStructure.current  = false
    battleUsedMobileUnit.current = false

    prevOpponentUnitsRef.current = new Map()
    prevPlayerUnitsRef.current   = new Map()
    const playerCards   = getWeeklyPlayerDeck()
    const opponentCards = getWeeklyOpponentDeck()
    battleAllLegendaryRef.current = playerCards.length > 0 && playerCards.every(c => c.rarity === 'legendary')
    startBattle(newGame({
      prebuiltPlayerDeck:   playerCards,
      prebuiltOpponentDeck: opponentCards,
      opponentHandicap: 0,
      quickStart: true,
      isDailyChallenge: true,  // same mana-floor rule: the player can't edit this deck
      terrainSeed: getWeeklyTerrainSeed(),
    }))
    rollRareEvent()
  }, [])

  function handleStreakReset() {
    const current = loadWinStreak()
    if (current > 0) setStreakBrokenData({ streak: current, bestStreak: loadBestStreak() })
    resetWinStreak()
  }

  const handlePlayAgain = useCallback(() => {
    if (!gameState || gameState.phase.type !== 'gameOver') return
    // World battle: mark node cleared and return to world map
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
    // Training mode: send back to training setup screen
    if (isTrainingModeRef.current) {
      isTrainingModeRef.current = false
      dispatch({ type: 'END' })
      setScreen('training')
      return
    }
    // Card Draft: send back to the draft screen for a fresh draft (no persisted deck to replay)
    if (isDraftModeRef.current) {
      isDraftModeRef.current = false
      dispatch({ type: 'END' })
      setScreen('carddraft')
      return
    }
    isCampaignRef.current       = false
    isDailyChallengeRef.current = false
    isWeeklyChallengeRef.current = false
    setQuickPlayRewardClaimed(false)
    battleFlawlessRef.current = true
    battleUsedStructure.current = false
    battleUsedMobileUnit.current = false

    prevOpponentUnitsRef.current = new Map()
    prevPlayerUnitsRef.current = new Map()
    const winner = gameState.phase.winner
    const nextHandicap = winner === 'player'
      ? Math.max(0, handicap - 1)
      : winner === 'opponent'
        ? Math.min(MAX_HANDICAP, handicap + 1)
        : handicap
    try { localStorage.setItem(HANDICAP_KEY, String(nextHandicap)) } catch { /* ignore */ }
    setHandicap(nextHandicap)
    if (gameState.endlessMode) {
      const { playerCards, deckBonus } = loadCurrentDeckInfo()
      battleAllLegendaryRef.current = playerCards.length > 0 && playerCards.every(c => c.rarity === 'legendary')
      startBattle(newGame({ playerCards, opponentHandicap: Math.min(MAX_HANDICAP, nextHandicap + deckBonus), endlessMode: true }))
    } else {
      const { opts, playerCards } = buildQuickBattleOpts(quickBattleModeRef.current, nextHandicap)
      battleAllLegendaryRef.current = playerCards.length > 0 && playerCards.every(c => c.rarity === 'legendary')
      startBattle(newGame(opts))
    }
    rollRareEvent()
  }, [gameState, handicap])

  // ── Training Mode ────────────────────────────────────────

  const handleStartTraining = useCallback((enemyUnitName: string, playerCards: Card[]) => {
    isCampaignRef.current       = false
    isDailyChallengeRef.current = false
    isWeeklyChallengeRef.current = false
    isTrainingModeRef.current   = true
    battleFlawlessRef.current   = false
    battleUsedStructure.current = false
    battleUsedMobileUnit.current = false

    prevOpponentUnitsRef.current = new Map()
    prevPlayerUnitsRef.current   = new Map()
    // Build a 30-card opponent deck of just the chosen unit
    const opponentDeck = makeNodeDeck(Array.from({ length: 30 }, () => enemyUnitName))
    startBattle(newGame({ playerCards, prebuiltOpponentDeck: opponentDeck, opponentHandicap: 0, quickStart: true }))
  }, [])

  // ── Campaign ─────────────────────────────────────────────

  const launchCampaign = useCallback((startActId: string) => {
    const doLaunch = async () => {
    const existing = await loadRun()

    const goToNodemap = () => {
      const fat = loadFatigued()
      if (fat.length > 0 && loadDeck().some(e => fat.includes(e.cardName))) {
        setCampaignRestingAlert(true)
      }
      setScreen('nodemap')
    }

    if (existing) {
      // ── Resume existing run ────────────────────────────────────────────────
      const activeRun = existing
      saveRun(activeRun)  // Persist any stash drain so a page refresh doesn't lose bought consumables
      setRun(activeRun)
      const act = await loadAct(activeRun.actId)

      if (activeRun.pendingNodeId) {
        const node = act.nodes[activeRun.pendingNodeId]
        if (node) {
          if (node.type === 'event' && node.eventConfig) {
            const eventData = generateEventFromConfig(node.id, node.eventConfig)
            if (eventData) { setActiveEvent(eventData); setScreen('event'); return }
          }
          if (node.type === 'merchant') {
            merchantBoughtRef.current = 0; setMerchantItems(buildMerchantItems())
            setScreen('merchant')
            return
          }
          // 10% chance: normal battle node becomes a mystery encounter
          if (node.type === 'battle' && Math.random() < 0.10) {
            setMysteryReward(computeReward(loadInventory()))
            setScreen('mystery')
            return
          }
          // For battle nodes (including boss): go straight to battle
          campaignPlayCountsRef.current = {}
          isCampaignRef.current = true
          battleFlawlessRef.current = true
          battleUsedStructure.current = false
          battleUsedMobileUnit.current = false
      
          prevOpponentUnitsRef.current = new Map()
          prevPlayerUnitsRef.current = new Map()
          const collection  = loadCollection()
          const fatigued    = loadFatigued()
          const deckEntries = loadDeck().filter(e => !fatigued.includes(e.cardName))
          const playerCards = buildDeckCards(deckEntries, collection)
          const earnedEntries = (activeRun.earnedCards ?? []).map(n => ({ cardName: n, count: 1 }))
          if (earnedEntries.length > 0) playerCards.push(...buildDeckCards(earnedEntries, collection))
          battleAllLegendaryRef.current = playerCards.length > 0 && playerCards.every(c => c.rarity === 'legendary')
          const mods = act ? getModifiersByCount(act, activeRun.activeModifierCount) : []
          const state = newGame({ playerCards, ...resolvedNodeOpts(node, act, loadRunCount(), mods) })
          state.playerBase = { hp: activeRun.playerHp, maxHp: activeRun.maxHp }
          if (activeRun.activeRelic) getRelicDef(activeRun.activeRelic)?.applyToGame(state)
          syncPlayerCommanderToBase(state)
          state.stanceRules = STANCE_RULES_BY_NODE_TYPE[node.type]
          startBattle(state)
          rollRareEvent()
          return
        }
        // pendingNodeId points to a non-existent node — clear it and show map
        const repaired = { ...activeRun, pendingNodeId: null }
        saveRun(repaired)
        setRun(repaired)
      }

      if (isActComplete(act, activeRun)) {
        setScreen('actcomplete')
        return
      }
      goToNodemap()
      return
    }

    // ── Fresh run ─────────────────────────────────────────────────────────────
    const actId = startActId
    const act = await loadAct(actId)
    const completionCount = loadActCount(actId)

    const proceedWithModifiers = async (chosenModifierCount: number) => {
      let activeRun = newRun(actId, chosenModifierCount)
      const earned = loadEarnedRelics()
      saveRun(activeRun)
      setRun(activeRun)

      const proceedAfterRelicSelect = async (chosenRelic: string | null) => {
        rollbar.info('proceedAfterRelicSelect: relic chosen', { actId, chosenRelic, earnedCount: earned.length })
        const runWithRelic = { ...activeRun, activeRelic: chosenRelic }
        saveRun(runWithRelic)
        setRun(runWithRelic)
        const runCount = incrementRunCount()
        const introToShow = actId === 'act1'
          ? await getAct1Intro(runCount)
          : (act.intro ?? [])
        markIntroSeen(actId)
        rollbar.info('proceedAfterRelicSelect: showing intro or nodemap', {
          actId,
          panelCount: introToShow.length,
          runCount,
        })
        if (introToShow.length > 0) {
          setCutscenePanels(applyPlayerName(introToShow))
          cutsceneDoneRef.current = () => {
            rollbar.info('cutsceneDone (fresh run): navigating to nodemap', {
              actId,
              runRefActId: runRef.current?.actId,
              hasRun: !!runRef.current,
              hasActData: !!(runRef.current && getCachedAct(runRef.current.actId)),
            })
            setCutscenePanels([])
            goToNodemap()
          }
          setScreen('cutscene')
          return
        }
        goToNodemap()
      }

      if (earned.length > 0) {
        rollbar.info('Fresh run: showing relic select', { actId, earnedCount: earned.length })
        relicSelectDoneRef.current = proceedAfterRelicSelect
        setScreen('relicselect')
        return
      }
      proceedAfterRelicSelect(null)
    }

    // Show replay briefing if the player has completed this act before and it either
    // has modifiers, or still has an uncollected memory fragment (Memory Charm offer).
    const lastRunFailed = loadLastRunFailed()
    const actHasUncollectedFragment = Object.values(act.nodes)
      .some(n => n.type === 'memory' && n.fragmentId && !isFragmentDiscovered(n.fragmentId))
    if (completionCount > 0 && (getModifierMax(act) > 0 || actHasUncollectedFragment)) {
      replayBriefingRef.current = {
        actId,
        completionCount,
        lastRunFailed,
        actHasUncollectedFragment,
        proceed: proceedWithModifiers,
      }
      setScreen('replayBriefing')
      return
    }

    // First-time run (or act has no modifiers): start normally with 0 active modifiers
    proceedWithModifiers(0)
    } // end doLaunch

    if (loadDeckSlot('b').length > 0) {
      setPendingBattleIsCampaign(true)
      setPendingBattleFn(() => doLaunch)
    } else {
      doLaunch()
    }
  }, [])

  const handleCampaign = useCallback(() => {
    launchCampaign('act1')
  }, [launchCampaign])

  // Campaign 2 is launched from Cartographer Elsben in Ironhold Keep. If a
  // campaign-1 run is in progress it must be explicitly abandoned first —
  // both campaigns share the single active-run slot.
  const handleCampaign2 = useCallback(async () => {
    const existing = await loadRun()
    if (existing && getCampaignForAct(existing.actId).id !== 'c2') {
      setCampaign2AbandonConfirm(true)
      return
    }
    launchCampaign('c2act1')
  }, [launchCampaign])

  const handleWorldBattle = useCallback(async (worldNode: WorldNodeDef) => {
    if (!worldNode.battleConfig) return
    const { actId, nodeId } = worldNode.battleConfig
    const act = await loadAct(actId).catch(() => undefined)
    if (!act) return
    const node = act.nodes[nodeId]
    if (!node) return

    worldBattleNodeIdRef.current = worldNode.id
    isCampaignRef.current        = false
    isDailyChallengeRef.current  = false
    isWeeklyChallengeRef.current = false
    battleFlawlessRef.current    = true
    battleUsedStructure.current  = false
    battleUsedMobileUnit.current = false
    prevOpponentUnitsRef.current = new Map()
    prevPlayerUnitsRef.current   = new Map()

    const collection  = loadCollection()
    const deckEntries = loadDeck()
    const playerCards = buildDeckCards(deckEntries, collection)
    battleAllLegendaryRef.current = playerCards.length > 0 && playerCards.every(c => c.rarity === 'legendary')
    const state = newGame({ playerCards, ...resolvedNodeOpts(node, act, loadRunCount(), []) })
    startBattle(state)
    if (isCampaignRef.current) rollRareEvent()
  }, [startBattle, rollRareEvent])

  // Shared by the world-map's node picker and a town's direct-exit tiles
  // (screen === 'town:<mapId>'): jump straight to another town's hub.
  const goToWorldLocation = useCallback((id: string) => {
    if (id === 'ravenwatch') {
      setCurrentWorldLocation(id)
      setCurrentLocationKey('ravenwatch')
      setScreen('hubworld')
    } else if (hubData?.locationRegistry[id]) {
      if (!isTownAccessible(id, enabledTownIds, bypassTownAccess)) return
      setCurrentWorldLocation(id)
      setCurrentLocationKey(id)
      setScreen('location')
    }
  }, [enabledTownIds, bypassTownAccess, hubData])

  // Re-run the current world-map battle after a loss ("Try Again").
  const handleWorldBattleRetry = useCallback(() => {
    const nodeId = worldBattleNodeIdRef.current
    const worldNode = nodeId ? WORLD_MAP_NODES.find(n => n.id === nodeId) : undefined
    if (!worldNode) { handleMainMenu(); return }
    dispatch({ type: 'END' })
    handleWorldBattle(worldNode)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleWorldBattle])

  const handleSelectNode = useCallback((node: QuestNode) => {
    const currentRun = run
    if (!currentRun || !actData) return
    const act = actData

    // Mark siblings as skipped (branch choice) — unless an active Memory Charm
    // is guarding this act's uncollected fragment node(s) from being pruned.
    const protectedNodeIds = getProtectedFragmentNodeIds(act.nodes, currentRun, getDiscoveredFragmentIds())
    const afterSkip = skipSiblings(act.nodes, node.id, currentRun, protectedNodeIds)
    const activeMods = act ? getModifiersByCount(act, currentRun.activeModifierCount) : []
    const bonusCrystals = activeMods.filter(m => m.type === 'crystalBonus').reduce((s, m) => s + m.value, 0)
    const updatedRun: RunState = { ...afterSkip, pendingNodeId: node.id, crystalBonus: bonusCrystals }
    saveRun(updatedRun)
    setRun(updatedRun)

    if (node.characterEncounter && Math.random() < getCharacterEncounterChance(node.characterEncounter)) {
      setActiveCharacterEncounter({ nodeId: node.id, characterId: resolveCharacterEncounterId(node.characterEncounter) })
      setScreen('characterEncounter')
      return
    }

    if (node.type === 'rest') {
      setCampNode(node)
      setScreen('camp')
      return
    }

    if (node.type === 'event' && node.eventConfig) {
      const eventData = generateEventFromConfig(node.id, node.eventConfig)
      if (eventData) {
        setActiveEvent(eventData)
        setScreen('event')
        return
      }
    }

    if (node.type === 'merchant') {
      merchantBoughtRef.current = 0; setMerchantItems(buildMerchantItems())
      setScreen('merchant')
      return
    }

    if (node.type === 'memory' && node.fragmentId) {
      const allFragments = memoryFragmentsData as MemoryFragment[]
      const frag = allFragments.find(f => f.id === node.fragmentId)
      if (frag) {
        const alreadyFound = isFragmentDiscovered(frag.id)
        setActiveMemoryFragment({ fragment: frag, alreadyFound, shardBonus: false })
        setScreen('memory')
        return
      }
    }

    // 10% chance: normal battle node becomes a mystery encounter
    if (node.type === 'battle' && Math.random() < 0.10) {
      setMysteryReward(computeReward(loadInventory()))
      setScreen('mystery')
      return
    }

    // Warn if deck has resting cards or is under the recommended size
    if ((node.type === 'battle' || node.type === 'elite') && !skipDeckWarningRef.current) {
      const allEntries   = loadDeck()
      const fat          = loadFatigued()
      const restingCount = allEntries.filter(e => fat.includes(e.cardName)).length
      const isUnderMax   = deckTotalCards(allEntries) < DECK_MAX
      if (restingCount > 0 || isUnderMax) {
        setDeckWarningNode(node)
        return
      }
    }
    skipDeckWarningRef.current = false

    // Boss intro cutscene (shown before dialogue)
    if (node.bossIntro && node.bossIntro.length > 0) {
      setCutscenePanels(applyPlayerName(node.bossIntro))
      cutsceneDoneRef.current = () => {
        setBossDialogueNode(node)
        setScreen('bossdialogue')
      }
      setScreen('cutscene')
      return
    }

    // Boss pre-battle dialogue
    if (node.bossDialogue && node.bossDialogue.length > 0) {
      setBossDialogueNode(node)
      setScreen('bossdialogue')
      return
    }

    // Start battle
    campaignPlayCountsRef.current = {}
    isCampaignRef.current = true
    battleFlawlessRef.current = true
    battleUsedStructure.current = false
    battleUsedMobileUnit.current = false

    prevOpponentUnitsRef.current = new Map()
    prevPlayerUnitsRef.current = new Map()
    const collection  = loadCollection()
    const fatigued    = loadFatigued()
    const deckEntries = loadDeck().filter(e => !fatigued.includes(e.cardName))
    const playerCards = buildDeckCards(deckEntries, collection)
    // Include cards earned as rewards earlier this run
    const earnedEntries = (updatedRun.earnedCards ?? []).map(n => ({ cardName: n, count: 1 }))
    if (earnedEntries.length > 0) playerCards.push(...buildDeckCards(earnedEntries, collection))
    battleAllLegendaryRef.current = playerCards.length > 0 && playerCards.every(c => c.rarity === 'legendary')
    const mods733 = act ? getModifiersByCount(act, updatedRun.activeModifierCount) : []
    const state = newGame({ playerCards, ...resolvedNodeOpts(node, act, loadRunCount(), mods733) })
    state.playerBase = { hp: updatedRun.playerHp, maxHp: updatedRun.maxHp }
    if (updatedRun.activeRelic) getRelicDef(updatedRun.activeRelic)?.applyToGame(state)
    syncPlayerCommanderToBase(state)
    state.stanceRules = STANCE_RULES_BY_NODE_TYPE[node.type]
    startBattle(state)
    rollRareEvent()
  }, [run, actData])

  const handleBossDialogueDone = useCallback(() => {
    const node = bossDialogueNode
    if (!node || !run) return
    setBossDialogueNode(null)
    // Now actually start the battle
    campaignPlayCountsRef.current = {}
    isCampaignRef.current = true
    battleFlawlessRef.current = true
    battleUsedStructure.current = false
    battleUsedMobileUnit.current = false

    prevOpponentUnitsRef.current = new Map()
    prevPlayerUnitsRef.current = new Map()
    const collection  = loadCollection()
    const fatigued    = loadFatigued()
    const deckEntries = loadDeck().filter(e => !fatigued.includes(e.cardName))
    const playerCards = buildDeckCards(deckEntries, collection)
    const earnedEntries = (run.earnedCards ?? []).map(n => ({ cardName: n, count: 1 }))
    if (earnedEntries.length > 0) playerCards.push(...buildDeckCards(earnedEntries, collection))
    battleAllLegendaryRef.current = playerCards.length > 0 && playerCards.every(c => c.rarity === 'legendary')
    const act = actData ?? undefined
    const mods761 = act ? getModifiersByCount(act, run.activeModifierCount) : []
    const state = newGame({ playerCards, ...resolvedNodeOpts(node, act, loadRunCount(), mods761) })
    state.playerBase = { hp: run.playerHp, maxHp: run.maxHp }
    if (run.activeRelic) getRelicDef(run.activeRelic)?.applyToGame(state)
    syncPlayerCommanderToBase(state)
    state.stanceRules = STANCE_RULES_BY_NODE_TYPE[node.type]
    startBattle(state)
    rollRareEvent()
  }, [bossDialogueNode, run, actData])

  const handleEventChoice = useCallback((choice: EventChoice) => {
    const currentRun = run
    if (!currentRun) return
    const nodeId = currentRun.pendingNodeId!

    let updatedRun: RunState = {
      ...currentRun,
      completedNodeIds: [...currentRun.completedNodeIds, nodeId],
      pendingNodeId: null,
    }

    // Flatten compound effects into a list of single effects
    const effects = choice.effect.type === 'compound'
      ? choice.effect.effects
      : [choice.effect]

    for (const effect of effects) {
      if (effect.type === 'healHp') {
        updatedRun = { ...updatedRun, playerHp: applyEventHeal(updatedRun.playerHp, updatedRun.maxHp, effect.amount) }
      } else if (effect.type === 'damageHp') {
        if (!isNoDamageMode()) {
          updatedRun = { ...updatedRun, playerHp: Math.max(1, updatedRun.playerHp - effect.amount) }
        }
      } else if (effect.type === 'gainCrystals') {
        const next = loadCrystals() + effect.amount
        saveCrystals(next)
        setCrystals(next)
      } else if (effect.type === 'gainCard') {
        const catalog = getCardCatalog()
        const pool = catalog.filter(c => c.rarity === effect.rarity)
        const card = pool[Math.floor(Math.random() * pool.length)]
        if (card) {
          addCardsToCollection([{ cardName: card.name, count: 1 }])
          saveRun(updatedRun)
          setRun(updatedRun)
          setActiveEvent(null)
          setScreen('nodemap')
          setPendingEventCard(card.name)
          playCardFlip()
          return   // show card reveal before going to nodemap
        }
      } else if (effect.type === 'gainItem') {
        const item = effect.itemId
          ? ALL_ITEMS.find(i => i.id === effect.itemId)
          : computeReward(loadInventory(), ALL_ITEMS)
        if (item) {
          recordNodeComplete(updatedRun.actId, nodeId)
          saveRun(updatedRun)
          setRun(updatedRun)
          setActiveEvent(null)
          setFoundItem(item)
          setScreen('itemfound')
          return
        }
      } else if (effect.type === 'gainLife') {
        const newMax   = Math.min(LIVES_MAX, updatedRun.maxLives + effect.amount)
        const newLives = Math.min(newMax, updatedRun.livesRemaining + effect.amount)
        updatedRun = { ...updatedRun, livesRemaining: newLives, maxLives: newMax }
        if (newLives >= LIVES_MAX) {
          const newlyUnlocked = incrementAchievementProgress('misc:nine_lives', 1)
          if (newlyUnlocked.length > 0) setAchievementToasts(prev => [...prev, ...newlyUnlocked])
        }
      }
    }

    recordNodeComplete(updatedRun.actId, nodeId)
    saveRun(updatedRun)
    setRun(updatedRun)
    setActiveEvent(null)
    setScreen('nodemap')
  }, [run])

  const handleMerchantBuy = useCallback((item: MerchantItem) => {
    if (item.kind === 'card') {
      addCardsToCollection([{ cardName: item.card.name, count: 1 }])
    } else if (item.kind === 'consumable') {
      // Add directly to the active run's consumables
      setRun(prev => {
        if (!prev) return prev
        const existing = prev.consumables.find(c => c.id === item.def.id)
        const consumables = existing
          ? prev.consumables.map(c => c.id === item.def.id ? { ...c, count: c.count + 1 } : c)
          : [...prev.consumables, { id: item.def.id, count: 1 }]
        const updated = { ...prev, consumables }
        saveRun(updated)
        return updated
      })
    } else {
      addToInventory(item.inventoryItem)
    }
    const next = loadCrystals() - item.price
    saveCrystals(Math.max(0, next))
    setCrystals(Math.max(0, next))
    merchantBoughtRef.current += 1
  }, [])

  const handleMerchantDone = useCallback(() => {
    const currentRun = run
    if (!currentRun) return
    // Check for sweep achievement (bought every item in the visit)
    if (merchantBoughtRef.current > 0 && merchantBoughtRef.current >= merchantItems.length) {
      const swept = incrementAchievementProgress('misc:merchant_sweep')
      if (swept.length > 0) setAchievementToasts(prev => [...prev, ...swept])
    }
    const nodeId = currentRun.pendingNodeId!
    const updatedRun: RunState = {
      ...currentRun,
      completedNodeIds: [...currentRun.completedNodeIds, nodeId],
      pendingNodeId: null,
    }
    recordNodeComplete(updatedRun.actId, nodeId)
    saveRun(updatedRun)
    setRun(updatedRun)
    setMerchantItems([])
    setScreen('nodemap')
  }, [run, merchantItems.length])

  const handleMysteryCollect = useCallback(() => {
    const currentRun = run
    if (!currentRun || !mysteryReward) { setScreen('nodemap'); return }
    // Apply reward
    if (mysteryReward.type === 'crystals') {
      const next = loadCrystals() + (mysteryReward.amount ?? 0)
      saveCrystals(next)
      setCrystals(next)
    } else if (mysteryReward.type === 'item') {
      addToInventory({ id: mysteryReward.id, name: mysteryReward.name, icon: mysteryReward.icon, desc: mysteryReward.desc ?? '', lore: mysteryReward.lore ?? '' })
    } else if (mysteryReward.type === 'card' || mysteryReward.type === 'pack') {
      addCardsToCollection([{ cardName: mysteryReward.name, count: 1 }])
    }
    // Complete node
    const nodeId = currentRun.pendingNodeId!
    let consumables = currentRun.consumables
    if (mysteryReward.type === 'consumable' && mysteryReward.consumableId) {
      const cid = mysteryReward.consumableId
      const existing = consumables.find(c => c.id === cid)
      consumables = existing
        ? consumables.map(c => c.id === cid ? { ...c, count: c.count + 1 } : c)
        : [...consumables, { id: cid, count: 1 }]
    }
    const updatedRun: RunState = {
      ...currentRun,
      completedNodeIds: [...currentRun.completedNodeIds, nodeId],
      pendingNodeId: null,
      consumables,
    }
    recordNodeComplete(updatedRun.actId, nodeId)
    saveRun(updatedRun)
    setRun(updatedRun)
    setMysteryReward(null)
    // Track mystery encounters for achievements
    const mysteryUnlocked = incrementAchievementProgress('misc:mystery_encounter')
    if (mysteryUnlocked.length > 0) setAchievementToasts(prev => [...prev, ...mysteryUnlocked])
    setScreen('nodemap')
  }, [run, mysteryReward])

  const handleCharacterDone = useCallback((choice?: CharacterChoice) => {
    const currentRun = run
    if (!currentRun || !activeCharacterEncounter) { setScreen('nodemap'); return }
    const act = actData
    if (!act) { setScreen('nodemap'); return }

    recordCharacterEncounter(activeCharacterEncounter.characterId, choice?.label)

    // Apply choice effect (crystals, HP, lives)
    if (choice?.effect) {
      const eff = choice.effect
      if (eff.type === 'gainCrystals' && eff.amount) {
        const next = loadCrystals() + eff.amount
        saveCrystals(next)
        setCrystals(next)
      } else if (eff.type === 'healHp' && eff.amount) {
        const healed = Math.min(currentRun.maxHp, currentRun.playerHp + eff.amount)
        const updated = { ...currentRun, playerHp: healed }
        saveRun(updated)
        setRun(updated)
      } else if (eff.type === 'gainLife' && eff.amount) {
        const newMax   = Math.min(LIVES_MAX, currentRun.maxLives + eff.amount)
        const newLives = Math.min(newMax, currentRun.livesRemaining + eff.amount)
        const updated  = { ...currentRun, livesRemaining: newLives, maxLives: newMax }
        saveRun(updated)
        setRun(updated)
      }
    }

    const node = act.nodes[activeCharacterEncounter.nodeId]
    setActiveCharacterEncounter(null)

    // Continue to normal node resolution
    if (node?.type === 'rest') {
      setCampNode(node)
      setScreen('camp')
    } else if (node?.type === 'event' && node.eventConfig) {
      const eventData = generateEventFromConfig(node.id, node.eventConfig)
      if (eventData) { setActiveEvent(eventData); setScreen('event') }
      else setScreen('nodemap')
    } else {
      setScreen('nodemap')
    }
  }, [run, activeCharacterEncounter, actData])

  const handleMemoryCollect = useCallback(() => {
    const currentRun = run
    if (!currentRun || !activeMemoryFragment) { setScreen('nodemap'); return }
    const { fragment, alreadyFound } = activeMemoryFragment
    let shardBonus = false
    let updatedConsumables = currentRun.consumables
    if (!alreadyFound) {
      shardBonus = markFragmentDiscovered(fragment.id)
      if (areAllCampaignFragmentsDiscovered()) unlockHubWorld()
      // A fresh fragment collected while carrying a Memory Charm spends it —
      // it's only "used up" the moment it actually pays off.
      const charmIdx = updatedConsumables.findIndex(c => c.id === 'memory_charm' && c.count > 0)
      if (charmIdx !== -1) {
        updatedConsumables = updatedConsumables
          .map((c, i) => i === charmIdx ? { ...c, count: c.count - 1 } : c)
          .filter(c => c.count > 0)
      }
      if (shardBonus) {
        const existing = updatedConsumables.find(c => c.id === 'health_potion')
        updatedConsumables = existing
          ? updatedConsumables.map(c => c.id === 'health_potion' ? { ...c, count: c.count + 1 } : c)
          : [...updatedConsumables, { id: 'health_potion', count: 1 }]
      }
    }
    const nodeId = currentRun.pendingNodeId!
    const updatedRun: RunState = {
      ...currentRun,
      completedNodeIds: [...currentRun.completedNodeIds, nodeId],
      pendingNodeId: null,
      consumables: updatedConsumables,
    }
    recordNodeComplete(updatedRun.actId, nodeId)
    saveRun(updatedRun)
    setRun(updatedRun)
    if (shardBonus) {
      setActiveMemoryFragment({ ...activeMemoryFragment, alreadyFound: false, shardBonus: true })
      return
    }
    setActiveMemoryFragment(null)
    setScreen('nodemap')
  }, [run, activeMemoryFragment])

  const handleUseConsumable = useCallback((id: string) => {
    setRun(prev => {
      if (!prev) return prev
      const updated = useConsumable(prev, id)
      if (!updated) return prev
      saveRun(updated)
      return updated
    })
  }, [])

  const handleCampaignWin = useCallback(() => {
    const currentRun = run
    if (!currentRun || !gameState || !actData) return
    const act = actData
    const nodeId = currentRun.pendingNodeId!
    const node = act.nodes[nodeId]

    // Merge this battle's card play counts into the run totals
    const mergedCounts: Record<string, number> = { ...currentRun.cardPlayCounts }
    for (const [name, n] of Object.entries(campaignPlayCountsRef.current)) {
      mergedCounts[name] = (mergedCounts[name] ?? 0) + n
    }
    campaignPlayCountsRef.current = {}

    // Update run HP and counts from battle result (see carryHpAfterBattle for why this
    // isn't a straight copy of gameState.playerBase.hp — that value can include a
    // relic's transient HP bonus, which run.maxHp deliberately excludes).
    const updatedRun: RunState = {
      ...currentRun,
      playerHp: carryHpAfterBattle(currentRun.maxHp, gameState.playerBase),
      completedNodeIds: [...currentRun.completedNodeIds, nodeId],
      pendingNodeId: null,
      cardPlayCounts: mergedCounts,
    }
    recordNodeComplete(updatedRun.actId, nodeId)
    saveRun(updatedRun)
    setRun(updatedRun)

    // Exotic relics drop from bosses and elites at low probability
    if (node.type === 'boss' || node.type === 'elite') {
      const dropped = rollExoticDrop(node.type)
      if (dropped) {
        addEarnedRelic(dropped)
        setExoticDrop(dropped)
      }
    }

    // Exotic quest chains: defeat-boss steps
    if (node.type === 'boss') {
      const questDone = recordQuestBossDefeat(act.id)
      if (questDone.length > 0) setQuestCompletes(prev => [...prev, ...questDone])
    }

    // Check act complete
    if (isActComplete(act, updatedRun)) {
      // Track act completion achievement + per-act replay count
      incrementActCount(currentRun.actId)
      const actUnlocked = incrementAchievementProgress(`campaign:${currentRun.actId}`)
      if (actUnlocked.length > 0) setAchievementToasts(prev => [...prev, ...actUnlocked])

      // Mark run as pending act-complete so a page refresh restores the actcomplete screen
      // rather than wiping the run and sending the player back to the title screen.
      const actCompleteRun = { ...updatedRun, pendingActComplete: true }
      saveRun(actCompleteRun)
      setRun(actCompleteRun)

      rollbar.info('Act complete: transitioning to outro/actcomplete', {
        actId: currentRun.actId,
        hasOutro: (act.outro?.length ?? 0) > 0,
      })
      const showOutroThenComplete = () => {
        if (act.outro && act.outro.length > 0) {
          setCutscenePanels(applyPlayerName(act.outro))
          cutsceneDoneRef.current = () => {
            rollbar.info('cutsceneDone (outro): navigating to actcomplete', { actId: currentRun.actId })
            setCutscenePanels([])
            setScreen('actcomplete')
          }
          setScreen('cutscene')
        } else {
          setScreen('actcomplete')
        }
      }
      // Boss epilogue: a short skippable scene revealing what the boss was
      // protecting, shown between the victory and the act-complete rewards.
      const epilogue = (bossEpiloguesData as Record<string, CutscenePanel[]>)[currentRun.actId]
      if (epilogue && epilogue.length > 0) {
        setEpiloguePanels(applyPlayerName(epilogue))
        epilogueDoneRef.current = showOutroThenComplete
        setScreen('bossEpilogue')
      } else {
        showOutroThenComplete()
      }
      return
    }

    // Grant crystals for winning (+ crystalBonus from replay modifiers)
    const crystalReward = (node.type === 'boss' ? 25 : node.type === 'elite' ? 15 : 10) + (currentRun.crystalBonus ?? 0)
    const newCrystals = loadCrystals() + crystalReward
    saveCrystals(newCrystals)
    setCrystals(newCrystals)

    // Go directly to reward screen with battle stats embedded (single screen)
    dispatch({ type: 'SET_SUMMARY_STATS', stats: gameState.battleStats, gameTime: gameState.gameTime, playerScore: gameState.playerScore })
    const catalog = getCardCatalog()
    const uniqueValid = [...new Set(node.enemyDeck ?? [])].filter(name => catalog.some(c => c.name === name))
    const choices = uniqueValid.length >= 3
      ? uniqueValid.sort(() => Math.random() - 0.5).slice(0, 3)
      : generateRewardChoices(node.type, act.rewardTags)
    setRewardChoices(choices)
    setRewardCrystals(crystalReward)
    setScreen('reward')
  }, [run, gameState, actData])

  const handleRewardPick = useCallback((cardName: string) => {
    addCardsToCollection([{ cardName, count: 1 }])
    // Also track in run so the card is available in subsequent campaign battles this act
    if (run) {
      const updatedRun = { ...run, earnedCards: [...(run.earnedCards ?? []), cardName] }
      saveRun(updatedRun)
      setRun(updatedRun)
    }
    setScreen('nodemap')
  }, [run])

  const handleRewardSkip = useCallback(() => {
    setScreen('nodemap')
  }, [])

  const handleCampChoice = useCallback((choice: CampChoice) => {
    const currentRun = run
    if (!currentRun || !campNode) return
    const healAmount = campNode.restHeal ?? 5
    let updatedRun = { ...currentRun }
    let resultMessage = ''

    if (choice === 'heal') {
      const healed = applyRestHeal(updatedRun.playerHp, updatedRun.maxHp, healAmount)
      updatedRun.playerHp = healed.hp
      resultMessage = healed.message
      playRestHeal()
    } else if (choice === 'rest') {
      const fatigued = loadFatigued()
      if (fatigued.length > 0 && Math.random() < 0.5) {
        const idx = Math.floor(Math.random() * fatigued.length)
        const recovered = fatigued[idx]
        const newFatigued = fatigued.filter((_, i) => i !== idx)
        saveFatigued(newFatigued)
        setFatiguedCards(newFatigued)
        resultMessage = `${recovered} has recovered and returned to your deck!`
      } else {
        resultMessage = `The troops couldn't recover this time. Better luck next camp.`
      }
    } else if (choice === 'meditate') {
      if (updatedRun.livesRemaining < updatedRun.maxLives && Math.random() < 0.5) {
        updatedRun.livesRemaining = Math.min(updatedRun.maxLives, updatedRun.livesRemaining + 1)
        resultMessage = `Your focus deepens — gained +1 life!`
      } else {
        resultMessage = `Your mind wanders. No extra life gained this time.`
      }
    }

    updatedRun = {
      ...updatedRun,
      completedNodeIds: [...updatedRun.completedNodeIds, campNode.id],
      pendingNodeId: null,
    }
    recordNodeComplete(updatedRun.actId, campNode.id)
    saveRun(updatedRun)
    setRun(updatedRun)
    setCampResult(resultMessage)
  }, [run, campNode])

  const handleCampContinue = useCallback(() => {
    setCampNode(null)
    setCampResult(null)
    setScreen('nodemap')
  }, [])

  const handleWaveRewardPick = useCallback((cardName: string) => {
    // Add to collection permanently and inject into the current run deck
    addCardsToCollection([{ cardName, count: 1 }])
    const catalog = getCardCatalog()
    const card = catalog.find(c => c.name === cardName)
    dispatch({ type: 'WAVE_REWARD_PICK', card })
  }, [])

  const handleWaveRewardSkip = useCallback(() => {
    dispatch({ type: 'WAVE_REWARD_SKIP' })
  }, [])

  const handleSetStance = useCallback((s: NonNullable<GameState['playerStance']>) => {
    dispatch({ type: 'SET_STANCE', stance: s })
  }, [])

  const handleCycleSpeed = useCallback(() => {
    const order = [1, 2, 4, 8] as const
    const next = order[(order.indexOf(battle.speedMultiplier) + 1) % order.length]
    dispatch({ type: 'SET_SPEED', multiplier: next })
  }, [battle.speedMultiplier])

  const handleActComplete = useCallback(async () => {
    const currentRun = run
    if (!currentRun) {
      rollbar.error('handleActComplete called with null run', { screen })
      return
    }
    const act = actData
    rollbar.info('Act complete: beginning transition', {
      actId: currentRun.actId,
      equippedRelic: currentRun.activeRelic,
      rewardRelic: act?.rewardRelic,
    })

    // Persist the act's relic reward to the player's permanent relic collection
    // (also re-earns a previously broken relic)
    if (act?.rewardRelic) addEarnedRelic(act.rewardRelic)

    // 50% chance: the relic carried into this act breaks on completion
    // Guard: never break the relic just earned this act
    const equippedRelic = currentRun.activeRelic

    const proceedFromSpin = async (willBreak: boolean) => {
      rollbar.info('proceedFromSpin called', { actId: currentRun.actId, willBreak, equippedRelic, rewardRelic: act?.rewardRelic })
      if (willBreak && equippedRelic && equippedRelic !== act?.rewardRelic) {
        removeEarnedRelic(equippedRelic)
        addBrokenRelic(equippedRelic)
        const broken = BROKEN_RELIC_ITEMS[equippedRelic]
        const relicDef = getRelicDef(equippedRelic)
        brokenRelicRef.current = { name: relicDef?.name ?? equippedRelic, icon: relicDef?.icon ?? broken?.icon ?? '🪨' }
        addToInventory({
          id: `broken-relic-${equippedRelic.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          name: broken?.name ?? `Cracked ${equippedRelic}`,
          icon: broken?.icon ?? '🪨',
          desc: broken?.desc ?? `A cracked ${equippedRelic} — it held until it didn't.`,
          lore: '',
        })
      }

      const nextActId = act?.nextActId
      const nextAct = nextActId ? await loadAct(nextActId).catch(() => null) : null

      if (nextAct) {
        // ── Progress to next act ──────────────────────────────
        const earnedRelics = loadEarnedRelics()

        const proceedToNextAct = (chosenRelic: string | null) => {
          rollbar.info('Proceeding to next act', {
            fromActId: currentRun.actId,
            toActId: nextAct.id,
            chosenRelic,
            hasIntro: (nextAct.intro?.length ?? 0) > 0,
          })
          // Lives reset to at least LIVES_START (3) at the end of each act as a reward
          const restoredLives = Math.max(LIVES_START, currentRun.livesRemaining)
          const nextRun: RunState = {
            actId: nextAct.id,
            completedNodeIds: [],
            skippedNodeIds: [],
            pendingNodeId: null,
            playerHp: currentRun.playerHp,
            maxHp: currentRun.maxHp,
            livesRemaining: restoredLives,
            maxLives: currentRun.maxLives,
            cardPlayCounts: {},
            nodeFailCounts: {},
            earnedCards: [],
            activeRelic: chosenRelic,
            crystalBonus: 0,
            consumables: currentRun.consumables,
            activeModifierCount: 0,  // each new act starts fresh; modifiers are act-specific
            runSeed: Math.random() * 0xffffffff | 0,
          }
          saveRun(nextRun)
          setRun(nextRun)
          // Show next act intro cutscene
          const introPanels = nextAct.intro ?? []
          rollbar.info('proceedToNextAct: showing cutscene or nodemap', {
            fromActId: currentRun.actId,
            toActId: nextAct.id,
            panelCount: introPanels.length,
          })
          if (introPanels.length > 0) {
            setCutscenePanels(applyPlayerName(introPanels))
            cutsceneDoneRef.current = () => {
              rollbar.info('cutsceneDone (act transition): navigating to nodemap', {
                toActId: nextAct.id,
                runRefActId: runRef.current?.actId,
                hasRun: !!runRef.current,
                hasActData: !!(runRef.current && getCachedAct(runRef.current.actId)),
              })
              setCutscenePanels([])
              setScreen('nodemap')
            }
            setScreen('cutscene')
          } else {
            setScreen('nodemap')
          }
        }

        // Show card rest before proceeding to next act (per-act rest)
        const maybeShowCardRest = (chosenRelic: string | null) => {
          const actCounts = currentRun.cardPlayCounts ?? {}
          const candidates = getTopPlayedCards(actCounts, 3)
          rollbar.info('maybeShowCardRest: checking candidates', {
            fromActId: currentRun.actId,
            toActId: nextAct.id,
            candidateCount: candidates.length,
          })
          if (candidates.length >= 2) {
            setCardRestCandidates(candidates)
            setCardRestPlayCounts(actCounts)
            cardRestActDoneRef.current = () => proceedToNextAct(chosenRelic)
            setScreen('cardrest')
          } else {
            proceedToNextAct(chosenRelic)
          }
        }

        rollbar.info('Act transition: showing relic select or proceeding', {
          actId: currentRun.actId,
          nextActId: nextAct.id,
          earnedRelicsCount: earnedRelics.length,
          willBreak,
        })
        if (earnedRelics.length > 0) {
          // Mark pendingRelicSelect so that if the player exits mid-selection the run is
          // preserved and they are restored to actcomplete (not reset to ACT 1).
          saveRun({ ...currentRun, pendingActComplete: false, pendingRelicSelect: true })
          relicSelectDoneRef.current = maybeShowCardRest
          setScreen('relicselect')
        } else {
          maybeShowCardRest(null)
        }
        return
      }

      // ── No next act ─────────────────────────────────────────────────────────
      // If this act is its campaign's finale, the campaign is won. Otherwise the
      // player has reached the end of the authored acts of an in-progress arc
      // (campaign 2 lands act by act) — show "to be continued" instead.
      const campaign = getCampaignForAct(currentRun.actId)
      if (currentRun.actId !== campaign.finaleActId) {
        rollbar.info('End of authored acts — showing tobecontinued', { actId: currentRun.actId, campaignId: campaign.id })
        setScreen('tobecontinued')
        return
      }

      // ── Final act completed — show victory screen, then card rest / deck reset ──
      rollbar.info('Final act completed — showing campaignvictory', { actId: currentRun.actId })
      const newStreak = incrementWinStreak()
      const streakUnlocked = setAchievementProgress('campaign:win_streak', newStreak)
      if (streakUnlocked.length > 0) setAchievementToasts(prev => [...prev, ...streakUnlocked])
      setScreen('campaignvictory')
    }

    // If a relic is equipped (and it's not the one just earned), show the spin screen
    if (equippedRelic && equippedRelic !== act?.rewardRelic) {
      const willBreak = Math.random() < 0.5
      const broken = BROKEN_RELIC_ITEMS[equippedRelic]
      const relicDef = getRelicDef(equippedRelic)
      setRelicSpinData({
        relicName:  relicDef?.name ?? equippedRelic,
        relicIcon:  relicDef?.icon ?? '🛡️',
        breaks:     willBreak,
        brokenName: broken?.name,
        brokenIcon: broken?.icon,
        brokenDesc: broken?.desc,
        onContinue: () => { setRelicSpinData(null); proceedFromSpin(willBreak) },
      })
      return
    }

    proceedFromSpin(false)
  }, [run, actData])


  const handleCardRestConfirm = useCallback((resting: string[]) => {
    // Mid-act card rest: accumulate fatigued cards and proceed to the next act
    if (cardRestActDoneRef.current) {
      const existing = loadFatigued()
      const combined = [...new Set([...existing, ...resting])]
      saveFatigued(combined)
      setFatiguedCards(combined)
      const done = cardRestActDoneRef.current
      cardRestActDoneRef.current = null
      done()
      return
    }

    // Campaign-end card rest: existing behaviour (fatigued cards already cleared by Begin Anew)
    saveFatigued(resting)
    setFatiguedCards(resting)

    // Check if fatiguing those cards shrinks usable collection below DECK_MAX
    const collection = loadCollection()
    const catalog = getCardCatalog()
    const totalOwned = catalog
      .filter(c => !resting.includes(c.name))
      .reduce((sum, c) => sum + getOwnedCount(collection, c.name), 0)

    const bonus: string[] = []
    if (totalOwned < DECK_MAX) {
      const needed = DECK_MAX - totalOwned
      const packsNeeded = Math.ceil(needed / 5)
      for (let i = 0; i < packsNeeded; i++) bonus.push(...generatePack())
      addCardsToCollection(bonus.map(name => ({ cardName: name, count: 1 })))
    }
    setBonusPackCards(bonus)

    clearRun()
    setRun(null)
    setScreen('starterpack')
  }, [])

  const handleStarterPackPick = useCallback((cards: DeckEntry[]) => {
    saveDeck(cards)
    setScreen('deckbuilder')
  }, [])

  const handleCampaignRetry = useCallback(() => {
    const currentRun = run
    if (!currentRun) { setScreen('title'); return }
    if (!actData) { setScreen('nodemap'); return }
    const act = actData
    const nodeId = currentRun.pendingNodeId
    if (!nodeId) { setScreen('nodemap'); return }
    const node = act.nodes[nodeId]

    // Decrement a life and record the node failure
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
      setScreen('campaignfailed')
      return
    }

    // Retry same node, but HP stays at what it was before this battle
    campaignPlayCountsRef.current = {}
    isCampaignRef.current = true
    battleFlawlessRef.current = true
    battleUsedStructure.current = false
    battleUsedMobileUnit.current = false
    prevOpponentUnitsRef.current = new Map()
    prevPlayerUnitsRef.current = new Map()
    const collection  = loadCollection()
    const fatigued    = loadFatigued()
    const deckEntries = loadDeck().filter(e => !fatigued.includes(e.cardName))
    const playerCards = buildDeckCards(deckEntries, collection)
    const earnedEntries = (withFail.earnedCards ?? []).map(n => ({ cardName: n, count: 1 }))
    if (earnedEntries.length > 0) playerCards.push(...buildDeckCards(earnedEntries, collection))
    battleAllLegendaryRef.current = playerCards.length > 0 && playerCards.every(c => c.rarity === 'legendary')
    const modsRetry = act ? getModifiersByCount(act, withFail.activeModifierCount) : []
    const state = newGame({ playerCards, ...resolvedNodeOpts(node, act, loadRunCount(), modsRetry) })
    state.playerBase = { hp: withFail.playerHp, maxHp: withFail.maxHp }
    if (withFail.activeRelic) getRelicDef(withFail.activeRelic)?.applyToGame(state)
    syncPlayerCommanderToBase(state)
    state.stanceRules = STANCE_RULES_BY_NODE_TYPE[node.type]
    startBattle(state)
    rollRareEvent()
  }, [run, actData])

  const handleAbandonRun = useCallback(() => {
    clearRun()
    setRun(null)
    clearFatigued()
    setFatiguedCards([])
    setBonusPackCards([])
    setScreen('title')
  }, [])

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

  // Track card play types for per-battle misc achievements
  const handlePlayCard = useCallback((cardId: string) => {
    const s = gameStateRef.current
    if (!s) return
    const card = s.playerHand.find(c => c.id === cardId)
    if (!card) return
    if (card.isHero && s.gameTime < 30000) return
    playCardPlay()
    recordCardPlayed(card.name)
    // Track for misc achievements
    const newToastsFromCards = incrementAchievementProgress('misc:cards_played')
    if (newToastsFromCards.length > 0) {
      setAchievementToasts(prev => [...prev, ...newToastsFromCards])
    }
    if (card.cardType === 'structure') battleUsedStructure.current = true
    if (card.cardType === 'unit') battleUsedMobileUnit.current = true
    // Exotic quest chains: play-card-type steps
    if (!isTrainingModeRef.current) {
      const questDone = recordQuestCardPlayed(card.cardType)
      if (questDone.length > 0) setQuestCompletes(prev => [...prev, ...questDone])
    }
    if (isCampaignRef.current) {
      campaignPlayCountsRef.current[card.name] =
        (campaignPlayCountsRef.current[card.name] ?? 0) + 1
    }
    const next = playCard(s, cardId)
    next.battleStats = {
      ...next.battleStats,
      cardsPlayed: {
        ...next.battleStats.cardsPlayed,
        [card.name]: (next.battleStats.cardsPlayed[card.name] ?? 0) + 1,
      },
    }
    saveBattleState(next)
    dispatch({ type: 'SET_GAME_STATE', gameState: next })
  }, [])

  const handlePlayAoeCard = useCallback((cardId: string, cx: number, cy: number) => {
    const s = gameStateRef.current
    if (!s) return
    const card = s.playerHand.find(c => c.id === cardId)
    if (!card) return
    playCardPlay()
    recordCardPlayed(card.name)
    const next = playAoeCard(s, cardId, cx, cy)
    saveBattleState(next)
    dispatch({ type: 'SET_GAME_STATE', gameState: next })
  }, [])

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

  const packBackScreenRef = useRef<Screen>('title')

  const handleOpenPack = useCallback(() => {
    packBackScreenRef.current = 'playing'
    setQuickPlayRewardClaimed(true)
    let pack: string[]

    switch(quickBattleModeRef.current) {
      case 'easy':
        pack = [...new Set(generatePack())].slice(0, 2)
        break
      case 'normal':
      case 'mirror':
      case 'draft':
        pack = generatePack()
        break
      case 'unlimited':
        pack = generateSeededPack(3, 'rare')
        break
      case 'hero-only':
        pack = generateSeededPack(5, 'legendary')
        break
      case 'chaos':
        pack = generateSeededPack(2, 'legendary')
        break
      case 'only-units': {
        const pool = getCardCatalog().filter(c => c.cardType.includes('unit'))
        pack = Array.from({ length: 3 }, () => pool[Math.floor(Math.random() * pool.length)].name)
        break
      }
      case 'only-spells': {
        const pool = getCardCatalog().filter(c => c.cardType.includes('upgrade'))
        pack = Array.from({ length: 3 }, () => pool[Math.floor(Math.random() * pool.length)].name)
        break
      }
      case 'only-buildings': {
        const pool = getCardCatalog().filter(c => c.cardType.includes('structure'))
        pack = Array.from({ length: 3 }, () => pool[Math.floor(Math.random() * pool.length)].name)
        break
      }
      case 'common-only': {
        const pool = getCardCatalog().filter(c => c.rarity === 'common')
        pack = Array.from({ length: 5 }, () => pool[Math.floor(Math.random() * pool.length)].name)
        break
      }
      case 'uncommon-only':
        pack = generateSeededPack(5, 'uncommon')
        break
      case 'rare-only':
        pack = generateSeededPack(5, 'rare')
        break
      case 'legendary-only':
        pack = generateSeededPack(5, 'legendary')
        break
      default:
        pack = generatePack()
        break
    }

    setPacks([pack])
    setScreen('pack')
  }, [])

  const handleBuyCrystalPack = useCallback((qty: number = 1, returnScreen: Screen = 'shop') => {
    const current = loadCrystals()
    const totalCost = CRYSTAL_PACK_COST * qty
    if (current < totalCost) return
    const next = current - totalCost
    saveCrystals(next)
    setCrystals(next)
    packBackScreenRef.current = returnScreen
    setPacks(Array.from({ length: qty }, () => generatePack()))
    setScreen('pack')
  }, [])

  const handleCrystalsChanged = useCallback((n: number) => {
    setCrystals(n)
  }, [])

  const handlePackDone = useCallback(() => {
    setScreen(packBackScreenRef.current)
  }, [])

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
    handleStartWeeklyChallenge, handleStartTraining, handleResetGame, checkForUpdates,
    hubData, currentLocationKey, worldMapKey, restrictedTownNodeIds,
    miniGamesEntry, setMiniGamesEntry, hubMiniGameEntry, setHubMiniGameEntry,
    setShopBuildingId, setShopTappedNpc, setShowTitleLoginModal, setFeedbackOpen,
    setActiveNarratorLog, goToWorldLocation, handleWorldBattle,
    handleCampaign, handleCampaign2, handleEndless,
    setCommander, packs, shopBuildingId, shopTappedNpc,
    handleCrystalsChanged, handleBuyCrystalPack, handlePackDone,
    setNewsUnreadCount, previewAsPlayer, setPreviewAsPlayer,
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
    handleStartDailyChallenge, handleStartWeeklyChallenge, handleStartTraining,
    handleResetGame, checkForUpdates,
  ])

  const battleContextValue = useMemo<BattleContextValue>(
    () => ({ battle, gameState, dispatch }),
    [battle, gameState],
  )

  return (
    <AppProvider value={appContextValue}>
    <BattleProvider value={battleContextValue}>
    <div className="game-container">
      <div className="game-title">JARV'S AMAZING WEB GAME</div>

      <Suspense fallback={<ScreenLoadingFallback />}>

      <EntryRoutes />
      <HubRoutes />
      <AdminRoutes />
      <CollectionRoutes />

      {screen === 'nodemap' && run && actData && (
        <NodeMap
          act={actData}
          run={run}
          onSelectNode={handleSelectNode}
          onUseConsumable={handleUseConsumable}
          onBack={handleMainMenu}
          user={user}
        />
      )}

      {screen === 'battlesummary' && summaryStats && (
        <BattleSummary
          stats={summaryStats.stats}
          gameTime={summaryStats.gameTime}
          playerScore={summaryStats.playerScore}
          onContinue={() => summaryDoneRef.current()}
        />
      )}

      {screen === 'reward' && (
        <PostBattleReward
          choices={rewardChoices}
          crystals={rewardCrystals}
          nodeType={run && actData ? actData.nodes[run.completedNodeIds[run.completedNodeIds.length - 1]]?.type ?? 'battle' : 'battle'}
          onPick={handleRewardPick}
          onSkip={handleRewardSkip}
          battleSummary={summaryStats ?? undefined}
        />
      )}

      {screen === 'actcomplete' && actData && (
        <ActComplete
          actTitle={actData.title}
          actSubtitle={actData.subtitle}
          relicName={actData.rewardRelic}
          relicDesc={actData.rewardRelicDesc}
          onContinue={handleActComplete}
          hasNextAct={hasNextAct}
        />
      )}

      {screen === 'cutscene' && cutscenePanels.length > 0 && (
        <CutsceneScreen panels={cutscenePanels} onDone={() => {
          rollbar.info('CutsceneScreen.onDone fired', { panelCount: cutscenePanels.length, runActId: run?.actId })
          cutsceneDoneRef.current()
        }} />
      )}

      {screen === 'bossEpilogue' && epiloguePanels.length > 0 && (
        <BossEpilogueScreen panels={epiloguePanels} onDone={() => {
          setEpiloguePanels([])
          const done = epilogueDoneRef.current
          epilogueDoneRef.current = null
          if (done) done()
          else setScreen('actcomplete')
        }} />
      )}

      {screen === 'bossdialogue' && bossDialogueNode?.bossDialogue && (
        <BossDialogueScreen
          bossName={bossDialogueNode.label}
          lines={bossDialogueNode.bossDialogue.map(l => l.replace(/\bJarv\b/g, loadPlayerName()))}
          onDone={handleBossDialogueDone}
        />
      )}

      {screen === 'event' && activeEvent && run && (
        <EventScreen
          event={activeEvent}
          onChoice={handleEventChoice}
          playerHp={run.playerHp}
          maxHp={run.maxHp}
        />
      )}

      {screen === 'merchant' && merchantItems.length > 0 && (
        <MerchantScreen
          items={merchantItems}
          crystals={crystals}
          onBuy={handleMerchantBuy}
          onDone={handleMerchantDone}
        />
      )}

      {screen === 'mystery' && mysteryReward && (
        <MysteryScreen
          reward={mysteryReward}
          onCollect={handleMysteryCollect}
        />
      )}

      {(screen === 'memory' || activeMemoryFragment?.shardBonus) && activeMemoryFragment && (
        <MemoryFragmentScreen
          fragment={activeMemoryFragment.fragment}
          alreadyFound={activeMemoryFragment.alreadyFound}
          shardBonus={activeMemoryFragment.shardBonus}
          onCollect={activeMemoryFragment.shardBonus
            ? () => { setActiveMemoryFragment(null); setScreen('nodemap') }
            : handleMemoryCollect}
        />
      )}

      {screen === 'characterEncounter' && activeCharacterEncounter && (
        <CharacterEncounterScreen
          characterId={activeCharacterEncounter.characterId}
          onDone={handleCharacterDone}
        />
      )}

      {screen === 'narratorJournal' && activeNarratorLog && (
        <NarratorJournalScreen
          characterId={activeNarratorLog}
          onBack={() => setScreen(returnScreen)}
        />
      )}

      {screen === 'camp' && campNode && run && (
        <CampScreen
          playerHp={run.playerHp}
          maxHp={run.maxHp}
          livesRemaining={run.livesRemaining}
          maxLives={run.maxLives}
          fatiguedCards={fatiguedCards}
          healAmount={campNode.restHeal ?? 5}
          onChoose={handleCampChoice}
          result={campResult}
          onContinue={handleCampContinue}
        />
      )}

      {screen === 'itemfound' && foundItem && (
        <ItemFoundScreen
          item={{ ...foundItem, acquiredDate: '' }}
          onCollect={() => {
            addToInventory(foundItem)
            setFoundItem(null)
            setScreen('nodemap')
          }}
        />
      )}

      {screen === 'character' && (
        <CharacterScreen onDone={() => setScreen('title')} />
      )}

      {screen === 'replayBriefing' && replayBriefingRef.current && (() => {
        const { actId, completionCount, lastRunFailed, actHasUncollectedFragment, proceed } = replayBriefingRef.current!
        // launchCampaign() already awaited loadAct(actId) before setting this ref,
        // so the act is guaranteed to be in cache by the time this renders.
        const act = getCachedAct(actId)
        if (!act) return null
        const ownsCharm = getConsumables().find(c => c.id === 'memory_charm')?.count ?? 0
        return (
          <ReplayBriefingScreen
            act={act}
            completionCount={completionCount}
            lastRunFailed={lastRunFailed}
            actHasUncollectedFragment={actHasUncollectedFragment}
            crystals={crystals}
            ownsCharm={ownsCharm > 0}
            onBuyCharm={() => {
              if (crystals < 1000) return
              const next = crystals - 1000
              saveCrystals(next)
              setCrystals(next)
              addConsumable('memory_charm', 1)
            }}
            onBegin={chosenCount => { replayBriefingRef.current = null; clearLastRunFailed(); proceed(chosenCount) }}
            onBack={() => { replayBriefingRef.current = null; setScreen('title') }}
          />
        )
      })()}

      {screen === 'relicselect' && (
        <RelicSelectScreen
          earnedRelics={loadEarnedRelics()}
          currentRelic={run?.activeRelic ?? null}
          brokenRelic={brokenRelicRef.current}
          onSelect={relic => {
            rollbar.info('RelicSelectScreen: relic confirmed', { relic, runActId: run?.actId })
            brokenRelicRef.current = null
            relicSelectDoneRef.current(relic)
          }}
        />
      )}

      {screen === 'cardrest' && (
        <CardRestSelect
          candidates={cardRestCandidates}
          playCounts={cardRestPlayCounts}
          alreadyResting={fatiguedCards}
          onConfirm={handleCardRestConfirm}
        />
      )}

      {screen === 'starterpack' && (
        <StarterPackSelect
          onPick={handleStarterPackPick}
          fatiguedCards={fatiguedCards}
          bonusCards={bonusPackCards}
          recommendedPackId={run?.archetype ? ARCHETYPE_STARTER_PACK[run.archetype as Archetype] : undefined}
        />
      )}

      {screen === 'campaignvictory' && (
        <CampaignVictoryScreen
          onBeginAnew={() => setScreen('statupgrade')}
          campaignId={run ? getCampaignForAct(run.actId).id : 'c1'}
        />
      )}

      {screen === 'tobecontinued' && (
        <ToBeContinuedScreen
          campaignName={run ? getCampaignForAct(run.actId).name : 'The Forgotten Kingdom'}
          onContinue={() => {
            clearRun(); setRun(null); clearFatigued(); setFatiguedCards([])
            setScreen(returnScreen)
          }}
        />
      )}

      {screen === 'statupgrade' && (
        <StatUpgradeScreen onSelect={(stat) => {
          applyStatUpgrade(stat)
          const bonus = crystals + 500; saveCrystals(bonus); setCrystals(bonus)
          clearRun(); setRun(null); clearFatigued(); setFatiguedCards([]); setBonusPackCards([])
          setScreen('starterpack')
        }} />
      )}

      {screen === 'campaignfailed' && (
        <CampaignFailedScreen onReturnToMenu={() => { stopBattleMusic(); stopGameOverMusic(); setScreen('title') }} />
      )}

      {screen === 'playing' && gameState && (() => {
        const pendingId = run?.pendingNodeId
        const failCount = pendingId ? (run?.nodeFailCounts?.[pendingId] ?? 0) : 0
        const quickPlayHint = isCampaignRef.current
          && gameState.phase.type === 'gameOver'
          && gameState.phase.winner !== 'player'
          && failCount >= 2
        if (gameState.phase.type === 'celebration') {
          return (
            <>
              <Battlefield state={gameState} onPlayCard={handlePlayCard} onPlayAoeCard={handlePlayAoeCard} onGiveUp={handleGiveUp} onPause={setIsUserPaused} actTheme={actTheme} activeRelic={run?.activeRelic} showBossSplash={false} activeModifiers={run && actData ? getModifiersByCount(actData, run.activeModifierCount) : []} isCampaign={isCampaign} stance={gameState.playerStance ?? 'auto'} onSetStance={handleSetStance} speedMultiplier={speedMultiplier} onCycleSpeed={handleCycleSpeed} onCounterSpell={() => dispatch({ type: 'COUNTER_SPELL' })} isAdmin={isAdminUser(user)} />
              <VictoryPanel
                playerScore={gameState.playerScore}
                opponentScore={gameState.opponentScore}
                playerBaseHp={gameState.playerBase.hp}
                playerBaseMaxHp={gameState.playerBase.maxHp}
                unitsDefeated={gameState.battleStats.playerKills}
                gameTime={gameState.gameTime}
                onContinue={() => dispatch({ type: 'SET_GAME_STATE', gameState: { ...gameState, phase: { type: 'gameOver', winner: 'player' } } })}
              />
            </>
          )
        }
        if (gameState.phase.type === 'fingerSmash') {
          const fp = gameState.phase as { type: 'fingerSmash'; wave: number; smashedNames: string[]; rewardDue: boolean }
          return (
            <>
              <Battlefield state={gameState} onPlayCard={handlePlayCard} onPlayAoeCard={handlePlayAoeCard} onGiveUp={handleGiveUp} onPause={setIsUserPaused} actTheme={actTheme} activeRelic={run?.activeRelic} showBossSplash={showBossSplash} activeModifiers={run && actData ? getModifiersByCount(actData, run.activeModifierCount) : []} isCampaign={isCampaign} stance={gameState.playerStance ?? 'auto'} onSetStance={handleSetStance} speedMultiplier={speedMultiplier} onCycleSpeed={handleCycleSpeed} onCounterSpell={() => dispatch({ type: 'COUNTER_SPELL' })} isAdmin={isAdminUser(user)} />
              <FingerSmash
                smashedNames={fingerSmashNames}
                onDone={() => {
                  dispatch({ type: 'DISMISS_FINGER_SMASH' })
                  const gs = gameStateRef.current
                  if (gs && gs.phase.type === 'fingerSmash') {
                    const fphase = gs.phase as { type: 'fingerSmash'; wave: number; smashedNames: string[]; rewardDue: boolean }
                    dispatch({ type: 'SET_GAME_STATE', gameState: {
                      ...gs,
                      phase: fphase.rewardDue
                        ? { type: 'waveReward', wave: fphase.wave, smashedNames: fphase.smashedNames }
                        : { type: 'playing' },
                    } })
                  }
                }}
              />
            </>
          )
        }
        if (gameState.phase.type === 'waveReward') {
          const wave = (gameState.phase as { type: 'waveReward'; wave: number; smashedNames: string[] }).wave
          return (
            <PostBattleReward
              choices={waveRewardChoices}
              nodeType="battle"
              crystals={0}
              onPick={handleWaveRewardPick}
              onSkip={handleWaveRewardSkip}
              headerOverride={{
                title: `WAVE ${wave} CLEARED`,
                sub: 'Pick a card to add to your deck.',
              }}
            />
          )
        }
        return gameState.phase.type === 'gameOver' ? (
          <GameOver
            state={gameState}
            winner={gameState.phase.winner}
            handicap={handicap}
            onOpenPack={!isCampaignRef.current && worldBattleNodeIdRef.current === null && gameState.phase.winner === 'player' ? handleOpenPack : undefined}
            rewardClaimed={quickPlayRewardClaimed}
            onPlayAgain={worldBattleNodeIdRef.current !== null
              ? handleWorldBattleRetry
              : isCampaignRef.current
                ? (gameState.phase.winner === 'player' ? handleCampaignWin : handleCampaignRetry)
                : isDailyChallengeRef.current
                  ? handleDailyChallengeRetry
                  : isWeeklyChallengeRef.current
                    ? handleStartWeeklyChallenge
                    : handlePlayAgain
            }
            onMainMenu={handleMainMenu}
            campaignAbandon={isCampaignRef.current ? handleAbandonRun : undefined}
            quickPlayHint={quickPlayHint}
            showStreak={!isCampaignRef.current && worldBattleNodeIdRef.current === null && !isDailyChallengeRef.current && !isWeeklyChallengeRef.current}
            dailyChallengeState={isDailyChallengeRef.current ? dcGameOverState : undefined}
            worldBattle={worldBattleNodeIdRef.current !== null}
          />
        ) : (
          <>
            <Battlefield state={gameState} onPlayCard={handlePlayCard} onPlayAoeCard={handlePlayAoeCard} onGiveUp={handleGiveUp} onPause={setIsUserPaused} actTheme={actTheme} activeRelic={run?.activeRelic} showBossSplash={showBossSplash} activeModifiers={run && actData ? getModifiersByCount(actData, run.activeModifierCount) : []} isCampaign={isCampaign} stance={gameState.playerStance ?? 'auto'} onSetStance={handleSetStance} speedMultiplier={speedMultiplier} onCycleSpeed={handleCycleSpeed} onCounterSpell={() => dispatch({ type: 'COUNTER_SPELL' })} isAdmin={isAdminUser(user)} />
            {showBossShockwave && <BossShockwave onDone={() => dispatch({ type: 'HIDE_BOSS_SHOCKWAVE' })} />}
            {activeRareEvent === 'fakeCrash'   && <FakeCrashEvent   onDone={handleRareEventDone} />}
            {activeRareEvent === 'blackjack'   && <BlackjackEvent   onDone={handleRareEventDone} />}
            {activeRareEvent === 'wrongNumber' && <WrongNumberEvent onDone={handleRareEventDone} />}
            {activeRareEvent === 'narrator'    && <NarratorEvent    onDone={handleRareEventDone} />}
            {activeRareEvent === 'liarsDice'   && <LiarsDiceEvent   onDone={handleRareEventDone} />}
            {activeRareEvent === 'gambler'     && <GamblerEvent     onDone={handleRareEventDone} />}
            {activeRareEvent === 'devBuild'       && <DevBuildEvent       onDone={handleRareEventDone} />}
            {activeRareEvent === 'glitchedCard'   && <GlitchedCardEvent   onDone={handleRareEventDone} />}
            {activeRareEvent === 'confusedTourist' && <ConfusedTouristEvent onDone={handleRareEventDone} />}
          </>
        )
      })()}

      <AppOverlays />
      </Suspense>
    </div>
    </BattleProvider>
    </AppProvider>
  )
}
