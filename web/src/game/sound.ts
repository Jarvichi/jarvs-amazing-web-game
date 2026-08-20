// ─── Web Audio API Sound Engine ──────────────────────────────────────────────
// All sounds are procedurally generated — no external audio files needed.

import { hapticCardPlay, hapticHit, hapticImpact, hapticWin, hapticLoss, hapticReward } from './haptics'

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null

const SETTINGS_KEY      = 'jarv_sound_enabled'
const SOUND_VOLUME_KEY  = 'jarv_sound_volume'
const MUSIC_VOLUME_KEY  = 'jarv_music_volume'
const SOUND_BASE_GAIN   = 0.35

export function isSoundEnabled(): boolean {
  try { return localStorage.getItem(SETTINGS_KEY) !== 'false' }
  catch { return true }
}

export function setSoundEnabled(val: boolean): void {
  try { localStorage.setItem(SETTINGS_KEY, val ? 'true' : 'false') }
  catch { /* ignore */ }
}

// Read a 0–1 volume from storage. A stored "0" (muted) must survive the round
// trip, so we can't use `|| 1` here — `parseFloat('0') || 1` would wrongly yield 1.
function readVolume(key: string): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return 1
    const v = parseFloat(raw)
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1
  } catch { return 1 }
}

export function getSoundVolume(): number {
  return readVolume(SOUND_VOLUME_KEY)
}

export function setSoundVolume(val: number): void {
  try { localStorage.setItem(SOUND_VOLUME_KEY, String(val)) } catch { /* ignore */ }
  if (masterGain) masterGain.gain.value = SOUND_BASE_GAIN * val
}

export function getMusicVolume(): number {
  return readVolume(MUSIC_VOLUME_KEY)
}

export function setMusicVolume(val: number): void {
  try { localStorage.setItem(MUSIC_VOLUME_KEY, String(val)) } catch { /* ignore */ }
  for (const track of _tracks.values()) {
    if (track.gainNode && track.baseVol !== undefined) {
      track.gainNode.gain.value = track.baseVol * val
    }
  }
}

/**
 * Nudge a suspended context back to life.
 *
 * Mobile browsers suspend the AudioContext whenever the page is backgrounded,
 * and nothing brings it back on its own — so without this the first time a
 * player switches apps or locks their phone, sound is gone for the rest of the
 * session (music worst of all, since a running track has no later event to
 * re-trigger it). Safe to call unconditionally: resuming a running context is
 * a no-op, and resume() rejects only when there is no user gesture behind it,
 * which we treat as "try again on the next one".
 */
function resumeCtx(): void {
  if (!ctx || ctx.state !== 'suspended') return
  ctx.resume().catch(() => {
    // Expected when the browser wants a fresh user gesture first — the next
    // tap routes through getCtx() and retries. Not player-visible on its own.
  })
}

/**
 * Resume on return to foreground so music restarts without waiting for the
 * player to trigger another sound. Registered once at module load; harmless in
 * Node/test environments, which have no `document`.
 */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resumeCtx()
  })
}

function getCtx(): AudioContext | null {
  if (!isSoundEnabled()) return null
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      masterGain = ctx.createGain()
      masterGain.gain.value = SOUND_BASE_GAIN * getSoundVolume()
      masterGain.connect(ctx.destination)
    }
    // Most calls arrive from a tap, which is exactly the gesture the browser
    // wants before it will un-suspend. This is the path that recovers audio if
    // the visibilitychange resume above was rejected for lacking one.
    resumeCtx()
    return ctx
  } catch {
    return null
  }
}

function node(freq: number, type: OscillatorType, startT: number, dur: number, gainAmt = 0.3): void {
  const c = getCtx()
  if (!c || !masterGain) return
  const osc = c.createOscillator()
  const g   = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, startT)
  g.gain.setValueAtTime(gainAmt, startT)
  g.gain.exponentialRampToValueAtTime(0.001, startT + dur)
  osc.connect(g)
  g.connect(masterGain)
  osc.start(startT)
  osc.stop(startT + dur + 0.05)
}

function now(): number {
  const c = getCtx()
  return c ? c.currentTime : 0
}

// ─── Individual sounds ────────────────────────────────────────────────────────

export function playCardPlay() {
  hapticCardPlay()
  const t = now()
  node(440, 'sine', t,       0.08, 0.25)
  node(660, 'sine', t + 0.06, 0.10, 0.20)
}

export function playUnitDeath() {
  const t = now()
  // Short descending cry: pitch drops as the unit falls
  node(320, 'sine',     t,        0.06, 0.22)
  node(240, 'sine',     t + 0.04, 0.08, 0.20)
  node(160, 'sawtooth', t + 0.09, 0.12, 0.18)
  node(100, 'square',   t + 0.16, 0.14, 0.12)
}

export function playBuildingDestroyed() {
  const c = getCtx()
  if (!c || !masterGain) return
  const t = c.currentTime
  // Deep crumbling crash: low rumble + mid crunch + high debris scatter
  node(80,   'sawtooth', t,        0.20, 0.45)
  node(55,   'sine',     t,        0.30, 0.40)
  node(140,  'sawtooth', t + 0.05, 0.15, 0.35)
  node(220,  'square',   t + 0.08, 0.10, 0.28)
  // Noise burst (simulate with fast-sweeping high tone)
  node(2200, 'square',   t,        0.04, 0.30)
  node(1800, 'square',   t + 0.02, 0.05, 0.25)
  node(3000, 'sawtooth', t + 0.01, 0.03, 0.20)
}

export function playVictory() {
  hapticWin()
  const t = now()
  const melody = [523, 659, 784, 1047]
  melody.forEach((f, i) => node(f, 'sine', t + i * 0.12, 0.18, 0.3))
}

export function playDefeat() {
  hapticLoss()
  const t = now()
  const melody = [400, 350, 280, 220]
  melody.forEach((f, i) => node(f, 'sawtooth', t + i * 0.15, 0.22, 0.25))
}

export function playButtonClick() {
  const t = now()
  node(880, 'sine', t, 0.06, 0.15)
}

export function playBattleEvent() {
  const t = now()
  node(220, 'sawtooth', t,       0.12, 0.4)
  node(440, 'square',   t + 0.08, 0.10, 0.3)
  node(660, 'sine',     t + 0.18, 0.14, 0.35)
}

export function playCardFlip() {
  const t = now()
  node(600, 'sine', t,       0.04, 0.2)
  node(900, 'sine', t + 0.04, 0.06, 0.15)
}

export function playRestHeal() {
  const t = now()
  const notes = [523, 659, 784]
  notes.forEach((f, i) => node(f, 'sine', t + i * 0.1, 0.2, 0.22))
}

export function playManaGain() {
  const t = now()
  node(700, 'sine', t,       0.05, 0.18)
  node(1050, 'sine', t + 0.05, 0.07, 0.15)
}

// Throttle so rapid multi-unit attacks don't flood the audio channel
let _lastAttackSoundMs = 0
export function playUnitAttack() {
  const now2 = Date.now()
  if (now2 - _lastAttackSoundMs < 80) return
  _lastAttackSoundMs = now2
  hapticHit()
  const t = now()
  node(180, 'sawtooth', t,        0.04, 0.22)
  node(280, 'square',   t + 0.02, 0.03, 0.15)
}

export function playBaseHit() {
  hapticImpact()
  const t = now()
  node(100, 'sawtooth', t,        0.10, 0.38)
  node(60,  'sine',     t,        0.15, 0.32)
  node(220, 'square',   t + 0.04, 0.06, 0.20)
}

export function playBattleStart() {
  const t = now()
  // Rising 3-note war horn fanfare
  node(220, 'sawtooth', t,        0.14, 0.35)
  node(330, 'sawtooth', t + 0.15, 0.14, 0.38)
  node(440, 'sawtooth', t + 0.30, 0.22, 0.42)
  node(440, 'sine',     t + 0.30, 0.22, 0.28)
}

export function playUpgrade() {
  hapticReward()
  const t = now()
  const notes = [523, 659, 784, 1047]
  notes.forEach((f, i) => node(f, 'sine', t + i * 0.07, 0.12, 0.22))
}

export function playMinigameCorrect() {
  const t = now()
  node(880,  'sine', t,        0.07, 0.28)
  node(1320, 'sine', t + 0.07, 0.10, 0.24)
}

export function playMinigameWrong() {
  const t = now()
  node(280, 'sawtooth', t,        0.09, 0.30)
  node(180, 'square',   t + 0.08, 0.12, 0.22)
}

export function playShopPurchase() {
  const t = now()
  // "Ka-ching": high coin tink + mid register + low resonance
  node(1200, 'sine',     t,        0.05, 0.32)
  node(1800, 'sine',     t + 0.02, 0.06, 0.28)
  node(900,  'triangle', t + 0.05, 0.10, 0.24)
  node(600,  'sine',     t + 0.10, 0.12, 0.20)
}

export function playFruitMachineSpin() {
  const t = now()
  // Short mechanical click-whirr
  node(180, 'sawtooth', t,        0.03, 0.18)
  node(260, 'square',   t + 0.02, 0.03, 0.14)
  node(140, 'sawtooth', t + 0.05, 0.04, 0.12)
}

export function playFruitMachineWin() {
  const t = now()
  // Punchy ascending win fanfare
  const melody = [523, 659, 784, 1047, 1318]
  melody.forEach((f, i) => node(f, 'sine', t + i * 0.09, 0.14, 0.32))
}

export function playFruitMachineLose() {
  const t = now()
  const melody = [440, 370, 294, 220]
  melody.forEach((f, i) => node(f, 'sawtooth', t + i * 0.12, 0.16, 0.26))
}

export function playMapFootstep() {
  const t = now()
  // Soft thud — low sine click
  node(120, 'sine',     t,        0.05, 0.22)
  node(80,  'sawtooth', t + 0.02, 0.04, 0.14)
}

// Hub footstep — softer/quieter than the map version and throttled so the
// per-tile walk in the hub world does not flood the channel.
let _lastHubStepMs = 0
export function playHubFootstep() {
  const now2 = Date.now()
  if (now2 - _lastHubStepMs < 180) return
  _lastHubStepMs = now2
  const t = now()
  node(150, 'sine', t,        0.04, 0.12)
  node(90,  'sine', t + 0.02, 0.03, 0.08)
}

export function playPickup() {
  const t = now()
  // Light two-note pleasant chime when collecting an item
  node(880,  'sine', t,        0.06, 0.20)
  node(1320, 'sine', t + 0.06, 0.10, 0.18)
}

export function playTreasure() {
  const t = now()
  // Rewarding ascending sparkle (richer than pickup) for treasure chests
  const melody = [659, 880, 1175, 1568]
  melody.forEach((f, i) => node(f, 'sine', t + i * 0.08, 0.16, 0.24))
  node(330, 'triangle', t, 0.30, 0.16)  // warm low body
}

export function playDayNightChime() {
  const t = now()
  // Gentle two-note transition sting marking dawn/dusk
  node(523, 'triangle', t,        0.45, 0.16)
  node(784, 'sine',     t + 0.12, 0.40, 0.13)
}

// ─── Animal vocalisations (hub critters) ──────────────────────────────────────
export function playDogBark() {
  const t = now()
  // Two short gruff bursts
  node(190, 'square',   t,        0.07, 0.26)
  node(140, 'sawtooth', t + 0.01, 0.08, 0.20)
  node(200, 'square',   t + 0.16, 0.06, 0.22)
  node(150, 'sawtooth', t + 0.17, 0.07, 0.16)
}

export function playCatMeow() {
  const t = now()
  // Rising-then-falling glide ≈ "me-ow"
  node(640, 'sine',     t,        0.13, 0.16)
  node(540, 'sine',     t + 0.11, 0.17, 0.14)
}

export function playBirdChirp() {
  const t = now()
  // Two quick high tweets
  node(2400, 'sine', t,        0.04, 0.10)
  node(3100, 'sine', t + 0.05, 0.05, 0.09)
}

export function playHenCluck() {
  const t = now()
  // Low clipped clucks
  node(440, 'square', t,        0.05, 0.13)
  node(300, 'square', t + 0.08, 0.06, 0.12)
}


// ─── Music Engine ─────────────────────────────────────────────────────────────
// Look-ahead scheduler pattern — runs a setInterval every SCHEDULE_MS and
// pre-schedules Web Audio notes up to LOOKAHEAD_SEC ahead of playback.

const LOOKAHEAD_SEC = 0.3
const SCHEDULE_MS   = 100

interface MusicTrack {
  scheduler:    ReturnType<typeof setInterval> | null
  nextBeatTime: number
  beatIndex:    number
  gainNode:     GainNode | null
  baseVol:      number
}

function makeTrack(): MusicTrack {
  return { scheduler: null, nextBeatTime: 0, beatIndex: 0, gainNode: null, baseVol: 0.1 }
}

function trackGain(track: MusicTrack, vol: number): GainNode | null {
  const c = getCtx()
  if (!c) return null
  if (!track.gainNode) {
    track.baseVol = vol
    track.gainNode = c.createGain()
    track.gainNode.gain.value = vol * getMusicVolume()
    track.gainNode.connect(c.destination)
  }
  return track.gainNode
}

function musicNote(
  track: MusicTrack, vol: number,
  freq: number, type: OscillatorType, startT: number, dur: number, noteVol: number,
): void {
  const c = getCtx()
  const g = trackGain(track, vol)
  if (!c || !g) return
  const osc = c.createOscillator()
  const gn  = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, startT)
  gn.gain.setValueAtTime(noteVol, startT)
  gn.gain.exponentialRampToValueAtTime(0.001, startT + dur)
  osc.connect(gn)
  gn.connect(g)
  osc.start(startT)
  osc.stop(startT + dur + 0.05)
}

function startTrack(
  track: MusicTrack,
  vol: number,
  beatSec: number,
  scheduler: (track: MusicTrack, vol: number, beatSec: number, upTo: number) => void,
  stopFn: () => void,
): void {
  if (track.scheduler !== null) return
  const c = getCtx()
  if (!c) return
  track.nextBeatTime = c.currentTime + 0.1
  track.beatIndex    = 0
  scheduler(track, vol, beatSec, c.currentTime + LOOKAHEAD_SEC)
  track.scheduler = setInterval(() => {
    const c2 = getCtx()
    if (!c2 || !isSoundEnabled()) { stopFn(); return }
    scheduler(track, vol, beatSec, c2.currentTime + LOOKAHEAD_SEC)
  }, SCHEDULE_MS)
}

function stopTrack(track: MusicTrack): void {
  if (track.scheduler !== null) {
    clearInterval(track.scheduler)
    track.scheduler = null
  }
}

// ─── MusicTrackConfig — passable config for the music engine ─────────────────
// Define a config object with id, bpm, vol, and a scheduler function, then pass
// it to startMusicTrack() to begin playback.  stopMusicTrack(id) stops it.

export type MusicSchedulerFn = (
  track: MusicTrack, vol: number, beatSec: number, upTo: number
) => void

export interface MusicTrackConfig {
  id:       string
  bpm:      number
  vol:      number
  schedule: MusicSchedulerFn
}

const _tracks = new Map<string, MusicTrack>()

function getOrCreateTrack(id: string): MusicTrack {
  let t = _tracks.get(id)
  if (!t) { t = makeTrack(); _tracks.set(id, t) }
  return t
}

/** Start a music track from a config object. No-op if already playing. */
export function startMusicTrack(config: MusicTrackConfig): void {
  const track   = getOrCreateTrack(config.id)
  const beatSec = 60 / config.bpm
  startTrack(track, config.vol, beatSec, config.schedule, () => stopMusicTrack(config.id))
}

/** Stop a music track by its config id. */
export function stopMusicTrack(id: string): void {
  const track = _tracks.get(id)
  if (track) stopTrack(track)
}

// ─── Battle Music (D Dorian, 115 BPM) ────────────────────────────────────────
// Aggressive, driving tempo with kick, snare, bass, harmony, and lead melody.
// 4 phrases × 8 beats = 32-beat cycle (~16.5 s).

const BATTLE_BPM      = 115
const BATTLE_BEAT_SEC = 60 / BATTLE_BPM
const BATTLE_VOL      = 0.13

// D Dorian: D, E, F, A, C  across registers
const BA = [73.4,  87.3,  98.0,  130.8, 146.8]  // bass (D2–D3 range)
const BM = [293.7, 349.2, 392.0, 523.2, 587.3]  // melody (D4–D5 range)
const BH = [587.3, 698.5, 784.0, 1046.5, 1174.7] // high harmony (D5–D6)

// Bass patterns per phrase
const B_BASS = [
  [0, 0, 2, 0, 1, 0, 2, 0],  // phrase 0 – grounded on D
  [2, 2, 1, 2, 3, 2, 1, 2],  // phrase 1 – walks up
  [0, 3, 2, 3, 0, 2, 1, 0],  // phrase 2 – tension
  [4, 4, 3, 4, 2, 3, 1, 0],  // phrase 3 – climax descent
] as const

// Melody patterns per phrase
const B_MEL: (number|null)[][] = [
  [0, null, 2, null, 1, null, 3,    null],
  [null, 3, null, 4, null, 2, null, 3   ],
  [2,    3, 4,    null, 3, 2, null, 1   ],
  [4,    4, 3,    2,    4, 3, 2,    0   ],
]

// High harmony (played only at intensity 2)
const B_HARM: (number|null)[][] = [
  [null, 1, null, 3,    null, 2, null, 4   ],
  [2,    null, 3, null, 4,    null, 2, null],
  [null, 4, 3,    null, 4,    null, 3, 2   ],
  [3,    null, 4, 3,    null, 4, 3,    null],
]

function battlePhrase(absbeat: number): number {
  const raw = Math.floor(absbeat / 8)
  if (battleIntensity === 0) return raw % 2
  if (battleIntensity === 2) return 1 + (raw % 3)
  return raw % 4
}

function scheduleBattle(track: MusicTrack, vol: number, beatSec: number, upTo: number): void {
  while (track.nextBeatTime < upTo) {
    const absbeat = track.beatIndex
    const phrase  = battlePhrase(absbeat)
    const beat    = absbeat % 8
    const t       = track.nextBeatTime
    const n       = (f: number, type: OscillatorType, off: number, dur: number, v: number) =>
                      musicNote(track, vol, f, type, t + off, dur, v)

    // Kick drum — every beat 0 and 4 (louder at higher intensity)
    const kickVol = 0.35 + battleIntensity * 0.06
    if (beat === 0 || beat === 4) {
      n(80,  'sine',     0,          0.12, kickVol)
      n(55,  'sine',     0,          0.18, kickVol * 0.7)
      n(400, 'sawtooth', 0,          0.03, kickVol * 0.25)  // click transient
    }
    // Extra kick on beat 2 at intensity 2
    if (beat === 2 && battleIntensity === 2) n(80, 'sine', 0, 0.10, kickVol * 0.6)

    // Bass — always present
    const bassIdx = B_BASS[phrase][beat]
    const bassVol = 0.42 + battleIntensity * 0.07
    n(BA[bassIdx], 'sawtooth', 0, beatSec * 0.80, bassVol)
    n(BA[bassIdx] * 1.5, 'sine', beatSec * 0.02, beatSec * 0.5, 0.18)  // 5th harmony

    // Snare on beats 2 and 6 (intensity 0: beat 2 only)
    const snareBeats = battleIntensity === 0 ? [2] : [2, 6]
    if (snareBeats.includes(beat) || (battleIntensity === 2 && beat === 5)) {
      const sv = 0.08 + battleIntensity * 0.025
      n(3200 + Math.random() * 800, 'square', 0, 0.04, sv)
      n(2400 + Math.random() * 600, 'square', 0, 0.06, sv * 0.8)
      n(1600 + Math.random() * 400, 'square', 0, 0.07, sv * 0.55)
    }

    // Hi-hat 16th note pulse at intensity ≥ 1
    if (battleIntensity >= 1) {
      n(6000 + Math.random() * 1000, 'square', beatSec * 0.5, 0.02, 0.03)
      if (battleIntensity === 2) n(7000, 'square', beatSec * 0.25, 0.015, 0.025)
    }

    // Melody — intensity ≥ 1
    const melIdx = B_MEL[phrase][beat]
    if (melIdx !== null && battleIntensity >= 1) {
      const mv = 0.30 + battleIntensity * 0.07
      n(BM[melIdx], 'sine', beatSec * 0.04, beatSec * 0.60, mv)
      if (battleIntensity === 2) n(BM[melIdx], 'triangle', beatSec * 0.04, beatSec * 0.55, mv * 0.3)
    }

    // High harmony — intensity 2 only
    if (battleIntensity === 2) {
      const hIdx = B_HARM[phrase][beat]
      if (hIdx !== null) n(BH[hIdx], 'sine', beatSec * 0.06, beatSec * 0.45, 0.15)
    }

    // Phrase climax accent (beat 0 of phrase 3)
    if (phrase === 3 && beat === 0) {
      n(55, 'sine', 0, beatSec * 1.8, 0.32)
      n(110, 'sawtooth', 0, beatSec * 0.5, 0.2)
    }

    track.nextBeatTime += beatSec
    track.beatIndex++
  }
}

export const BATTLE_MUSIC: MusicTrackConfig = { id: 'battle', bpm: BATTLE_BPM, vol: BATTLE_VOL, schedule: scheduleBattle }

export function startBattleMusic(): void { startMusicTrack(BATTLE_MUSIC) }
export function stopBattleMusic(): void  { stopMusicTrack('battle') }

// ─── Title Music (C major, slow pads, 60 BPM) ────────────────────────────────
// 3 phrases × 8 beats = 24-beat cycle (~24 s). Phrases shift harmonic centre.

const TITLE_BPM      = 60
const TITLE_BEAT_SEC = 60 / TITLE_BPM
const TITLE_VOL      = 0.10

// C major pentatonic: C3=0, E3=1, G3=2, A3=3, C4=4, E4=5, G4=6
const TP = [130.8, 164.8, 196.0, 220.0, 261.6, 329.6, 392.0]
// Bass roots per phrase: C2, G1, A1
const T_BASS = [65.4, 49.0, 55.0]

// Pad melody + counter-melody per phrase
const T_PAD: (number|null)[][] = [
  [0, null, 2, null, 4,    null, 2, null],   // C centre
  [2, null, 4, null, 6,    null, 4, null],   // G centre
  [3, null, 5, null, 4,    null, 6, null],   // A centre
]
const T_TOP: (number|null)[][] = [
  [null, 6, null, 5, null, 4,    null, 6],
  [null, 4, null, 6, null, 5,    null, 3],
  [null, 6, null, 4, null, 3,    null, 5],
]

function scheduleTitle(track: MusicTrack, vol: number, beatSec: number, upTo: number): void {
  while (track.nextBeatTime < upTo) {
    const phrase = Math.floor(track.beatIndex / 8) % 3
    const beat   = track.beatIndex % 8
    const t      = track.nextBeatTime
    const n      = (f: number, type: OscillatorType, off: number, dur: number, v: number) =>
                     musicNote(track, vol, f, type, t + off, dur, v)

    // Slow bass every 2 beats, root chosen per phrase
    if (beat % 2 === 0) {
      n(T_BASS[phrase], 'sine', 0, beatSec * 1.9, 0.4)
      n(T_BASS[phrase] / 2, 'sine', 0, beatSec * 1.9, 0.18)
    }

    const padIdx = T_PAD[phrase][beat]
    if (padIdx !== null) n(TP[padIdx], 'triangle', 0, beatSec * 1.5, 0.32)

    const topIdx = T_TOP[phrase][beat]
    if (topIdx !== null) n(TP[topIdx] * 2, 'sine', beatSec * 0.12, beatSec * 0.85, 0.22)

    // Phrase 2 gets an extra shimmer on beat 3
    if (phrase === 2 && beat === 3) n(TP[6] * 2, 'sine', beatSec * 0.6, beatSec * 0.3, 0.12)

    track.nextBeatTime += beatSec
    track.beatIndex++
  }
}

export const TITLE_MUSIC: MusicTrackConfig = { id: 'title', bpm: TITLE_BPM, vol: TITLE_VOL, schedule: scheduleTitle }

export function startTitleMusic(): void { startMusicTrack(TITLE_MUSIC) }
export function stopTitleMusic(): void  { stopMusicTrack('title') }

// ─── Game Over Music ──────────────────────────────────────────────────────────
// Victory: G major, 3 phrases — opener, build, triumphant climax, 80 BPM
// Defeat:  D minor, 3 phrases — lament A, lament B, fading echo, 55 BPM

let goIsVictory = false

// G major pentatonic: G3, A3, B3, D4, E4, G4
const WN = [196.0, 220.0, 246.9, 293.7, 329.6, 392.0]
const W_PATS: (number|null)[][] = [
  [0, null, 2,    null, 3, null, 2, null],   // intro: sparse
  [0, 2,    null, 3,    4, null, 3, 2   ],   // build: denser
  [0, 2,    4,    5,    4, 2,    3, 5   ],   // climax: full
]
// D minor pentatonic: D3, F3, G3, A3, C4
const LN = [146.8, 174.6, 196.0, 220.0, 261.6]
const L_PATS: (number|null)[][] = [
  [4, null, 3, null, 2, null, 1, 0   ],   // lament A: descending
  [3, 4,    2, 3,    1, 2,    0, null],   // lament B: stepwise
  [2, null, 1, null, 0, null, null, null],  // fade: sparse echo
]

function scheduleGameOver(track: MusicTrack, vol: number, beatSec: number, upTo: number): void {
  const notes = goIsVictory ? WN : LN
  const pats  = goIsVictory ? W_PATS : L_PATS
  while (track.nextBeatTime < upTo) {
    // After 3 phrases, keep looping: phrase 2 for victory, phrase 1 for defeat
    const rawPhrase = Math.floor(track.beatIndex / 8)
    const phrase    = rawPhrase < 3 ? rawPhrase : (goIsVictory ? 2 : 1)
    const beat      = track.beatIndex % 8
    const t         = track.nextBeatTime
    const n         = (f: number, type: OscillatorType, off: number, dur: number, v: number) =>
                        musicNote(track, vol, f, type, t + off, dur, v)

    // Bass root every 4 beats
    if (beat % 4 === 0) {
      const root = goIsVictory ? 98.0 : 73.4
      n(root, 'sine', 0, beatSec * 3.6, 0.42)
      n(root / 2, 'sine', 0, beatSec * 3.6, 0.22)
    }

    const idx = pats[phrase][beat]
    if (idx !== null) {
      const noteType: OscillatorType = goIsVictory ? 'sine' : 'triangle'
      // Increasing volume per phrase on victory
      const noteVol = goIsVictory ? 0.35 + phrase * 0.1 : 0.5
      n(notes[idx], noteType, beatSec * 0.02, beatSec * 0.75, noteVol)
      if (goIsVictory && idx + 2 < notes.length)
        n(notes[idx + 2], 'sine', beatSec * 0.02, beatSec * 0.6, 0.2 + phrase * 0.05)
    }

    track.nextBeatTime += beatSec
    track.beatIndex++
  }
}

export const GAME_OVER_MUSIC_VICTORY: MusicTrackConfig = { id: 'gameover', bpm: 80, vol: 0.11, schedule: scheduleGameOver }
export const GAME_OVER_MUSIC_DEFEAT:  MusicTrackConfig = { id: 'gameover', bpm: 55, vol: 0.11, schedule: scheduleGameOver }

export function startGameOverMusic(winner: 'player' | 'opponent' | 'draw'): void {
  goIsVictory = winner === 'player'
  startMusicTrack(goIsVictory ? GAME_OVER_MUSIC_VICTORY : GAME_OVER_MUSIC_DEFEAT)
}
export function stopGameOverMusic(): void { stopMusicTrack('gameover') }

// ─── Node Map Music (E minor, mysterious, 70 BPM) ─────────────────────────────
// 3 phrases × 8 beats. Phrase 0: sparse wander; 1: hopeful climb; 2: tense.

const MAP_BPM      = 70
const MAP_BEAT_SEC = 60 / MAP_BPM
const MAP_VOL      = 0.10

// E minor pentatonic: E2, B2, D3, E3, G3, B3, D4, E4
const MP  = [146.8, 164.8, 196.0, 246.9, 293.7, 329.6]  // pad notes
const MB  = [82.4, 97.9, 73.4]                           // bass roots: E2, B2, D2

const M_PAD: (number|null)[][] = [
  [0, null, 2, 3,    null, 4,    null, 1   ],  // phrase 0: wandering
  [2, 3,    4, null, 5,    null, 4,    3   ],  // phrase 1: climbing
  [4, null, 3, null, 2,    3,    1,    null],  // phrase 2: tense fall
]
const M_TOP: (number|null)[][] = [
  [null, 5, null, null, 4,    null, 5, null],
  [null, 4, null, 5,    null, null, 3, 5   ],
  [5,    4, null, 5,    null, 4,    3, null],
]
const M_BASS = [[0,0], [1,1], [2,0]]  // bass root indices per phrase [beat0, beat4]

function scheduleMap(track: MusicTrack, vol: number, beatSec: number, upTo: number): void {
  while (track.nextBeatTime < upTo) {
    const phrase = Math.floor(track.beatIndex / 8) % 3
    const beat   = track.beatIndex % 8
    const t      = track.nextBeatTime
    const n      = (f: number, type: OscillatorType, off: number, dur: number, v: number) =>
                     musicNote(track, vol, f, type, t + off, dur, v)

    if (beat === 0 || beat === 4) {
      const bIdx = beat === 0 ? M_BASS[phrase][0] : M_BASS[phrase][1]
      n(MB[bIdx], 'sine', 0, beatSec * 1.9, 0.45)
      n(MB[bIdx] / 2, 'sine', 0, beatSec * 1.9, 0.18)
    }

    const padIdx = M_PAD[phrase][beat]
    if (padIdx !== null) n(MP[padIdx], 'triangle', 0, beatSec * 1.2, 0.3)

    const topIdx = M_TOP[phrase][beat]
    if (topIdx !== null) n(MP[topIdx] * 2, 'sine', beatSec * 0.08, beatSec * 0.7, 0.18)

    track.nextBeatTime += beatSec
    track.beatIndex++
  }
}

export const MAP_MUSIC: MusicTrackConfig = { id: 'map', bpm: MAP_BPM, vol: MAP_VOL, schedule: scheduleMap }

export function startMapMusic(): void { startMusicTrack(MAP_MUSIC) }
export function stopMapMusic(): void  { stopMusicTrack('map') }

// ─── Hub Music (G major, calm & towny, 66 BPM) ───────────────────────────────
// Gentle, unhurried village theme: soft bass, warm triangle pads and a light
// pluck melody. 3 phrases × 8 beats = 24-beat cycle (~21.8 s).

const HUB_BPM = 66
const HUB_VOL = 0.09

// G major pentatonic: G2, D3, G3, A3, B3, D4, E4, G4
const HP = [98.0, 146.8, 196.0, 220.0, 246.9, 293.7, 329.6, 392.0]
const HB = [49.0, 73.4, 65.4]  // bass roots: G1, D2, C2

const H_PAD: (number|null)[][] = [
  [2, null, 4, null, 5,    null, 4, null],   // G centre — settled
  [3, null, 5, null, 6,    null, 5, null],   // A/D — lifts
  [1, null, 4, null, 3,    null, 5, null],   // gentle resolve
]
const H_TOP: (number|null)[][] = [
  [null, 5, null, 7, null, 6,    null, 5],
  [null, 6, null, 7, null, 5,    null, 4],
  [null, 7, null, 5, null, 4,    null, 6],
]
const H_BASS = [[0, 1], [1, 2], [2, 0]]  // bass root indices per phrase [beat0, beat4]

function scheduleHub(track: MusicTrack, vol: number, beatSec: number, upTo: number): void {
  while (track.nextBeatTime < upTo) {
    const phrase = Math.floor(track.beatIndex / 8) % 3
    const beat   = track.beatIndex % 8
    const t      = track.nextBeatTime
    const n      = (f: number, type: OscillatorType, off: number, dur: number, v: number) =>
                     musicNote(track, vol, f, type, t + off, dur, v)

    // Soft bass on beats 0 and 4
    if (beat === 0 || beat === 4) {
      const bIdx = beat === 0 ? H_BASS[phrase][0] : H_BASS[phrase][1]
      n(HB[bIdx], 'sine', 0, beatSec * 1.9, 0.40)
      n(HB[bIdx] * 2, 'sine', 0, beatSec * 1.6, 0.14)
    }

    // Warm pad
    const padIdx = H_PAD[phrase][beat]
    if (padIdx !== null) n(HP[padIdx], 'triangle', 0, beatSec * 1.4, 0.26)

    // Light pluck melody up an octave
    const topIdx = H_TOP[phrase][beat]
    if (topIdx !== null) n(HP[topIdx] * 2, 'sine', beatSec * 0.1, beatSec * 0.55, 0.16)

    track.nextBeatTime += beatSec
    track.beatIndex++
  }
}

export const HUB_MUSIC: MusicTrackConfig = { id: 'hub', bpm: HUB_BPM, vol: HUB_VOL, schedule: scheduleHub }

export function startHubMusic(): void { startMusicTrack(HUB_MUSIC) }
export function stopHubMusic(): void  { stopMusicTrack('hub') }

// ─── Building interior music ─────────────────────────────────────────────────
// Each interior can pick a `musicId` (see BUILDING_MUSIC_TRACKS). When the player
// enters such a building the town theme is swapped for the building's track and
// restored on exit. Authored per-building in the map editor.

// Inn — lively D-major tavern jig (108 BPM): bouncy bass + jaunty melody.
const INN_NOTES = [146.8, 220.0, 293.7, 329.6, 392.0, 440.0, 587.3]  // D3,A3,D4,E4,G4,A4,D5
const INN_BASS  = [73.4, 110.0, 98.0]  // D2, A2, G2
const INN_MEL: (number|null)[][] = [
  [2, 3, 4, 3, 2, 4, 3, 2],
  [4, 5, 4, 3, 2, 3, 4, 5],
  [2, 4, 6, 4, 3, 5, 4, 2],
]
function scheduleInn(track: MusicTrack, vol: number, beatSec: number, upTo: number): void {
  while (track.nextBeatTime < upTo) {
    const phrase = Math.floor(track.beatIndex / 8) % 3
    const beat   = track.beatIndex % 8
    const t      = track.nextBeatTime
    const n = (f: number, ty: OscillatorType, off: number, dur: number, v: number) =>
                musicNote(track, vol, f, ty, t + off, dur, v)
    // Oom-pah bass: root on the beat, fifth on the off-beat
    const root = INN_BASS[[0, 1, 2][phrase]]
    n(root, 'triangle', 0, beatSec * 0.45, 0.4)
    n(root * 1.5, 'triangle', beatSec * 0.5, beatSec * 0.4, 0.26)
    const mIdx = INN_MEL[phrase][beat]
    if (mIdx !== null) n(INN_NOTES[mIdx], 'square', beatSec * 0.05, beatSec * 0.5, 0.12)
    track.nextBeatTime += beatSec
    track.beatIndex++
  }
}
export const INN_MUSIC: MusicTrackConfig = { id: 'music-inn', bpm: 108, vol: 0.085, schedule: scheduleInn }

// Church/temple — solemn, slow sustained chords (50 BPM), A minor / modal.
const CH_CHORD = [
  [110.0, 164.8, 220.0],  // A2 E3 A3
  [98.0,  146.8, 196.0],  // G2 D3 G3
  [130.8, 196.0, 261.6],  // C3 G3 C4
]
function scheduleChurch(track: MusicTrack, vol: number, beatSec: number, upTo: number): void {
  while (track.nextBeatTime < upTo) {
    const phrase = Math.floor(track.beatIndex / 4) % 3
    const beat   = track.beatIndex % 4
    const t      = track.nextBeatTime
    const n = (f: number, ty: OscillatorType, off: number, dur: number, v: number) =>
                musicNote(track, vol, f, ty, t + off, dur, v)
    if (beat === 0) {
      // Sustained organ chord held across the whole bar
      for (const f of CH_CHORD[phrase]) n(f, 'sine', 0, beatSec * 3.8, 0.18)
      n(CH_CHORD[phrase][0] / 2, 'sine', 0, beatSec * 3.8, 0.12)  // sub octave
    }
    // Sparse high shimmer on beat 2
    if (beat === 2) n(CH_CHORD[phrase][2] * 2, 'triangle', 0, beatSec * 1.5, 0.07)
    track.nextBeatTime += beatSec
    track.beatIndex++
  }
}
export const CHURCH_MUSIC: MusicTrackConfig = { id: 'music-church', bpm: 50, vol: 0.09, schedule: scheduleChurch }

// Shop — light, pleasant, busy little tune (92 BPM), C major.
const SHOP_N = [261.6, 329.6, 392.0, 523.2, 659.3]  // C4 E4 G4 C5 E5
const SHOP_MEL: (number|null)[][] = [
  [0, 2, 1, 3, 2, 4, 3, 2],
  [3, 2, 4, 3, 1, 2, 0, 2],
]
function scheduleShop(track: MusicTrack, vol: number, beatSec: number, upTo: number): void {
  while (track.nextBeatTime < upTo) {
    const phrase = Math.floor(track.beatIndex / 8) % 2
    const beat   = track.beatIndex % 8
    const t      = track.nextBeatTime
    const n = (f: number, ty: OscillatorType, off: number, dur: number, v: number) =>
                musicNote(track, vol, f, ty, t + off, dur, v)
    if (beat % 2 === 0) n(130.8, 'sine', 0, beatSec * 0.9, 0.3)  // soft C3 pulse
    const mIdx = SHOP_MEL[phrase][beat]
    if (mIdx !== null) n(SHOP_N[mIdx], 'triangle', beatSec * 0.04, beatSec * 0.45, 0.14)
    track.nextBeatTime += beatSec
    track.beatIndex++
  }
}
export const SHOP_MUSIC: MusicTrackConfig = { id: 'music-shop', bpm: 92, vol: 0.08, schedule: scheduleShop }

/** Building interior music tracks, keyed by the `musicId` set on an interior. */
export const BUILDING_MUSIC_TRACKS: Record<string, MusicTrackConfig> = {
  inn:    INN_MUSIC,
  church: CHURCH_MUSIC,
  shop:   SHOP_MUSIC,
}
export const BUILDING_MUSIC_IDS = Object.keys(BUILDING_MUSIC_TRACKS)

// ─── Ambiance beds ───────────────────────────────────────────────────────────
// Low-volume looping textures that layer *under* the music while inside a
// building. Picked via an interior's `ambianceId`.

// Hearth — random soft fire crackles/pops.
function scheduleHearth(track: MusicTrack, vol: number, beatSec: number, upTo: number): void {
  while (track.nextBeatTime < upTo) {
    const t = track.nextBeatTime
    if (Math.random() < 0.6) {
      const f = 1800 + Math.random() * 2200
      musicNote(track, vol, f, 'square', t + Math.random() * beatSec, 0.02 + Math.random() * 0.03, 0.05 + Math.random() * 0.05)
    }
    if (Math.random() < 0.25) musicNote(track, vol, 90 + Math.random() * 40, 'sine', t, 0.18, 0.06)  // low whoosh
    track.nextBeatTime += beatSec
    track.beatIndex++
  }
}
export const HEARTH_AMBIANCE: MusicTrackConfig = { id: 'amb-hearth', bpm: 150, vol: 0.5, schedule: scheduleHearth }

// Sacred — sustained low drone + sparse high bell shimmer (reverberant).
function scheduleSacred(track: MusicTrack, vol: number, beatSec: number, upTo: number): void {
  while (track.nextBeatTime < upTo) {
    const t = track.nextBeatTime
    const beat = track.beatIndex % 8
    if (beat === 0) musicNote(track, vol, 65.4, 'sine', 0, beatSec * 7.5, 0.18)  // C2 drone
    if (beat === 4) musicNote(track, vol, 98.0, 'sine', 0, beatSec * 3.5, 0.12)
    if (Math.random() < 0.3) musicNote(track, vol, 1046 + Math.random() * 400, 'sine', t + Math.random() * beatSec, 0.8, 0.04)
    track.nextBeatTime += beatSec
    track.beatIndex++
  }
}
export const SACRED_AMBIANCE: MusicTrackConfig = { id: 'amb-sacred', bpm: 40, vol: 0.6, schedule: scheduleSacred }

// Market — gentle random mid-range chatter taps.
function scheduleMarket(track: MusicTrack, vol: number, beatSec: number, upTo: number): void {
  while (track.nextBeatTime < upTo) {
    const t = track.nextBeatTime
    if (Math.random() < 0.5) {
      const f = 300 + Math.random() * 500
      musicNote(track, vol, f, 'triangle', t + Math.random() * beatSec, 0.05 + Math.random() * 0.06, 0.04 + Math.random() * 0.04)
    }
    track.nextBeatTime += beatSec
    track.beatIndex++
  }
}
export const MARKET_AMBIANCE: MusicTrackConfig = { id: 'amb-market', bpm: 120, vol: 0.5, schedule: scheduleMarket }

// Crickets — outdoor night bed: rhythmic high-frequency chirp trills with gaps.
function scheduleCrickets(track: MusicTrack, vol: number, beatSec: number, upTo: number): void {
  while (track.nextBeatTime < upTo) {
    const t = track.nextBeatTime
    // A trill = a few rapid high pulses; not every beat, so it breathes.
    if (Math.random() < 0.7) {
      const base = 4200 + Math.random() * 600
      const pulses = 2 + ((Math.random() * 3) | 0)
      for (let i = 0; i < pulses; i++) {
        musicNote(track, vol, base, 'sine', t + i * 0.03, 0.02, 0.05)
      }
    }
    track.nextBeatTime += beatSec
    track.beatIndex++
  }
}
export const CRICKETS_AMBIANCE: MusicTrackConfig = { id: 'amb-crickets', bpm: 140, vol: 0.4, schedule: scheduleCrickets }

/** Ambiance beds, keyed by the `ambianceId` set on an interior. */
export const AMBIANCE_TRACKS: Record<string, MusicTrackConfig> = {
  hearth: HEARTH_AMBIANCE,
  sacred: SACRED_AMBIANCE,
  market: MARKET_AMBIANCE,
}

// ─── Outdoor night ambiance (crickets) ───────────────────────────────────────
// Driven by HubTownCanvas: on at night while outdoors, off by day / indoors /
// when leaving the hub. Idempotent.
let _nightAmbianceOn = false
export function setNightAmbiance(on: boolean): void {
  if (on === _nightAmbianceOn) return
  _nightAmbianceOn = on
  if (on) startMusicTrack(CRICKETS_AMBIANCE)
  else stopMusicTrack(CRICKETS_AMBIANCE.id)
}
export const AMBIANCE_IDS = Object.keys(AMBIANCE_TRACKS)

// ─── Interior audio control ──────────────────────────────────────────────────
// Imperatively driven by HubWorld on building enter/exit. A building may set a
// `musicId` (swaps the town theme) and/or an `ambianceId` (layered bed).

let _interiorMusicId: string | null = null
let _ambianceId:      string | null = null

/** Enter a building: swap to its music (if any) and start its ambiance (if any). */
export function startInteriorAudio(musicId?: string, ambianceId?: string): void {
  stopInteriorAudio()
  if (musicId && BUILDING_MUSIC_TRACKS[musicId]) {
    stopHubMusic()
    startMusicTrack(BUILDING_MUSIC_TRACKS[musicId])
    _interiorMusicId = musicId
  }
  if (ambianceId && AMBIANCE_TRACKS[ambianceId]) {
    startMusicTrack(AMBIANCE_TRACKS[ambianceId])
    _ambianceId = ambianceId
  }
}

/** Exit a building: stop its music/ambiance and resume the town theme. */
export function stopInteriorAudio(): void {
  if (_interiorMusicId) {
    stopMusicTrack(BUILDING_MUSIC_TRACKS[_interiorMusicId].id)
    _interiorMusicId = null
    startHubMusic()
  }
  if (_ambianceId) {
    stopMusicTrack(AMBIANCE_TRACKS[_ambianceId].id)
    _ambianceId = null
  }
}

// ─── Adaptive Battle Music ────────────────────────────────────────────────────
// The battle track can be "instructed" to shift its intensity and phrase
// selection based on game state. Call setBattleIntensity() from App.tsx.
//
//  0 = calm (losing badly / early game)
//  1 = normal (evenly matched)
//  2 = intense (winning / late game with many units)

let battleIntensity = 1  // 0 | 1 | 2

export function setBattleIntensity(level: 0 | 1 | 2): void {
  battleIntensity = level
}

// ─── Music track registry ─────────────────────────────────────────────────────
// Maps track ID strings (as used in act JSON music fields) to MusicTrackConfig.
// Acts can reference these by ID to override the default music per act.
export const MUSIC_TRACKS: Record<string, MusicTrackConfig> = {
  battle:  BATTLE_MUSIC,
  title:   TITLE_MUSIC,
  map:     MAP_MUSIC,
  hub:     HUB_MUSIC,
  gameover: GAME_OVER_MUSIC_VICTORY,
}

// ─── emitSound — unified dispatch API ────────────────────────────────────────
// Single entry point for all one-shot sound effects.  IDs match the `id`
// fields in src/data/sounds.json.  Existing play*() helpers remain exported
// for direct use; emitSound() is the preferred API for new call-sites.

export type SoundId =
  | 'cardPlay' | 'unitDeath' | 'buildingDestroyed'
  | 'unitAttack' | 'baseHit' | 'battleStart' | 'upgrade'
  | 'victory' | 'defeat' | 'battleEvent'
  | 'buttonClick' | 'cardFlip' | 'restHeal' | 'manaGain'
  | 'minigameCorrect' | 'minigameWrong'
  | 'shopPurchase' | 'fruitMachineSpin' | 'fruitMachineWin' | 'fruitMachineLose'
  | 'mapFootstep'
  | 'hubFootstep' | 'pickup' | 'treasure' | 'dayNightChime'
  | 'dogBark' | 'catMeow' | 'birdChirp' | 'henCluck'

const SOUND_MAP: Record<SoundId, () => void> = {
  cardPlay:          playCardPlay,
  unitDeath:         playUnitDeath,
  buildingDestroyed: playBuildingDestroyed,
  unitAttack:        playUnitAttack,
  baseHit:           playBaseHit,
  battleStart:       playBattleStart,
  upgrade:           playUpgrade,
  victory:           playVictory,
  defeat:            playDefeat,
  battleEvent:       playBattleEvent,
  buttonClick:       playButtonClick,
  cardFlip:          playCardFlip,
  restHeal:          playRestHeal,
  manaGain:          playManaGain,
  minigameCorrect:   playMinigameCorrect,
  minigameWrong:     playMinigameWrong,
  shopPurchase:      playShopPurchase,
  fruitMachineSpin:  playFruitMachineSpin,
  fruitMachineWin:   playFruitMachineWin,
  fruitMachineLose:  playFruitMachineLose,
  mapFootstep:       playMapFootstep,
  hubFootstep:       playHubFootstep,
  pickup:            playPickup,
  treasure:          playTreasure,
  dayNightChime:     playDayNightChime,
  dogBark:           playDogBark,
  catMeow:           playCatMeow,
  birdChirp:         playBirdChirp,
  henCluck:          playHenCluck,
}

export function emitSound(id: SoundId): void {
  SOUND_MAP[id]?.()
}
