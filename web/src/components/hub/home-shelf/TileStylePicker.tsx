import { TileSwatch } from '../../shared/TileSwatch'

export interface TileStyleOption {
  key: string
  tileNumericId: number | undefined
  label: string
}

export interface TileStylePickerProps {
  options: TileStyleOption[]
  selectedKey: string | undefined
  price: number
  onPick(key: string): void
}

/** A horizontal row of tile swatches for picking a room's floor or wall
 *  material — reuses the furniture-picker's row/item styling with a
 *  TileSwatch standing in for the furniture icon. */
export function TileStylePicker({ options, selectedKey, price, onPick }: TileStylePickerProps) {
  return (
    <div className="furniture-picker">
      {options.map(opt => (
        <button
          key={opt.key}
          className={`furniture-picker-item furniture-picker-item--owned${opt.key === selectedKey ? ' furniture-picker-item--armed' : ''}`}
          onClick={() => onPick(opt.key)}
          aria-label={opt.key === selectedKey ? opt.label : `${opt.label} — ${price} crystals`}
        >
          <TileSwatch tileNumericId={opt.tileNumericId} size={24} />
          <span className="furniture-picker-item-name">{opt.label}</span>
          {opt.key !== selectedKey && <span className="furniture-picker-item-price">💎{price}</span>}
        </button>
      ))}
    </div>
  )
}
