// ─── /shmup: music and sound effects ────────────────────────────────────────
//
// Original chiptune for the shooter, played through the shared arcade synth
// (../arcade/synth.ts). Songs are one-step-per-eighth-note data.

import { arpeggio, configureSynth, noise, now, playSong, tone, type Song } from '../arcade/synth'
import type { EventKind, Theme } from './logic'

export { isMuted, stopMusic, toggleMute, unlock } from '../arcade/synth'

configureSynth({ muteKey: 'jawg-shmup-muted' })

const repeatBars = (roots: number[], pattern: number[]) =>
  roots.flatMap(r => pattern.map(o => (o < 0 ? 0 : r + o)))

// A driving A-minor loop for the stages.
const STAGE: Song = {
  tempo: 160,
  voices: [
    {
      wave: 'square', vol: 0.04, notes: [
        69, 0, 72, 76, 0, 74, 72, 0, 67, 0, 71, 74, 0, 72, 71, 0,
        65, 0, 69, 72, 0, 71, 69, 0, 64, 0, 68, 71, 76, 74, 71, 68,
      ],
    },
    { wave: 'triangle', vol: 0.18, gate: 0.8, notes: repeatBars([45, 43, 41, 40], [0, 0, 12, 0, 0, 12, 0, 12]) },
  ],
  hat: i => i % 2 === 1,
}

// Tense semitone riff for boss fights.
const BOSS: Song = {
  tempo: 180,
  voices: [
    { wave: 'square', vol: 0.045, notes: [69, 70, 69, 0, 72, 71, 69, 0, 69, 70, 69, 0, 75, 74, 72, 71] },
    { wave: 'triangle', vol: 0.2, gate: 0.7, notes: [33, 33, 45, 33, 34, 34, 46, 34, 33, 33, 45, 33, 34, 34, 46, 34] },
  ],
  hat: i => i % 2 === 0,
}

// Laid-back arpeggios while you browse the trader's wares.
const SHOP: Song = {
  tempo: 110,
  voices: [
    { wave: 'triangle', vol: 0.12, notes: [60, 64, 67, 72, 67, 64, 60, 64, 57, 60, 64, 69, 64, 60, 57, 60] },
    { wave: 'square', vol: 0.03, gate: 2, notes: [48, 0, 0, 0, 48, 0, 0, 0, 45, 0, 0, 0, 45, 0, 0, 0] },
  ],
}

// Bouncy D-dorian for the fungal level.
const SPORE: Song = {
  tempo: 150,
  voices: [
    {
      wave: 'square', vol: 0.04, notes: [
        62, 0, 65, 69, 0, 67, 65, 62, 60, 0, 64, 67, 0, 65, 64, 60,
        62, 0, 65, 69, 72, 0, 69, 67, 65, 64, 62, 0, 57, 0, 60, 0,
      ],
    },
    { wave: 'triangle', vol: 0.18, gate: 0.7, notes: repeatBars([38, 36, 34, 33], [0, 12, 0, 12, 0, 12, 7, 12]) },
  ],
  hat: i => i % 4 === 2,
}

// Glassy E-minor arpeggios with a delayed square echo.
const CRYSTAL_LEAD = [
  76, 79, 83, 88, 83, 79, 76, 79, 74, 78, 81, 86, 81, 78, 74, 78,
  72, 76, 79, 84, 79, 76, 72, 76, 71, 74, 78, 83, 78, 74, 71, 74,
]
const CRYSTAL: Song = {
  tempo: 170,
  voices: [
    { wave: 'triangle', vol: 0.1, notes: CRYSTAL_LEAD },
    { wave: 'square', vol: 0.02, notes: CRYSTAL_LEAD.map((_, i, a) => a[(i + a.length - 1) % a.length]) },
    { wave: 'triangle', vol: 0.16, gate: 0.8, notes: repeatBars([40, 38, 36, 35], [0, 0, 12, 0, 0, 0, 12, 0]) },
  ],
  hat: i => i % 2 === 1,
}

// Driving and dark for the final descent.
const CORE: Song = {
  tempo: 190,
  voices: [
    {
      wave: 'square', vol: 0.045, notes: [
        69, 0, 69, 70, 69, 0, 72, 70, 69, 0, 69, 70, 73, 72, 70, 69,
        67, 0, 67, 69, 67, 0, 70, 69, 65, 0, 65, 67, 69, 70, 72, 73,
      ],
    },
    { wave: 'triangle', vol: 0.2, gate: 0.7, notes: repeatBars([33, 34, 31, 33], [0, 12, 0, 12, 0, 12, 0, 12]) },
  ],
  hat: () => true,
}

const FINAL_BOSS: Song = {
  tempo: 200,
  voices: [
    { wave: 'square', vol: 0.05, notes: [69, 72, 76, 72, 70, 73, 77, 73, 69, 72, 76, 81, 80, 76, 73, 70] },
    { wave: 'sawtooth', vol: 0.05, gate: 0.6, notes: [33, 33, 45, 33, 34, 34, 46, 34, 33, 33, 45, 33, 32, 32, 44, 32] },
  ],
  hat: () => true,
}

const STAGE_SONGS: Record<Theme, Song> = { flesh: STAGE, machine: STAGE, spore: SPORE, crystal: CRYSTAL, core: CORE }

export const playStageMusic = (theme: Theme) => playSong(STAGE_SONGS[theme])
export const playBossMusic = (final: boolean) => playSong(final ? FINAL_BOSS : BOSS)
export const playShopMusic = () => playSong(SHOP)

/** Every game event has a sound (enforced by the switch below), plus UI sounds. */
export type Sfx = EventKind | 'buy' | 'deny' | 'start' | 'pause' | 'tick'

// Rapid-fire sounds would otherwise stack into a drone; cap how often they play.
const lastPlayed: Partial<Record<Sfx, number>> = {}
const MIN_GAP: Partial<Record<Sfx, number>> = { shot: 0.07, hit: 0.05, credit: 0.04, explode: 0.05 }

export function sfx(name: Sfx): void {
  const t = now()
  if (t === null) return
  if (t - (lastPlayed[name] ?? -1) < (MIN_GAP[name] ?? 0)) return
  lastPlayed[name] = t
  switch (name) {
    case 'shot':
      tone('square', 1100, 500, t, 0.05, 0.025)
      break
    case 'hit':
      noise(t, 0.03, 0.05)
      break
    case 'explode':
      noise(t, 0.25, 0.18)
      tone('square', 220, 50, t, 0.2, 0.08)
      break
    case 'bigexplode':
    case 'podkill':
      noise(t, 0.5, 0.28)
      tone('sawtooth', 160, 40, t, 0.45, 0.12)
      break
    case 'bossdie':
      noise(t, 1.6, 0.35)
      tone('sawtooth', 300, 30, t, 1.5, 0.15)
      arpeggio([72, 76, 79, 84], t + 1.6, 0.1, 0.15, 0.12)
      break
    case 'credit':
      tone('square', 1400, 1800, t, 0.05, 0.05)
      break
    case 'capsule':
      arpeggio([72, 76, 79, 84, 88], t, 0.05, 0.08, 0.1)
      break
    case 'hurt':
      tone('sawtooth', 180, 90, t, 0.15, 0.15)
      break
    case 'die':
      noise(t, 0.9, 0.3)
      tone('square', 600, 40, t, 0.9, 0.15)
      break
    case 'boss':
      for (let i = 0; i < 3; i++) {
        tone('square', 440, 440, t + i * 0.5, 0.25, 0.1)
        tone('square', 330, 330, t + i * 0.5 + 0.25, 0.25, 0.1)
      }
      break
    case 'phase':
      tone('sawtooth', 80, 320, t, 0.6, 0.14)
      noise(t, 0.4, 0.15)
      break
    case 'laser':
      // Charge-up whine for the telegraph.
      tone('square', 200, 1200, t, 0.8, 0.05)
      break
    case 'mount':
      // A heavy clunk, then a triumphant rise.
      noise(t, 0.15, 0.2)
      arpeggio([60, 64, 67, 72, 76, 79, 84], t + 0.1, 0.05, 0.1, 0.12)
      break
    case 'podlost':
      // The mount jingle, falling apart.
      arpeggio([79, 72, 67, 60], t + 0.2, 0.07, 0.1, 0.1)
      break
    case 'rearwarn':
      // Two low blips, rising: "look down".
      tone('square', 220, 220, t, 0.08, 0.12)
      tone('square', 330, 330, t + 0.12, 0.1, 0.12)
      break
    case 'bomb':
      noise(t, 1.2, 0.4)
      tone('sawtooth', 60, 1200, t, 0.3, 0.15)
      tone('square', 1200, 40, t + 0.3, 0.9, 0.12)
      break
    case 'buy':
      tone('square', 988, 988, t, 0.06, 0.1)
      tone('square', 1319, 1319, t + 0.06, 0.2, 0.1)
      break
    case 'deny':
      tone('square', 110, 100, t, 0.2, 0.12)
      break
    case 'start':
      arpeggio([60, 67, 72, 79, 84], t, 0.06, 0.12, 0.12)
      break
    case 'tick':
      tone('square', 440, 440, t, 0.06, 0.1)
      break
    case 'pause':
      tone('square', 880, 880, t, 0.05, 0.1)
      tone('square', 660, 660, t + 0.07, 0.08, 0.1)
      break
    default: {
      const missing: never = name
      void missing
    }
  }
}
