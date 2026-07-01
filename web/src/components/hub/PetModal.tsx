import React, { useState } from 'react'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { ConfirmModal } from '../modals/ConfirmModal'
import { getActivePet, adoptPet, renamePet, dismissPet } from '../../game/hub/pet'
import { ANIMAL_SPECS } from '../../game/hub/animals'

interface Props {
  onClose: () => void
}

const DOG_VARIANTS = Object.keys(ANIMAL_SPECS.dog.palette)

function PickerBody({ onAdopt, submitLabel }: { onAdopt: (variant: string, name: string) => void; submitLabel: string }) {
  const [variant, setVariant] = useState(DOG_VARIANTS[0])
  const [name, setName] = useState('')

  return (
    <>
      <div className="pet-modal__section-label">Choose a companion</div>
      <div className="pet-modal__swatches">
        {DOG_VARIANTS.map(v => (
          <button
            key={v}
            className={`pet-modal__swatch${v === variant ? ' pet-modal__swatch--selected' : ''}`}
            style={{ backgroundColor: `#${ANIMAL_SPECS.dog.palette[v].toString(16).padStart(6, '0')}` }}
            title={v}
            onClick={() => setVariant(v)}
          />
        ))}
      </div>
      <input
        className="pet-modal__name-input"
        placeholder="Name your pup"
        value={name}
        maxLength={24}
        onChange={e => setName(e.target.value)}
      />
      <button className="action-btn action-btn--gold" onClick={() => onAdopt(variant, name)}>{submitLabel}</button>
    </>
  )
}

export function PetModal({ onClose }: Props) {
  const [, setTick] = useState(0)
  const refresh = () => setTick(t => t + 1)
  const [renameValue, setRenameValue] = useState<string | null>(null)
  const [swapping, setSwapping] = useState(false)
  const [confirmSwap, setConfirmSwap] = useState<{ variant: string; name: string } | null>(null)
  const [confirmDismiss, setConfirmDismiss] = useState(false)

  const pet = getActivePet()

  if (confirmSwap) {
    return (
      <ConfirmModal
        title="Adopt a new companion?"
        body={`Adopting ${confirmSwap.name} will mean saying goodbye to ${pet?.name ?? 'your current pet'}.`}
        confirmLabel="Adopt"
        onConfirm={() => { adoptPet('dog', confirmSwap.variant, confirmSwap.name); setConfirmSwap(null); setSwapping(false); refresh() }}
        onCancel={() => setConfirmSwap(null)}
      />
    )
  }

  if (confirmDismiss) {
    return (
      <ConfirmModal
        title="Dismiss your pet?"
        body={`${pet?.name ?? 'Your pet'} will no longer follow you around town.`}
        confirmLabel="Dismiss"
        onConfirm={() => { dismissPet(); setConfirmDismiss(false); refresh() }}
        onCancel={() => setConfirmDismiss(false)}
      />
    )
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="pet-modal">
        <div className="pet-modal__header">
          <span>🐾 {pet ? 'My Pet' : 'Pet Shelter'}</span>
          <button className="pet-modal__close" onClick={onClose}>✕</button>
        </div>

        {!pet && (
          <PickerBody submitLabel="Adopt" onAdopt={(variant, name) => { adoptPet('dog', variant, name); refresh() }} />
        )}

        {pet && !swapping && (
          <>
            <div className="pet-modal__current">
              <span
                className="pet-modal__current-swatch"
                style={{ backgroundColor: `#${(ANIMAL_SPECS.dog.palette[pet.variant] ?? 0x8b5a2b).toString(16).padStart(6, '0')}` }}
              />
              <span className="pet-modal__current-name">{pet.name}</span>
            </div>
            <input
              className="pet-modal__name-input"
              placeholder="Rename your pup"
              value={renameValue ?? pet.name}
              maxLength={24}
              onChange={e => setRenameValue(e.target.value)}
            />
            <button
              className="action-btn"
              onClick={() => { if (renameValue != null) renamePet(renameValue); setRenameValue(null); refresh() }}
            >Save Name</button>
            <div className="pet-modal__actions-row">
              <button className="action-btn" onClick={() => setSwapping(true)}>Adopt a Different Dog</button>
              <button className="action-btn action-btn--danger" onClick={() => setConfirmDismiss(true)}>Dismiss Pet</button>
            </div>
          </>
        )}

        {pet && swapping && (
          <PickerBody
            submitLabel="Adopt"
            onAdopt={(variant, name) => setConfirmSwap({ variant, name })}
          />
        )}
      </div>
    </ModalBackdrop>
  )
}
