import React, { useState } from 'react'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { Panel } from '../ui/Panel'
import { ConfirmModal } from '../modals/ConfirmModal'
import {
  getActivePet, renamePet, dismissPet,
  ownsAccessory, getEquippedAccessoryId, equipAccessory, unequipAccessory,
} from '../../game/hub/pet'
import { ANIMAL_SPECS, type AnimalType } from '../../game/hub/animals'
import { PET_ACCESSORIES } from '../../data/petAccessories'

interface Props {
  onClose: () => void
  petActionRef?: React.MutableRefObject<{ setPetAccessory: (assetId: string | null) => void } | null>
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
  const [confirmDismiss, setConfirmDismiss] = useState(false)
  const [tab, setTab] = useState<'info' | 'accessories'>('info')

  const pet = getActivePet()

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
      <Panel elevation="floating" className="pet-modal">
        <div className="pet-modal__header">
          <span>🐾 My Pet</span>
          <button className="pet-modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {!pet && (
          <div className="pet-modal__section-label">
            No pet yet — visit the Shelter Keeper in Ravenwatch to adopt one.
          </div>
        )}

        {pet && (
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
                <div className="pet-modal__section-label">
                  Want a different companion? Visit the Shelter Keeper in Ravenwatch.
                </div>
                <div className="pet-modal__actions-row">
                  <button className="action-btn action-btn--danger" onClick={() => setConfirmDismiss(true)}>Dismiss Pet</button>
                </div>
              </>
            )}

            {tab === 'accessories' && <AccessoriesTab petActionRef={petActionRef} refresh={refresh} />}
          </>
        )}
      </Panel>
  )
}

export function PetModal(props: Props) {
  return (
    <ModalBackdrop onClose={props.onClose} title="My Pet">
      <PetContent {...props} />
    </ModalBackdrop>
  )
}
