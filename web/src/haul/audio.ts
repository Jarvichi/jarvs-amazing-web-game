// ─── /haul: sound ───────────────────────────────────────────────────────────
//
// Original chiptune and effects through the shared arcade synth: a creeping
// minor-key title tune, a knock-knock at each door, a cash-register jingle
// when you bank, and the church bell at midnight.

import { arpeggio, configureSynth, noise, now, playSong, tone, type Song } from '../arcade/synth'
import type { EventKind } from './world'

export { isMuted, stopMusic, toggleMute, unlock } from '../arcade/synth'

configureSynth({ muteKey: 'jawg-haul-muted' })

// A tiptoeing bass under a spooky, chromatic tune in D minor.
const TITLE: Song = {
  tempo: 132,
  voices: [
    { wave: 'triangle', vol: 0.14, notes: [38, 0, 45, 0, 38, 0, 45, 0, 37, 0, 45, 0, 37, 0, 44, 0, 36, 0, 43, 0, 36, 0, 43, 0, 33, 0, 40, 0, 33, 0, 45, 0] },
    {
      wave: 'square', vol: 0.03, gate: 1.5,
      notes: [62, 0, 65, 0, 69, 0, 68, 69, 70, 0, 69, 0, 65, 0, 0, 0, 62, 0, 65, 0, 67, 0, 66, 67, 69, 0, 64, 0, 61, 0, 0, 0],
    },
  ],
}

// While the lantern burns: a quick, bouncing march.
const LANTERN: Song = {
  tempo: 200,
  voices: [
    { wave: 'triangle', vol: 0.12, notes: [50, 57, 50, 57, 48, 55, 48, 55] },
    { wave: 'square', vol: 0.03, notes: [74, 0, 77, 0, 81, 0, 77, 0, 72, 0, 76, 0, 79, 0, 76, 0] },
  ],
}

export const playTitle = () => playSong(TITLE)
export const playLantern = () => playSong(LANTERN)

export type Sfx = EventKind | 'start' | 'pause' | 'select' | 'step'

export function sfx(name: Sfx): void {
  const t = now()
  if (t === null) return
  switch (name) {
    case 'knock':
      noise(t, 0.04, 0.12); tone('square', 180, 120, t, 0.04, 0.06)
      noise(t + 0.12, 0.04, 0.12); tone('square', 180, 120, t + 0.12, 0.04, 0.06)
      arpeggio([79, 84], t + 0.2, 0.05, 0.06, 0.04)
      break
    case 'full': tone('square', 200, 150, t, 0.12, 0.05); tone('square', 150, 110, t + 0.13, 0.15, 0.05); break
    case 'bank': arpeggio([72, 76, 79, 84, 88, 91], t, 0.05, 0.1, 0.06); break
    case 'lantern': arpeggio([60, 67, 72, 79], t, 0.04, 0.08, 0.06); break
    case 'lanternEnd': arpeggio([67, 62], t, 0.08, 0.1, 0.04); break
    case 'eat': tone('square', 300, 1400, t, 0.18, 0.05); break
    case 'caught': arpeggio([67, 63, 60, 56, 53, 48], t, 0.1, 0.14, 0.07, 'sawtooth'); break
    case 'spill': noise(t + 0.2, 0.3, 0.06); break
    case 'midnight':
      for (let i = 0; i < 3; i++) {
        tone('triangle', 196, 196, t + i * 0.7, 1.2, 0.12)
        tone('sine', 392, 390, t + i * 0.7, 1.4, 0.06)
      }
      break
    case 'cleared': arpeggio([62, 65, 69, 74, 77, 81, 86], t, 0.08, 0.14, 0.07); break
    case 'extra': arpeggio([76, 79, 84, 88], t, 0.06, 0.1, 0.07); break
    case 'over': arpeggio([62, 61, 60, 59, 50], t, 0.28, 0.5, 0.08, 'triangle'); break
    case 'ready': arpeggio([62, 69, 74], t, 0.1, 0.16, 0.06); break
    case 'start': arpeggio([62, 65, 69, 74], t, 0.06, 0.1, 0.07); break
    case 'select': tone('square', 880, 880, t, 0.04, 0.05); break
    case 'pause': tone('square', 660, 660, t, 0.08, 0.06); break
    case 'step': tone('triangle', 120, 90, t, 0.03, 0.04); break
  }
}
