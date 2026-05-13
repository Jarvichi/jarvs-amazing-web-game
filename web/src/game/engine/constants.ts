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
export const COMMANDER_LEASH_PX  = 80              // max px a commander can stray from home
