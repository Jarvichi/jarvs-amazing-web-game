import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { User } from 'firebase/auth'
import { OverlayScreen } from '../ui/OverlayScreen'
import { HubTownCanvas, getSavedHubTile } from './HubTownCanvas'
import { AreaNameBadge } from './AreaNameBadge'
import { HubReturnButton } from './HubReturnButton'
import { HubDialogue } from './HubDialogue'
import type { DialogueChoice } from './HubDialogue'
import { QuestsModal } from './QuestsModal'
import { TreasureModal } from './TreasureModal'
import { Toolbar } from '../ui/Toolbar/Toolbar'
import { ToolbarButton } from '../ui/Toolbar/ToolbarButton'
import { ToolbarLabel } from '../ui/Toolbar/ToolbarLabel'
import { ToolbarSpacer } from '../ui/Toolbar/ToolbarSpacer'
import type { HubLocationData } from '../../data/hub/locationTypes'
import type { HubQuestDef } from '../../data/hub/questDefs'
import type { HubTreasure } from '../../data/hub/loader'
import { getPickedUpIds, markPickedUp, unmarkPickedUp } from '../../game/hub/pickups'
import { getQuestState, setQuestStatus, incrementQuestProgress, getQuestProgress, resetQuest } from '../../game/hub/quests'
import { loadCrystals, saveCrystals, addCardsToCollection, loadDeck } from '../../game/collection'
import { getCardCatalog } from '../../game/cards'
import { getCollectibles, addCollectible } from '../../game/itemStore'
import { getCollectedTreasureIds, markTreasureCollected } from '../../game/hub/treasures'
import { getFriendshipLevel, addFriendshipXp } from '../../game/hub/friendship'
import { useHubClock } from '../../hooks/useHubClock'
import { CommanderState } from '../../game/commander'

const T = 32

interface QuestEvent {
  speakerName: string
  text: string
  choices?: DialogueChoice[]
  onClose?: () => void
}

function checkPrerequisite(prereq: string): boolean {
  return prereq.split('|').every(p => {
    const part = p.trim()
    if (part.startsWith('friendship:')) {
      const parts = part.split(':')
      return getFriendshipLevel(parts[1]) >= parseInt(parts[2] ?? '1')
    }
    if (part.startsWith('quest:')) {
      return getQuestState(part.slice(6)).status === 'completed'
    }
    return true
  })
}

function isQuestReadyToComplete(quest: HubQuestDef): boolean {
  return quest.steps.every(step => getQuestProgress(quest.id, step.key) >= step.required)
}

function getActiveDialogue(quest: HubQuestDef): string {
  const { activeDialogue } = quest
  if (typeof activeDialogue === 'string') return activeDialogue
  for (const step of quest.steps) {
    if (getQuestProgress(quest.id, step.key) < step.required) {
      return activeDialogue[step.key] ?? Object.values(activeDialogue)[0]
    }
  }
  return Object.values(activeDialogue)[Object.values(activeDialogue).length - 1]
}

function formatQuestReward(reward: HubQuestDef['reward']): string {
  const parts: string[] = []
  if (reward.crystals)    parts.push(`+${reward.crystals} 💎`)
  if (reward.collectible) parts.push(`${reward.collectible.icon} ${reward.collectible.name}`)
  if (reward.card)        parts.push(`🃏 ${reward.card.name} (card)`)
  return parts.length > 0 ? `You received: ${parts.join('  ·  ')}` : ''
}

function grantQuestReward(quest: HubQuestDef): void {
  const { reward } = quest
  if (reward.crystals) saveCrystals(loadCrystals() + reward.crystals)
  if (reward.collectible) {
    const { id, name, icon, desc } = reward.collectible
    addCollectible(id, { name, icon, desc })
  }
  if (reward.card) {
    addCardsToCollection([{ cardName: reward.card.name, count: reward.card.count ?? 1 }])
  }
  if (reward.friendship) {
    for (const [npcId, xp] of Object.entries(reward.friendship)) {
      addFriendshipXp(npcId, xp)
    }
  }
}

interface Props {
  locationData:    HubLocationData
  questDefs:       HubQuestDef[]
  allQuestDefs:    HubQuestDef[]
  user:            User | null
  crystals?:       number
  commander?:      CommanderState
  onBack:          () => void
  onCrystalsChange?: (n: number) => void
  onFeedback?:     () => void
}

export function HubLocationWorld({
  locationData, questDefs, allQuestDefs, crystals = 0, commander,
  onBack, onCrystalsChange, onFeedback,
}: Props) {
  const allNpcs = locationData.HUB_NPCS

  const [currentArea,    setCurrentArea]    = useState<string | null>(null)
  const [dialogueLine,   setDialogueLine]   = useState<string | null>(null)
  const [dialogueEvent,  setDialogueEvent]  = useState<QuestEvent | null>(null)
  const [interiorActive, setInteriorActive] = useState(false)
  const [pickedUpIds,    setPickedUpIds]    = useState<Set<string>>(() => getPickedUpIds())
  const [questsOpen,     setQuestsOpen]     = useState(false)
  const [openTreasure,   setOpenTreasure]   = useState<HubTreasure | null>(null)
  const [collectedTreasureIds] = useState<Set<string>>(() => getCollectedTreasureIds())
  const [_tick,          setTick]           = useState(0)
  const refreshState = useCallback(() => setTick(t => t + 1), [])

  const { gameHour } = useHubClock()

  // Quest NPC state: read imperatively by PixiJS ticker
  const questNpcStateRef = useRef(new Map<string, 'offer' | 'ready' | null>())
  {
    const m = new Map<string, 'offer' | 'ready' | null>()
    const activeCount = questDefs.filter(q => getQuestState(q.id).status === 'active').length
    const atCap = activeCount >= 2
    for (const quest of questDefs) {
      const state = getQuestState(quest.id)
      if (state.status === 'available') {
        const prereqMet = !quest.prerequisite || checkPrerequisite(quest.prerequisite)
        if (prereqMet && !atCap) m.set(quest.giverNpcId, 'offer')
      } else if (state.status === 'active') {
        if (isQuestReadyToComplete(quest)) m.set(quest.receiverNpcId, 'ready')
      }
    }
    // Cross-location: mark receiver NPCs that are in this location
    for (const quest of allQuestDefs) {
      if (questDefs.some(q => q.id === quest.id)) continue
      if (getQuestState(quest.id).status === 'active' && isQuestReadyToComplete(quest)) {
        if (allNpcs.some(n => n.id === quest.receiverNpcId)) m.set(quest.receiverNpcId, 'ready')
      }
    }
    questNpcStateRef.current = m
  }

  const activeQuestIdsRef = useRef(new Set<string>())
  {
    const s = new Set<string>()
    for (const quest of questDefs) {
      if (getQuestState(quest.id).status === 'active') s.add(quest.id)
    }
    activeQuestIdsRef.current = s
  }

  const completedQuestIdsRef = useRef(new Set<string>())
  {
    const s = new Set<string>()
    for (const quest of questDefs) {
      if (getQuestState(quest.id).status === 'completed') s.add(quest.id)
    }
    completedQuestIdsRef.current = s
  }

  const scrollRef        = useRef<HTMLDivElement>(null)
  const returnRef        = useRef<(() => void) | null>(null)
  const interiorEnterRef = useRef<((buildingId: string) => void) | null>(null)
  const interiorExitRef  = useRef<(() => void) | null>(null)

  const unitCards = useMemo(() => {
    const deck    = loadDeck()
    const catalog = getCardCatalog()
    const names   = new Set(deck.map(e => e.cardName))
    return catalog.filter(c => c.cardType === 'unit' && names.has(c.name)).map(c => c.name)
  }, [])

  const doorKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const c of getCollectibles()) keys.add(c.id)
    return keys
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_tick])

  // Auto-dismiss non-choice dialogues after 15 s
  useEffect(() => {
    const hasContent = !!(dialogueEvent?.text ?? dialogueLine)
    const hasChoices = !!(dialogueEvent?.choices?.length)
    if (!hasContent || hasChoices) return
    const after = dialogueEvent?.onClose
    const id = setTimeout(() => { setDialogueEvent(null); setDialogueLine(null); after?.() }, 15_000)
    return () => clearTimeout(id)
  }, [dialogueEvent, dialogueLine])

  const handleAvatarMove = useCallback((px: number, py: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = px - el.clientWidth  / 2
    el.scrollTop  = py - el.clientHeight / 2
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const saved = getSavedHubTile(locationData.TOWN_NAME)
    const px = saved ? saved[0] * T + T / 2 : locationData.AVATAR_START[0] * T + T / 2
    const py = saved ? saved[1] * T + T / 2 : locationData.AVATAR_START[1] * T + T / 2
    el.scrollLeft = px - el.clientWidth  / 2
    el.scrollTop  = py - el.clientHeight / 2
  }, [locationData])

  const handleNodeInteract = useCallback((screen: string) => {
    if (screen.startsWith('interior:')) {
      interiorEnterRef.current?.(screen.slice(9))
      return
    }
    if (screen === 'worldmap') { onBack(); return }
  }, [onBack])

  const handleQuestAbandon = useCallback((questId: string) => {
    const quest = questDefs.find(q => q.id === questId)
    if (!quest) return
    const pickupIds = quest.steps.flatMap(s => s.pickupIds ?? [])
    unmarkPickedUp(pickupIds)
    resetQuest(questId)
    setPickedUpIds(getPickedUpIds())
    refreshState()
  }, [questDefs, refreshState])

  const handleTreasureStep = useCallback((id: string) => {
    const treasure = locationData.HUB_TREASURES.find(t => t.id === id)
    if (!treasure) return
    markTreasureCollected(id)
    const { reward } = treasure
    if (reward.crystals) { saveCrystals(loadCrystals() + reward.crystals); onCrystalsChange?.(loadCrystals()) }
    if (reward.collectible) {
      const { id: cid, name, icon, desc } = reward.collectible
      addCollectible(cid, { name, icon, desc })
    }
    setOpenTreasure(treasure)
    refreshState()
  }, [locationData, onCrystalsChange, refreshState])

  const handleItemPickup = useCallback((id: string, questId?: string) => {
    markPickedUp(id)
    setPickedUpIds(getPickedUpIds())
    if (!questId) return
    const quest = [...questDefs, ...allQuestDefs].find(q => q.id === questId)
    if (!quest || getQuestState(questId).status !== 'active') return
    let pickedStep: typeof quest.steps[0] | undefined
    for (const step of quest.steps) {
      if (step.type === 'collect' && step.pickupIds?.includes(id)) {
        incrementQuestProgress(questId, step.key)
        pickedStep = step
        break
      }
    }
    refreshState()
    if (!pickedStep) return
    const allCollectDone = quest.steps.filter(s => s.type === 'collect')
      .every(s => getQuestProgress(questId, s.key) >= s.required)
    const speakerName = quest.title
    if (allCollectDone) {
      const receiverNpc = allNpcs.find(n => n.id === quest.receiverNpcId)
      const npcName = receiverNpc?.name ?? 'the quest giver'
      setDialogueEvent({ speakerName, text: `All items found! Return to ${npcName} to complete the quest.` })
    } else {
      const progress = getQuestProgress(questId, pickedStep.key)
      const countSuffix = pickedStep.required > 1 ? ` (${progress}/${pickedStep.required})` : ''
      setDialogueEvent({ speakerName, text: `Item collected${countSuffix}. ${getActiveDialogue(quest)}` })
    }
  }, [questDefs, allQuestDefs, allNpcs, refreshState])

  const handleDoorLocked = useCallback((_buildingId: string, requiredItem: string) => {
    if (requiredItem.startsWith('closed:')) {
      const h = parseInt(requiredItem.slice(7))
      setDialogueLine(`This building is closed right now. Opens at ${String(h).padStart(2, '0')}:00.`)
    } else if (requiredItem === 'closed') {
      setDialogueLine('This building is closed right now. Come back later.')
    } else if (requiredItem.startsWith('quest:')) {
      setDialogueLine("This passage is sealed. You'll need to discover it first.")
    } else {
      setDialogueLine(`This door is locked. You need a ${requiredItem.replace(/-/g, ' ')} to enter.`)
    }
  }, [])

  const handleNpcTap = useCallback((line: string, npcId: string) => {
    const npcDef = allNpcs.find(n => n.id === npcId)
    const speakerName = npcDef?.name ?? ''

    // Cross-location & local quest completion (active quests with this NPC as receiver)
    const receiveQuestIds = npcDef?.questReceive
      ? (Array.isArray(npcDef.questReceive) ? npcDef.questReceive : [npcDef.questReceive])
      : []
    const allCandidates = allQuestDefs.filter(q =>
      receiveQuestIds.includes(q.id) || q.receiverNpcId === npcId
    )
    for (const quest of allCandidates) {
      if (getQuestState(quest.id).status !== 'active') continue
      for (const step of quest.steps) {
        if (step.type === 'deliver' && step.targetNpcId === npcId) {
          incrementQuestProgress(quest.id, step.key)
          break
        }
      }
      if (isQuestReadyToComplete(quest)) {
        setQuestStatus(quest.id, 'completed')
        grantQuestReward(quest)
        if (quest.reward.crystals) onCrystalsChange?.(loadCrystals())
        refreshState()
        const rewardText = formatQuestReward(quest.reward)
        setDialogueEvent({
          speakerName,
          text: quest.completeDialogue,
          ...(rewardText ? { onClose: () => setDialogueEvent({ speakerName: '', text: rewardText }) } : {}),
        })
        return
      }
    }

    // Active local quest from this giver
    const giveQuests = questDefs.filter(q => q.giverNpcId === npcId)
    for (const quest of giveQuests) {
      if (getQuestState(quest.id).status !== 'active') continue
      if (quest.receiverNpcId === npcId && isQuestReadyToComplete(quest)) {
        setQuestStatus(quest.id, 'completed')
        grantQuestReward(quest)
        if (quest.reward.crystals) onCrystalsChange?.(loadCrystals())
        refreshState()
        const rewardText = formatQuestReward(quest.reward)
        setDialogueEvent({
          speakerName,
          text: quest.completeDialogue,
          ...(rewardText ? { onClose: () => setDialogueEvent({ speakerName: '', text: rewardText }) } : {}),
        })
        return
      }
      setDialogueEvent({ speakerName, text: getActiveDialogue(quest) })
      return
    }

    // Offer an available quest
    const atCap = questDefs.filter(q => getQuestState(q.id).status === 'active').length >= 2
    for (const quest of giveQuests) {
      if (getQuestState(quest.id).status !== 'available') continue
      if (!quest.prerequisite || checkPrerequisite(quest.prerequisite)) {
        if (atCap) break
        setDialogueEvent({
          speakerName,
          text: quest.offerDialogue,
          choices: [
            {
              label: 'Accept',
              primary: true,
              onClick: () => {
                const count = questDefs.filter(q => getQuestState(q.id).status === 'active').length
                if (count >= 2) {
                  setDialogueEvent({ speakerName, text: "You're working on 2 quests. Finish one first." })
                  return
                }
                setQuestStatus(quest.id, 'active')
                activeQuestIdsRef.current.add(quest.id)
                refreshState()
                setDialogueEvent(null)
              },
            },
            { label: 'Not now', onClick: () => setDialogueEvent(null) },
          ],
        })
        return
      }
    }

    // Default dialogue line from NPC def
    setDialogueEvent({ speakerName, text: line })
  }, [allNpcs, questDefs, allQuestDefs, onCrystalsChange, refreshState])

  return (
    <OverlayScreen title="JARVS AMAZING WEB GAME">
      <Toolbar>
        <ToolbarLabel className="title-deck-info">⚔ {locationData.TOWN_NAME}</ToolbarLabel>
        <ToolbarLabel className="title-deck-info">💎 {crystals.toLocaleString()}</ToolbarLabel>
        <ToolbarButton icon="📜" title="Quests" onClick={() => setQuestsOpen(true)} />
        <ToolbarSpacer />
        <ToolbarButton icon="🗺" title="World Map" onClick={onBack} />
        {onFeedback && (
          <ToolbarButton icon="🗣️" title="Send feedback" onClick={onFeedback} />
        )}
      </Toolbar>

      <div className="nm-map nm-map--camp" style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'auto', width: '100%', height: '100%' }}>
          <HubTownCanvas
            onAreaEnter={setCurrentArea}
            onNodeInteract={handleNodeInteract}
            onAvatarMove={handleAvatarMove}
            returnRef={returnRef}
            unitCards={unitCards}
            commander={commander}
            onNpcTap={handleNpcTap}
            interiorEnterRef={interiorEnterRef}
            interiorExitRef={interiorExitRef}
            onEnterInterior={() => setInteriorActive(true)}
            onExitInterior={() => setInteriorActive(false)}
            pickedUpIds={pickedUpIds}
            onItemPickup={handleItemPickup}
            doorKeys={doorKeys}
            onDoorLocked={handleDoorLocked}
            questNpcState={questNpcStateRef}
            activeQuestIdsRef={activeQuestIdsRef}
            completedQuestIdsRef={completedQuestIdsRef}
            collectedTreasureIds={collectedTreasureIds}
            onTreasureStep={handleTreasureStep}
            gameHour={gameHour}
            isNight={false}
            locationData={locationData}
          />
        </div>

        {currentArea && !interiorActive && !dialogueLine && !dialogueEvent && (
          <AreaNameBadge name={currentArea} />
        )}
        {interiorActive && (
          <HubReturnButton onClick={() => { interiorExitRef.current?.(); setInteriorActive(false) }} />
        )}
        {(dialogueLine || dialogueEvent) && (
          <HubDialogue
            line={dialogueLine ?? dialogueEvent?.text ?? ''}
            speakerName={dialogueEvent?.speakerName}
            choices={dialogueEvent?.choices}
            onClose={() => {
              const after = dialogueEvent?.onClose
              setDialogueEvent(null)
              setDialogueLine(null)
              after?.()
            }}
          />
        )}
      </div>

      {questsOpen && (
        <QuestsModal
          questDefs={questDefs}
          onAbandon={handleQuestAbandon}
          onClose={() => setQuestsOpen(false)}
        />
      )}
      {openTreasure && (
        <TreasureModal
          treasure={openTreasure}
          onClose={() => setOpenTreasure(null)}
        />
      )}
    </OverlayScreen>
  )
}
