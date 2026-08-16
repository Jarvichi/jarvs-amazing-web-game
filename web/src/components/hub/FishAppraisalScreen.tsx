// ─── Fish Appraisal Screen — Dockmaster Corwin ───────────────────────────────
// A grid of every fish the player has landed and not yet sold. Tapping one
// shows its size/weight and a star rating (biggest-for-its-tier = 5 stars);
// Corwin only offers to buy the 5-star specimens, at a premium over
// Fishwife Marta's flat per-tier rate.

import React, { useState } from 'react'
import { OverlayScreen } from '../ui/OverlayScreen'
import { getCaughtFish, removeCaughtFish, type CaughtFish } from '../../game/hub/caughtFish'
import { VARIANT_TIERS, VARIANT_TIER_HUB_ITEM, formatWeight, type FishVariant } from '../minigames/Fishing'
import { removeHubItem } from '../../game/itemStore'

const TIER_BASE_PRICE = [3, 6, 12, 25, 45, 90]
const SELL_STAR_THRESHOLD = 5
const SELL_MULTIPLIER = 2

const LOCALE_LABEL: Record<string, string> = { river: 'River', cave: 'Cave Lake', lake: 'Lake', ocean: 'Ocean' }

function tierPrice(locale: string, tier: string): number {
  const idx = VARIANT_TIERS[locale as FishVariant]?.findIndex(t => t.tier === tier) ?? -1
  return idx >= 0 ? TIER_BASE_PRICE[idx] ?? 0 : 0
}

function starString(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(5 - stars)
}

interface Props {
  crystals: number
  onCrystalsChange: (n: number) => void
  onBack: () => void
}

export function FishAppraisalScreen({ crystals, onCrystalsChange, onBack }: Props) {
  const [caught, setCaught] = useState<CaughtFish[]>(() =>
    [...getCaughtFish()].sort((a, b) => b.stars - a.stars || a.tier.localeCompare(b.tier)),
  )
  const [selected, setSelected] = useState<CaughtFish | null>(null)

  function sell(fish: CaughtFish) {
    const price = tierPrice(fish.locale, fish.tier) * SELL_MULTIPLIER
    const hubItemId = VARIANT_TIER_HUB_ITEM[fish.locale as FishVariant]?.[fish.tier]
    if (hubItemId) removeHubItem(hubItemId, 1)
    removeCaughtFish(fish.id)
    onCrystalsChange(crystals + price)
    setCaught(list => list.filter(f => f.id !== fish.id))
    setSelected(null)
  }

  return (
    <OverlayScreen title="🐟 FISH APPRAISAL" onBack={onBack}>
      <div className="u-col u-grow">
        {caught.length === 0 ? (
          <div className="inventory-empty u-grow u-flex u-items-c u-just-c">
            You haven't brought Corwin anything to appraise yet — go catch some fish!
          </div>
        ) : (
          <div className="inventory-grid u-flex u-wrap u-gap-4 u-just-c u-grow">
            {caught.map(fish => (
              <button
                key={fish.id}
                className="inventory-cell"
                onClick={() => setSelected(fish)}
              >
                <div className="inventory-item-icon">{fish.tierIcon}</div>
                <div className="inventory-item-name">{fish.name}</div>
                <div className="inventory-item-desc">{starString(fish.stars)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="inventory-detail-backdrop" onClick={() => setSelected(null)}>
          <div className="inventory-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="inventory-detail-icon">{selected.tierIcon}</div>
            <div className="inventory-detail-name">{selected.name}</div>
            <div className="inventory-detail-tag">
              {LOCALE_LABEL[selected.locale] ?? selected.locale} · {selected.tier}
            </div>
            <div className="inventory-detail-desc">
              {starString(selected.stars)} — {formatWeight(selected.weightGrams)}, {selected.lengthCm}cm
            </div>
            {selected.stars >= SELL_STAR_THRESHOLD ? (
              <button className="action-btn" onClick={() => sell(selected)}>
                Sell for {tierPrice(selected.locale, selected.tier) * SELL_MULTIPLIER} 💎
              </button>
            ) : (
              <div className="inventory-detail-desc">
                "Solid catch — but I only pay premium for the very best." — Corwin
              </div>
            )}
            <button className="action-btn" onClick={() => setSelected(null)}>CLOSE</button>
          </div>
        </div>
      )}
    </OverlayScreen>
  )
}
