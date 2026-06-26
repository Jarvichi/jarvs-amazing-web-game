import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { HubTownCanvas } from './HubTownCanvas'
import { AreaNameBadge } from './AreaNameBadge'
import { HubMinimap } from './HubMinimap'
import type { MinimapObjective } from './HubMinimap'
import { HubReturnButton } from './HubReturnButton'
import { HubDialogue } from './HubDialogue'
import type { DialogueChoice } from './HubDialogue'
import type { HubQuestDef, DialogueTree, DialogueChoiceDef } from '../../data/hub/questDefs'
import { emitSound } from '../../game/sound'
import { getPickedUpIds, markPickedUp, unmarkPickedUp } from '../../game/hub/pickups'
import { getFriendshipLevel, addFriendshipXp, getFriendshipData } from '../../game/hub/friendship'
import { addRelationshipPoints, getRelationship } from '../../game/hub/relationships'
import { setDialogueFlag, hasDialogueFlag, markNodeSeen } from '../../game/hub/dialogueFlags'
import { getQuestState, setQuestStatus, incrementQuestProgress, getQuestProgress, resetQuest } from '../../game/hub/quests'
import { getHeardConvoIds, markConvoHeard } from '../../game/hub/innConvos'
import { loadDeck, loadCollection, loadCrystals, saveCrystals, addCardsToCollection } from '../../game/collection'
import { getCardCatalog } from '../../game/cards'
import { CommanderState } from '../../game/commander'
import { loadSkipIntro } from '../screens/SettingsScreen'
import { getSavedHubTile } from './HubTownCanvas'
import { Toolbar } from '../ui/Toolbar/Toolbar'
import { ToolbarLabel } from '../ui/Toolbar/ToolbarLabel'
import { ToolbarButton } from '../ui/Toolbar/ToolbarButton'
import { ToolbarSpacer } from '../ui/Toolbar/ToolbarSpacer'
import { ToolbarDropdown } from '../ui/Toolbar/ToolbarDropdown'
import { User } from 'firebase/auth'
import { loadPlayerName } from '../../game/questline'
import { LoginButton } from '../ui/LoginButton'
import { addCollectible, addConsumable, getCollectibles } from '../../game/itemStore'
import { QuestsModal } from './QuestsModal'
import { TownDirectory } from './TownDirectory'
import { HubTownUpgrades, type UpgradeRow } from './HubTownUpgrades'
import { nextUpgrade, purchaseUpgrade, getTownReputation, getUpgradeLevel, setUpgradeKindResolver, tributeAmount, tributeAvailable, collectTribute } from '../../game/hub/reputation'
import { RelationshipView } from './RelationshipView'
import { resolveNpcPlace } from '../../game/hub/npcLocator'
import { TreasureModal } from './TreasureModal'
import { getCollectedTreasureIds, markTreasureCollected } from '../../game/hub/treasures'
import { useHubClock } from '../../hooks/useHubClock'
import { formatGameTime, hourInRange } from '../../game/hub/hubClock'
import { getActiveFestival } from '../../game/hub/hubCalendar'
import { getDailyChallengeNPCDialogue } from '../../game/hub/npcDialogue'
import {  ALL_QUESTS, FRIENDSHIP_DIALOGUE, RELATIONSHIP_DIALOGUE, RAVENWATCH } from '../../data/hub/hubWorldFactory'
import { HubInteractable, HubLocationBundle, HubQuestBundle, HubTreasure } from '../../data/hub/loader'
import { getUnreadCount } from '../../game/news'
import { interactableStoreKey, isInteractableGranted, markInteractableGranted, getInteractableMoves, setInteractableMove } from '../../game/hub/interactables'
import { recordNpcMet, recordAnimalSeen, recordAreaSeen } from '../../game/hub/journal'
import rollbar from '../../rollbar'
interface QuestEvent {
  speakerName: string
  text: string
  choices?: DialogueChoice[]
  onClose?: () => void
}

const T = 32

const SPLASH_MS = 10_000

let _hubSplashShown = false



function checkPrerequisite(prereq: string): boolean {
  return prereq.split('|').every(p => {
    const part = p.trim()
    if (part.startsWith('friendship:')) {
      const parts = part.split(':')
      return getFriendshipLevel(parts[1]) >= parseInt(parts[2] ?? '1')
    }
    if (part.startsWith('relationship:')) {
      // relationship:<npcId>:<track>:<level>
      const [, npcId, track, lvl] = part.split(':')
      const rel = getRelationship(npcId)
      return rel.track === track && rel.level >= parseInt(lvl ?? '1')
    }
    if (part.startsWith('quest:')) {
      return getQuestState(part.slice(6)).status === 'completed'
    }
    if (part.startsWith('flag:')) {
      return hasDialogueFlag(part.slice(5))
    }
    return true
  })
}

function isQuestReadyToComplete(quest: HubQuestDef): boolean {
  return quest.steps.every(step => getQuestProgress(quest.id, step.key) >= step.required)
}

// Friendly prompt shown on the "enter this screen" choice for screen NPCs, so
// tapping a screen NPC opens dialogue (where quest options can surface) instead
// of navigating away immediately. Any screen not listed uses a generic label.
const SCREEN_ENTER_LABEL: Record<string, string> = {
  casino:            'Play higher or lower?',
  quickbattle:       'Have a quick battle?',
  campaign:          'Continue the campaign?',
  endless:           'Brave the endless climb?',
  dailychallenge:    'Take the daily challenge?',
  weeklychallenge:   'Take the weekly challenge?',
  deckbuilder:       'Open the deck builder?',
  'collection-tabs': 'View your collection?',
  minigames:         'Play a mini-game?',
  commander:         "Visit the commander's post?",
  'shop-cards':      'Browse the wares?',
  'shop-augments':   'Browse the wares?',
  'shop-supplies':   'Browse the wares?',
  chronicle:         'Read the chronicle?',
  codex:             'Open the codex?',
  'hall-of-achievements': 'Visit the hall of achievements?',
  'home-shelf':      'Look at the shelf?',
  fishing:           'Cast a line?',
  marble:            'Play marbles?',
  marblerace:        'Watch a marble race?',
  tileflip:          'Play tile flip?',
  crystalcatch:      'Play crystal catch?',
  spinner:           'Give it a spin?',
}
function screenEnterLabel(screen: string): string {
  return SCREEN_ENTER_LABEL[screen] ?? 'Step inside?'
}

function getActiveDialogue(quest: HubQuestDef): string {
  const { activeDialogue } = quest
  if (typeof activeDialogue === 'string') return activeDialogue
  // Chain quest: find first incomplete step and return its hint
  for (const step of quest.steps) {
    if (getQuestProgress(quest.id, step.key) < step.required) {
      return activeDialogue[step.key] ?? (Object.values(activeDialogue)[0] || "Oh hello!")
    }
  }
  return Object.values(activeDialogue)[Object.values(activeDialogue).length - 1]  || "Oh hello!"
}



export interface Props {
  onBack:             () => void
  onNavigate?:        (screen: string) => void
  onCampaign?:        () => void
  onEndless?:         () => void
  onWorldMap?:        () => void
  onPlayerTap?:       () => void
  crystals?:          number
  isSignedIn?:        boolean
  commander?: CommanderState
  user: User | null

    locationData:    HubLocationBundle
    locationQuests: HubQuestBundle
    questDefs:       HubQuestDef[]
    allQuestDefs:    HubQuestDef[]

  onSignIn?:   () => void
  onSignOut?:         () => void
  onFeedback: () => void
  onCrystalsChange?:  (n: number) => void
  onTileTap?:         (tx: number, ty: number) => void
}

export function HubWorld({ onBack, onNavigate, onCampaign, onEndless, onWorldMap, onPlayerTap,
  locationData, locationQuests, questDefs, allQuestDefs,
  crystals = 0, isSignedIn = false, commander, user, onSignIn: onLoginToggle, onSignOut, onFeedback, onCrystalsChange, onTileTap }: Props) {
  const [splashVisible, setSplashVisible] = useState(() => !_hubSplashShown && !loadSkipIntro())
  const [splashFading,  setSplashFading]  = useState(false)
  const [currentArea,    setCurrentArea]    = useState<string | null>(null)
  const [dialogueLine,   setDialogueLine]   = useState<string | null>(null)
  const [dialogueEvent,  setDialogueEvent]  = useState<QuestEvent | null>(null)
  const [interiorActive, setInteriorActive] = useState(false)
  const [pickedUpIds,    setPickedUpIds]    = useState<Set<string>>(() => getPickedUpIds())
  const [questsOpen,          setQuestsOpen]          = useState(false)
  const [directoryOpen,       setDirectoryOpen]       = useState(false)
  const [upgradesOpen,        setUpgradesOpen]        = useState(false)
  // buildingId → purchased upgrade level; read each frame by the canvas to
  // reveal unlocked decor live, and updated on purchase.
  const buildingUpgradeLevelsRef = useRef<Record<string, number>>({})
  const [relationshipNpcId,   setRelationshipNpcId]   = useState<string | null>(null)
  const [pinnedNpcId,         setPinnedNpcId]         = useState<string | null>(null)
  const [openTreasure,        setOpenTreasure]        = useState<HubTreasure | null>(null)
  const [collectedTreasureIds] = useState<Set<string>>(() => getCollectedTreasureIds())
  // Refresh friendship/quest state after interactions (lightweight — just reads localStorage)
  const [_tick, setTick] = useState(0)
  const refreshState = useCallback(() => setTick(t => t + 1), [])

  // ── Town reputation & building upgrades ───────────────────────────────────
  const town = locationData.HUB_TOWN_NAME
  // Register how the reputation store resolves a building's upgrade kind, and
  // seed the canvas decor ref with each building's current upgrade level.
  useEffect(() => {
    setUpgradeKindResolver((_t, buildingId) =>
      locationData.HUB_BUILDINGS.find(b => b.id === buildingId)?.upgradeKind)
    const levels: Record<string, number> = {}
    for (const b of locationData.HUB_BUILDINGS) {
      if (b.id && b.upgradeKind) levels[b.id] = getUpgradeLevel(town, b.id)
    }
    buildingUpgradeLevelsRef.current = levels
    return () => setUpgradeKindResolver(null)
  }, [locationData, town])

  // Upgradeable buildings, resolved fresh each render (cheap — a handful).
  const upgradeRows: UpgradeRow[] = locationData.HUB_BUILDINGS
    .filter(b => b.id && b.upgradeKind)
    .map(b => {
      const id = b.id as string
      const name = locationData.HUB_INTERIORS[id]?.name
        ?? id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      const next = nextUpgrade(town, id, b.upgradeKind)
      return { buildingId: id, name, kind: b.upgradeKind as string, level: next.level, total: next.total, next }
    })

  const handleUpgrade = useCallback((buildingId: string) => {
    const b = locationData.HUB_BUILDINGS.find(x => x.id === buildingId)
    const res = purchaseUpgrade(town, buildingId, b?.upgradeKind)
    if (res.ok) {
      onCrystalsChange?.(loadCrystals())
      buildingUpgradeLevelsRef.current[buildingId] = res.newLevel
      refreshState()
    } else {
      const msg = res.reason === 'insufficient-crystals'
        ? "You don't have enough crystals for that upgrade."
        : res.reason === 'rep-locked'
          ? "The town's standing isn't high enough yet — upgrade more first."
          : 'That building is already fully upgraded.'
      setDialogueEvent({ speakerName: 'Town Steward', text: msg })
    }
  }, [locationData, town, onCrystalsChange, refreshState])

  const handleCollectTribute = useCallback(() => {
    const amount = collectTribute(town)
    if (amount > 0) {
      onCrystalsChange?.(loadCrystals())
      refreshState()
      setDialogueEvent({ speakerName: 'Town Steward', text: `The town thanks you for your patronage. 💎 ${amount} crystals!` })
    }
  }, [town, onCrystalsChange, refreshState])

  const { gameHour, isNight: isGameNight } = useHubClock()

  function getNpcDisplayName(npcId: string): string {
    return locationData.HUB_NPCS.find(n => n.id === npcId)?.name
      ?? locationData.HUB_ANIMALS.find(a => a.id === npcId)?.name
      ?? npcId
  }


  // Active festival (real-date driven, with QA override) — gates festival quests + HUD badge.
  const activeFestival = getActiveFestival()

  // Quest NPC state: maps npcId → 'offer' | 'ready' | null, read imperatively by PixiJS ticker
  const questNpcStateRef = useRef(new Map<string, 'offer' | 'ready' | null>())
  {
    // NPCs (and animals) physically present in the current town. Offers only
    // surface on a present giver; 'ready' indicators surface on a present
    // receiver or deliver-target — including for quests accepted in another town.
    const presentNpcs = new Set<string>([
      ...locationData.HUB_NPCS.map(n => n.id),
      ...locationData.HUB_ANIMALS.map(a => a.id),
    ])
    const m = new Map<string, 'offer' | 'ready' | null>()
    const activeCount = allQuestDefs.filter(q => getQuestState(q.id).status === 'active').length
    const atCap = activeCount >= 2
    for (const quest of allQuestDefs) {
      const state = getQuestState(quest.id)
      if (state.status === 'available') {
        if (!presentNpcs.has(quest.giverNpcId)) continue
        const prereqMet = !quest.prerequisite || checkPrerequisite(quest.prerequisite)
        const hoursMet  = !quest.availableHours || hourInRange(gameHour, quest.availableHours.start, quest.availableHours.end)
        const festivalMet = !quest.festivalId || quest.festivalId === activeFestival?.id
        if (prereqMet && hoursMet && festivalMet && !atCap) m.set(quest.giverNpcId, 'offer')
      } else if (state.status === 'active') {
        if (isQuestReadyToComplete(quest) && presentNpcs.has(quest.receiverNpcId)) {
          m.set(quest.receiverNpcId, 'ready')
        } else {
          const pend = quest.steps.find(s =>
            s.type === 'deliver' && !!s.targetNpcId && presentNpcs.has(s.targetNpcId) &&
            getQuestProgress(quest.id, s.key) < s.required)
          if (pend?.targetNpcId) m.set(pend.targetNpcId, 'ready')
        }
      }
    }
    questNpcStateRef.current = m
  }

  // Active quest IDs: read imperatively by PixiJS ticker to gate pickup visibility
  const activeQuestIdsRef = useRef(new Set<string>())
  {
    const s = new Set<string>()
    for (const quest of questDefs) {
      if (getQuestState(quest.id).status === 'active') s.add(quest.id)
    }
    activeQuestIdsRef.current = s
  }

  // Proximity dialogue for named NPCs: dynamic text shown as speech bubbles on approach
  const npcProximityDialogueRef = useRef(new Map<string, { atDistance: number; text: string }[]>())
  npcProximityDialogueRef.current = new Map([
    ['challenge-herald', getDailyChallengeNPCDialogue()],
  ])

  // Interactable indicator conditions (e.g. 'unread-news'): read imperatively by PixiJS ticker
  const indicatorConditionsRef = useRef(new Map<string, boolean>())
  useEffect(() => {
    getUnreadCount()
      .then(n => { indicatorConditionsRef.current.set('unread-news', n > 0) })
      .catch(e => rollbar.error('[HubWorld] getUnreadCount failed', { error: String(e) }))
  }, [])

  // Persisted interactable position overrides for this location (id → tile)
  const interactableMovesRef = useRef(new Map<string, { tx: number; ty: number }>())
  {
    const m = new Map<string, { tx: number; ty: number }>()
    const stored = getInteractableMoves()
    for (const i of locationData.HUB_INTERACTABLES) {
      const v = stored[interactableStoreKey(locationData.HUB_TOWN_NAME, i.id)]
      if (v) m.set(i.id, v)
    }
    interactableMovesRef.current = m
  }
  // Receives the canvas's live-reposition callback
  const moveInteractableRef = useRef<((id: string, tx: number, ty: number) => void) | null>(null)
  // Per-interactable tap counts so dialogue arrays cycle
  const interactableTapCounts = useRef(new Map<string, number>())

  // Completed quest IDs: read imperatively by PixiJS ticker to gate blocked path state
  const completedQuestIdsRef = useRef(new Set<string>())
  {
    const s = new Set<string>()
    for (const quest of questDefs) {
      if (getQuestState(quest.id).status === 'completed') s.add(quest.id)
    }
    completedQuestIdsRef.current = s
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

  // Active-quest objective pins for the minimap (world-pixel coords).
  // Lost-item quests show no item pins until everything is found, then point to
  // the NPC who finishes the quest (see issue #1663).
  const minimapObjectives = useMemo<MinimapObjective[]>(() => {
    const out: MinimapObjective[] = []
    const pushNpc = (npcId: string | undefined) => {
      const npc = locationData.HUB_NPCS.find(n => n.id === npcId)
      if (npc) {
        const place = resolveNpcPlace(npc, gameHour, locationData)
        out.push({ x: place.tx * T + T / 2, y: place.ty * T + T / 2, kind: 'npc' })
      }
    }
    for (const quest of questDefs) {
      if (getQuestState(quest.id).status !== 'active') continue
      const incomplete = quest.steps.find(s => getQuestProgress(quest.id, s.key) < s.required)
      if (!incomplete) {
        // All steps done but quest still active → return to the receiver NPC.
        pushNpc(quest.receiverNpcId)
        continue
      }
      if (incomplete.type === 'collect') {
        if (quest.type === 'lost-items') continue  // no item pins for lost-item quests
        for (const pid of incomplete.pickupIds ?? []) {
          if (pickedUpIds.has(pid)) continue
          const item = locationQuests.HUB_PICKUP_ITEMS.find(p => p.id === pid)
          if (item) out.push({ x: item.tx * T + T / 2, y: item.ty * T + T / 2, kind: 'pickup' })
        }
      } else {
        pushNpc(incomplete.targetNpcId)
      }
    }
    // Town Directory "show on map" pin — the chosen NPC's current location.
    if (pinnedNpcId) {
      const npc = locationData.HUB_NPCS.find(n => n.id === pinnedNpcId)
      if (npc) {
        const place = resolveNpcPlace(npc, gameHour, locationData)
        out.push({ x: place.tx * T + T / 2, y: place.ty * T + T / 2, kind: 'directory' })
      }
    }
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questDefs, pickedUpIds, _tick, locationData, locationQuests, pinnedNpcId, gameHour])

  const togglePinnedNpc = useCallback((npcId: string) => {
    setPinnedNpcId(prev => (prev === npcId ? null : npcId))
  }, [])

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

  // Auto-dismiss dialogue after 15 s — skip if it has choices (quest offers need manual input)
  useEffect(() => {
    const hasContent = !!(dialogueEvent?.text ?? dialogueLine)
    const hasChoices  = !!(dialogueEvent?.choices?.length)
    if (!hasContent || hasChoices) return
    const after = dialogueEvent?.onClose
    const id = setTimeout(() => {
      setDialogueEvent(null)
      setDialogueLine(null)
      after?.()
    }, 15_000)
    return () => clearTimeout(id)
  }, [dialogueEvent, dialogueLine])

  // Live player world-pixel position, read imperatively by the minimap's rAF loop.
  const playerPixelRef = useRef({
    x: locationData.AVATAR_START.tx * T + T / 2,
    y: locationData.AVATAR_START.ty * T + T / 2,
  })

  const handleAvatarMove = useCallback((px: number, py: number) => {
    playerPixelRef.current = { x: px, y: py }
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = px - el.clientWidth  / 2
    el.scrollTop  = py - el.clientHeight / 2
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const saved = getSavedHubTile(locationData.HUB_TOWN_NAME)
    const px = saved ? saved[0] * T + T / 2 : locationData.AVATAR_START.tx * T + T / 2
    const py = saved ? saved[1] * T + T / 2 : locationData.AVATAR_START.ty * T + T / 2
    playerPixelRef.current = { x: px, y: py }
    el.scrollLeft = px - el.clientWidth  / 2
    el.scrollTop  = py - el.clientHeight / 2
  }, [locationData])

  const handleNodeInteract = useCallback((screen: string) => {
    if (screen.startsWith('interior:')) {
      const buildingId = screen.slice(9)
      interiorEnterRef.current?.(buildingId)
      return
    }
    if (screen === 'town-upgrades') { setUpgradesOpen(true); return }
    if (screen === 'worldmap') { onWorldMap?.(); return }
    if (screen === 'campaign') { onCampaign?.(); return }
    if (screen === 'endless') { onEndless?.(); return }
    if (screen === 'commander' && !commander) {
      setDialogueEvent({ speakerName: "Commander's Post", text: "No commander has been assigned yet. Visit the title screen to choose one." })
      return
    }
    onNavigate?.(screen)
  }, [onNavigate, onCampaign, onWorldMap, commander])

  const handleReturn = useCallback(() => {
    returnRef.current?.()
  }, [])

  const handleLeaveInterior = useCallback(() => {
    interiorExitRef.current?.()
    setInteriorActive(false)
  }, [])

  const handleQuestAbandon = useCallback((questId: string) => {
    const quest = questDefs.find(q => q.id === questId)
    if (!quest) return
    const pickupIds = quest.steps.flatMap(s => s.pickupIds ?? [])
    unmarkPickedUp(pickupIds)
    resetQuest(questId)
    setPickedUpIds(getPickedUpIds())
    refreshState()
  }, [refreshState])

  const handleTreasureStep = useCallback((id: string) => {
    const treasure = locationData.HUB_TREASURES.find(t => t.id === id)
    if (!treasure) return
    emitSound('treasure')
    markTreasureCollected(id)
    const { reward } = treasure
    if (reward.crystals) {
      saveCrystals(loadCrystals() + reward.crystals)
      onCrystalsChange?.(loadCrystals())
    }
    if (reward.collectible) {
      const { id: cid, name, icon, desc } = reward.collectible
      addCollectible(cid, { name, icon, desc })
    }
    if (reward.consumables) {
      for (const { id, quantity } of reward.consumables) {
        addConsumable(id, quantity)
      }
    }
    setOpenTreasure(treasure)
    refreshState()
  }, [refreshState])

  const handleItemPickup = useCallback((id: string, questId?: string) => {
    emitSound('pickup')
    markPickedUp(id)
    setPickedUpIds(getPickedUpIds())

    if (!questId) return

    // Quests are resolved across ALL towns so a pickup collected in one town can
    // advance a quest that was accepted in another (cross-town steps).
    const quest = allQuestDefs.find(q => q.id === questId)
    if (!quest) return
    const state = getQuestState(questId)
    if (state.status !== 'active') return

    // Find which step this pickup belongs to and increment progress
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

    // Check if every collect step is now complete
    const allCollectDone = quest.steps
      .filter(s => s.type === 'collect')
      .every(s => getQuestProgress(questId, s.key) >= s.required)

    const speakerName = quest.title

    if (allCollectDone) {
      const receiverNpc = locationData.HUB_NPCS.find(n => n.id === quest.receiverNpcId)
      const npcName = receiverNpc?.name ?? 'the quest giver'
      setDialogueEvent({
        speakerName,
        text: `All items found! Return to ${npcName} to complete the quest.`,
      })
    } else {
      const progress = getQuestProgress(questId, pickedStep.key)
      const countSuffix = pickedStep.required > 1 ? ` (${progress}/${pickedStep.required})` : ''
      setDialogueEvent({
        speakerName,
        text: `Item collected${countSuffix}. ${getActiveDialogue(quest)}`,
      })
    }
  }, [refreshState])

  const handleDoorLocked = useCallback((_buildingId: string, requiredItem: string) => {
    if (requiredItem.startsWith('closed:')) {
      const openHour = parseInt(requiredItem.slice(7))
      const openStr  = `${String(openHour).padStart(2, '0')}:00`
      setDialogueLine(`This building is closed right now. Opens at ${openStr}.`)
    } else if (requiredItem === 'closed') {
      setDialogueLine('This building is closed right now. Come back later.')
    } else if (requiredItem.startsWith('quest:')) {
      setDialogueLine("This passage is sealed. You'll need to discover it first.")
    } else {
      const itemName = requiredItem.replace(/-/g, ' ')
      setDialogueLine(`This door is locked. You need a ${itemName} to enter.`)
    }
  }, [])

  // ── Quest reward helpers ───────────────────────────────────────────────────────

function formatQuestReward(reward: HubQuestDef['reward']): string {
  const parts: string[] = []
  if (reward.crystals)    parts.push(`+${reward.crystals} 💎`)
  if (reward.collectible) parts.push(`${reward.collectible.icon} ${reward.collectible.name}`)
  if (reward.card)        parts.push(`🃏 ${reward.card.name} (card)`)
  if (reward.friendship) {
    for (const [npcId, xp] of Object.entries(reward.friendship)) {
      parts.push(`+${xp} friendship with ${getNpcDisplayName(npcId)}`)
    }
  }
  if (reward.relationship) {
    for (const [npcId, grant] of Object.entries(reward.relationship)) {
      parts.push(`+${grant.points} ${grant.track} with ${getNpcDisplayName(npcId)}`)
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
  if (reward.card) {
    addCardsToCollection([{ cardName: reward.card.name, count: reward.card.count ?? 1 }])
  }
  if (reward.friendship) {
    for (const [npcId, xp] of Object.entries(reward.friendship)) {
      addFriendshipXp(npcId, xp)
    }
  }
  if (reward.relationship) {
    for (const [npcId, grant] of Object.entries(reward.relationship)) {
      addRelationshipPoints(npcId, grant.track, grant.points)
    }
  }
}

// Offer the first available quest given by `giverId` (an NPC or interactable id).
// Returns true if an offer dialogue was shown; false if there is nothing to
// offer (caller falls through to screens / default dialogue).
function tryOfferQuest(giverId: string, speakerName: string, onlyQuestId?: string): boolean {
  const giveQuests = questDefs.filter(q => q.giverNpcId === giverId && (!onlyQuestId || q.id === onlyQuestId))
  const atOfferCap = questDefs.filter(q => getQuestState(q.id).status === 'active').length >= 2
  for (const quest of giveQuests) {
    if (getQuestState(quest.id).status !== 'available') continue
    const prereqMet = !quest.prerequisite || checkPrerequisite(quest.prerequisite)
    if (prereqMet) {
      if (atOfferCap) return false  // at cap — skip offer, fall through to screen or default dialogue
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
                setDialogueEvent({ speakerName, text: "You're already working on 2 quests. Finish one first." })
                return
              }
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
      return true
    }
  }
  return false
}

// Would tryOfferQuest show an offer for this giver right now? Mirrors its gating
// (an available quest with met prerequisites, below the active-quest cap) so a
// screen NPC only surfaces a "see what they need" choice when there's one.
function hasOfferableQuest(giverId: string): boolean {
  const atOfferCap = questDefs.filter(q => getQuestState(q.id).status === 'active').length >= 2
  if (atOfferCap) return false
  return questDefs.some(q =>
    q.giverNpcId === giverId &&
    getQuestState(q.id).status === 'available' &&
    (!q.festivalId || q.festivalId === activeFestival?.id) &&
    (!q.prerequisite || checkPrerequisite(q.prerequisite)))
}

  // Mark a quest completed, grant its reward, and show its completion dialogue.
  function completeQuestFor(quest: HubQuestDef, speakerName: string): void {
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
  }

  // ── Branching dialogue-tree walker ──────────────────────────────────────────
  // Renders a node (text + visible choices) into the shared dialogue UI, then
  // applies a choice's effects and advances to the next node (or ends).
  function runDialogueNode(tree: DialogueTree, nodeId: string, npcId: string, speakerName: string): void {
    const node = tree.nodes[nodeId]
    if (!node) { setDialogueEvent(null); return }
    markNodeSeen(tree.id, nodeId)
    const visible = (node.choices ?? []).filter(c =>
      (!c.requireFlag  || hasDialogueFlag(c.requireFlag)) &&
      (!c.hideIfFlag   || !hasDialogueFlag(c.hideIfFlag)) &&
      (!c.requireQuest || getQuestState(c.requireQuest).status === 'completed') &&
      (!c.hideIfQuest  || getQuestState(c.hideIfQuest).status !== 'completed')
    )
    const choices: DialogueChoice[] = visible.map((c, i) => ({
      label:   c.label,
      primary: i === 0,
      onClick: () => applyChoice(tree, c, npcId, speakerName),
    }))
    setDialogueEvent({
      speakerName: node.speakerName ?? speakerName,
      text:        node.text,
      ...(choices.length > 0 ? { choices } : {}),
    })
  }

  function applyChoice(tree: DialogueTree, choice: DialogueChoiceDef, npcId: string, speakerName: string): void {
    let ended = false
    for (const eff of choice.effects ?? []) {
      switch (eff.type) {
        case 'flag':
          setDialogueFlag(eff.flag)
          break
        case 'friendship':
          addFriendshipXp(eff.npcId ?? npcId, eff.xp)
          refreshState()
          break
        case 'relationship':
          addRelationshipPoints(eff.npcId ?? npcId, eff.track, eff.points)
          refreshState()
          break
        case 'quest': {
          // tryOfferQuest replaces the dialogue with an Accept / Not now offer.
          // Resolve the quest's real giver so a tree can surface a quest that
          // belongs to another NPC. If nothing can be offered (cap reached /
          // unavailable / prerequisite unmet), just close.
          const giver = questDefs.find(q => q.id === eff.questId)?.giverNpcId ?? npcId
          if (!tryOfferQuest(giver, speakerName, eff.questId)) setDialogueEvent(null)
          return
        }
        case 'end':
          ended = true
          break
      }
    }
    if (!ended && choice.next) runDialogueNode(tree, choice.next, npcId, speakerName)
    else setDialogueEvent(null)
  }


  const handleNpcTap = useCallback((line: string, npcId: string) => {
    // Placed animals (HUB_ANIMALS) reuse all NPC quest logic — they share the
    // same id space as quest giverNpcId / receiverNpcId / targetNpcId.
    const namedNpc = locationData.HUB_NPCS.find(n => n.id === npcId)
    const npcDef: {
      name?: string; dialogue?: string[]; screen?: string
      questGive?: string; questReceive?: string | string[]
      innRumours?: Array<{ id: string; text: string }>
      dialogueTree?: string
    } | undefined =
      namedNpc ??
      locationData.HUB_ANIMALS.find(a => a.id === npcId)
    const speakerName = npcDef?.name ?? ''
    if (namedNpc) recordNpcMet(npcId)

    // Cross-town deliveries: scan EVERY town's quests (not just the current one)
    // for an active quest with a pending deliver step addressed to this NPC, or
    // one whose receiver is this NPC and is ready to hand in. This lets a quest
    // accepted elsewhere be progressed / completed here.
    const pendingDelivery = () => {
      for (const q of allQuestDefs) {
        if (getQuestState(q.id).status !== 'active') continue
        const step = q.steps.find(s => s.type === 'deliver' && s.targetNpcId === npcId && getQuestProgress(q.id, s.key) < s.required)
        if (step) return { quest: q, step }
      }
      return null
    }
    const readyToHandIn = () => {
      for (const q of allQuestDefs) {
        if (getQuestState(q.id).status !== 'active') continue
        if (q.receiverNpcId === npcId && isQuestReadyToComplete(q)) return q
      }
      return null
    }

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

    // ── Screen NPCs: open dialogue (don't navigate on tap) ──────────────────
    // NPCs that lead to a screen/mini-game show a dialogue line with an "enter"
    // choice instead of warping immediately, so any active quest interaction
    // (deliver / turn in / accept) can surface alongside it. This is what lets
    // the player hand a rally message to Vince the Dealer rather than being
    // dropped straight into the casino.
    if (npcDef?.screen) {
      const screen = npcDef.screen
      const enterChoice: DialogueChoice = {
        label: screenEnterLabel(screen),
        onClick: () => handleNodeInteract(screen),
      }
      const dismiss: DialogueChoice = { label: 'Maybe later', onClick: () => setDialogueEvent(null) }

      // Build at most one quest choice, in priority order: deliver → turn in →
      // accept. Shown first (primary) so it reads as the obvious action.
      let questChoice: DialogueChoice | undefined

      // (a) Pending delivery addressed to this NPC (any town's active quest).
      const del = pendingDelivery()
      if (del) {
        questChoice = { label: 'Hand over the message', primary: true, onClick: () => {
          incrementQuestProgress(del.quest.id, del.step.key)
          refreshState()
          if (isQuestReadyToComplete(del.quest)) completeQuestFor(del.quest, speakerName)
          else setDialogueEvent({ speakerName, text: getActiveDialogue(del.quest) })
        } }
      }

      // (b) A quest whose receiver is this NPC and is ready to hand in.
      if (!questChoice) {
        const ready = readyToHandIn()
        if (ready) questChoice = { label: 'Turn in the quest', primary: true,
          onClick: () => completeQuestFor(ready, speakerName) }
      }

      // (c) Otherwise, offer the next available quest (Accept / Not now flow).
      if (!questChoice && hasOfferableQuest(npcId)) {
        questChoice = { label: 'See what they need', primary: true,
          onClick: () => { if (!tryOfferQuest(npcId, speakerName)) setDialogueEvent(null) } }
      }

      const choices = [questChoice, enterChoice, dismiss].filter(Boolean) as DialogueChoice[]
      setDialogueEvent({ speakerName, text: line || "What'll it be?", choices })
      return
    }

    // ── Quest delivery / completion (receiver / deliver-target NPC tapped) ──
    // Scans every town's active quests so cross-town deliveries resolve here.
    {
      const del = pendingDelivery()
      if (del) {
        incrementQuestProgress(del.quest.id, del.step.key)
        refreshState()
        if (isQuestReadyToComplete(del.quest)) completeQuestFor(del.quest, speakerName)
        // Delivered but the quest still needs more — acknowledge so the player
        // sees feedback instead of (e.g.) the NPC's screen opening silently.
        else setDialogueEvent({ speakerName, text: getActiveDialogue(del.quest) })
        return
      }
      const ready = readyToHandIn()
      if (ready) {
        completeQuestFor(ready, speakerName)
        return
      }
    }

    // ── Quest give/active dialogue ──────────────────────────────────────────
    // Scan ALL quests this NPC gives — not just the first one — so later
    // quests in the chain are offered once earlier ones are completed.
    const giveQuests = questDefs.filter(q => q.giverNpcId === npcId)

    // First pass: active quest (takes priority — show progress or complete)
    // Note: screen NPCs are fully handled by the screen branch above, so this
    // path only runs for non-screen NPCs.
    for (const quest of giveQuests) {
      if (getQuestState(quest.id).status !== 'active') continue
      if (quest.receiverNpcId === npcId && isQuestReadyToComplete(quest)) {
        completeQuestFor(quest, speakerName)
        return
      }
      setDialogueEvent({ speakerName, text: getActiveDialogue(quest) })
      return
    }

    // Second pass: first available quest whose prerequisites are met
    if (tryOfferQuest(npcId, speakerName)) return

    // (Screen NPCs are handled by the screen branch near the top of this
    // function, so there is no screen-navigation fallthrough here.)

    // ── Relationship-track dialogue override ────────────────────────────────
    // Takes precedence over the generic friendship greeting: once a track is
    // active, it flavours the greeting at the matching level. NPCs steered via a
    // dialogue tree should not author relationshipDialogue (the tree below is how
    // the player steers — a greeting here would shadow it).
    const relTracks = RELATIONSHIP_DIALOGUE[npcId]
    const rel = getRelationship(npcId)
    if (!npcDef?.dialogueTree && relTracks && rel.track && relTracks[rel.track]) {
      const lines = Object.entries(relTracks[rel.track]!)
        .map(([k, v]) => ({ minLevel: parseInt(k), text: v }))
        .filter(t => rel.level >= t.minLevel)
        .sort((a, b) => b.minLevel - a.minLevel)
      if (lines.length > 0) {
        setDialogueEvent({ speakerName, text: lines[0].text })
        return
      }
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

    // ── Branching dialogue tree (ordinary chat) ─────────────────────────────
    const treeId = npcDef?.dialogueTree
    if (treeId) {
      const tree = ALL_QUESTS.HUB_DIALOGUES[treeId]
      if (tree) {
        runDialogueNode(tree, tree.start, npcId, speakerName)
        return
      }
    }

    // ── Default dialogue ─────────────────────────────────────────────────────
    setDialogueEvent({ speakerName, text: line })
  }, [refreshState, handleNodeInteract])

  // Placed/quest animals route through the same handler as NPCs.
  const handleAnimalTap = useCallback((animalId: string) => {
    const a = locationData.HUB_ANIMALS.find(an => an.id === animalId)
    const line = a?.dialogue && a.dialogue.length > 0 ? a.dialogue[0] : ''
    handleNpcTap(line, animalId)
  }, [handleNpcTap, locationData])

  const handleAreaEnter = useCallback((areaName: string | null) => {
    setCurrentArea(areaName)
    const area = areaName != null ? locationData.HUB_AREAS.find(a => a.name === areaName) : undefined
    if (area) recordAreaSeen(locationData.HUB_TOWN_NAME, area.id)
  }, [locationData])

  // ── Interactable reactions ─────────────────────────────────────────────────
  // Reactions run in order; dialogue-style reactions chain the remainder
  // through the dialogue's onClose (manual close or 15 s auto-dismiss).
  function runReactions(def: HubInteractable, idx: number): void {
    const r = def.reactions[idx]
    if (!r) return
    const next = () => runReactions(def, idx + 1)
    const storeKey = interactableStoreKey(locationData.HUB_TOWN_NAME, def.id)
    switch (r.type) {
      case 'dialogue': {
        let text: string
        if (Array.isArray(r.text)) {
          const count = interactableTapCounts.current.get(def.id) ?? 0
          interactableTapCounts.current.set(def.id, count + 1)
          text = r.text[count % r.text.length]
        } else {
          text = r.text
        }
        setDialogueEvent({ speakerName: r.speakerName ?? '', text, onClose: next })
        return
      }
      case 'screen':
        handleNodeInteract(r.screen)
        return
      case 'quest':
        if (!tryOfferQuest(def.id, r.speakerName ?? '', r.questId)) next()
        return
      case 'giveItem': {
        if (isInteractableGranted(storeKey)) {
          if (r.alreadyGrantedText) setDialogueEvent({ speakerName: '', text: r.alreadyGrantedText, onClose: next })
          else next()
          return
        }
        markInteractableGranted(storeKey)
        if (r.collectible) {
          const { id, name, icon, desc } = r.collectible
          addCollectible(id, { name, icon, desc })
        }
        if (r.consumables) {
          for (const { id, quantity } of r.consumables) addConsumable(id, quantity)
        }
        if (r.crystals) {
          saveCrystals(loadCrystals() + r.crystals)
          onCrystalsChange?.(loadCrystals())
        }
        refreshState()
        if (r.message) setDialogueEvent({ speakerName: '', text: r.message, onClose: next })
        else next()
        return
      }
      case 'move': {
        setInteractableMove(storeKey, r.to)
        interactableMovesRef.current.set(def.id, r.to)
        moveInteractableRef.current?.(def.id, r.to.tx, r.to.ty)
        if (r.message) setDialogueEvent({ speakerName: '', text: r.message, onClose: next })
        else next()
        return
      }
    }
  }

  function handleInteractableTap(id: string): void {
    const def = locationData.HUB_INTERACTABLES.find(i => i.id === id)
    if (def) runReactions(def, 0)
  }

  return (
    <OverlayScreen title={`🏠 ${locationData.HUB_TOWN_NAME}`}>
      <Toolbar>
          <ToolbarLabel className={`title-deck-info${wrongSave ? ' title-deck-info--glitch' : ''}`}>💎 {wrongSave ? wrongSave.crystals.toLocaleString() : crystals.toLocaleString()}</ToolbarLabel>
          <ToolbarLabel className={`title-deck-info${wrongSave ? ' title-deck-info--glitch' : ''}`}>🃏 {wrongSave ? wrongSave.cards : collectionCount}/{catalogTotal}</ToolbarLabel>
          <ToolbarLabel className="title-deck-info">{isGameNight ? '🌙' : '☀️'} {formatGameTime()}</ToolbarLabel>
          {activeFestival && (
            <ToolbarLabel className="title-deck-info">{activeFestival.icon} {activeFestival.name}</ToolbarLabel>
          )}
        <ToolbarButton icon="📜" title="Quests" onClick={() => setQuestsOpen(true)} />
        <ToolbarButton icon="🧭" title="Where is…?" onClick={() => setDirectoryOpen(true)} />
        <ToolbarButton icon="🏗️" title="Town Upgrades" onClick={() => setUpgradesOpen(true)} />
        <ToolbarButton icon="🗺" title="World Map" onClick={() => onWorldMap?.()}  disabled={getQuestState('thorin-the-last-watch').status !== 'completed'} />

        <ToolbarSpacer/>
        <div className="toolbar-overflow-inline">
        <LoginButton onSignIn={() => onLoginToggle?.()} onSignOut={() => onSignOut?.()} onPlayerTap={onPlayerTap} user={user} playerName={playerName} />
        <ToolbarButton
          className="title-auth-btn"
          onClick={onFeedback}
          title="Send feedback or report a bug"
          icon={'🗣️'}
        />
        <ToolbarButton className="action-btn hub-hud__btn" onClick={onBack} icon={'⚙'}/>          
        </div>
        <div className="toolbar-overflow-dropdown">
          <ToolbarDropdown label="📊" align="right">
        <LoginButton onSignIn={() => onLoginToggle?.()} onSignOut={() => onSignOut?.()} onPlayerTap={onPlayerTap} user={user} playerName={playerName} />
        <ToolbarButton
          className="title-auth-btn"
          onClick={onFeedback}
          title="Send feedback or report a bug"
          icon={'🗣️'}
        />
        <ToolbarButton className="action-btn hub-hud__btn" onClick={onBack} icon={'⚙'}/>          </ToolbarDropdown>
        </div>


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
            onAreaEnter={handleAreaEnter}
            onNodeInteract={handleNodeInteract}
            onAvatarMove={handleAvatarMove}
            returnRef={returnRef}
            unitCards={unitCards}
            commander={commander}
            onNpcTap={handleNpcTap}
            onAnimalTap={handleAnimalTap}
            onAnimalSeen={recordAnimalSeen}
            interiorEnterRef={interiorEnterRef}
            interiorExitRef={interiorExitRef}
            onEnterInterior={() => setInteriorActive(true)}
            onExitInterior={() => setInteriorActive(false)}
            onTileTap={onTileTap}
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
            isNight={isGameNight}
            npcProximityDialogue={npcProximityDialogueRef}
            onInteractableTap={handleInteractableTap}
            interactableIndicatorsRef={indicatorConditionsRef}
            interactableMovesRef={interactableMovesRef}
            moveInteractableRef={moveInteractableRef}
            buildingUpgradeLevelsRef={buildingUpgradeLevelsRef}
            locationData={locationData}
            questData={locationQuests}
            viewportRef={scrollRef}
          />
        </div>
        <AreaNameBadge name={currentArea} />

        {!interiorActive && (
          <HubMinimap
            locationData={locationData}
            objectives={minimapObjectives}
            playerRef={playerPixelRef}
            viewportRef={scrollRef}
          />
        )}

        {questsOpen && <QuestsModal onClose={() => setQuestsOpen(false)} onAbandon={handleQuestAbandon} questDefs={questDefs} resolveNpcName={getNpcDisplayName}/>}
        {directoryOpen && <TownDirectory onClose={() => setDirectoryOpen(false)} locationData={locationData} pinnedNpcId={pinnedNpcId} onTogglePin={togglePinnedNpc} onShowRelationship={setRelationshipNpcId} />}
        {upgradesOpen && <HubTownUpgrades onClose={() => setUpgradesOpen(false)} townName={town} reputation={getTownReputation(town)} crystals={loadCrystals()} rows={upgradeRows} onUpgrade={handleUpgrade} tributeAmount={tributeAmount(town)} tributeAvailable={tributeAvailable(town)} onCollectTribute={handleCollectTribute} />}
        {relationshipNpcId && <RelationshipView npcName={getNpcDisplayName(relationshipNpcId)} entry={getRelationship(relationshipNpcId)} onClose={() => setRelationshipNpcId(null)} />}
        {openTreasure && <TreasureModal treasure={openTreasure} onClose={() => setOpenTreasure(null)} />}

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

