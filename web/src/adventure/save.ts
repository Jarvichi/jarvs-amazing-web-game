// ─── /adventure: saving ─────────────────────────────────────────────────────
//
// An adventure outlasts one sitting (and iOS Safari reloads background tabs),
// so progress is kept in localStorage. A save holds only what lasts — gear,
// hearts, what has been opened and taken — and continuing wakes the hero at
// their last safe place, like after a fall.

import { MAPS, type Warp } from './maps'
import type { Inventory, World } from './state'
import { START_HP, createWorld, enterMap } from './world'

export const SAVE_KEY = 'jawg-adventure-save'

export interface SaveData {
  v: 1
  inv: Inventory
  maxHp: number
  flags: string[]
  opened: string[]
  time: number
  score: number
  kills: number
  respawn: Warp
}

export function toSave(w: World): SaveData {
  return {
    v: 1,
    inv: { ...w.inv, keys: { ...w.inv.keys } },
    maxHp: w.player.maxHp,
    flags: [...w.flags],
    opened: [...w.opened],
    time: Math.floor(w.time),
    score: w.score,
    kills: w.kills,
    respawn: w.respawn,
  }
}

export function fromSave(d: SaveData, seed = 1): World {
  const w = createWorld(seed)
  w.inv = { ...d.inv, keys: { ...d.inv.keys } }
  w.player.maxHp = d.maxHp
  w.player.hp = Math.min(d.maxHp, START_HP)
  w.flags = new Set(d.flags)
  w.opened = new Set(d.opened)
  w.time = d.time
  w.score = d.score
  w.kills = d.kills
  w.respawn = d.respawn
  w.dialog = null
  enterMap(w, d.respawn)
  w.dialog = null // don't replay a cave keeper's greeting on load
  return w
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** A save from storage, or null if there is none or it doesn't make sense. */
export function parseSave(text: string | null): SaveData | null {
  if (!text) return null
  try {
    const d = JSON.parse(text) as SaveData
    if (d?.v !== 1 || !d.inv || !isNum(d.maxHp) || !Array.isArray(d.flags) || !Array.isArray(d.opened)) return null
    if (!d.respawn || !MAPS[d.respawn.map] || !isNum(d.respawn.x) || !isNum(d.respawn.y)) return null
    if (!isNum(d.inv.coins) || !isNum(d.inv.flames) || !isNum(d.time) || !isNum(d.score)) return null
    return d
  } catch {
    return null
  }
}
