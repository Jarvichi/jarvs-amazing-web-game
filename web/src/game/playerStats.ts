// ─── Persistent Player Stats ──────────────────────────────────────────────────
//
// Stats earned by completing campaigns. Each campaign completion grants the
// player one permanent upgrade that carries across all future runs.

const PLAYER_STATS_KEY = 'jarv_player_stats'

export type StatUpgradeType = 'maxHp' | 'maxMana' | 'maxDeckSize' | 'maxLives' | 'manaRegenMs'

export interface PlayerStats {
  maxHp:       number  // starting / max campaign HP          (default 50)
  maxMana:     number  // max mana cap in battle              (default 5)
  maxDeckSize: number  // max cards allowed in deck           (default 30)
  maxLives:    number  // lives at campaign start             (default 3)
  manaRegenMs: number  // ms between mana ticks               (default 3000)
}

const DEFAULTS: PlayerStats = {
  maxHp:       50,
  maxMana:     5,
  maxDeckSize: 30,
  maxLives:    3,
  manaRegenMs: 3000,
}

export function loadPlayerStats(): PlayerStats {
  try {
    const raw = localStorage.getItem(PLAYER_STATS_KEY)
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<PlayerStats>) }
  } catch { /* ignore */ }
  return { ...DEFAULTS }
}

export function savePlayerStats(stats: PlayerStats): void {
  try { localStorage.setItem(PLAYER_STATS_KEY, JSON.stringify(stats)) } catch { /* ignore */ }
}

/** Apply one permanent upgrade and persist. Returns the updated stats. */
export function applyStatUpgrade(stat: StatUpgradeType): PlayerStats {
  const stats = loadPlayerStats()
  switch (stat) {
    case 'maxHp':       stats.maxHp       += 10;                                      break
    case 'maxMana':     stats.maxMana     += 1;                                       break
    case 'maxDeckSize': stats.maxDeckSize += 1;                                       break
    case 'maxLives':    stats.maxLives    += 1;                                       break
    case 'manaRegenMs': stats.manaRegenMs  = Math.round(stats.manaRegenMs * 0.9);    break
  }
  savePlayerStats(stats)
  return stats
}
