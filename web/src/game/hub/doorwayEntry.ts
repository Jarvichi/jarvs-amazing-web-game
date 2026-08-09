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
