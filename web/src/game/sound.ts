// ─── Web Audio API Sound Engine ──────────────────────────────────────────────
// All sounds are procedurally generated — no external audio files needed.

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

export function getSoundVolume(): number {
  try { return Math.min(1, Math.max(0, parseFloat(localStorage.getItem(SOUND_VOLUME_KEY) ?? '1') || 1)) }
  catch { return 1 }
}

export function setSoundVolume(val: number): void {
  try { localStorage.setItem(SOUND_VOLUME_KEY, String(val)) } catch { /* ignore */ }
  if (masterGain) masterGain.gain.value = SOUND_BASE_GAIN * val
}

export function getMusicVolume(): number {
  try { return Math.min(1, Math.max(0, parseFloat(localStorage.getItem(MUSIC_VOLUME_KEY) ?? '1') || 1)) }
  catch { return 1 }
}

export function setMusicVolume(val: number): void {
  try { localStorage.setItem(MUSIC_VOLUME_KEY, String(val)) } catch { /* ignore */ }
  for (const track of _tracks.values()) {
    if (track.gainNode && track.baseVol !== undefined) {
      track.gainNode.gain.value = track.baseVol * val
    }
  }
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
    return ctx
  } catch {
    return null
  }
}

// ─── ZzFX Sound Synthesizer ──────────────────────────────────────────────────
// Generates one-shot SFX sample buffers. Tune sounds at:
// https://killedbyapixel.github.io/ZzFX/
// Based on ZzFX by Frank Force — MIT License.
//
// Params: volume, randomness, frequency(Hz), attack(s), sustain(s), release(s),
//         shape(0=sine 1=tri 2=saw 3=tan 4=bits), shapeCurve,
//         slide(Hz/s), deltaSlide(Hz/s²), pitchJump(Hz), pitchJumpTime(s),
//         repeatTime(s), noise(0–1)

function zzfxG(
  volume = 1, randomness = .05, frequency = 220,
  attack = 0, sustain = 0, release = .1,
  shape = 0, shapeCurve = 1,
  slide = 0, deltaSlide = 0,
  pitchJump = 0, pitchJumpTime = 0,
  repeatTime = 0, noise = 0,
): Float32Array {
  const SR  = 44100
  const TAU = Math.PI * 2
  const vol = volume * .7 * (1 - randomness + 2 * randomness * Math.random())

  let freq    = frequency
  const dFreq  = slide      / SR
  const ddFreq = deltaSlide / SR / SR

  const atk   = attack  * SR | 0
  const sus   = sustain * SR | 0
  const rel   = release * SR | 0
  const rep   = repeatTime * SR | 0
  const total = atk + sus + rel
  const buf   = new Float32Array(total)

  let phase  = 0, dFreqV = 0
  let jumped = !pitchJumpTime
  const jumpAt = pitchJumpTime * SR | 0

  for (let i = 0; i < total; i++) {
    if (!jumped && i >= jumpAt) { freq += pitchJump; jumped = true }
    dFreqV += ddFreq
    freq   += dFreq + dFreqV
    phase  += Math.max(0, freq) * TAU / SR

    const p = ((phase % TAU) + TAU) % TAU
    let s: number
    switch (shape | 0) {
      case 1:  s = 1 - 2 * p / TAU; break
      case 2:  s = p / Math.PI - 1; break
      case 3:  s = Math.max(-1, Math.min(1, Math.tan(p / 2) / 2)); break
      case 4:  s = Math.sign(Math.random() - .5); break
      default: s = Math.sin(p)
    }
    if (shapeCurve !== 1) s = Math.sign(s) * Math.abs(s) ** shapeCurve
    if (noise) s = s * (1 - noise) + (Math.random() * 2 - 1) * noise

    const ti  = rep ? i % rep : i
    const env = ti < atk       ? ti / atk
              : ti < atk + sus ? 1
              : Math.max(0, 1 - (ti - atk - sus) / (rel || 1))

    buf[i] = Math.max(-1, Math.min(1, s * env * vol))
  }
  return buf
}

function zzfxPlay(p: number[]): void {
  const c = getCtx()
  if (!c || !masterGain) return
  const [v=1,r=.05,f=220,a=0,s=0,rel=.1,sh=0,sc=1,sl=0,ds=0,pj=0,pjt=0,rt=0,n=0] = p
  const data = zzfxG(v, r, f, a, s, rel, sh, sc, sl, ds, pj, pjt, rt, n)
  const buf  = c.createBuffer(1, data.length, 44100)
  buf.getChannelData(0).set(data)
  const src  = c.createBufferSource()
  src.buffer = buf
  src.connect(masterGain)
  src.start()
}

// ─── Individual sounds ────────────────────────────────────────────────────────

export function playCardPlay() {
  zzfxPlay([.8, .03, 600, 0, .02, .07, 2, 1, 400, 0, 200, .03, 0, .05])
}

export function playUnitDeath() {
  zzfxPlay([.7, .06, 300, 0, .06, .28, 2, 1, -300, 0, 0, 0, 0, .22])
}

export function playBuildingDestroyed() {
  zzfxPlay([1, .03, 80, 0, .1, .45, 2, .4, -60, 0, 0, 0, 0, .75])
}

export function playVictory() {
  ;[523, 659, 784, 1047].forEach((f, i) =>
    setTimeout(() => zzfxPlay([.7, .01, f, 0, .05, .15, 0, 1, 100, 0, 0, 0, 0, 0]), i * 120))
}

export function playDefeat() {
  ;[400, 330, 280, 220].forEach((f, i) =>
    setTimeout(() => zzfxPlay([.7, .02, f, 0, .07, .2, 0, 1, -60, 0, 0, 0, 0, 0]), i * 150))
}

export function playButtonClick() {
  zzfxPlay([.5, .02, 1400, 0, 0, .04, 0, 1, 0, 0, 0, 0, 0, 0])
}

export function playBattleEvent() {
  zzfxPlay([.8, .05, 200, 0, .06, .22, 2, 1, -250, 0, 0, 0, 0, .25])
}

export function playCardFlip() {
  zzfxPlay([.5, .03, 700, 0, .01, .06, 2, 1, 600, 0, 0, 0, 0, .1])
}

export function playRestHeal() {
  ;[523, 659, 784].forEach((f, i) =>
    setTimeout(() => zzfxPlay([.55, .01, f, 0, .04, .15, 0, 1, 80, 0, 0, 0, 0, 0]), i * 100))
}

export function playManaGain() {
  zzfxPlay([.6, .01, 700, 0, .03, .14, 0, 1.5, 400, 0, 350, .05, 0, 0])
}

let _lastAttackSoundMs = 0
export function playUnitAttack() {
  const now2 = Date.now()
  if (now2 - _lastAttackSoundMs < 80) return
  _lastAttackSoundMs = now2
  zzfxPlay([.65, .1, 220, 0, .02, .09, 2, 1, -350, 0, 0, 0, 0, .38])
}

export function playBaseHit() {
  zzfxPlay([1, .03, 70, 0, .07, .38, 2, .4, -80, 0, 0, 0, 0, .65])
}

export function playBattleStart() {
  ;[220, 330, 440].forEach((f, i) =>
    setTimeout(() => zzfxPlay([.85, .02, f, .02, .08, .22, 2, 1.5, 0, 0, 0, 0, 0, .06]), i * 160))
}

export function playUpgrade() {
  ;[523, 659, 784, 1047].forEach((f, i) =>
    setTimeout(() => zzfxPlay([.65, .01, f, 0, .04, .12, 0, 1, 120, 0, 0, 0, 0, 0]), i * 70))
}

export function playMinigameCorrect() {
  zzfxPlay([.7, .01, 880, 0, .03, .18, 0, 1, 500, 0, 440, .07, 0, 0])
}

export function playMinigameWrong() {
  zzfxPlay([.7, .05, 240, 0, .05, .2, 2, 1, -400, 0, 0, 0, 0, .3])
}

export function playShopPurchase() {
  zzfxPlay([.75, .02, 1200, 0, .02, .2, 0, 1, 0, 0, 600, .04, 0, 0])
}

export function playFruitMachineSpin() {
  zzfxPlay([.45, .12, 180, 0, .01, .05, 4, 1, -100, 0, 0, 0, 0, 0])
}

export function playFruitMachineWin() {
  ;[523, 659, 784, 1047, 1318].forEach((f, i) =>
    setTimeout(() => zzfxPlay([.75, .01, f, 0, .04, .13, 0, 1, 150, 0, 0, 0, 0, 0]), i * 90))
}

export function playFruitMachineLose() {
  zzfxPlay([.65, .04, 440, 0, .08, .28, 0, 1, -500, 0, 0, 0, 0, .05])
}

export function playMapFootstep() {
  zzfxPlay([.35, .15, 100, 0, .01, .14, 0, 1, -80, 0, 0, 0, 0, .55])
}

let _lastHubStepMs = 0
export function playHubFootstep() {
  const now2 = Date.now()
  if (now2 - _lastHubStepMs < 180) return
  _lastHubStepMs = now2
  zzfxPlay([.25, .18, 120, 0, .01, .1, 0, 1, -60, 0, 0, 0, 0, .45])
}

export function playPickup() {
  zzfxPlay([.65, .01, 880, 0, .03, .18, 0, 1.5, 500, 0, 440, .06, 0, 0])
}

export function playTreasure() {
  zzfxPlay([.75, .01, 660, 0, .05, .28, 0, 1.5, 600, 0, 600, .08, 0, 0])
}

export function playDayNightChime() {
  zzfxPlay([.55, .01, 523, 0, .07, .55, 0, 2.5, 0, 0, 261, .12, 0, 0])
}

// ─── Animal vocalisations (hub critters) ──────────────────────────────────────

export function playDogBark() {
  // Two gruff barks: noisy sawtooth with pitch drop, envelope repeats for second bark
  zzfxPlay([1, .14, 160, 0, .06, .11, 2, .55, -350, 0, 0, 0, .22, .58])
}

export function playCatMeow() {
  // Pitch rises ("me") then drops via pitchJump ("ow")
  zzfxPlay([.85, .03, 480, .04, .1, .22, 0, 1.5, 900, 0, -240, .17, 0, .07])
}

export function playBirdChirp() {
  // Two quick high tweets via envelope repeat
  zzfxPlay([.65, .05, 2600, 0, .01, .04, 0, 1, 2500, 0, 0, 0, .1, 0])
}

export function playHenCluck() {
  // Two short clucks via envelope repeat
  zzfxPlay([.75, .12, 360, 0, .025, .07, 3, 1, -150, 0, 0, 0, .12, .38])
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
