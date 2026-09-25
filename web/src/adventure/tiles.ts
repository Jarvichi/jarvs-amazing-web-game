// ─── /adventure: tile legend ────────────────────────────────────────────────
//
// Every map is a grid of one-character tiles, 16×16 pixels each, cut into
// 16×11-tile rooms (one screen). The world rules resolve a tile's current
// state first (a burnt thorn bush, an unlocked door…) and then ask here what
// that character lets through.

export const TILE = 16
export const RW = 16
export const RH = 11
export const VIEW_W = RW * TILE
export const VIEW_H = RH * TILE

// Ground: grass, path, dungeon floor, cave floor, bridge, flowers, ash, doorways.
const WALK = new Set(['.', ',', ':', ';', '=', 'F', 'A', 'D'])

export interface Abilities {
  /** Heron boots: shallow water ('w') is walkable. */
  boots: boolean
}

export const walkable = (ch: string, a: Abilities): boolean => WALK.has(ch) || (ch === 'w' && a.boots)

/** Ground an enemy may walk onto: no doorways, no water. */
export const enemyWalkable = (ch: string): boolean => WALK.has(ch) && ch !== 'D'

/** Walls and scenery stop shots; water, lava and ground let them fly over. */
export const stopsShots = (ch: string): boolean => !WALK.has(ch) && ch !== 'W' && ch !== 'w' && ch !== '~'
