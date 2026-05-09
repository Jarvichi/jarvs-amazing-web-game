// ─── Fruit Machine ────────────────────────────────────────────────────────────
// 3-reel slot machine plus a 4th "trail" reel that controls feature-board steps.
// Spin costs 1 credit; hold reels between spins.
// Cash out at any time to convert remaining credits to tickets (2 per credit).
// Buy +5 credits for 25 crystals when running low.
//
// Special symbols:
//   🃏 Wild    — substitutes for any standard symbol; triple-wild pays 40 credits
//   🌟 Feature — accumulates toward a feature bonus; at 5 triggers: +15 credits
//   💰 Bonus   — scatter: 2+ anywhere pays 4 credits; 3 pays 15 credits
//
// Trail reel (4th reel) controls board advancement each spin:
//   +1 (~1/25) — advance board by 1
//   +2 (~1/50) — advance board by 2
//   Lose (~1/100) — retreat board by 1
//   Stay (rest) — no board movement

import React, { useState, useRef, useEffect } from 'react'
import { emitSound } from '../../game/sound'
import { loadCrystals, saveCrystals } from '../../game/collection'
import { logError } from '../../logger'
import {
  fetchGrandJackpot,
  incrementGrandJackpot,
  claimAndResetGrandJackpot,
  publishGrandJackpotWin,
} from '../../game/fruitMachineJackpot'
import { loadPlayerName } from '../../game/questline'
import { LedScroller, LedScrollerMessage } from '../LedScroller'

interface Props {
  onDone: (ticketsEarned: number) => void
}

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '⭐', '🔔', '💎', '🃏', '🌟', '💰']
const WEIGHTS = [20, 25, 25, 25, 10, 5, 2, 5, 1, 5]

const WILD = '🃏'
const FEATURE = '🌟'
const BONUS = '💰'

const STARTING_CREDITS = 10
const BUY_COST = 25   // crystals to buy more credits
const BUY_AMOUNT = 5    // credits per purchase
const MAX_CREDITS = 20   // cap on held credits
const TICKETS_PER_CREDIT = 2
const SPIN_DURATION_MS = 1200
const FEATURE_THRESHOLD = 5    // feature triggers needed for bonus
const FEATURE_BONUS_CREDITS = 15  // credits awarded when feature fires
const LOSER_THRESHOLD = 5    // 'Lose' hits needed to light full LOSER word
const LOSER_JUMP_POS = 35    // board position jumped to on full LOSER word

const JACKPOT_TIERS = [
  { name: 'Mini', credits: 10, progressive: false, base: 10 },
  { name: 'Minor', credits: 25, progressive: false, base: 25 },
  { name: 'Major', credits: 50, progressive: false, base: 50 },
  { name: 'Grand', credits: 0, progressive: true, base: 500 },
] as const

type BoardNodeType = 'credit' | 'multiplier' | 'extra-spin' | 'nudge' | 'bonus-game' | 'jackpot-mini' | 'jackpot-major' | 'jackpot-grand'
interface BoardNode { type: BoardNodeType; label: string; value?: number }

const BOARD_NODES: BoardNode[] = [
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

const BOARD_SIZE = BOARD_NODES.length

// Reel strip — fixed sequence for nudge up/down support
const REEL_STRIP = [
  '🍒', '🍋', '🍊', '🍇', '⭐', '🔔', '💎', '🃏', '🌟', '💰',
  '🍒', '🍋', '🍊', '🍇', '⭐', '🔔', '💎', '🍒', '🌟', '💰',
  '🍒', '🍋', '🍊', '🍇', '⭐', '🔔', '💎', '🃏', '🍒', '💰',
]

function pickSymbol(): string {
  let r = Math.random() * WEIGHTS.reduce((s, w) => s + w, 0)
  for (let i = 0; i < SYMBOLS.length; i++) {
    r -= WEIGHTS[i]
    if (r <= 0) return SYMBOLS[i]
  }
  return SYMBOLS[SYMBOLS.length - 1]
}

function pickReelPos(): number {
  return Math.floor(Math.random() * REEL_STRIP.length)
}

// 4th "trail" reel — controls how many steps the feature board advances each spin
const LADDER_SYMBOLS = ['+1', '+2', 'Lose', 'Stay', '-1', '-2'] as const
// Standard weights; when jackpot reaches 10 000 the negative weights shift to positives
const LADDER_WEIGHTS_NORMAL = [4, 2, 1, 87, 2, 4]
const LADDER_WEIGHTS_HIGH   = [7, 5, 1, 87, 0, 0]  // -1/-2 removed, redistributed to +1/+2
const JACKPOT_HIGH_THRESHOLD = 10_000
type LadderSymbol = (typeof LADDER_SYMBOLS)[number]

function pickLadderSymbol(jackpot: number): LadderSymbol {
  const weights = jackpot >= JACKPOT_HIGH_THRESHOLD ? LADDER_WEIGHTS_HIGH : LADDER_WEIGHTS_NORMAL
  let r = Math.random() * 100
  for (let i = 0; i < LADDER_SYMBOLS.length; i++) {
    r -= weights[i]
    if (r <= 0) return LADDER_SYMBOLS[i]
  }
  return 'Stay'
}

// When the player is at the bottom of the board (pos < 2), backwards steps make no
// sense — flip -1/-2 into +1/+2 so the player always gets forward movement.
function adjustLadderForBoardPos(symbol: LadderSymbol, pos: number): LadderSymbol {
  if (pos < 2 && (symbol === '-1' || symbol === '-2')) {
    return symbol === '-1' ? '+1' : '+2'
  }
  return symbol
}

// Base payout for a 3-symbol line — no wilds, bonus handled separately
function calcPayoutBase(s: [string, string, string]): number {
  const [a, b, c] = s
  if (a === b && b === c) {
    if (a === '💎') return 50
    if (a === '⭐') return 30
    if (a === '🔔') return 20
    return 10
  }
  if (a === b || b === c || a === c) {
    const doubled = a === b ? a : b === c ? b : a
    if (doubled === '💎') return 5
    if (doubled === '⭐') return 3
    return 2
  }
  if (a === '🍒') return 1  // cherry consolation on first reel
  return 0
}

type WinType = 'wild' | 'bonus' | 'feature' | null


export function FruitMachine({ onDone }: Props) {
  const [reels, setReels] = useState<[string, string, string]>(() => [pickSymbol(), pickSymbol(), pickSymbol()])
  const [display, setDisplay] = useState<[string, string, string]>(() => [pickSymbol(), pickSymbol(), pickSymbol()])
  const [ladderDisplay, setLadderDisplay] = useState<LadderSymbol>('Stay')
  const [held, setHeld] = useState<[boolean, boolean, boolean]>([false, false, false])
  const [recentlyHeld, setRecentlyHeld] = useState<[boolean, boolean, boolean]>([false, false, false])
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'board-moving' | 'nudge' | 'bonus' | 'jackpot-win' | 'lucky' | 'done'>('idle')
  const [credits, setCredits] = useState(STARTING_CREDITS)
  const [lastWin, setLastWin] = useState<number | null>(null)
  const [cashOutTickets, setCashOutTickets] = useState(0)
  const [availCrystals, setAvailCrystals] = useState(() => loadCrystals())
  const [featureTriggerCount, setFeatureTriggerCount] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('fm_trail') ?? '0', 10) } catch { return 0 }
  })
  const [loserCount, setLoserCount] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('fm_loser') ?? '0', 10) } catch { return 0 }
  })
  const [grandJackpot, setGrandJackpot] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('fm_grand') ?? '500', 10) } catch { return 500 }
  })
  const [jackpotWon, setJackpotWon] = useState<{ tier: string; amount: number } | null>(null)
  const [boardPos, setBoardPos] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('fm_board_pos') ?? '0', 10) } catch { return 0 }
  })
  const [boardMult, setBoardMult] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('fm_board_mult') ?? '1', 10) } catch { return 1 }
  })
  const [boardMessage, setBoardMessage] = useState<string | null>(null)
  const [freeSpin, setFreeSpin] = useState(false)
  const [nudgesAvailable, setNudgesAvailable] = useState(0)
  const [reelPositions, setReelPositions] = useState<[number, number, number]>([0, 3, 6])
  const [bonusTiles, setBonusTiles] = useState<Array<{ value: number; collect: boolean; revealed: boolean }>>([])
  const [bonusPicksLeft, setBonusPicksLeft] = useState(0)
  const [bonusTotalWin, setBonusTotalWin] = useState(0)
  const [spinCount, setSpinCount] = useState<1 | 5 | 10 | 25 | 50>(1)
  const [autoSpinsLeft, setAutoSpinsLeft] = useState(0)

  const [messages, setMessages] = useState([] as LedScrollerMessage[])

  const spinningRef = useRef<[boolean, boolean, boolean]>([false, false, false])
  const ladderSpinRef = useRef(false)
  const luckyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentLadderRef = useRef<LadderSymbol>('Stay')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const featureCountRef = useRef(featureTriggerCount)
  const loserCountRef = useRef(loserCount)
  const grandJackpotRef = useRef(grandJackpot)
  const boardPosRef = useRef(boardPos)
  const boardMultRef = useRef(boardMult)
  const pendingBoardNodeRef = useRef<BoardNode | null>(null)
  const autoSpinsLeftRef = useRef(0)
  const spinRef = useRef<() => void>(() => {})

  // Sync display with reels on first mount
  useEffect(() => {
    setDisplay([...reels] as [string, string, string])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  function updateGrandJackpot(amount: number = 1) {
    // Grand jackpot grows by the specified amount every spin — increment server-side and mirror locally
    const newGrand = grandJackpotRef.current + amount
    grandJackpotRef.current = newGrand
    setGrandJackpot(newGrand)
    try { localStorage.setItem('fm_grand', String(newGrand)) } catch (e) { logError('fm_grand save', { error: String(e) }) }
    incrementGrandJackpot(amount)
    setBoardMessage(`Grand jackpot up by ${amount}! Now ${newGrand} credits!`)
  }

  function calcPayout(s: [string, string, string]): { credits: number; winType: WinType } {
    // Scatter: 2+ Bonus symbols anywhere pay regardless of position
    const bonusCount = s.filter(x => x === BONUS).length
    if (bonusCount >= 2) {
      return { credits: bonusCount === 3 ? 15 : 4, winType: 'bonus' }
    }

    updateGrandJackpot(bonusCount * 10)  // Each Bonus symbol adds 10 to the Grand jackpot

    const wildCount = s.filter(x => x === WILD).length

    // Triple wild pays a fixed jackpot
    if (wildCount === 3) return { credits: 40, winType: 'wild' }

    if (wildCount > 0) {
      // Substitute each Wild with the best-matching standard symbol
      const nonWild = s.filter(x => x !== WILD && x !== FEATURE && x !== BONUS)
      if (nonWild.length === 0) return { credits: 0, winType: null }
      const candidates = [...new Set(nonWild)]
      let best = 0
      for (const sub of candidates) {
        const subbed = s.map(x => x === WILD ? sub : x) as [string, string, string]
        const pay = calcPayoutBase(subbed)
        if (pay > best) best = pay
      }
      return { credits: best, winType: best > 0 ? 'wild' : null }
    }

    return { credits: calcPayoutBase(s), winType: null }
  }

  // Fetch live grand jackpot from Firestore on mount, then poll every 30 s
  useEffect(() => {
    let cancelled = false
    function refresh() {
      fetchGrandJackpot().then(val => {
        if (cancelled) return
        grandJackpotRef.current = val
        setGrandJackpot(val)
      })
    }
    refresh()
    const timer = setInterval(refresh, 30_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  // Auto cash-out when out of credits
  useEffect(() => {
    if (phase === 'idle' && credits <= 0) {
      setCashOutTickets(0)
      setPhase('done')
    }
  }, [credits, phase])

  // Auto-spin: keep spinning when a sequence is running
  useEffect(() => {
    if (phase === 'nudge' || phase === 'bonus' || phase === 'jackpot-win' || phase === 'lucky') {
      if (autoSpinsLeftRef.current > 0) {
        autoSpinsLeftRef.current = 0
        setAutoSpinsLeft(0)
      }
      return
    }
    if (phase !== 'idle' || autoSpinsLeftRef.current <= 0) return
    if (credits < 1 && !freeSpin) {
      autoSpinsLeftRef.current = 0
      setAutoSpinsLeft(0)
      return
    }
    const timer = setTimeout(() => {
      autoSpinsLeftRef.current -= 1
      setAutoSpinsLeft(autoSpinsLeftRef.current)
      spinRef.current()
    }, 400)
    return () => clearTimeout(timer)
  }, [phase, credits, freeSpin])

  function publishMessage(newMessage: string) {
    setMessages(prev => [...prev, { text: newMessage, id: Date.now().toString() }])
  }

  function dismissMessage() {
    setMessages(prev => prev.slice(1))
  }

  function clearMessages() {
    setMessages([])
  }

  useEffect(() => {
    if (boardMessage) {
      publishMessage(boardMessage)
    } else {
      clearMessages()
    }
  }, [boardMessage])

  function toggleHold(i: 0 | 1 | 2) {
    if (phase !== 'idle' || recentlyHeld[i]) return
    setHeld(prev => {
      const next = [...prev] as [boolean, boolean, boolean]
      next[i] = !next[i]
      return next
    })
  }

  function resolveBoardNode(node: BoardNode) {
    switch (node.type) {
      case 'credit':
        setCredits(c => c + (node.value ?? 0))
        setBoardMessage(`+${node.value} credits!`)
        setPhase('idle')
        break
      case 'extra-spin':
        setFreeSpin(true)
        setBoardMessage('Free spin!')
        setPhase('idle')
        break
      case 'multiplier': {
        const m = node.value ?? 2
        boardMultRef.current = m
        setBoardMult(m)
        try { localStorage.setItem('fm_board_mult', String(m)) } catch (e) { logError('fm_board_mult', { error: String(e) }) }
        setBoardMessage(`×${m} multiplier active!`)
        setPhase('idle')
        break
      }
      case 'nudge':
        pendingBoardNodeRef.current = node
        setBoardMessage('NUDGES ACTIVE! ')
        setNudgesAvailable(node.value ?? 1)
        setPhase('nudge')
        break
      case 'bonus-game': {
        // Build 9 tiles: 7 credit prizes (2–20), 2 collect-early tiles
        const prizes = Array.from({ length: 7 }, () => ({ value: Math.floor(Math.random() * 19) + 2, collect: false, revealed: false }))
        const collects = [{ value: 0, collect: true, revealed: false }, { value: 0, collect: true, revealed: false }]
        const shuffled = [...prizes, ...collects].sort(() => Math.random() - 0.5)
        setBonusTiles(shuffled)
        setBonusPicksLeft(3)
        setBonusTotalWin(0)
        setPhase('bonus')
        break
      }
      case 'jackpot-mini':
        setCredits(c => c + JACKPOT_TIERS[0].credits)
        setBoardMessage(`MINI JACKPOT! +${JACKPOT_TIERS[0].credits} credits!`)
        setJackpotWon({ tier: 'Mini', amount: JACKPOT_TIERS[0].credits })
        setPhase('jackpot-win')
        break
      case 'jackpot-major':
        setCredits(c => c + JACKPOT_TIERS[2].credits)
        setBoardMessage(`MAJOR JACKPOT! +${JACKPOT_TIERS[2].credits} credits!`)
        setJackpotWon({ tier: 'Major', amount: JACKPOT_TIERS[2].credits })
        setPhase('jackpot-win')
        break
      case 'jackpot-grand': {
        const resetVal = JACKPOT_TIERS[3].base
        setBoardMessage(`GRAND JACKPOT! +${JACKPOT_TIERS[3].credits} credits!`)
        // Claim via transaction so two simultaneous winners can't both get the full pot
        claimAndResetGrandJackpot().then(amount => {
          grandJackpotRef.current = resetVal
          setGrandJackpot(resetVal)
          setCredits(c => c + amount)
          setJackpotWon({ tier: 'Grand', amount })
          boardPosRef.current = 0
          setBoardPos(0)
          try { localStorage.setItem('fm_board_pos', '0') } catch (e) { logError('fm_board_pos grand reset', { error: String(e) }) }
          setPhase('jackpot-win')
          publishGrandJackpotWin(loadPlayerName(), amount)
        })
        break
      }
    }
  }

  function resetBoardToZero() {
    emitSound('fruitMachineLose')
    boardPosRef.current = 0
    setBoardPos(0)
    try { localStorage.setItem('fm_board_pos', '0') } catch (e) { logError('fm_board_pos reset', { error: String(e) }) }
    setBoardMessage('Lose! You hit rock bottom!')
    setPhase('idle')
  }

function regressBoardBy(steps: number) {
    if (steps === 0) { setPhase('idle'); return }
    setPhase('board-moving')
    let stepsLeft = steps
    function stepOnce() {
      const newPos = Math.max(0, boardPosRef.current - 1)
      
      boardPosRef.current = newPos
      setBoardPos(newPos)

      try { localStorage.setItem('fm_board_pos', String(newPos)) } catch (e) { logError('fm_board_pos', { error: String(e) }) }
      stepsLeft++
      if (stepsLeft < 0 && newPos > 0) {
        setTimeout(stepOnce, 400)
      } else {
        resolveBoardNode(BOARD_NODES[newPos])
      }
    }
    setTimeout(stepOnce, 400)
  }

  function advanceBoardBy(steps: number) {
    if (steps === 0) { setPhase('idle'); return }
    setPhase('board-moving')
    let stepsLeft = steps
    function stepOnce() {
      const newPos = Math.min(BOARD_SIZE - 1, boardPosRef.current + 1)
      
      boardPosRef.current = newPos
      setBoardPos(newPos)

      try { localStorage.setItem('fm_board_pos', String(newPos)) } catch (e) { logError('fm_board_pos', { error: String(e) }) }
      stepsLeft--
      if (stepsLeft > 0 && newPos < BOARD_SIZE - 1) {
        setTimeout(stepOnce, 400)
      } else {
        resolveBoardNode(BOARD_NODES[newPos])
      }
    }
    setTimeout(stepOnce, 400)
  }

  function nudgeReel(i: 0 | 1 | 2, dir: 1 | -1) {
    if (nudgesAvailable <= 0) return
    const newPos = ((reelPositions[i] + dir) + REEL_STRIP.length) % REEL_STRIP.length
    setReelPositions(prev => {
      const next = [...prev] as [number, number, number]
      next[i] = newPos
      return next
    })
    setDisplay(prev => {
      const next = [...prev] as [string, string, string]
      next[i] = REEL_STRIP[newPos]
      return next
    })
    setNudgesAvailable(n => n - 1)
  }

  function finishNudge() {
    clearMessages()
    const nudgedReels: [string, string, string] = [
      REEL_STRIP[reelPositions[0]],
      REEL_STRIP[reelPositions[1]],
      REEL_STRIP[reelPositions[2]],
    ]
    setReels(nudgedReels)
    setDisplay(nudgedReels)
    const { credits: win, winType } = calcPayout(nudgedReels)
    const featureHits = nudgedReels.filter(x => x === FEATURE).length

    let featureBonus = 0
    const newFeatureCount = featureCountRef.current + featureHits
    if (featureHits > 0 && newFeatureCount >= FEATURE_THRESHOLD) {
      featureBonus = FEATURE_BONUS_CREDITS
      featureCountRef.current = newFeatureCount % FEATURE_THRESHOLD
    } else {
      featureCountRef.current = newFeatureCount
    }
    setFeatureTriggerCount(featureCountRef.current)
    try { localStorage.setItem('fm_trail', String(featureCountRef.current)) } catch (e) { logError('fm_trail save', { error: String(e) }) }

    const mult = boardMultRef.current
    const totalWin = (win + featureBonus) * mult
    if (mult > 1) {
      boardMultRef.current = 1
      setBoardMult(1)
      try { localStorage.setItem('fm_board_mult', '1') } catch (e) { logError('fm_board_mult reset', { error: String(e) }) }
    }

    if (totalWin > 0) {
      setLastWin(totalWin)
      setCredits(c => Math.max(0, c + totalWin))
    }

    if (featureBonus > 0) {
      setBoardMessage(`🌟 FEATURE!${mult > 1 ? ` ×${mult}` : ''} +${totalWin} credits!`)
    } else if (winType === 'wild') {
      if (totalWin > 0) setBoardMessage(`🃏 WILD!${mult > 1 ? ` ×${mult}` : ''} +${totalWin} credits!`)
      else setBoardMessage('🃏 WILD!')
    } else if (winType === 'bonus') {
      if (totalWin > 0) setBoardMessage(`💰 BONUS! +${totalWin} credits!`)
      else setBoardMessage('💰 BONUS!')
    } else if (mult > 1 && totalWin > 0) {
      setBoardMessage(`×${mult} MULTIPLIER! +${totalWin} credits!`)
    } else if (totalWin > 0) {
      setBoardMessage(`+${totalWin} credits!`)
    }

    setNudgesAvailable(0)
    setPhase('idle')
  }

  function startLuckyMinigame() {
    setPhase('lucky')
    luckyIntervalRef.current = setInterval(() => {
      const sym = LADDER_SYMBOLS[Math.floor(Math.random() * LADDER_SYMBOLS.length)]
      currentLadderRef.current = sym
      setLadderDisplay(sym)
    }, 80)
  }

  function stopLucky() {
    if (luckyIntervalRef.current) {
      clearInterval(luckyIntervalRef.current)
      luckyIntervalRef.current = null
    }
    const result = adjustLadderForBoardPos(currentLadderRef.current, boardPosRef.current)
    if (result === 'Lose') {
      const newLoserCount = loserCountRef.current + 1
      if (newLoserCount >= LOSER_THRESHOLD) {
        loserCountRef.current = 0
        setLoserCount(0)
        try { localStorage.setItem('fm_loser', '0') } catch (e) { logError('fm_loser reset', { error: String(e) }) }
        boardPosRef.current = LOSER_JUMP_POS
        setBoardPos(LOSER_JUMP_POS)
        try { localStorage.setItem('fm_board_pos', String(LOSER_JUMP_POS)) } catch (e) { logError('fm_board_pos loser jump', { error: String(e) }) }
        setBoardMessage('L-O-S-E-R complete! Jump to position 35!')
        setPhase('idle')
      } else {
        loserCountRef.current = newLoserCount
        setLoserCount(newLoserCount)
        try { localStorage.setItem('fm_loser', String(newLoserCount)) } catch (e) { logError('fm_loser save', { error: String(e) }) }
        resetBoardToZero()
      }
    } else if (result === '-1' || result === '-2') {
      const steps = result === '-1' ? -1 : -2
      setBoardMessage(`Go Back ${-steps} step${-steps > 1 ? 's' : ''}!`)
      regressBoardBy(steps)
    } else if (result === '+1' || result === '+2') {
      const steps = result === '+1' ? 1 : 2
      setBoardMessage(`Advance ${steps} step${steps > 1 ? 's' : ''}!`)
      advanceBoardBy(steps)
    } else {
      setBoardMessage('Lucky! Stay put!')
      setPhase('idle')
    }
  }



  function spin() {
    clearMessages()

    if (phase !== 'idle' || (credits < 1 && !freeSpin)) return

    const nextPositions: [number, number, number] = [
      held[0] ? reelPositions[0] : pickReelPos(),
      held[1] ? reelPositions[1] : pickReelPos(),
      held[2] ? reelPositions[2] : pickReelPos(),
    ]
    const nextReels: [string, string, string] = [
      REEL_STRIP[nextPositions[0]],
      REEL_STRIP[nextPositions[1]],
      REEL_STRIP[nextPositions[2]],
    ]
    const nextLadder = adjustLadderForBoardPos(pickLadderSymbol(grandJackpotRef.current), boardPosRef.current)
    setReelPositions(nextPositions)
    spinningRef.current = [!held[0], !held[1], !held[2]]
    ladderSpinRef.current = true
    setRecentlyHeld([...held] as [boolean, boolean, boolean])

    updateGrandJackpot()
    
    emitSound('fruitMachineSpin')
    setPhase('spinning')
    const spinCost = freeSpin ? 0 : 1
    setFreeSpin(false)
    setCredits(c => c - spinCost)
    setLastWin(null)
    setBoardMessage(null)

    // Rapidly cycle display for non-held reels and the ladder reel
    intervalRef.current = setInterval(() => {
      const s = spinningRef.current
      setDisplay(prev => [
        s[0] ? SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)] : prev[0],
        s[1] ? SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)] : prev[1],
        s[2] ? SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)] : prev[2],
      ])
      if (ladderSpinRef.current) {
        setLadderDisplay(LADDER_SYMBOLS[Math.floor(Math.random() * LADDER_SYMBOLS.length)])
      }
    }, 80)

    setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      spinningRef.current = [false, false, false]
      ladderSpinRef.current = false

      setReels(nextReels)
      setDisplay(nextReels)
      setLadderDisplay(nextLadder)
      setHeld([false, false, false])

      const { credits: win, winType } = calcPayout(nextReels)
      const featureHits = nextReels.filter(x => x === FEATURE).length

      // Compute feature bonus imperatively so we don't need current state in an updater
      let featureBonus = 0
      const newFeatureCount = featureCountRef.current + featureHits
      if (featureHits > 0 && newFeatureCount >= FEATURE_THRESHOLD) {
        featureBonus = FEATURE_BONUS_CREDITS
        featureCountRef.current = newFeatureCount % FEATURE_THRESHOLD
      } else {
        featureCountRef.current = newFeatureCount
      }
      setFeatureTriggerCount(featureCountRef.current)
      try { localStorage.setItem('fm_trail', String(featureCountRef.current)) } catch (e) { logError('fm_trail save', { error: String(e) }) }

      // Apply board multiplier
      const mult = boardMultRef.current
      const totalWin = (win + featureBonus) * mult
      if (mult > 1) {
        boardMultRef.current = 1
        setBoardMult(1)
        try { localStorage.setItem('fm_board_mult', '1') } catch (e) { logError('fm_board_mult reset', { error: String(e) }) }
      }

      setLastWin(totalWin)
      setCredits(c => Math.max(0, c + totalWin))
      if (totalWin > 0) emitSound('fruitMachineWin')
      // After a winning spin, block all holds so the player can't chain wins by holding
      if (totalWin > 0) setRecentlyHeld([true, true, true])

      var boardMsg = ''

      if (featureBonus > 0) {
        setBoardMessage(`🌟 FEATURE!${mult > 1 ? ` ×${mult}` : ''} +${totalWin} credits!`)
      } else if (winType === 'wild') {
        if( totalWin > 0){
        boardMsg = `🃏 WILD!${mult > 1 ? ` ×${mult}` : ''} +${totalWin} credits!`

        } else {
        boardMsg = `🃏 WILD!${mult > 1 ? ` ×${mult}` : ''}`
        }
      } else if (winType === 'bonus') {
                if( totalWin > 0){
        boardMsg = `💰 BONUS! +${totalWin} credits!`

        } else {
        boardMsg = '💰 BONUS!'
        }
      } else if (mult > 1 && totalWin > 0) {
        boardMsg = `×${mult} MULTIPLIER! +${totalWin} credits!`
      } else if (totalWin > 0) {
        boardMsg = `+${totalWin} credits!`
      } else {
        boardMsg = 'No win!'
      }


      // Trail reel drives board; feature completion adds an extra step
      const featureStep = featureBonus > 0 ? 1 : 0
      const trailMessage = featureHits > 0 ? `+${featureHits} to TRAIL!` : ''
      var ladderMessage = ''

      const ladderProgress = (nextLadder === '+1' ? 1 : nextLadder === '+2' ? 2 : nextLadder === '-1' ? -1 : nextLadder === '-2' ? -2 : 0) + featureStep
      if (nextLadder === 'Lose') {
        if (grandJackpotRef.current > 2500) {
          ladderMessage = 'Lucky? Tap STOP!'
          startLuckyMinigame()
        } else {
          const newLoserCount = loserCountRef.current + 1
          if (newLoserCount >= LOSER_THRESHOLD) {
            loserCountRef.current = 0
            setLoserCount(0)
            try { localStorage.setItem('fm_loser', '0') } catch (e) { logError('fm_loser reset', { error: String(e) }) }
            boardPosRef.current = LOSER_JUMP_POS
            setBoardPos(LOSER_JUMP_POS)
            try { localStorage.setItem('fm_board_pos', String(LOSER_JUMP_POS)) } catch (e) { logError('fm_board_pos loser jump', { error: String(e) }) }
            ladderMessage=('L-O-S-E-R complete! Jump to position 35!')
            setPhase('idle')
          } else {
            loserCountRef.current = newLoserCount
            setLoserCount(newLoserCount)
            try { localStorage.setItem('fm_loser', String(newLoserCount)) } catch (e) { logError('fm_loser save', { error: String(e) }) }
            resetBoardToZero()
          }
        }
      } else if (ladderProgress < 0) {
        ladderMessage =  `Go Back ${-ladderProgress} step${-ladderProgress > 1 ? 's' : ''}!`
        regressBoardBy(ladderProgress)
      } else if (ladderProgress > 0) {
        ladderMessage =  `Advance ${ladderProgress} step${ladderProgress > 1 ? 's' : ''}!`
        advanceBoardBy(ladderProgress)
      } else {
        setPhase('idle')
      }

      setBoardMessage(boardMsg + ' ' + trailMessage + ' ' + ladderMessage)
    }, SPIN_DURATION_MS)
  }

  spinRef.current = spin

  function startSpin() {
    if (spinCount > 1) {
      autoSpinsLeftRef.current = spinCount - 1
      setAutoSpinsLeft(spinCount - 1)
    }
    spin()
  }

  function stopAutoSpin() {
    autoSpinsLeftRef.current = 0
    setAutoSpinsLeft(0)
  }

  function pickBonusTile(idx: number) {
    if (bonusPicksLeft <= 0) return
    const tile = bonusTiles[idx]
    if (tile.revealed) return
    const newTiles = bonusTiles.map((t, i) => i === idx ? { ...t, revealed: true } : t)
    setBonusTiles(newTiles)
    const earned = tile.collect ? 0 : tile.value
    const newTotal = bonusTotalWin + earned
    setBonusTotalWin(newTotal)
    const newPicks = tile.collect ? 0 : bonusPicksLeft - 1
    setBonusPicksLeft(newPicks)
    if (newPicks <= 0) {
      // Reveal remaining tiles after a brief delay then finish
      setTimeout(() => {
        setBonusTiles(prev => prev.map(t => ({ ...t, revealed: true })))
        setTimeout(() => finishBonusWithWin(newTotal), 800)
      }, 400)
    }
  }

  function finishBonusWithWin(total: number) {
    setCredits(c => c + total)
    setLastWin(total)
    setBoardMessage(`🎁 BONUS! +${total} credits!`)
    setBonusTiles([])
    setBonusPicksLeft(0)
    setPhase('idle')
  }

  function dismissJackpotWin() {
    setJackpotWon(null)
    setPhase('idle')
  }

  function cashOut() {
    if (phase !== 'idle') return
    const tickets = credits * TICKETS_PER_CREDIT
    setCashOutTickets(tickets)
    setPhase('done')
  }

  function buyCredits() {
    if (availCrystals < BUY_COST || credits >= MAX_CREDITS || phase !== 'idle') return
    saveCrystals(availCrystals - BUY_COST)
    setAvailCrystals(c => c - BUY_COST)
    setCredits(c => Math.min(MAX_CREDITS, c + BUY_AMOUNT))
  }

  // ── Bonus game screen ────────────────────────────────────────────────────────

  if (phase === 'bonus' && bonusTiles.length > 0) {
    return (
      <div className="minigame-screen">
        <div className="minigame-title">🎰 FRUIT MACHINE</div>
        <div className="fm-bonus-game">
          <div className="fm-bonus-header">BONUS GAME — pick {bonusPicksLeft} {bonusPicksLeft === 1 ? 'prize' : 'prizes'}!</div>
          {bonusTotalWin > 0 && <div className="fm-bonus-running-total">Running total: +{bonusTotalWin} credits</div>}
          <div className="fm-bonus-tiles">
            {bonusTiles.map((tile, i) => (
              <button
                key={i}
                className={`fm-bonus-tile${tile.revealed ? ' fm-bonus-tile--revealed' : ''}`}
                onClick={() => pickBonusTile(i)}
                disabled={tile.revealed || bonusPicksLeft <= 0}
              >
                {tile.revealed
                  ? (tile.collect ? '⛔ COLLECT' : `+${tile.value}`)
                  : '?'}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Jackpot win screen ────────────────────────────────────────────────────────

  if (phase === 'jackpot-win' && jackpotWon) {
    return (
      <div className="minigame-screen">
        <div className="minigame-title">🎰 FRUIT MACHINE</div>
        <div className="fm-jackpot-win-overlay">
          <div className="fm-jackpot-win-tier">{jackpotWon.tier} JACKPOT!</div>
          <div className="fm-jackpot-win-amount">+{jackpotWon.amount} credits!</div>
          <button className="action-btn action-btn--gold" onClick={dismissJackpotWin}>
            COLLECT
          </button>
        </div>
      </div>
    )
  }

  // ── Done screen ───────────────────────────────────────────────────────────────

  if (phase === 'done') {
    return (
      <div className="minigame-screen">
        <div className="minigame-title">🎰 FRUIT MACHINE</div>
        <div className="minigame-result-panel">
          <div className="minigame-result-headline">
            {cashOutTickets > 0 ? 'Cashed out!' : 'Out of credits!'}
          </div>
          <div className="minigame-result-breakdown">
            {cashOutTickets > 0 ? (
              <>
                <div>Credits: {cashOutTickets / TICKETS_PER_CREDIT}</div>
                <div>× {TICKETS_PER_CREDIT} tickets per credit</div>
              </>
            ) : (
              <div>No credits remaining.</div>
            )}
            <div className="minigame-result-total">Total: {cashOutTickets} 🎫</div>
          </div>
          <button className="action-btn action-btn--gold" onClick={() => onDone(cashOutTickets)}>
            COLLECT &amp; EXIT
          </button>
        </div>
      </div>
    )
  }

  // ── Playing screen ────────────────────────────────────────────────────────────

  const isSpinning = phase === 'spinning'
  const isBusy = phase !== 'idle'
  const isInAutoSpin = autoSpinsLeft > 0
  const canSpin = !isBusy && !isInAutoSpin && (credits >= 1 || freeSpin)
  const canBuy = phase === 'idle' && credits > 0 && credits < MAX_CREDITS && availCrystals >= BUY_COST
  const totalWin = lastWin ?? 0

  // Board display window: up to 5 nodes centred on current position.
  // Offsets that would go below position 0 are omitted (no wrap-around at rock bottom).
  const boardWindow = [-2, -1, 0, 1, 2].flatMap(offset => {
    const absPos = boardPos + offset
    if (absPos < 0) return []
    const idx = absPos % BOARD_SIZE
    return [{ idx, node: BOARD_NODES[idx], isCurrent: offset === 0 }]
  })

  // const message = boardMessage ? boardMessage : freeSpin ? 'FREE SPIN ready!' : boardMult > 1 ? `×${boardMult} multiplier active!` : lastWin !== null && totalWin > 0 ? winLabel ?? `+${totalWin} credit${totalWin > 1 ? 's' : ''}!` : lastWin === 0 ? 'No win' : ''


  return (
    <div className="minigame-screen">
      <div className="minigame-title">🎰 FRUIT MACHINE</div>

      {/* Jackpot tiers */}
      <div className="fm-jackpots">
        {JACKPOT_TIERS.map(t => (
          <div key={t.name} className={`fm-jackpot-tier${t.progressive ? ' fm-jackpot-tier--grand' : ''}`}>
            <div className="fm-jackpot-name">{t.name}</div>
            <div className="fm-jackpot-amount">{t.progressive ? grandJackpot : t.credits}</div>
          </div>
        ))}
      </div>

      <div className="fm-header">
        <div className="fm-word-meters">
          <div className="fm-word-meter" title="Each trail Lose lights a letter — spell LOSER to jump to position 35">
            {['L','O','S','E','R'].map((letter, i) => (
              <span key={letter+i} className={`fm-word-letter fm-word-letter--loser${i < loserCount ? ' fm-word-letter--lit' : ''}`}>{letter}</span>
            ))}
          </div>
        </div>
        <span className="fm-credits">Credits: {credits}</span>
        <div className="fm-word-meters">
          <div className="fm-word-meter" title="Land 🌟 symbols to spell TRAIL and advance the board">
            {['T','R','A','I','L'].map((letter, i) => (
              <span key={letter} className={`fm-word-letter${i < featureTriggerCount ? ' fm-word-letter--lit' : ''}`}>{letter}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Feature board trail */}
      <div className="fm-board">
        {boardWindow.map(({ idx, node, isCurrent }) => (
          <div key={idx} className={`fm-board-node${isCurrent ? ' fm-board-node--current' : ''}`}>
            <div className="fm-board-node-label">{node.label}</div>
          </div>
        ))}
      </div>
<div className="fm-board">
{boardPos+1}/{BOARD_NODES.length+1}
</div>

        <LedScroller messages={messages}></LedScroller>

      {/* Reels + trail reel */}
      <div className="fm-reels" >
        <table style={{ borderCollapse: 'collapse', borderSpacing: '0' }}>
          <thead >
            <td colSpan={3} align='center'>
              &nbsp;
            </td>
            <td className="fm-ladder-reel-label">
           
            </td>
          </thead>
          <tbody>
          {/* Up Nudges */}
          <tr>
            {([0, 1, 2] as const).map(i => (
              <td key={i} className="fm-nudge">
                <button className="fm-nudge-btn" onClick={() => nudgeReel(i, -1)} disabled={nudgesAvailable <= 0}>▲</button>
              </td>
            ))}
            <td className="fm-ladder-reel-label">    <div className="fm-ladder-reel-wrap">{phase === 'lucky' ? 'Lucky?' : 'Trail'}</div></td>
          </tr>
          {/* Main reels with peek symbols above/below */}
          <tr>
            {([0, 1, 2] as const).map(i => (
              <td key={i}>
                <div className={`fm-reel fm-reel--with-peek${held[i] ? ' fm-reel--held' : ''}${isSpinning && !held[i] ? ' fm-reel--spinning' : ''}`}>
                  <div className="fm-symbol fm-symbol--peek">
                    {REEL_STRIP[(reelPositions[i] - 1 + REEL_STRIP.length) % REEL_STRIP.length]}
                  </div>
                  <div className="fm-symbol">{display[i]}</div>
                  <div className="fm-symbol fm-symbol--peek">
                    {REEL_STRIP[(reelPositions[i] + 1) % REEL_STRIP.length]}
                  </div>
                </div>
              </td>
            ))}
            <td>
              <div className="fm-ladder-reel-wrap">
                <div className={`fm-reel fm-ladder-reel${(isSpinning || phase === 'lucky') ? ' fm-reel--spinning' : ''}`}>
                  <div className="fm-ladder-symbol">{ladderDisplay}</div>
                </div>
              </div>
            </td>
          </tr>
          {/* Down Nudges */}
          <tr>
            {([0, 1, 2] as const).map(i => (
              <td key={i} className="fm-nudge">
                <button className="fm-nudge-btn" onClick={() => nudgeReel(i, 1)} disabled={nudgesAvailable <= 0}>▼</button>
              </td>
            ))}
            <td></td>
          </tr>
          {/* Hold buttons */}
          <tr>
            {([0, 1, 2] as const).map(i => (
              <td key={i}>
                <button
                  className={`fm-hold-btn${held[i] ? ' fm-hold-btn--active' : ''}${recentlyHeld[i] && !held[i] ? ' fm-hold-btn--blocked' : ''}`}
                  onClick={() => toggleHold(i)}
                  disabled={isBusy || recentlyHeld[i]}
                  title={recentlyHeld[i] ? 'Already held last spin' : undefined}
                >
                  {held[i] ? 'HELD' : recentlyHeld[i] ? '—' : 'HOLD'}
                </button>
              </td>
            ))}
            <td></td>
          </tr>
          </tbody>
        </table>
      </div>


      {/* Controls */}
      <div className="fm-controls">
        <div className={`action-btn ${phase === 'nudge' || phase === 'lucky' ? 'action-btn--disabled' : 'action-btn--gold'}`}>
          {phase === 'nudge' ? (
            <div className="action-btn action-btn--noborder-disabled">NUDGE — {nudgesAvailable} remaining</div>
          ) : phase === 'lucky' ? (
            <div className="action-btn action-btn--noborder-disabled">LUCKY? — Tap STOP to freeze the trail reel!</div>
          ) : (
            <>
              <button
                className="action-btn action-btn--noborder"
                onClick={startSpin}
                disabled={!canSpin}
              >
                {freeSpin ? 'FREE SPIN' : spinCount === 1 ? 'SPIN (1 credit)' : `SPIN ×${isInAutoSpin ? autoSpinsLeft : spinCount} (${spinCount} credits)`}
              </button>
              <div className="fm-spin-count-selector">
                {([1, 5, 10, 25, 50] as const).map(n => (
                  <button
                    key={n}
                    className={`filter-btn filter-btn--gold${spinCount === n ? ' filter-btn--active' : ''}`}
                    onClick={() => setSpinCount(n)}
                    disabled={isBusy || isInAutoSpin}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          className={`action-btn ${isInAutoSpin ? 'action-btn--danger' : phase === 'nudge' || phase === 'lucky' ? 'action-btn--gold' : 'action-btn--disabled'}`}
          onClick={isInAutoSpin ? stopAutoSpin : phase === 'nudge' ? finishNudge : phase === 'lucky' ? stopLucky : undefined}
          disabled={!isInAutoSpin && phase !== 'nudge' && phase !== 'lucky'}
        >
          {isInAutoSpin ? 'STOP' : phase === 'nudge' ? 'DONE' : 'STOP'}
        </button>
      </div>

      
      <div className="fm-controls">
    
        <button
          className="action-btn"
          onClick={cashOut}
          disabled={isBusy || isInAutoSpin}
        >
          CASH OUT ({credits * TICKETS_PER_CREDIT} 🎫)
        </button>
      </div>

      {canBuy && (
        <button className="fm-buy-credits" onClick={buyCredits}>
          + Buy 5 credits — 25 💎 (you have {availCrystals})
        </button>
      )}

      {/* How to play */}
      <details className="fm-paytable">
        <summary>How to play</summary>
        Spin the reels match symbols for a prize. Getting the feature 🌟 symbol increases the feature level, hit 5 and the trail will progress. the trail is long, reach the end and you'll get the JACKPOT!!!<br />
        Everyone who plays the game is contributing to the jackpot, and there can only be one winner. Once it's been won the jackpot will reset.
      </details>

      {/* Payout reference */}
      <details className="fm-paytable">
        <summary>Payout table</summary>
        <table className="fm-paytable-table">
          <tbody>
            <tr><td>🃏🃏🃏</td><td>40 credits (triple wild)</td></tr>
            <tr><td>💎💎💎</td><td>50 credits</td></tr>
            <tr><td>⭐⭐⭐</td><td>30 credits</td></tr>
            <tr><td>🔔🔔🔔</td><td>20 credits</td></tr>
            <tr><td>Any triple</td><td>10 credits</td></tr>
            <tr><td>💎💎 pair</td><td>5 credits</td></tr>
            <tr><td>⭐⭐ pair</td><td>3 credits</td></tr>
            <tr><td>Any pair</td><td>2 credits</td></tr>
            <tr><td>🍒 on reel 1</td><td>1 credit</td></tr>
            <tr><td>🃏 Wild</td><td>substitutes for any symbol</td></tr>
            <tr><td>💰💰 Bonus</td><td>4 credits (scatter)</td></tr>
            <tr><td>💰💰💰 Bonus</td><td>15 credits (scatter)</td></tr>
            <tr><td>🌟 Feature ×{FEATURE_THRESHOLD}</td><td>+{FEATURE_BONUS_CREDITS} credits</td></tr>
          </tbody>
        </table>
      </details>
    </div>
  )
}
