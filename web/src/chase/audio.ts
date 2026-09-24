// ─── /chase: music, engine and sound effects ────────────────────────────────
//
// Original chiptune and effects through the shared arcade synth. The engine
// is a pair of live drones whose pitch follows your speed; the siren is a
// third, warbling while the chase is on.

import { arpeggio, configureSynth, drone, noise, now, playSong, tone, type Drone, type Song } from '../arcade/synth'
import type { EventKind } from './world'

export { isMuted, stopMusic, toggleMute, unlock } from '../arcade/synth'

configureSynth({ muteKey: 'jawg-chase-muted' })

const bars = (roots: number[], pattern: number[]) => roots.flatMap(r => pattern.map(o => (o < 0 ? 0 : r + o)))

// Open-road E-minor drive for the pursuit.
const PURSUIT: Song = {
  tempo: 150,
  voices: [
    {
      wave: 'square', vol: 0.035, notes: [
        64, 0, 67, 0, 71, 0, 69, 67, 72, 0, 71, 0, 69, 67, 69, 0,
        62, 0, 66, 0, 69, 0, 67, 66, 71, 0, 0, 69, 71, 0, 74, 0,
      ],
    },
    { wave: 'triangle', vol: 0.17, gate: 0.7, notes: bars([40, 36, 38, 35], [0, 12, 0, 12, 0, 12, 7, 12]) },
  ],
  hat: i => i % 2 === 1,
}

// Harder and faster once you are on his bumper.
const ARREST: Song = {
  tempo: 176,
  voices: [
    { wave: 'square', vol: 0.04, notes: [76, 0, 76, 74, 76, 0, 79, 0, 76, 0, 74, 72, 71, 0, 72, 74] },
    { wave: 'triangle', vol: 0.19, gate: 0.6, notes: [40, 40, 52, 40, 40, 52, 40, 52, 36, 36, 48, 36, 38, 38, 50, 38] },
  ],
  hat: () => true,
}

// Brooding dispatch-room loop for the title and briefings.
const BRIEF: Song = {
  tempo: 100,
  voices: [
    { wave: 'triangle', vol: 0.12, notes: [52, 59, 64, 67, 64, 59, 52, 59, 48, 55, 60, 64, 60, 55, 50, 57] },
    { wave: 'square', vol: 0.02, gate: 3, notes: [76, 0, 0, 0, 74, 0, 0, 0, 72, 0, 0, 0, 71, 0, 0, 0] },
  ],
}

export const playPursuit = () => playSong(PURSUIT)
export const playArrest = () => playSong(ARREST)
export const playBrief = () => playSong(BRIEF)

export type Sfx = EventKind | 'start' | 'pause' | 'blip'

export function sfx(name: Sfx): void {
  const t = now()
  if (t === null) return
  switch (name) {
    case 'tick': tone('square', 440, 440, t, 0.15, 0.08); break
    case 'go': tone('square', 880, 880, t, 0.4, 0.08); break
    case 'turbo':
      noise(t, 0.5, 0.12)
      tone('sawtooth', 120, 600, t, 0.5, 0.06)
      break
    case 'bump':
      noise(t, 0.15, 0.2)
      tone('square', 90, 50, t, 0.12, 0.08)
      break
    case 'crash':
      noise(t, 0.6, 0.3)
      tone('sawtooth', 160, 30, t, 0.6, 0.1)
      break
    case 'ram':
      noise(t, 0.25, 0.3)
      tone('square', 110, 40, t, 0.2, 0.12)
      tone('square', 1400, 900, t, 0.06, 0.04)
      break
    case 'arrest': arpeggio([76, 72, 76, 72], t, 0.12, 0.1, 0.07); break
    case 'caught': arpeggio([67, 72, 76, 79, 84, 79, 84], t, 0.1, 0.18, 0.08); break
    case 'escaped': arpeggio([64, 60, 57, 52], t, 0.2, 0.3, 0.07, 'triangle'); break
    case 'forkhint': arpeggio([84, 88], t, 0.08, 0.07, 0.06); break
    case 'rightway': arpeggio([72, 79], t, 0.08, 0.1, 0.06); break
    case 'checkpoint': arpeggio([72, 76, 79, 84], t, 0.06, 0.12, 0.07); break
    case 'wrongway': tone('sawtooth', 110, 90, t, 0.5, 0.08); break
    case 'start': arpeggio([60, 64, 67, 72], t, 0.06, 0.1, 0.07); break
    case 'pause': tone('square', 660, 660, t, 0.08, 0.06); break
    case 'blip': tone('square', 990, 990, t, 0.03, 0.03); break
  }
}

// ── Engine and siren ────────────────────────────────────────────────────────
let engine: Drone[] | null = null
let siren: Drone | null = null

/** Call every frame. `speed` is 0…1.35 of top speed; null silences it all. */
export function updateEngine(speed: number | null, turbo: boolean, sirenOn: boolean, t: number): void {
  if (speed === null) {
    engine?.forEach(d => d.stop())
    siren?.stop()
    engine = null
    siren = null
    return
  }
  if (!engine) {
    const a = drone('sawtooth')
    const b = drone('square')
    if (!a || !b) return
    engine = [a, b]
    siren = drone('triangle')
  }
  // Pitch climbs through each "gear" and drops at the change.
  const gear = Math.min(3, Math.floor(speed * 3.2))
  const inGear = speed * 3.2 - gear
  const f = 45 + gear * 18 + inGear * 55 + (turbo ? 25 : 0)
  engine[0].set(f, 0.035 + speed * 0.02)
  engine[1].set(f * 1.5, 0.012)
  siren?.set(Math.floor(t * 2.5) % 2 ? 960 : 720, sirenOn ? 0.018 : 0)
}
