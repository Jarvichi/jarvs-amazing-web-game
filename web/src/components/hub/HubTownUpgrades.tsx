import React from 'react'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import {
  REPUTATION_TIERS,
  REPUTATION_TIER_NAMES,
  getReputationTier,
  getUpgradeTrack,
} from '../../data/hub/buildingUpgrades'
import type { NextUpgrade } from '../../game/hub/reputation'

/** One upgradeable building, pre-resolved by HubWorld. Pure-visual: props only. */
export interface UpgradeRow {
  buildingId: string
  name: string
  kind: string
  level: number
  total: number
  next: NextUpgrade
}

interface Props {
  onClose:    () => void
  townName:   string
  reputation: number
  crystals:   number
  rows:       UpgradeRow[]
  onUpgrade:  (buildingId: string) => void
  /** Daily tribute crystals the town offers (0 = nothing unlocked yet). */
  tributeAmount:    number
  /** Whether today's tribute can still be collected. */
  tributeAvailable: boolean
  onCollectTribute: () => void
}

function reputationToNextTier(rep: number): { tier: number; label: string; progress: string } {
  const tier = getReputationTier(rep)
  const nextThreshold = REPUTATION_TIERS[tier + 1]
  const label = REPUTATION_TIER_NAMES[tier]
  const progress = nextThreshold !== undefined
    ? `${rep} / ${nextThreshold} to ${REPUTATION_TIER_NAMES[tier + 1]}`
    : `${rep} (max standing)`
  return { tier, label, progress }
}

export function HubTownUpgrades({
  onClose, townName, reputation, crystals, rows, onUpgrade,
  tributeAmount, tributeAvailable, onCollectTribute,
}: Props) {
  const rep = reputationToNextTier(reputation)

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="town-directory town-upgrades">
        <div className="town-directory__header">
          <span>🏗️ {townName} — Standing &amp; Upgrades</span>
          <span className="town-directory__meta">
            💎 {crystals.toLocaleString()}
            <button className="town-directory__close" onClick={onClose}>✕</button>
          </span>
        </div>

        <div className="town-upgrades__rep">
          <span className="town-upgrades__rep-tier">⭐ {rep.label}</span>
          <span className="town-upgrades__rep-prog">{rep.progress}</span>
        </div>

        {tributeAmount > 0 && (
          <div className="town-upgrades__tribute">
            <span className="town-upgrades__tribute-text">
              🎁 Daily tribute from grateful townsfolk: <strong>💎 {tributeAmount}</strong>
            </span>
            <button
              className="action-btn action-btn--gold town-upgrades__btn"
              disabled={!tributeAvailable}
              onClick={onCollectTribute}
            >
              {tributeAvailable ? 'Collect' : 'Collected today'}
            </button>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="town-directory__empty">No upgradeable buildings here yet.</div>
        ) : (
          <div className="town-directory__list">
            {rows.map(row => {
              const { next } = row
              const track = getUpgradeTrack(row.kind)
              const currentBenefit = row.level > 0 ? track[row.level - 1]?.benefit : null

              let btnLabel = 'Upgrade'
              let disabled = false
              let reason: string | null = null
              if (next.maxed || !next.def) {
                btnLabel = 'Fully upgraded'; disabled = true
              } else if (next.repLocked) {
                btnLabel = `🔒 Needs ${next.repRequired} standing`; disabled = true
                reason = `Raise the town's standing to ${next.repRequired}.`
              } else if (crystals < next.cost) {
                btnLabel = `💎 ${next.cost}`; disabled = true
                reason = 'Not enough crystals.'
              } else {
                btnLabel = `Upgrade · 💎 ${next.cost}`
              }

              return (
                <div key={row.buildingId} className="town-directory__row">
                  <div className="town-directory__info">
                    <span className="town-directory__name">
                      {row.name} <span className="town-upgrades__lvl">Lv {row.level}/{row.total}</span>
                    </span>
                    {currentBenefit && (
                      <span className="town-directory__place">✓ {currentBenefit}</span>
                    )}
                    {next.def && (
                      <span className="town-upgrades__next">
                        → <strong>{next.def.label}</strong>: {next.def.benefit}
                      </span>
                    )}
                    {reason && <span className="town-upgrades__reason">{reason}</span>}
                  </div>
                  <button
                    className="action-btn action-btn--gold town-upgrades__btn"
                    disabled={disabled}
                    onClick={() => onUpgrade(row.buildingId)}
                    title={next.def?.label ?? 'Fully upgraded'}
                  >
                    {btnLabel}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </ModalBackdrop>
  )
}
