export interface HubQuestStep {
  key: string
  type: 'collect' | 'deliver'
  pickupIds?: string[]
  targetNpcId?: string
  required: number
  chain?: string   // only the first pickup in the chain; each subsequent pickup has its own chain field in hubConfig
}

export interface HubQuestReward {
  crystals?: number
  collectible?: { id: string; name: string; icon: string; desc: string }
  friendship?: Record<string, number>  // npcId → xp
  unlock?: string                      // buildingId unlocked on complete
}

export interface HubQuestDef {
  id: string
  title: string
  type: 'fetch' | 'chain' | 'lost-items'
  giverNpcId: string
  receiverNpcId: string
  prerequisite?: string   // 'friendship:npcId:minLevel'
  offerDialogue: string
  activeDialogue: string | Record<string, string>  // string or per-step-key map
  completeDialogue: string
  steps: HubQuestStep[]
  reward: HubQuestReward
}

export const HUB_QUEST_DEFS: HubQuestDef[] = [
  {
    id: 'lost-pendant',
    title: 'The Lost Pendants',
    type: 'lost-items',
    giverNpcId: 'elder',
    receiverNpcId: 'elder',
    offerDialogue: 'Oh dear… I seem to have misplaced my three pendant stones somewhere in town. They are precious to me. Have you seen them?',
    activeDialogue: 'I had the pendants near the pond, the market square, and the east fields. Any luck finding them?',
    completeDialogue: 'All three! Bless you, dear traveller. You have a very kind heart.',
    steps: [
      { key: 'pendants', type: 'collect', pickupIds: ['pendant-1', 'pendant-2', 'pendant-3'], required: 3 },
    ],
    reward: {
      crystals: 50,
      friendship: { elder: 25 },
    },
  },
  {
    id: 'merchants-herb',
    title: "The Merchant's Ingredient",
    type: 'fetch',
    giverNpcId: 'merchant',
    receiverNpcId: 'merchant',
    offerDialogue: "I'm after a Moonleaf Herb for a special tincture. They grow in sheltered spots near the scholars' quarter. Fetch me one and I'll make it worth your while.",
    activeDialogue: "Moonleaf Herb — look for it growing in the shade near the scholars' hall.",
    completeDialogue: 'Perfect condition! Here, take this as thanks. A rare find, just like yourself.',
    steps: [
      { key: 'herb', type: 'collect', pickupIds: ['moonleaf-herb'], required: 1 },
    ],
    reward: {
      collectible: { id: 'exotic-herb', name: 'Moonleaf Herb', icon: '🌿', desc: 'A rare herb prized by alchemists. Vex seems pleased.' },
      friendship: { merchant: 20 },
    },
  },
  {
    id: 'scholars-anthology',
    title: "The Scholar's Anthology",
    type: 'chain',
    giverNpcId: 'naia-interior',
    receiverNpcId: 'naia-interior',
    offerDialogue: "I'm trying to reassemble a three-volume anthology that was scattered across town ages ago. The first tome ended up in the card emporium, if I'm not mistaken…",
    activeDialogue: {
      'tome-1': "The first tome is in the card emporium. Look on the shelves.",
      'tome-2': "Excellent! The second volume was sold to a trader. Check the trading post.",
      'tome-3': "Almost there! The final volume ended up near the fishing pond, I believe.",
    },
    completeDialogue: "The trilogy is complete! This is extraordinary scholarship. Please, take this codex as thanks.",
    steps: [
      { key: 'tome-1', type: 'collect', pickupIds: ['ancient-tome-1'], required: 1 },
      { key: 'tome-2', type: 'collect', pickupIds: ['ancient-tome-2'], required: 1, chain: 'ancient-tome-1' },
      { key: 'tome-3', type: 'collect', pickupIds: ['ancient-tome-3'], required: 1, chain: 'ancient-tome-2' },
    ],
    reward: {
      collectible: { id: 'scholars-codex', name: "Scholar's Codex", icon: '📜', desc: 'A rare three-volume anthology compiled by Archivist Naia.' },
      friendship: { 'naia-interior': 30 },
    },
  },
  {
    id: 'innkeepers-package',
    title: "The Innkeeper's Package",
    type: 'fetch',
    giverNpcId: 'innkeeper-rosie',
    receiverNpcId: 'guard-captain-thorin',
    prerequisite: 'friendship:innkeeper-rosie:2',
    offerDialogue: "Oh, would you be a dear? I have a package for Captain Thorin in the north barracks. I simply cannot leave the inn right now!",
    activeDialogue: "Please take the package to Guard Captain Thorin in the north barracks.",
    completeDialogue: "Ah, from Rosie! My thanks, traveller. Here — you might find this key useful for the south wing.",
    steps: [
      { key: 'deliver', type: 'deliver', targetNpcId: 'guard-captain-thorin', required: 1 },
    ],
    reward: {
      collectible: { id: 'barracks-key', name: 'Barracks Key', icon: '🗝️', desc: 'An old iron key. Fits the south barracks vault.' },
      friendship: { 'innkeeper-rosie': 20, 'guard-captain-thorin': 15 },
      unlock: 'barracks-vault',
    },
  },
]

export const INN_RUMOURS: Array<{ id: string; text: string }> = [
  { id: 'rumour-barracks',  text: "The south barracks wing has been sealed for years. Captain Thorin keeps to himself about it…" },
  { id: 'rumour-elder',     text: "The Elder was pacing the courtyard today, muttering about lost things." },
  { id: 'rumour-vex',       text: "Vex keeps badgering every traveller about rare herbs. If you find some, he pays well." },
  { id: 'rumour-naia',      text: "That archivist Naia never leaves the scholars' hall. Something about old books she cannot find." },
  { id: 'rumour-pond',      text: "Old Greyfish says the pond shimmers at night. Strange glimmers beneath the water, he says…" },
]

export const FRIENDSHIP_DIALOGUE: Record<string, Record<number, string>> = {
  elder: {
    2: "Ah, I remember you. You found my pendants. Come and sit a moment.",
    4: "You have become part of this town's story now, traveller. Few earn that.",
  },
  'innkeeper-rosie': {
    2: "Always good to see a friendly face! About that favour I mentioned…",
    3: "Your room is free of charge, of course. It is the least I can do.",
  },
  'naia-interior': {
    3: "Ah, my favourite bibliophile! I have been cataloguing your finds. Quite remarkable.",
  },
  merchant: {
    2: "For you, I will cut a special deal. You have good taste in rare ingredients.",
  },
  'guard-captain-thorin': {
    2: "I do not forget those who help me. You have my respect, traveller.",
  },
}
