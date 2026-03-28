// ─── Achievement System ──────────────────────────────────────────────────────
//
// Progress keys:
//   kill:<unitName>       — enemy units/structures killed (incremented during battle)
//   event:<eventId>       — special event outcomes
//   campaign:<actId>      — act completion counts

export type AchievementCategory = 'kills' | 'structures' | 'events' | 'campaign' | 'misc' | 'daily'

export interface AchievementReward {
  type: 'cards' | 'crystals' | 'item' | 'avatar'
  cardName?: string
  count?: number
  crystals?: number
  item?: { id: string; name: string; icon: string; desc: string }
  /** Streak avatar slug to unlock (used with type 'avatar'). */
  avatarSlug?: string
  /** Extra crystals granted alongside a non-crystals reward. */
  bonusCrystals?: number
  /** Extra cards granted alongside another reward. */
  bonusCards?: { cardName: string; count: number }[]
}

export interface AchievementDef {
  id: string
  name: string
  description: string
  category: AchievementCategory
  progressKey: string
  target: number
  reward: AchievementReward
  tier: 1 | 2
}

export interface AchievementSave {
  progress: Record<string, number>
  unlocked: Record<string, boolean>
  claimed: Record<string, boolean>
}

// ─── Storage ─────────────────────────────────────────────

const KEY = 'jarv_achievements'

export function loadAchievementSave(): AchievementSave {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as AchievementSave
  } catch { /* ignore */ }
  return { progress: {}, unlocked: {}, claimed: {} }
}

function saveAchievementSave(s: AchievementSave): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

// ─── Progress tracking ───────────────────────────────────

/** Increment a progress counter, unlock matching achievements, return newly unlocked defs. */
export function incrementAchievementProgress(progressKey: string, by = 1): AchievementDef[] {
  const save = loadAchievementSave()
  save.progress[progressKey] = (save.progress[progressKey] ?? 0) + by

  const current = save.progress[progressKey]
  const newlyUnlocked: AchievementDef[] = []

  for (const def of ACHIEVEMENT_DEFS) {
    if (def.progressKey !== progressKey) continue
    if (save.unlocked[def.id]) continue
    if (current >= def.target) {
      save.unlocked[def.id] = true
      newlyUnlocked.push(def)
    }
  }

  saveAchievementSave(save)
  return newlyUnlocked
}

/** Set a progress counter to a specific value (for tracking maximums like streaks). Returns newly unlocked defs. */
export function setAchievementProgress(progressKey: string, value: number): AchievementDef[] {
  const save = loadAchievementSave()
  save.progress[progressKey] = value

  const newlyUnlocked: AchievementDef[] = []
  for (const def of ACHIEVEMENT_DEFS) {
    if (def.progressKey !== progressKey) continue
    if (save.unlocked[def.id]) continue
    if (value >= def.target) {
      save.unlocked[def.id] = true
      newlyUnlocked.push(def)
    }
  }

  saveAchievementSave(save)
  return newlyUnlocked
}

/** Get current progress for a key. */
export function getAchievementProgress(progressKey: string): number {
  return loadAchievementSave().progress[progressKey] ?? 0
}

/** Returns true if any achievement is unlocked but not yet claimed. */
export function hasUnclaimedAchievements(): boolean {
  const save = loadAchievementSave()
  return ACHIEVEMENT_DEFS.some(d => save.unlocked[d.id] && !save.claimed[d.id])
}

/** Claim the reward for an achievement. Returns the reward if claimable, null otherwise. */
export function claimAchievementReward(achievementId: string): AchievementReward | null {
  const save = loadAchievementSave()
  if (!save.unlocked[achievementId]) return null
  if (save.claimed[achievementId]) return null
  const def = ACHIEVEMENT_DEFS.find(d => d.id === achievementId)
  if (!def) return null
  save.claimed[achievementId] = true
  saveAchievementSave(save)
  return def.reward
}

// ─── Helper: build kill achievement pair ─────────────────

function killPair(
  unitDisplayName: string,  // used in description
  progressKey: string,
  name1: string, name2: string,
  cardNameForReward: string,
  isLegendary = false,
): [AchievementDef, AchievementDef] {
  const count1 = isLegendary ? 1 : 2
  const count2 = isLegendary ? 2 : 5
  const crystals2 = isLegendary ? 150 : 100

  const a1: AchievementDef = {
    id: `kill:${progressKey}:1000`,
    name: name1,
    description: `Kill 1,000 ${unitDisplayName}s`,
    category: 'kills',
    progressKey: `kill:${progressKey}`,
    target: 1000,
    reward: { type: 'cards', cardName: cardNameForReward, count: count1 },
    tier: 1,
  }
  const a2: AchievementDef = {
    id: `kill:${progressKey}:10000`,
    name: name2,
    description: `Kill 10,000 ${unitDisplayName}s`,
    category: 'kills',
    progressKey: `kill:${progressKey}`,
    target: 10000,
    reward: isLegendary
      ? { type: 'crystals', crystals: crystals2 }
      : { type: 'cards', cardName: cardNameForReward, count: count2 },
    tier: 2,
  }
  return [a1, a2]
}

function structurePair(
  unitDisplayName: string,
  progressKey: string,
  name1: string, name2: string,
  cardNameForReward: string,
  isLegendary = false,
): [AchievementDef, AchievementDef] {
  const count1 = isLegendary ? 1 : 2
  const crystals = isLegendary ? 200 : 150

  const a1: AchievementDef = {
    id: `struct:${progressKey}:1000`,
    name: name1,
    description: `Destroy 1,000 ${unitDisplayName}s`,
    category: 'structures',
    progressKey: `kill:${progressKey}`,
    target: 1000,
    reward: { type: 'cards', cardName: cardNameForReward, count: count1 },
    tier: 1,
  }
  const a2: AchievementDef = {
    id: `struct:${progressKey}:10000`,
    name: name2,
    description: `Destroy 10,000 ${unitDisplayName}s`,
    category: 'structures',
    progressKey: `kill:${progressKey}`,
    target: 10000,
    reward: { type: 'crystals', crystals },
    tier: 2,
  }
  return [a1, a2]
}

// ─── Achievement Definitions ─────────────────────────────

export const ACHIEVEMENT_DEFS: AchievementDef[] = [

  // ── Unit Kills ────────────────────────────────────────────────────────────

  ...killPair('Goblin',        'Goblin',        'Pest Control',              'Goblin Genocide',              'Goblin'),
  ...killPair('Archer',        'Archer',        'Pin Cushion',               'Human Porcupine',              'Archer'),
  ...killPair('Barbarian',     'Barbarian',     'Bad Manners, Worse Fate',   'Civilization Has Won',         'Barbarian'),
  ...killPair('Knight',        'Knight',        'Chink in the Armor',        'Sir Not Appearing Alive',      'Knight'),
  ...killPair('Wizard',        'Wizard',        'Magic: Cancelled',          'Disenchanted',                 'Wizard'),
  ...killPair('Dragon',        'Dragon',        'Dragon Slayer',             'Dragonborn',                   'Dragon', true),
  ...killPair('Skeleton',      'Skeleton',      'Bonecrusher',               'The Whole Cemetery',           'Skeleton'),
  ...killPair('Troll',         'Troll',         'Bridge-Free Zone',          'Trollslayer',                  'Troll'),
  ...killPair('Crossbow',      'Crossbow',      'Arrow Rain, Reversed',      'Quiver Empty',                 'Crossbow'),
  ...killPair('Paladin',       'Paladin',       'Smite This',                'Holy Overkill',                'Paladin'),
  ...killPair('Rogue',         'Rogue',         'Backstabbed Back',          'Nothing Personal, Kid',        'Rogue'),
  ...killPair('Catapult',      'Catapult',      'Siege Breaker',             'Projectile Dysfunction',       'Catapult'),
  ...killPair('Werewolf',      'Werewolf',      'Bad Moon Not Rising',       'Silver Bullet Supplier',       'Werewolf'),
  ...killPair('Golem',         'Golem',         'Rock Bottom',               'Gravel Garden',                'Golem', true),
  ...killPair('Pixie',         'Pixie',         'Fairy Squasher',            "Tinkerbell's Nightmare",       'Pixie'),
  ...killPair('Ogre',          'Ogre',          'Layers Removed',            'Shrek Speedrun',               'Ogre'),
  ...killPair('Plague Rat',    'Plague Rat',    'Exterminator',              'The Pied Piper',               'Plague Rat'),
  ...killPair('Bandit',        'Bandit',        'Law Enforcement',           'Wanted Dead, Delivered',       'Bandit'),
  ...killPair('Bat',           'Bat',           'Bug Swatter',               'Bat Signal: Off',              'Bat'),
  ...killPair('Scorpion',      'Scorpion',      'Stinger Removed',           'Venomous Victory',             'Scorpion'),
  ...killPair('Shield Guard',  'Shield Guard',  'Shield? What Shield?',      'Unbreakable... Eventually',    'Shield Guard'),
  ...killPair('Centaur',       'Centaur',       'Half the Problem Gone',     'Four Hooves Under',            'Centaur'),
  ...killPair('Harpy',         'Harpy',         'Wing Clipping',             'Down to Earth',                'Harpy'),
  ...killPair('Specter',       'Specter',       'Ghost Buster',              "Ain't Afraid of No Ghost",     'Specter'),
  ...killPair('Lizardman',     'Lizardman',     'Cold-Blooded Killer',       'Scalped',                      'Lizardman'),
  ...killPair('Ballista',      'Ballista',      'Return Fire',               'Outranged',                    'Ballista'),
  ...killPair('Vampire',       'Vampire',       'Buffy',                     'Buffy the Vampire Slayer',     'Vampire'),
  ...killPair('Griffin',       'Griffin',       'Not So Majestic Now',       'Feather Duster',               'Griffin', true),
  ...killPair('Fire Mage',     'Fire Mage',     'Fire Extinguisher',         'Playing with Fire (Winning)',  'Fire Mage'),
  ...killPair('Executioner',   'Executioner',   'The Tables Have Turned',    "Heads Will Roll (Theirs)",     'Executioner'),
  ...killPair('Mammoth',       'Mammoth',       'Tusk Buster',               'Woolly Massacre',              'Mammoth', true),
  ...killPair('Dark Elf',      'Dark Elf',      'Lights On',                 'Elvish Extinction',            'Dark Elf'),
  ...killPair('Necromancer',   'Necromancer',   'They Stay Dead This Time',  'The Final Funeral',            'Necromancer'),
  ...killPair('Giant',         'Giant',         'Giant Killer',              'Fe Fi Fo DEAD',                'Giant', true),
  ...killPair('Wyvern',        'Wyvern',        'Wyvern Wrangler',           'Wyvern Wipeout',               'Wyvern', true),
  ...killPair('Behemoth',      'Behemoth',      'Behemoth Buster',           'The Bigger They Are',          'Behemoth', true),
  ...killPair('Vine Golem',    'Vine Golem',    'Weed Killer',               'Herbicide',                    'Vine Golem'),
  ...killPair('Spore Bat',     'Spore Bat',     'Spore Sport',               'Mushroom Massacre',            'Spore Bat'),
  ...killPair('Thornbeast',    'Thornbeast',    'Dethorned',                 'Thornless',                    'Thornbeast'),
  ...killPair('Elder Treant',  'Elder Treant',  'Lumberjack',                'The Lumber Yard',              'Elder Treant', true),
  ...killPair('Frog Knight',   'Frog Knight',   'Ribbit Requiem',            'Frog Pond Cleared',            'Frog Knight'),
  ...killPair('Ironclad Guard','Ironclad Guard','Tin Opener',                'Can Crusher',                  'Ironclad Guard'),
  ...killPair('War Drummer',   'War Drummer',   'Drum Solo Cancelled',       'The Beat Stops Here',          'War Drummer'),
  ...killPair('Siege Engineer','Siege Engineer','Sieged Out',                'Laid Off (Permanently)',        'Siege Engineer'),
  ...killPair('Shield Wall',   'Shield Wall',   'Formation Broken',          'The Wall Falls',               'Shield Wall Soldier'),
  ...killPair('Grizzled Vet.', 'Grizzled Vet.','Outexperienced',            'Veteran of Veterans',          'Grizzled Veteran'),
  ...killPair('Bone Archer',   'Bone Archer',   'Skeleton Crew Down',        'Calcium Deficit',              'Bone Archer'),
  ...killPair('Wight Knight',  'Wight Knight',  "Knight's Out",              'Twice Dead',                   'Wight Knight'),
  ...killPair('Ash Elemental', 'Ash Elemental', 'Swept Up',                  'Wind Cleaned',                 'Ash Elemental'),
  ...killPair('Revenant',      'Revenant',      'Put to Rest',               'Dead Again (For Good)',        'Revenant'),
  ...killPair('Lich Apprentice','Lich Apprentice','F in Necromancy',         'Dropped Out',                  'Lich Apprentice'),

  // ── Structure Destroys ───────────────────────────────────────────────────

  ...structurePair('Wall',          'Wall',        'Stone Cold',          'The Great Wall Fell',       'Stone Wall'),
  ...structurePair('Farm',          'Farm',        'Farm Boy',            'Agricultural Armageddon',   'Farm'),
  ...structurePair('Barracks',      'Barracks',    'Boot Camp Closed',    'No More Recruits',          'Barracks'),
  ...structurePair('Arc.Tower',     'Arc.Tower',   'Power Outage',        'Tower of Rubble',           'Arcane Tower'),
  ...structurePair('DrgnLair',      'DrgnLair',    'Lair Cleared',        'Dragon Homeless',           'Dragon Lair', true),
  ...structurePair('Crypt',         'Crypt',       'Crypt Keeper Fired',  'Dead Storage',              'Crypt'),
  ...structurePair('Troll Den',     'Troll Den',   'No Vacancy',          'Den of Thieves, No More',   'Troll Den', true),
  ...structurePair('Garrison',      'Garrison',    'Garrison Abandoned',  'Standing Orders: None',     'Garrison'),
  ...structurePair('Cathedral',     'Cathedral',   'Faithless',           'Structural Blasphemy',      'Cathedral', true),
  ...structurePair('Rogue Den',     'Rogue Den',   'Neighbourhood Watch', 'Zero Crime Rate',           'Rogue Den'),
  ...structurePair('Siege Works',   'Siege Works', 'Disarmed',            'Out of Ammunition',         'Siege Works', true),
  ...structurePair('Dark Shrine',   'Dark Shrine', 'Holy Site',           'Darkness Dispelled',        'Dark Shrine'),
  ...structurePair('Iron Forge',    'Iron Forge',  'Molten Defeat',       'Forge Extinguished',        'Iron Forge', true),
  ...structurePair('Fairy Ring',    'Fairy Ring',  'Ring Broken',         'Fairy Homeless',            'Fairy Ring'),
  ...structurePair('Ogre Den',      'Ogre Den',    'Eviction Notice',     'No Ogres Allowed',          'Ogre Den'),
  ...structurePair('Rat Burrow',    'Rat Burrow',  'Pest Control Plus',   'Burrow No More',            'Rat Burrow'),
  ...structurePair('Bandit Camp',   'Bandit Camp', 'Camp Cleared',        'Criminal Enterprise Ended', 'Bandit Camp'),
  ...structurePair('Bat Cave',      'Bat Cave',    'Cave Raider',         'The Dark Knight Cries',     'Bat Cave'),
  ...structurePair('Scorpion Pit',  'Scorpion Pit','Pit Demolished',      'No Stinging Zone',          'Scorpion Pit'),
  ...structurePair('Guard Post',    'Guard Post',  'Post Unstaffed',      'Nobody Here But Us',        'Guard Post'),
  ...structurePair('Harpy Roost',   'Harpy Roost', 'Bird Bath Broken',    'Roost Obliterated',         'Harpy Roost'),
  ...structurePair('Spirit Well',   'Spirit Well', 'Dry Well',            'Spirits Drained',           'Spirit Well'),
  ...structurePair('Lizard Den',    'Lizard Den',  'Lizard Evicted',      'Den Demolished',            'Lizard Warren'),
  ...structurePair('Vamp Coven',    'Vamp Coven',  'Coven Disbanded',     'Vampire HOA Gone',          'Vamp. Coven'),
  ...structurePair('Aerie',         'Aerie',       'Wing Clipped',        'High Ground: Ours',         'Aerie'),
  ...structurePair('Mage Tower',    'Mage Tower',  'Power Drained',       'Tower of Former Greatness', 'Mage Tower'),
  ...structurePair('Gallows',       'Gallows',     'Last Hanging',        'Justice Served 10000x',     'Gallows'),
  ...structurePair('Thornwall',     'Thornwall',   'Pruned',              'No Thorns Left',            'Thornwall'),
  ...structurePair('Armory',        'Armory',      'Unarmed',             'Empty Arsenal',             'Armory'),
  ...structurePair('Bone Wall',     'Bone Wall',   'Ossuary Opened',      'Calcium Recycled',          'Bone Wall'),
  ...structurePair('Soul Obelisk',  'Soul Obelisk','Soul Drained',        'Obelisk Rubble',            'Soul Obelisk'),

  // ── Events ───────────────────────────────────────────────────────────────

  {
    id: 'event:gambler_win',
    name: 'House Loses',
    description: 'Win the Gambler event (guess the exact number)',
    category: 'events',
    progressKey: 'event:gambler_win',
    target: 1,
    reward: { type: 'crystals', crystals: 500 },
    tier: 1,
  },
  {
    id: 'event:rubber_chicken',
    name: 'Consolation Prize Collector',
    description: 'Receive the Rubber Chicken from The Gambler',
    category: 'events',
    progressKey: 'event:rubber_chicken',
    target: 1,
    reward: { type: 'crystals', crystals: 50 },
    tier: 1,
  },
  {
    id: 'event:gambler_bust',
    name: 'All-In and All-Gone',
    description: 'Bust in the Gambler event (go over the number)',
    category: 'events',
    progressKey: 'event:gambler_bust',
    target: 1,
    reward: { type: 'crystals', crystals: 25 },
    tier: 1,
  },
  {
    id: 'event:blackjack_win',
    name: 'Card Sharp',
    description: 'Win the Blackjack rare event',
    category: 'events',
    progressKey: 'event:blackjack_win',
    target: 1,
    reward: { type: 'crystals', crystals: 100 },
    tier: 1,
  },
  {
    id: 'event:liarsdice_win',
    name: 'Poker Face',
    description: "Win the Liar's Dice rare event",
    category: 'events',
    progressKey: 'event:liarsdice_win',
    target: 1,
    reward: { type: 'crystals', crystals: 100 },
    tier: 1,
  },
  {
    id: 'event:narrator_befriend',
    name: 'Fourth Wall Friend',
    description: 'Befriend the Narrator',
    category: 'events',
    progressKey: 'event:narrator_befriend',
    target: 1,
    reward: { type: 'crystals', crystals: 75 },
    tier: 1,
  },
  {
    id: 'event:wrong_number',
    name: 'Wrong Number, Right Victory',
    description: 'Complete the Wrong Number rare event',
    category: 'events',
    progressKey: 'event:wrong_number',
    target: 1,
    reward: { type: 'crystals', crystals: 50 },
    tier: 1,
  },
  {
    id: 'event:fake_crash',
    name: 'Nothing to See Here',
    description: 'Survive the Fake Crash rare event',
    category: 'events',
    progressKey: 'event:fake_crash',
    target: 1,
    reward: { type: 'crystals', crystals: 50 },
    tier: 1,
  },

  // ── Campaign ──────────────────────────────────────────────────────────────

  {
    id: 'campaign:act1:1',
    name: 'Thornlord Falls',
    description: 'Complete Act 1 — The Verdant Shard',
    category: 'campaign',
    progressKey: 'campaign:act1',
    target: 1,
    reward: { type: 'crystals', crystals: 100 },
    tier: 1,
  },
  {
    id: 'campaign:act1:10',
    name: 'Thornlord? More Like Thorn-Bored',
    description: 'Complete Act 1 ten times',
    category: 'campaign',
    progressKey: 'campaign:act1',
    target: 10,
    reward: { type: 'crystals', crystals: 500 },
    tier: 2,
  },
  {
    id: 'campaign:act1:100',
    name: 'Act 1 Speed Runner (Unretired)',
    description: 'Complete Act 1 one hundred times',
    category: 'campaign',
    progressKey: 'campaign:act1',
    target: 100,
    reward: {
      type: 'item',
      item: { id: 'verdant_crown', name: 'Verdant Crown', icon: '🌿', desc: 'Worn by those who have slain the Thornlord... far too many times.' },
    },
    tier: 2,
  },
  {
    id: 'campaign:act2:1',
    name: 'Kragg Crushed',
    description: 'Complete Act 2 — The Iron Citadel',
    category: 'campaign',
    progressKey: 'campaign:act2',
    target: 1,
    reward: { type: 'crystals', crystals: 150 },
    tier: 1,
  },
  {
    id: 'campaign:act2:10',
    name: 'Warlord of Warlords',
    description: 'Complete Act 2 ten times',
    category: 'campaign',
    progressKey: 'campaign:act2',
    target: 10,
    reward: { type: 'crystals', crystals: 750 },
    tier: 2,
  },
  {
    id: 'campaign:act2:100',
    name: 'Iron Will (And Schedule)',
    description: 'Complete Act 2 one hundred times',
    category: 'campaign',
    progressKey: 'campaign:act2',
    target: 100,
    reward: {
      type: 'item',
      item: { id: 'iron_standard_badge', name: 'Iron Standard Badge', icon: '⚔️', desc: 'Proof that Warlord Kragg is just not a problem for you anymore.' },
    },
    tier: 2,
  },
  {
    id: 'campaign:act3:1',
    name: 'The Ashwalker Silenced',
    description: 'Complete Act 3 — The Ashen Wastes',
    category: 'campaign',
    progressKey: 'campaign:act3',
    target: 1,
    reward: { type: 'crystals', crystals: 200 },
    tier: 1,
  },
  {
    id: 'campaign:act3:10',
    name: 'Ash to Ash, Dust to Win',
    description: 'Complete Act 3 ten times',
    category: 'campaign',
    progressKey: 'campaign:act3',
    target: 10,
    reward: { type: 'crystals', crystals: 1000 },
    tier: 2,
  },
  {
    id: 'campaign:act3:100',
    name: 'The Waste Is Your Home Now',
    description: 'Complete Act 3 one hundred times',
    category: 'campaign',
    progressKey: 'campaign:act3',
    target: 100,
    reward: {
      type: 'item',
      item: { id: 'ashen_shroud', name: 'Ashen Shroud', icon: '💀', desc: 'The Ashen Wastes hold no fear for someone who has walked them a hundred times.' },
    },
    tier: 2,
  },
  {
    id: 'campaign:act4:1',
    name: 'The Archivist Closed',
    description: 'Complete Act 4 — The Crystal Spire',
    category: 'campaign',
    progressKey: 'campaign:act4',
    target: 1,
    reward: { type: 'crystals', crystals: 250 },
    tier: 1,
  },
  {
    id: 'campaign:act4:10',
    name: 'Shelved Under "Defeated"',
    description: 'Complete Act 4 ten times',
    category: 'campaign',
    progressKey: 'campaign:act4',
    target: 10,
    reward: { type: 'crystals', crystals: 1250 },
    tier: 2,
  },
  {
    id: 'campaign:act4:100',
    name: 'Infinite Mana, Infinite Patience',
    description: 'Complete Act 4 one hundred times',
    category: 'campaign',
    progressKey: 'campaign:act4',
    target: 100,
    reward: {
      type: 'item',
      item: { id: 'prism_lens_badge', name: 'Prism Lens Badge', icon: '🔮', desc: 'The Crystal Spire has been catalogued, indexed, and beaten into submission.' },
    },
    tier: 2,
  },

  // Act 5 — The Sunken Reef
  {
    id: 'campaign:act5:1',
    name: 'Tidal Sovereign Toppled',
    description: 'Complete Act 5 — The Sunken Reef',
    category: 'campaign',
    progressKey: 'campaign:act5',
    target: 1,
    reward: { type: 'crystals', crystals: 300 },
    tier: 1,
  },
  {
    id: 'campaign:act5:10',
    name: 'Reef Raider',
    description: 'Complete Act 5 ten times',
    category: 'campaign',
    progressKey: 'campaign:act5',
    target: 10,
    reward: { type: 'crystals', crystals: 1500 },
    tier: 2,
  },
  {
    id: 'campaign:act5:100',
    name: 'The Deep Remembers',
    description: 'Complete Act 5 one hundred times',
    category: 'campaign',
    progressKey: 'campaign:act5',
    target: 100,
    reward: {
      type: 'item',
      item: { id: 'coral_crown', name: 'Coral Crown', icon: '🪸', desc: 'The Tidal Sovereign\'s reef is now a vacation spot for you.' },
    },
    tier: 2,
  },

  // Act 6 — The Sky Dominion
  {
    id: 'campaign:act6:1',
    name: 'Cloudmarshal Grounded',
    description: 'Complete Act 6 — The Sky Dominion',
    category: 'campaign',
    progressKey: 'campaign:act6',
    target: 1,
    reward: { type: 'crystals', crystals: 350 },
    tier: 1,
  },
  {
    id: 'campaign:act6:10',
    name: 'Air Superiority',
    description: 'Complete Act 6 ten times',
    category: 'campaign',
    progressKey: 'campaign:act6',
    target: 10,
    reward: { type: 'crystals', crystals: 1750 },
    tier: 2,
  },
  {
    id: 'campaign:act6:100',
    name: 'Wings Clipped, Permanently',
    description: 'Complete Act 6 one hundred times',
    category: 'campaign',
    progressKey: 'campaign:act6',
    target: 100,
    reward: {
      type: 'item',
      item: { id: 'stormcaller_feather', name: "Stormcaller's Feather", icon: '🪶', desc: 'A trophy from the skies. The Cloudmarshal sends his regards — from very far below.' },
    },
    tier: 2,
  },

  // Act 7 — The Emberfall Peaks
  {
    id: 'campaign:act7:1',
    name: 'Cinderwarlord Extinguished',
    description: 'Complete Act 7 — The Emberfall Peaks',
    category: 'campaign',
    progressKey: 'campaign:act7',
    target: 1,
    reward: { type: 'crystals', crystals: 400 },
    tier: 1,
  },
  {
    id: 'campaign:act7:10',
    name: 'Fireproof',
    description: 'Complete Act 7 ten times',
    category: 'campaign',
    progressKey: 'campaign:act7',
    target: 10,
    reward: { type: 'crystals', crystals: 2000 },
    tier: 2,
  },
  {
    id: 'campaign:act7:100',
    name: 'The Volcano Is Yours Now',
    description: 'Complete Act 7 one hundred times',
    category: 'campaign',
    progressKey: 'campaign:act7',
    target: 100,
    reward: {
      type: 'item',
      item: { id: 'magma_core_shard', name: 'Magma Core Shard', icon: '🌋', desc: 'Still warm. Always will be.' },
    },
    tier: 2,
  },

  // Act 8 — The Fungal Deep
  {
    id: 'campaign:act8:1',
    name: 'Root Queen Dethroned',
    description: 'Complete Act 8 — The Fungal Deep',
    category: 'campaign',
    progressKey: 'campaign:act8',
    target: 1,
    reward: { type: 'crystals', crystals: 450 },
    tier: 1,
  },
  {
    id: 'campaign:act8:10',
    name: 'Mycologist',
    description: 'Complete Act 8 ten times',
    category: 'campaign',
    progressKey: 'campaign:act8',
    target: 10,
    reward: { type: 'crystals', crystals: 2250 },
    tier: 2,
  },
  {
    id: 'campaign:act8:100',
    name: 'The Spores Know Your Name',
    description: 'Complete Act 8 one hundred times',
    category: 'campaign',
    progressKey: 'campaign:act8',
    target: 100,
    reward: {
      type: 'item',
      item: { id: 'spore_bloom_crown', name: 'Spore Bloom Crown', icon: '🍄', desc: 'The Root Queen grew it herself. Before you killed her. Again.' },
    },
    tier: 2,
  },

  // Act 9 — The Frozen Expanse
  {
    id: 'campaign:act9:1',
    name: 'Pale Engine Shattered',
    description: 'Complete Act 9 — The Frozen Expanse',
    category: 'campaign',
    progressKey: 'campaign:act9',
    target: 1,
    reward: { type: 'crystals', crystals: 500 },
    tier: 1,
  },
  {
    id: 'campaign:act9:10',
    name: 'Cold-Blooded Victor',
    description: 'Complete Act 9 ten times',
    category: 'campaign',
    progressKey: 'campaign:act9',
    target: 10,
    reward: { type: 'crystals', crystals: 2500 },
    tier: 2,
  },
  {
    id: 'campaign:act9:100',
    name: 'The Glacier Bows to No One (Except You)',
    description: 'Complete Act 9 one hundred times',
    category: 'campaign',
    progressKey: 'campaign:act9',
    target: 100,
    reward: {
      type: 'item',
      item: { id: 'frost_mantle_shard', name: 'Frost Mantle Shard', icon: '❄️', desc: 'The Pale Engine\'s last breath, frozen mid-exhale.' },
    },
    tier: 2,
  },

  // Act 10 — The Sand Market
  {
    id: 'campaign:act10:1',
    name: 'Dune Baron Buried',
    description: 'Complete Act 10 — The Sand Market',
    category: 'campaign',
    progressKey: 'campaign:act10',
    target: 1,
    reward: { type: 'crystals', crystals: 550 },
    tier: 1,
  },
  {
    id: 'campaign:act10:10',
    name: 'Desert Fox',
    description: 'Complete Act 10 ten times',
    category: 'campaign',
    progressKey: 'campaign:act10',
    target: 10,
    reward: { type: 'crystals', crystals: 2750 },
    tier: 2,
  },
  {
    id: 'campaign:act10:100',
    name: 'The Market Is Yours',
    description: 'Complete Act 10 one hundred times',
    category: 'campaign',
    progressKey: 'campaign:act10',
    target: 100,
    reward: {
      type: 'item',
      item: { id: 'golden_compass_replica', name: 'Golden Compass Replica', icon: '🧭', desc: 'Points toward profit. Has never been wrong.' },
    },
    tier: 2,
  },

  // ── Boss avatar unlocks (one per act, triggered on first act completion) ─

  { id: 'campaign:act1:boss',  name: 'Face of the Thornlord',       description: 'Defeat Act 1 to unlock the Thornlord avatar',       category: 'campaign', progressKey: 'campaign:act1',  target: 1, reward: { type: 'avatar', avatarSlug: 'boss-thornlord' },       tier: 1 },
  { id: 'campaign:act2:boss',  name: 'Face of Kragg',               description: 'Defeat Act 2 to unlock Warlord Kragg avatar',        category: 'campaign', progressKey: 'campaign:act2',  target: 1, reward: { type: 'avatar', avatarSlug: 'boss-kragg' },           tier: 1 },
  { id: 'campaign:act3:boss',  name: 'Face of the Ashwalker',       description: 'Defeat Act 3 to unlock the Ashwalker avatar',        category: 'campaign', progressKey: 'campaign:act3',  target: 1, reward: { type: 'avatar', avatarSlug: 'boss-ashwalker' },       tier: 1 },
  { id: 'campaign:act4:boss',  name: 'Face of the Archivist',       description: 'Defeat Act 4 to unlock the Archivist avatar',        category: 'campaign', progressKey: 'campaign:act4',  target: 1, reward: { type: 'avatar', avatarSlug: 'boss-archivist' },       tier: 1 },
  { id: 'campaign:act5:boss',  name: 'Face of the Tidal Sovereign', description: 'Defeat Act 5 to unlock the Tidal Sovereign avatar',  category: 'campaign', progressKey: 'campaign:act5',  target: 1, reward: { type: 'avatar', avatarSlug: 'boss-tidal-sovereign' }, tier: 1 },
  { id: 'campaign:act6:boss',  name: 'Face of the Cloudmarshal',   description: 'Defeat Act 6 to unlock the Cloudmarshal avatar',    category: 'campaign', progressKey: 'campaign:act6',  target: 1, reward: { type: 'avatar', avatarSlug: 'boss-cloudmarshal' },   tier: 1 },
  { id: 'campaign:act7:boss',  name: 'Face of the Cinderwarlord',  description: 'Defeat Act 7 to unlock the Cinderwarlord avatar',   category: 'campaign', progressKey: 'campaign:act7',  target: 1, reward: { type: 'avatar', avatarSlug: 'boss-cinderwarlord' },  tier: 1 },
  { id: 'campaign:act8:boss',  name: 'Face of the Root Queen',     description: 'Defeat Act 8 to unlock the Root Queen avatar',     category: 'campaign', progressKey: 'campaign:act8',  target: 1, reward: { type: 'avatar', avatarSlug: 'boss-rootqueen' },      tier: 1 },
  { id: 'campaign:act9:boss',  name: 'Face of the Pale Engine',    description: 'Defeat Act 9 to unlock the Pale Engine avatar',    category: 'campaign', progressKey: 'campaign:act9',  target: 1, reward: { type: 'avatar', avatarSlug: 'boss-paleengine' },    tier: 1 },
  { id: 'campaign:act10:boss', name: 'Face of the Dune Baron',     description: 'Defeat Act 10 to unlock the Dune Baron avatar',    category: 'campaign', progressKey: 'campaign:act10', target: 1, reward: { type: 'avatar', avatarSlug: 'boss-dunebaron' },    tier: 1 },
  { id: 'campaign:act11:boss', name: 'Face of the Elder Warden',   description: 'Defeat Act 11 to unlock the Elder Warden avatar',  category: 'campaign', progressKey: 'campaign:act11', target: 1, reward: { type: 'avatar', avatarSlug: 'boss-elderwarden' },   tier: 1 },
  { id: 'campaign:act12:boss', name: 'Face of the Harbormaster',   description: 'Defeat Act 12 to unlock the Harbormaster avatar',  category: 'campaign', progressKey: 'campaign:act12', target: 1, reward: { type: 'avatar', avatarSlug: 'boss-harbormaster' },  tier: 1 },
  { id: 'campaign:act13:boss', name: 'Face of the Grand Automaton',description: 'Defeat Act 13 to unlock the Grand Automaton avatar',category: 'campaign', progressKey: 'campaign:act13', target: 1, reward: { type: 'avatar', avatarSlug: 'boss-grandautomaton' },tier: 1 },

  // ── Boss Cards — earned by repeat boss completions (10/20/30/40 runs) ────
  // Act 1 — Thornlord
  { id: 'campaign:act1:bosscard10',  name: 'Trophy of the Thornlord',        description: 'Defeat Act 1 ten times',    category: 'campaign', progressKey: 'campaign:act1',  target: 10, reward: { type: 'cards', cardName: 'Thornlord',        count: 1 }, tier: 2 },
  { id: 'campaign:act1:bosscard20',  name: 'Duplicate of the Thornlord',     description: 'Defeat Act 1 twenty times', category: 'campaign', progressKey: 'campaign:act1',  target: 20, reward: { type: 'cards', cardName: 'Thornlord',        count: 1 }, tier: 2 },
  { id: 'campaign:act1:bosscard30',  name: 'Mastery of the Thornlord',       description: 'Defeat Act 1 thirty times', category: 'campaign', progressKey: 'campaign:act1',  target: 30, reward: { type: 'cards', cardName: 'Thornlord',        count: 1 }, tier: 2 },
  { id: 'campaign:act1:bosscard40',  name: 'Legend of the Thornlord',        description: 'Defeat Act 1 forty times',  category: 'campaign', progressKey: 'campaign:act1',  target: 40, reward: { type: 'cards', cardName: 'Thornlord',        count: 1 }, tier: 2 },
  // Act 2 — Kragg
  { id: 'campaign:act2:bosscard10',  name: "Trophy of Kragg",                description: 'Defeat Act 2 ten times',    category: 'campaign', progressKey: 'campaign:act2',  target: 10, reward: { type: 'cards', cardName: 'Warlord Kragg',     count: 1 }, tier: 2 },
  { id: 'campaign:act2:bosscard20',  name: "Duplicate of Kragg",             description: 'Defeat Act 2 twenty times', category: 'campaign', progressKey: 'campaign:act2',  target: 20, reward: { type: 'cards', cardName: 'Warlord Kragg',     count: 1 }, tier: 2 },
  { id: 'campaign:act2:bosscard30',  name: "Mastery of Kragg",               description: 'Defeat Act 2 thirty times', category: 'campaign', progressKey: 'campaign:act2',  target: 30, reward: { type: 'cards', cardName: 'Warlord Kragg',     count: 1 }, tier: 2 },
  { id: 'campaign:act2:bosscard40',  name: "Legend of Kragg",                description: 'Defeat Act 2 forty times',  category: 'campaign', progressKey: 'campaign:act2',  target: 40, reward: { type: 'cards', cardName: 'Warlord Kragg',     count: 1 }, tier: 2 },
  // Act 3 — Ashwalker
  { id: 'campaign:act3:bosscard10',  name: 'Trophy of the Ashwalker',        description: 'Defeat Act 3 ten times',    category: 'campaign', progressKey: 'campaign:act3',  target: 10, reward: { type: 'cards', cardName: 'The Ashwalker',     count: 1 }, tier: 2 },
  { id: 'campaign:act3:bosscard20',  name: 'Duplicate of the Ashwalker',     description: 'Defeat Act 3 twenty times', category: 'campaign', progressKey: 'campaign:act3',  target: 20, reward: { type: 'cards', cardName: 'The Ashwalker',     count: 1 }, tier: 2 },
  { id: 'campaign:act3:bosscard30',  name: 'Mastery of the Ashwalker',       description: 'Defeat Act 3 thirty times', category: 'campaign', progressKey: 'campaign:act3',  target: 30, reward: { type: 'cards', cardName: 'The Ashwalker',     count: 1 }, tier: 2 },
  { id: 'campaign:act3:bosscard40',  name: 'Legend of the Ashwalker',        description: 'Defeat Act 3 forty times',  category: 'campaign', progressKey: 'campaign:act3',  target: 40, reward: { type: 'cards', cardName: 'The Ashwalker',     count: 1 }, tier: 2 },
  // Act 4 — Archivist
  { id: 'campaign:act4:bosscard10',  name: 'Trophy of the Archivist',        description: 'Defeat Act 4 ten times',    category: 'campaign', progressKey: 'campaign:act4',  target: 10, reward: { type: 'cards', cardName: 'The Archivist',     count: 1 }, tier: 2 },
  { id: 'campaign:act4:bosscard20',  name: 'Duplicate of the Archivist',     description: 'Defeat Act 4 twenty times', category: 'campaign', progressKey: 'campaign:act4',  target: 20, reward: { type: 'cards', cardName: 'The Archivist',     count: 1 }, tier: 2 },
  { id: 'campaign:act4:bosscard30',  name: 'Mastery of the Archivist',       description: 'Defeat Act 4 thirty times', category: 'campaign', progressKey: 'campaign:act4',  target: 30, reward: { type: 'cards', cardName: 'The Archivist',     count: 1 }, tier: 2 },
  { id: 'campaign:act4:bosscard40',  name: 'Legend of the Archivist',        description: 'Defeat Act 4 forty times',  category: 'campaign', progressKey: 'campaign:act4',  target: 40, reward: { type: 'cards', cardName: 'The Archivist',     count: 1 }, tier: 2 },
  // Act 5 — Tidal Sovereign
  { id: 'campaign:act5:bosscard10',  name: 'Trophy of the Tidal Sovereign',  description: 'Defeat Act 5 ten times',    category: 'campaign', progressKey: 'campaign:act5',  target: 10, reward: { type: 'cards', cardName: 'Tidal Sovereign',   count: 1 }, tier: 2 },
  { id: 'campaign:act5:bosscard20',  name: 'Duplicate of the Tidal Sovereign',description:'Defeat Act 5 twenty times', category: 'campaign', progressKey: 'campaign:act5',  target: 20, reward: { type: 'cards', cardName: 'Tidal Sovereign',   count: 1 }, tier: 2 },
  { id: 'campaign:act5:bosscard30',  name: 'Mastery of the Tidal Sovereign', description: 'Defeat Act 5 thirty times', category: 'campaign', progressKey: 'campaign:act5',  target: 30, reward: { type: 'cards', cardName: 'Tidal Sovereign',   count: 1 }, tier: 2 },
  { id: 'campaign:act5:bosscard40',  name: 'Legend of the Tidal Sovereign',  description: 'Defeat Act 5 forty times',  category: 'campaign', progressKey: 'campaign:act5',  target: 40, reward: { type: 'cards', cardName: 'Tidal Sovereign',   count: 1 }, tier: 2 },
  // Act 6 — Cloudmarshal
  { id: 'campaign:act6:bosscard10',  name: 'Trophy of the Cloudmarshal',     description: 'Defeat Act 6 ten times',    category: 'campaign', progressKey: 'campaign:act6',  target: 10, reward: { type: 'cards', cardName: 'Cloudmarshal',      count: 1 }, tier: 2 },
  { id: 'campaign:act6:bosscard20',  name: 'Duplicate of the Cloudmarshal',  description: 'Defeat Act 6 twenty times', category: 'campaign', progressKey: 'campaign:act6',  target: 20, reward: { type: 'cards', cardName: 'Cloudmarshal',      count: 1 }, tier: 2 },
  { id: 'campaign:act6:bosscard30',  name: 'Mastery of the Cloudmarshal',    description: 'Defeat Act 6 thirty times', category: 'campaign', progressKey: 'campaign:act6',  target: 30, reward: { type: 'cards', cardName: 'Cloudmarshal',      count: 1 }, tier: 2 },
  { id: 'campaign:act6:bosscard40',  name: 'Legend of the Cloudmarshal',     description: 'Defeat Act 6 forty times',  category: 'campaign', progressKey: 'campaign:act6',  target: 40, reward: { type: 'cards', cardName: 'Cloudmarshal',      count: 1 }, tier: 2 },
  // Act 7 — Cinderwarlord
  { id: 'campaign:act7:bosscard10',  name: 'Trophy of the Cinderwarlord',    description: 'Defeat Act 7 ten times',    category: 'campaign', progressKey: 'campaign:act7',  target: 10, reward: { type: 'cards', cardName: 'Cinderwarlord',     count: 1 }, tier: 2 },
  { id: 'campaign:act7:bosscard20',  name: 'Duplicate of the Cinderwarlord', description: 'Defeat Act 7 twenty times', category: 'campaign', progressKey: 'campaign:act7',  target: 20, reward: { type: 'cards', cardName: 'Cinderwarlord',     count: 1 }, tier: 2 },
  { id: 'campaign:act7:bosscard30',  name: 'Mastery of the Cinderwarlord',   description: 'Defeat Act 7 thirty times', category: 'campaign', progressKey: 'campaign:act7',  target: 30, reward: { type: 'cards', cardName: 'Cinderwarlord',     count: 1 }, tier: 2 },
  { id: 'campaign:act7:bosscard40',  name: 'Legend of the Cinderwarlord',    description: 'Defeat Act 7 forty times',  category: 'campaign', progressKey: 'campaign:act7',  target: 40, reward: { type: 'cards', cardName: 'Cinderwarlord',     count: 1 }, tier: 2 },
  // Act 8 — Root Queen
  { id: 'campaign:act8:bosscard10',  name: 'Trophy of the Root Queen',       description: 'Defeat Act 8 ten times',    category: 'campaign', progressKey: 'campaign:act8',  target: 10, reward: { type: 'cards', cardName: 'Root Queen',        count: 1 }, tier: 2 },
  { id: 'campaign:act8:bosscard20',  name: 'Duplicate of the Root Queen',    description: 'Defeat Act 8 twenty times', category: 'campaign', progressKey: 'campaign:act8',  target: 20, reward: { type: 'cards', cardName: 'Root Queen',        count: 1 }, tier: 2 },
  { id: 'campaign:act8:bosscard30',  name: 'Mastery of the Root Queen',      description: 'Defeat Act 8 thirty times', category: 'campaign', progressKey: 'campaign:act8',  target: 30, reward: { type: 'cards', cardName: 'Root Queen',        count: 1 }, tier: 2 },
  { id: 'campaign:act8:bosscard40',  name: 'Legend of the Root Queen',       description: 'Defeat Act 8 forty times',  category: 'campaign', progressKey: 'campaign:act8',  target: 40, reward: { type: 'cards', cardName: 'Root Queen',        count: 1 }, tier: 2 },
  // Act 9 — Pale Engine
  { id: 'campaign:act9:bosscard10',  name: 'Trophy of the Pale Engine',      description: 'Defeat Act 9 ten times',    category: 'campaign', progressKey: 'campaign:act9',  target: 10, reward: { type: 'cards', cardName: 'Pale Engine',       count: 1 }, tier: 2 },
  { id: 'campaign:act9:bosscard20',  name: 'Duplicate of the Pale Engine',   description: 'Defeat Act 9 twenty times', category: 'campaign', progressKey: 'campaign:act9',  target: 20, reward: { type: 'cards', cardName: 'Pale Engine',       count: 1 }, tier: 2 },
  { id: 'campaign:act9:bosscard30',  name: 'Mastery of the Pale Engine',     description: 'Defeat Act 9 thirty times', category: 'campaign', progressKey: 'campaign:act9',  target: 30, reward: { type: 'cards', cardName: 'Pale Engine',       count: 1 }, tier: 2 },
  { id: 'campaign:act9:bosscard40',  name: 'Legend of the Pale Engine',      description: 'Defeat Act 9 forty times',  category: 'campaign', progressKey: 'campaign:act9',  target: 40, reward: { type: 'cards', cardName: 'Pale Engine',       count: 1 }, tier: 2 },
  // Act 10 — Dune Baron
  { id: 'campaign:act10:bosscard10', name: 'Trophy of the Dune Baron',       description: 'Defeat Act 10 ten times',   category: 'campaign', progressKey: 'campaign:act10', target: 10, reward: { type: 'cards', cardName: 'Dune Baron',        count: 1 }, tier: 2 },
  { id: 'campaign:act10:bosscard20', name: 'Duplicate of the Dune Baron',    description: 'Defeat Act 10 twenty times',category: 'campaign', progressKey: 'campaign:act10', target: 20, reward: { type: 'cards', cardName: 'Dune Baron',        count: 1 }, tier: 2 },
  { id: 'campaign:act10:bosscard30', name: 'Mastery of the Dune Baron',      description: 'Defeat Act 10 thirty times',category: 'campaign', progressKey: 'campaign:act10', target: 30, reward: { type: 'cards', cardName: 'Dune Baron',        count: 1 }, tier: 2 },
  { id: 'campaign:act10:bosscard40', name: 'Legend of the Dune Baron',       description: 'Defeat Act 10 forty times', category: 'campaign', progressKey: 'campaign:act10', target: 40, reward: { type: 'cards', cardName: 'Dune Baron',        count: 1 }, tier: 2 },
  // Act 11 — Elder Warden
  { id: 'campaign:act11:bosscard10', name: 'Trophy of the Elder Warden',     description: 'Defeat Act 11 ten times',   category: 'campaign', progressKey: 'campaign:act11', target: 10, reward: { type: 'cards', cardName: 'Elder Warden',      count: 1 }, tier: 2 },
  { id: 'campaign:act11:bosscard20', name: 'Duplicate of the Elder Warden',  description: 'Defeat Act 11 twenty times',category: 'campaign', progressKey: 'campaign:act11', target: 20, reward: { type: 'cards', cardName: 'Elder Warden',      count: 1 }, tier: 2 },
  { id: 'campaign:act11:bosscard30', name: 'Mastery of the Elder Warden',    description: 'Defeat Act 11 thirty times',category: 'campaign', progressKey: 'campaign:act11', target: 30, reward: { type: 'cards', cardName: 'Elder Warden',      count: 1 }, tier: 2 },
  { id: 'campaign:act11:bosscard40', name: 'Legend of the Elder Warden',     description: 'Defeat Act 11 forty times', category: 'campaign', progressKey: 'campaign:act11', target: 40, reward: { type: 'cards', cardName: 'Elder Warden',      count: 1 }, tier: 2 },
  // Act 12 — Harbormaster
  { id: 'campaign:act12:bosscard10', name: 'Trophy of the Harbormaster',     description: 'Defeat Act 12 ten times',   category: 'campaign', progressKey: 'campaign:act12', target: 10, reward: { type: 'cards', cardName: 'The Harbormaster',  count: 1 }, tier: 2 },
  { id: 'campaign:act12:bosscard20', name: 'Duplicate of the Harbormaster',  description: 'Defeat Act 12 twenty times',category: 'campaign', progressKey: 'campaign:act12', target: 20, reward: { type: 'cards', cardName: 'The Harbormaster',  count: 1 }, tier: 2 },
  { id: 'campaign:act12:bosscard30', name: 'Mastery of the Harbormaster',    description: 'Defeat Act 12 thirty times',category: 'campaign', progressKey: 'campaign:act12', target: 30, reward: { type: 'cards', cardName: 'The Harbormaster',  count: 1 }, tier: 2 },
  { id: 'campaign:act12:bosscard40', name: 'Legend of the Harbormaster',     description: 'Defeat Act 12 forty times', category: 'campaign', progressKey: 'campaign:act12', target: 40, reward: { type: 'cards', cardName: 'The Harbormaster',  count: 1 }, tier: 2 },
  // Act 13 — Grand Automaton
  { id: 'campaign:act13:bosscard10', name: 'Trophy of the Grand Automaton',  description: 'Defeat Act 13 ten times',   category: 'campaign', progressKey: 'campaign:act13', target: 10, reward: { type: 'cards', cardName: 'Grand Automaton',   count: 1 }, tier: 2 },
  { id: 'campaign:act13:bosscard20', name: 'Duplicate of the Grand Automaton',description:'Defeat Act 13 twenty times',category: 'campaign', progressKey: 'campaign:act13', target: 20, reward: { type: 'cards', cardName: 'Grand Automaton',   count: 1 }, tier: 2 },
  { id: 'campaign:act13:bosscard30', name: 'Mastery of the Grand Automaton', description: 'Defeat Act 13 thirty times',category: 'campaign', progressKey: 'campaign:act13', target: 30, reward: { type: 'cards', cardName: 'Grand Automaton',   count: 1 }, tier: 2 },
  { id: 'campaign:act13:bosscard40', name: 'Legend of the Grand Automaton',  description: 'Defeat Act 13 forty times', category: 'campaign', progressKey: 'campaign:act13', target: 40, reward: { type: 'cards', cardName: 'Grand Automaton',   count: 1 }, tier: 2 },

  // ── Campaign failures ────────────────────────────────────────────────────

  {
    id: 'misc:campaign_failed_1',
    name: 'Valiantly Defeated',
    description: 'Lose a campaign run with all lives exhausted',
    category: 'misc',
    progressKey: 'misc:campaign_failed',
    target: 1,
    reward: { type: 'crystals', crystals: 25 },
    tier: 1,
  },
  {
    id: 'misc:campaign_failed_10',
    name: 'Never Give Up (Ironically)',
    description: 'Lose 10 campaign runs',
    category: 'misc',
    progressKey: 'misc:campaign_failed',
    target: 10,
    reward: { type: 'crystals', crystals: 100 },
    tier: 1,
  },
  {
    id: 'misc:campaign_failed_100',
    name: 'Hundred Heroic Defeats',
    description: 'Lose 100 campaign runs',
    category: 'misc',
    progressKey: 'misc:campaign_failed',
    target: 100,
    reward: { type: 'crystals', crystals: 500 },
    tier: 2,
  },
  {
    id: 'misc:campaign_failed_1000',
    name: 'Defeat Is My Middle Name',
    description: 'Lose 1,000 campaign runs',
    category: 'misc',
    progressKey: 'misc:campaign_failed',
    target: 1000,
    reward: {
      type: 'item',
      item: { id: 'white_flag', name: 'White Flag', icon: '🏳️', desc: 'Earned after 1,000 campaign failures. Worn with perverse pride.' },
    },
    tier: 2,
  },

  // ── Misc ─────────────────────────────────────────────────────────────────

  {
    id: 'misc:first_win',
    name: 'A Promising Start',
    description: 'Win your first Quick Battle',
    category: 'misc',
    progressKey: 'misc:quick_win',
    target: 1,
    reward: { type: 'crystals', crystals: 50 },
    tier: 1,
  },
  {
    id: 'misc:win_100',
    name: 'Seasoned Commander',
    description: 'Win 100 Quick Battles',
    category: 'misc',
    progressKey: 'misc:quick_win',
    target: 100,
    reward: { type: 'crystals', crystals: 500 },
    tier: 2,
  },
  {
    id: 'misc:cards_played_1000',
    name: 'Card Shark',
    description: 'Play 1,000 cards from hand',
    category: 'misc',
    progressKey: 'misc:cards_played',
    target: 1000,
    reward: { type: 'crystals', crystals: 200 },
    tier: 1,
  },
  {
    id: 'misc:cards_played_10000',
    name: 'Living Card Game',
    description: 'Play 10,000 cards from hand',
    category: 'misc',
    progressKey: 'misc:cards_played',
    target: 10000,
    reward: { type: 'crystals', crystals: 1000 },
    tier: 2,
  },
  {
    id: 'misc:enemy_kills_1000',
    name: 'Battlefield Cleaner',
    description: 'Kill 1,000 enemy units or structures (any type)',
    category: 'misc',
    progressKey: 'misc:total_kills',
    target: 1000,
    reward: { type: 'crystals', crystals: 150 },
    tier: 1,
  },
  {
    id: 'misc:enemy_kills_10000',
    name: 'The Reaper',
    description: 'Kill 10,000 enemy units or structures (any type)',
    category: 'misc',
    progressKey: 'misc:total_kills',
    target: 10000,
    reward: { type: 'crystals', crystals: 750 },
    tier: 2,
  },
  {
    id: 'misc:pacifist_win',
    name: 'Fortress Mode',
    description: 'Win a battle without deploying a single mobile unit (structures only)',
    category: 'misc',
    progressKey: 'misc:pacifist_win',
    target: 1,
    reward: { type: 'crystals', crystals: 200 },
    tier: 1,
  },
  {
    id: 'misc:no_structure_win',
    name: 'Open Field Commander',
    description: 'Win a battle without playing any structures',
    category: 'misc',
    progressKey: 'misc:no_structure_win',
    target: 1,
    reward: { type: 'crystals', crystals: 200 },
    tier: 1,
  },
  {
    id: 'misc:sudden_death_win',
    name: 'Overtime Champion',
    description: 'Win a battle during Sudden Death',
    category: 'misc',
    progressKey: 'misc:sudden_death_win',
    target: 1,
    reward: { type: 'crystals', crystals: 150 },
    tier: 1,
  },
  {
    id: 'misc:underdog_win',
    name: 'Never Tell Me the Odds',
    description: 'Win a battle with your base at 1 HP',
    category: 'misc',
    progressKey: 'misc:underdog_win',
    target: 1,
    reward: { type: 'crystals', crystals: 300 },
    tier: 1,
  },
  {
    id: 'misc:flawless_win',
    name: 'Untouchable',
    description: 'Win a battle without your base taking any damage',
    category: 'misc',
    progressKey: 'misc:flawless_win',
    target: 1,
    reward: { type: 'crystals', crystals: 400 },
    tier: 1,
  },
  {
    id: 'misc:rubber_chicken_5',
    name: "The Gambler's Nemesis",
    description: 'Collect 5 Rubber Chickens from The Gambler',
    category: 'misc',
    progressKey: 'event:rubber_chicken',
    target: 5,
    reward: {
      type: 'item',
      item: { id: 'golden_rubber_chicken', name: 'Golden Rubber Chicken', icon: '🏆', desc: 'You have failed The Gambler so many times it became art.' },
    },
    tier: 2,
  },
  {
    id: 'misc:nine_lives',
    name: 'Nine Lives',
    description: 'Accumulate 9 lives at once through relics and events',
    category: 'misc',
    progressKey: 'misc:nine_lives',
    target: 1,
    reward: { type: 'crystals', crystals: 333 },
    tier: 2,
  },
  // ── Mystery Node ──────────────────────────────────────────────────────────

  {
    id: 'misc:mystery_1',
    name: 'Wrong Turn',
    description: 'You arrived. The battlefield was empty.',
    category: 'misc',
    progressKey: 'misc:mystery_encounter',
    target: 1,
    reward: { type: 'crystals', crystals: 50 },
    tier: 1,
  },
  {
    id: 'misc:mystery_100',
    name: 'The Silence Feels Familiar',
    description: 'Find 100 empty battlefields. A pattern. Or paranoia.',
    category: 'misc',
    progressKey: 'misc:mystery_encounter',
    target: 100,
    reward: { type: 'crystals', crystals: 300 },
    tier: 1,
  },
  {
    id: 'misc:mystery_1000',
    name: 'Something Watches',
    description: 'A thousand empty battlefields. You are not alone in noticing.',
    category: 'misc',
    progressKey: 'misc:mystery_encounter',
    target: 1000,
    reward: {
      type: 'item',
      item: { id: 'void_compass', name: 'Void Compass', icon: '🧭', desc: 'Points toward nothing. Has never been wrong.' },
    },
    tier: 2,
  },

  {
    id: 'misc:refresh_cheat',
    name: 'Ctrl+R',
    description: 'Refreshed the page mid-battle hoping for a better outcome. We restored your state anyway.',
    category: 'misc',
    progressKey: 'misc:refresh_cheat',
    target: 1,
    reward: { type: 'crystals', crystals: 0 },
    tier: 1,
  },

  // ── Item collection ───────────────────────────────────────────────────────

  {
    id: 'misc:items_10',
    name: 'Hoarder',
    description: 'Collect 10 unique useless items',
    category: 'misc',
    progressKey: 'misc:unique_items',
    target: 10,
    reward: { type: 'crystals', crystals: 50 },
    tier: 1,
  },
  {
    id: 'misc:items_50',
    name: 'Compulsive Collector',
    description: 'Collect 50 unique useless items',
    category: 'misc',
    progressKey: 'misc:unique_items',
    target: 50,
    reward: { type: 'crystals', crystals: 200 },
    tier: 1,
  },
  {
    id: 'misc:items_100',
    name: 'Professional Packrat',
    description: 'Collect 100 unique useless items',
    category: 'misc',
    progressKey: 'misc:unique_items',
    target: 100,
    reward: { type: 'crystals', crystals: 500 },
    tier: 2,
  },
  {
    id: 'misc:items_full_set',
    name: 'Full Set',
    description: 'Collect every useless item in the game',
    category: 'misc',
    progressKey: 'misc:unique_items',
    target: 423,
    reward: {
      type: 'item',
      item: { id: 'category_error', name: 'Category Error', icon: '❓', desc: 'This item is not an item.' },
    },
    tier: 2,
  },

  // ── Title Screen Idle Visitor ─────────────────────────────────────────────

  {
    id: 'misc:title_idle_1',
    name: 'Someone\'s Waiting',
    description: 'Watch the title screen visitor appear for the first time',
    category: 'misc',
    progressKey: 'misc:title_idle_seen',
    target: 1,
    reward: { type: 'crystals', crystals: 25 },
    tier: 1,
  },
  {
    id: 'misc:title_idle_10',
    name: 'Regulars',
    description: 'Watch the title screen visitor appear 10 times',
    category: 'misc',
    progressKey: 'misc:title_idle_seen',
    target: 10,
    reward: { type: 'crystals', crystals: 100 },
    tier: 1,
  },
  {
    id: 'misc:title_idle_100',
    name: 'The Screen Never Gets Old',
    description: 'Watch the title screen visitor appear 100 times',
    category: 'misc',
    progressKey: 'misc:title_idle_seen',
    target: 100,
    reward: {
      type: 'item',
      item: { id: 'worn_welcome_mat', name: 'Worn Welcome Mat', icon: '🚪', desc: 'Left out so long that the visitors have worn a groove into it.' },
    },
    tier: 2,
  },
  {
    id: 'misc:title_idle_tap',
    name: 'No Loitering',
    description: 'Tap the screen to dismiss a title screen visitor',
    category: 'misc',
    progressKey: 'misc:title_idle_tap',
    target: 1,
    reward: { type: 'crystals', crystals: 10 },
    tier: 1,
  },
  {
    id: 'misc:title_idle_tap_10',
    name: 'Move Along',
    description: 'Dismiss 10 title screen visitors',
    category: 'misc',
    progressKey: 'misc:title_idle_tap',
    target: 10,
    reward: { type: 'crystals', crystals: 50 },
    tier: 1,
  },

  // ── Shop ─────────────────────────────────────────────────────────────────

  {
    id: 'misc:shop_broke_click',
    name: 'The Needy',
    description: 'Tap Buy in the shop 10 times when you can\'t afford it',
    category: 'misc',
    progressKey: 'misc:shop_broke_click',
    target: 10,
    reward: { type: 'crystals', crystals: 25 },
    tier: 1,
  },

  // ── Shop selling ─────────────────────────────────────────────────────────

  {
    id: 'misc:shop_sell_1',
    name: 'Entrepreneurial Spirit',
    description: 'Sold a useless item at the shop',
    category: 'misc',
    progressKey: 'misc:shop_sell_attempt',
    target: 1,
    reward: { type: 'crystals', crystals: 25 },
    tier: 1,
  },
  {
    id: 'misc:shop_sell_10',
    name: 'Persistent Vendor',
    description: 'Sold a useless item at the shop 10 times',
    category: 'misc',
    progressKey: 'misc:shop_sell_attempt',
    target: 10,
    reward: { type: 'crystals', crystals: 100 },
    tier: 1,
  },
  {
    id: 'misc:shop_sell_1000',
    name: 'The Customer Is Always Wrong',
    description: 'Sold a useless item at the shop 1,000 times',
    category: 'misc',
    progressKey: 'misc:shop_sell_attempt',
    target: 1000,
    reward: {
      type: 'item',
      item: { id: 'store_credit_note', name: 'Store Credit Note', icon: '🧾', desc: 'Valid for 0 crystals. Non-transferable. Non-redeemable. The shopkeeper signed it anyway.' },
    },
    tier: 2,
  },

  // ── Merchant ──────────────────────────────────────────────────────────────

  {
    id: 'misc:merchant_sweep_1',
    name: 'Big Spender',
    description: 'Buy every item in a single merchant visit.',
    category: 'misc',
    progressKey: 'misc:merchant_sweep',
    target: 1,
    reward: { type: 'crystals', crystals: 100 },
    tier: 1,
  },
  {
    id: 'misc:merchant_sweep_10',
    name: 'Merchant\'s Favourite',
    description: 'Buy every item in a merchant visit 10 times.',
    category: 'misc',
    progressKey: 'misc:merchant_sweep',
    target: 10,
    reward: { type: 'crystals', crystals: 500 },
    tier: 1,
  },
  {
    id: 'misc:merchant_sweep_100',
    name: 'The Merchant Fears You',
    description: 'Buy every item in a merchant visit 100 times.',
    category: 'misc',
    progressKey: 'misc:merchant_sweep',
    target: 100,
    reward: {
      type: 'item',
      item: { id: 'merchants_ledger', name: "Merchant's Ledger", icon: '📒', desc: 'Every page is IOUs. All to you.' },
    },
    tier: 2,
  },
  {
    id: 'misc:8bit_unlocked',
    name: '8-Bit Hero',
    description: 'You found it. The old ways were always there.',
    category: 'misc',
    progressKey: 'misc:8bit_unlock',
    target: 1,
    reward: { type: 'crystals', crystals: 50 },
    tier: 1,
  },
  {
    id: 'misc:konami_found',
    name: 'Up Up Down Down',
    description: 'Enter the Konami Code on the title screen.',
    category: 'misc',
    progressKey: 'misc:konami_code',
    target: 1,
    reward: { type: 'crystals', crystals: 30 },
    tier: 1,
  },
  {
    id: 'misc:battle_100_found',
    name: 'Century',
    description: 'Start 100 battles.',
    category: 'misc',
    progressKey: 'misc:battle_100',
    target: 1,
    reward: { type: 'crystals', crystals: 100 },
    tier: 2,
  },

  // ── Shop staff ────────────────────────────────────────────────────────────

  {
    id: 'misc:staff_met_all',
    name: 'Regular Customer',
    description: 'Meet every member of staff at the shop.',
    category: 'misc',
    progressKey: 'misc:staff_met',
    target: 11,
    reward: { type: 'crystals', crystals: 200 },
    tier: 1,
  },

  // ── Campaign win streak ───────────────────────────────────────────────────

  {
    id: 'streak:10',
    name: 'Hat Trick',
    description: 'Complete 10 campaigns in a row without losing.',
    category: 'campaign',
    progressKey: 'campaign:win_streak',
    target: 10,
    reward: {
      type: 'avatar',
      avatarSlug: 'streak-iron',
      bonusCrystals: 150,
      bonusCards: [{ cardName: 'Dragon', count: 1 }],
    },
    tier: 1,
  },
  {
    id: 'streak:25',
    name: 'On Fire',
    description: 'Complete 25 campaigns in a row without losing.',
    category: 'campaign',
    progressKey: 'campaign:win_streak',
    target: 25,
    reward: {
      type: 'avatar',
      avatarSlug: 'streak-flame',
      bonusCrystals: 350,
      bonusCards: [{ cardName: 'Dragon', count: 2 }],
    },
    tier: 1,
  },
  {
    id: 'streak:50',
    name: 'Shadowstep',
    description: 'Complete 50 campaigns in a row without losing.',
    category: 'campaign',
    progressKey: 'campaign:win_streak',
    target: 50,
    reward: {
      type: 'avatar',
      avatarSlug: 'streak-shadow',
      bonusCrystals: 600,
      bonusCards: [{ cardName: 'Golem', count: 3 }],
    },
    tier: 1,
  },
  {
    id: 'streak:100',
    name: 'Dragon Rider',
    description: 'Complete 100 campaigns in a row without losing.',
    category: 'campaign',
    progressKey: 'campaign:win_streak',
    target: 100,
    reward: {
      type: 'avatar',
      avatarSlug: 'streak-dragon',
      bonusCrystals: 1000,
      bonusCards: [{ cardName: 'Dragon Lair', count: 5 }],
    },
    tier: 2,
  },
  {
    id: 'streak:250',
    name: 'Celestial Ascendant',
    description: 'Complete 250 campaigns in a row without losing.',
    category: 'campaign',
    progressKey: 'campaign:win_streak',
    target: 250,
    reward: {
      type: 'avatar',
      avatarSlug: 'streak-celestial',
      bonusCrystals: 2000,
      bonusCards: [{ cardName: 'Dragon', count: 8 }],
    },
    tier: 2,
  },
  {
    id: 'streak:500',
    name: 'Void Walker',
    description: 'Complete 500 campaigns in a row without losing.',
    category: 'campaign',
    progressKey: 'campaign:win_streak',
    target: 500,
    reward: {
      type: 'avatar',
      avatarSlug: 'streak-void',
      bonusCrystals: 3500,
      bonusCards: [{ cardName: 'Cathedral', count: 10 }],
    },
    tier: 2,
  },
  {
    id: 'streak:750',
    name: 'Crystal Champion',
    description: 'Complete 750 campaigns in a row without losing.',
    category: 'campaign',
    progressKey: 'campaign:win_streak',
    target: 750,
    reward: {
      type: 'avatar',
      avatarSlug: 'streak-crystal',
      bonusCrystals: 5000,
      bonusCards: [{ cardName: 'Dragon', count: 15 }],
    },
    tier: 2,
  },
  {
    id: 'streak:1000',
    name: 'Fracture Lord',
    description: 'Complete 1,000 campaigns in a row without losing. A legend.',
    category: 'campaign',
    progressKey: 'campaign:win_streak',
    target: 1000,
    reward: {
      type: 'avatar',
      avatarSlug: 'streak-fracture',
      bonusCrystals: 10000,
      bonusCards: [{ cardName: 'Dragon', count: 20 }],
    },
    tier: 2,
  },

  // ── Daily Challenge ───────────────────────────────────────────────────────

  {
    id: 'daily:wins:1',
    name: 'Daily Regular',
    description: 'Win your first Daily Challenge.',
    category: 'daily',
    progressKey: 'daily:wins',
    target: 1,
    reward: { type: 'crystals', crystals: 50 },
    tier: 1,
  },
  {
    id: 'daily:wins:10',
    name: 'Dedicated',
    description: 'Win 10 Daily Challenges.',
    category: 'daily',
    progressKey: 'daily:wins',
    target: 10,
    reward: { type: 'crystals', crystals: 200 },
    tier: 1,
  },
  {
    id: 'daily:wins:30',
    name: 'Monthly Ritual',
    description: 'Win 30 Daily Challenges.',
    category: 'daily',
    progressKey: 'daily:wins',
    target: 30,
    reward: { type: 'crystals', crystals: 500 },
    tier: 1,
  },
  {
    id: 'daily:wins:100',
    name: 'Centurion',
    description: 'Win 100 Daily Challenges.',
    category: 'daily',
    progressKey: 'daily:wins',
    target: 100,
    reward: { type: 'crystals', crystals: 1000 },
    tier: 2,
  },
  {
    id: 'daily:first_try:1',
    name: 'Quick Study',
    description: 'Win a Daily Challenge on your first attempt.',
    category: 'daily',
    progressKey: 'daily:first_try',
    target: 1,
    reward: { type: 'crystals', crystals: 100 },
    tier: 1,
  },
  {
    id: 'daily:first_try:10',
    name: 'Sharp Mind',
    description: 'Win 10 Daily Challenges on the first attempt.',
    category: 'daily',
    progressKey: 'daily:first_try',
    target: 10,
    reward: { type: 'crystals', crystals: 400 },
    tier: 1,
  },
  {
    id: 'daily:streak:3',
    name: 'Three Peat',
    description: 'Win the Daily Challenge 3 days in a row.',
    category: 'daily',
    progressKey: 'daily:win_streak',
    target: 3,
    reward: { type: 'crystals', crystals: 75 },
    tier: 1,
  },
  {
    id: 'daily:streak:7',
    name: 'Week Warrior',
    description: 'Win the Daily Challenge 7 days in a row.',
    category: 'daily',
    progressKey: 'daily:win_streak',
    target: 7,
    reward: { type: 'crystals', crystals: 200 },
    tier: 1,
  },
  {
    id: 'daily:streak:30',
    name: 'Month of Mastery',
    description: 'Win the Daily Challenge 30 days in a row.',
    category: 'daily',
    progressKey: 'daily:win_streak',
    target: 30,
    reward: { type: 'crystals', crystals: 750 },
    tier: 2,
  },

  // ── Endless Mode ─────────────────────────────────────────────────────────

  {
    id: 'endless:survive:3m',
    name: 'First Stand',
    description: 'Survive 3 minutes in Endless Mode.',
    category: 'misc',
    progressKey: 'endless:survival_sec',
    target: 180,
    reward: { type: 'crystals', crystals: 30 },
    tier: 1,
  },
  {
    id: 'endless:survive:10m',
    name: 'Endless Resolve',
    description: 'Survive 10 minutes in Endless Mode.',
    category: 'misc',
    progressKey: 'endless:survival_sec',
    target: 600,
    reward: { type: 'crystals', crystals: 100 },
    tier: 1,
  },
  {
    id: 'endless:survive:20m',
    name: 'The Last Defender',
    description: 'Survive 20 minutes in Endless Mode.',
    category: 'misc',
    progressKey: 'endless:survival_sec',
    target: 1200,
    reward: { type: 'crystals', crystals: 250 },
    tier: 2,
  },
  {
    id: 'endless:wave:5',
    name: 'Wave Breaker',
    description: 'Reach wave 5 in Endless Mode.',
    category: 'misc',
    progressKey: 'endless:best_wave',
    target: 5,
    reward: { type: 'crystals', crystals: 50 },
    tier: 1,
  },
  {
    id: 'endless:wave:10',
    name: 'Tide Turner',
    description: 'Reach wave 10 in Endless Mode.',
    category: 'misc',
    progressKey: 'endless:best_wave',
    target: 10,
    reward: { type: 'crystals', crystals: 150 },
    tier: 1,
  },
  {
    id: 'endless:wave:20',
    name: 'Unstoppable',
    description: 'Reach wave 20 in Endless Mode.',
    category: 'misc',
    progressKey: 'endless:best_wave',
    target: 20,
    reward: { type: 'crystals', crystals: 400 },
    tier: 2,
  },
  {
    id: 'endless:wave:42',
    name: 'Life, the Universe, and Wave 42',
    description: 'Reach wave 42 in Endless Mode.',
    category: 'misc',
    progressKey: 'endless:best_wave',
    target: 42,
    reward: { type: 'crystals', crystals: 420 },
    tier: 2,
  },
  {
    id: 'endless:wave:69',
    name: 'Dude',
    description: 'Reach wave 69 in Endless Mode.',
    category: 'misc',
    progressKey: 'endless:best_wave',
    target: 69,
    reward: { type: 'crystals', crystals: 690 },
    tier: 2,
  },
  {
    id: 'endless:wave:99',
    name: 'Me Whippy Icecream',
    description: 'Reach wave 99 in Endless Mode.',
    category: 'misc',
    progressKey: 'endless:best_wave',
    target: 99,
    reward: { type: 'crystals', crystals: 990 },
    tier: 2,
  },
  {
    id: 'endless:wave:100',
    name: 'Triple Digits',
    description: 'Reach wave 100 in Endless Mode.',
    category: 'misc',
    progressKey: 'endless:best_wave',
    target: 100,
    reward: {
      type: 'item',
      item: { id: 'wave_100_trophy', name: 'Wave 100 Trophy', icon: '🏆', desc: 'One hundred waves. You are a problem.' },
    },
    tier: 2,
  },
  {
    id: 'endless:wave:1000',
    name: 'This Will Never Be Reached',
    description: 'Reach wave 1000 in Endless Mode. (Has this ever happened?)',
    category: 'misc',
    progressKey: 'endless:best_wave',
    target: 1000,
    reward: {
      type: 'item',
      item: { id: 'wave_1000_myth', name: 'The Impossible Trophy', icon: '👁️', desc: 'Awarded to someone who doesn\'t exist. Yet here we are.' },
    },
    tier: 2,
  },

  // ── Legendary deck & one-card wins (#486) ─────────────────────────────────

  {
    id: 'misc:all_legendary_win',
    name: 'Legendary Status',
    description: 'Win a battle with an all-legendary deck',
    category: 'misc',
    progressKey: 'misc:all_legendary_win',
    target: 1,
    reward: { type: 'crystals', crystals: 500 },
    tier: 2,
  },
  {
    id: 'misc:one_card_win',
    name: 'One Card Wonder',
    description: 'Win a battle while playing only a single card',
    category: 'misc',
    progressKey: 'misc:one_card_win',
    target: 1,
    reward: { type: 'crystals', crystals: 400 },
    tier: 2,
  },
]
