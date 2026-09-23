// ─── Arcade: shared chiptune synth ──────────────────────────────────────────
//
// Web Audio oscillators and a noise channel — no audio files. Browsers only
// allow an AudioContext to start from a user gesture, so each game calls
// `unlock()` from its first key press / tap. Each page is one game, so the
// synth is a module-level singleton; `configureSynth` sets the storage key the
// mute preference is remembered under.

export type Wave = OscillatorType

export interface Voice {
  wave: Wave
  vol: number
  /** One MIDI note per step; 0 is a rest. */
  notes: number[]
  /** Fraction of a step each note sounds for. */
  gate?: number
}

export interface Song {
  /** Beats per minute; one step is an eighth note. */
  tempo: number
  voices: Voice[]
  /** Steps (modulo the song length) that get a hi-hat tick. */
  hat?: (step: number) => boolean
}

export const midiToHz = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

let muteKey = 'jawg-arcade-muted'
let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false
let song: Song | null = null
let musicTimer: number | null = null
let nextNoteTime = 0
let step = 0

export function configureSynth(opts: { muteKey: string }): void {
  muteKey = opts.muteKey
  try { muted = localStorage.getItem(muteKey) === '1' } catch { muted = false }
}

export function unlock(): void {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.5
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
}

/** Current audio clock, or null before the first user gesture. */
export function now(): number | null {
  return ctx ? ctx.currentTime : null
}

export function isMuted(): boolean {
  return muted
}

export function toggleMute(): void {
  muted = !muted
  try { localStorage.setItem(muteKey, muted ? '1' : '0') } catch { /* private mode */ }
  if (master && ctx) master.gain.setValueAtTime(muted ? 0 : 0.5, ctx.currentTime)
}

/** One note with a pitch slide and a quick decay envelope. */
export function tone(wave: Wave, from: number, to: number, start: number, dur: number, vol: number): void {
  if (!ctx || !master) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = wave
  osc.frequency.setValueAtTime(from, start)
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, start + dur)
  gain.gain.setValueAtTime(vol, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
  osc.connect(gain).connect(master)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

/** A run of notes, `gap` seconds apart — for jingles. */
export function arpeggio(notes: number[], start: number, gap: number, dur: number, vol: number, wave: Wave = 'square'): void {
  notes.forEach((n, i) => tone(wave, midiToHz(n), midiToHz(n), start + i * gap, dur, vol))
}

export function noise(start: number, dur: number, vol: number): void {
  if (!ctx || !master) return
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  const gain = ctx.createGain()
  src.buffer = buf
  gain.gain.setValueAtTime(vol, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
  src.connect(gain).connect(master)
  src.start(start)
}

function scheduleMusic() {
  if (!ctx || !song) return
  const stepDur = 60 / song.tempo / 2
  const len = song.voices[0].notes.length
  while (nextNoteTime < ctx.currentTime + 0.15) {
    const i = step % len
    for (const v of song.voices) {
      const n = v.notes[i]
      if (n) tone(v.wave, midiToHz(n), midiToHz(n), nextNoteTime, stepDur * (v.gate ?? 0.9), v.vol)
    }
    if (song.hat?.(i)) noise(nextNoteTime, 0.03, 0.04)
    nextNoteTime += stepDur
    step++
  }
}

/** Loop `s` from the top. Does nothing if that song is already playing. */
export function playSong(s: Song): void {
  if (!ctx || (musicTimer !== null && song === s)) return
  stopMusic()
  song = s
  nextNoteTime = ctx.currentTime + 0.05
  step = 0
  musicTimer = window.setInterval(scheduleMusic, 40)
  scheduleMusic()
}

export function stopMusic(): void {
  if (musicTimer !== null) window.clearInterval(musicTimer)
  musicTimer = null
}
