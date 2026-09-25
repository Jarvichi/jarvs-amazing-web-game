// ─── /defend: sound ─────────────────────────────────────────────────────────
//
// Original chiptune and effects through the shared arcade synth. Like the
// classic, waves play without music: just the whine of interceptors, the
// crump of fireballs and the alarm when a city goes.

import { arpeggio, configureSynth, noise, now, playSong, tone, type Song } from '../arcade/synth'
import type { EventKind } from './world'

export { isMuted, stopMusic, toggleMute, unlock } from '../arcade/synth'

configureSynth({ muteKey: 'jawg-defend-muted' })

// A slow, uneasy minor loop for the title screen.
const TITLE: Song = {
  tempo: 96,
  voices: [
    { wave: 'triangle', vol: 0.13, notes: [45, 52, 57, 60, 57, 52, 45, 52, 44, 52, 56, 59, 56, 52, 44, 52] },
    { wave: 'square', vol: 0.025, gate: 3, notes: [69, 0, 0, 0, 68, 0, 0, 0, 72, 0, 0, 0, 71, 0, 0, 0] },
  ],
}

export const playTitle = () => playSong(TITLE)

export type Sfx = EventKind | 'start' | 'pause' | 'tick'

export function sfx(name: Sfx): void {
  const t = now()
  if (t === null) return
  switch (name) {
    case 'fire': tone('square', 300, 900, t, 0.18, 0.04); break
    case 'empty': tone('square', 120, 120, t, 0.05, 0.05); break
    case 'blast': noise(t, 0.35, 0.12); tone('sawtooth', 140, 50, t, 0.3, 0.05); break
    case 'kill': tone('square', 1200, 600, t, 0.08, 0.04); break
    case 'split': arpeggio([84, 79], t, 0.04, 0.05, 0.04); break
    case 'impact': noise(t, 0.5, 0.2); tone('sawtooth', 90, 30, t, 0.5, 0.08); break
    case 'cityLost': arpeggio([64, 60, 55, 48], t, 0.08, 0.14, 0.07, 'sawtooth'); break
    case 'baseLost': arpeggio([57, 50], t, 0.1, 0.15, 0.07, 'sawtooth'); break
    case 'wave': arpeggio([57, 64, 69, 72], t, 0.09, 0.14, 0.07); break
    case 'cleared': arpeggio([69, 72, 76, 81], t, 0.08, 0.16, 0.07); break
    case 'bonusCity': arpeggio([72, 76, 79, 84, 88], t, 0.07, 0.14, 0.08); break
    case 'over': arpeggio([57, 56, 55, 54, 45], t, 0.3, 0.5, 0.08, 'triangle'); break
    case 'tick': tone('square', 1500, 1500, t, 0.02, 0.03); break
    case 'start': arpeggio([60, 64, 67, 72], t, 0.06, 0.1, 0.07); break
    case 'pause': tone('square', 660, 660, t, 0.08, 0.06); break
  }
}
