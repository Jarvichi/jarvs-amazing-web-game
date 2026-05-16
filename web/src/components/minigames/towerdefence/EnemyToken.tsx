
// ── Enemy token ───────────────────────────────────────────────────────────────

import { hpBarColor, TDEnemy } from "../../../game/towerDefence"
import { AnimatedSpriteImg } from "../../ui/SpriteImg"

export interface Props { enemy: TDEnemy }

export function EnemyToken({ enemy }: Props) {
  const size = 15
  const hpFrac = enemy.hp / enemy.maxHp
  const cls = [
    'td-enemy',
    enemy.shielded                                            ? 'td-enemy--shielded' : '',
    enemy.slowsUnits                                          ? 'td-enemy--slows'    : '',
    enemy.burnTimer   != null && enemy.burnTimer   > 0        ? 'td-enemy--burning'  : '',
    enemy.freezeTimer != null && enemy.freezeTimer > 0        ? 'td-enemy--frozen'   : '',
    enemy.poisonTimer != null && enemy.poisonTimer > 0        ? 'td-enemy--poisoned' : '',
  ].filter(Boolean).join(' ')
  return (
    <div
      className={cls}
      style={{ transform: `translate(${enemy.x - size / 2}px, ${enemy.y - size / 2}px)`, width: size }}
    >
      <AnimatedSpriteImg name={enemy.template.spriteName} frameCount={3} fps={6} className="td-enemy-sprite" />
      <div className="td-enemy-hp-bar">
        <div className="td-enemy-hp-fill"
          style={{ width: `${hpFrac * 100}%`, background: hpBarColor(hpFrac) }} />
      </div>
    </div>
  )
}