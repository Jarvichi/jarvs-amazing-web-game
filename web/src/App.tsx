import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { GameState } from './game/types'
import { newGame, NewGameOptions, playCard, tick, MAX_HANDICAP } from './game/engine'
import {
  loadDeck, saveDeck, buildDeckCards, generatePack,
  loadCollection, saveCollection, loadCrystals, saveCrystals,
  recordCardPlayed, recordUnitDied, addCardsToCollection,
  getOwnedCount, DECK_MAX, CRYSTAL_PACK_COST, DeckEntry,
  deckTotalCards, STARTER_DECK,
  loadWinStreak, incrementWinStreak, resetWinStreak,
} from './game/collection'
import { getCardCatalog } from './game/cards'
import {
  loadRun, saveRun, clearRun, newRun, LIVES_START, LIVES_MAX,
  getAvailableNodeIds, skipSiblings, isActComplete,
  generateRewardChoices, generateMerchantCards, MERCHANT_PRICES, ACTS, getNextAct,
  loadFatigued, saveFatigued, clearFatigued, getTopPlayedCards,
  hasSeenIntro, markIntroSeen,
  loadRunCount, incrementRunCount, getAct1Intro,
  generateEventFromConfig, EventChoice, EventData,
  CutscenePanel, QuestNode, RunState, Act, ReplayModifier,
  getActiveModifiers, loadActCount, incrementActCount,
  recordNodeComplete, loadPlayerName, applyPlayerName,
} from './game/questline'
import { CardRestSelect }       from './components/CardRestSelect'
import { EventScreen }          from './components/EventScreen'
import { MerchantScreen, MerchantItem, cardMerchantItem } from './components/MerchantScreen'
import { MysteryScreen } from './components/MysteryScreen'
import { ItemFoundScreen }    from './components/ItemFoundScreen'
import { CharacterScreen }    from './components/CharacterScreen'
import { CutsceneScreen }       from './components/CutsceneScreen'
import { BossDialogueScreen }   from './components/BossDialogueScreen'
import { Battlefield }        from './components/Battlefield'
import { GameOver }           from './components/GameOver'
import { TitleScreen }        from './components/TitleScreen'
import { CollectionScreen }   from './components/CollectionScreen'
import { DeckBuilder }        from './components/DeckBuilder'
import { PackOpening }        from './components/PackOpening'
import { NodeMap }            from './components/NodeMap'
import { PostBattleReward }   from './components/PostBattleReward'
import { ActComplete }        from './components/ActComplete'
import { RelicSelectScreen }  from './components/RelicSelectScreen'
import { StarterPackSelect }  from './components/StarterPackSelect'
import { SettingsScreen, applyTextSettings, loadSkipIntro, load8bitEnabled, apply8bitMode } from './components/SettingsScreen'
import { IntroScreen } from './components/IntroScreen'
import { FakeCrashEvent }     from './components/rare-events/FakeCrashEvent'
import { BlackjackEvent }     from './components/rare-events/BlackjackEvent'
import { WrongNumberEvent }   from './components/rare-events/WrongNumberEvent'
import { NarratorEvent }      from './components/rare-events/NarratorEvent'
import { LiarsDiceEvent }     from './components/rare-events/LiarsDiceEvent'
import { GamblerEvent }       from './components/rare-events/GamblerEvent'
import { CardTile }           from './components/CardTile'
import { DailyLoginModal }   from './components/DailyLoginModal'
import { InventoryScreen }   from './components/InventoryScreen'
import { peekDailyReward, markDailyRewardClaimed, addToInventory, computeReward, loadInventory, RewardDef, ALL_ITEMS } from './game/dailyLogin'
import { getRelicDef, addEarnedRelic, removeEarnedRelic, loadEarnedRelics, addBrokenRelic } from './game/relics'
import { playCardPlay, playButtonClick, playBattleEvent, playCardFlip, playRestHeal, stopBattleMusic, stopGameOverMusic } from './game/sound'
import { useMusic } from './hooks/useMusic'
import { useRareEvents } from './hooks/useRareEvents'
import { useAchievements } from './hooks/useAchievements'
import { isNoDamageMode } from './game/debug'
import { saveBattleState, loadBattleState, clearBattleState } from './game/battleState'
import {
  incrementAchievementProgress, setAchievementProgress, AchievementDef,
} from './game/achievements'
import { AchievementsScreen } from './components/AchievementsScreen'
import { HeroCardsScreen }   from './components/HeroCardsScreen'
import { ShopScreen }        from './components/ShopScreen'
import { BattleSummary }    from './components/BattleSummary'
import { RelicSpinScreen }  from './components/RelicSpinScreen'
import { CampaignVictoryScreen } from './components/CampaignVictoryScreen'
import { CampaignFailedScreen }  from './components/CampaignFailedScreen'
import './styles.css'
import brokenRelicsData from './data/broken-relics.json'
import rollbar, { updateRollbarPerson } from './rollbar'

// Apply saved display settings on load
applyTextSettings()
apply8bitMode(load8bitEnabled())

const TICK_MS    = 100
const HANDICAP_KEY = 'jarvs_handicap'

const BROKEN_RELIC_ITEMS: Record<string, { name: string; icon: string; desc: string }> =
  Object.fromEntries((brokenRelicsData as { relicName: string; name: string; icon: string; desc: string }[])
    .map(r => [r.relicName, { name: r.name, icon: r.icon, desc: r.desc }]))

// ─── Campaign difficulty scaling ─────────────────────────────────────────────
//
// Each run past the first the opponent gets tougher:
//   - handicap reduced by 2 per run (AI draws better cards / acts faster)
//   - base HP raised by 10 per run (opponent has more staying power)
//
// Example: a node with handicap=7 and default HP 82
//   run 1 → handicap 7, HP 82
//   run 2 → handicap 5, HP 92
//   run 3 → handicap 3, HP 102
//   run 4 → handicap 1, HP 112
//   run 5+ → handicap 0, HP 122+

function resolvedNodeOpts(
  node: QuestNode,
  act: Act | undefined,
  runCount: number,
  modifiers: ReplayModifier[],
): Omit<NewGameOptions, 'playerCards'> {
  const extra = Math.max(0, runCount - 1)
  const handicapReduction = Math.min(extra * 2, MAX_HANDICAP)

  // Stack modifier values
  let hpPctBonus = 0
  let intervalReduction = 0
  let handBonus = 0
  for (const m of modifiers) {
    if (m.type === 'enemyHpPercent') hpPctBonus += m.value
    if (m.type === 'enemyIntervalReduction') intervalReduction += m.value
    if (m.type === 'enemyHandBonus') handBonus += m.value
  }

  const adjustedHandicap = Math.max(0, (node.handicap ?? 0) - handicapReduction)
  // Boss default HP is 95; non-boss 82 (mirrors engine.ts defaults)
  const defaultHp = node.bossAI ? 95 : 82
  const baseHp = node.opponentBaseHp ?? defaultHp
  const adjustedHp = Math.round(baseHp * (1 + hpPctBonus / 100))

  // When a modifier reduces interval, fall back to 4000ms base if node didn't specify one
  const baseInterval = node.opponentIntervalMs ?? (intervalReduction > 0 ? 4000 : undefined)
  const adjustedInterval = baseInterval !== undefined
    ? Math.max(1000, baseInterval - intervalReduction)
    : undefined

  return {
    opponentHandicap: adjustedHandicap,
    bossAI: node.bossAI,
    bossCard: node.bossCard,
    bossName: node.bossName,
    bossHpMultiplier: node.bossHpMultiplier,
    enemyDeckNames: node.enemyDeck,
    terrainSeed: node.id,
    environment: node.environment ?? act?.environment,
    opponentIntervalMs: adjustedInterval,
    opponentBaseHp: adjustedHp,
    opponentStartCards: handBonus,
  }
}

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
  return items
}

function loadHandicap(): number {
  try {
    const v = localStorage.getItem(HANDICAP_KEY)
    if (v !== null) return Math.min(MAX_HANDICAP, Math.max(0, parseInt(v, 10)))
  } catch { /* ignore */ }
  return 0
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
  | 'campaignfailed'
  | 'heroCards'
  | 'battlesummary'
  | 'shop'
  | 'campaignvictory'
  | 'itemfound'
  | 'character'


export default function App() {
  // ── PWA auto-update ───────────────────────────────────────────────────────────
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null)
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, r) { swRegRef.current = r ?? null },
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
        const savedBattle = loadBattleState()
        if (savedBattle) {
          incrementAchievementProgress('misc:refresh_cheat')
          return { screen: 'playing' as Screen, gameState: savedBattle, run: savedRun, isCampaign: true }
        }
        const collection  = loadCollection()
        const fatigued    = loadFatigued()
        const deckEntries = loadDeck().filter(e => !fatigued.includes(e.cardName))
        const playerCards = buildDeckCards(deckEntries, collection)
        const earnedEntries = (savedRun.earnedCards ?? []).map(n => ({ cardName: n, count: 1 }))
        if (earnedEntries.length > 0) playerCards.push(...buildDeckCards(earnedEntries, collection))
        const mods = act ? getActiveModifiers(act, loadActCount(savedRun.actId)) : []
        const state = newGame({ playerCards, ...resolvedNodeOpts(node, act, loadRunCount(), mods) })
        state.playerBase = { hp: savedRun.playerHp, maxHp: savedRun.maxHp }
        if (savedRun.activeRelic) getRelicDef(savedRun.activeRelic)?.applyToGame(state)
        return { screen: 'playing' as Screen, gameState: state as GameState | null, run: savedRun, isCampaign: true }
      }
    }
    // If the player refreshed while on the act-complete screen, restore it directly.
    if (savedRun?.pendingActComplete) {
      return { screen: 'actcomplete' as Screen, gameState: null as GameState | null, run: savedRun, isCampaign: false }
    }
    // If the act is complete but pendingActComplete was cleared (e.g. player exited during
    // relic select after our #328 fix), also restore to actcomplete.
    const savedAct = savedRun ? ACTS[savedRun.actId] : null
    if (savedRun && savedAct && isActComplete(savedAct, savedRun)) {
      return { screen: 'actcomplete' as Screen, gameState: null as GameState | null, run: savedRun, isCampaign: false }
    }
    return { screen: (loadSkipIntro() ? 'title' : 'intro') as Screen, gameState: null as GameState | null, run: savedRun as RunState | null, isCampaign: false }
  })

  const [screen, setScreen]       = useState<Screen>(_startup.screen)
  const [gameState, setGameState] = useState<GameState | null>(_startup.gameState)
  const [pack, setPack]           = useState<string[]>([])
  const [handicap, setHandicap]   = useState<number>(loadHandicap)
  const [crystals, setCrystals]   = useState<number>(loadCrystals)

  // Campaign run state
  const [run, setRun]                   = useState<RunState | null>(_startup.run)
  const [rewardChoices,  setRewardChoices]  = useState<string[]>([])
  const [rewardCrystals, setRewardCrystals] = useState(0)
  const isCampaignRef = useRef(_startup.isCampaign)   // true while playing a campaign battle

  // Cutscenes & boss dialogue
  const [cutscenePanels, setCutscenePanels]   = useState<CutscenePanel[]>([])
  const cutsceneDoneRef     = useRef<() => void>(() => {})
  const summaryDoneRef      = useRef<() => void>(() => {})
  const [summaryStats, setSummaryStats] = useState<{
    stats: import('./game/types').BattleStats
    gameTime: number
    playerScore: number
  } | null>(null)
  const relicSelectDoneRef  = useRef<(relicName: string | null) => void>(() => {})
  const brokenRelicRef      = useRef<{ name: string; icon: string } | null>(null)
  const [relicSpinData, setRelicSpinData] = useState<{ relicName: string; relicIcon: string; breaks: boolean; brokenName?: string; brokenIcon?: string; brokenDesc?: string; onContinue: () => void } | null>(null)
  const [bossDialogueNode, setBossDialogueNode] = useState<QuestNode | null>(null)
  const [showBossSplash, setShowBossSplash] = useState(false)
  const prevBossCardActiveRef = useRef(false)

  // Active campaign event
  const [activeEvent, setActiveEvent] = useState<EventData | null>(null)
  // Card revealed after a gainCard event choice
  const [pendingEventCard, setPendingEventCard] = useState<string | null>(null)

  // Active merchant
  const [merchantItems, setMerchantItems] = useState<MerchantItem[]>([])
  const merchantBoughtRef = useRef(0)
  const [mysteryReward, setMysteryReward] = useState<RewardDef | null>(null)
  const [foundItem, setFoundItem] = useState<Omit<import('./game/dailyLogin').UselessItem, 'acquiredDate'> | null>(null)

  // Card fatigue
  const [fatiguedCards, setFatiguedCards]       = useState<string[]>(loadFatigued)
  const [cardRestCandidates, setCardRestCandidates] = useState<string[]>([])
  const [bonusPackCards, setBonusPackCards]     = useState<string[]>([])
  const campaignPlayCountsRef = useRef<Record<string, number>>({})  // per-battle play tracking

  // Unit death tracking
  const prevPlayerUnitsRef   = useRef<Map<string, string>>(new Map())
  const prevOpponentUnitsRef = useRef<Map<string, string>>(new Map())

  // Achievement toast notifications
  const { achievementToasts, setAchievementToasts } = useAchievements()

  // Per-battle misc achievement flags
  const battleFlawlessRef    = useRef(true)
  const battleUsedStructure  = useRef(false)
  const battleUsedMobileUnit = useRef(false)
  const battleLossRecordedRef = useRef(false)  // prevents double-decrement if component re-renders at game-over

  // Daily login reward
  const [dailyReward, setDailyReward] = useState<RewardDef | null>(null)

  const [isUserPaused, setIsUserPaused] = useState(false)
  const { activeRareEvent, isGamePaused: isRareEventPaused, rollRareEvent, handleRareEventDone } = useRareEvents({
    gameState, screen, setGameState, setCrystals, setAchievementToasts,
  })
  const isGamePaused = isRareEventPaused || isUserPaused

  // ── Daily login reward ────────────────────────────────────
  // Peek at the reward on load (no claim yet — reward is granted when user taps CLAIM)
  useEffect(() => {
    const raw = peekDailyReward()
    if (!raw) return
    let reward = raw
    const catalog = getCardCatalog()
    if (reward.type === 'card') {
      // Resolve card: pick random by rarity if needed
      const pool = reward.rarity
        ? catalog.filter(c => c.rarity === reward.rarity)
        : catalog
      const src = pool.length > 0 ? pool : catalog
      const card = src[Math.floor(Math.random() * src.length)]
      reward = { ...reward, cardName: card.name }
    }
    setDailyReward(reward)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Page visibility: pause game loop when tab is hidden ──
  const [isTabHidden, setIsTabHidden] = useState(() => document.hidden)
  useEffect(() => {
    function handleVisibility() { setIsTabHidden(document.hidden) }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // ── Game loop ────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'playing' || !gameState) return
    if (gameState.phase.type === 'gameOver') return
    if (isGamePaused) return
    if (isTabHidden) return
    const id = setInterval(() => {
      setGameState(s => s ? tick(s, TICK_MS) : s)
    }, TICK_MS)
    return () => clearInterval(id)
  }, [screen, gameState?.phase.type, isGamePaused, isTabHidden])

  // Clear the saved battle state as soon as the battle ends.
  useEffect(() => {
    if (gameState?.phase.type === 'gameOver') clearBattleState()
  }, [gameState?.phase.type])

  // Keep Rollbar person context up to date with the player's current act/run.
  useEffect(() => {
    if (run) updateRollbarPerson({ actId: run.actId, runCount: loadRunCount() })
  }, [run?.actId])

  // Guard: if screen is 'cutscene' but there are no panels, we'd show a blank screen.
  // Redirect to nodemap (or title if no run), and log to Rollbar so we can debug the root cause.
  useEffect(() => {
    if (screen === 'cutscene' && cutscenePanels.length === 0) {
      rollbar.error('Blank cutscene guard triggered — screen is cutscene but panels are empty', {
        runActId: run?.actId,
        pendingNodeId: run?.pendingNodeId,
        pendingActComplete: run?.pendingActComplete,
      })
      setScreen(run ? 'nodemap' : 'title')
    }
  }, [screen, cutscenePanels, run])

  // Guard: if we somehow land on 'actcomplete' without a valid run/actData, escape to title.
  useEffect(() => {
    if (screen === 'actcomplete' && (!run || !ACTS[run.actId])) {
      rollbar.error('actcomplete screen reached without valid run/actData', {
        runActId: run?.actId,
      })
      clearRun()
      setRun(null)
      setScreen('title')
    }
  }, [screen, run])

  // Guard: catch all other "data-dependent" screens that would render blank if their data is null.
  useEffect(() => {
    if (screen === 'bossdialogue' && !bossDialogueNode?.bossDialogue) {
      rollbar.error('bossdialogue screen reached without bossDialogueNode/dialogue', { runActId: run?.actId })
      setScreen(run ? 'nodemap' : 'title')
    } else if (screen === 'event' && (!activeEvent || !run)) {
      rollbar.error('event screen reached without activeEvent or run', { runActId: run?.actId, hasEvent: !!activeEvent })
      setScreen(run ? 'nodemap' : 'title')
    } else if (screen === 'merchant' && merchantItems.length === 0) {
      rollbar.error('merchant screen reached with empty merchantItems', { runActId: run?.actId })
      setScreen(run ? 'nodemap' : 'title')
    } else if (screen === 'mystery' && !mysteryReward) {
      rollbar.error('mystery screen reached without mysteryReward', { runActId: run?.actId })
      setScreen(run ? 'nodemap' : 'title')
    } else if (screen === 'itemfound' && !foundItem) {
      rollbar.error('itemfound screen reached without foundItem', { runActId: run?.actId })
      setScreen(run ? 'nodemap' : 'title')
    }
  }, [screen, bossDialogueNode, activeEvent, merchantItems, mysteryReward, foundItem, run])

  // Show boss fight splash when phase 2 triggers.
  useEffect(() => {
    const active = gameState?.bossCardActive ?? false
    if (active && !prevBossCardActiveRef.current) {
      setShowBossSplash(true)
      setTimeout(() => setShowBossSplash(false), 2500)
    }
    prevBossCardActiveRef.current = active
  }, [gameState?.bossCardActive])

  // Trigger SW update check whenever the title screen is shown
  useEffect(() => {
    if (screen === 'title') swRegRef.current?.update()
  }, [screen])

  useMusic(screen, gameState, run)

  // ── Free play ────────────────────────────────────────────

  const handlePlay = useCallback(() => {
    isCampaignRef.current = false
    battleFlawlessRef.current = true
    battleUsedStructure.current = false
    battleUsedMobileUnit.current = false
    battleLossRecordedRef.current = false
    prevOpponentUnitsRef.current = new Map()
    prevPlayerUnitsRef.current = new Map()
    const collection  = loadCollection()
    const deckEntries = loadDeck()
    const deckCount   = deckTotalCards(deckEntries)
    // Fall back to starter deck if player has no cards built yet
    const effectiveDeck = deckCount > 0 ? deckEntries : STARTER_DECK
    const playerCards   = buildDeckCards(effectiveDeck, collection)
    // Give a handicap boost scaled to deck size: fewer cards = easier opponent
    // (maxes out at +10 for an empty deck, scales to 0 at DECK_MAX cards)
    const deckBonus = Math.round(Math.max(0, DECK_MAX - deckCount) / DECK_MAX * 10)
    setGameState(newGame(playerCards, Math.min(MAX_HANDICAP, handicap + deckBonus)))
    setScreen('playing')
    rollRareEvent()
  }, [handicap])

  const handlePlayAgain = useCallback(() => {
    if (!gameState || gameState.phase.type !== 'gameOver') return
    isCampaignRef.current = false
    battleFlawlessRef.current = true
    battleUsedStructure.current = false
    battleUsedMobileUnit.current = false
    battleLossRecordedRef.current = false
    prevOpponentUnitsRef.current = new Map()
    prevPlayerUnitsRef.current = new Map()
    const winner = gameState.phase.winner
    if (winner === 'player') { incrementWinStreak() } else { resetWinStreak() }
    const nextHandicap = winner === 'player'
      ? Math.max(0, handicap - 1)
      : winner === 'opponent'
        ? Math.min(MAX_HANDICAP, handicap + 1)
        : handicap
    try { localStorage.setItem(HANDICAP_KEY, String(nextHandicap)) } catch { /* ignore */ }
    setHandicap(nextHandicap)
    const collection  = loadCollection()
    const deckEntries = loadDeck()
    const deckCount   = deckTotalCards(deckEntries)
    const effectiveDeck = deckCount > 0 ? deckEntries : STARTER_DECK
    const playerCards   = buildDeckCards(effectiveDeck, collection)
    const deckBonus = Math.round(Math.max(0, DECK_MAX - deckCount) / DECK_MAX * 10)
    setGameState(newGame(playerCards, Math.min(MAX_HANDICAP, nextHandicap + deckBonus)))
    setScreen('playing')
    rollRareEvent()
  }, [gameState, handicap])

  // ── Campaign ─────────────────────────────────────────────

  const handleCampaign = useCallback(() => {
    const existing = loadRun()
    let activeRun = existing ?? newRun('act1')
    const earned = !existing ? loadEarnedRelics() : []

    if (!existing) saveRun(activeRun)
    setRun(activeRun)

    const act = ACTS[activeRun.actId]

    // Show act intro cutscene when starting a fresh run
    const proceedAfterRelicSelect = (chosenRelic: string | null) => {
      const runWithRelic = { ...activeRun, activeRelic: chosenRelic }
      saveRun(runWithRelic)
      setRun(runWithRelic)
      if (!existing) {
        const runCount = incrementRunCount()
        const introToShow = activeRun.actId === 'act1'
          ? getAct1Intro(runCount)
          : (act.intro ?? [])
        markIntroSeen(activeRun.actId)
        if (introToShow.length > 0) {
          setCutscenePanels(applyPlayerName(introToShow))
          cutsceneDoneRef.current = () => setScreen('nodemap')
          setScreen('cutscene')
          return
        }
      }
      setScreen('nodemap')
    }

    if (!existing && earned.length > 0) {
      relicSelectDoneRef.current = proceedAfterRelicSelect
      setScreen('relicselect')
      return
    }

    if (!existing) {
      proceedAfterRelicSelect(null)
      return
    }

    // If there's a pending node (e.g. player refreshed mid-campaign), resume it directly
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
        battleLossRecordedRef.current = false
        prevOpponentUnitsRef.current = new Map()
        prevPlayerUnitsRef.current = new Map()
        const collection  = loadCollection()
        const fatigued    = loadFatigued()
        const deckEntries = loadDeck().filter(e => !fatigued.includes(e.cardName))
        const playerCards = buildDeckCards(deckEntries, collection)
        const earnedEntries = (activeRun.earnedCards ?? []).map(n => ({ cardName: n, count: 1 }))
        if (earnedEntries.length > 0) playerCards.push(...buildDeckCards(earnedEntries, collection))
        const mods = act ? getActiveModifiers(act, loadActCount(activeRun.actId)) : []
        const state = newGame({ playerCards, ...resolvedNodeOpts(node, act, loadRunCount(), mods) })
        state.playerBase = { hp: activeRun.playerHp, maxHp: activeRun.maxHp }
        if (activeRun.activeRelic) getRelicDef(activeRun.activeRelic)?.applyToGame(state)
        setGameState(state)
        setScreen('playing')
        rollRareEvent()
        return
      }
      // pendingNodeId points to a non-existent node — clear it and show map
      const repaired = { ...activeRun, pendingNodeId: null }
      saveRun(repaired)
      setRun(repaired)
    }

    // If the act is already complete (player exited during relic select or act-complete flow),
    // return them to actcomplete rather than dumping them on an exhausted nodemap.
    if (isActComplete(act, activeRun)) {
      setScreen('actcomplete')
      return
    }

    setScreen('nodemap')
  }, [])

  const handleSelectNode = useCallback((node: QuestNode) => {
    const currentRun = run
    if (!currentRun) return
    const act = ACTS[currentRun.actId]

    // Mark siblings as skipped (branch choice)
    const afterSkip = skipSiblings(act, node.id, currentRun)
    const activeMods = act ? getActiveModifiers(act, loadActCount(currentRun.actId)) : []
    const bonusCrystals = activeMods.filter(m => m.type === 'crystalBonus').reduce((s, m) => s + m.value, 0)
    const updatedRun: RunState = { ...afterSkip, pendingNodeId: node.id, crystalBonus: bonusCrystals }
    saveRun(updatedRun)
    setRun(updatedRun)

    if (node.type === 'rest') {
      // Instantly heal, mark complete, stay on map
      const healed = Math.min(updatedRun.maxHp, updatedRun.playerHp + (node.restHeal ?? 5))
      const afterRest: RunState = {
        ...updatedRun,
        playerHp: healed,
        completedNodeIds: [...updatedRun.completedNodeIds, node.id],
        pendingNodeId: null,
      }
      recordNodeComplete(updatedRun.actId, node.id)
      saveRun(afterRest)
      setRun(afterRest)
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

    // 10% chance: normal battle node becomes a mystery encounter
    if (node.type === 'battle' && Math.random() < 0.10) {
      setMysteryReward(computeReward(loadInventory()))
      setScreen('mystery')
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
    battleLossRecordedRef.current = false
    prevOpponentUnitsRef.current = new Map()
    prevPlayerUnitsRef.current = new Map()
    const collection  = loadCollection()
    const fatigued    = loadFatigued()
    const deckEntries = loadDeck().filter(e => !fatigued.includes(e.cardName))
    const playerCards = buildDeckCards(deckEntries, collection)
    // Include cards earned as rewards earlier this run
    const earnedEntries = (updatedRun.earnedCards ?? []).map(n => ({ cardName: n, count: 1 }))
    if (earnedEntries.length > 0) playerCards.push(...buildDeckCards(earnedEntries, collection))
    const mods733 = act ? getActiveModifiers(act, loadActCount(updatedRun.actId)) : []
    const state = newGame({ playerCards, ...resolvedNodeOpts(node, act, loadRunCount(), mods733) })
    state.playerBase = { hp: updatedRun.playerHp, maxHp: updatedRun.maxHp }
    if (updatedRun.activeRelic) getRelicDef(updatedRun.activeRelic)?.applyToGame(state)
    setGameState(state)
    setScreen('playing')
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
    battleLossRecordedRef.current = false
    prevOpponentUnitsRef.current = new Map()
    prevPlayerUnitsRef.current = new Map()
    const collection  = loadCollection()
    const fatigued    = loadFatigued()
    const deckEntries = loadDeck().filter(e => !fatigued.includes(e.cardName))
    const playerCards = buildDeckCards(deckEntries, collection)
    const earnedEntries = (run.earnedCards ?? []).map(n => ({ cardName: n, count: 1 }))
    if (earnedEntries.length > 0) playerCards.push(...buildDeckCards(earnedEntries, collection))
    const act = ACTS[run.actId]
    const mods761 = act ? getActiveModifiers(act, loadActCount(run.actId)) : []
    const state = newGame({ playerCards, ...resolvedNodeOpts(node, act, loadRunCount(), mods761) })
    state.playerBase = { hp: run.playerHp, maxHp: run.maxHp }
    if (run.activeRelic) getRelicDef(run.activeRelic)?.applyToGame(state)
    setGameState(state)
    setScreen('playing')
    rollRareEvent()
  }, [bossDialogueNode, run])

  const handleEventChoice = useCallback((choice: EventChoice) => {
    const currentRun = run
    if (!currentRun) return
    const nodeId = currentRun.pendingNodeId!

    // Apply the effect
    let updatedRun: RunState = {
      ...currentRun,
      completedNodeIds: [...currentRun.completedNodeIds, nodeId],
      pendingNodeId: null,
    }

    const effect = choice.effect
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

    recordNodeComplete(updatedRun.actId, nodeId)
    saveRun(updatedRun)
    setRun(updatedRun)
    setActiveEvent(null)
    setScreen('nodemap')
  }, [run])

  const handleMerchantBuy = useCallback((item: MerchantItem) => {
    if (item.kind === 'card') {
      addCardsToCollection([{ cardName: item.card.name, count: 1 }])
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
    const updatedRun: RunState = {
      ...currentRun,
      completedNodeIds: [...currentRun.completedNodeIds, nodeId],
      pendingNodeId: null,
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

    // Increment win streak and check for streak achievements
    const newStreak = incrementWinStreak()
    const streakUnlocked = setAchievementProgress('campaign:win_streak', newStreak)
    if (streakUnlocked.length > 0) setAchievementToasts(prev => [...prev, ...streakUnlocked])

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
        cutsceneDoneRef.current = () => setScreen('actcomplete')
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

    // Capture stats snapshot then show summary; summary → reward
    setSummaryStats({
      stats: gameState.battleStats,
      gameTime: gameState.gameTime,
      playerScore: gameState.playerScore,
    })
    summaryDoneRef.current = () => {
      const choices = generateRewardChoices(node.type, act.rewardTags)
      setRewardChoices(choices)
      setRewardCrystals(crystalReward)
      setScreen('reward')
    }
    setScreen('battlesummary')
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
          }
          saveRun(nextRun)
          setRun(nextRun)
          // Show next act intro cutscene
          const introPanels = nextAct.intro ?? []
          if (introPanels.length > 0) {
            setCutscenePanels(applyPlayerName(introPanels))
            cutsceneDoneRef.current = () => setScreen('nodemap')
            setScreen('cutscene')
          } else {
            setScreen('nodemap')
          }
        }

        rollbar.info('Act transition: showing relic select or proceeding', {
          actId: currentRun.actId,
          nextActId: nextAct.id,
          earnedRelicsCount: earnedRelics.length,
          willBreak,
        })
        if (earnedRelics.length > 0) {
          // Clear pendingActComplete before showing relic select so a mid-selection
          // exit doesn't loop back to actcomplete on next load.
          saveRun({ ...currentRun, pendingActComplete: false })
          relicSelectDoneRef.current = proceedToNextAct
          setScreen('relicselect')
        } else {
          proceedToNextAct(null)
        }
        return
      }

      // ── Final act completed — show victory screen, then card rest / deck reset ──
      rollbar.info('Final act completed — showing campaignvictory', { actId: currentRun.actId })
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

    // Life was already decremented by the game-over effect — check if campaign failed
    if (currentRun.livesRemaining === 0) {
      stopBattleMusic()
      const crystalReward = 50
      const next = loadCrystals() + crystalReward
      saveCrystals(next)
      setCrystals(next)
      const failUnlocked = incrementAchievementProgress('misc:campaign_failed')
      if (failUnlocked.length > 0) setAchievementToasts(prev => [...prev, ...failUnlocked])
      resetWinStreak()
      clearRun()
      setRun(null)
      setScreen('campaignfailed')
      return
    }

    // Retry same node, but HP stays at what it was before this battle
    campaignPlayCountsRef.current = {}
    isCampaignRef.current = true
    battleFlawlessRef.current = true
    battleUsedStructure.current = false
    battleLossRecordedRef.current = false
    battleUsedMobileUnit.current = false
    prevOpponentUnitsRef.current = new Map()
    prevPlayerUnitsRef.current = new Map()
    const collection  = loadCollection()
    const fatigued    = loadFatigued()
    const deckEntries = loadDeck().filter(e => !fatigued.includes(e.cardName))
    const playerCards = buildDeckCards(deckEntries, collection)
    const earnedEntries = (currentRun.earnedCards ?? []).map(n => ({ cardName: n, count: 1 }))
    if (earnedEntries.length > 0) playerCards.push(...buildDeckCards(earnedEntries, collection))
    const modsRetry = act ? getActiveModifiers(act, loadActCount(currentRun.actId)) : []
    const state = newGame({ playerCards, ...resolvedNodeOpts(node, act, loadRunCount(), modsRetry) })
    state.playerBase = { hp: currentRun.playerHp, maxHp: currentRun.maxHp }
    if (currentRun.activeRelic) getRelicDef(currentRun.activeRelic)?.applyToGame(state)
    setGameState(state)
    setScreen('playing')
    rollRareEvent()
  }, [run])

  const handleAbandonRun = useCallback(() => {
    clearRun()
    setRun(null)
    setScreen('title')
  }, [])

  const handleGiveUp = useCallback(() => {
    if (isCampaignRef.current) {
      handleAbandonRun()
    } else {
      setScreen('title')
    }
  }, [handleAbandonRun])

  // Detect player unit deaths each tick
  useEffect(() => {
    if (!gameState || screen !== 'playing') return
    const currentMap = new Map<string, string>()
    for (const u of gameState.field) {
      if (u.owner === 'player') currentMap.set(u.id, u.name)
    }
    for (const [id, name] of prevPlayerUnitsRef.current) {
      if (!currentMap.has(id)) recordUnitDied(name)
    }
    prevPlayerUnitsRef.current = currentMap
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
  }, [gameState?.playerBase.hp, screen])

  // Track card play types for per-battle misc achievements
  const handlePlayCard = useCallback((cardId: string) => {
    setGameState(s => {
      if (!s) return s
      const card = s.playerHand.find(c => c.id === cardId)
      if (!card) return s
      if (card.isHero && s.gameTime < 30000) return s
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
      return next
    })
  }, [])

  // Track misc achievements at battle end
  useEffect(() => {
    if (!gameState || gameState.phase.type !== 'gameOver') return
    if (gameState.phase.winner !== 'player') {
      // Reset per-battle flags on next game start (done via handlePlay / handlePlayAgain)
      return
    }
    const toasts: AchievementDef[] = []
    // Quick battle win
    if (!isCampaignRef.current) {
      toasts.push(...incrementAchievementProgress('misc:quick_win'))
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
    if (toasts.length > 0) setAchievementToasts(prev => [...prev, ...toasts])
  }, [gameState?.phase.type])

  // Decrement a campaign life as soon as a battle is lost (before any button is clicked)
  useEffect(() => {
    if (!gameState || gameState.phase.type !== 'gameOver') return
    if (gameState.phase.winner === 'player') return
    if (!isCampaignRef.current) return
    if (battleLossRecordedRef.current) return   // already recorded for this battle
    const currentRun = run
    if (!currentRun) return

    battleLossRecordedRef.current = true
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.phase.type])

  // ── Pack ─────────────────────────────────────────────────

  const packBackScreenRef = useRef<Screen>('title')

  const handleOpenPack = useCallback(() => {
    packBackScreenRef.current = 'title'
    setPack(generatePack())
    setScreen('pack')
  }, [])

  const handleBuyCrystalPack = useCallback(() => {
    const current = loadCrystals()
    if (current < CRYSTAL_PACK_COST) return
    const next = current - CRYSTAL_PACK_COST
    saveCrystals(next)
    setCrystals(next)
    packBackScreenRef.current = 'shop'
    setPack(generatePack())
    setScreen('pack')
  }, [])

  const handleCrystalsChanged = useCallback((n: number) => {
    setCrystals(n)
  }, [])

  const handlePackDone = useCallback(() => {
    setScreen(packBackScreenRef.current)
  }, [])

  const handleMainMenu = useCallback(() => {
    isCampaignRef.current = false
    const currentRun = run

    // Life was already decremented by the game-over effect when the battle was lost.
    // If lives hit 0, go to campaign-failed instead of title.
    const isLoss = gameState?.phase.type === 'gameOver' && gameState.phase.winner !== 'player'
    if (currentRun && isLoss && currentRun.livesRemaining === 0) {
      const crystalReward = 50
      const next = loadCrystals() + crystalReward
      saveCrystals(next)
      setCrystals(next)
      const failUnlocked = incrementAchievementProgress('misc:campaign_failed')
      if (failUnlocked.length > 0) setAchievementToasts(prev => [...prev, ...failUnlocked])
      resetWinStreak()
      clearRun()
      setRun(null)
      setGameState(null)
      setScreen('campaignfailed')
      return
    }

    // Clear pendingNodeId so the node is selectable again when the player returns
    // via "Continue Campaign" (covers both mid-battle quit and post-loss main menu).
    if (currentRun?.pendingNodeId) {
      const cleared = { ...currentRun, pendingNodeId: null }
      saveRun(cleared)
      setRun(cleared)
    }
    clearBattleState()
    setScreen('title')
    setGameState(null)
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
          <div className="event-card-reveal-backdrop" onClick={() => { setPendingEventCard(null); setScreen('nodemap') }}>
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
        <TitleScreen
          crystals={crystals}
          onPlay={handlePlay}
          onCampaign={handleCampaign}
          onCollection={() => setScreen('collection')}
          onShop={() => setScreen('shop')}
          onDeckBuilder={() => setScreen('deckbuilder')}
          onSettings={() => setScreen('settings')}
          onInventory={() => setScreen('inventory')}
          onAchievements={() => setScreen('achievements')}
          onHeroCards={() => setScreen('heroCards')}
          onCharacter={() => setScreen('character')}
          on8bitUnlocked={() => { /* achievement granted in TitleScreen after unlock */ }}
        />
      )}

      {screen === 'settings' && (
        <SettingsScreen onBack={() => setScreen('title')} onResetGame={handleResetGame} />
      )}

      {screen === 'nodemap' && run && actData && (
        <NodeMap
          act={actData}
          run={run}
          onSelectNode={handleSelectNode}
          onBack={handleMainMenu}
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
        <CutsceneScreen panels={cutscenePanels} onDone={() => cutsceneDoneRef.current()} />
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

      {screen === 'relicselect' && (
        <RelicSelectScreen
          earnedRelics={loadEarnedRelics()}
          currentRelic={run?.activeRelic ?? null}
          brokenRelic={brokenRelicRef.current}
          onSelect={relic => { brokenRelicRef.current = null; relicSelectDoneRef.current(relic) }}
        />
      )}

      {screen === 'cardrest' && (
        <CardRestSelect
          candidates={cardRestCandidates}
          playCounts={run?.cardPlayCounts ?? {}}
          onConfirm={handleCardRestConfirm}
        />
      )}

      {screen === 'starterpack' && (
        <StarterPackSelect
          onPick={handleStarterPackPick}
          fatiguedCards={fatiguedCards}
          bonusCards={bonusPackCards}
        />
      )}

      {screen === 'collection' && (
        <CollectionScreen
          crystals={crystals}
          onCrystalsChanged={handleCrystalsChanged}
          onBack={() => setScreen('title')}
        />
      )}

      {screen === 'shop' && (
        <ShopScreen
          crystals={crystals}
          onBuyCrystalPack={handleBuyCrystalPack}
          onCrystalsChange={(n: number) => { saveCrystals(n); setCrystals(n) }}
          onBack={() => setScreen('title')}
        />
      )}

      {screen === 'deckbuilder' && (
        <DeckBuilder onBack={() => setScreen('title')} fatiguedCards={fatiguedCards} />
      )}

      {screen === 'pack' && (
        <PackOpening pack={pack} onDone={handlePackDone} />
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

      {screen === 'heroCards' && (
        <HeroCardsScreen onBack={() => setScreen('title')} />
      )}

      {screen === 'campaignvictory' && (
        <CampaignVictoryScreen onBeginAnew={() => {
          const bonus = crystals + 500; saveCrystals(bonus); setCrystals(bonus)
          const counts = run?.cardPlayCounts ?? {}
          const candidates = getTopPlayedCards(counts, 3)
          clearRun(); setRun(null); clearFatigued(); setFatiguedCards([]); setBonusPackCards([])
          if (candidates.length >= 2) { setCardRestCandidates(candidates); setScreen('cardrest') }
          else { setScreen('starterpack') }
        }} />
      )}

      {screen === 'campaignfailed' && (
        <CampaignFailedScreen onReturnToMenu={() => { stopBattleMusic(); stopGameOverMusic(); setScreen('title') }} />
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
        return gameState.phase.type === 'gameOver' ? (
          <GameOver
            state={gameState}
            winner={gameState.phase.winner}
            handicap={handicap}
            onOpenPack={!isCampaignRef.current && gameState.phase.winner === 'player' ? handleOpenPack : undefined}
            onPlayAgain={isCampaignRef.current
              ? (gameState.phase.winner === 'player' ? handleCampaignWin : handleCampaignRetry)
              : handlePlayAgain
            }
            onMainMenu={handleMainMenu}
            campaignAbandon={isCampaignRef.current ? handleAbandonRun : undefined}
            quickPlayHint={quickPlayHint}
            showStreak={!isCampaignRef.current}
          />
        ) : (
          <>
            <Battlefield state={gameState} onPlayCard={handlePlayCard} onGiveUp={handleGiveUp} onPause={setIsUserPaused} actTheme={actTheme} activeRelic={run?.activeRelic} showBossSplash={showBossSplash} activeModifiers={run ? getActiveModifiers(ACTS[run.actId], loadActCount(run.actId)) : []} />
            {activeRareEvent === 'fakeCrash'   && <FakeCrashEvent   onDone={handleRareEventDone} />}
            {activeRareEvent === 'blackjack'   && <BlackjackEvent   onDone={handleRareEventDone} />}
            {activeRareEvent === 'wrongNumber' && <WrongNumberEvent onDone={handleRareEventDone} />}
            {activeRareEvent === 'narrator'    && <NarratorEvent    onDone={handleRareEventDone} />}
            {activeRareEvent === 'liarsDice'   && <LiarsDiceEvent   onDone={handleRareEventDone} />}
            {activeRareEvent === 'gambler'     && <GamblerEvent     onDone={handleRareEventDone} />}
          </>
        )
      })()}

      {/* Daily login reward modal — shown as overlay on first visit each day */}
      {dailyReward && (
        <DailyLoginModal
          reward={dailyReward}
          onClose={() => {
            // Mark claimed and grant the reward only when user taps CLAIM
            markDailyRewardClaimed()
            const catalog = getCardCatalog()
            if (dailyReward.type === 'card' && dailyReward.cardName) {
              addCardsToCollection([{ cardName: dailyReward.cardName, count: 1 }])
            } else if (dailyReward.type === 'pack') {
              const n = dailyReward.count ?? 5
              const names = Array.from({ length: n }, () => catalog[Math.floor(Math.random() * catalog.length)].name)
              addCardsToCollection(names.map(name => ({ cardName: name, count: 1 })))
            } else if (dailyReward.type === 'item') {
              addToInventory(dailyReward)
            }
            setDailyReward(null)
          }}
        />
      )}
    </div>
  )
}
