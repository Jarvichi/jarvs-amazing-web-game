// ─── Arcade: the games on the /arcade index ─────────────────────────────────
//
// One entry per standalone arcade page. Adding a game here puts a cabinet on
// the index; games.test.ts checks its page is registered everywhere a new
// page must be (see vite.config.ts and public/404.html).

export type Scene = 'platform' | 'shooter' | 'racer' | 'missile'

export interface ArcadeGame {
  /** Page path, also its Vite input name without the slash. */
  path: string
  title: string
  blurb: string
  /** localStorage key the game keeps its hi-score under. */
  hiscoreKey: string
  scene: Scene
  /** Title colour (palette index). */
  colour: number
}

export const GAMES: ArcadeGame[] = [
  {
    path: '/retro', title: 'PIXEL PETE', blurb: 'RUN AND JUMP THROUGH THREE WORLDS',
    hiscoreKey: 'jawg-retro-hiscore', scene: 'platform', colour: 10,
  },
  {
    path: '/shmup', title: 'BIOBLAST', blurb: 'A VOYAGE INTO THE BEAST',
    hiscoreKey: 'jawg-shmup-hiscore', scene: 'shooter', colour: 11,
  },
  {
    path: '/chase', title: 'PURSUIT 84', blurb: 'FIVE CASES, ONE CAR',
    hiscoreKey: 'jawg-chase-hiscore', scene: 'racer', colour: 8,
  },
  {
    path: '/defend', title: 'LAST LINE', blurb: 'HOLD THE SKY. SAVE THE CITIES',
    hiscoreKey: 'jawg-defend-hiscore', scene: 'missile', colour: 12,
  },
]

/** Next card for arrow-key / gamepad navigation, wrapping round. */
export const step = (i: number, by: number, n = GAMES.length) => (i + by + n) % n
