// ─── Fruit Machine ────────────────────────────────────────────────────────────
// 3-reel slot machine. Spin costs 1 credit; hold reels between spins.
// Cash out at any time to convert remaining credits to tickets (2 per credit).
// Buy +5 credits for 25 crystals when running low.
//
// Special symbols:
//   🃏 Wild    — substitutes for any standard symbol; triple-wild pays 40 credits
//   🌟 Feature — accumulates toward a feature bonus; at 5 triggers: +15 credits
//   💰 Bonus   — scatter: 2+ anywhere pays 4 credits; 3 pays 15 credits

import React, { useState, useRef, useEffect } from 'react'
import { loadCrystals, saveCrystals } from '../../game/collection'
import { logError } from '../../logger'

interface Props {
  onDone: (ticketsEarned: number) => void
}

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '⭐', '🔔', '💎', '🃏', '🌟', '💰']
const WEIGHTS  = [ 20,   25,   25,   25,    10,    5,    2,    5,    1,    5]

const WILD    = '🃏'
const FEATURE = '🌟'
const BONUS   = '💰'

const STARTING_CREDITS     = 10
const BUY_COST             = 25   // crystals to buy more credits
const BUY_AMOUNT           = 5    // credits per purchase
const MAX_CREDITS          = 20   // cap on held credits
const TICKETS_PER_CREDIT   = 2
const SPIN_DURATION_MS     = 1200
const FEATURE_THRESHOLD    = 5    // feature triggers needed for bonus
const FEATURE_BONUS_CREDITS = 15  // credits awarded when feature fires

const JACKPOT_TIERS = [
  { name: 'Mini',  credits: 10,  progressive: false, base: 10  },
  { name: 'Minor', credits: 25, progressive: false, base: 25 },
  { name: 'Major', credits: 50, progressive: false, base: 50 },
  { name: 'Grand', credits: 0,   progressive: true,  base: 500 },
] as const

type BoardNodeType = 'credit' | 'multiplier' | 'extra-spin' | 'nudge' | 'bonus-game' | 'jackpot-mini' | 'jackpot-major' | 'jackpot-grand'
interface BoardNode { type: BoardNodeType; label: string; value?: number }

const BOARD_NODES: BoardNode[] = [
  { type: 'credit',       label: '+5cr',    value: 5   },
  { type: 'extra-spin',   label: 'FREE'              },
  { type: 'multiplier',   label: '×2',      value: 2   },
  { type: 'credit',       label: '+8cr',    value: 8   },
  { type: 'nudge',        label: 'NUDGE',   value: 1   },
  { type: 'credit',       label: '+3cr',    value: 3   },
  { type: 'jackpot-mini', label: 'MINI 💰'            },
  { type: 'credit',       label: '+10cr',   value: 10  },
  { type: 'multiplier',   label: '×3',      value: 3   },
  { type: 'extra-spin',   label: 'FREE'              },
  { type: 'credit',       label: '+5cr',    value: 5   },
  { type: 'bonus-game',   label: 'BONUS'             },
  { type: 'credit',       label: '+12cr',   value: 12  },
  { type: 'nudge',        label: 'NUDGE×2', value: 2   },
  { type: 'multiplier',   label: '×2',      value: 2   },
  { type: 'credit',       label: '+6cr',    value: 6   },
  { type: 'jackpot-major',label: 'MAJOR 🏆'           },
  { type: 'extra-spin',   label: 'FREE'              },
  { type: 'credit',       label: '+15cr',   value: 15  },
  { type: 'jackpot-grand',label: 'GRAND ⭐'           },
]

const BOARD_SIZE = BOARD_NODES.length

// Reel strip — fixed sequence for nudge up/down support
const REEL_STRIP = [
  '🍒','🍋','🍊','🍇','⭐','🔔','💎','🃏','🌟','💰',
  '🍒','🍋','🍊','🍇','⭐','🔔','💎','🍒','🌟','💰',
  '🍒','🍋','🍊','🍇','⭐','🔔','💎','🃏','🍒','💰',
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

function calcPayout(s: [string, string, string]): { credits: number; winType: WinType } {
  // Scatter: 2+ Bonus symbols anywhere pay regardless of position
  const bonusCount = s.filter(x => x === BONUS).length
  if (bonusCount >= 2) {
    return { credits: bonusCount === 3 ? 15 : 4, winType: 'bonus' }
  }

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

export function FruitMachine({ onDone }: Props) {
  const [reels, setReels]         = useState<[string, string, string]>(() => [pickSymbol(), pickSymbol(), pickSymbol()])
  const [display, setDisplay]     = useState<[string, string, string]>(() => [pickSymbol(), pickSymbol(), pickSymbol()])
  const [held, setHeld]           = useState<[boolean, boolean, boolean]>([false, false, false])
  const [recentlyHeld, setRecentlyHeld] = useState<[boolean, boolean, boolean]>([false, false, false])
  const [phase, setPhase]         = useState<'idle' | 'spinning' | 'board-moving' | 'nudge' | 'bonus' | 'jackpot-win' | 'done'>('idle')
  const [credits, setCredits]     = useState(STARTING_CREDITS)
  const [lastWin, setLastWin]     = useState<number | null>(null)
  const [winLabel, setWinLabel]   = useState<string | null>(null)
  const [cashOutTickets, setCashOutTickets] = useState(0)
  const [availCrystals, setAvailCrystals]  = useState(() => loadCrystals())
  const [featureTriggerCount, setFeatureTriggerCount] = useState(0)
  const [grandJackpot, setGrandJackpot] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('fm_grand') ?? '500', 10) } catch { return 500 }
  })
  const [jackpotWon, setJackpotWon] = useState<{ tier: string; amount: number } | null>(null)
  const [boardPos, setBoardPos]     = useState<number>(() => {
    try { return parseInt(localStorage.getItem('fm_board_pos') ?? '0', 10) } catch { return 0 }
  })
  const [boardMult, setBoardMult]   = useState<number>(() => {
    try { return parseInt(localStorage.getItem('fm_board_mult') ?? '1', 10) } catch { return 1 }
  })
  const [boardMessage, setBoardMessage]     = useState<string | null>(null)
  const [freeSpin, setFreeSpin]             = useState(false)
  const [nudgesAvailable, setNudgesAvailable] = useState(0)
  const [reelPositions, setReelPositions]   = useState<[number, number, number]>([0, 3, 6])
  const [bonusTiles, setBonusTiles] = useState<Array<{ value: number; collect: boolean; revealed: boolean }>>([])
  const [bonusPicksLeft, setBonusPicksLeft] = useState(0)
  const [bonusTotalWin, setBonusTotalWin]   = useState(0)

  const spinningRef     = useRef<[boolean, boolean, boolean]>([false, false, false])
  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const featureCountRef = useRef(0)  // mirrors featureTriggerCount for use inside setTimeout
  const grandJackpotRef = useRef(grandJackpot)
  const boardPosRef     = useRef(boardPos)
  const boardMultRef    = useRef(boardMult)
  const pendingBoardNodeRef = useRef<BoardNode | null>(null)

  // Sync display with reels on first mount
  useEffect(() => {
    setDisplay([...reels] as [string, string, string])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto cash-out when out of credits
  useEffect(() => {
    if (phase === 'idle' && credits <= 0) {
      setCashOutTickets(0)
      setPhase('done')
    }
  }, [credits, phase])

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
        setJackpotWon({ tier: 'Mini', amount: JACKPOT_TIERS[0].credits })
        setPhase('jackpot-win')
        break
      case 'jackpot-major':
        setCredits(c => c + JACKPOT_TIERS[2].credits)
        setJackpotWon({ tier: 'Major', amount: JACKPOT_TIERS[2].credits })
        setPhase('jackpot-win')
        break
      case 'jackpot-grand': {
        const amount = grandJackpotRef.current
        const resetVal = JACKPOT_TIERS[3].base
        grandJackpotRef.current = resetVal
        setGrandJackpot(resetVal)
        try { localStorage.setItem('fm_grand', String(resetVal)) } catch (e) { logError('fm_grand reset', { error: String(e) }) }
        setCredits(c => c + amount)
        setJackpotWon({ tier: 'Grand', amount })
        setPhase('jackpot-win')
        break
      }
    }
  }

  function advanceBoardBy(steps: number) {
    if (steps <= 0) { setPhase('idle'); return }
    setPhase('board-moving')
    let stepsLeft = steps
    function stepOnce() {
      const newPos = (boardPosRef.current + 1) % BOARD_SIZE
      boardPosRef.current = newPos
      setBoardPos(newPos)
      try { localStorage.setItem('fm_board_pos', String(newPos)) } catch (e) { logError('fm_board_pos', { error: String(e) }) }
      stepsLeft--
      if (stepsLeft > 0) {
        setTimeout(stepOnce, 400)
      } else {
        resolveBoardNode(BOARD_NODES[newPos])
      }
    }
    setTimeout(stepOnce, 400)
  }

  function nudgeReel(i: 0 | 1 | 2, dir: 1 | -1) {
    if (nudgesAvailable <= 0) return
    setReelPositions(prev => {
      const next = [...prev] as [number, number, number]
      next[i] = ((next[i] + dir) + REEL_STRIP.length) % REEL_STRIP.length
      return next
    })
    setNudgesAvailable(n => n - 1)
  }

  function finishNudge() {
    const nudgedReels: [string, string, string] = [
      REEL_STRIP[reelPositions[0]],
      REEL_STRIP[reelPositions[1]],
      REEL_STRIP[reelPositions[2]],
    ]
    setReels(nudgedReels)
    setDisplay(nudgedReels)
    const { credits: win, winType } = calcPayout(nudgedReels)
    if (win > 0) {
      setLastWin(win)
      setCredits(c => Math.max(0, c + win))
      if (winType === 'wild') setWinLabel('🃏 WILD! (nudge)')
      else if (winType === 'bonus') setWinLabel('💰 BONUS! (nudge)')
      else setWinLabel(`+${win} credits! (nudge)`)
    }
    setNudgesAvailable(0)
    setPhase('idle')
  }

  function spin() {
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
    setReelPositions(nextPositions)
    spinningRef.current = [!held[0], !held[1], !held[2]]
    setRecentlyHeld([...held] as [boolean, boolean, boolean])

    // Grand jackpot grows by 1 every spin
    const newGrand = grandJackpotRef.current + 1
    grandJackpotRef.current = newGrand
    setGrandJackpot(newGrand)
    try { localStorage.setItem('fm_grand', String(newGrand)) } catch (e) { logError('fm_grand save', { error: String(e) }) }

    // Detect ⭐⭐⭐ for Grand jackpot trigger
    const isTripleStar = nextReels[0] === '⭐' && nextReels[1] === '⭐' && nextReels[2] === '⭐'

    setPhase('spinning')
    const spinCost = freeSpin ? 0 : 1
    setFreeSpin(false)
    setCredits(c => c - spinCost)
    setLastWin(null)
    setWinLabel(null)
    setBoardMessage(null)

    // Rapidly cycle display for non-held reels
    intervalRef.current = setInterval(() => {
      const s = spinningRef.current
      setDisplay(prev => [
        s[0] ? SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)] : prev[0],
        s[1] ? SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)] : prev[1],
        s[2] ? SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)] : prev[2],
      ])
    }, 80)

    setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      spinningRef.current = [false, false, false]

      setReels(nextReels)
      setDisplay(nextReels)
      setHeld([false, false, false])

      if (isTripleStar) {
        const amount = grandJackpotRef.current
        const resetVal = JACKPOT_TIERS[3].base
        grandJackpotRef.current = resetVal
        setGrandJackpot(resetVal)
        try { localStorage.setItem('fm_grand', String(resetVal)) } catch (e) { logError('fm_grand reset', { error: String(e) }) }
        setLastWin(amount)
        setCredits(c => Math.max(0, c + amount))
        setJackpotWon({ tier: 'Grand', amount })
        setPhase('jackpot-win')
        return
      }

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

      // Apply board multiplier
      const mult = boardMultRef.current
      const totalWin = (win + featureBonus) * mult
      if (mult > 1) {
        boardMultRef.current = 1
        setBoardMult(1)
        try { localStorage.setItem('fm_board_mult', '1') } catch (e) { logError('fm_board_mult reset', { error: String(e) }) }
      }

      setLastWin(totalWin)
      // recentlyHeld stays set — blocks those reels from being held next spin
      setCredits(c => Math.max(0, c + totalWin))

      if (featureBonus > 0) {
        setWinLabel(`🌟 FEATURE!${mult > 1 ? ` ×${mult}` : ''} +${totalWin} credits!`)
      } else if (winType === 'wild') {
        setWinLabel(`🃏 WILD!${mult > 1 ? ` ×${mult}` : ''}`)
      } else if (winType === 'bonus') {
        setWinLabel('💰 BONUS!')
      } else if (mult > 1 && totalWin > 0) {
        setWinLabel(`×${mult} MULTIPLIER! +${totalWin} credits!`)
      }

      // Board advancement triggers
      const hasTriple = nextReels[0] === nextReels[1] && nextReels[1] === nextReels[2]
      const bellHits = nextReels.filter(r => r === '🔔').length
      const boardSteps = bellHits + (featureBonus > 0 ? 2 : 0) + (hasTriple ? 1 : 0)

      advanceBoardBy(boardSteps)
    }, SPIN_DURATION_MS)
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
    setWinLabel(`🎁 BONUS! +${total} credits!`)
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

  // ── Nudge screen ─────────────────────────────────────────────────────────────

  if (phase === 'nudge') {
    const nudgeReels: [string, string, string] = [
      REEL_STRIP[reelPositions[0]],
      REEL_STRIP[reelPositions[1]],
      REEL_STRIP[reelPositions[2]],
    ]
    return (
      <div className="minigame-screen">
        <div className="minigame-title">🎰 FRUIT MACHINE</div>
        <div className="fm-nudge-ui">
          <div className="fm-nudge-header">NUDGE — {nudgesAvailable} remaining</div>
          <div className="fm-reels">
            {([0, 1, 2] as const).map(i => (
              <div key={i} className="fm-reel">
                <div className="fm-symbol">{nudgeReels[i]}</div>
              </div>
            ))}
          </div>
          <div className="fm-nudge-controls">
            {([0, 1, 2] as const).map(i => (
              <div key={i} className="fm-nudge-reel">
                <button className="fm-nudge-btn" onClick={() => nudgeReel(i, -1)} disabled={nudgesAvailable <= 0}>▲</button>
                <button className="fm-nudge-btn" onClick={() => nudgeReel(i, 1)} disabled={nudgesAvailable <= 0}>▼</button>
              </div>
            ))}
          </div>
          <button className="action-btn action-btn--gold" onClick={finishNudge}>
            DONE
          </button>
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
  const canSpin = !isBusy && (credits >= 1 || freeSpin)
  const canBuy = phase === 'idle' && credits > 0 && credits < MAX_CREDITS && availCrystals >= BUY_COST
  const totalWin = lastWin ?? 0

  // Board display window: 5 nodes centred on current position
  const boardWindow = [-2, -1, 0, 1, 2].map(offset => {
    const idx = ((boardPos + offset) % BOARD_SIZE + BOARD_SIZE) % BOARD_SIZE
    return { idx, node: BOARD_NODES[idx], isCurrent: offset === 0 }
  })

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
        <span className="fm-credits">Credits: {credits}</span>
        <span className="fm-feature-counter" title="Land 🌟 symbols to fill the feature meter">
          Feature: {featureCountRef.current}/{FEATURE_THRESHOLD} 🌟
        </span>
        {lastWin !== null && totalWin > 0 && (
          <span className="fm-win-flash">
            {winLabel ?? `+${totalWin} credit${totalWin !== 1 ? 's' : ''}!`}
          </span>
        )}
        {lastWin === 0 && <span className="fm-no-win">No win</span>}
      </div>

      {/* Feature board trail */}
      <div className="fm-board">
        {boardWindow.map(({ idx, node, isCurrent }) => (
          <div key={idx} className={`fm-board-node${isCurrent ? ' fm-board-node--current' : ''}`}>
            <div className="fm-board-node-label">{node.label}</div>
          </div>
        ))}
      </div>
      {boardMessage && <div className="fm-board-message">{boardMessage}</div>}
      {boardMult > 1 && <div className="fm-board-mult-banner">×{boardMult} multiplier active!</div>}
      {freeSpin && <div className="fm-board-free-spin">FREE SPIN ready!</div>}

      {/* Reels */}
      <div className="fm-reels">
        {([0, 1, 2] as const).map(i => (
          <div
            key={i}
            className={`fm-reel${held[i] ? ' fm-reel--held' : ''}${isSpinning && !held[i] ? ' fm-reel--spinning' : ''}`}
          >
            <div className="fm-symbol">{display[i]}</div>
          </div>
        ))}
      </div>

      {/* Hold buttons */}
      <div className="fm-holds">
        {([0, 1, 2] as const).map(i => (
          <button
            key={i}
            className={`fm-hold-btn${held[i] ? ' fm-hold-btn--active' : ''}${recentlyHeld[i] && !held[i] ? ' fm-hold-btn--blocked' : ''}`}
            onClick={() => toggleHold(i)}
            disabled={isBusy || recentlyHeld[i]}
            title={recentlyHeld[i] ? 'Already held last spin' : undefined}
          >
            {held[i] ? 'HELD' : recentlyHeld[i] ? '—' : 'HOLD'}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="fm-controls">
        <button
          className="action-btn action-btn--gold"
          onClick={spin}
          disabled={!canSpin}
        >
          {freeSpin ? 'FREE SPIN' : 'SPIN (1 credit)'}
        </button>
        <button
          className="action-btn"
          onClick={cashOut}
          disabled={isBusy}
        >
          CASH OUT ({credits * TICKETS_PER_CREDIT} 🎫)
        </button>
      </div>

      {canBuy && (
        <button className="fm-buy-credits" onClick={buyCredits}>
          + Buy 5 credits — 25 💎 (you have {availCrystals})
        </button>
      )}

      {/* Payout reference */}
      <details className="fm-paytable">
        <summary>Payout table</summary>
        <table className="fm-paytable-table">
          <tbody>
            <tr><td>🃏🃏🃏</td><td>40 credits (triple wild)</td></tr>
            <tr><td>💎💎💎</td><td>50 credits</td></tr>
            <tr><td>⭐⭐⭐</td><td>GRAND JACKPOT 🌠</td></tr>
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
