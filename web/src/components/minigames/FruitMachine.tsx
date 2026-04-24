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
const WEIGHTS  = [ 25,   17,   17,   12,    7,    5,    2,    3,    4,    8]

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
  { name: 'Mini',  credits: 50,  progressive: false, base: 50  },
  { name: 'Minor', credits: 100, progressive: false, base: 100 },
  { name: 'Major', credits: 250, progressive: false, base: 250 },
  { name: 'Grand', credits: 0,   progressive: true,  base: 500 },
] as const

function pickSymbol(): string {
  let r = Math.random() * WEIGHTS.reduce((s, w) => s + w, 0)
  for (let i = 0; i < SYMBOLS.length; i++) {
    r -= WEIGHTS[i]
    if (r <= 0) return SYMBOLS[i]
  }
  return SYMBOLS[SYMBOLS.length - 1]
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

  const spinningRef     = useRef<[boolean, boolean, boolean]>([false, false, false])
  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const featureCountRef = useRef(0)  // mirrors featureTriggerCount for use inside setTimeout
  const grandJackpotRef = useRef(grandJackpot)

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

  function spin() {
    if (phase !== 'idle' || credits < 1) return

    const nextReels: [string, string, string] = [
      held[0] ? reels[0] : pickSymbol(),
      held[1] ? reels[1] : pickSymbol(),
      held[2] ? reels[2] : pickSymbol(),
    ]
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
    setCredits(c => c - 1)
    setLastWin(null)
    setWinLabel(null)

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

      setLastWin(win + featureBonus)
      // recentlyHeld stays set — blocks those reels from being held next spin
      setCredits(c => Math.max(0, c + win + featureBonus))

      if (featureBonus > 0) {
        setWinLabel(`🌟 FEATURE! +${featureBonus} credits!`)
      } else if (winType === 'wild') {
        setWinLabel('🃏 WILD!')
      } else if (winType === 'bonus') {
        setWinLabel('💰 BONUS!')
      }

      setPhase('idle')
    }, SPIN_DURATION_MS)
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
  const canBuy = phase === 'idle' && credits > 0 && credits < MAX_CREDITS && availCrystals >= BUY_COST
  const totalWin = lastWin ?? 0

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
            disabled={isSpinning || recentlyHeld[i]}
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
          disabled={!(!isSpinning && credits >= 1)}
        >
          SPIN (1 credit)
        </button>
        <button
          className="action-btn"
          onClick={cashOut}
          disabled={isSpinning}
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
