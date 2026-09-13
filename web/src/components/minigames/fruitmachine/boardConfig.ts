// Feature board layout and jackpot tiers — static game config shared between
// FruitMachine's game logic and its board/jackpot display components.

export type BoardNodeType = 'credit' | 'multiplier' | 'extra-spin' | 'nudge' | 'bonus-game' | 'jackpot-mini' | 'jackpot-major' | 'jackpot-grand'
export interface BoardNode { type: BoardNodeType; label: string; value?: number }

export interface BoardWindowEntry { idx: number; node: BoardNode; isCurrent: boolean }

export const JACKPOT_TIERS = [
  { name: 'Mini', credits: 10, progressive: false, base: 10 },
  { name: 'Minor', credits: 25, progressive: false, base: 25 },
  { name: 'Major', credits: 50, progressive: false, base: 50 },
  { name: 'Grand', credits: 0, progressive: true, base: 500 },
] as const

export const BOARD_NODES: BoardNode[] = [
  { type: 'credit', label: '+5cr', value: 5 },
  { type: 'extra-spin', label: 'FREE' },
  { type: 'multiplier', label: '×2', value: 2 },
  { type: 'credit', label: '+8cr', value: 8 },
  { type: 'nudge', label: 'NUDGE', value: 1 },
  { type: 'credit', label: '+3cr', value: 3 },
  { type: 'jackpot-mini', label: 'MINI 💰' },
  { type: 'credit', label: '+10cr', value: 10 },
  { type: 'multiplier', label: '×3', value: 3 },
  { type: 'extra-spin', label: 'FREE' },
  { type: 'credit', label: '+5cr', value: 5 },
  { type: 'bonus-game', label: 'BONUS' },
  { type: 'credit', label: '+12cr', value: 12 },
  { type: 'nudge', label: 'NUDGE×2', value: 2 },
  { type: 'multiplier', label: '×2', value: 2 },
  { type: 'credit', label: '+6cr', value: 6 },
  { type: 'jackpot-major', label: 'MAJOR 🏆' },
  { type: 'extra-spin', label: 'FREE' },
  { type: 'credit', label: '+15cr', value: 15 },
  { type: 'credit', label: '+5cr', value: 5 },
  { type: 'extra-spin', label: 'FREE' },
  { type: 'multiplier', label: '×2', value: 2 },
  { type: 'credit', label: '+8cr', value: 8 },
  { type: 'nudge', label: 'MEGA NUDGE', value: 5 },
  { type: 'credit', label: '+3cr', value: 3 },
  { type: 'jackpot-mini', label: 'MINI 💰' },
  { type: 'credit', label: '+10cr', value: 10 },
  { type: 'multiplier', label: '×3', value: 3 },
  { type: 'extra-spin', label: 'FREE' },
  { type: 'credit', label: '+5cr', value: 5 },
  { type: 'bonus-game', label: 'BONUS' },
  { type: 'credit', label: '+12cr', value: 12 },
  { type: 'nudge', label: 'ULTRA NUDGE', value: 10 },
  { type: 'multiplier', label: '×2', value: 2 },
  { type: 'credit', label: '+6cr', value: 6 },
  { type: 'jackpot-major', label: 'MAJOR 🏆' },
  { type: 'extra-spin', label: 'FREE' },
  { type: 'credit', label: '+15cr', value: 15 },
  { type: 'jackpot-grand', label: 'GRAND ⭐' },
]

export const BOARD_SIZE = BOARD_NODES.length
