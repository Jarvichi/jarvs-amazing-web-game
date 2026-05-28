import React, { useState, useCallback, useEffect, useRef, useMemo, useReducer } from 'react'
import { resolvedNodeOpts, loadHandicap, HANDICAP_KEY, buildQuickBattleOpts, loadCurrentDeckInfo } from './game/campaignHelpers'
import { usePlaytime } from './hooks/usePlaytime'
import { useStartupData } from './hooks/useStartupData'
import { useCloudSync } from './hooks/useCloudSync'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { GameState, Card, StanceRules, Archetype } from './game/types'
import { newGame, MAX_HANDICAP } from './game/engine'
import { playCard, playAoeCard } from './game/engine/cards'
import { makeNodeDeck } from './game/cards'
import { battleReducer, INITIAL_BATTLE_STATE, TICK_MS } from './game/battleReducer'
import {
  loadDeck, saveDeck, buildDeckCards, generatePack,
  loadCollection, saveCollection, loadCrystals, saveCrystals,
  recordCardPlayed, recordUnitDied, addCardsToCollection,
  getOwnedCount, DECK_MAX, CRYSTAL_PACK_COST, DeckEntry,
  deckTotalCards, STARTER_DECK,
  loadWinStreak, loadBestStreak, incrementWinStreak, resetWinStreak, incrementTotalWins,
  generateSeededPack,
} from './game/collection'
import { getCardCatalog } from './game/cards'
import { applyStatUpgrade } from './game/playerStats'
import {
  loadRun, saveRun, clearRun, newRun, LIVES_START, LIVES_MAX,
  getAvailableNodeIds, skipSiblings, isActComplete,
  generateRewardChoices, generateEndlessRewardChoices, generateMerchantCards, MERCHANT_PRICES, ACTS, getNextAct,
  loadFatigued, saveFatigued, clearFatigued, getTopPlayedCards,
  hasSeenIntro, markIntroSeen,
  loadRunCount, incrementRunCount, getAct1Intro,
  loadBattleCount, incrementBattleCount,
  generateEventFromConfig, EventChoice, EventData,
  CutscenePanel, QuestNode, RunState, Act, ReplayModifier,
  getActiveModifiers, loadActCount, incrementActCount,
  recordNodeComplete, loadPlayerName, applyPlayerName,
  ALL_CONSUMABLES, addToConsumableStash, useConsumable,
  getModifiersByCount, getModifierMax,
  setLastRunFailed, loadLastRunFailed, clearLastRunFailed,
  ARCHETYPE_STARTER_PACK, loadPlayerArchetype,
} from './game/questline'
import { CardRestSelect }       from './components/cards/CardRestSelect'
import { CampScreen, CampChoice } from './components/campaign/CampScreen'
import { EventScreen }          from './components/campaign/EventScreen'
import { MerchantScreen, MerchantItem, cardMerchantItem } from './components/campaign/MerchantScreen'
import { MysteryScreen } from './components/campaign/MysteryScreen'
import { MemoryFragmentScreen } from './components/campaign/MemoryFragmentScreen'
import { MemoryFragment, isFragmentDiscovered, markFragmentDiscovered, isHubWorldUnlocked, unlockHubWorld, areAllCampaignFragmentsDiscovered } from './game/codex'
import { CharacterEncounterScreen } from './components/campaign/CharacterEncounterScreen'
import { CharacterChoice, recordCharacterEncounter } from './game/characters'
import memoryFragmentsData from './data/memoryFragments.json'
import { ItemFoundScreen }    from './components/modals/ItemFoundScreen'
import { CharacterScreen }    from './components/screens/CharacterScreen'
import { CutsceneScreen }       from './components/campaign/CutsceneScreen'
import { BossDialogueScreen }   from './components/battle/BossDialogueScreen'
import { Battlefield }        from './components/battle/Battlefield'
import { GameOver }           from './components/battle/GameOver'
import { TitleScreen }        from './components/title/TitleScreen'
import { QuickBattleMode, QuickBattleScreen }  from './components/screens/QuickBattleScreen'
import { CollectionScreen }   from './components/screens/CollectionScreen'
import { DeckBuilder }        from './components/cards/DeckBuilder'
import { PackOpening }        from './components/cards/PackOpening'
import { NodeMap }            from './components/campaign/NodeMap'
import { HubWorld }           from './components/hub/HubWorld'
import { PostBattleReward }   from './components/battle/PostBattleReward'
import { ActComplete }        from './components/battle/ActComplete'
import { RelicSelectScreen }  from './components/campaign/RelicSelectScreen'
import { ReplayBriefingScreen } from './components/campaign/ReplayBriefingScreen'
import { StarterPackSelect }  from './components/cards/StarterPackSelect'
import { SettingsScreen, applyTextSettings, loadSkipIntro, load8bitEnabled, apply8bitMode, applyLightMode, loadLightMode } from './components/screens/SettingsScreen'
import { IntroScreen } from './components/title/IntroScreen'
import { FakeCrashEvent }     from './components/rare-events/FakeCrashEvent'
import { BlackjackEvent }     from './components/rare-events/BlackjackEvent'
import { WrongNumberEvent }   from './components/rare-events/WrongNumberEvent'
import { NarratorEvent }      from './components/rare-events/NarratorEvent'
import { LiarsDiceEvent }     from './components/rare-events/LiarsDiceEvent'
import { GamblerEvent }       from './components/rare-events/GamblerEvent'
import { DevBuildEvent }        from './components/rare-events/DevBuildEvent'
import { GlitchedCardEvent }    from './components/rare-events/GlitchedCardEvent'
import { ConfusedTouristEvent } from './components/rare-events/ConfusedTouristEvent'
import { CardTile }           from './components/cards/CardTile'
import { DailyLoginModal }   from './components/screens/DailyLoginModal'
import { GiftClaimModal }    from './components/admin/GiftClaimModal'
import { GiftAdminScreen }  from './components/admin/GiftAdminScreen'
import { LoginModal }        from './components/modals/LoginModal'
import { InventoryScreen }   from './components/screens/InventoryScreen'
import { markDailyRewardClaimed, addToInventory, computeReward, loadInventory, RewardDef, ALL_ITEMS } from './game/dailyLogin'
import { applyGiftRewards, GiftDef } from './game/gifts'
import { NewsScreen }      from './components/screens/NewsScreen'
import { NewsAdminScreen } from './components/admin/NewsAdminScreen'
import { CampaignAdminScreen } from './components/admin/CampaignAdminScreen'
import { FeedbackModal } from './components/modals/FeedbackModal'
import { FeedbackAdminScreen } from './components/admin/FeedbackAdminScreen'
import { DeckSelectorModal } from './components/cards/DeckSelectorModal'
import { loadDeckSlot } from './game/collection'
import { getDailyPlayerDeck, getDailyOpponentDeck, getDailyChallengeState, saveDailyChallengeResult, recordDailyWin, publishDailyResult, publishEndlessResult, DailyChallengeState } from './game/dailyChallenge'
import { getRelicDef, addEarnedRelic, removeEarnedRelic, loadEarnedRelics, addBrokenRelic } from './game/relics'
import { playCardPlay, playButtonClick, playBattleEvent, playCardFlip, playRestHeal, playBattleStart, playVictory, playDefeat, stopBattleMusic, stopGameOverMusic } from './game/sound'
import { useMusic } from './hooks/useMusic'
import { getIntegrityViolations, clearIntegrityViolations } from './game/integrity'
import { useRareEvents } from './hooks/useRareEvents'
import { useAchievements } from './hooks/useAchievements'
import { isNoDamageMode } from './game/debug'
import { saveBattleState, loadBattleState, clearBattleState } from './game/battleState'
import { loadCommander, promoteCommander, CommanderState } from './game/commander'
import { CommanderScreen } from './components/screens/CommanderScreen'
import { TrainingScreen }  from './components/screens/TrainingScreen'
import {
  incrementAchievementProgress, setAchievementProgress, AchievementDef,
} from './game/achievements'
import { incrementAugmentSouls } from './game/collection'
import { AchievementsScreen }  from './components/screens/AchievementsScreen'
import { HallOfAchievements }   from './components/hub/HallOfAchievements'
import { HomeShelf }             from './components/hub/HomeShelf'
import { HeroCardsScreen }   from './components/screens/HeroCardsScreen'
import FingerSmash from './components/battle/FingerSmash'
import BossShockwave from './components/battle/BossShockwave'
import { ShopScreen }        from './components/screens/ShopScreen'
import { BattleSummary }    from './components/battle/BattleSummary'
import { VictoryPanel }     from './components/battle/VictoryPanel'
import { RelicSpinScreen }  from './components/campaign/RelicSpinScreen'
import { CampaignVictoryScreen } from './components/battle/CampaignVictoryScreen'
import { CampaignFailedScreen }  from './components/battle/CampaignFailedScreen'
import { StatUpgradeScreen }     from './components/campaign/StatUpgradeScreen'
import { PlayerStatsScreen }     from './components/screens/PlayerStatsScreen'
import { CodexScreen }          from './components/screens/CodexScreen'
import { DailyChallengeScreen } from './components/screens/DailyChallengeScreen'
import { ConfirmModal }          from './components/modals/ConfirmModal'
import { StreakBrokenModal }     from './components/modals/StreakBrokenModal'
import { EndlessLeaderboardScreen } from './components/screens/EndlessLeaderboardScreen'
import { MiniGamesMenu }           from './components/screens/MiniGamesMenu'
import { AugmentCollectionScreen } from './components/screens/AugmentCollectionScreen'
import { PlayerScreen }            from './components/screens/PlayerScreen'
import { CollectionTabScreen }     from './components/screens/CollectionTabScreen'
import './styles.css'
import { publishSecretRareWin, type SecretRarityType } from './game/secretRareNews'
import brokenRelicsData from './data/broken-relics.json'
import rollbar, { updateRollbarPerson } from './rollbar'
import { useAuth } from './hooks/useAuth'
import { auth } from './firebase'
import { uploadSave, applySave } from './game/cloudSave'

// Apply saved display settings on load
applyTextSettings()
apply8bitMode(load8bitEnabled())
applyLightMode(loadLightMode())

const BROKEN_RELIC_ITEMS: Record<string, { name: string; icon: string; desc: string }> =
  Object.fromEntries((brokenRelicsData as { relicName: string; name: string; icon: string; desc: string }[])
    .map(r => [r.relicName, { name: r.name, icon: r.icon, desc: r.desc }]))

/** Build merchant item list: 3 cards + ~1-in-5 chance of 1 unowned inventory 'Curiosity' at 10–20 crystals. */
function buildMerchantItems(): MerchantItem[] {
  const catalog   = getCardCatalog()
  const cardNames = generateMerchantCards()
  const items: MerchantItem[] = cardNames.map(name => {
    const card = catalog.find(c => c.name === name)!
    return cardMerchantItem(card)
  })
  if (Math.random() < 0.2) {
    const owned = new Set(loadInventory().map(i => i.id))
    const available = ALL_ITEMS.filter(i => !owned.has(i.id))
    if (available.length > 0) {
      const inv   = available[Math.floor(Math.random() * available.length)]
      const price = 10 + Math.floor(Math.random() * 11)   // 10–20 crystals
      items.push({ kind: 'item', inventoryItem: { id: inv.id, name: inv.name, icon: inv.icon, desc: inv.desc, lore: inv.lore ?? '', acquiredDate: '' }, price })
    }
  }
  // Always add consumables to the merchant
  for (const c of ALL_CONSUMABLES) {
    items.push({ kind: 'consumable', def: c, price: c.price })
  }
  return items
}

type Screen =
  | 'intro'
  | 'title'
  | 'settings'
  | 'playing'
  | 'collection'
  | 'deckbuilder'
  | 'pack'
  | 'nodemap'
  | 'cutscene'
  | 'bossdialogue'
  | 'event'
  | 'merchant'
  | 'mystery'
  | 'reward'
  | 'actcomplete'
  | 'cardrest'
  | 'starterpack'
  | 'relicselect'
  | 'inventory'
  | 'achievements'
  | 'hall-of-achievements'
  | 'campaignfailed'
  | 'heroCards'
  | 'battlesummary'
  | 'shop'
  | 'shop-cards'
  | 'shop-augments'
  | 'shop-supplies'
  | 'campaignvictory'
  | 'itemfound'
  | 'character'
  | 'replayBriefing'
  | 'dailychallenge'
  | 'endlessleaderboard'
  | 'commander'
  | 'giftAdmin'
  | 'training'
  | 'news'
  | 'newsAdmin'
  | 'campaignAdmin'
  | 'feedbackAdmin'
  | 'minigames'
  | 'playerstats'
  | 'quickbattle'
  | 'statupgrade'
  | 'camp'
  | 'codex'
  | 'memory'
  | 'characterEncounter'
  | 'augments'
  | 'player'
  | 'collection-tabs'
  | 'home-shelf'
  | 'hubworld'


const STANCE_RULES_BY_NODE_TYPE: Partial<Record<string, StanceRules>> = {
  // Normal battles: no restrictions (current behaviour)
  battle: undefined,
  // Elite: 15 s duration, 20 s cooldown — timing tactics matter
  elite: { allowed: ['auto', 'attack', 'hold', 'defend'], durationMs: 15_000, cooldownMs: 20_000 },
  // Boss: defend and auto only — must react to the boss, can't mass-charge
  boss: { allowed: ['auto', 'defend'] },
}

function formatTimeAgo(date: Date): string {
  const diffMin = Math.round((Date.now() - date.getTime()) / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.round(diffH / 24)}d ago`
}

export default function App() {
  // ── PWA auto-update ───────────────────────────────────────────────────────────
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null)
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, r) {
      swRegRef.current = r ?? null
      // Register the controllerchange listener immediately so we never race
      // with skipWaiting: the new SW may activate before onNeedRefresh fires.
      let reloading = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!reloading) { reloading = true; window.location.reload() }
      })
      // In standalone (home screen) mode the browser doesn't trigger SW update
      // checks on each launch the way a normal tab does, so we kick one off
      // immediately and then repeat every hour.
      if (r) {
        r.update().catch(() => {})
        setInterval(() => r.update().catch(() => {}), 60 * 60 * 1000)
      }
    },
    onNeedRefresh() {
      updateServiceWorker(true)
    },
  })
  useEffect(() => {
    if (needRefresh) updateServiceWorker(true)
  }, [needRefresh, updateServiceWorker])

  // ── Startup: auto-resume a pending campaign battle on page refresh ──────────
  // If the player refreshed mid-battle, pendingNodeId is still set. We build the
  // game state immediately so they land straight back in the battle.
  const [_startup] = useState(() => {
    const savedRun = loadRun()
    if (savedRun?.pendingNodeId) {
      const act  = ACTS[savedRun.actId]
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
    const savedAct = savedRun ? ACTS[savedRun.actId] : null
    if (savedRun && savedAct && isActComplete(savedAct, savedRun)) {
      return { screen: 'actcomplete' as Screen, gameState: null as GameState | null, run: savedRun, isCampaign: false }
    }
    if (isHubWorldUnlocked()) return { screen: 'hubworld' as Screen, gameState: null as GameState | null, run: savedRun as RunState | null, isCampaign: false }
    return { screen: (loadSkipIntro() ? 'title' : 'intro') as Screen, gameState: null as GameState | null, run: savedRun as RunState | null, isCampaign: false }
  })

  const [screen, setScreen]             = useState<Screen>(_startup.screen)
  const [miniGamesEntry, setMiniGamesEntry] = useState<'menu' | 'citybuilder'>('menu')
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

  // Campaign run state
  const [run, setRun]                   = useState<RunState | null>(_startup.run)
  const runRef                          = useRef<RunState | null>(_startup.run)
  const [rewardChoices,  setRewardChoices]  = useState<string[]>([])
  const [rewardCrystals, setRewardCrystals] = useState(0)
  const isCampaignRef       = useRef(_startup.isCampaign)   // true while playing a campaign battle
  const isDailyChallengeRef = useRef(false)                  // true while playing the daily challenge
  const isTrainingModeRef   = useRef(false)                  // true while playing a training battle
   const quickBattleModeRef = useRef<QuickBattleMode>('easy')                //  Quick Battle Mode 

  // Cutscenes & boss dialogue
  const [cutscenePanels, setCutscenePanels]   = useState<CutscenePanel[]>([])
  const cutsceneDoneRef     = useRef<() => void>(() => {})
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
  const [campNode, setCampNode] = useState<QuestNode | null>(null)
  const [campResult, setCampResult] = useState<string | null>(null)
  // Replay briefing state — stored so onBegin can proceed with the correct context
  const replayBriefingRef = useRef<{
    actId: string
    completionCount: number
    lastRunFailed: boolean
    proceed: (chosenCount: number) => void
  } | null>(null)
  const [foundItem, setFoundItem] = useState<Omit<import('./game/dailyLogin').UselessItem, 'acquiredDate'> | null>(null)

  // Card fatigue
  const [fatiguedCards, setFatiguedCards]       = useState<string[]>(loadFatigued)
  const [cardRestCandidates, setCardRestCandidates] = useState<string[]>([])
  const [cardRestPlayCounts, setCardRestPlayCounts] = useState<Record<string, number>>({})
  const [bonusPackCards, setBonusPackCards]     = useState<string[]>([])
  const [campaignRestingAlert, setCampaignRestingAlert] = useState(false)
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

  // Unit death tracking
  const prevPlayerUnitsRef   = useRef<Map<string, string>>(new Map())
  const prevOpponentUnitsRef = useRef<Map<string, string>>(new Map())
  // Commander HP tracking (null = not yet sampled this battle)
  const prevCommanderHpRef   = useRef<number | null>(null)

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
  const { activeRareEvent, isGamePaused: isRareEventPaused, rollRareEvent, handleRareEventDone } = useRareEvents({
    gameState, screen, setGameState, setCrystals, setAchievementToasts,
  })
  const isGamePaused = isRareEventPaused || isUserPaused

  // Keep gameStateRef in sync so callbacks can read current state without stale closures
  gameStateRef.current = gameState
  runRef.current = run

  // ── Page visibility: pause game loop when tab is hidden ──
  const [isTabHidden, setIsTabHidden] = useState(() => document.hidden)
  useEffect(() => {
    function handleVisibility() { setIsTabHidden(document.hidden) }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

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

  // Single guard for all data-dependent screens. Fires after render as a backstop
  // against programming errors — if required data is missing, log to Rollbar and
  // redirect before the user sees a broken screen. Add new screens here.
  useEffect(() => {
    const fallback = run ? 'nodemap' : 'title'
    if (screen === 'cutscene' && cutscenePanels.length === 0) {
      rollbar.error('cutscene screen reached with no panels', {
        runActId: run?.actId,
        pendingNodeId: run?.pendingNodeId,
        pendingActComplete: run?.pendingActComplete,
      })
      setScreen(fallback)
    } else if (screen === 'actcomplete' && (!run || !ACTS[run.actId])) {
      rollbar.error('actcomplete screen reached without valid run/actData', { runActId: run?.actId })
      clearRun()
      setRun(null)
      setScreen('title')
    } else if (screen === 'bossdialogue' && !bossDialogueNode?.bossDialogue) {
      rollbar.error('bossdialogue screen reached without bossDialogueNode/dialogue', { runActId: run?.actId })
      setScreen(fallback)
    } else if (screen === 'event' && (!activeEvent || !run)) {
      rollbar.error('event screen reached without activeEvent or run', { runActId: run?.actId, hasEvent: !!activeEvent })
      setScreen(fallback)
    } else if (screen === 'merchant' && merchantItems.length === 0) {
      rollbar.error('merchant screen reached with empty merchantItems', { runActId: run?.actId })
      setScreen(fallback)
    } else if (screen === 'mystery' && !mysteryReward) {
      rollbar.error('mystery screen reached without mysteryReward', { runActId: run?.actId })
      setScreen(fallback)
    } else if (screen === 'itemfound' && !foundItem) {
      rollbar.error('itemfound screen reached without foundItem', { runActId: run?.actId })
      setScreen(fallback)
    } else if (screen === 'nodemap' && (!run || !ACTS[run.actId])) {
      rollbar.error('nodemap screen reached without valid run/actData', { runActId: run?.actId })
      clearRun()
      setRun(null)
      setScreen('title')
    }
  }, [screen, cutscenePanels, run, bossDialogueNode, activeEvent, merchantItems, mysteryReward, foundItem])

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

  // Trigger SW update check whenever the title screen is shown
  useEffect(() => {
    if (screen === 'title') swRegRef.current?.update().catch(() => {})
  }, [screen])

  useMusic(screen, gameState, run)

  // ── Free play ────────────────────────────────────────────

  const launchQuickBattle = useCallback((mode: QuickBattleMode) => {
    isCampaignRef.current = false
    isDailyChallengeRef.current = false
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

  const launchEndless = useCallback(() => {
    isCampaignRef.current = false
    isDailyChallengeRef.current = false
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
    }))
    rollRareEvent()
  }, [])

  const handleDailyChallengeRetry = useCallback(() => {
    isCampaignRef.current        = false
    isDailyChallengeRef.current  = true
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
    // Training mode: send back to training setup screen
    if (isTrainingModeRef.current) {
      isTrainingModeRef.current = false
      dispatch({ type: 'END' })
      setScreen('training')
      return
    }
    isCampaignRef.current       = false
    isDailyChallengeRef.current = false
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

  const handleCampaign = useCallback(() => {
    const doLaunch = () => {
    const existing = loadRun()

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
      const act = ACTS[activeRun.actId]

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
    const actId = 'act1'
    const act = ACTS[actId]
    const completionCount = loadActCount(actId)

    const proceedWithModifiers = (chosenModifierCount: number) => {
      let activeRun = newRun(actId, chosenModifierCount)
      const earned = loadEarnedRelics()
      saveRun(activeRun)
      setRun(activeRun)

      const proceedAfterRelicSelect = (chosenRelic: string | null) => {
        rollbar.info('proceedAfterRelicSelect: relic chosen', { actId, chosenRelic, earnedCount: earned.length })
        const runWithRelic = { ...activeRun, activeRelic: chosenRelic }
        saveRun(runWithRelic)
        setRun(runWithRelic)
        const runCount = incrementRunCount()
        const introToShow = actId === 'act1'
          ? getAct1Intro(runCount)
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
              hasActData: !!(runRef.current && ACTS[runRef.current.actId]),
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

    // Show replay briefing if the player has completed this act before and it has modifiers
    const lastRunFailed = loadLastRunFailed()
    if (completionCount > 0 && getModifierMax(act) > 0) {
      replayBriefingRef.current = {
        actId,
        completionCount,
        lastRunFailed,
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

  const handleSelectNode = useCallback((node: QuestNode) => {
    const currentRun = run
    if (!currentRun) return
    const act = ACTS[currentRun.actId]

    // Mark siblings as skipped (branch choice)
    const afterSkip = skipSiblings(act, node.id, currentRun)
    const activeMods = act ? getModifiersByCount(act, currentRun.activeModifierCount) : []
    const bonusCrystals = activeMods.filter(m => m.type === 'crystalBonus').reduce((s, m) => s + m.value, 0)
    const updatedRun: RunState = { ...afterSkip, pendingNodeId: node.id, crystalBonus: bonusCrystals }
    saveRun(updatedRun)
    setRun(updatedRun)

    if (node.characterEncounter) {
      setActiveCharacterEncounter({ nodeId: node.id, characterId: node.characterEncounter })
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
    state.stanceRules = STANCE_RULES_BY_NODE_TYPE[node.type]
    startBattle(state)
    rollRareEvent()
  }, [run])

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
    const act = ACTS[run.actId]
    const mods761 = act ? getModifiersByCount(act, run.activeModifierCount) : []
    const state = newGame({ playerCards, ...resolvedNodeOpts(node, act, loadRunCount(), mods761) })
    state.playerBase = { hp: run.playerHp, maxHp: run.maxHp }
    if (run.activeRelic) getRelicDef(run.activeRelic)?.applyToGame(state)
    state.stanceRules = STANCE_RULES_BY_NODE_TYPE[node.type]
    startBattle(state)
    rollRareEvent()
  }, [bossDialogueNode, run])

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
        updatedRun = { ...updatedRun, playerHp: Math.min(updatedRun.maxHp, updatedRun.playerHp + effect.amount) }
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
    const act = ACTS[currentRun.actId]
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
  }, [run, activeCharacterEncounter])

  const handleMemoryCollect = useCallback(() => {
    const currentRun = run
    if (!currentRun || !activeMemoryFragment) { setScreen('nodemap'); return }
    const { fragment, alreadyFound } = activeMemoryFragment
    let shardBonus = false
    let updatedConsumables = currentRun.consumables
    if (!alreadyFound) {
      shardBonus = markFragmentDiscovered(fragment.id)
      if (areAllCampaignFragmentsDiscovered()) unlockHubWorld()
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
    // Mira appears after every first-time fragment discovery
    if (!alreadyFound) {
      setActiveCharacterEncounter({ nodeId: activeMemoryFragment.fragment.nodeId, characterId: 'mira' })
      setScreen('characterEncounter')
      return
    }
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
    if (!currentRun || !gameState) return
    const act = ACTS[currentRun.actId]
    const nodeId = currentRun.pendingNodeId!
    const node = act.nodes[nodeId]

    // Merge this battle's card play counts into the run totals
    const mergedCounts: Record<string, number> = { ...currentRun.cardPlayCounts }
    for (const [name, n] of Object.entries(campaignPlayCountsRef.current)) {
      mergedCounts[name] = (mergedCounts[name] ?? 0) + n
    }
    campaignPlayCountsRef.current = {}

    // Update run HP and counts from battle result
    const updatedRun: RunState = {
      ...currentRun,
      playerHp: gameState.playerBase.hp,
      completedNodeIds: [...currentRun.completedNodeIds, nodeId],
      pendingNodeId: null,
      cardPlayCounts: mergedCounts,
    }
    recordNodeComplete(updatedRun.actId, nodeId)
    saveRun(updatedRun)
    setRun(updatedRun)

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
  }, [run, gameState])

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
      if (updatedRun.playerHp >= updatedRun.maxHp) {
        updatedRun.playerHp = updatedRun.playerHp + healAmount
        resultMessage = `Already at full health — gained +${healAmount} bonus HP above your maximum!`
      } else {
        const gained = Math.min(healAmount, updatedRun.maxHp - updatedRun.playerHp)
        updatedRun.playerHp = Math.min(updatedRun.playerHp + healAmount, updatedRun.maxHp)
        resultMessage = `Healed ${gained} HP. (${currentRun.playerHp} → ${updatedRun.playerHp})`
      }
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

  const handleActComplete = useCallback(() => {
    const currentRun = run
    if (!currentRun) {
      rollbar.error('handleActComplete called with null run', { screen })
      return
    }
    const act = ACTS[currentRun.actId]
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

    const proceedFromSpin = (willBreak: boolean) => {
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

      const nextAct = getNextAct(currentRun.actId)

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
                hasActData: !!(runRef.current && ACTS[runRef.current.actId]),
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
  }, [run])


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
    const act = ACTS[currentRun.actId]
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
    state.stanceRules = STANCE_RULES_BY_NODE_TYPE[node.type]
    startBattle(state)
    rollRareEvent()
  }, [run])

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
      isDailyChallengeRef.current = false
      dispatch({ type: 'END' })
      setScreen('title')
    }
  }, [handleAbandonRun, setAchievementToasts])

  // Detect player unit deaths each tick
  useEffect(() => {
    if (!gameState || screen !== 'playing') return
    const currentMap = new Map<string, string>()
    for (const u of gameState.field) {
      if (u.owner === 'player') currentMap.set(u.id, u.name)
    }
    const fallen: string[] = []
    for (const [id, name] of prevPlayerUnitsRef.current) {
      if (!currentMap.has(id)) { recordUnitDied(name); fallen.push(name) }
    }
    prevPlayerUnitsRef.current = currentMap

    // Secret 3 — Obituary for legendary unit deaths (1-in-10 chance)
    if (fallen.length > 0) {
      const catalog = getCardCatalog()
      const EULOGIES = [
        (n: string) => `[OBITUARY] ${n} fought bravely. They will be remembered. (They won't.)`,
        (n: string) => `[OBITUARY] ${n} has fallen. A moment of silence. ...Okay, moment's over.`,
        (n: string) => `[OBITUARY] In memoriam: ${n}. Gone too soon. Probably your fault.`,
        (n: string) => `[OBITUARY] ${n} died as they lived — violently, and on the battlefield.`,
        (n: string) => `[OBITUARY] ${n} gave everything. You gave them a 3-mana slot. Tragic.`,
      ]
      const legendaryFallen = fallen.filter(name => catalog.some(c => c.name === name && c.rarity === 'legendary'))
      if (legendaryFallen.length > 0 && Math.random() < 0.1) {
        const unitName = legendaryFallen[Math.floor(Math.random() * legendaryFallen.length)]
        const eulogy = EULOGIES[Math.floor(Math.random() * EULOGIES.length)](unitName)
        const s = gameStateRef.current
        if (s) {
          dispatch({ type: 'SET_GAME_STATE', gameState: { ...s, log: [...s.log, '!!' + eulogy] } })
        }
      }
    }
  }, [gameState?.field])

  // Detect enemy unit/structure kills each tick → achievement progress
  useEffect(() => {
    if (!gameState || screen !== 'playing') return
    const currentMap = new Map<string, string>()
    for (const u of gameState.field) {
      if (u.owner === 'opponent') currentMap.set(u.id, u.name)
    }
    const newKills: string[] = []
    for (const [id, name] of prevOpponentUnitsRef.current) {
      if (!currentMap.has(id)) newKills.push(name)
    }
    prevOpponentUnitsRef.current = currentMap

    if (newKills.length > 0) {
      // Track per-unit kills
      const newToasts: AchievementDef[] = []
      for (const name of newKills) {
        const unlocked = incrementAchievementProgress(`kill:${name}`)
        newToasts.push(...unlocked)
      }
      // Track total kills
      const totalUnlocked = incrementAchievementProgress('misc:total_kills', newKills.length)
      newToasts.push(...totalUnlocked)
      // Award augment souls (1 per kill)
      incrementAugmentSouls(newKills.length)
      if (newToasts.length > 0) {
        setAchievementToasts(prev => [...prev, ...newToasts])
      }
    }
  }, [gameState?.field, screen])

  // Track flawless battle flag
  useEffect(() => {
    if (!gameState || screen !== 'playing') return
    if (gameState.playerBase.hp < gameState.playerBase.maxHp) {
      battleFlawlessRef.current = false
    }
  }, [gameState?.playerBase?.hp, screen])

  // Reset commander HP ref between battles so a new battle never false-triggers
  useEffect(() => {
    prevCommanderHpRef.current = null
  }, [screen])

  // Drop to 1x speed when the player's commander takes damage
  useEffect(() => {
    if (!gameState || screen !== 'playing') return
    let commander: (typeof gameState.field)[number] | undefined
    for (const u of gameState.field) {
      if (u.isCommander && u.owner === 'player') { commander = u; break }
    }
    const currentHp = commander?.hp ?? null
    if (prevCommanderHpRef.current !== null && currentHp !== null && currentHp < prevCommanderHpRef.current) {
      if (battle.speedMultiplier > 1) dispatch({ type: 'SET_SPEED', multiplier: 1 })
    }
    prevCommanderHpRef.current = currentHp
  }, [gameState?.field])

  // Secret 4 — Tired Game: after midnight, units occasionally yawn
  useEffect(() => {
    if (!gameState || screen !== 'playing') return
    const hour = new Date().getHours()
    if (hour < 0 || hour >= 6) return  // Only between midnight and 6am (hour 0–5)
    if (Math.random() > 0.004) return  // ~0.4% per tick — sporadic
    const playerUnits = gameState.field.filter(u => u.owner === 'player')
    if (playerUnits.length === 0) return
    const unit = playerUnits[Math.floor(Math.random() * playerUnits.length)]
    const s = gameStateRef.current
    if (!s) return
    dispatch({ type: 'SET_GAME_STATE', gameState: { ...s, log: [...s.log.slice(-9), `${unit.name} yawns loudly. It's very late.` ] } })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.gameTime])

  // Secret 5 — Time Capsule: show on 100th battle started (only once per lifecycle)
  const timeCapsuleCheckedRef = useRef(false)
  useEffect(() => {
    if (screen !== 'playing') return
    if (timeCapsuleCheckedRef.current) return
    timeCapsuleCheckedRef.current = true
    const count = incrementBattleCount()
    if (count > 0 && count % 100 === 0) setTimeCapsuleVisible(true)
  }, [screen])

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
    packBackScreenRef.current = 'title'
    let pack: string[]

    switch(quickBattleModeRef.current) {
      case 'easy':
        pack = [...new Set(generatePack())].slice(0, 2)
        break
      case 'normal':
      case 'mirror':
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

  const handleBuyCrystalPack = useCallback((qty: number = 1) => {
    const current = loadCrystals()
    const totalCost = CRYSTAL_PACK_COST * qty
    if (current < totalCost) return
    const next = current - totalCost
    saveCrystals(next)
    setCrystals(next)
    packBackScreenRef.current = 'shop'
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
    const wasInCampaign = isCampaignRef.current
    isCampaignRef.current = false
    isDailyChallengeRef.current = false
    const currentRun = run

    const isLoss = gameState?.phase.type === 'gameOver' && gameState.phase.winner !== 'player'
    if (currentRun && isLoss) {
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
      setScreen('title')
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
    setScreen('title')
    dispatch({ type: 'END' })
  }, [run, gameState])

  // ── Game over routing ────────────────────────────────────

  const isCampaign = isCampaignRef.current

  const handleGameOverPrimary = useCallback(() => {
    if (!gameState || gameState.phase.type !== 'gameOver') return
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

  const actData = run ? ACTS[run.actId] ?? null : null
  const actTheme = run?.actId

  return (
    <div className="game-container">
      <div className="game-title">JARV'S AMAZING WEB GAME</div>

      {/* Event card reveal overlay */}
      {pendingEventCard && (() => {
        const catalog = getCardCatalog()
        const card = catalog.find(c => c.name === pendingEventCard)
        if (!card) { setPendingEventCard(null); return null }
        return (
          <div className="event-card-reveal-backdrop u-col u-items-c u-just-c u-gap-8" onClick={() => { setPendingEventCard(null); setScreen('nodemap') }}>
            <div className="event-card-reveal-label">YOU GAINED A CARD</div>
            <CardTile card={card} canAfford={true} />
            <div className="event-card-reveal-sub">Click anywhere to continue</div>
          </div>
        )
      })()}

      {screen === 'intro' && (
        <IntroScreen onDone={() => setScreen('title')} />
      )}

      {screen === 'title' && (
        <>
          <TitleScreen
            crystals={crystals}
            onPlay={() => setScreen('quickbattle')}
            onEndless={handleEndless}
            onCampaign={handleCampaign}
            onCollection={() => setScreen('collection-tabs')}
            onShop={() => setScreen('shop')}
            onDeckBuilder={() => setScreen('deckbuilder')}
            onSettings={() => setScreen('settings')}
            onPlayer={() => setScreen('player')}
            on8bitUnlocked={() => { /* achievement granted in TitleScreen after unlock */ }}
            onDailyChallenge={handleDailyChallenge}
            onEndlessLeaderboard={handleEndlessLeaderboard}
            onCommander={commander ? () => setScreen('commander') : undefined}
            commanderName={commander?.cardName ?? null}
            onTraining={() => setScreen('training')}
            onNews={() => setScreen('news')}
            hasUnreadNews={newsUnreadCount > 0}
            onMiniGames={() => setScreen('minigames')}
            onCityBuilder={() => { setMiniGamesEntry('citybuilder'); setScreen('minigames') }}
            onCodex={() => setScreen('codex')}
            user={user}
            onSignOut={() => { import('firebase/auth').then(({ signOut }) => signOut(auth)) }}
            onSignIn={() => setShowTitleLoginModal(true)}
            onFeedback={() => setFeedbackOpen(true)}
          />
          {feedbackOpen && (
            <FeedbackModal user={user} onClose={() => setFeedbackOpen(false)} />
          )}
          {showTitleLoginModal && (
            <LoginModal
              user={user}
              authLoading={authLoading}
              onClose={() => setShowTitleLoginModal(false)}
              onLoginSuccess={() => { setShowTitleLoginModal(false) }}
            />
          )}
        </>
      )}

      {screen === 'settings' && (
        <SettingsScreen
          onBack={() => setScreen('title')}
          onResetGame={handleResetGame}
          user={user}
          authLoading={authLoading}
          onDevCrystalsChanged={n => setCrystals(n)}
          onDevHandicapChanged={n => {
            setHandicap(n)
            try { localStorage.setItem(HANDICAP_KEY, String(n)) } catch { /* ignore */ }
          }}
          onGiftAdmin={() => setScreen('giftAdmin')}
          onNewsAdmin={() => setScreen('newsAdmin')}
          onCampaignAdmin={() => setScreen('campaignAdmin')}
          onFeedbackAdmin={() => setScreen('feedbackAdmin')}
          onHubWorld={() => setScreen('hubworld')}
          onTitleScreen={() => setScreen('title')}
        />
      )}

      {screen === 'hubworld' && (
        <HubWorld
          onBack={() => setScreen('settings')}
          onNavigate={(s) => setScreen(s as Screen)}
        />
      )}

      {screen === 'giftAdmin' && (
        <GiftAdminScreen onBack={() => setScreen('settings')} />
      )}

      {screen === 'news' && (
        <NewsScreen onBack={() => { setNewsUnreadCount(0); setScreen('title') }} />
      )}

      {screen === 'newsAdmin' && (
        <NewsAdminScreen onBack={() => setScreen('settings')} />
      )}

      {screen === 'campaignAdmin' && (
        <CampaignAdminScreen onBack={() => setScreen('settings')} />
      )}

      {screen === 'feedbackAdmin' && (
        <FeedbackAdminScreen onBack={() => setScreen('settings')} />
      )}

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
          nodeType={run ? ACTS[run.actId].nodes[run.completedNodeIds[run.completedNodeIds.length - 1]]?.type ?? 'battle' : 'battle'}
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
          hasNextAct={!!getNextAct(actData.id)}
        />
      )}

      {screen === 'cutscene' && cutscenePanels.length > 0 && (
        <CutsceneScreen panels={cutscenePanels} onDone={() => {
          rollbar.info('CutsceneScreen.onDone fired', { panelCount: cutscenePanels.length, runActId: run?.actId })
          cutsceneDoneRef.current()
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

      {deckWarningNode && (() => {
        const allEntries   = loadDeck()
        const fat          = loadFatigued()
        const restingCount = allEntries.filter(e => fat.includes(e.cardName)).length
        const totalCards   = deckTotalCards(allEntries)
        const isUnderMax   = totalCards < DECK_MAX
        const parts: string[] = []
        if (restingCount > 0)
          parts.push(`${restingCount} resting card${restingCount !== 1 ? 's' : ''} won't be available in battle`)
        if (isUnderMax)
          parts.push(`Your deck has only ${totalCards} of ${DECK_MAX} cards. Consider adding more cards in the Deck Builder for more consistency.`)
        return (
          <ConfirmModal
            title="Weak Deck"
            body={parts.join(' · ')}
            confirmLabel="Enter Battle"
            onConfirm={() => {
              const node = deckWarningNode
              setDeckWarningNode(null)
              skipDeckWarningRef.current = true
              handleSelectNode(node)
            }}
            onCancel={() => setDeckWarningNode(null)}
          />
        )
      })()}

      {campaignRestingAlert && (
        <ConfirmModal
          title="Deck Notice"
          body="Your deck may contain resting cards. They will not be available during campaign battles."
          confirmLabel="OK"
          onConfirm={() => setCampaignRestingAlert(false)}
          onCancel={() => setCampaignRestingAlert(false)}
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
        const { actId, completionCount, lastRunFailed, proceed } = replayBriefingRef.current!
        const act = ACTS[actId]
        return (
          <ReplayBriefingScreen
            act={act}
            completionCount={completionCount}
            lastRunFailed={lastRunFailed}
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

      {screen === 'player' && (
        <PlayerScreen
          crystals={crystals}
          onCrystalsChanged={handleCrystalsChanged}
          onBack={() => setScreen('title')}
        />
      )}

      {screen === 'collection-tabs' && (
        <CollectionTabScreen
          crystals={crystals}
          onCrystalsChanged={handleCrystalsChanged}
          onBack={() => setScreen('title')}
          commanderName={commander?.cardName ?? null}
          onPromoteCommander={(cardName) => {
            const ok = promoteCommander(cardName)
            if (ok) {
              setCommander(loadCommander())
              setScreen('commander')
            }
          }}
        />
      )}

      {screen === 'collection' && (
        <CollectionScreen
          crystals={crystals}
          onCrystalsChanged={handleCrystalsChanged}
          onBack={() => setScreen('title')}
          commanderName={commander?.cardName ?? null}
          onViewAugments={() => setScreen('augments')}
          onPromoteCommander={(cardName) => {
            const ok = promoteCommander(cardName)
            if (ok) {
              setCommander(loadCommander())
              setScreen('commander')
            }
          }}
        />
      )}

      {screen === 'augments' && (
        <AugmentCollectionScreen onBack={() => setScreen('collection')} />
      )}

      {screen === 'shop' && (
        <ShopScreen
          crystals={crystals}
          onBuyCrystalPack={handleBuyCrystalPack}
          onCrystalsChange={(n: number) => { saveCrystals(n); setCrystals(n) }}
          onBack={() => setScreen('title')}
        />
      )}

      {screen === 'shop-cards' && (
        <ShopScreen
          category="cards"
          crystals={crystals}
          onBuyCrystalPack={handleBuyCrystalPack}
          onCrystalsChange={(n: number) => { saveCrystals(n); setCrystals(n) }}
          onBack={() => setScreen('hubworld')}
        />
      )}

      {screen === 'shop-augments' && (
        <ShopScreen
          category="augments"
          crystals={crystals}
          onBuyCrystalPack={handleBuyCrystalPack}
          onCrystalsChange={(n: number) => { saveCrystals(n); setCrystals(n) }}
          onBack={() => setScreen('hubworld')}
        />
      )}

      {screen === 'shop-supplies' && (
        <ShopScreen
          category="supplies"
          crystals={crystals}
          onBuyCrystalPack={handleBuyCrystalPack}
          onCrystalsChange={(n: number) => { saveCrystals(n); setCrystals(n) }}
          onBack={() => setScreen('hubworld')}
        />
      )}

      {screen === 'deckbuilder' && (
        <DeckBuilder onBack={() => setScreen('title')} fatiguedCards={run ? fatiguedCards : []}/>
      )}

      {screen === 'pack' && (
        <PackOpening packs={packs} onDone={handlePackDone} />
      )}

      {screen === 'inventory' && (
        <InventoryScreen
          onBack={() => setScreen('title')}
          onCrystalsChanged={handleCrystalsChanged}
        />
      )}

      {screen === 'achievements' && (
        <AchievementsScreen
          onBack={() => setScreen('title')}
          onCrystalsChanged={handleCrystalsChanged}
        />
      )}

      {screen === 'hall-of-achievements' && (
        <HallOfAchievements
          onBack={() => setScreen('hubworld')}
          onCrystalsChanged={handleCrystalsChanged}
        />
      )}

      {screen === 'home-shelf' && (
        <HomeShelf onBack={() => setScreen('hubworld')} />
      )}

      {screen === 'heroCards' && (
        <HeroCardsScreen onBack={() => setScreen('title')} />
      )}

      {screen === 'codex' && (
        <CodexScreen onDone={() => setScreen('title')} />
      )}

      {screen === 'campaignvictory' && (
        <CampaignVictoryScreen onBeginAnew={() => setScreen('statupgrade')} />
      )}

      {screen === 'statupgrade' && (
        <StatUpgradeScreen onSelect={(stat) => {
          applyStatUpgrade(stat)
          const bonus = crystals + 500; saveCrystals(bonus); setCrystals(bonus)
          clearRun(); setRun(null); clearFatigued(); setFatiguedCards([]); setBonusPackCards([])
          setScreen('starterpack')
        }} />
      )}

      {screen === 'playerstats' && (
        <PlayerStatsScreen onBack={() => setScreen('title')} />
      )}

      {screen === 'campaignfailed' && (
        <CampaignFailedScreen onReturnToMenu={() => { stopBattleMusic(); stopGameOverMusic(); setScreen('title') }} />
      )}

      {screen === 'quickbattle' && (
        <QuickBattleScreen onStartBattle={handlePlay} onBack={() => setScreen('title')} />
      )}

      {screen === 'dailychallenge' && (
        <DailyChallengeScreen onStart={handleStartDailyChallenge} onBack={() => setScreen('title')} />
      )}

      {screen === 'endlessleaderboard' && (
        <EndlessLeaderboardScreen onBack={() => setScreen('title')} />
      )}

      {screen === 'commander' && commander && (
        <CommanderScreen
          commander={commander}
          onBack={() => { setCommander(loadCommander()); setScreen('title') }}
          onRewardXp={(cardName, amount) => {
            const col = loadCollection()
            const updated = col.map(e =>
              e.cardName === cardName ? { ...e, masteryXp: (e.masteryXp ?? 0) + amount } : e
            )
            saveCollection(updated)
          }}
          onRewardCrystals={(amount) => {
            const next = crystals + amount
            saveCrystals(next)
            setCrystals(next)
          }}
          onRewardCard={() => {
            const catalog = getCardCatalog()
            const picks = catalog.filter(c => c.unit && c.unit.moveSpeed > 0)
            const card = picks[Math.floor(Math.random() * picks.length)]
            if (card) addCardsToCollection([{ cardName: card.name, count: 1 }])
          }}
          onRewardPack={() => {
            const newPack = generatePack()
            addCardsToCollection(newPack.map(name => ({ cardName: name, count: 1 })))
          }}
          onCommanderChanged={(state) => {
            setCommander(state)
            if (!state) setScreen('title')
          }}
        />
      )}

      {screen === 'training' && (
        <TrainingScreen
          onBack={() => setScreen('title')}
          onStart={handleStartTraining}
        />
      )}

      {screen === 'minigames' && (
        <MiniGamesMenu
          crystals={crystals}
          onCrystalsChange={(n) => { saveCrystals(n); setCrystals(n) }}
          user={user}
          characterName={loadPlayerName()}
          onBack={() => { setMiniGamesEntry('menu'); setScreen('title') }}
          initialSubScreen={miniGamesEntry}
        />
      )}

      {relicSpinData && (
        <RelicSpinScreen
          relicName={relicSpinData.relicName}
          relicIcon={relicSpinData.relicIcon}
          breaks={relicSpinData.breaks}
          brokenName={relicSpinData.brokenName}
          brokenIcon={relicSpinData.brokenIcon}
          brokenDesc={relicSpinData.brokenDesc}
          onContinue={relicSpinData.onContinue}
        />
      )}

      {/* Integrity warning */}
      {integrityWarning && (
        <div className="integrity-warning" role="alert">
          <span>⚠ Inventory data was modified externally. Play nice!</span>
          <button className="integrity-warning-dismiss" onClick={() => setIntegrityWarning(false)}>✕</button>
        </div>
      )}

      {/* Achievement unlock toast */}
      {achievementToasts.length > 0 && (
        <div className="ach-toast-stack">
          {achievementToasts.slice(0, 3).map((def, i) => (
            <div key={`${def.id}-${i}`} className="ach-toast" onClick={() => setAchievementToasts(prev => prev.filter((_, j) => j !== i))}>
              🏆 <strong>{def.name}</strong>
              <span className="ach-toast-sub">Achievement unlocked!</span>
            </div>
          ))}
        </div>
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
              <Battlefield state={gameState} onPlayCard={handlePlayCard} onPlayAoeCard={handlePlayAoeCard} onGiveUp={handleGiveUp} onPause={setIsUserPaused} actTheme={actTheme} activeRelic={run?.activeRelic} showBossSplash={false} activeModifiers={run ? getModifiersByCount(ACTS[run.actId], run.activeModifierCount) : []} isCampaign={isCampaign} stance={gameState.playerStance ?? 'auto'} onSetStance={handleSetStance} speedMultiplier={speedMultiplier} onCycleSpeed={handleCycleSpeed} />
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
              <Battlefield state={gameState} onPlayCard={handlePlayCard} onPlayAoeCard={handlePlayAoeCard} onGiveUp={handleGiveUp} onPause={setIsUserPaused} actTheme={actTheme} activeRelic={run?.activeRelic} showBossSplash={showBossSplash} activeModifiers={run ? getModifiersByCount(ACTS[run.actId], run.activeModifierCount) : []} isCampaign={isCampaign} stance={gameState.playerStance ?? 'auto'} onSetStance={handleSetStance} speedMultiplier={speedMultiplier} onCycleSpeed={handleCycleSpeed} />
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
            onOpenPack={!isCampaignRef.current && gameState.phase.winner === 'player' ? handleOpenPack : undefined}
            onPlayAgain={isCampaignRef.current
              ? (gameState.phase.winner === 'player' ? handleCampaignWin : handleCampaignRetry)
              : isDailyChallengeRef.current
                ? handleDailyChallengeRetry
                : handlePlayAgain
            }
            onMainMenu={handleMainMenu}
            campaignAbandon={isCampaignRef.current ? handleAbandonRun : undefined}
            quickPlayHint={quickPlayHint}
            showStreak={!isCampaignRef.current && !isDailyChallengeRef.current}
            dailyChallengeState={isDailyChallengeRef.current ? dcGameOverState : undefined}
          />
        ) : (
          <>
            <Battlefield state={gameState} onPlayCard={handlePlayCard} onPlayAoeCard={handlePlayAoeCard} onGiveUp={handleGiveUp} onPause={setIsUserPaused} actTheme={actTheme} activeRelic={run?.activeRelic} showBossSplash={showBossSplash} activeModifiers={run ? getModifiersByCount(ACTS[run.actId], run.activeModifierCount) : []} isCampaign={isCampaign} stance={gameState.playerStance ?? 'auto'} onSetStance={handleSetStance} speedMultiplier={speedMultiplier} onCycleSpeed={handleCycleSpeed} />
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

      {/* Cloud sync prompt — shown when a newer remote save is detected on title screen */}
      {syncPrompt && (
        <div className="sync-prompt-backdrop">
          <div className="sync-prompt-modal">
            <div className="sync-prompt-header">☁ CLOUD SAVE FOUND</div>
            <div className="sync-prompt-sub">
              A newer save was detected on the server<br />
              ({formatTimeAgo(syncPrompt.remoteDate)})
            </div>
            <div className="sync-prompt-question">Which save would you like to keep?</div>
            <div className="sync-prompt-buttons u-col u-gap-4">
              <button className="action-btn" onClick={() => {
                applySave(syncPrompt.data)
                clearSyncPrompt()
                window.location.reload()
              }}>
                ☁ LOAD REMOTE
              </button>
              <button className="action-btn action-btn--dim" onClick={() => {
                clearSyncPrompt()
                const uid = user?.uid
                if (uid && !user?.isAnonymous) { flushPlaytimeToStorage(); uploadSave(uid).catch(() => {}) }
              }}>
                💾 KEEP LOCAL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Developer gift modal — shown when unclaimed gifts exist in gifts.json */}
      {pendingGifts.length > 0 && !dailyReward && (
        <GiftClaimModal
          gifts={pendingGifts}
          onClaim={() => {
            let crystalsDelta = 0
            for (const gift of pendingGifts) {
              crystalsDelta += applyGiftRewards(gift)
            }
            if (crystalsDelta > 0) setCrystals(c => c + crystalsDelta)
            setPendingGifts([])
          }}
        />
      )}

      {/* Secret 10 — Wins Milestone Celebration */}
      {showWinCelebration && (() => {
        const isGrand = celebrationMilestone % 1000 === 0
        const isMajor = !isGrand && celebrationMilestone % 500 === 0
        const tier = isGrand ? 'grand' : isMajor ? 'major' : 'standard'
        const confettiCount = isGrand ? 60 : isMajor ? 45 : 30
        const crystalBonus = isGrand ? 100 : isMajor ? 50 : 0
        const legendaryCount = isGrand ? 2 : 1
        const modalClass = `win-celebration-modal${isGrand ? ' win-celebration-modal--grand' : isMajor ? ' win-celebration-modal--major' : ''}`
        return (
          <div className="win-celebration-backdrop">
            <div className={modalClass}>
              <div className="win-celebration-confetti" aria-hidden="true">
                {Array.from({ length: confettiCount }, (_, i) => (
                  <span key={i} className="confetti-char" style={{ '--i': i } as React.CSSProperties}>
                    {['★', '✦', '◆', '▲', '●', '✿'][i % 6]}
                  </span>
                ))}
              </div>
              <div className="win-celebration-header">
                🎉 {celebrationMilestone.toLocaleString()} VICTORIES! 🎉
              </div>
              <div className="win-celebration-body">
                {isGrand ? (
                  <>
                    <p>{celebrationMilestone.toLocaleString()} battles won. A true legend.</p>
                    <p>The world bows. History remembers.</p>
                    <p>You have earned {legendaryCount} legendary cards and {crystalBonus} 💎.</p>
                  </>
                ) : isMajor ? (
                  <>
                    <p>{celebrationMilestone.toLocaleString()} battles won. An epic achievement.</p>
                    <p>The enemy despairs. The chronicles take note.</p>
                    <p>You have earned a legendary card and {crystalBonus} 💎.</p>
                  </>
                ) : (
                  <>
                    <p>{celebrationMilestone.toLocaleString()} battles won.</p>
                    <p>The enemy trembles. The game developers are impressed.</p>
                    <p>You have earned a legendary card.</p>
                  </>
                )}
              </div>
              <button className="action-btn" onClick={() => {
                const pool = getCardCatalog().filter(c => c.rarity === 'legendary')
                if (pool.length > 0) {
                  const picks = Array.from({ length: legendaryCount }, () =>
                    ({ cardName: pool[Math.floor(Math.random() * pool.length)].name, count: 1 })
                  )
                  addCardsToCollection(picks)
                }
                if (crystalBonus > 0) {
                  const next = loadCrystals() + crystalBonus
                  saveCrystals(next)
                  setCrystals(next)
                }
                setShowWinCelebration(false)
              }}>
                {tier === 'grand' ? 'CLAIM GRAND REWARD' : tier === 'major' ? 'CLAIM EPIC REWARD' : 'CLAIM REWARD'}
              </button>
            </div>
          </div>
        )
      })()}

      {streakBrokenData && (
        <StreakBrokenModal
          streak={streakBrokenData.streak}
          bestStreak={streakBrokenData.bestStreak}
          onClose={() => setStreakBrokenData(null)}
        />
      )}

      {/* Secret 5 — Time Capsule: 100th battle milestone overlay */}
      {timeCapsuleVisible && (
        <div className="time-capsule-backdrop">
          <div className="time-capsule-modal">
            <div className="time-capsule-header">📦 TIME CAPSULE OPENED</div>
            <div className="time-capsule-body">
              <p>You've started your <strong>100th battle</strong>.</p>
              <p>Somewhere, a developer is crying tears of joy.</p>
              <p>You have been awarded a commemorative pack.</p>
            </div>
            <button className="action-btn" onClick={() => {
              const pack = generatePack()
              addCardsToCollection(pack.map(n => ({ cardName: n, count: 1 })))
              incrementAchievementProgress('misc:battle_100')
              setTimeCapsuleVisible(false)
            }}>
              CLAIM REWARD
            </button>
          </div>
        </div>
      )}

      {/* Deck selector — shown before quick battle / endless when Deck B has content */}
      {pendingBattleFn && (
        <DeckSelectorModal
          fatiguedCards={pendingBattleIsCampaign ? fatiguedCards : []}
          onConfirm={() => {
            const fn = pendingBattleFn
            setPendingBattleFn(null)
            fn()
          }}
          onCancel={() => setPendingBattleFn(null)}
        />
      )}

      {/* Daily login reward modal — shown as overlay on first visit each day */}
      {dailyReward && (
        <DailyLoginModal
          reward={dailyReward}
          onClose={() => {
            // Mark claimed and grant the reward only when user taps CLAIM
            markDailyRewardClaimed()
            const catalog = getCardCatalog()
            if (dailyReward.type === 'crystals' && dailyReward.amount) {
              const next = loadCrystals() + dailyReward.amount
              saveCrystals(next)
              setCrystals(next)
            } else if (dailyReward.type === 'card' && dailyReward.cardName) {
              addCardsToCollection([{ cardName: dailyReward.cardName, count: 1 }])
            } else if (dailyReward.type === 'pack') {
              const n = dailyReward.count ?? 5
              const names = Array.from({ length: n }, () => catalog[Math.floor(Math.random() * catalog.length)].name)
              addCardsToCollection(names.map(name => ({ cardName: name, count: 1 })))
            } else if (dailyReward.type === 'item') {
              addToInventory(dailyReward)
            } else if (dailyReward.type === 'consumable' && dailyReward.consumableId) {
              addToConsumableStash(dailyReward.consumableId)
            } else {
              // Fallback: grant 10 crystals for unrecognised reward types
              const next = loadCrystals() + 10
              saveCrystals(next)
              setCrystals(next)
            }
            setDailyReward(null)
          }}
        />
      )}
    </div>
  )
}
