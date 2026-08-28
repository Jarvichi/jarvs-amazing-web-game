// ─── Forage loot tables ──────────────────────────────────────────────────────
//
// What a once-per-day forage spot (docs/hubworld.md §7 `forage` reaction) hands
// over. Each spot names a table via its reaction's `lootTable` — 'wild' (the
// default hedgerow roll), 'wood' (Thornwood's log piles) or 'fruit' (orchard
// and woodland trees) — and one entry is drawn from it by weight.
//
// The roll is pure so it can be tested; HubWorld owns the granting.

import FORAGE_LOOT_DATA from '../../data/hub/forageLoot.json'
import { getHubItemCatalogEntry } from '../itemStore'
import type { SoundId } from '../sound'

export interface ForageCollectible {
  id: string
  name: string
  icon: string
  desc: string
}

export interface ForageEntry {
  /** Relative likelihood within its table. */
  weight: number
  /** Hub-item granted (one). */
  hubItemId?: string
  /** Crystals granted, rolled inclusively between min and max. */
  crystals?: { min: number; max: number }
  /** One-off collectible granted. */
  collectible?: ForageCollectible
  /** Line shown afterwards; `{crystals}` is replaced with the rolled amount. */
  text: string
  /** Sound id; defaults to 'pickup'. */
  sound?: SoundId
}

export interface ForageTable {
  /** Line shown when the spot is tapped, above the confirm choice. */
  prompt: string
  confirmLabel: string
  entries: ForageEntry[]
}

const TABLES = FORAGE_LOOT_DATA as Record<string, ForageTable>

/** The table a spot's `lootTable` names, falling back to the hedgerow roll. */
export function forageTable(lootTable?: string): ForageTable {
  return TABLES[lootTable ?? 'wild'] ?? TABLES.wild
}

export interface ForageOutcome {
  hubItemId?: string
  crystals?: number
  collectible?: ForageCollectible
  text: string
  sound: SoundId
}

/**
 * Draw one outcome from `table`. `overrideItemId` swaps whichever hub-item the
 * entry would have granted for a specific one — how a spot pins its own fruit
 * (Appleford's orchard always apples, Gravemoor's dead trees crab apples)
 * without needing a table of its own. `overrideText` replaces the entry's line
 * in that case; a spot that sets neither reads from the table as authored.
 */
export function rollForage(
  table: ForageTable,
  opts: { overrideItemId?: string; overrideText?: string; random?: () => number } = {},
): ForageOutcome {
  const random = opts.random ?? Math.random
  const total = table.entries.reduce((sum, e) => sum + Math.max(0, e.weight), 0)
  let roll = random() * total
  const entry = table.entries.find(e => (roll -= Math.max(0, e.weight)) < 0) ?? table.entries[0]

  const crystals = entry.crystals
    ? entry.crystals.min + Math.floor(random() * (entry.crystals.max - entry.crystals.min + 1))
    : undefined

  const hubItemId = entry.hubItemId && opts.overrideItemId ? opts.overrideItemId : entry.hubItemId

  let text = entry.text
  if (hubItemId && hubItemId !== entry.hubItemId) {
    const catalog = getHubItemCatalogEntry(hubItemId)
    text = opts.overrideText
      ?? `You come away with ${catalog?.name ?? hubItemId}. ${catalog?.icon ?? ''}`.trimEnd()
  }

  return {
    hubItemId,
    crystals,
    collectible: entry.collectible,
    text: crystals != null ? text.replace('{crystals}', String(crystals)) : text,
    sound: entry.sound ?? 'pickup',
  }
}
