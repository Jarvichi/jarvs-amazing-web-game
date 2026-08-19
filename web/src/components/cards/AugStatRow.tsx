import React from 'react'
import type { UnitTemplate } from '../../game/types'

/**
 * One stat, shown as the value the engine actually fights with — base plus
 * every bonus that applies — with the sources split out on demand.
 *
 * This used to display base + augments only, in two separately-maintained
 * copies (CardDetailModal and CardAugmentScreen), so a mastered card
 * understated its real power and the two screens could disagree about the
 * same card. Shared here so they cannot drift again.
 */
export function AugStatRow({ label, base, mastery, augment, breakdown }: {
  label: string
  base: number
  /** From applyMasteryBonus in game/collection.ts. */
  mastery?: number
  /** From applyAugmentBonuses — mobile units only; the engine skips structures. */
  augment?: number
  breakdown?: boolean
}) {
  const m = mastery ?? 0
  const a = augment ?? 0
  const total = base + m + a
  const hasBonus = m !== 0 || a !== 0

  return (
    <div className="cdm-stat">
      <div className="cdm-stat-main">
        <span className="cdm-stat-label">{label}</span>
        <span className={`cdm-stat-value${hasBonus ? ' cdm-stat-value--boosted' : ''}`}>{total}</span>
      </div>
      {breakdown && hasBonus && (
        <div className="cdm-stat-breakdown">
          <span>{base} base</span>
          {m !== 0 && <span className="cdm-mastery-bonus">{m > 0 ? '+' : ''}{m} mastery</span>}
          {a !== 0 && <span className="cdm-stat-bonus">{a > 0 ? '+' : ''}{a} augments</span>}
        </div>
      )}
    </div>
  )
}

/**
 * Mastery stat bonuses for a card, mirroring applyMasteryBonus in
 * game/collection.ts: mobile units gain +1 ATK and +2 max HP per level,
 * structures +10% max HP per level (and take no augments at all).
 */
export function masteryStatBonuses(u: UnitTemplate | undefined, masteryLvl: number): { atk: number; hp: number } {
  if (!u) return { atk: 0, hp: 0 }
  if (u.moveSpeed > 0) {
    return { atk: masteryLvl, hp: masteryLvl * 2 }
  }
  return { atk: 0, hp: Math.round(u.maxHp * (1 + 0.1 * masteryLvl)) - u.maxHp }
}
