import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { Card, GameState } from '../game/types'
import type { BattleAction } from '../game/battleReducer'
import { newGame, MAX_HANDICAP } from '../game/engine'
import { makeNodeDeck, getCardCatalog } from '../game/cards'
import { SECRET_RARITIES } from '../game/types'
import { buildQuickBattleOpts, loadCurrentDeckInfo, HANDICAP_KEY } from '../game/campaignHelpers'
import { loadDeckSlot, loadWinStreak, loadBestStreak, resetWinStreak } from '../game/collection'
import { clearBattleState } from '../game/battleState'
import { getDailyPlayerDeck, getDailyOpponentDeck, getDailyTerrainSeed } from '../game/dailyChallenge'
import { getWeeklyPlayerDeck, getWeeklyOpponentDeck, getWeeklyTerrainSeed } from '../game/weeklyChallenge'
import { markNodeCleared } from '../game/world/worldState'
import type { QuickBattleMode } from '../components/screens/QuickBattleScreen'
import type { StreakBrokenData } from './AppContext'
import type { Screen } from './screens'

interface UseQuickBattleFlowArgs {
  gameState:   GameState | null
  handicap:    number
  setHandicap: Dispatch<SetStateAction<number>>
  setScreen:   Dispatch<SetStateAction<Screen>>
  dispatch:    Dispatch<BattleAction>
  startBattle:   (gs: GameState) => void
  rollRareEvent: () => void
  setWorldMapKey:  Dispatch<SetStateAction<number>>
  setStreakBrokenData: Dispatch<SetStateAction<StreakBrokenData | null>>
  setPendingBattleFn:  Dispatch<SetStateAction<(() => void) | null>>
  setPendingBattleIsCampaign: Dispatch<SetStateAction<boolean>>
  setQuickPlayRewardClaimed:  Dispatch<SetStateAction<boolean>>

  /**
   * Battle-mode flags. Every launch path below resets its own set of these —
   * deliberately not a shared reset helper, because the sets are not uniform
   * (training starts with battleFlawlessRef false, every other path true).
   */
  isCampaignRef:        MutableRefObject<boolean>
  isDailyChallengeRef:  MutableRefObject<boolean>
  isWeeklyChallengeRef: MutableRefObject<boolean>
  isTrainingModeRef:    MutableRefObject<boolean>
  isDraftModeRef:       MutableRefObject<boolean>
  quickBattleModeRef:   MutableRefObject<QuickBattleMode>
  worldBattleNodeIdRef: MutableRefObject<string | null>
  /** True while playing a single-battle duel offered by a wandering hub-town NPC (#2149). */
  isWandererBattleRef:   MutableRefObject<boolean>
  battleFlawlessRef:     MutableRefObject<boolean>
  battleAllLegendaryRef: MutableRefObject<boolean>
  battleUsedStructure:   MutableRefObject<boolean>
  battleUsedMobileUnit:  MutableRefObject<boolean>
  prevPlayerUnitsRef:    MutableRefObject<Map<string, string>>
  prevOpponentUnitsRef:  MutableRefObject<Map<string, string>>
}

interface UseQuickBattleFlowResult {
  handlePlay:               (mode: QuickBattleMode) => void
  handleDraftComplete:      (pickedCardNames: string[]) => void
  handleEndless:            () => void
  handleDailyChallenge:     () => void
  handleWeeklyChallenge:    () => void
  handleEndlessLeaderboard: () => void
  handleStartDailyChallenge:  () => void
  handleDailyChallengeRetry:  () => void
  handleStartWeeklyChallenge: () => void
  handleStreakReset:   () => void
  handlePlayAgain:     () => void
  handleStartTraining: (enemyUnitName: string, playerCards: Card[]) => void
  handleStartWandererBattle: () => void
}

/**
 * Every non-campaign way into a battle: quick battle, card draft, endless, the
 * daily and weekly challenges, training, and the post-battle "play again".
 */
export function useQuickBattleFlow({
  gameState, handicap, setHandicap, setScreen, dispatch, startBattle, rollRareEvent,
  setWorldMapKey, setStreakBrokenData, setPendingBattleFn, setPendingBattleIsCampaign,
  setQuickPlayRewardClaimed,
  isCampaignRef, isDailyChallengeRef, isWeeklyChallengeRef, isTrainingModeRef,
  isDraftModeRef, quickBattleModeRef, worldBattleNodeIdRef, isWandererBattleRef,
  battleFlawlessRef, battleAllLegendaryRef, battleUsedStructure, battleUsedMobileUnit,
  prevPlayerUnitsRef, prevOpponentUnitsRef,
}: UseQuickBattleFlowArgs): UseQuickBattleFlowResult {
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
    setQuickPlayRewardClaimed(false)
    const { opts, playerCards } = buildQuickBattleOpts(mode, handicap)
    battleAllLegendaryRef.current = playerCards.length > 0 && playerCards.every(c => c.rarity === 'legendary')
    startBattle(newGame(opts))
    rollRareEvent()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handicap])

  const handlePlay = useCallback((mode: QuickBattleMode) => {
    if (loadDeckSlot('b').length > 0) {
      setPendingBattleIsCampaign(false)
      setPendingBattleFn(() => () => launchQuickBattle(mode))
    } else {
      launchQuickBattle(mode)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchQuickBattle])

  // A single-battle duel offered by a wandering hub-town NPC (#2149) — same
  // deck-slot warning gate as handlePlay, but flags isWandererBattleRef so
  // GameOver can suppress the "Play Again" loop.
  const handleStartWandererBattle = useCallback(() => {
    if (loadDeckSlot('b').length > 0) {
      setPendingBattleIsCampaign(false)
      setPendingBattleFn(() => () => { isWandererBattleRef.current = true; launchQuickBattle('normal') })
    } else {
      isWandererBattleRef.current = true
      launchQuickBattle('normal')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handicap])

  const handleEndless = useCallback(() => {
    if (loadDeckSlot('b').length > 0) {
      setPendingBattleIsCampaign(false)
      setPendingBattleFn(() => launchEndless)
    } else {
      launchEndless()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchEndless])

  const handleDailyChallenge = useCallback(() => {
    setScreen('dailychallenge')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleEndlessLeaderboard = useCallback(() => {
    setScreen('endlessleaderboard')
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleWeeklyChallenge = useCallback(() => {
    setScreen('weeklychallenge')
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStreakReset = useCallback(() => {
    const current = loadWinStreak()
    if (current > 0) setStreakBrokenData({ streak: current, bestStreak: loadBestStreak() })
    resetWinStreak()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, handicap])

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    handlePlay, handleDraftComplete, handleEndless,
    handleDailyChallenge, handleWeeklyChallenge, handleEndlessLeaderboard,
    handleStartDailyChallenge, handleDailyChallengeRetry, handleStartWeeklyChallenge,
    handleStreakReset, handlePlayAgain, handleStartTraining, handleStartWandererBattle,
  }
}
