import data from './questDefs.json'

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
  activeDialogue: string | Record<string, string>
  completeDialogue: string
  steps: HubQuestStep[]
  reward: HubQuestReward
}

export const HUB_QUEST_DEFS: HubQuestDef[] = data.quests as unknown as HubQuestDef[]

export const INN_RUMOURS: Array<{ id: string; text: string }> = data.innRumours

export const FRIENDSHIP_DIALOGUE: Record<string, Record<number, string>> =
  data.friendshipDialogue as unknown as Record<string, Record<number, string>>
