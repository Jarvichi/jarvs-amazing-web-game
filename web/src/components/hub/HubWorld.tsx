import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { HubTownCanvas } from './HubTownCanvas'
import { AreaNameBadge } from './AreaNameBadge'
import { HubReturnButton } from './HubReturnButton'
import { HubDialogue } from './HubDialogue'
import type { DialogueChoice } from './HubDialogue'
import { AVATAR_START, MAP_W, MAP_H } from '../../data/hubLayout'
import { loadDeck, loadCollection, loadCrystals, saveCrystals } from '../../game/collection'
import { getCardCatalog } from '../../game/cards'
import { CommanderState } from '../../game/commander'
import { loadSkipIntro } from '../screens/SettingsScreen'
import { getSavedHubTile } from './HubTownCanvas'
import { Toolbar } from '../ui/Toolbar/Toolbar'
import { ToolbarLabel } from '../ui/Toolbar/ToolbarLabel'
import { ToolbarButton } from '../ui/Toolbar/ToolbarButton'
import { ToolbarSpacer } from '../ui/Toolbar/ToolbarSpacer'
import { User } from 'firebase/auth'
import { loadPlayerName } from '../../game/questline'
import { LoginButton } from '../ui/LoginButton'
import { HUB_NPCS } from '../../data/hubConfigLoader'
import { HUB_QUEST_DEFS, INN_RUMOURS, FRIENDSHIP_DIALOGUE } from '../../data/hubQuestDefs'
import type { HubQuestDef } from '../../data/hubQuestDefs'
import { getPickedUpIds, markPickedUp, unmarkPickedUp } from '../../game/hubPickups'
import { getFriendshipLevel, addFriendshipXp, getFriendshipData } from '../../game/hubFriendship'
import { getQuestState, setQuestStatus, incrementQuestProgress, getQuestProgress, resetQuest } from '../../game/hubQuests'
import { getHeardConvoIds, markConvoHeard } from '../../game/hubInnConvos'
import { addCollectible, getCollectibles } from '../../game/itemStore'
import { QuestsModal } from './QuestsModal'

const T = 32
const INITIAL_SCROLL = {
  x: AVATAR_START[0] * T + T / 2,
  y: AVATAR_START[1] * T + T / 2,
}
const SPLASH_MS = 10_000

let _hubSplashShown = false

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
  // Chain quest: find first incomplete step and return its hint
  for (const step of quest.steps) {
    if (getQuestProgress(quest.id, step.key) < step.required) {
      return activeDialogue[step.key] ?? Object.values(activeDialogue)[0]
    }
  }
  return Object.values(activeDialogue)[Object.values(activeDialogue).length - 1]
}

function getNpcDisplayName(npcId: string): string {
  return HUB_NPCS.find(n => n.id === npcId)?.name ?? npcId
}

interface Props {
  onBack:             () => void
  onNavigate?:        (screen: string) => void
  onCampaign?:        () => void
  onPlayerTap?:       () => void
  crystals?:          number
  isSignedIn?:        boolean
  commander?: CommanderState
  user: User | null
  onSignIn?:   () => void
  onSignOut?:         () => void
  onFeedback: () => void
  onTileTap?:         (tx: number, ty: number) => void
}

export function HubWorld({ onBack, onNavigate, onCampaign, onPlayerTap, crystals = 0, isSignedIn = false, commander, user, onSignIn: onLoginToggle, onSignOut, onFeedback, onTileTap }: Props) {
  const [splashVisible, setSplashVisible] = useState(() => !_hubSplashShown && !loadSkipIntro())
  const [splashFading,  setSplashFading]  = useState(false)
  const [currentArea,    setCurrentArea]    = useState<string | null>(null)
  const [dialogueLine,   setDialogueLine]   = useState<string | null>(null)
  const [dialogueEvent,  setDialogueEvent]  = useState<QuestEvent | null>(null)
  const [interiorActive, setInteriorActive] = useState(false)
  const [pickedUpIds,    setPickedUpIds]    = useState<Set<string>>(() => getPickedUpIds())
  const [questsOpen,     setQuestsOpen]     = useState(false)
  // Refresh friendship/quest state after interactions (lightweight — just reads localStorage)
  const [_tick, setTick] = useState(0)
  const refreshState = useCallback(() => setTick(t => t + 1), [])

  // Quest NPC state: maps npcId → 'offer' | 'ready' | null, read imperatively by PixiJS ticker
  const questNpcStateRef = useRef(new Map<string, 'offer' | 'ready' | null>())
  {
    const m = new Map<string, 'offer' | 'ready' | null>()
    for (const quest of HUB_QUEST_DEFS) {
      const state = getQuestState(quest.id)
      if (state.status === 'available') {
        const prereqMet = !quest.prerequisite || checkPrerequisite(quest.prerequisite)
        if (prereqMet) m.set(quest.giverNpcId, 'offer')
      } else if (state.status === 'active') {
        if (isQuestReadyToComplete(quest)) m.set(quest.receiverNpcId, 'ready')
      }
    }
    questNpcStateRef.current = m
  }

  // Active quest IDs: read imperatively by PixiJS ticker to gate pickup visibility
  const activeQuestIdsRef = useRef(new Set<string>())
  {
    const s = new Set<string>()
    for (const quest of HUB_QUEST_DEFS) {
      if (getQuestState(quest.id).status === 'active') s.add(quest.id)
    }
    activeQuestIdsRef.current = s
  }

  const scrollRef        = useRef<HTMLDivElement>(null)
  const returnRef        = useRef(null) as React.MutableRefObject<(() => void) | null>
  const interiorEnterRef = useRef<((buildingId: string) => void) | null>(null)
  const interiorExitRef  = useRef<(() => void) | null>(null)
  const playerName = loadPlayerName()

  const unitCards = useMemo(() => {
    const deck    = loadDeck()
    const catalog = getCardCatalog()
    const names   = new Set(deck.map(e => e.cardName))
    return catalog
      .filter(c => c.cardType === 'unit' && names.has(c.name))
      .map(c => c.name)
  }, [])

  // Secret #9 — Wrong Save File: rare title-screen glitch showing fake stats
  const [wrongSave, setWrongSave] = useState<{ cards: number; crystals: number; deck: number } | null>(null)
  useEffect(() => {
    if (Math.random() > 0.02) return
    const fake = {
      cards:    Math.floor(Math.random() * catalogTotal),
      crystals: Math.floor(Math.random() * 9999),
      deck:     Math.floor(Math.random() * 10),
    }
    setWrongSave(fake)
    const id = setTimeout(() => setWrongSave(null), 1800)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { collectionCount, catalogTotal } = useMemo(() => {
    const catalog    = getCardCatalog()
    const collection = loadCollection()
    return {
      collectionCount: collection.filter(
        e => e.count > 0 && catalog.some(c => c.name === e.cardName)
      ).length,
      catalogTotal: catalog.length,
    }
  }, [])

  // Keys the player currently holds (determines locked door access)
  const doorKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const c of getCollectibles()) keys.add(c.id)
    return keys
  // Recompute when quest state changes (quest rewards add keys)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_tick])

  const dismissSplash = useCallback(() => {
    _hubSplashShown = true
    setSplashFading(true)
    setTimeout(() => setSplashVisible(false), 500)
  }, [])

  useEffect(() => {
    if (!splashVisible) return
    const t = setTimeout(dismissSplash, SPLASH_MS)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAvatarMove = useCallback((px: number, py: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = px - el.clientWidth  / 2
    el.scrollTop  = py - el.clientHeight / 2
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const saved = getSavedHubTile()
    const px = saved ? saved[0] * T + T / 2 : INITIAL_SCROLL.x
    const py = saved ? saved[1] * T + T / 2 : INITIAL_SCROLL.y
    el.scrollLeft = px - el.clientWidth  / 2
    el.scrollTop  = py - el.clientHeight / 2
  }, [])

  const handleNodeInteract = useCallback((screen: string) => {
    if (screen.startsWith('interior:')) {
      const buildingId = screen.slice(9)
      setInteriorActive(true)
      interiorEnterRef.current?.(buildingId)
      return
    }
    if (screen === 'campaign') { onCampaign?.(); return }
    if (screen === 'commander' && !commander) {
      setDialogueEvent({ speakerName: "Commander's Post", text: "No commander has been assigned yet. Visit the title screen to choose one." })
      return
    }
    onNavigate?.(screen)
  }, [onNavigate, onCampaign, commander])

  const handleReturn = useCallback(() => {
    returnRef.current?.()
  }, [])

  const handleLeaveInterior = useCallback(() => {
    interiorExitRef.current?.()
    setInteriorActive(false)
  }, [])

  const handleQuestAbandon = useCallback((questId: string) => {
    const quest = HUB_QUEST_DEFS.find(q => q.id === questId)
    if (!quest) return
    const pickupIds = quest.steps.flatMap(s => s.pickupIds ?? [])
    unmarkPickedUp(pickupIds)
    resetQuest(questId)
    setPickedUpIds(getPickedUpIds())
    refreshState()
  }, [refreshState])

  const handleItemPickup = useCallback((id: string, questId?: string) => {
    markPickedUp(id)
    setPickedUpIds(getPickedUpIds())

    if (!questId) return

    const quest = HUB_QUEST_DEFS.find(q => q.id === questId)
    if (!quest) return
    const state = getQuestState(questId)
    if (state.status !== 'active') return

    // Find which step this pickup belongs to and increment progress
    for (const step of quest.steps) {
      if (step.type === 'collect' && step.pickupIds?.includes(id)) {
        incrementQuestProgress(questId, step.key)
        break
      }
    }
    refreshState()
  }, [refreshState])

  const handleDoorLocked = useCallback((buildingId: string, requiredItem: string) => {
    const itemName = requiredItem.replace(/-/g, ' ')
    setDialogueLine(`This door is locked. You need a ${itemName} to enter.`)
  }, [])

  const handleNpcTap = useCallback((line: string, npcId: string) => {
    const npcDef = HUB_NPCS.find(n => n.id === npcId)
    const speakerName = npcDef?.name ?? ''

    // ── Inn rumour handling (Innkeeper Rosie) ───────────────────────────────
    if (npcId === 'innkeeper-rosie' && npcDef?.innRumours) {
      const heard = getHeardConvoIds()
      const unheard = npcDef.innRumours.filter(r => !heard.has(r.id))
      if (unheard.length > 0) {
        const rumour = unheard[0]
        markConvoHeard(rumour.id)
        setDialogueEvent({ speakerName, text: rumour.text })
        return
      }
    }

    // ── Quest completion (receiver NPC tapped) ──────────────────────────────
    if (npcDef?.questReceive) {
      const receiveIds = Array.isArray(npcDef.questReceive) ? npcDef.questReceive : [npcDef.questReceive]
      for (const questId of receiveIds) {
        const quest = HUB_QUEST_DEFS.find(q => q.id === questId)
        if (quest && getQuestState(quest.id).status === 'active') {
          for (const step of quest.steps) {
            if (step.type === 'deliver' && step.targetNpcId === npcId) {
              incrementQuestProgress(quest.id, step.key)
              break
            }
          }
          if (isQuestReadyToComplete(quest)) {
            setQuestStatus(quest.id, 'completed')
            grantQuestReward(quest)
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
      }
    }

    // ── Quest give/active dialogue ──────────────────────────────────────────
    // Scan ALL quests this NPC gives — not just the first one — so later
    // quests in the chain are offered once earlier ones are completed.
    const giveQuests = HUB_QUEST_DEFS.filter(q => q.giverNpcId === npcId)

    // First pass: active quest (takes priority — show progress or complete)
    for (const quest of giveQuests) {
      if (getQuestState(quest.id).status !== 'active') continue
      if (quest.receiverNpcId === npcId && isQuestReadyToComplete(quest)) {
        setQuestStatus(quest.id, 'completed')
        grantQuestReward(quest)
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

    // Second pass: first available quest whose prerequisites are met
    for (const quest of giveQuests) {
      if (getQuestState(quest.id).status !== 'available') continue
      const prereqMet = !quest.prerequisite || checkPrerequisite(quest.prerequisite)
      if (prereqMet) {
        setDialogueEvent({
          speakerName,
          text: quest.offerDialogue,
          choices: [
            {
              label: 'Accept',
              primary: true,
              onClick: () => {
                setQuestStatus(quest.id, 'active')
                activeQuestIdsRef.current.add(quest.id)
                refreshState()
                setDialogueEvent(null)
              },
            },
            {
              label: 'Not now',
              onClick: () => setDialogueEvent(null),
            },
          ],
        })
        return
      }
    }

    // ── Screen navigation fallthrough (quest done or no active quest) ────────
    if (npcDef?.screen) {
      handleNodeInteract(npcDef.screen)
      return
    }

    // ── Friendship tier dialogue override ───────────────────────────────────
    const friendTiers = FRIENDSHIP_DIALOGUE[npcId]
    if (friendTiers) {
      const level = getFriendshipLevel(npcId)
      const tiers = Object.entries(friendTiers)
        .map(([k, v]) => ({ minLevel: parseInt(k), text: v }))
        .filter(t => level >= t.minLevel)
        .sort((a, b) => b.minLevel - a.minLevel)
      if (tiers.length > 0) {
        setDialogueEvent({ speakerName, text: tiers[0].text })
        return
      }
    }

    // ── Default dialogue ─────────────────────────────────────────────────────
    setDialogueEvent({ speakerName, text: line })
  }, [refreshState, handleNodeInteract])

  return (
    <OverlayScreen title="JARVS AMAZING WEB GAME">
      <Toolbar>
        <ToolbarLabel className={`title-deck-info${wrongSave ? ' title-deck-info--glitch' : ''}`}>💎 {wrongSave ? wrongSave.crystals.toLocaleString() : crystals.toLocaleString()}</ToolbarLabel>
        <ToolbarLabel className={`title-deck-info${wrongSave ? ' title-deck-info--glitch' : ''}`}>🃏 {wrongSave ? wrongSave.cards : collectionCount}/{catalogTotal}</ToolbarLabel>
        <ToolbarButton icon="📜" title="Quests" onClick={() => setQuestsOpen(true)} />
        <ToolbarSpacer/>
        <LoginButton onSignIn={() => onLoginToggle?.()} onSignOut={() => onSignOut?.()} onPlayerTap={onPlayerTap} user={user} playerName={playerName} />
        <ToolbarButton
          className="title-auth-btn"
          onClick={onFeedback}
          title="Send feedback or report a bug"
          icon={'🗣️'}
        />
        <ToolbarButton className="action-btn hub-hud__btn" onClick={onBack} icon={'⚙'}/>
      </Toolbar>

      <div
        className="nm-map nm-map--camp"
        style={{ position: 'relative', flex: 1, overflow: 'hidden' }}
      >
        <div
          ref={scrollRef}
          style={{ overflowX: 'auto', overflowY: 'auto', width: '100%', height: '100%' }}
        >
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
            onExitInterior={() => setInteriorActive(false)}
            onTileTap={onTileTap}
            pickedUpIds={pickedUpIds}
            onItemPickup={handleItemPickup}
            doorKeys={doorKeys}
            onDoorLocked={handleDoorLocked}
            questNpcState={questNpcStateRef}
            activeQuestIdsRef={activeQuestIdsRef}
          />
        </div>
        <AreaNameBadge name={currentArea} />

        {questsOpen && <QuestsModal onClose={() => setQuestsOpen(false)} onAbandon={handleQuestAbandon} />}

        <HubDialogue
          line={dialogueEvent?.text ?? dialogueLine}
          speakerName={dialogueEvent?.speakerName}
          choices={dialogueEvent?.choices}
          onClose={() => {
            const after = dialogueEvent?.onClose
            setDialogueEvent(null)
            setDialogueLine(null)
            after?.()
          }}
        />

        {interiorActive && (
          <button
            className="action-btn"
            style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}
            onClick={handleLeaveInterior}
          >
            LEAVE
          </button>
        )}

        {splashVisible && (
          <div
            className={`hub-splash${splashFading ? ' hub-splash--fading' : ''}`}
            onClick={dismissSplash}
          >
            <div className="title-logo">JARV'S</div>
            <div className="title-subtitle">AMAZING WEB GAME</div>
            <div className="title-logo-ornament">· · · · ·</div>
            <div className="title-deck-info">{collectionCount}/{catalogTotal} cards &nbsp;·&nbsp; 💎 {crystals}</div>
            <p className="hub-splash__hint">tap to continue</p>
          </div>
        )}
      </div>
    </OverlayScreen>
  )
}

// ── Quest reward helpers ───────────────────────────────────────────────────────

function formatQuestReward(reward: HubQuestDef['reward']): string {
  const parts: string[] = []
  if (reward.crystals)    parts.push(`+${reward.crystals} 💎`)
  if (reward.collectible) parts.push(`${reward.collectible.icon} ${reward.collectible.name}`)
  if (reward.friendship) {
    for (const [npcId, xp] of Object.entries(reward.friendship)) {
      parts.push(`+${xp} friendship with ${getNpcDisplayName(npcId)}`)
    }
  }
  return parts.length > 0 ? `You received: ${parts.join('  ·  ')}` : ''
}

function grantQuestReward(quest: HubQuestDef): void {
  const { reward } = quest
  if (reward.crystals) {
    saveCrystals(loadCrystals() + reward.crystals)
  }
  if (reward.collectible) {
    const { id, name, icon, desc } = reward.collectible
    addCollectible(id, { name, icon, desc })
  }
  if (reward.friendship) {
    for (const [npcId, xp] of Object.entries(reward.friendship)) {
      addFriendshipXp(npcId, xp)
    }
  }
}
