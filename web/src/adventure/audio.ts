// ─── /adventure: sound ──────────────────────────────────────────────────────
//
// Original chiptunes and effects through the shared arcade synth: a marching
// overworld theme, uneasy dungeon loops, a darker one for the keep, and a
// driving boss fight.

import { arpeggio, configureSynth, noise, now, playSong, stopMusic, tone, type Song } from '../arcade/synth'
import type { EventKind } from './state'

export { isMuted, stopMusic, toggleMute, unlock } from '../arcade/synth'

configureSynth({ muteKey: 'jawg-adventure-muted' })

const every = (n: number) => (i: number) => i % n === 0

const TITLE: Song = {
  tempo: 84,
  voices: [
    { wave: 'triangle', vol: 0.12, notes: [50, 57, 62, 65, 62, 57, 50, 57, 48, 55, 60, 64, 60, 55, 48, 55, 46, 53, 58, 62, 58, 53, 46, 53, 45, 52, 57, 61, 57, 52, 45, 52] },
    { wave: 'square', vol: 0.03, gate: 3.5, notes: [74, 0, 0, 0, 0, 0, 0, 0, 72, 0, 0, 0, 0, 0, 0, 0, 70, 0, 0, 0, 0, 0, 0, 0, 69, 0, 0, 0, 73, 0, 0, 0] },
  ],
}

const OVERWORLD: Song = {
  tempo: 132,
  voices: [
    { wave: 'square', vol: 0.045, gate: 0.8, notes: [
      67, 0, 0, 72, 0, 0, 76, 0, 74, 0, 72, 0, 71, 0, 72, 0,
      69, 0, 0, 72, 0, 0, 77, 0, 76, 0, 74, 0, 72, 0, 0, 0,
      67, 0, 0, 72, 0, 0, 76, 0, 79, 0, 77, 0, 76, 0, 74, 0,
      72, 0, 74, 0, 76, 0, 71, 0, 72, 0, 0, 0, 0, 0, 0, 0,
    ] },
    { wave: 'triangle', vol: 0.12, notes: [
      48, 0, 55, 0, 48, 0, 55, 0, 48, 0, 55, 0, 47, 0, 55, 0,
      53, 0, 60, 0, 53, 0, 60, 0, 55, 0, 62, 0, 55, 0, 62, 0,
      48, 0, 55, 0, 48, 0, 55, 0, 52, 0, 59, 0, 53, 0, 60, 0,
      55, 0, 62, 0, 55, 0, 59, 0, 48, 0, 55, 0, 48, 0, 0, 0,
    ] },
  ],
  hat: every(4),
}

const DUNGEON: Song = {
  tempo: 100,
  voices: [
    { wave: 'triangle', vol: 0.12, notes: [45, 0, 52, 0, 48, 0, 52, 0, 45, 0, 52, 0, 47, 0, 52, 0, 44, 0, 52, 0, 47, 0, 52, 0, 44, 0, 50, 0, 47, 0, 50, 0] },
    { wave: 'square', vol: 0.025, gate: 1.8, notes: [0, 0, 0, 0, 76, 0, 0, 0, 0, 0, 0, 0, 75, 0, 0, 0, 0, 0, 0, 0, 76, 0, 0, 0, 0, 0, 71, 0, 72, 0, 71, 0] },
  ],
}

const KEEP: Song = {
  tempo: 116,
  voices: [
    { wave: 'triangle', vol: 0.13, notes: [40, 0, 40, 52, 40, 0, 40, 51, 40, 0, 40, 52, 43, 0, 42, 0, 38, 0, 38, 50, 38, 0, 38, 49, 38, 0, 38, 50, 41, 0, 40, 0] },
    { wave: 'square', vol: 0.03, gate: 1.8, notes: [64, 0, 0, 0, 63, 0, 0, 0, 62, 0, 0, 0, 58, 0, 59, 0, 62, 0, 0, 0, 61, 0, 0, 0, 60, 0, 0, 0, 56, 0, 59, 0] },
  ],
  hat: every(4),
}

const BOSS: Song = {
  tempo: 150,
  voices: [
    { wave: 'triangle', vol: 0.13, notes: [45, 45, 57, 45, 45, 57, 45, 56, 43, 43, 55, 43, 44, 44, 56, 44] },
    { wave: 'square', vol: 0.04, gate: 0.7, notes: [69, 0, 72, 0, 71, 0, 68, 0, 67, 0, 71, 0, 68, 0, 64, 0] },
  ],
  hat: every(2),
}

const CAVE: Song = {
  tempo: 70,
  voices: [{ wave: 'triangle', vol: 0.08, notes: [57, 0, 60, 0, 64, 0, 60, 0, 55, 0, 59, 0, 62, 0, 59, 0] }],
}

const ENDING: Song = {
  tempo: 120,
  voices: [
    { wave: 'square', vol: 0.045, gate: 1.5, notes: [72, 0, 76, 0, 79, 0, 84, 0, 83, 0, 79, 0, 76, 0, 79, 0, 77, 0, 81, 0, 84, 0, 86, 0, 84, 0, 0, 0, 0, 0, 0, 0] },
    { wave: 'triangle', vol: 0.12, notes: [48, 0, 55, 0, 52, 0, 55, 0, 43, 0, 50, 0, 47, 0, 50, 0, 41, 0, 48, 0, 45, 0, 48, 0, 48, 0, 55, 0, 48, 0, 0, 0] },
  ],
}

export type Music = 'title' | 'overworld' | 'dungeon' | 'keep' | 'boss' | 'cave' | 'ending' | 'none'

const SONGS: Record<Exclude<Music, 'none'>, Song> = {
  title: TITLE, overworld: OVERWORLD, dungeon: DUNGEON, keep: KEEP, boss: BOSS, cave: CAVE, ending: ENDING,
}

let playing: Music = 'none'

/** Switch music; does nothing if that tune is already playing. */
export function music(m: Music) {
  if (m === playing && m !== 'none') return
  playing = m
  if (m === 'none') stopMusic()
  else playSong(SONGS[m])
}

/** Forget the current tune, e.g. after the audio context first unlocks. */
export const resetMusic = () => { playing = 'none' }

export type Sfx = EventKind | 'start' | 'pause' | 'select' | 'low' | 'over'

export function sfx(name: Sfx): void {
  const t = now()
  if (t === null) return
  switch (name) {
    case 'swing': noise(t, 0.06, 0.05); tone('square', 900, 500, t, 0.06, 0.03); break
    case 'beam': tone('square', 700, 1400, t, 0.15, 0.03); break
    case 'hit': tone('square', 300, 150, t, 0.08, 0.06); break
    case 'kill': noise(t, 0.15, 0.08); tone('square', 600, 200, t, 0.12, 0.04); break
    case 'hurt': tone('sawtooth', 400, 120, t, 0.18, 0.07); break
    case 'coin': arpeggio([88, 93], t, 0.05, 0.08, 0.04); break
    case 'heal': arpeggio([76, 81, 84], t, 0.04, 0.06, 0.04); break
    case 'key': arpeggio([79, 84, 88, 91], t, 0.05, 0.08, 0.05); break
    case 'unlock': tone('square', 200, 200, t, 0.05, 0.06); tone('square', 300, 300, t + 0.08, 0.08, 0.06); break
    case 'bomb': tone('triangle', 200, 180, t, 0.08, 0.1); break
    case 'blast': noise(t, 0.5, 0.2); tone('sawtooth', 120, 40, t, 0.45, 0.08); break
    case 'secret': arpeggio([67, 71, 74, 79, 83, 86], t + 0.3, 0.07, 0.12, 0.05); break
    case 'fire': tone('sawtooth', 300, 700, t, 0.15, 0.04); noise(t, 0.1, 0.03); break
    case 'burn': noise(t, 0.3, 0.07); tone('sawtooth', 500, 200, t, 0.25, 0.04); break
    case 'cut': noise(t, 0.08, 0.05); break
    case 'item': arpeggio([72, 76, 79, 84, 79, 84, 88], t, 0.09, 0.16, 0.06); break
    case 'flame': arpeggio([60, 64, 67, 72, 76, 79, 84, 88], t, 0.1, 0.25, 0.06); break
    case 'bossHit': tone('square', 180, 90, t, 0.12, 0.08); noise(t, 0.1, 0.06); break
    case 'bossDie':
      for (let i = 0; i < 6; i++) noise(t + i * 0.2, 0.25, 0.15)
      tone('sawtooth', 300, 30, t, 1.2, 0.08)
      break
    case 'clang': tone('square', 1800, 1700, t, 0.06, 0.04); tone('square', 1200, 1200, t + 0.03, 0.05, 0.03); break
    case 'talk': tone('square', 800, 800, t, 0.03, 0.03); break
    case 'buy': arpeggio([84, 88, 91], t, 0.05, 0.08, 0.05); break
    case 'nope': tone('square', 160, 140, t, 0.15, 0.05); break
    case 'stairs': arpeggio([72, 69, 65, 62], t, 0.05, 0.07, 0.04); break
    case 'door': tone('square', 120, 240, t, 0.2, 0.05); break
    case 'die': arpeggio([67, 66, 65, 64, 63, 62], t, 0.12, 0.2, 0.06, 'triangle'); break
    case 'potion': arpeggio([60, 67, 72, 79, 84], t, 0.06, 0.12, 0.06); break
    case 'shoot': tone('square', 500, 350, t, 0.07, 0.025); break
    case 'thud': noise(t, 0.2, 0.1); tone('triangle', 90, 50, t, 0.2, 0.1); break
    case 'win': break
    case 'room': break
    case 'start': arpeggio([60, 64, 67, 72, 76], t, 0.07, 0.12, 0.06); break
    case 'pause': tone('square', 660, 660, t, 0.06, 0.05); break
    case 'select': tone('square', 1000, 1000, t, 0.03, 0.04); break
    case 'low': tone('square', 1200, 1200, t, 0.05, 0.025); break
    case 'over': arpeggio([57, 55, 53, 52, 45], t, 0.3, 0.5, 0.07, 'triangle'); break
  }
}
