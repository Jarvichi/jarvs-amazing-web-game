import { Button } from '../../ui/Button'

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
      <Button size="sm" onClick={onRotate}>⟳ Rotate</Button>
      <Button size="sm" onClick={onMove}>✥ Move</Button>
      <Button
        size="sm"
        variant="danger"
        className={removeArmed ? 'action-btn--remove-armed' : undefined}
        onClick={onRemove}
      >
        {removeArmed ? 'Confirm remove?' : 'Remove'}
      </Button>
    </div>
  )
}
