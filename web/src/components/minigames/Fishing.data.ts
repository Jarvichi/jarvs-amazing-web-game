// ─── Fishing data ─────────────────────────────────────────────────────────────
// Fish tier tables, per-locale hub-item mappings and the small pure helpers
// that read them. Split out of Fishing.tsx (which now only orchestrates the
// minigame) so the scene, meters and result card — plus the town journal and
// the appraisal screen — can import the data without pulling in the whole
// screen component, and without an import cycle.

// ── Fish data ─────────────────────────────────────────────────────────────────

export interface FishTier {
  tier: string
  icon: string
  names: string[]
  minG: number; maxG: number
  minCm: number; maxCm: number
  minT: number; maxT: number
  chance: number
}

export const FISH_TIERS: FishTier[] = [
  {
    tier: 'Tiddler', icon: '🐟',
    names: ['Minnow', 'Dace', 'Gudgeon', 'Bleak', 'Stickleback'],
    minG: 100,   maxG: 500,   minCm: 8,   maxCm: 25,  minT: 2,   maxT: 6,   chance: 40,
  },
  {
    tier: 'Small', icon: '🐠',
    names: ['Roach', 'Rudd', 'Perch', 'Bream', 'Chub'],
    minG: 500,   maxG: 2000,  minCm: 25,  maxCm: 45,  minT: 8,   maxT: 18,  chance: 30,
  },
  {
    tier: 'Medium', icon: '🐡',
    names: ['Carp', 'Tench', 'Barbel', 'Zander', 'Catfish'],
    minG: 2000,  maxG: 5000,  minCm: 45,  maxCm: 70,  minT: 22,  maxT: 40,  chance: 15,
  },
  {
    tier: 'Large', icon: '🦈',
    names: ['Pike', 'Salmon', 'Sea Bass', 'Wels Catfish', 'Sturgeon'],
    minG: 5000,  maxG: 12000, minCm: 70,  maxCm: 110, minT: 42,  maxT: 75,  chance: 9,
  },
  {
    tier: 'Trophy', icon: '🏆',
    names: ['Giant Carp', 'Monster Pike', 'River Titan', 'Trophy Salmon', 'Great Barbel'],
    minG: 12000, maxG: 25000, minCm: 110, maxCm: 150, minT: 80,  maxT: 130, chance: 5,
  },
  {
    tier: 'Legendary', icon: '✨',
    names: ['Ancient Sturgeon', 'Dragon Carp', 'Leviathan Eel', 'World Record Bass', 'Fracture Fish'],
    minG: 25000, maxG: 50000, minCm: 150, maxCm: 200, minT: 150, maxT: 250, chance: 1,
  },
]

// Cave-lake variant — same weights/ranges as FISH_TIERS (reuse the already-
// tuned balance), reskinned as pale, blind, deep-water species for the
// underground lake fishing spot. Distinct tier labels double as the key
// into CAVE_TIER_HUB_ITEM below, so they must not collide with FISH_TIERS'.
export const CAVE_FISH_TIERS: FishTier[] = [
  {
    tier: 'Blindling', icon: '🐟',
    names: ['Blind Loach', 'Pale Minnow', 'Cave Gudgeon', 'Sunken Bleak', 'Milk-eye'],
    minG: 100,   maxG: 500,   minCm: 8,   maxCm: 25,  minT: 2,   maxT: 6,   chance: 40,
  },
  {
    tier: 'Cave-dweller', icon: '🐠',
    names: ['Stone Roach', 'Grotto Perch', 'Cavefin', 'Hollow Bream', 'Root-eel'],
    minG: 500,   maxG: 2000,  minCm: 25,  maxCm: 45,  minT: 8,   maxT: 18,  chance: 30,
  },
  {
    tier: 'Deep Lurker', icon: '🐡',
    names: ['Stone Eel', 'Barbless Carp', 'Echo Catfish', 'Drip-fed Zander', 'Lantern Barbel'],
    minG: 2000,  maxG: 5000,  minCm: 45,  maxCm: 70,  minT: 22,  maxT: 40,  chance: 15,
  },
  {
    tier: 'Ancient', icon: '🦈',
    names: ['Sunless Pike', 'Deepwater Sturgeon', 'Cistern Bass', 'Old Blind Catfish', 'Wellspring Eel'],
    minG: 5000,  maxG: 12000, minCm: 70,  maxCm: 110, minT: 42,  maxT: 75,  chance: 9,
  },
  {
    tier: 'Abyssal', icon: '🏆',
    names: ['Abyssal Carp', 'Monster of the Hollow', 'Cavern Titan', 'Sightless Leviathan', 'Great Root-eel'],
    minG: 12000, maxG: 25000, minCm: 110, maxCm: 150, minT: 80,  maxT: 130, chance: 5,
  },
  {
    tier: 'Sunless', icon: '✨',
    names: ['The Sunless One'],
    minG: 25000, maxG: 50000, minCm: 150, maxCm: 200, minT: 150, maxT: 250, chance: 1,
  },
]

// Lake variant — open, still-water species for a town's ordinary pond/lake
// spot (as opposed to a flowing river). Same weights/ranges/chances as
// FISH_TIERS; distinct tier labels double as the key into LAKE_TIER_HUB_ITEM.
export const LAKE_FISH_TIERS: FishTier[] = [
  {
    tier: 'Shallows', icon: '🐟',
    names: ['Lake Minnow', 'Reed Bleak', 'Shoreling', 'Pond Skimmer', 'Duckweed Dace'],
    minG: 100,   maxG: 500,   minCm: 8,   maxCm: 25,  minT: 2,   maxT: 6,   chance: 40,
  },
  {
    tier: 'Weedbed', icon: '🐠',
    names: ['Lake Roach', 'Lily Perch', 'Weedy Rudd', 'Still-water Bream', 'Reed Chub'],
    minG: 500,   maxG: 2000,  minCm: 25,  maxCm: 45,  minT: 8,   maxT: 18,  chance: 30,
  },
  {
    tier: 'Deep Water', icon: '🐡',
    names: ['Lake Carp', 'Tench', 'Still Barbel', 'Lake Zander', 'Pond Catfish'],
    minG: 2000,  maxG: 5000,  minCm: 45,  maxCm: 70,  minT: 22,  maxT: 40,  chance: 15,
  },
  {
    tier: 'Old Water', icon: '🦈',
    names: ['Lake Pike', 'Landlocked Salmon', 'Basin Trout', 'Old Catfish', 'Lake Sturgeon'],
    minG: 5000,  maxG: 12000, minCm: 70,  maxCm: 110, minT: 42,  maxT: 75,  chance: 9,
  },
  {
    tier: 'Prize Water', icon: '🏆',
    names: ['Giant Lake Carp', 'Monster of the Mere', 'Lake Titan', 'Champion Trout', 'Great Basin Pike'],
    minG: 12000, maxG: 25000, minCm: 110, maxCm: 150, minT: 80,  maxT: 130, chance: 5,
  },
  {
    tier: 'Still Legend', icon: '✨',
    names: ['The Lake Watcher', 'Ancient Basin Carp', 'Mere Serpent'],
    minG: 25000, maxG: 50000, minCm: 150, maxCm: 200, minT: 150, maxT: 250, chance: 1,
  },
]

// Ocean variant — saltwater species for a harbour/coastal fishing spot.
// Same weights/ranges/chances as FISH_TIERS; distinct tier labels double as
// the key into OCEAN_TIER_HUB_ITEM.
export const OCEAN_FISH_TIERS: FishTier[] = [
  {
    tier: 'Shoal', icon: '🐟',
    names: ['Silverside', 'Sand Smelt', 'Anchovy', 'Sprat', 'Tide Minnow'],
    minG: 100,   maxG: 500,   minCm: 8,   maxCm: 25,  minT: 2,   maxT: 6,   chance: 40,
  },
  {
    tier: 'Reef', icon: '🐠',
    names: ['Mackerel', 'Sea Bream', 'Herring', 'Grey Mullet', 'Wrasse'],
    minG: 500,   maxG: 2000,  minCm: 25,  maxCm: 45,  minT: 8,   maxT: 18,  chance: 30,
  },
  {
    tier: 'Deep Shelf', icon: '🐡',
    names: ['Cod', 'Sea Bass', 'Pollock', 'Haddock', 'Conger Eel'],
    minG: 2000,  maxG: 5000,  minCm: 45,  maxCm: 70,  minT: 22,  maxT: 40,  chance: 15,
  },
  {
    tier: 'Open Water', icon: '🦈',
    names: ['Bluefin', 'Halibut', 'Barracuda', 'Bull Shark', 'Marlin'],
    minG: 5000,  maxG: 12000, minCm: 70,  maxCm: 110, minT: 42,  maxT: 75,  chance: 9,
  },
  {
    tier: 'Deep Sea', icon: '🏆',
    names: ['Giant Tuna', 'Broadbill Swordfish', 'Deep-sea Grouper', 'Ocean Titan', 'Great Marlin'],
    minG: 12000, maxG: 25000, minCm: 110, maxCm: 150, minT: 80,  maxT: 130, chance: 5,
  },
  {
    tier: 'Abyss Tide', icon: '✨',
    names: ['The Tideborn Leviathan', 'Kraken Spawn', 'Deepwater Wyrmfish'],
    minG: 25000, maxG: 50000, minCm: 150, maxCm: 200, minT: 150, maxT: 250, chance: 1,
  },
]

// Hub-mode catches become hub-items, keyed by fish tier (see hubItems.json).
export const TIER_HUB_ITEM: Record<string, string> = {
  Tiddler: 'fish-tiddler', Small: 'fish-small', Medium: 'fish-medium',
  Large: 'fish-large', Trophy: 'fish-trophy', Legendary: 'fish-legendary',
}
export const CAVE_TIER_HUB_ITEM: Record<string, string> = {
  Blindling: 'cave-fish-blindling', 'Cave-dweller': 'cave-fish-dweller', 'Deep Lurker': 'cave-fish-lurker',
  Ancient: 'cave-fish-ancient', Abyssal: 'cave-fish-abyssal', Sunless: 'cave-fish-sunless',
}
export const LAKE_TIER_HUB_ITEM: Record<string, string> = {
  Shallows: 'lake-fish-shallows', Weedbed: 'lake-fish-weedbed', 'Deep Water': 'lake-fish-deepwater',
  'Old Water': 'lake-fish-oldwater', 'Prize Water': 'lake-fish-prizewater', 'Still Legend': 'lake-fish-stilllegend',
}
export const OCEAN_TIER_HUB_ITEM: Record<string, string> = {
  Shoal: 'ocean-fish-shoal', Reef: 'ocean-fish-reef', 'Deep Shelf': 'ocean-fish-deepshelf',
  'Open Water': 'ocean-fish-openwater', 'Deep Sea': 'ocean-fish-deepsea', 'Abyss Tide': 'ocean-fish-abysstide',
}

export function formatWeight(g: number): string {
  return g < 1000 ? `${g}g` : `${(g / 1000).toFixed(1)}kg`
}

/** 1-5 stars from where a catch's weight falls within its own tier's size
 *  range — a top-of-range Tiddler and a top-of-range Legendary both earn 5
 *  stars, so every tier stays worth fishing for a great specimen. */
export function computeFishStars(weightGrams: number, tier: FishTier): number {
  const pct = (weightGrams - tier.minG) / (tier.maxG - tier.minG)
  return Math.min(5, Math.max(1, Math.ceil(pct * 5)))
}

/** 'river' (default): the standard Tiddler→Legendary tiers used at every
 *  ordinary fishing spot. 'cave': the pale, blind cave-lake species, used
 *  only at the underground lake's fishing spot. 'lake': still-water species
 *  for a town's open pond/lake. 'ocean': saltwater species for a
 *  harbour/coastal spot. Each variant has its own exclusive hub-items
 *  (#2148/#2153 — pond locales). */
export type FishVariant = 'river' | 'cave' | 'lake' | 'ocean'

export const VARIANT_TIERS: Record<FishVariant, FishTier[]> = {
  river: FISH_TIERS, cave: CAVE_FISH_TIERS, lake: LAKE_FISH_TIERS, ocean: OCEAN_FISH_TIERS,
}
export const VARIANT_TIER_HUB_ITEM: Record<FishVariant, Record<string, string>> = {
  river: TIER_HUB_ITEM, cave: CAVE_TIER_HUB_ITEM, lake: LAKE_TIER_HUB_ITEM, ocean: OCEAN_TIER_HUB_ITEM,
}

// ── Catch types ───────────────────────────────────────────────────────────────

export interface FishCatch {
  kind: 'fish'
  tier: string
  tierIcon: string
  name: string
  weightGrams: number
  lengthCm: number
  tickets: number
}

export interface ItemCatch {
  kind: 'item'
  id: string
  name: string
  icon: string
  desc: string
}

export interface CardCatch {
  kind: 'card'
  name: string
  rarity: string
}

export type Catch = FishCatch | ItemCatch | CardCatch

/** Frame colour per tier index, smallest → largest. Mirrors the rarity ramp
 *  used elsewhere (steel → green → blue → purple → gold → cyan) so a Trophy
 *  reads as "rare" at a glance without inventing a second colour language. */
export const TIER_ACCENTS = ['#8a8a8a', '#5cc86a', '#4aa3ff', '#c060ff', '#ffcc00', '#5ef0dc'] as const

export function tierAccent(tierIndex: number): string {
  return TIER_ACCENTS[Math.min(TIER_ACCENTS.length - 1, Math.max(0, tierIndex))]
}
