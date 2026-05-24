import React, { useState } from 'react'
import { AugmentInstance } from '../../game/types'
import {
  loadAugmentInstances,
  loadAugmentSouls,
  loadCollection,
  upgradeAugment,
  AUGMENT_UPGRADE_COST,
} from '../../game/collection'
import { getAugmentCard, augmentSlotLabel, scaledAugmentEffect } from '../../game/augments'
import { OverlayScreen } from '../ui/OverlayScreen'
import { CardAugmentScreen } from '../cards/CardAugmentScreen'
import { getCardCatalog } from '../../game/cards'

interface Props {
  onBack: () => void
}

const RARITY_COLOUR: Record<string, string> = {
  common:    '#55cc55',
  uncommon:  '#4499ff',
  rare:      '#bb66ff',
  epic:      '#ff8800',
  legendary: '#ffcc00',
  mythic:    '#e040fb',
}

function effectSummary(effect: { attack?: number; attackRange?: number; maxHp?: number; moveSpeed?: number }): string {
  const parts: string[] = []
  if (effect.maxHp)       parts.push(`+${effect.maxHp} HP`)
  if (effect.attack)      parts.push(`+${effect.attack} ATK`)
  if (effect.attackRange) parts.push(`+${effect.attackRange} RNG`)
  if (effect.moveSpeed)   parts.push(`+${effect.moveSpeed} SPD`)
  return parts.join(', ')
}

export function AugmentCollectionScreen({ onBack }: Props) {
  const [refresh, setRefresh] = useState(0)
  const [detailCardName, setDetailCardName] = useState<string | null>(null)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)

  const forceRefresh = () => setRefresh((r: number) => r + 1)

  const instances   = loadAugmentInstances()
  const souls       = loadAugmentSouls()
  const collection  = loadCollection()
  const catalog     = getCardCatalog()

  function handleUpgrade(inst: AugmentInstance) {
    const err = upgradeAugment(inst.instanceId)
    if (err) {
      setUpgradeError(err)
      setTimeout(() => setUpgradeError(null), 2500)
    }
    forceRefresh()
  }

  if (detailCardName) {
    const card = catalog.find(c => c.name === detailCardName)
    if (card) {
      return (
        <CardAugmentScreen
          card={card}
          collection={collection}
          onClose={() => setDetailCardName(null)}
        />
      )
    }
  }

  return (
    <OverlayScreen title="AUGMENTS" onBack={onBack} right={
      <span style={{ color: '#cc88ff', fontWeight: 700 }}>{souls.toLocaleString()} 👻 souls</span>
    }>
      {upgradeError && (
        <div style={{ color: '#ff6666', textAlign: 'center', fontSize: 12, marginBottom: 8 }}>{upgradeError}</div>
      )}

      {instances.length === 0 ? (
        <div style={{ textAlign: 'center', opacity: 0.6, marginTop: 48 }}>
          No augments owned yet. Earn augments from packs to equip them to your units.
        </div>
      ) : (
        <div className="aug-list">
          {instances.map(inst => {
            const augCard = getAugmentCard(inst.cardId)
            if (!augCard) return null
            const scaled = scaledAugmentEffect(augCard.augmentEffect ?? {}, inst.level)

            return (
              <div key={inst.instanceId} className="aug-list-item">
                <div className="aug-list-item-info">
                  <span className="aug-list-name" style={{ color: RARITY_COLOUR[augCard.rarity] ?? '#fff' }}>
                    {augCard.name}
                  </span>
                  <span style={{ opacity: 0.6, fontSize: 11 }}>
                    {augCard.setName} set · {augmentSlotLabel(augCard.augmentSlot!)} · Lv{inst.level}
                  </span>
                  <span style={{ fontSize: 12, color: '#aaddff' }}>{effectSummary(scaled)}</span>
                  {inst.equippedToCardName ? (
                    <button
                      className="aug-equipped-link"
                      onClick={() => setDetailCardName(inst.equippedToCardName!)}
                    >
                      Equipped on: {inst.equippedToCardName} →
                    </button>
                  ) : (
                    <span style={{ opacity: 0.5, fontSize: 11 }}>Unequipped</span>
                  )}
                </div>

                <div className="aug-list-item-actions">
                  <button
                    className={`action-btn action-btn--gold${souls < AUGMENT_UPGRADE_COST ? ' action-btn--disabled' : ''}`}
                    onClick={() => handleUpgrade(inst)}
                    title={`Costs ${AUGMENT_UPGRADE_COST} souls`}
                  >
                    ↑ Upgrade
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </OverlayScreen>
  )
}
