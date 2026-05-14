// Maps unit display names to their sprite file slug (without extension).
const NAME_MAP: Record<string, string> = {
  'Arc.Tower':     'arcane-tower',
  'DrgnLair':      'dragon-lair',
  'ManaSpring':    'mana-spring',
  // Mythic card sprite mappings (no dedicated sprites, reuse closest match)
  'Prism Wyrm':    'prism-warden',
  'Void Titan':    'pale-colossus',
  'Eternal Forge': 'arcane-forge',
  'Dreadnought':   'iron-colossus',
  'Forge Knight':  'cinder-knight',
  // New units without dedicated sprites — reuse closest visual match
  'Plague Shaman': 'sandstorm-shaman',
  'Marksman':      'desert-archer',
  'Plague Den':    'rot-shrine',
  'Sniper Post':   'aerie-tower',
}

/** Returns the sprite filename slug for a given unit name. */
export function spriteSlug(name: string): string {
  if (NAME_MAP[name]) return NAME_MAP[name]
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
