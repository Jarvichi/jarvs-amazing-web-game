import type { RelationshipTrack } from '../../game/hub/relationships'

export interface HubQuestStep {
  key: string
  type: 'collect' | 'deliver'
  pickupIds?: string[]
  targetNpcId?: string
  required: number
  chain?: string
}

export interface RelationshipGrant {
  track: RelationshipTrack
  points: number
}

export interface HubQuestReward {
  crystals?: number
  collectible?: { id: string; name: string; icon: string; desc: string }
  card?: { name: string; count?: number }
  friendship?: Record<string, number>
  /** Per-NPC relationship-track points granted on quest completion. */
  relationship?: Record<string, RelationshipGrant>
  unlock?: string
}

/** npcId -> track -> levelString -> line shown when that track is active. */
export type RelationshipDialogue = Record<
  string,
  Partial<Record<RelationshipTrack, Record<string, string>>>
>

export interface HubQuestDef {
  id: string
  title: string
  type: 'fetch' | 'chain' | 'lost-items'
  giverNpcId: string
  receiverNpcId: string
  prerequisite?: string
  offerDialogue: string 
  activeDialogue: string | Dialogue
  completeDialogue:string 
  steps: HubQuestStep[]
  reward: HubQuestReward
  availableHours?: { start: number; end: number }
  /** If set, the quest is only offered while this festival is active (hubCalendar). */
  festivalId?: string
}


export interface QuestDefinition {
  id: string
  title: string
  type: string

  giverNpcId: string
  receiverNpcId?: string

  prerequisite?: string

  offerDialogue: Dialogue | string
  activeDialogue: string | Dialogue 
  completeDialogue: Dialogue | string

  steps: QuestStep[]

  reward: QuestReward

  /** If set, the quest is only offered while this festival is active (hubCalendar). */
  festivalId?: string
}





  export type QuestType =
  | 'fetch'
  | 'lost-items'
  | 'chain'

export type Dialogue = Record<string, string | undefined>


export type QuestStep =
  | CollectStep
  | DeliverStep

export interface CollectStep {
  key: string
  type: string // 'collect'
  pickupIds: string[]
  required: number
}

export interface DeliverStep {
  key: string
  type: string // 'deliver'
  targetNpcId: string
  required: number
}

export type FriendShip = Record<string, number | undefined>

export interface QuestReward {
  crystals?: number

  friendship?: FriendShip | undefined

  // Raw JSON boundary: `track` stays `string` here so the literal config assigns
  // without a union mismatch. The runtime `HubQuestReward.relationship` (read via
  // an `as unknown` cast in loader.ts) narrows it back to `RelationshipGrant`.
  relationship?: Record<string, { track: string; points: number } | undefined>

  collectible?: {
    id: string
    name: string
    icon: string
    desc: string
  }

  unlock?: string
}

export interface QuestPickupItem {
  id: string
  tx: number
  ty: number
  tileId: string
  questId?:string
  building?: string
  chain?: string
}

export interface QuestInnRumour{
  id: string
  text: string
}

export type FriendshipDialogue = Record<
  string,                  // npc id
  Record<string, string>   // friendship level -> dialogue
>


export interface BlockedPathDecor {
  tx: number
  ty: number
  tileId: string
}

export interface ProximityDialogue {
  atDistance: number
  text: string
}

export interface BlockedPathNpc {
  id: string
  sprite: string

  tx: number
  ty: number

  tapDialogue: string

  proximityDialogue?: ProximityDialogue[]
}

export interface BlockedPathState {
  decor?: BlockedPathDecor[]
  npcs?: BlockedPathNpc[]
}

export interface QuestBlockedPaths {
  id: string

  blockedTiles: number[][]

  questId: string

  blocked: BlockedPathState
  cleared: BlockedPathState
}


// ── Branching dialogue trees ────────────────────────────────────────────────
// A reusable schema for multi-choice NPC conversations that branch to different
// endings. Authored in a town's questDefs.json `dialogues` block and referenced
// from an NPC via `dialogueTree`. See docs/hubworld.md for the full reference.

export type DialogueEffect =
  | { type: 'flag'; flag: string }              // persist a named dialogue flag
  | { type: 'friendship'; npcId?: string; xp: number }  // grant friendship XP (defaults to the speaking NPC)
  | { type: 'relationship'; npcId?: string; track: RelationshipTrack; points: number }  // advance a relationship track (defaults to the speaking NPC)
  | { type: 'quest'; questId: string }          // offer a quest (Accept / Not now)
  | { type: 'end' }                             // end the conversation

export interface DialogueChoiceDef {
  label: string
  next?: string            // node id to advance to after effects run
  effects?: DialogueEffect[]
  requireFlag?: string     // only show this choice if the flag is set
  hideIfFlag?: string      // hide this choice once the flag is set
}

export interface DialogueNode {
  text: string
  speakerName?: string     // overrides the NPC name for this node (optional)
  choices?: DialogueChoiceDef[]  // absent/empty → single OK button closes
}

export interface DialogueTree {
  id: string
  npcId?: string           // documentation only — which NPC this belongs to
  start: string            // id of the first node in `nodes`
  nodes: Record<string, DialogueNode>
}

export interface RawQuestConfig {
  quests: QuestDefinition[]
  pickupItems?: QuestPickupItem[]
  innRumours?: QuestInnRumour[]
  friendshipDialogue?: FriendshipDialogue
  relationshipDialogue?: RelationshipDialogue
  blockedPaths?: QuestBlockedPaths[]
  // `dialogues` (DialogueTree[]) is read in loader.ts via an `as unknown` cast —
  // it is intentionally not declared here so the raw JSON (whose effect `type`
  // widens to `string`) assigns to RawQuestConfig without a union mismatch.
}

