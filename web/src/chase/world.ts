// ─── /chase: one case, start to finish ──────────────────────────────────────
//
// countdown → pursuit (close the gap before the clock runs out) → arrest (a
// fresh clock; ram the target until it gives up) → caught. Either clock
// running out means it escaped. Pure: no drawing, no sound — `step` returns
// events for main.ts to turn into both.

import { MAX_SPEED, createPlayer, stepPlayer, type Controls, type Player } from './car'
import { FORK_OPEN, SEG_LEN, onRoad, segmentAt, sideOf, type Track } from './road'
import { createTarget, ramTarget, stepTarget, type Target } from './target'
import { CASES, type Case } from './tracks'
import { createTraffic, hitProp, hitTraffic, makeRng, stepTraffic, PROP_HIT, type Rng, type TrafficCar } from './traffic'

export type Phase = 'countdown' | 'pursuit' | 'arrest' | 'caught' | 'escaped'

export type EventKind =
  | 'go' | 'turbo' | 'bump' | 'crash' | 'ram' | 'arrest' | 'caught' | 'escaped'
  | 'forkhint' | 'rightway' | 'wrongway' | 'tick'

export interface WorldEvent {
  kind: EventKind
  detail?: string
}

export const COUNTDOWN = 3
/** Gap (world units) at which the pursuit becomes an arrest. */
export const ARREST_GAP = 2500
/** Taking the wrong branch costs this many seconds' worth of closing speed. */
export const WRONG_WAY_SECONDS = 6
export const RAM_POINTS = 500
export const RIGHT_WAY_POINTS = 2000
export const TIME_BONUS = 1000
export const CAUGHT_POINTS = 20000

export interface World {
  caseIdx: number
  def: Case
  track: Track
  player: Player
  target: Target
  traffic: TrafficCar[]
  phase: Phase
  /** Seconds in the current phase. */
  phaseTime: number
  /** Seconds left on the current clock. */
  timer: number
  score: number
  /** Seconds of time bonus earned on arrest (for the results screen). */
  timeLeft: number
  /** Fork the player is inside (-1 if none), and the branch they are on. */
  forkId: number
  forkSide: 'left' | 'right' | null
  /** Fork whose hint has already been shown. */
  hinted: number
  /** Shown on screen for a moment after a fork (right/wrong way). */
  message: { text: string; t: number }
  rnd: Rng
}

export function createWorld(caseIdx: number, score = 0, seed = 1): World {
  const def = CASES[caseIdx]
  const rnd = makeRng(seed)
  const player = createPlayer(SEG_LEN * 2)
  const target = createTarget(player.z + def.startGap)
  target.speed = def.targetSpeed * MAX_SPEED
  return {
    caseIdx, def, track: def.track, player,
    target,
    traffic: createTraffic(def.traffic, player.z, rnd),
    phase: 'countdown', phaseTime: 0, timer: def.pursuitTime, score, timeLeft: 0,
    forkId: -1, forkSide: null, hinted: -1,
    message: { text: '', t: 0 },
    rnd,
  }
}

/** How much further ahead the target gets if you take the wrong branch. */
export const wrongWayPenalty = (def: Case) => (1 - def.targetSpeed) * MAX_SPEED * WRONG_WAY_SECONDS

/** Distance from the player to the target, world units. */
export const gap = (w: World) => w.target.z - w.player.z

function setPhase(w: World, phase: Phase) {
  w.phase = phase
  w.phaseTime = 0
}

export function step(w: World, c: Controls, dt: number): WorldEvent[] {
  const events: WorldEvent[] = []
  const { player: p, target: t, track } = w
  w.phaseTime += dt
  w.message.t = Math.max(0, w.message.t - dt)

  if (w.phase === 'countdown') {
    if (w.phaseTime >= COUNTDOWN) {
      setPhase(w, 'pursuit')
      events.push({ kind: 'go' })
    } else if (Math.floor(w.phaseTime - dt) !== Math.floor(w.phaseTime)) {
      events.push({ kind: 'tick' })
    }
    return events
  }

  const live = w.phase === 'pursuit' || w.phase === 'arrest'
  const controls = live ? c : { steer: 0, gas: false, brake: w.phase === 'caught', turbo: false }

  // ── Player ──
  const seg = segmentAt(track, p.z)
  if (stepPlayer(p, controls, seg.curve, seg.fork, dt)) events.push({ kind: 'turbo' })
  const prop = p.spin <= 0 ? hitProp(p, track) : null
  if (prop) {
    // Bounce back towards the road so you can't get stuck in the scenery.
    p.speed *= 0.2
    p.spin = 0.8
    p.turbo = 0
    const px = segmentAt(track, p.z).props.find(q => q.kind === prop)?.x ?? p.x
    p.x = px + (p.x > px ? 1 : -1) * (PROP_HIT[prop] + 0.25)
    if (!onRoad(p.x, seg.fork) && Math.abs(p.x) > 1) p.x = Math.sign(p.x) * 0.9
    events.push({ kind: 'crash' })
  }

  // ── Traffic ──
  stepTraffic(w.traffic, track, p.z, dt, w.rnd)
  const bump = hitTraffic(p, w.traffic)
  if (bump) events.push({ kind: 'bump', detail: bump })

  // ── Target ──
  const cruise = w.def.targetSpeed * MAX_SPEED
  stepTarget(t, { track, traffic: w.traffic, player: p, cruise, arrest: w.phase === 'arrest', rnd: w.rnd }, dt)

  // ── Forks ──
  const ahead = segmentAt(track, p.z + FORK_OPEN * SEG_LEN * 1.5)
  if (live && ahead.forkId >= 0 && w.hinted !== ahead.forkId && seg.forkId < 0) {
    w.hinted = ahead.forkId
    events.push({ kind: 'forkhint', detail: track.forks[ahead.forkId].side })
  }
  if (seg.forkId >= 0) {
    if (w.forkId < 0) w.forkId = seg.forkId
    if (seg.fork > 0.95) w.forkSide = sideOf(p.x)
  } else if (w.forkId >= 0) {
    const right = w.forkSide === track.forks[w.forkId].side
    if (live && w.forkSide) {
      if (right) {
        w.score += RIGHT_WAY_POINTS
        w.message = { text: 'GOOD CALL!', t: 2 }
        events.push({ kind: 'rightway' })
      } else {
        t.z += wrongWayPenalty(w.def)
        w.message = { text: 'WRONG WAY! HE GAINED GROUND', t: 2.5 }
        events.push({ kind: 'wrongway' })
      }
    }
    w.forkId = -1
    w.forkSide = null
    w.hinted = -1
  }

  if (!live) return events

  // ── Score, clock, phase changes ──
  w.score += Math.round((p.speed * dt) / 20)
  w.timer = Math.max(0, w.timer - dt)

  if (w.phase === 'pursuit' && gap(w) < ARREST_GAP) {
    setPhase(w, 'arrest')
    w.timer = w.def.arrestTime
    events.push({ kind: 'arrest' })
  }
  if (w.phase === 'arrest') {
    const ram = ramTarget(t, p, w.def.armour)
    if (ram) {
      w.score += RAM_POINTS * (p.turbo > 0 ? 2 : 1)
      events.push({ kind: 'ram', detail: ram.side ? 'side' : 'rear' })
    }
    if (t.stopping) {
      w.timeLeft = Math.ceil(w.timer)
      w.score += CAUGHT_POINTS + w.timeLeft * TIME_BONUS
      setPhase(w, 'caught')
      events.push({ kind: 'caught' })
      return events
    }
  }
  if (w.timer <= 0) {
    setPhase(w, 'escaped')
    events.push({ kind: 'escaped' })
  }
  return events
}
