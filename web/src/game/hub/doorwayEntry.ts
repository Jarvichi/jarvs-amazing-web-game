export type DoorwayDirection = 'up' | 'down' | 'left' | 'right' | 'front' | 'back'

// Given the direction of the doorway a player is walking through (as authored
// on the source room's exit) and the destination room's dimensions, returns
// the tile the player should land on — the opposite-side doorway of the
// destination room. `sourceTx` carries the column through for up/down/front/back
// doors (e.g. stairs), which stay aligned to the same tx in both rooms.
export function getDoorwayEntryTile(
  direction: DoorwayDirection | undefined,
  sourceTx: number,
  destWidth: number,
  destHeight: number,
): [number, number] | undefined {
  switch (direction) {
    case 'left':  return [destWidth - 2, Math.floor(destHeight / 2)]
    case 'right': return [1, Math.floor(destHeight / 2)]
    case 'up':    return [sourceTx, destHeight - 2]
    case 'down':  return [sourceTx, 1]
    case 'front': return [sourceTx, 1]
    case 'back':  return [sourceTx, destHeight - 2]
    default:      return undefined
  }
}

export interface ExitLike {
  tx: number
  ty: number
  toInteriorId: string
  entryTx?: number
  entryTy?: number
  direction?: DoorwayDirection
}

/** Finds the up/down door in the destination room that leads back to this
 *  one (opposite direction, toInteriorId pointing here), if any. */
export function findReciprocalStairsExit(
  interiors: Record<string, { exits?: ExitLike[] }> | undefined,
  interiorId: string,
  exit: ExitLike,
): ExitLike | undefined {
  if (exit.direction !== 'up' && exit.direction !== 'down') return undefined
  const opposite = exit.direction === 'up' ? 'down' : 'up'
  const dest = interiors?.[exit.toInteriorId]
  return dest?.exits?.find(e => e.toInteriorId === interiorId && e.direction === opposite)
}

/** True when an up/down exit's stored entryTx/entryTy no longer points at
 *  the reciprocal door's actual tile — e.g. after that door was dragged to
 *  a new spot via the map editor's numeric fields (drag-to-move keeps this
 *  in sync automatically; hand-edited JSON or old data can still go stale). */
export function isStairsEntryStale(
  interiors: Record<string, { exits?: ExitLike[] }> | undefined,
  interiorId: string,
  exit: ExitLike,
): boolean {
  const rev = findReciprocalStairsExit(interiors, interiorId, exit)
  if (!rev) return false
  return exit.entryTx !== rev.tx || exit.entryTy !== rev.ty
}
