import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { GameState, Archetype } from '../game/types'
import type { BattleAction } from '../game/battleReducer'
import type { User } from 'firebase/auth'
import { newGame } from '../game/engine'
import { makeNodeDeck, getCardCatalog } from '../game/cards'
import { resolvedNodeOpts, carryHpAfterBattle, applyRestHeal, applyEventHeal } from '../game/campaignHelpers'
import {
  loadRun, saveRun, clearRun, newRun, LIVES_START, LIVES_MAX,
  skipSiblings, isActComplete, getProtectedFragmentNodeIds,
  generateRewardChoices, generateEndlessRewardChoices, MERCHANT_PRICES,
  loadAct, getCachedAct, getCampaignForAct,
  loadFatigued, saveFatigued, clearFatigued, getTopPlayedCards,
  markIntroSeen, loadRunCount, incrementRunCount, getAct1Intro,
  generateEventFromConfig, ARCHETYPE_STARTER_PACK,
  getModifiersByCount, getModifierMax, recordNodeComplete, loadPlayerName, applyPlayerName,
  addToConsumableStash, useConsumable, loadActCount, incrementActCount,
  setLastRunFailed, loadLastRunFailed, clearLastRunFailed, loadPlayerArchetype,
  type Act, type CutscenePanel, type EventChoice, type EventData, type QuestNode,
  type RunState, type ReplayModifier,
} from '../game/questline'
import {
  loadDeck, saveDeck, buildDeckCards, loadCollection, addCardsToCollection,
  loadCrystals, saveCrystals, getOwnedCount, DECK_MAX, deckTotalCards,
  incrementWinStreak, incrementTotalWins, loadDeckSlot, generatePack, type DeckEntry,
} from '../game/collection'
import { getRelicDef, addEarnedRelic, removeEarnedRelic, addBrokenRelic, rollExoticDrop, loadEarnedRelics } from '../game/relics'
import { incrementAchievementProgress, setAchievementProgress, type AchievementDef } from '../game/achievements'
import { recordQuestWin, recordQuestBossDefeat, type QuestChainDef } from '../game/quests'
import { recordChronicleWin, type ChronicleChapterDef } from '../game/chronicle'
import {
  MemoryFragment, isFragmentDiscovered, markFragmentDiscovered, isHubWorldUnlocked,
  unlockHubWorld, areAllCampaignFragmentsDiscovered, getDiscoveredFragmentIds,
} from '../game/codex'
import { getConsumables, addConsumable } from '../game/itemStore'
import {
  CharacterChoice, recordCharacterEncounter, getCharacterEncounterChance, resolveCharacterEncounterId,
} from '../game/characters'
import { computeReward, loadInventory, addToInventory, ALL_ITEMS, type RewardDef, type UselessItem } from '../game/dailyLogin'
import { clearBattleState } from '../game/battleState'
import { publishSecretRareWin, type SecretRarityType } from '../game/secretRareNews'
import { playButtonClick, playCardFlip, playRestHeal, playVictory, stopBattleMusic } from '../game/sound'
import { isTownAccessible } from '../game/townAccess'
import { isNoDamageMode } from '../game/debug'
import { syncPlayerCommanderToBase } from '../game/engine/helpers'
import { setCurrentWorldLocation, markNodeCleared, isNodeCleared } from '../game/world/worldState'
import { WORLD_MAP_NODES, type WorldNodeDef } from '../data/world/worldMapDef'
import { buildMerchantItems, BROKEN_RELIC_ITEMS } from './merchantItems'
import { STANCE_RULES_BY_NODE_TYPE } from './screens'
import type { MerchantItem } from '../components/campaign/MerchantScreen'
import type { CampChoice } from '../components/campaign/CampScreen'
import type { HubWorldData } from '../data/hub/hubWorldFactory'
import type { RelicSpinData } from './AppContext'
import type { Screen } from './screens'
import memoryFragmentsData from '../data/memoryFragments.json'
import bossEpiloguesData from '../data/bossEpilogues.json'
import rollbar from '../rollbar'

/**
 * The whole campaign run flow: launching an act, selecting a node, resolving
 * every node type, winning/losing a battle, completing an act, and abandoning
 * or retrying a run.
 *
 * Dependencies are passed as one named object rather than positionally. Many of
 * them are structurally identical (a dozen `Dispatch<SetStateAction<boolean>>`),
 * so positional arguments would let a swap typecheck silently; with shorthand
 * property syntax at the call site, a swap requires deliberately writing the
 * wrong name against the right key.
 */
export interface UseCampaignFlowArgs {
  // ── Run + act state ───────────────────────────────────────────────────────
  run:      RunState | null
  setRun:   Dispatch<SetStateAction<RunState | null>>
  runRef:   MutableRefObject<RunState | null>
  actData:  Act | null
  gameState: GameState | null
  dispatch:  Dispatch<BattleAction>
  setScreen: Dispatch<SetStateAction<Screen>>
  setCrystals: Dispatch<SetStateAction<number>>
  setFatiguedCards: Dispatch<SetStateAction<string[]>>

  // ── Battle entry ──────────────────────────────────────────────────────────
  startBattle:       (gs: GameState) => void
  rollRareEvent:     () => void
  handleStreakReset: () => void
  handleMainMenu:    () => void

  // ── Hub / world ───────────────────────────────────────────────────────────
  hubData:          HubWorldData | null
  enabledTownIds:   Set<string>
  bypassTownAccess: boolean
  setCurrentLocationKey: Dispatch<SetStateAction<string>>

  // ── Node-screen state ─────────────────────────────────────────────────────
  bossDialogueNode:    QuestNode | null
  setBossDialogueNode: Dispatch<SetStateAction<QuestNode | null>>
  setActiveEvent:      Dispatch<SetStateAction<EventData | null>>
  merchantItems:       MerchantItem[]
  setMerchantItems:    Dispatch<SetStateAction<MerchantItem[]>>
  mysteryReward:       RewardDef | null
  setMysteryReward:    Dispatch<SetStateAction<RewardDef | null>>
  activeMemoryFragment: { fragment: MemoryFragment; alreadyFound: boolean; shardBonus: boolean } | null
  setActiveMemoryFragment: Dispatch<SetStateAction<{ fragment: MemoryFragment; alreadyFound: boolean; shardBonus: boolean } | null>>
  activeCharacterEncounter: { nodeId: string; characterId: string } | null
  setActiveCharacterEncounter: Dispatch<SetStateAction<{ nodeId: string; characterId: string } | null>>
  campNode:      QuestNode | null
  setCampNode:   Dispatch<SetStateAction<QuestNode | null>>
  setCampResult: Dispatch<SetStateAction<string | null>>
  setFoundItem:  Dispatch<SetStateAction<Omit<UselessItem, 'acquiredDate'> | null>>
  setCutscenePanels:  Dispatch<SetStateAction<CutscenePanel[]>>
  setEpiloguePanels:  Dispatch<SetStateAction<CutscenePanel[]>>
  setRewardChoices:   Dispatch<SetStateAction<string[]>>
  setRewardCrystals:  Dispatch<SetStateAction<number>>
  setCardRestCandidates: Dispatch<SetStateAction<string[]>>
  setCardRestPlayCounts: Dispatch<SetStateAction<Record<string, number>>>
  setBonusPackCards:     Dispatch<SetStateAction<string[]>>
  setRelicSpinData:      Dispatch<SetStateAction<RelicSpinData | null>>
  setDeckWarningNode:    Dispatch<SetStateAction<QuestNode | null>>
  setCampaignRestingAlert:    Dispatch<SetStateAction<boolean>>
  setCampaign2AbandonConfirm: Dispatch<SetStateAction<boolean>>
  setPendingEventCard:  Dispatch<SetStateAction<string | null>>
  setPendingBattleFn:   Dispatch<SetStateAction<(() => void) | null>>
  setPendingBattleIsCampaign: Dispatch<SetStateAction<boolean>>
  setExoticDrop:        Dispatch<SetStateAction<string | null>>
  setAchievementToasts: Dispatch<SetStateAction<AchievementDef[]>>
  setQuestCompletes:    Dispatch<SetStateAction<QuestChainDef[]>>

  // ── Flow continuations ────────────────────────────────────────────────────
  cutsceneDoneRef:    MutableRefObject<() => void>
  epilogueDoneRef:    MutableRefObject<(() => void) | null>
  relicSelectDoneRef: MutableRefObject<(relicName: string | null) => void>
  cardRestActDoneRef: MutableRefObject<(() => void) | null>
  brokenRelicRef:     MutableRefObject<{ name: string; icon: string } | null>
  merchantBoughtRef:  MutableRefObject<number>
  skipDeckWarningRef: MutableRefObject<boolean>
  replayBriefingRef:  MutableRefObject<{
    actId: string
    completionCount: number
    lastRunFailed: boolean
    actHasUncollectedFragment: boolean
    proceed: (chosenCount: number) => void
  } | null>

  // ── Battle-mode flags (owned by App; every launch path resets its own set) ─
  isCampaignRef:         MutableRefObject<boolean>
  isDailyChallengeRef:   MutableRefObject<boolean>
  isWeeklyChallengeRef:  MutableRefObject<boolean>
  worldBattleNodeIdRef:  MutableRefObject<string | null>
  battleFlawlessRef:     MutableRefObject<boolean>
  battleAllLegendaryRef: MutableRefObject<boolean>
  battleUsedStructure:   MutableRefObject<boolean>
  battleUsedMobileUnit:  MutableRefObject<boolean>
  campaignPlayCountsRef: MutableRefObject<Record<string, number>>
  prevPlayerUnitsRef:    MutableRefObject<Map<string, string>>
  prevOpponentUnitsRef:  MutableRefObject<Map<string, string>>
}

export function useCampaignFlow({
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
}: UseCampaignFlowArgs) {
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

  return {
    launchCampaign, handleCampaign, handleCampaign2, handleWorldBattle,
    goToWorldLocation, handleWorldBattleRetry, handleSelectNode,
    handleBossDialogueDone, handleEventChoice, handleMerchantBuy, handleMerchantDone,
    handleMysteryCollect, handleCharacterDone, handleMemoryCollect,
    handleUseConsumable, handleCampaignWin, handleRewardPick, handleRewardSkip,
    handleCampChoice, handleCampContinue, handleActComplete, handleCardRestConfirm,
    handleStarterPackPick, handleCampaignRetry, handleAbandonRun,
  }
}
