
// ── Player unit group token (all units from same building move as one) ────────

import { hpBarColor, TDUnit } from "../../../game/towerDefence"
import { AnimatedSpriteImg } from "../../ui/SpriteImg"

export interface Props { units: TDUnit[] }

export function UnitGroupToken({ units }: Props) {
  const lead = units[0]
  const stationed = units.some(u => u.stationed)
  const minHpFrac = Math.min(...units.map(u => u.hp / u.maxHp))
  const n = Math.min(units.length, 10)
  const sz = 11, gap = 2
  const COLS = 5

  const rows = Math.ceil(n / COLS)
  const cols = Math.min(n, COLS)
  const containerW = cols * sz + (cols - 1) * gap
  const containerH = rows * sz + (rows - 1) * gap

  const slots: Array<{ dx: number; dy: number }> = []
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / COLS)
    const col = i % COLS
    slots.push({ dx: col * (sz + gap), dy: row * (sz + gap) })
  }

  return (
    <div
      className={`td-unit${stationed ? ' td-unit--stationed' : ' td-unit--walking'}`}
      style={{ transform: `translate(${lead.x - containerW / 2}px, ${lead.y - containerH / 2}px)`, width: containerW }}
    >
      <div style={{ position: 'relative', width: containerW, height: containerH }}>
        {slots.map((slot, i) => (
          <div key={i} style={{ position: 'absolute', left: slot.dx, top: slot.dy, width: sz, height: sz }}>
            <AnimatedSpriteImg name={units[i].template.name} frameCount={3} fps={stationed ? 4 : 8} className="td-unit-sprite" />
          </div>
        ))}
      </div>
      <div className="td-enemy-hp-bar">
        <div className="td-enemy-hp-fill" style={{ width: `${minHpFrac * 100}%`, background: hpBarColor(minHpFrac) }} />
      </div>
    </div>
  )
}