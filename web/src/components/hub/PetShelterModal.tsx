import React, { useState } from 'react'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { Panel } from '../ui/Panel'
import { ConfirmModal } from '../modals/ConfirmModal'
import { getActivePet, adoptPet } from '../../game/hub/pet'
import { ANIMAL_SPECS, type AnimalType } from '../../game/hub/animals'
import { getTodaysShelterPets, type ShelterPet } from '../../game/hub/petShelter'

interface Props {
  onClose: () => void
  onAdopted?: () => void
}

const SPECIES_ICON: Record<string, string> = { dog: '🐶', cat: '🐱' }

function swatchColor(pet: ShelterPet): string {
  const hex = ANIMAL_SPECS[pet.type as AnimalType]?.palette[pet.variant] ?? 0x8b5a2b
  return `#${hex.toString(16).padStart(6, '0')}`
}

export function PetShelterContent({ onClose, onAdopted }: Props) {
  const [confirmPet, setConfirmPet] = useState<ShelterPet | null>(null)
  const roster = getTodaysShelterPets()
  const currentPet = getActivePet()

  function handleConfirm() {
    if (!confirmPet) return
    adoptPet(confirmPet.type, confirmPet.variant, confirmPet.name, confirmPet.pattern)
    setConfirmPet(null)
    onAdopted?.()
  }

  if (confirmPet) {
    return (
      <ConfirmModal
        title="Adopt a new companion?"
        body={
          currentPet
            ? `Adopting ${confirmPet.name} will mean saying goodbye to ${currentPet.name}.`
            : `${confirmPet.name} will follow you around town. Adopt them?`
        }
        confirmLabel="Adopt"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmPet(null)}
      />
    )
  }

  return (
    <Panel elevation="floating" className="pet-modal">
      <div className="pet-modal__header">
        <span>🏚️ Ravenwatch Shelter</span>
        <button className="pet-modal__close" onClick={onClose}>✕</button>
      </div>

      <div className="pet-modal__section-label">I have these pets to adopt</div>

      <div className="pet-modal__accessories">
        <div className="pet-modal__accessory-colors">
          {roster.map(pet => (
            <button
              key={`${pet.type}-${pet.name}`}
              className="pet-modal__accessory"
              onClick={() => setConfirmPet(pet)}
            >
              <span className="pet-modal__current-swatch" style={{ backgroundColor: swatchColor(pet) }} />
              <span className="pet-modal__accessory-name">{SPECIES_ICON[pet.type]} {pet.name}</span>
              <span className="pet-modal__accessory-status">Tap to adopt</span>
            </button>
          ))}
        </div>
      </div>
    </Panel>
  )
}

export function PetShelterModal(props: Props) {
  return (
    <ModalBackdrop onClose={props.onClose}>
      <PetShelterContent {...props} />
    </ModalBackdrop>
  )
}
