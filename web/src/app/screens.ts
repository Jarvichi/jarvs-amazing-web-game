import type { StanceRules } from '../game/types'

export type { SubScreen } from '../components/screens/MiniGamesMenu'

/** Every screen the app can route to. `App` owns the current value; route groups read it. */
export type Screen =
  | 'intro'
  | 'title'
  | 'settings'
  | 'playing'
  | 'collection'
  | 'deckbuilder'
  | 'pack'
  | 'nodemap'
  | 'cutscene'
  | 'bossEpilogue'
  | 'bossdialogue'
  | 'event'
  | 'merchant'
  | 'mystery'
  | 'reward'
  | 'actcomplete'
  | 'cardrest'
  | 'starterpack'
  | 'relicselect'
  | 'inventory'
  | 'achievements'
  | 'hall-of-achievements'
  | 'campaignfailed'
  | 'heroCards'
  | 'battlesummary'
  | 'shop'
  | 'shop-cards'
  | 'shop-augments'
  | 'shop-supplies'
  | 'campaignvictory'
  | 'tobecontinued'
  | 'itemfound'
  | 'character'
  | 'replayBriefing'
  | 'dailychallenge'
  | 'weeklychallenge'
  | 'chronicle'
  | 'endlessleaderboard'
  | 'commander'
  | 'giftAdmin'
  | 'training'
  | 'news'
  | 'newsAdmin'
  | 'campaignAdmin'
  | 'feedbackAdmin'
  | 'townAccessAdmin'
  | 'minigames'
  | 'playerstats'
  | 'quickbattle'
  | 'carddraft'
  | 'statupgrade'
  | 'camp'
  | 'codex'
  | 'memory'
  | 'characterEncounter'
  | 'narratorJournal'
  | 'augments'
  | 'player'
  | 'collection-tabs'
  | 'home-shelf'
  | 'home-shelf-decorate'
  | 'hubworld'
  | 'hub-minigame'
  | 'hub-fishing'
  | 'hub-fishing-cave'
  | 'hub-fishing-lake'
  | 'hub-fishing-ocean'
  | 'hub-fish-appraisal'
  | 'casino'
  | 'theatre'
  | 'worldmap'
  | 'location'
  | 'sceneryPreview'

// Screens that opt into .game-container--wide (#2183) — ones with a grid
// or split layout that genuinely benefits from tablet/desktop width. Title,
// settings and other single-column screens are deliberately left out: for
// those, wide is worse, not better. See base.css's ".game-container--wide"
// comment for the breakpoint tiers this feeds into.
export const WIDE_SCREENS = new Set<Screen>(['collection', 'collection-tabs', 'deckbuilder'])

// Below this, a tab switch/app-switcher glance isn't worth a Rollbar breadcrumb —
// only log genuine "away for a while" returns.
export const VISIBILITY_BREADCRUMB_THRESHOLD_MS = 15_000

export const STANCE_RULES_BY_NODE_TYPE: Partial<Record<string, StanceRules>> = {
  // Normal battles: no restrictions (current behaviour)
  battle: undefined,
  // Elite: 15 s duration, 20 s cooldown — timing tactics matter
  elite: { allowed: ['auto', 'attack', 'hold', 'defend'], durationMs: 15_000, cooldownMs: 20_000 },
  // Boss: defend and auto only — must react to the boss, can't mass-charge
  boss: { allowed: ['auto', 'defend'] },
}
