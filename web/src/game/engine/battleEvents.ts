// ─── Battle Events ────────────────────────────────────────

export const BATTLE_EVENT_BASE_MS = 30000  // first event after 30s, then every 24–32s

import { isNoDamageMode } from "../debug"
import { GameState, BattleEventState } from "../types"
import { BASE_MAX_MANA } from "./constants"
import { getManaBonus } from "./getManaBonus"

export function triggerBattleEvent(s: GameState, log: string[]): void {
  const roll = Math.random()
  let event: BattleEventState

  if (roll < 0.25) {
    // Blood Moon: all attacks deal double damage for 15s
    event = { type: 'bloodMoon', label: '🌑 BLOOD MOON! Double damage for 15s!', remainingMs: 15000 }
  } else if (roll < 0.5) {
    // Fog of War: all units move at half speed for 12s
    event = { type: 'fogOfWar', label: '🌫 FOG OF WAR! Movement halved for 12s!', remainingMs: 12000 }
  } else if (roll < 0.75) {
    // Supply Drop: both sides gain +3 mana instantly
    const bonus = 3
    s.mana = Math.min(s.maxMana, s.mana + bonus)
    const oppBonus = Math.min(10, BASE_MAX_MANA + getManaBonus(s.field, 'opponent'))
    void oppBonus  // opponent mana is virtual per-turn; just note the event
    event = { type: 'supplyDrop', label: `📦 SUPPLY DROP! Both sides gain +${bonus} mana!`, remainingMs: 3000 }
    log.push(`Supply Drop! You gained +${bonus} mana.`)
  } else {
    // Earthquake: all walls take 20 damage
    const dmg = 20
    for (const u of s.field) {
      if (!u.isWall) continue
      // Don't damage player-owned walls in dev no-damage mode
      if (u.owner === 'player' && isNoDamageMode()) continue
      u.hp = Math.max(0, u.hp - dmg)
    }
    for (const u of s.field) {
      if (u.hp <= 0 && u.moveSpeed > 0 && !u.isWall) {
        if (u.owner === 'opponent') s.battleStats.playerKills++
        else                        s.battleStats.playerUnitsLost++
      }
    }
    s.field = s.field.filter(u => u.hp > 0)
    event = { type: 'earthquake', label: `🌋 EARTHQUAKE! All walls took ${dmg} damage!`, remainingMs: 3000 }
    log.push(`Earthquake! All walls shook for ${dmg} damage!`)
  }

  s.activeBattleEvent = event
  log.push(event.label)
}