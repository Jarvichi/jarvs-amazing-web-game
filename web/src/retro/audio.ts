// ─── Retro platformer: sound ────────────────────────────────────────────────
//
// The theme tune and effects for /retro, played through the shared arcade
// synth (../arcade/synth.ts).

import {
  arpeggio, configureSynth, noise, now, playSong, tone, type Song,
} from '../arcade/synth'

export { isMuted, toggleMute, unlock, stopMusic } from '../arcade/synth'

configureSynth({ muteKey: 'jawg-retro-muted' })

// A 4-bar loop, one entry per eighth note. MIDI note numbers; 0 is a rest.
const LEAD = [
  76, 79, 84, 79, 76, 79, 84, 79,
  77, 81, 84, 81, 77, 81, 86, 84,
  79, 83, 86, 83, 79, 83, 86, 83,
  84, 0, 79, 0, 76, 0, 72, 0,
]
const BASS_ROOTS = [48, 53, 55, 48]

const THEME: Song = {
  tempo: 150,
  voices: [
    { wave: 'square', vol: 0.045, notes: LEAD, gate: 0.9 },
    {
      wave: 'triangle',
      vol: 0.18,
      gate: 0.95,
      // Octave-bouncing bass on each bar's root.
      notes: LEAD.map((_, i) => BASS_ROOTS[Math.floor(i / 8)] + (i % 2 ? 12 : 0) - 12),
    },
  ],
  hat: i => i % 4 === 2, // hi-hat on the offbeat
}

export function startMusic(): void {
  playSong(THEME)
}

export type Sfx = 'jump' | 'coin' | 'stomp' | 'die' | 'win' | 'start' | 'pause'

export function sfx(name: Sfx): void {
  const t = now()
  if (t === null) return
  switch (name) {
    case 'jump':
      tone('square', 280, 720, t, 0.14, 0.15)
      break
    case 'coin':
      tone('square', 988, 988, t, 0.06, 0.12)
      tone('square', 1319, 1319, t + 0.06, 0.22, 0.12)
      break
    case 'stomp':
      tone('square', 220, 60, t, 0.15, 0.2)
      noise(t, 0.08, 0.15)
      break
    case 'die':
      tone('square', 660, 660, t, 0.1, 0.18)
      tone('square', 520, 90, t + 0.15, 0.7, 0.18)
      break
    case 'win':
      arpeggio([72, 76, 79, 84, 79], t, 0.1, 0.12, 0.15)
      arpeggio([84], t + 0.5, 0, 0.5, 0.15)
      break
    case 'start':
      arpeggio([72, 76, 79, 84], t, 0.07, 0.1, 0.12)
      break
    case 'pause':
      tone('square', 880, 880, t, 0.05, 0.1)
      tone('square', 660, 660, t + 0.07, 0.08, 0.1)
      break
  }
}

