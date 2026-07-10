export interface PieceActionBarProps {
  pieceName: string
  removeArmed: boolean
  onRotate(): void
  onMove(): void
  onRemove(): void
}

export function PieceActionBar({ pieceName, removeArmed, onRotate, onMove, onRemove }: PieceActionBarProps) {
  return (
    <div className="piece-action-bar">
      <span className="piece-action-bar-name">{pieceName}</span>
      <button className="action-btn action-btn--sm" onClick={onRotate}>⟳ Rotate</button>
      <button className="action-btn action-btn--sm" onClick={onMove}>✥ Move</button>
      <button
        className={`action-btn action-btn--sm action-btn--danger${removeArmed ? ' action-btn--remove-armed' : ''}`}
        onClick={onRemove}
      >
        {removeArmed ? 'Confirm remove?' : 'Remove'}
      </button>
    </div>
  )
}
