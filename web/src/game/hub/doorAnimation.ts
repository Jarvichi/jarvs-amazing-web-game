import type { DoorFrame } from '../../data/tiles/doorTiles'

// Trigger-driven door open/close animation, keyed by a door's tile position
// ("tx,ty"). Mirrors the timing of the Storybook demo (DoorAnimationDemo.tsx:
// STEP_MS = 260) but only steps forward when something actually walks
// through — it doesn't free-run a loop.
export const DOOR_STEP_MS = 260
// How long a door stays open (no queued steps) before it auto-closes. Long
// enough that a second entity arriving shortly after the first doesn't see
// the door slam shut in front of them.
const HOLD_MS = 600

interface DoorAnimState {
  frame: DoorFrame
  queue: DoorFrame[]
  nextStepAt: number
  openUntil: number
}

export class DoorAnimationController {
  private doors = new Map<string, DoorAnimState>()

  private stateFor(doorKey: string): DoorAnimState {
    let state = this.doors.get(doorKey)
    if (!state) {
      state = { frame: 0, queue: [], nextStepAt: 0, openUntil: 0 }
      this.doors.set(doorKey, state)
    }
    return state
  }

  /** Current frame for a door, or closed (0) if it's never been triggered. */
  frameFor(doorKey: string): DoorFrame {
    return this.doors.get(doorKey)?.frame ?? 0
  }

  /** Opens a door (queues opening→open if not already open/opening), and
   *  extends how long it stays open before auto-closing. Safe to call
   *  repeatedly while multiple entities pass through the same door. */
  openDoor(doorKey: string, now: number): void {
    const state = this.stateFor(doorKey)
    state.openUntil = now + HOLD_MS
    if (state.frame === 2 || state.queue.includes(2)) return
    state.queue = [1, 2]
    if (state.nextStepAt === 0 || state.nextStepAt < now) state.nextStepAt = now + DOOR_STEP_MS
  }

  /** Advances every door's animation. Returns the keys whose frame changed
   *  this call, so the caller knows which sprites need a texture swap. */
  advance(now: number): string[] {
    const changed: string[] = []
    for (const [doorKey, state] of this.doors) {
      if (state.frame === 2 && state.queue.length === 0 && state.openUntil <= now) {
        state.queue = [1, 0]
      }
      if (state.queue.length === 0 || now < state.nextStepAt) continue
      state.frame = state.queue.shift()!
      state.nextStepAt = now + DOOR_STEP_MS
      changed.push(doorKey)
    }
    return changed
  }
}
