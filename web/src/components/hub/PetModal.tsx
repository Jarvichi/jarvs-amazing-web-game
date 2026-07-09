import React, { useState } from 'react'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { ConfirmModal } from '../modals/ConfirmModal'
import {
  getActivePet, adoptPet, renamePet, dismissPet,
  ownsAccessory, getEquippedAccessoryId, equipAccessory, unequipAccessory,
} from '../../game/hub/pet'
import { ANIMAL_SPECS, type AnimalType } from '../../game/hub/animals'
import { PET_ACCESSORIES } from '../../data/petAccessories'
import { getPatternsForSpecies } from '../../data/petPatterns'

interface Props {
  onClose: () => void
  petActionRef?: React.MutableRefObject<{ setPetAccessory: (assetId: string | null) => void } | null>
}

const PET_SPECIES: ('dog' | 'cat')[] = ['dog', 'cat']
const SPECIES_LABEL: Record<string, string> = { dog: 'Dog', cat: 'Cat' }
const SPECIES_NAME_PLACEHOLDER: Record<string, string> = { dog: 'Name your pup', cat: 'Name your cat' }

function PickerBody({ onAdopt, submitLabel }: { onAdopt: (type: string, variant: string, name: string, pattern: string) => void; submitLabel: string }) {
  const [species, setSpecies] = useState<'dog' | 'cat'>('dog')
  const variants = Object.keys(ANIMAL_SPECS[species].palette)
  const [variant, setVariant] = useState(variants[0])
  const patterns = getPatternsForSpecies(species)
  const [pattern, setPattern] = useState<string>('none')
  const [name, setName] = useState('')

  const chooseSpecies = (s: 'dog' | 'cat') => {
    setSpecies(s)
    setVariant(Object.keys(ANIMAL_SPECS[s].palette)[0])
    setPattern('none')  // dog/cat pattern lists differ — never carry a stale selection across species
  }

  return (
    <>
      <div className="pet-modal__section-label">Choose a companion</div>
      <div className="hoa-tabs">
        {PET_SPECIES.map(s => (
          <button
            key={s}
            className={`hoa-tab${species === s ? ' hoa-tab--active' : ''}`}
            onClick={() => chooseSpecies(s)}
          >{SPECIES_LABEL[s]}</button>
        ))}
      </div>
      <div className="pet-modal__swatches">
        {variants.map(v => (
          <button
            key={v}
            className={`pet-modal__swatch${v === variant ? ' pet-modal__swatch--selected' : ''}`}
            style={{ backgroundColor: `#${ANIMAL_SPECS[species].palette[v].toString(16).padStart(6, '0')}` }}
            title={v}
            onClick={() => setVariant(v)}
          />
        ))}
      </div>
      <div className="pet-modal__section-label">Coat pattern</div>
      <div className="hoa-tabs">
        <button
          className={`hoa-tab${pattern === 'none' ? ' hoa-tab--active' : ''}`}
          onClick={() => setPattern('none')}
        >None</button>
        {patterns.map(p => (
          <button
            key={p.id}
            className={`hoa-tab${pattern === p.id ? ' hoa-tab--active' : ''}`}
            onClick={() => setPattern(p.id)}
          >{p.label}</button>
        ))}
      </div>
      <input
        className="pet-modal__name-input"
        placeholder={SPECIES_NAME_PLACEHOLDER[species]}
        value={name}
        maxLength={24}
        onChange={e => setName(e.target.value)}
      />
      <button className="action-btn action-btn--gold" onClick={() => onAdopt(species, variant, name, pattern)}>{submitLabel}</button>
    </>
  )
}

function AccessoriesTab({ petActionRef, refresh }: {
  petActionRef?: React.MutableRefObject<{ setPetAccessory: (assetId: string | null) => void } | null>
  refresh: () => void
}) {
  const equippedId = getEquippedAccessoryId()

  const toggle = (id: string) => {
    if (equippedId === id) {
      unequipAccessory(id)
      petActionRef?.current?.setPetAccessory(null)
    } else {
      equipAccessory(id)
      petActionRef?.current?.setPetAccessory(id)
    }
    refresh()
  }

  const groups = new Map<string, typeof PET_ACCESSORIES>()
  for (const acc of PET_ACCESSORIES) {
    const group = groups.get(acc.asset) ?? []
    group.push(acc)
    groups.set(acc.asset, group)
  }

  return (
    <div className="pet-modal__accessories">
      {[...groups.values()].map(group => (
        <div key={group[0].asset} className="pet-modal__accessory-group">
          <div className="pet-modal__accessory-group-label">{group[0].slot}</div>
          <div className="pet-modal__accessory-colors">
            {group.map(acc => {
              const owned = ownsAccessory(acc.id)
              const equipped = equippedId === acc.id
              return (
                <button
                  key={acc.id}
                  className={`pet-modal__accessory${equipped ? ' pet-modal__accessory--equipped' : ''}${!owned ? ' pet-modal__accessory--locked' : ''}`}
                  disabled={!owned}
                  onClick={() => toggle(acc.id)}
                >
                  <span className="pet-modal__accessory-name">{acc.name}</span>
                  <span className="pet-modal__accessory-status">
                    {equipped ? 'Equipped' : owned ? 'Tap to equip' : 'Found on quests/bounties, or buy from Tailor Pell in Crownhaven'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function PetContent({ onClose, petActionRef }: Props) {
  const [, setTick] = useState(0)
  const refresh = () => setTick(t => t + 1)
  const [renameValue, setRenameValue] = useState<string | null>(null)
  const [swapping, setSwapping] = useState(false)
  const [confirmSwap, setConfirmSwap] = useState<{ type: string; variant: string; name: string; pattern: string } | null>(null)
  const [confirmDismiss, setConfirmDismiss] = useState(false)
  const [tab, setTab] = useState<'info' | 'accessories'>('info')

  const pet = getActivePet()

  if (confirmSwap) {
    return (
      <ConfirmModal
        title="Adopt a new companion?"
        body={`Adopting ${confirmSwap.name} will mean saying goodbye to ${pet?.name ?? 'your current pet'}.`}
        confirmLabel="Adopt"
        onConfirm={() => { adoptPet(confirmSwap.type, confirmSwap.variant, confirmSwap.name, confirmSwap.pattern); setConfirmSwap(null); setSwapping(false); refresh() }}
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
      <div className="pet-modal">
        <div className="pet-modal__header">
          <span>🐾 {pet ? 'My Pet' : 'Pet Shelter'}</span>
          <button className="pet-modal__close" onClick={onClose}>✕</button>
        </div>

        {!pet && (
          <PickerBody submitLabel="Adopt" onAdopt={(type, variant, name, pattern) => { adoptPet(type, variant, name, pattern); refresh() }} />
        )}

        {pet && !swapping && (
          <>
            <div className="hoa-tabs">
              <button className={`hoa-tab${tab === 'info' ? ' hoa-tab--active' : ''}`} onClick={() => setTab('info')}>Info</button>
              <button className={`hoa-tab${tab === 'accessories' ? ' hoa-tab--active' : ''}`} onClick={() => setTab('accessories')}>Accessories</button>
            </div>

            {tab === 'info' && (
              <>
                <div className="pet-modal__current">
                  <span
                    className="pet-modal__current-swatch"
                    style={{ backgroundColor: `#${(ANIMAL_SPECS[pet.type as AnimalType]?.palette[pet.variant] ?? 0x8b5a2b).toString(16).padStart(6, '0')}` }}
                  />
                  <span className="pet-modal__current-name">{pet.name}</span>
                </div>
                <input
                  className="pet-modal__name-input"
                  placeholder="Rename your pet"
                  value={renameValue ?? pet.name}
                  maxLength={24}
                  onChange={e => setRenameValue(e.target.value)}
                />
                <button
                  className="action-btn"
                  onClick={() => { if (renameValue != null) renamePet(renameValue); setRenameValue(null); refresh() }}
                >Save Name</button>
                <div className="pet-modal__actions-row">
                  <button className="action-btn" onClick={() => setSwapping(true)}>Adopt a Different Companion</button>
                  <button className="action-btn action-btn--danger" onClick={() => setConfirmDismiss(true)}>Dismiss Pet</button>
                </div>
              </>
            )}

            {tab === 'accessories' && <AccessoriesTab petActionRef={petActionRef} refresh={refresh} />}
          </>
        )}

        {pet && swapping && (
          <PickerBody
            submitLabel="Adopt"
            onAdopt={(type, variant, name, pattern) => setConfirmSwap({ type, variant, name, pattern })}
          />
        )}
      </div>
  )
}

export function PetModal(props: Props) {
  return (
    <ModalBackdrop onClose={props.onClose}>
      <PetContent {...props} />
    </ModalBackdrop>
  )
}
