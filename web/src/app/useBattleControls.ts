import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { GameState } from '../game/types'
import type { BattleAction } from '../game/battleReducer'
import { playCard, playAoeCard } from '../game/engine/cards'
import { getCardCatalog } from '../game/cards'
import { recordCardPlayed, addCardsToCollection } from '../game/collection'
import { incrementAchievementProgress, type AchievementDef } from '../game/achievements'
import { recordQuestCardPlayed, type QuestChainDef } from '../game/quests'
import { saveBattleState } from '../game/battleState'
import { playCardPlay } from '../game/sound'

interface UseBattleControlsArgs {
  gameStateRef:    MutableRefObject<GameState | null>
  dispatch:        Dispatch<BattleAction>
  /** Per-battle flags App resets from every battle-start path, so they stay owned there. */
  isTrainingModeRef:      MutableRefObject<boolean>
  isCampaignRef:          MutableRefObject<boolean>
  campaignPlayCountsRef:  MutableRefObject<Record<string, number>>
  battleUsedStructure:    MutableRefObject<boolean>
  battleUsedMobileUnit:   MutableRefObject<boolean>
  setAchievementToasts: Dispatch<SetStateAction<AchievementDef[]>>
  setQuestCompletes:    Dispatch<SetStateAction<QuestChainDef[]>>
}

interface UseBattleControlsResult {
  handlePlayCard:       (cardId: string) => void
  handlePlayAoeCard:    (cardId: string, cx: number, cy: number) => void
  handleSetStance:      (s: NonNullable<GameState['playerStance']>) => void
  handleSetSpeed:       (m: 1 | 2 | 4 | 8) => void
  handleWaveRewardPick: (cardName: string) => void
  handleWaveRewardSkip: () => void
}

/** The player's in-battle inputs: playing cards, stance, speed, and wave rewards. */
export function useBattleControls({
  gameStateRef, dispatch,
  isTrainingModeRef, isCampaignRef, campaignPlayCountsRef,
  battleUsedStructure, battleUsedMobileUnit,
  setAchievementToasts, setQuestCompletes,
}: UseBattleControlsArgs): UseBattleControlsResult {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleWaveRewardPick = useCallback((cardName: string) => {
    // Add to collection permanently and inject into the current run deck
    addCardsToCollection([{ cardName, count: 1 }])
    const catalog = getCardCatalog()
    const card = catalog.find(c => c.name === cardName)
    dispatch({ type: 'WAVE_REWARD_PICK', card })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleWaveRewardSkip = useCallback(() => {
    dispatch({ type: 'WAVE_REWARD_SKIP' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSetStance = useCallback((s: NonNullable<GameState['playerStance']>) => {
    dispatch({ type: 'SET_STANCE', stance: s })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSetSpeed = useCallback((multiplier: 1 | 2 | 4 | 8) => {
    dispatch({ type: 'SET_SPEED', multiplier })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    handlePlayCard, handlePlayAoeCard, handleSetStance, handleSetSpeed,
    handleWaveRewardPick, handleWaveRewardSkip,
  }
}
