// ─── Achievement System ──────────────────────────────────────────────────────
//
// Progress keys:
//   kill:<unitName>       — enemy units/structures killed (incremented during battle)
//   event:<eventId>       — special event outcomes
//   campaign:<actId>      — act completion counts

export type AchievementCategory = 'kills' | 'structures' | 'events' | 'campaign' | 'misc'

export interface AchievementReward {
  type: 'cards' | 'crystals' | 'item'
  cardName?: string
  count?: number
  crystals?: number
  item?: { id: string; name: string; icon: string; desc: string }
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
]
