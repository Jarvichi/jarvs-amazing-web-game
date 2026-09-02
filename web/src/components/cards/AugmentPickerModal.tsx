import React from 'react'
import { AugmentSlot, AugmentInstance } from '../../game/types'
import {
  loadAugmentInstances,
  equipAugment,
  unequipAugment,
} from '../../game/collection'
import { getAugmentCard, augmentSlotLabel } from '../../game/augments'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { RARITY_COLOR } from '../../theme'
import { CloseButton } from '../ui/CloseButton'
import { EmptyState } from '../ui/EmptyState'
import { Button } from '../ui/Button'

interface Props {
  slot: AugmentSlot
  cardName: string
  onClose: () => void
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
    <ModalBackdrop onClose={onClose} zIndex={400} title={`Equip ${augmentSlotLabel(slot)}`}>
      <div className="apm-panel">
        <div className="apm-header">
          Equip {augmentSlotLabel(slot)}
          <CloseButton onClick={onClose} />
        </div>

        {matching.length === 0 ? (
          <EmptyState size="sm">
            No {augmentSlotLabel(slot)} augments owned.
          </EmptyState>
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
                      style={{ color: RARITY_COLOR[augCard.rarity] ?? '#fff' }}
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
                      <Button variant="danger" onClick={() => handleUnequip(inst)}>
                        Unequip
                      </Button>
                    ) : (
                      <Button variant="gold" onClick={() => handleEquip(inst)}>
                        {isEquippedElsewhere ? 'Move Here' : 'Equip'}
                      </Button>
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
