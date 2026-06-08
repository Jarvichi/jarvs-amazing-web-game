
export interface HubQuestStep {
  key: string
  type: 'collect' | 'deliver'
  pickupIds?: string[]
  targetNpcId?: string
  required: number
  chain?: string
}

export interface HubQuestReward {
  crystals?: number
  collectible?: { id: string; name: string; icon: string; desc: string }
  card?: { name: string; count?: number }
  friendship?: Record<string, number>
  unlock?: string
}

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


export interface RawQuestConfig {
  quests: QuestDefinition[]
  pickupItems?: QuestPickupItem[]
  innRumours?: QuestInnRumour[]
  friendshipDialogue?: FriendshipDialogue
  blockedPaths?: QuestBlockedPaths[]
}

