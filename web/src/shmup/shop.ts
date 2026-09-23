// ─── /shmup: the trader's shop ──────────────────────────────────────────────
//
// What Glix sells between levels, prices, and buying.

import { type Carry, type Loadout } from './world'

export type ShopId = 'cannon' | 'side' | 'rear' | 'homing' | 'speed' | 'life'

export interface ShopItem {
  id: ShopId
  name: string
  blurb: string
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'cannon', name: 'CANNON UP', blurb: 'WIDER FORWARD FIRE' },
  { id: 'side', name: 'SIDE SHOTS', blurb: 'FIRE LEFT AND RIGHT' },
  { id: 'rear', name: 'REAR GUN', blurb: 'COVER YOUR TAIL' },
  { id: 'homing', name: 'HOMING', blurb: 'SEEKER MISSILES' },
  { id: 'speed', name: 'SPEED UP', blurb: 'FASTER SHIP' },
  { id: 'life', name: 'EXTRA SHIP', blurb: '+1 LIFE' },
]

export const MAX_LIVES = 5

/** Price of the next level of an item, or null if it's maxed out. */
export function priceOf(id: ShopId, c: Carry): number | null {
  const l = c.loadout
  switch (id) {
    case 'cannon': return l.cannon < 3 ? 250 * l.cannon : null
    case 'side': return l.side ? null : 300
    case 'rear': return l.rear ? null : 200
    case 'homing': return l.homing < 2 ? 350 * (l.homing + 1) : null
    case 'speed': return l.speed < 2 ? 150 * (l.speed + 1) : null
    case 'life': return c.lives < MAX_LIVES ? 800 : null
  }
}

export type BuyResult = 'ok' | 'maxed' | 'poor'

export function buy(c: Carry, id: ShopId): BuyResult {
  const price = priceOf(id, c)
  if (price === null) return 'maxed'
  if (c.credits < price) return 'poor'
  c.credits -= price
  const l = c.loadout
  switch (id) {
    case 'cannon': l.cannon = (l.cannon + 1) as Loadout['cannon']; break
    case 'side': l.side = true; break
    case 'rear': l.rear = true; break
    case 'homing': l.homing = (l.homing + 1) as Loadout['homing']; break
    case 'speed': l.speed = (l.speed + 1) as Loadout['speed']; break
    case 'life': c.lives++; break
  }
  return 'ok'
}
