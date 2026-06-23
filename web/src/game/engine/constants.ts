// ─── Shared Engine Constants ──────────────────────────────
// Only constants used by multiple subsystems live here.
// Single-subsystem constants live in their owning file.

import { LANE_WIDTH } from "../types"

export const OPPONENT_INTERVAL_MS = 6000
export const MANA_REGEN_MS        = 3000   // 1 mana every 3 seconds
export const BASE_MAX_MANA        = 5
export const SPAWN_GROW_MS        = 1500   // building-spawn grow-in animation duration
export const DAMAGE_FLASH_MS      = 200    // how long the damage-flash effect lasts
export const BLOOD_POOL_MAX       = 25     // FIFO cap — older pools begin fading when exceeded
export const BLOOD_POOL_FADE_MS   = 2000   // how long a fading blood pool takes to disappear

export const PLAYER_SPAWN_X      = 30               // where player units appear
export const OPPONENT_SPAWN_X    = LANE_WIDTH - 30  // where opponent units appear
export const BASE_STOP_MARGIN    = 0                // units may reach the base character position exactly
export const COMMANDER_HOME_X    = 15               // player commander's home position
export const COMMANDER_LEASH_PX  = 40              // max px a commander can stray from home

// ─── Opponent Spell-Cast Telegraph + Counter QTE ──────────
export const CAST_WINDUP_MS          = 5000  // windup before an opponent AOE spell resolves
// A successful counter never fully negates damage — it caps it at a percentage of the
// commander's max HP, and that percentage scales linearly with how much of the windup had
// already elapsed at press time: an instant press caps at the floor below, a press right at
// the buzzer caps near 100% (no better than not pressing). Damage dealt = min(spell's raw
// damage, cap% × commander max HP), so a counter always guarantees survival against an
// otherwise-lethal spell while still landing some chip damage. Not countering at all still
// applies the spell's damage in full (100%, uncapped — never reduced by the cap).
export const COUNTER_DAMAGE_FLOOR_PCT = 0.1  // minimum cap %, even for a press at the instant the cast starts

// ─── Archetype Passive Multipliers ────────────────────────
export const ARCH_STRUCTURE_COST_REDUCTION = 1     // Siege Commander: structures cost 1 less
export const ARCH_STRUCTURE_HP_MULT        = 1.2   // Siege Commander: +20% structure max HP
export const ARCH_SWARM_UNIT_THRESHOLD     = 4     // Swarm Tactician: activate when ≥4 mobile units on field
export const ARCH_SWARM_COST_REDUCTION     = 1     // Swarm Tactician: unit cards cost 1 less when active
export const ARCH_SWARM_ATK_PER_UNIT       = 0.05  // Swarm Tactician: +5% ATK per mobile unit alive
export const ARCH_SCHOLAR_UPGRADE_MULT     = 2     // Arcane Scholar: upgrade effect amounts doubled
