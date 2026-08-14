// ─── Flavour lines for wandering hub-town NPCs ──────────────────────────────
//
// Wanderers are anonymous townsfolk, so unlike named NPCs they have no authored
// dialogue array in a town's config.json and no dialogue modal — tapping one
// pops a single cosmetic speech bubble and changes no game state. This used to
// draw on eight hardcoded lines shared by every NPC in every town, which a
// player exhausted in about a minute.
//
// Now there's a large generic pool plus smaller pools layered on by context
// (time of day, weather, whether the NPC is a ghost, and what they're doing).
// Each wanderer walks a seeded shuffle of the merged pool, so repeat taps on
// the same person keep producing new lines rather than looping a short list.
//
// Nothing here imports PIXI or reads storage — it's pure data plus a cursor, so
// it tests without a canvas.

import { hashStr, makeSeededRng, seededShuffle } from '../seededRandom'
import type { WeatherType } from './weather'

/** What the wanderer is doing when tapped. */
export type AmbientSituation =
  | 'street'    // out walking the town
  | 'arriving'  // just walked in from an exit tile, fresh off the road
  | 'doorway'   // standing at a building's door, about to head in
  | 'indoors'   // tapped inside a building they'd wandered into

export interface AmbientLineContext {
  isNight:   boolean
  weather:   WeatherType
  isGhost:   boolean
  situation: AmbientSituation
}

// ── Generic pool ────────────────────────────────────────────────────────────
// Everyday townsfolk chatter: errands, gossip, weather, opinions about the
// player's line of work. Kept short — the speech bubble wraps at 160px.

export const AMBIENT_LINES_GENERIC = [
  'Lovely day for it.',
  'Mind where you step.',
  "Can't stop to chat, sorry!",
  'Have you seen the notice board?',
  'Busy, busy — you know how it is.',
  'Watch yourself out there.',
  'Off to run an errand.',
  "I'll catch you later!",
  'Morning! Or afternoon. One of those.',
  "You're that duellist everyone talks about, aren't you?",
  'Heard the arena was packed last night.',
  'My cousin swears by a good wall. I say build two.',
  "Crystals don't spend themselves.",
  'Somebody left a cart in the middle of the road again.',
  'The bread here is better than it has any right to be.',
  "Don't buy the cheap packs. Learn from my mistakes.",
  'I keep meaning to take up fishing.',
  "There's a queue at the shop. There's always a queue.",
  'Nice cloak. Is that new?',
  "If you're looking for the inn, it's the loud one.",
  'I lost a whole afternoon at the card tables. Worth it.',
  'They say a dragon card turned up in a common pack. Rubbish, obviously.',
  "My knees say rain. My knees are usually right.",
  'Have you tried the stew? Do try the stew.',
  "Someone's chickens are loose. Again.",
  'The roads are safer than they were, I will say that.',
  "I've a bounty to hand in, if I can find the desk.",
  'Not from around here, are you?',
  'Everything costs double what it did last season.',
  "I'd help, but I've a delivery to make.",
  'Careful past the well. It gets slippery.',
  "You look like someone with somewhere to be.",
  'Best of luck out there. Genuinely.',
  'They repaired the fence at last. Only took a year.',
  "My deck's all structures. I know, I know.",
  'A good day for staying out of trouble.',
  "Did you hear? No? Never mind then.",
  'I owe the innkeeper money. Keep that between us.',
  "There's a card sharp working the square. Allegedly.",
  'My sister moved to the capital. Says it smells.',
  "You get used to the noise from the arena.",
  'Somebody ought to sweep this street.',
  "I've never won a single bounty. Not one.",
  'The theatre is doing that play again. The long one.',
  "Mind the puddle — deeper than it looks.",
  'They say the harbour master hoards relics.',
  "I only came out for bread. Now look at me.",
  'A merchant tried to sell me a cursed amulet. Tried.',
  "Everyone's a strategist until the mana runs out.",
  'Have a good one!',
  "I'm told the pet shelter has kittens again.",
  'You should see this place during a festival.',
  "Ask the elder. He knows things. Some of them true.",
  'My neighbour plays nothing but goblins. Nothing.',
  "That's a fine looking companion you've got there.",
  'Prices at the augment shop are daylight robbery.',
  "I keep hearing something under the floorboards.",
  'Careful who you trade with down by the docks.',
  "Been meaning to fix that gate for weeks.",
  'You lot make it look easy, you duellists.',
  "There's a trick to the casino. I haven't found it.",
  'Long day. Long week, really.',
  "I saw a rare card once. Held it and everything.",
  'They reckon the campaign is going well. They always reckon that.',
  "Nothing ever happens here. Which is fine by me.",
  'I could sleep for a week.',
  "You didn't hear it from me, but the shop restocks at dawn.",
  'The mason wants three hundred crystals. Three hundred!',
  "Every year the winters get longer.",
  'Watch the cobbles by the fountain, they lift.',
  "My boy wants to be a commander. I've told him.",
  'Somebody stole my washing off the line.',
  "There's talk of bandits on the north road. Talk, mind.",
  'I did try the arena once. Once was plenty.',
  "The blacksmith's apprentice is better than the blacksmith.",
  'Good to see a friendly face.',
  "I've walked this square ten thousand times.",
  "Coin in, coin out. That's the trade.",
  "You're braver than me, and I'm not being polite.",
  'They keep promising a new well.',
  "I sold a relic for a song. Still think about it.",
  'Careful, the herald bites. Figuratively.',
  "There's a decent forage spot past the trees.",
  'Do you ever just stop and look at the sky?',
  "I hear the theatre pays well if you can act.",
  "Nobody reads the notice board. I read the notice board.",
  'That was a good harvest, all things considered.',
  "You'd think they'd pave the whole square.",
  'I traded my best card for a hat. No regrets.',
  "Something's off about that new shop.",
  'The guards are useless but they mean well.',
  "I'm not lost. I'm taking the long way.",
  'Bit of exercise never hurt anyone.',
  "My luck at the tables is legendary. Badly legendary.",
  'They say the old keep is haunted. They say a lot.',
  "I'd invite you in, but the place is a state.",
  'Ever tried building a farm first? Changes everything.',
  "You can smell the forge from here.",
  'One of these days I will learn to swim.',
  "The cartographer charges by the mile. The mile!",
  'Nice to see the streets busy again.',
  "I've a cousin in every town, if you can believe it.",
  'Just off to feed the chickens.',
  "That bell rings at the strangest hours.",
  'Fair trade is the only trade.',
  "Do you know, I've never left this valley.",
  'Somebody give that dog a home.',
  "Mind how you go.",
  'I heard they found something in the ruins.',
  "The market's thin this week.",
  "Whole town turns out when there's a duel.",
  "I'd rather mend a fence than fight a troll.",
  'You want the shop with the blue door, not the green.',
  "Been on my feet since dawn.",
  'They still owe me for last month.',
  "Quiet is underrated, I always say.",
  "If you find a lost key, it's mine.",
  "The kids have been drawing on the walls again.",
  'Pleasure. Truly.',
]

// ── Context pools ───────────────────────────────────────────────────────────

export const DAY_LINES = [
  'Good light today. Makes a difference.',
  "The market's open, if you're quick.",
  'Everyone out at once, as usual.',
  "I've a full day ahead of me.",
  'Shop opens on the hour, not before.',
  'Washing out, sun up. Perfect.',
  "The square's lovely this time of day.",
  'Off to work. As one is.',
  'Half the town is queuing for something.',
  "Best get on before the crowds.",
  'Deliveries all morning. My back knows it.',
  "Fine day to be outdoors, wouldn't you say?",
]

export const NIGHT_LINES = [
  "Late to be wandering, isn't it?",
  "I'd be home by now if I had any sense.",
  'The lamps need trimming again.',
  "Don't go past the walls after dark.",
  'Quiet, this hour. I like it.',
  "Something's been howling out east.",
  'Watch is late. Watch is always late.',
  "Can't sleep. Never can.",
  'The inn is the only place still lit.',
  "Mind the steps, you'll not see them.",
  'Everything looks different at night.',
  "I heard footsteps behind me. Twice.",
  'Nearly walked into you there.',
  "Stars are out, at least.",
  'Only fools and duellists are up this late.',
  "I'll not be out here long, I promise you that.",
]

export const RAIN_LINES = [
  'Soaked through, and it is only midday.',
  "Told you my knees were right.",
  'Rain like this ruins a good cloak.',
  "The gutters can't take it.",
  'Third day of this. Third!',
  "Good weather for ducks and nobody else.",
  'I left the washing out. I know. I know.',
  "Mind the puddles, they're deeper than they look.",
]

export const SNOW_LINES = [
  "Can't feel my hands.",
  'Snow this early is a bad sign.',
  "The road north will be shut by morning.",
  'Pretty until you have to walk in it.',
  "We'll be burning furniture by midwinter.",
  'Kids love it. Nobody else does.',
  "Careful, there's ice under that.",
  'I have three coats on and it is not enough.',
]

export const FOG_LINES = [
  "Can't see the far side of the square.",
  'I walked into a cart. A whole cart.',
  "Fog like this, anything could be out there.",
  'Sounds carry strangely in it.',
  "Is that you? It is you. Good.",
  'I do not like fog. Never have.',
  "Stay on the path and you'll be fine.",
  'It burns off by noon. Usually.',
]

export const GHOST_LINES = [
  'Cold… so cold…',
  "Have you seen my house? It was here…",
  'I only meant to stay one more night…',
  "…is it still autumn?",
  'Nobody remembers the name.',
  "I keep walking the same street…",
  'Do you hear the bell too?',
  "I was owed money. I am still owed money.",
  'Something took the long road with me…',
  "…you can see me?",
  'The door was open. It should not have been open.',
  "Tell them I got home. Tell them.",
]

export const ARRIVAL_LINES = [
  'Just off the road — what a journey.',
  "First time in this town. Where's the inn?",
  'Three days of walking. Three.',
  "Somewhere to sleep, that's all I want.",
  'Is the market still open?',
  "I've come a long way. Longer than planned.",
  'Roads were quieter than I expected.',
  "New town, same aching feet.",
  'Do they take outside coin here?',
  "Point me at the nearest hot meal.",
]

export const DOORWAY_LINES = [
  'Just popping in.',
  "Hope they're still serving.",
  'After you — no, go on.',
  "I'll only be a moment.",
  'Told them I would be here at noon.',
  "Wish me luck in there.",
  'This had better be open.',
  "Mind the step on the way in.",
]

export const INDOOR_LINES = [
  'Warmer in here, at least.',
  "Been waiting ages to be served.",
  'They know me here.',
  "Do you know what you're ordering?",
  'I come in mostly for the quiet.',
  "Prices went up again. Of course they did.",
  'Shake the rain off before you come further in.',
  "I'll be out of your way in a moment.",
  'Best seat in the place, this.',
  "Don't tell them I'm here.",
]

/** Scared reactions when a ghost drifts too close — kept separate from the tap
 *  pools so a fright never clobbers a tap line, or vice versa. */
export const SCARED_PHRASES = [
  'Did you see that?!', 'Is someone there…?', 'Something is wrong…',
  'A ghost!! A ghost!!', 'Did it just get cold?', 'Please no please no',
  'What was THAT?!', "I can't feel my legs…", 'Run!! RUN!!',
  'That was not a person.', 'I am going home. Right now.',
  'Tell me you saw it too!', 'Nope. Nope. Nope.',
  'It went straight through the wall!',
]

// ── Pool assembly ───────────────────────────────────────────────────────────

const WEATHER_LINES: Record<WeatherType, string[]> = {
  clear: [],
  rain:  RAIN_LINES,
  snow:  SNOW_LINES,
  fog:   FOG_LINES,
}

const SITUATION_LINES: Record<AmbientSituation, string[]> = {
  street:   [],
  arriving: ARRIVAL_LINES,
  doorway:  DOORWAY_LINES,
  indoors:  INDOOR_LINES,
}

/**
 * The lines a wanderer can say in this context. Ghosts speak only their own
 * pool — a ghost complaining about bread prices undercuts the whole effect.
 * Everyone else gets the generic pool plus whatever context applies; weather
 * lines are dropped indoors, where the speaker can't see the sky.
 */
export function ambientLinePool(ctx: AmbientLineContext): string[] {
  if (ctx.isGhost) return GHOST_LINES
  const pool = [
    ...AMBIENT_LINES_GENERIC,
    ...(ctx.isNight ? NIGHT_LINES : DAY_LINES),
    ...SITUATION_LINES[ctx.situation],
  ]
  if (ctx.situation !== 'indoors') pool.push(...WEATHER_LINES[ctx.weather])
  return pool
}

/** Identifies a context for cache purposes — when this changes, a wanderer's
 *  queue is rebuilt so the new pool actually gets used. */
export function contextKey(ctx: AmbientLineContext): string {
  return `${ctx.isGhost ? 'g' : '-'}${ctx.isNight ? 'n' : 'd'}:${ctx.weather}:${ctx.situation}`
}

/** A wanderer's position in its personal shuffle of the pool. */
export interface AmbientLineCursor {
  queue: string[]
  idx:   number
  key:   string
}

export function makeAmbientLineCursor(seed: number | string, ctx: AmbientLineContext): AmbientLineCursor {
  const s = typeof seed === 'number' ? seed : hashStr(seed)
  return {
    queue: seededShuffle(ambientLinePool(ctx), makeSeededRng(s ^ 0xd1a109)),
    idx:   0,
    key:   contextKey(ctx),
  }
}

/**
 * The wanderer's next line, advancing (and where needed rebuilding) its cursor.
 * Reshuffles on wrap rather than replaying the same order forever, and never
 * repeats the line that just ended the previous pass.
 */
export function nextAmbientLine(
  cursor: AmbientLineCursor,
  seed: number | string,
  ctx: AmbientLineContext,
): string {
  const s = typeof seed === 'number' ? seed : hashStr(seed)
  const key = contextKey(ctx)
  if (key !== cursor.key || cursor.queue.length === 0) {
    const fresh = makeAmbientLineCursor(s, ctx)
    cursor.queue = fresh.queue
    cursor.idx   = 0
    cursor.key   = key
  } else if (cursor.idx >= cursor.queue.length) {
    const last = cursor.queue[cursor.queue.length - 1]
    let reshuffled = seededShuffle(cursor.queue, makeSeededRng((s ^ 0xd1a109) + cursor.queue.length))
    if (reshuffled.length > 1 && reshuffled[0] === last) {
      reshuffled = [reshuffled[1], reshuffled[0], ...reshuffled.slice(2)]
    }
    cursor.queue = reshuffled
    cursor.idx   = 0
  }
  return cursor.queue[cursor.idx++]
}
