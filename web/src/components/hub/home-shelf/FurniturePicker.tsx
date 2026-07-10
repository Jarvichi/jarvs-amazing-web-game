import { FurnitureDef } from '../../../game/hub/furniture'

export interface FurniturePickerProps {
  defs: FurnitureDef[]
  ownedIds: string[]
  armedId: string | null
  onPick(id: string): void
}

export function FurniturePicker({ defs, ownedIds, armedId, onPick }: FurniturePickerProps) {
  return (
    <div className="furniture-picker">
      {defs.map(def => {
        const owned = ownedIds.includes(def.id)
        return (
          <button
            key={def.id}
            className={[
              'furniture-picker-item',
              owned ? 'furniture-picker-item--owned' : 'furniture-picker-item--locked',
              armedId === def.id ? 'furniture-picker-item--armed' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onPick(def.id)}
            aria-label={owned ? def.name : `${def.name} — ${def.price} crystals`}
          >
            <span className="furniture-picker-item-icon">{def.icon}</span>
            <span className="furniture-picker-item-name">{def.name}</span>
            {!owned && <span className="furniture-picker-item-price">💎{def.price}</span>}
          </button>
        )
      })}
    </div>
  )
}
