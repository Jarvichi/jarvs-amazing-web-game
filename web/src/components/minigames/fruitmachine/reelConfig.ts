// Reel strips and symbol weights — static game config shared between
// FruitMachine's spin logic and its reel display.

export const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '⭐', '🔔', '💎', '🃏', '🌟', '💰']
export const WEIGHTS = [20, 25, 25, 25, 10, 5, 2, 5, 1, 5]

export const WILD = '🃏'
export const FEATURE = '🌟'
export const BONUS = '💰'

// Reel strip — fixed sequence for nudge up/down support
export const REEL_STRIP = [
  '🍒', '🍋', '🍊', '🍇', '⭐', '🔔', '💎', '🃏', '🌟', '💰',
  '🍒', '🍋', '🍊', '🍇', '⭐', '🔔', '💎', '🍒', '🌟', '💰',
  '🍒', '🍋', '🍊', '🍇', '⭐', '🔔', '💎', '🃏', '🍒', '💰',
]

// 4th "trail" reel — controls how many steps the feature board advances each spin
export const LADDER_SYMBOLS = ['+1', '+2', 'Lose', 'Stay', '-1', '-2'] as const
export type LadderSymbol = (typeof LADDER_SYMBOLS)[number]

// Standard weights; when jackpot reaches 10 000 the negative weights shift to positives
export const LADDER_WEIGHTS_NORMAL = [4, 2, 1, 87, 2, 4]
export const LADDER_WEIGHTS_HIGH   = [7, 5, 1, 87, 0, 0]  // -1/-2 removed, redistributed to +1/+2
export const JACKPOT_HIGH_THRESHOLD = 10_000
