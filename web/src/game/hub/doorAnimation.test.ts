import { describe, it, expect } from 'vitest'
import { DoorAnimationController, DOOR_STEP_MS } from './doorAnimation'

describe('DoorAnimationController', () => {
  it('starts closed for a door that has never been triggered', () => {
    const ctrl = new DoorAnimationController()
    expect(ctrl.frameFor('1,1')).toBe(0)
  })

  it('steps closed -> opening -> open as time advances after openDoor', () => {
    const ctrl = new DoorAnimationController()
    let now = 0
    ctrl.openDoor('1,1', now)
    expect(ctrl.frameFor('1,1')).toBe(0)

    now += DOOR_STEP_MS
    ctrl.advance(now)
    expect(ctrl.frameFor('1,1')).toBe(1)

    now += DOOR_STEP_MS
    ctrl.advance(now)
    expect(ctrl.frameFor('1,1')).toBe(2)
  })

  it('auto-closes after the hold window once nothing keeps it open', () => {
    const ctrl = new DoorAnimationController()
    let now = 0
    ctrl.openDoor('1,1', now)
    now += DOOR_STEP_MS; ctrl.advance(now)
    now += DOOR_STEP_MS; ctrl.advance(now)
    expect(ctrl.frameFor('1,1')).toBe(2)

    // Well past the hold window with nobody re-triggering the door.
    now += 5000
    ctrl.advance(now)
    expect(ctrl.frameFor('1,1')).toBe(1)
    now += DOOR_STEP_MS
    ctrl.advance(now)
    expect(ctrl.frameFor('1,1')).toBe(0)
  })

  it('re-triggering openDoor while open extends the hold instead of closing', () => {
    const ctrl = new DoorAnimationController()
    let now = 0
    ctrl.openDoor('1,1', now)
    now += DOOR_STEP_MS; ctrl.advance(now)
    now += DOOR_STEP_MS; ctrl.advance(now)
    expect(ctrl.frameFor('1,1')).toBe(2)

    now += 400
    ctrl.openDoor('1,1', now) // second entity arrives before the door would close
    now += 400
    ctrl.advance(now)
    // Still open — the hold was extended, not reset to closed.
    expect(ctrl.frameFor('1,1')).toBe(2)
  })

  it('tracks multiple doors independently', () => {
    const ctrl = new DoorAnimationController()
    const now = 0
    ctrl.openDoor('1,1', now)
    expect(ctrl.frameFor('2,2')).toBe(0)
  })

  it('advance() reports which door keys changed frame', () => {
    const ctrl = new DoorAnimationController()
    let now = 0
    ctrl.openDoor('1,1', now)
    now += DOOR_STEP_MS
    const changed = ctrl.advance(now)
    expect(changed).toEqual(['1,1'])
  })
})
