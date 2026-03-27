/**
 * Relic system — passive bonuses earned at act completion.
 * Each relic persists in RunState for the duration of the run.
 */

export interface RelicDef {
  name: string
  icon: string
  desc: string
  /** Apply this relic's passive effect at the start of a new battle. */
  applyToGame: (state: import('./types').GameState) => void
}

const RELIC_CATALOG: RelicDef[] = [
  {
    name: 'Bark Shield',
    icon: '🛡️',
    desc: 'Your base gains +10 max HP at the start of every battle.',
    applyToGame(state) {
      state.playerBase.maxHp += 10
      state.playerBase.hp    += 10
    },
  },
  {
    name: 'Iron Standard',
    icon: '⚔️',
    desc: 'All your units start with +1 ATK.',
    applyToGame(state) {
      for (const u of state.field) {
        if (u.owner === 'player') u.attack = Math.max(0, u.attack + 1)
      }
    },
  },
  {
    name: 'Soulstone',
    icon: '💎',
    desc: 'Once per battle, when one of your units is destroyed, it is immediately revived with half its original HP.',
    applyToGame(state) {
      state.soulstoneReviveAvailable = true
    },
  },
  {
    name: 'Prism Lens',
    icon: '🔮',
    desc: 'Your maximum mana is increased by 1.',
    applyToGame(state) {
      state.relicManaBonus = (state.relicManaBonus ?? 0) + 1
    },
  },
  {
    name: 'Coral Mantle',
    icon: '🐚',
    desc: 'At the start of every battle your units gain +3 max HP.',
    applyToGame(state) {
      for (const u of state.field) {
        if (u.owner === 'player') {
          u.maxHp += 3
          u.hp    += 3
        }
      }
    },
  },
  {
    name: "Stormcaller's Badge",
    icon: '⚡',
    desc: 'All your units gain +2 attack at battle start.',
    applyToGame(state) {
      for (const u of state.field) {
        if (u.owner === 'player') u.attack = Math.max(0, u.attack + 2)
      }
    },
  },
  {
    name: 'Frost Mantle',
    icon: '🧊',
    desc: 'All your units gain +2 max HP and your base gains +8 max HP at the start of every battle.',
    applyToGame(state) {
      state.playerBase.maxHp += 8
      state.playerBase.hp   += 8
      for (const u of state.field) {
        if (u.owner === 'player') {
          u.maxHp += 2
          u.hp    += 2
        }
      }
    },
  },
  {
    name: 'Golden Compass',
    icon: '🧭',
    desc: 'You start each battle with +1 mana.',
    applyToGame(state) {
      state.mana = Math.min(state.mana + 1, state.maxMana)
    },
  },
  {
    name: 'Spore Bloom',
    icon: '🍄',
    desc: 'Your units regenerate 1 HP every 3 seconds during battle.',
    applyToGame(state) {
      state.relicSporeBloom = true
      state.relicSporeBloomTimer = 3000
    },
  },
  {
    name: 'Magma Core',
    icon: '🌋',
    desc: 'Your units gain +2 ATK at battle start whenever your base HP is below 50%.',
    applyToGame(state) {
      if (state.playerBase.hp < state.playerBase.maxHp * 0.5) {
        for (const u of state.field) {
          if (u.owner === 'player') u.attack = Math.max(0, u.attack + 2)
        }
      }
    },
  },
  {
    name: 'Living Bark',
    icon: '🌿',
    desc: 'Your base gains +15 max HP at the start of every battle.',
    applyToGame(state) {
      state.playerBase.maxHp += 15
      state.playerBase.hp   += 15
    },
  },
  {
    name: 'Salvage Hook',
    icon: '🪝',
    desc: 'Once per battle, one of your destroyed units is revived at 1 HP.',
    applyToGame(state) {
      state.soulstoneReviveAvailable = true
    },
  },
]

export function getRelicDef(name: string): RelicDef | undefined {
  return RELIC_CATALOG.find(r => r.name === name)
}

// ─── Persistent relic collection (survives act resets) ────────────────────────

const RELICS_KEY = 'jarv_relics'

/** Returns the list of relic names the player has earned across all runs. */
export function loadEarnedRelics(): string[] {
  try {
    const raw = localStorage.getItem(RELICS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

/** Adds a relic to the player's permanent collection (no duplicates). Also clears any broken flag. */
export function addEarnedRelic(name: string): void {
  try {
    const existing = loadEarnedRelics()
    if (!existing.includes(name)) {
      localStorage.setItem(RELICS_KEY, JSON.stringify([...existing, name]))
    }
    // If this relic was previously broken, restore it
    removeBrokenRelic(name)
  } catch { /* ignore */ }
}

/** Removes a relic from the player's permanent collection (e.g. when it breaks). */
export function removeEarnedRelic(name: string): void {
  try {
    localStorage.setItem(RELICS_KEY, JSON.stringify(loadEarnedRelics().filter(n => n !== name)))
  } catch { /* ignore */ }
}

// ─── Broken relic tracking ────────────────────────────────────────────────────
// Broken relics are removed from the usable pool but retained as greyed-out
// history on the selection screen. Completing the rewarding act restores them.

const BROKEN_RELICS_KEY = 'jarv_broken_relics'

/** Returns relic names that are currently broken (unequippable). */
export function loadBrokenRelics(): string[] {
  try {
    const raw = localStorage.getItem(BROKEN_RELICS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

/** Marks a relic as broken (shown greyed-out on selection screen). */
export function addBrokenRelic(name: string): void {
  try {
    const existing = loadBrokenRelics()
    if (!existing.includes(name)) {
      localStorage.setItem(BROKEN_RELICS_KEY, JSON.stringify([...existing, name]))
    }
  } catch { /* ignore */ }
}

/** Removes a relic from the broken list (called when it is re-earned). */
export function removeBrokenRelic(name: string): void {
  try {
    localStorage.setItem(BROKEN_RELICS_KEY, JSON.stringify(loadBrokenRelics().filter(n => n !== name)))
  } catch { /* ignore */ }
}

