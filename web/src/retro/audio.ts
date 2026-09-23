// ─── Retro platformer: chiptune audio ───────────────────────────────────────
//
// Everything is synthesised with Web Audio oscillators — square-wave lead and
// effects, triangle bass — so there are no audio files to load. Browsers only
// allow an AudioContext to start from a user gesture, so `unlock()` is called
// from the first key press / tap.

type Wave = OscillatorType

const MUTE_KEY = 'jawg-retro-muted'

// A 4-bar loop, one entry per eighth note. MIDI note numbers; 0 is a rest.
const LEAD = [
  76, 79, 84, 79, 76, 79, 84, 79,
  77, 81, 84, 81, 77, 81, 86, 84,
  79, 83, 86, 83, 79, 83, 86, 83,
  84, 0, 79, 0, 76, 0, 72, 0,
]
const BASS_ROOTS = [48, 53, 55, 48]
const TEMPO = 150 // bpm
const EIGHTH = 60 / TEMPO / 2

const midiToHz = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = readMuted()
let musicTimer: number | null = null
let nextNoteTime = 0
let noteIndex = 0

function readMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
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

export function isMuted(): boolean {
  return muted
}

export function toggleMute(): void {
  muted = !muted
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0') } catch { /* private mode */ }
  if (master && ctx) master.gain.setValueAtTime(muted ? 0 : 0.5, ctx.currentTime)
}

/** One note with a pitch slide and a quick decay envelope. */
function tone(wave: Wave, from: number, to: number, start: number, dur: number, vol: number) {
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

function noise(start: number, dur: number, vol: number) {
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

export type Sfx = 'jump' | 'coin' | 'stomp' | 'die' | 'win' | 'start' | 'pause'

export function sfx(name: Sfx): void {
  if (!ctx) return
  const t = ctx.currentTime
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
      [72, 76, 79, 84, 79, 84].forEach((n, i) =>
        tone('square', midiToHz(n), midiToHz(n), t + i * 0.1, i === 5 ? 0.5 : 0.12, 0.15))
      break
    case 'start':
      [60, 64, 67, 72].forEach((n, i) =>
        tone('square', midiToHz(n + 12), midiToHz(n + 12), t + i * 0.07, 0.1, 0.12))
      break
    case 'pause':
      tone('square', 880, 880, t, 0.05, 0.1)
      tone('square', 660, 660, t + 0.07, 0.08, 0.1)
      break
  }
}

function scheduleMusic() {
  if (!ctx) return
  while (nextNoteTime < ctx.currentTime + 0.15) {
    const i = noteIndex % LEAD.length
    const lead = LEAD[i]
    if (lead) tone('square', midiToHz(lead), midiToHz(lead), nextNoteTime, EIGHTH * 0.9, 0.045)
    const root = BASS_ROOTS[Math.floor(i / 8)]
    const bass = root + (i % 2 ? 12 : 0)
    tone('triangle', midiToHz(bass - 12), midiToHz(bass - 12), nextNoteTime, EIGHTH * 0.95, 0.18)
    if (i % 4 === 2) noise(nextNoteTime, 0.03, 0.04) // hi-hat on the offbeat
    nextNoteTime += EIGHTH
    noteIndex++
  }
}

export function startMusic(): void {
  if (!ctx || musicTimer !== null) return
  nextNoteTime = ctx.currentTime + 0.05
  noteIndex = 0
  musicTimer = window.setInterval(scheduleMusic, 40)
  scheduleMusic()
}

export function stopMusic(): void {
  if (musicTimer !== null) window.clearInterval(musicTimer)
  musicTimer = null
}
