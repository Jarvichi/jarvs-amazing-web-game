// ─── Building Upgrade Catalog ───────────────────────────────────────────────
//
// Shared, data-driven upgrade tracks keyed by building *kind* (shop, inn,
// cottage, workshop, shrine, tavern, default…). Each town building is tagged
// with an `upgradeKind` in its config.json; the reputation store reads the
// matching track here for costs, reputation gates and unlocked services.
//
// Exterior upgrade decor is no longer placed by these tracks — it is authored
// per building in each town's config.json (`levelDecor`, with minLevel/hideAtLevel)
// via the map editor, so placement can be tuned per building.
//
// Authored data lives in ./buildingUpgrades.json — edit costs/benefits there.

import raw from './buildingUpgrades.json'

export interface BuildingUpgradeLevel {
  /** Short title for this level (shown in the upgrade panel). */
  label: string
  /** Crystal cost to purchase this level. */
  cost: number
  /** Town reputation granted on purchase. */
  repReward: number
  /** Town reputation required before this level can be purchased. */
  repRequired: number
  /** One-line description of what this level unlocks. */
  benefit: string
  /** Optional service id other systems can read via getTownServiceLevel. */
  service?: string
}

export type UpgradeCatalog = Record<string, BuildingUpgradeLevel[]>

export const UPGRADE_CATALOG: UpgradeCatalog = raw as UpgradeCatalog

/** Returns the ordered upgrade track for a building kind (falls back to `default`). */
export function getUpgradeTrack(kind: string | undefined): BuildingUpgradeLevel[] {
  if (!kind) return []
  return UPGRADE_CATALOG[kind] ?? UPGRADE_CATALOG.default ?? []
}

// ── Reputation tiers ─────────────────────────────────────────────────────────

/** Cumulative reputation needed to reach tiers 0–4. */
export const REPUTATION_TIERS: readonly number[] = [0, 50, 150, 350, 700]

export const REPUTATION_TIER_NAMES: readonly string[] = [
  'Unknown', 'Recognised', 'Respected', 'Honoured', 'Revered',
]

/** Maps a reputation total to its tier index (0–4). */
export function getReputationTier(rep: number): number {
  let tier = 0
  for (let i = 0; i < REPUTATION_TIERS.length; i++) {
    if (rep >= REPUTATION_TIERS[i]) tier = i
  }
  return tier
}
