import { PlacedFurniture, HOME_GRID_COLS, HOME_GRID_ROWS } from '../../../game/hub/homeLayout'
import { FurnitureDef } from '../../../game/hub/furniture'

export interface HomeGridProps {
  placed: PlacedFurniture[]
  getDef(itemId: string): FurnitureDef | undefined
  selectedId: string | null
  /** Whether empty cells should respond to taps (armed-to-place or armed-to-move). */
  tappable: boolean
  onCellTap(x: number, y: number): void
  onPieceTap(id: string): void
}

function footprintFor(def: FurnitureDef | undefined, rotation: 0 | 90 | 180 | 270): { w: number; h: number } {
  const { w, h } = def?.footprint ?? { w: 1, h: 1 }
  return rotation === 90 || rotation === 270 ? { w: h, h: w } : { w, h }
}

export function HomeGrid({ placed, getDef, selectedId, tappable, onCellTap, onPieceTap }: HomeGridProps) {
  const occupied = new Set<string>()
  for (const p of placed) {
    const { w, h } = footprintFor(getDef(p.itemId), p.rotation)
    for (let dx = 0; dx < w; dx++)
      for (let dy = 0; dy < h; dy++)
        occupied.add(`${p.x + dx},${p.y + dy}`)
  }

  const cells = []
  for (let y = 0; y < HOME_GRID_ROWS; y++) {
    for (let x = 0; x < HOME_GRID_COLS; x++) {
      if (occupied.has(`${x},${y}`)) continue
      cells.push(
        <div
          key={`cell-${x}-${y}`}
          className={`home-grid-cell${tappable ? ' home-grid-cell--tappable' : ''}`}
          style={{ gridColumn: x + 1, gridRow: y + 1 }}
          onClick={() => tappable && onCellTap(x, y)}
        />
      )
    }
  }

  return (
    <div className="home-grid">
      {cells}
      {placed.map(p => {
        const def = getDef(p.itemId)
        const { w, h } = footprintFor(def, p.rotation)
        return (
          <button
            key={p.id}
            className={`home-grid-piece${p.id === selectedId ? ' home-grid-piece--selected' : ''}`}
            style={{ gridColumn: `${p.x + 1} / span ${w}`, gridRow: `${p.y + 1} / span ${h}` }}
            onClick={() => onPieceTap(p.id)}
            aria-label={def?.name ?? p.itemId}
          >
            <span>{def?.icon ?? '❓'}</span>
            <span className="home-grid-piece-name">{def?.name ?? p.itemId}</span>
          </button>
        )
      })}
    </div>
  )
}
