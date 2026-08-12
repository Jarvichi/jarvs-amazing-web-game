import { describe, it, expect } from 'vitest'
import {
  getDoorwayEntryTile, findReciprocalStairsExit, isStairsEntryStale, findExteriorDoorForInterior,
  type ExitLike,
} from './doorwayEntry'

describe('getDoorwayEntryTile', () => {
  it('lands opposite a left doorway', () => expect(getDoorwayEntryTile('left', 5, 10, 8)).toEqual([8, 4]))
  it('lands opposite a right doorway', () => expect(getDoorwayEntryTile('right', 5, 10, 8)).toEqual([1, 4]))
  it('keeps sourceTx aligned for up/down/front/back', () => {
    expect(getDoorwayEntryTile('up', 3, 10, 8)).toEqual([3, 6])
    expect(getDoorwayEntryTile('down', 3, 10, 8)).toEqual([3, 1])
    expect(getDoorwayEntryTile('front', 3, 10, 8)).toEqual([3, 1])
    expect(getDoorwayEntryTile('back', 3, 10, 8)).toEqual([3, 6])
  })
  it('returns undefined for no/unknown direction', () => {
    expect(getDoorwayEntryTile(undefined, 3, 10, 8)).toBeUndefined()
  })
})

describe('findReciprocalStairsExit / isStairsEntryStale', () => {
  const interiors = {
    'downstairs': { exits: [{ tx: 2, ty: 2, toInteriorId: 'upstairs', direction: 'up' as const, entryTx: 5, entryTy: 5 }] },
    'upstairs':   { exits: [{ tx: 5, ty: 5, toInteriorId: 'downstairs', direction: 'down' as const, entryTx: 2, entryTy: 2 }] },
  }

  it('finds the reciprocal stairs exit', () => {
    const exit = interiors.downstairs.exits[0]
    const rev = findReciprocalStairsExit(interiors, 'downstairs', exit)
    expect(rev).toEqual(interiors.upstairs.exits[0])
  })

  it('returns undefined for a non-stairs direction', () => {
    const leftExit: ExitLike = { tx: 0, ty: 4, toInteriorId: 'upstairs', direction: 'left' }
    expect(findReciprocalStairsExit(interiors, 'downstairs', leftExit)).toBeUndefined()
  })

  it('is not stale when entryTx/Ty match the reciprocal door', () => {
    expect(isStairsEntryStale(interiors, 'downstairs', interiors.downstairs.exits[0])).toBe(false)
  })

  it('is stale when entryTx/Ty no longer match (door moved)', () => {
    const stale = { ...interiors.downstairs.exits[0], entryTx: 99 }
    expect(isStairsEntryStale(interiors, 'downstairs', stale)).toBe(true)
  })
})

describe('findExteriorDoorForInterior', () => {
  const doors = [{ buildingId: 'hollow-entrance', tx: 28, ty: 54 }]
  const interiors = {
    'hollow-entrance': {
      exits: [
        { tx: 0, ty: 4, toInteriorId: 'hollow-west', direction: 'left' as const },
        { tx: 10, ty: 4, toInteriorId: 'hollow-east', direction: 'right' as const },
      ],
    },
    'hollow-west': { exits: [{ tx: 9, ty: 4, toInteriorId: 'hollow-entrance', direction: 'right' as const }] },
    'hollow-east': { exits: [{ tx: 0, ty: 4, toInteriorId: 'hollow-entrance', direction: 'left' as const }] },
  }

  it('finds the door directly on the room itself', () => {
    expect(findExteriorDoorForInterior('hollow-entrance', doors, interiors)).toBe(doors[0])
  })

  it('traces through one hop of the exits graph to a doorless neighbor', () => {
    expect(findExteriorDoorForInterior('hollow-west', doors, interiors)).toBe(doors[0])
    expect(findExteriorDoorForInterior('hollow-east', doors, interiors)).toBe(doors[0])
  })

  it('does not loop forever on a cycle and returns undefined when no door is reachable', () => {
    const noDoorInteriors = {
      a: { exits: [{ tx: 0, ty: 0, toInteriorId: 'b', direction: 'left' as const }] },
      b: { exits: [{ tx: 0, ty: 0, toInteriorId: 'a', direction: 'right' as const }] },
    }
    expect(findExteriorDoorForInterior('a', doors, noDoorInteriors)).toBeUndefined()
  })

  it('returns undefined for a room absent from both doors and interiors', () => {
    expect(findExteriorDoorForInterior('nowhere', doors, interiors)).toBeUndefined()
  })
})
