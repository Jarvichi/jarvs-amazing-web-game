import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { GameState } from '../game/types'
import type { BattleAction } from '../game/battleReducer'
import { getCardCatalog } from '../game/cards'
import { recordUnitDied } from '../game/collection'
import { incrementAugmentSouls } from '../game/collection'
import { incrementAchievementProgress, type AchievementDef } from '../game/achievements'
import { recordQuestKills, type QuestChainDef } from '../game/quests'
import { incrementBattleCount } from '../game/questline'
import type { Screen } from '../app/screens'

interface UseBattleTelemetryArgs {
  gameState:            GameState | null
  screen:               Screen
  speedMultiplier:      number
  dispatch:             Dispatch<BattleAction>
  gameStateRef:         MutableRefObject<GameState | null>
  /** Reset by every battle-start path in App, so these stay owned there. */
  prevPlayerUnitsRef:   MutableRefObject<Map<string, string>>
  prevOpponentUnitsRef: MutableRefObject<Map<string, string>>
  battleFlawlessRef:    MutableRefObject<boolean>
  setAchievementToasts: Dispatch<SetStateAction<AchievementDef[]>>
  setQuestCompletes:    Dispatch<SetStateAction<QuestChainDef[]>>
  setTimeCapsuleVisible: Dispatch<SetStateAction<boolean>>
}

/**
 * Per-tick battle observation: unit-death tracking, kill-driven achievement and
 * quest progress, the flawless-battle flag, and the two auto-slowdown rules.
 *
 * Takes everything as explicit arguments rather than reading a context, so it
 * stays testable in isolation.
 */
export function useBattleTelemetry({
  gameState, screen, speedMultiplier, dispatch, gameStateRef,
  prevPlayerUnitsRef, prevOpponentUnitsRef, battleFlawlessRef,
  setAchievementToasts, setQuestCompletes, setTimeCapsuleVisible,
}: UseBattleTelemetryArgs): void {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Exotic quest chains: tagged-kill steps
      const questDone = recordQuestKills(newKills)
      if (questDone.length > 0) setQuestCompletes(prev => [...prev, ...questDone])
      if (newToasts.length > 0) {
        setAchievementToasts(prev => [...prev, ...newToasts])
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.field, screen])

  // Track flawless battle flag
  useEffect(() => {
    if (!gameState || screen !== 'playing') return
    if (gameState.playerBase.hp < gameState.playerBase.maxHp) {
      battleFlawlessRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.playerBase?.hp, screen])

  // Reset commander HP ref between battles so a new battle never false-triggers
  const prevCommanderHpRef = useRef<number | null>(null)
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
      if (speedMultiplier > 1) dispatch({ type: 'SET_SPEED', multiplier: 1 })
    }
    prevCommanderHpRef.current = currentHp
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.field])

  // Drop to 1x speed when the opponent starts casting a spell, so every player
  // gets the same real-time 5s window to react regardless of fast-forward setting
  const prevPendingCastKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!gameState || screen !== 'playing') return
    const cast = gameState.pendingSpellCast
    const castKey = cast ? `${cast.cardName}:${cast.startedAtMs}` : null
    if (castKey && castKey !== prevPendingCastKeyRef.current && speedMultiplier > 1) {
      dispatch({ type: 'SET_SPEED', multiplier: 1 })
    }
    prevPendingCastKeyRef.current = castKey
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.pendingSpellCast?.cardName, gameState?.pendingSpellCast?.startedAtMs])

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen])
}
