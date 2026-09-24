// ─── /shmup: the trader's shop ──────────────────────────────────────────────
//
// What Glix sells between levels, prices, and buying.

import { MAX_BOMBS, type Carry, type Loadout } from './world'
import { mountPods, podCount, upgradeWeapon, type PodKind } from './pods'

export type ShopId =
  | 'cannon' | 'side' | 'rear' | 'homing' | 'speed'
  | 'laser' | 'drone' | 'armour' | 'rapid' | 'bomb' | 'life'

export interface ShopItem {
  id: ShopId
  name: string
  blurb: string
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'cannon', name: 'CANNON UP', blurb: 'MAX IT OUT TO MOUNT A CANNON POD' },
  { id: 'side', name: 'SIDE POD', blurb: 'A POD FIRING LEFT AND RIGHT' },
  { id: 'rear', name: 'REAR POD', blurb: 'A POD COVERING YOUR TAIL' },
  { id: 'homing', name: 'HOMING', blurb: 'SEEKERS. MAX FOR A HOMING POD' },
  { id: 'speed', name: 'SPEED UP', blurb: 'FASTER SHIP' },
  { id: 'rapid', name: 'RAPID FIRE', blurb: 'CANNON FIRES FASTER' },
  { id: 'laser', name: 'LASER POD', blurb: 'A POD WHOSE BOLTS PIERCE ALL' },
  { id: 'drone', name: 'DRONE', blurb: 'ORBITS, SHOOTS, BLOCKS SHOTS' },
  { id: 'armour', name: 'ARMOUR', blurb: '+50 MAX SHIELD' },
  { id: 'bomb', name: 'SMART BOMB', blurb: 'CLEARS THE SCREEN. B TO USE' },
  { id: 'life', name: 'EXTRA SHIP', blurb: '+1 LIFE' },
]

export const MAX_LIVES = 5

/** Price of the next level of an item, or null if it's maxed out. */
/** Each extra pod of a type costs half as much again as the last. */
const podScale = (l: Loadout, k: PodKind) => 1 + 0.5 * podCount(l, k)

/** Price of the next level of an item, or null if it's maxed out. */
export function priceOf(id: ShopId, c: Carry): number | null {
  const l = c.loadout
  switch (id) {
    // Weapons never max out: the top level mounts a pod and starts over.
    case 'cannon': return Math.round(250 * l.cannon * podScale(l, 'cannon'))
    case 'homing': return Math.round(350 * (l.homing + 1) * podScale(l, 'homing'))
    case 'side': return Math.round(300 * podScale(l, 'side'))
    case 'rear': return Math.round(200 * podScale(l, 'rear'))
    case 'laser': return Math.round(650 * podScale(l, 'laser'))
    case 'speed': return l.speed < 2 ? 150 * (l.speed + 1) : null
    case 'rapid': return l.rapid < 2 ? 300 * (l.rapid + 1) : null
    case 'drone': return l.drones < 2 ? 400 + 300 * l.drones : null
    case 'armour': return l.armour ? null : 500
    case 'bomb': return l.bombs < MAX_BOMBS ? 150 : null
    case 'life': return c.lives < MAX_LIVES ? 800 : null
  }
}

/** 'mounted' means the purchase maxed a weapon and a new pod was fitted. */
export type BuyResult = 'ok' | 'mounted' | 'maxed' | 'poor'

export function buy(c: Carry, id: ShopId): BuyResult {
  const price = priceOf(id, c)
  if (price === null) return 'maxed'
  if (c.credits < price) return 'poor'
  c.credits -= price
  const l = c.loadout
  switch (id) {
    case 'cannon': case 'homing': case 'side': case 'rear': case 'laser':
      upgradeWeapon(l, id)
      return mountPods(l).length ? 'mounted' : 'ok'
    case 'speed': l.speed = (l.speed + 1) as Loadout['speed']; break
    case 'rapid': l.rapid = (l.rapid + 1) as Loadout['rapid']; break
    case 'drone': l.drones = (l.drones + 1) as Loadout['drones']; break
    case 'armour': l.armour = true; break
    case 'bomb': l.bombs++; break
    case 'life': c.lives++; break
  }
  return 'ok'
}
