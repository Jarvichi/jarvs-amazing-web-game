import React from 'react'
import { AugmentSlot, AugmentInstance } from '../../game/types'
import {
  loadAugmentInstances,
  equipAugment,
  unequipAugment,
} from '../../game/collection'
import { getAugmentCard, augmentSlotLabel } from '../../game/augments'
import { ModalBackdrop } from '../ui/ModalBackdrop'

interface Props {
  slot: AugmentSlot
  cardName: string
  onClose: () => void
}

const RARITY_COLOUR: Record<string, string> = {
  common:    '#999999',
  uncommon:  '#4499ff',
  rare:      '#bb66ff',
  epic:      '#ff8800',
  legendary: '#ffcc00',
  mythic:    '#e040fb',
}

export function AugmentPickerModal({ slot, cardName, onClose }: Props) {
  const allInstances = loadAugmentInstances()

  // Filter to instances of the correct slot type
  const matching: AugmentInstance[] = allInstances.filter(inst => {
    const augCard = getAugmentCard(inst.cardId)
    return augCard?.augmentSlot === slot
  })

  function handleEquip(inst: AugmentInstance) {
    equipAugment(inst.instanceId, cardName)
    onClose()
  }

  function handleUnequip(inst: AugmentInstance) {
    unequipAugment(inst.instanceId)
    onClose()
  }

  return (
    <ModalBackdrop onClose={onClose} zIndex={400}>
      <div className="apm-panel">
        <div className="apm-header">
          Equip {augmentSlotLabel(slot)}
          <button className="cdm-close" onClick={onClose}>✕</button>
        </div>

        {matching.length === 0 ? (
          <div className="apm-empty">
            No {augmentSlotLabel(slot)} augments owned.
          </div>
        ) : (
          <div className="apm-list">
            {matching.map(inst => {
              const augCard = getAugmentCard(inst.cardId)
              if (!augCard) return null
              const isEquippedHere = inst.equippedToCardName === cardName
              const isEquippedElsewhere = inst.equippedToCardName && inst.equippedToCardName !== cardName

              return (
                <div key={inst.instanceId} className={`apm-item${isEquippedHere ? ' apm-item--active' : ''}`}>
                  <div className="apm-item-info">
                    <span
                      className="apm-item-name"
                      style={{ color: RARITY_COLOUR[augCard.rarity] ?? '#fff' }}
                    >
                      {augCard.name}
                    </span>
                    <span className="apm-item-set" style={{ opacity: 0.6, fontSize: 11 }}>
                      {augCard.setName} set · Lv{inst.level}
                    </span>
                    {isEquippedElsewhere && (
                      <span className="apm-item-equipped-other" style={{ color: '#ffaa44', fontSize: 11 }}>
                        Equipped on: {inst.equippedToCardName}
                      </span>
                    )}
                  </div>

                  <div className="apm-item-actions">
                    {isEquippedHere ? (
                      <button className="action-btn action-btn--danger" onClick={() => handleUnequip(inst)}>
                        Unequip
                      </button>
                    ) : (
                      <button className="action-btn action-btn--gold" onClick={() => handleEquip(inst)}>
                        {isEquippedElsewhere ? 'Move Here' : 'Equip'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </ModalBackdrop>
  )
}
