import React, { useState, useCallback, useEffect } from 'react'
import { GameState } from '../game/types'
import {
  RareEventKind, RareEventEffect,
  RARE_EVENT_CHANCE, ALL_RARE_EVENTS,
} from '../components/rare-events/types'
import { getCardCatalog } from '../game/cards'
import { loadCrystals, saveCrystals, addCardsToCollection } from '../game/collection'
import { addToInventory } from '../game/dailyLogin'
import { incrementAchievementProgress, AchievementDef } from '../game/achievements'
import { isNoDamageMode } from '../game/debug'

interface UseRareEventsOptions {
  gameState: GameState | null
  screen: string
  setGameState: React.Dispatch<React.SetStateAction<GameState | null>>
  setCrystals: (n: number) => void
  setAchievementToasts: (fn: (prev: AchievementDef[]) => AchievementDef[]) => void
}

interface UseRareEventsResult {
  activeRareEvent: RareEventKind | null
  isGamePaused: boolean
  rollRareEvent: () => void
  handleRareEventDone: (effect?: RareEventEffect) => void
}

export function useRareEvents({
  gameState,
  screen,
  setGameState,
  setCrystals,
  setAchievementToasts,
}: UseRareEventsOptions): UseRareEventsResult {
  const [rareEventScheduled, setRareEventScheduled] = useState<{ kind: RareEventKind; triggerMs: number } | null>(null)
  const [activeRareEvent,    setActiveRareEvent]    = useState<RareEventKind | null>(null)
  const [isGamePaused,       setIsGamePaused]       = useState(false)

  // Trigger a scheduled rare event once the game clock reaches the target time
  useEffect(() => {
    if (!rareEventScheduled || activeRareEvent) return
    if (!gameState || screen !== 'playing') return
    if (gameState.phase.type === 'gameOver') return
    if (gameState.gameTime < rareEventScheduled.triggerMs) return
    const { kind } = rareEventScheduled
    setActiveRareEvent(kind)
    if (kind === 'blackjack' || kind === 'liarsDice') setIsGamePaused(true)
  }, [gameState?.gameTime, rareEventScheduled, activeRareEvent, screen])

  function rollRareEvent() {
    if (Math.random() < RARE_EVENT_CHANCE) {
      const kind = ALL_RARE_EVENTS[Math.floor(Math.random() * ALL_RARE_EVENTS.length)]
      const triggerMs = 20000 + Math.random() * 30000
      setRareEventScheduled({ kind, triggerMs })
    } else {
      setRareEventScheduled(null)
    }
    setActiveRareEvent(null)
    setIsGamePaused(false)
  }

  const handleRareEventDone = useCallback((effect?: RareEventEffect) => {
    const completedEvent = activeRareEvent
    setActiveRareEvent(null)
    setRareEventScheduled(null)
    setIsGamePaused(false)
    if (!effect) return
    setGameState(s => {
      if (!s) return s
      let next = { ...s }
      if (effect.damage) {
        next = { ...next, opponentBase: { ...next.opponentBase, hp: Math.max(0, next.opponentBase.hp - effect.damage) } }
      }
      if (effect.selfDamage) {
        if (!isNoDamageMode()) {
          next = { ...next, playerBase: { ...next.playerBase, hp: Math.max(0, next.playerBase.hp - effect.selfDamage) } }
        }
      }
      if (effect.killEnemyUnits) {
        const enemies = next.field.filter(u => u.owner === 'opponent' && u.moveSpeed > 0)
        const toKill  = new Set(enemies.slice(0, effect.killEnemyUnits).map(u => u.id))
        next = { ...next, field: next.field.filter(u => !toKill.has(u.id)) }
      }
      if (effect.logMessage) {
        next = { ...next, log: [...next.log.slice(-9), effect.logMessage] }
      }
      return next
    })
    if (effect.crystals) {
      const next = loadCrystals() + effect.crystals
      saveCrystals(next)
      setCrystals(next)
    }
    if (effect.grantAllCards) {
      const catalog = getCardCatalog()
      addCardsToCollection(catalog.map(c => ({ cardName: c.name, count: 1 })))
      const unlocked = incrementAchievementProgress('event:gambler_win')
      if (unlocked.length > 0) setAchievementToasts(prev => [...prev, ...unlocked])
    }
    if (effect.addInventoryItem) {
      addToInventory({ ...effect.addInventoryItem, lore: effect.addInventoryItem.lore ?? '' })
      if (effect.addInventoryItem.id === 'rubber_chicken') {
        const unlocked = incrementAchievementProgress('event:rubber_chicken')
        if (unlocked.length > 0) setAchievementToasts(prev => [...prev, ...unlocked])
      }
    }
    if (effect.resetGame) {
      const KEYS = [
        'jarv_collection', 'jarv_deck', 'jarv_crystals',
        'jarv_run', 'jarv_card_stats', 'jarv_fatigued',
        'jarv_seen_intros', 'jarvs_handicap', 'jarv_run_count',
      ]
      KEYS.forEach(k => { try { localStorage.removeItem(k) } catch { /* ignore */ } })
      const unlocked = incrementAchievementProgress('event:gambler_bust')
      if (unlocked.length > 0) setAchievementToasts(prev => [...prev, ...unlocked])
      window.location.reload()
    }
    if (completedEvent) {
      const eventKey: Record<string, string> = {
        blackjack:   'event:blackjack_win',
        liarsDice:   'event:liarsdice_win',
        narrator:    'event:narrator_befriend',
        wrongNumber: 'event:wrong_number',
        fakeCrash:   'event:fake_crash',
      }
      const key = eventKey[completedEvent]
      if (key) {
        const unlocked = incrementAchievementProgress(key)
        if (unlocked.length > 0) setAchievementToasts(prev => [...prev, ...unlocked])
      }
    }
  }, [activeRareEvent, setGameState, setCrystals, setAchievementToasts])

  return { activeRareEvent, isGamePaused, rollRareEvent, handleRareEventDone }
}
