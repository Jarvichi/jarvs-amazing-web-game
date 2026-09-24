// ─── /chase: the five cases ─────────────────────────────────────────────────
//
// Each case is a looping road (built from pieces), a colour theme, roadside
// scenery, and the car you are after. All names, cars and places are
// original to this game.

import { buildTrack, type Piece, type PropKind, type Track } from './road'

export type Skyline = 'city' | 'hills' | 'mesa' | 'forest' | 'neon'

export interface Theme {
  sky: [string, string]
  /** Colour the far road fades into. */
  fog: string
  grass: [string, string]
  rumble: [string, string]
  road: [string, string]
  lane: string
  skyline: Skyline
  /** Skyline silhouette colours: far layer, near layer. */
  hills: [string, string]
  night: boolean
  /** Scenery placed along the roadside, picked at random. */
  props: PropKind[]
  /** Chance per segment of a roadside prop. */
  density: number
}

export type TargetKind = 'van' | 'coupe' | 'muscle' | 'pickup' | 'super'

export interface Case {
  title: string
  /** Dispatch briefing lines (3×5 font, keep them short). */
  brief: string[]
  theme: Theme
  target: TargetKind
  /** Target's cruising speed as a fraction of the player's top speed. */
  targetSpeed: number
  /** Head start, world units. */
  startGap: number
  /** Seconds to reach the target, then to stop it. */
  pursuitTime: number
  arrestTime: number
  /** Ram damage multiplier: tougher cars take longer to stop. */
  armour: number
  /** Traffic cars kept around the player. */
  traffic: number
  track: Track
}

const straight = (n: number, hill = 0): Piece => ({ enter: 10, hold: n, leave: 10, hill })
const bend = (n: number, curve: number, hill = 0): Piece => ({ enter: 20, hold: n, leave: 20, curve, hill })

function decorate(track: Track, theme: Theme, seed: number): Track {
  let s = seed
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
  const pick = () => theme.props[Math.floor(rnd() * theme.props.length)]
  for (const seg of track.segs) {
    if (seg.forkId >= 0) {
      // The median between branches: chevrons at its nose, scenery after.
      if (seg.fork > 0.72 && seg.fork < 0.8) seg.props.push({ kind: 'chevron', x: 0 })
      else if (seg.fork >= 0.99 && seg.index % 6 === 0) seg.props.push({ kind: 'bush', x: 0 })
      if (seg.index % 8 === 0) {
        seg.props.push({ kind: pick(), x: -(2.2 + rnd()) }, { kind: pick(), x: 2.2 + rnd() })
      }
      continue
    }
    if (seg.index % 20 === 0) seg.props.push({ kind: 'lamp', x: seg.index % 40 === 0 ? -1.25 : 1.25 })
    if (rnd() < theme.density) {
      const side = rnd() < 0.5 ? -1 : 1
      seg.props.push({ kind: pick(), x: side * (1.35 + rnd() * 1.4) })
    }
    if (seg.index % 150 === 75) seg.props.push({ kind: 'billboard', x: seg.index % 300 < 150 ? -1.6 : 1.6 })
  }
  return track
}

const DUSK: Theme = {
  sky: ['#2a1b4a', '#ff7a4a'], fog: '#7a4a6a',
  grass: ['#3c5a32', '#35512c'], rumble: ['#c2c3c7', '#ff004d'], road: ['#5f574f', '#58514a'], lane: '#fff1e8',
  skyline: 'city', hills: ['#4a2e5a', '#2a1b3a'], night: false,
  props: ['palm', 'palm', 'block', 'sign', 'bush'], density: 0.35,
}
const NIGHT: Theme = {
  sky: ['#05060f', '#1d2b53'], fog: '#1d2b53',
  grass: ['#141a26', '#10151f'], rumble: ['#c2c3c7', '#29adff'], road: ['#2b2c33', '#27282e'], lane: '#ffec27',
  skyline: 'city', hills: ['#141c36', '#0b1020'], night: true,
  props: ['tower', 'block', 'lamp', 'sign'], density: 0.4,
}
const DESERT: Theme = {
  sky: ['#29adff', '#ffccaa'], fog: '#e8b88a',
  grass: ['#e0a060', '#d49454'], rumble: ['#fff1e8', '#ab5236'], road: ['#7a6a5a', '#736352'], lane: '#fff1e8',
  skyline: 'mesa', hills: ['#c0704a', '#ab5236'], night: false,
  props: ['cactus', 'cactus', 'rock', 'sign'], density: 0.3,
}
const FOREST: Theme = {
  sky: ['#5f7a8c', '#c2c3c7'], fog: '#8a9a9c',
  grass: ['#1e5a32', '#1a5030'], rumble: ['#fff1e8', '#008751'], road: ['#4a4a52', '#45454c'], lane: '#fff1e8',
  skyline: 'forest', hills: ['#3a5a4a', '#224a36'], night: false,
  props: ['pine', 'pine', 'pine', 'rock', 'bush'], density: 0.55,
}
const NEON: Theme = {
  sky: ['#12001e', '#7e2553'], fog: '#3a0f3a',
  grass: ['#16081e', '#12061a'], rumble: ['#ff77a8', '#29adff'], road: ['#241c2c', '#211a28'], lane: '#ff77a8',
  skyline: 'neon', hills: ['#2a0f3a', '#16081e'], night: true,
  props: ['neon', 'tower', 'neon', 'block'], density: 0.45,
}

export const CASES: Case[] = [
  {
    title: 'CASE 1: THE VAN MAN',
    brief: ['A DELIVERY VAN JUST ROBBED', 'THE HARBOUR MARKET.', 'HE IS HEADING FOR THE COAST ROAD.', 'GO GET HIM, ROOKIE.'],
    theme: DUSK, target: 'van', targetSpeed: 0.78, startGap: 105000, pursuitTime: 60, arrestTime: 60, armour: 1.3, traffic: 9,
    track: decorate(buildTrack([
      straight(40), bend(40, 2), straight(30, 20), bend(50, -3), straight(20), { fork: 'left' },
      bend(40, 3, -20), straight(40), bend(30, -2, 30), straight(30, -30), bend(40, 4), straight(30),
    ]), DUSK, 11),
  },
  {
    title: 'CASE 2: RED LIGHTNING',
    brief: ['A RED COUPE IS RACING', 'STOLEN CHIPS TO THE BORDER.', 'SHE IS QUICK. USE YOUR TURBO', 'WHEN THE ROAD OPENS UP.'],
    theme: NIGHT, target: 'coupe', targetSpeed: 0.84, startGap: 90000, pursuitTime: 60, arrestTime: 60, armour: 1.1, traffic: 11,
    track: decorate(buildTrack([
      straight(30), bend(40, -3), bend(40, 3), straight(40, 30), { fork: 'right' }, bend(50, -4, -30),
      straight(20), bend(30, 5), straight(40), { fork: 'left' }, bend(40, -3), straight(30),
    ]), NIGHT, 23),
  },
  {
    title: 'CASE 3: DUST DEVIL',
    brief: ['A MUSCLE CAR GANG LEADER', 'IS RUNNING THROUGH THE DESERT.', 'WATCH THE HILLS. YOU CANNOT', 'SEE WHAT IS OVER THE TOP.'],
    theme: DESERT, target: 'muscle', targetSpeed: 0.87, startGap: 82000, pursuitTime: 62, arrestTime: 60, armour: 0.9, traffic: 9,
    track: decorate(buildTrack([
      straight(30, 40), straight(30, -40), bend(40, 3, 30), straight(20, -30), { fork: 'right' },
      bend(50, -4, 50), straight(30, -50), bend(40, 5), straight(20, 40), straight(20, -40), { fork: 'left' }, straight(30),
    ]), DESERT, 37),
  },
  {
    title: 'CASE 4: TIMBER WOLF',
    brief: ['A PICKUP FULL OF STOLEN', 'GOLD IS TEARING UP THE', 'FOREST ROAD. IT IS BUILT TOUGH.', 'HIT IT HARD AND OFTEN.'],
    theme: FOREST, target: 'pickup', targetSpeed: 0.86, startGap: 85000, pursuitTime: 62, arrestTime: 65, armour: 0.65, traffic: 10,
    track: decorate(buildTrack([
      bend(40, 4), bend(40, -4, 20), straight(20), bend(30, 6, -20), { fork: 'left' }, bend(50, -5),
      straight(30, 30), bend(40, 5, -30), { fork: 'right' }, bend(30, -6), straight(20),
    ]), FOREST, 41),
  },
  {
    title: 'CASE 5: THE PHANTOM',
    brief: ['NOBODY HAS EVER CAUGHT', 'THE PHANTOM AND HIS SUPERCAR.', 'THIS IS IT, DETECTIVE.', 'BRING HIM IN.'],
    theme: NEON, target: 'super', targetSpeed: 0.92, startGap: 66000, pursuitTime: 65, arrestTime: 65, armour: 0.75, traffic: 12,
    track: decorate(buildTrack([
      straight(30), bend(40, 5), bend(40, -5, 30), { fork: 'right' }, straight(20, -30), bend(40, 6),
      { fork: 'left' }, bend(40, -6, 40), straight(30, -40), { fork: 'right' }, bend(40, 4), straight(20),
    ]), NEON, 53),
  },
]
