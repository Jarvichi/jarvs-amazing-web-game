// ─── Casino Screen — The Lucky Draw ──────────────────────────────────────────
// PixiJS roulette table with a spinning ball. Same prize segments and crystal
// cost as the Lucky Spinner mini-game.

import React, { useRef, useState, useCallback } from 'react'
import * as PIXI from 'pixi.js'
import { usePixiApp } from '../../hooks/usePixiApp'
import { addTickets, loadLocalHighScore, saveLocalHighScore } from '../../game/miniGames'
import { loadCrystals, saveCrystals } from '../../game/collection'
import { incrementAchievementProgress, setAchievementProgress } from '../../game/achievements'
import { OverlayScreen } from '../ui/OverlayScreen'

const SPIN_COST     = 10
const SEGMENTS      = [2, 5, 10, 20, 5, 10, 50, 2]
const SEG_COLORS    = [0x4a3060, 0x3a5a40, 0x6a2a2a, 0x2a4a6a, 0x3a5a40, 0x6a2a2a, 0xc8a000, 0x4a3060]
const SEG_COUNT     = SEGMENTS.length
const JACKPOT       = 50
const WHEEL_R       = 108
const BALL_ORBIT_R  = WHEEL_R + 18  // outer orbit before drop
const BALL_LAND_R   = WHEEL_R * 0.82 // resting position on wheel surface
const SPIN_DURATION = 4200  // ms
const CW = 280, CH = 280
const CX = CW / 2, CY = CH / 2

interface Props {
  crystals:          number
  onCrystalsChange:  (n: number) => void
  onBack:            () => void
}

interface SpinState {
  startTime:    number
  wheelStartR:  number
  wheelEndR:    number
  ballStartA:   number
  ballEndA:     number
  tickets:      number
}

export function CasinoScreen({ crystals, onCrystalsChange, onBack }: Props) {
  const canvasRef    = useRef<HTMLDivElement>(null)
  const spinStateRef = useRef<SpinState | null>(null)
  const wheelRef     = useRef<PIXI.Container | null>(null)
  const ballRef      = useRef<PIXI.Graphics | null>(null)

  const [phase,    setPhase]   = useState<'ready' | 'spinning' | 'result'>('ready')
  const [result,   setResult]  = useState<number | null>(null)
  const [balance,  setBalance] = useState(crystals)

  usePixiApp(canvasRef, CW, CH, app => {
    const toRad = (deg: number) => (deg - 90) * Math.PI / 180

    // ── Green felt background ────────────────────────────────────────────────
    const bg = new PIXI.Graphics()
    bg.rect(0, 0, CW, CH).fill({ color: 0x082010 })
    app.stage.addChild(bg)

    // ── Wheel container (rotates) ────────────────────────────────────────────
    const wheel = new PIXI.Container()
    wheel.position.set(CX, CY)
    wheelRef.current = wheel

    const gfx = new PIXI.Graphics()

    // Gold outer rim
    gfx.circle(0, 0, WHEEL_R + 7).fill({ color: 0x8a6a00 })

    // Segments
    for (let i = 0; i < SEG_COUNT; i++) {
      const sA = toRad(i * (360 / SEG_COUNT))
      const eA = toRad((i + 1) * (360 / SEG_COUNT))
      gfx.moveTo(0, 0)
        .arc(0, 0, WHEEL_R, sA, eA)
        .closePath()
        .fill({ color: SEG_COLORS[i] })
    }

    // Dividing spokes
    for (let i = 0; i < SEG_COUNT; i++) {
      const a = toRad(i * (360 / SEG_COUNT))
      gfx.moveTo(0, 0)
        .lineTo(WHEEL_R * Math.cos(a), WHEEL_R * Math.sin(a))
        .stroke({ color: 0xffd700, width: 1.5 })
    }

    // Center hub
    gfx.circle(0, 0, 15).fill({ color: 0x1a0800 }).stroke({ color: 0xffd700, width: 2 })
    wheel.addChild(gfx)

    // Segment labels
    for (let i = 0; i < SEG_COUNT; i++) {
      const midDeg = (i + 0.5) * (360 / SEG_COUNT)
      const a = (midDeg - 90) * Math.PI / 180
      const r = WHEEL_R * 0.64
      const val = SEGMENTS[i]
      const lbl = new PIXI.Text({
        text: String(val),
        style: {
          fontSize:   val === JACKPOT ? 14 : 11,
          fill:       val === JACKPOT ? '#ffd700' : '#e8e8e8',
          fontFamily: 'monospace',
          fontWeight: 'bold',
        },
      })
      lbl.anchor.set(0.5, 0.5)
      lbl.position.set(r * Math.cos(a), r * Math.sin(a))
      lbl.rotation = a + Math.PI / 2
      wheel.addChild(lbl)
    }

    app.stage.addChild(wheel)

    // ── Ball ─────────────────────────────────────────────────────────────────
    const ball = new PIXI.Graphics()
    ball.circle(0, 0, 7).fill({ color: 0xfafafa }).stroke({ color: 0xaaaaaa, width: 1.5 })
    ball.position.set(CX + BALL_ORBIT_R, CY)
    ballRef.current = ball
    app.stage.addChild(ball)

    // ── Pointer ───────────────────────────────────────────────────────────────
    const ptr = new PIXI.Graphics()
    ptr.moveTo(0, 0).lineTo(-7, -16).lineTo(7, -16).closePath()
      .fill({ color: 0xffd700 })
      .stroke({ color: 0xffa500, width: 1 })
    ptr.position.set(CX, CY - WHEEL_R - 8)
    app.stage.addChild(ptr)

    // ── Ticker: drives both wheel rotation and ball orbit ─────────────────────
    app.ticker.add(() => {
      const state = spinStateRef.current
      if (!state) return

      const elapsed = Date.now() - state.startTime
      const t = Math.min(elapsed / SPIN_DURATION, 1)

      // Ease-out cubic
      const e = 1 - Math.pow(1 - t, 3)

      // Wheel rotates to final angle
      wheel.rotation = state.wheelStartR + (state.wheelEndR - state.wheelStartR) * e

      // Ball starts at outer orbit and drops inward as it slows
      const orbitR = BALL_ORBIT_R - (BALL_ORBIT_R - BALL_LAND_R) * e
      const ballA  = state.ballStartA + (state.ballEndA - state.ballStartA) * e
      ball.x = CX + orbitR * Math.cos(ballA)
      ball.y = CY + orbitR * Math.sin(ballA)

      if (t >= 1) {
        spinStateRef.current = null
        // Notify React — state setter is safe to call from a ticker
        setResult(state.tickets)
        setPhase('result')
      }
    })
  })

  const spin = useCallback(() => {
    if (phase !== 'ready') return
    const current = loadCrystals()
    if (current < SPIN_COST) return

    // Deduct crystals
    const next = current - SPIN_COST
    saveCrystals(next)
    setBalance(next)
    onCrystalsChange(next)

    // Pick winning segment
    const winSeg  = Math.floor(Math.random() * SEG_COUNT)
    const tickets = SEGMENTS[winSeg]

    // Calculate wheel target: 5-8 full rotations + land winning segment at pointer (top)
    const fullSpins  = 5 + Math.floor(Math.random() * 4)
    const segMidDeg  = (winSeg + 0.5) * (360 / SEG_COUNT)
    const wheelEnd   = (wheelRef.current?.rotation ?? 0) + fullSpins * Math.PI * 2 + (360 - segMidDeg) * Math.PI / 180

    // Ball target angle: pointer is at top (−π/2); winning seg mid mapped to that angle on fixed canvas
    const ballStartA = ballRef.current
      ? Math.atan2(ballRef.current.y - CY, ballRef.current.x - CX)
      : -Math.PI / 2
    // Ball orbits clockwise; add enough rounds to look like it's spinning then landing
    const ballRounds = 4 + Math.floor(Math.random() * 3)
    const ballEndA   = ballStartA + ballRounds * Math.PI * 2 + (-Math.PI / 2 - ballStartA)

    spinStateRef.current = {
      startTime:   Date.now(),
      wheelStartR: wheelRef.current?.rotation ?? 0,
      wheelEndR:   wheelEnd,
      ballStartA,
      ballEndA,
      tickets,
    }

    setPhase('spinning')

    // Update achievements on completion (handled when phase → 'result')
    // Store tickets so the effect can read them
    pendingTicketsRef.current = tickets
  }, [phase, onCrystalsChange])

  const pendingTicketsRef = useRef(0)

  // When result arrives, record achievements
  const handleResultShown = useCallback((tickets: number) => {
    addTickets(tickets)
    incrementAchievementProgress('miniGame:gamesPlayed')
    incrementAchievementProgress('miniGame:ticketsEarned', tickets)
    const best = loadLocalHighScore('spinner')
    const newBest = Math.max(best, tickets)
    saveLocalHighScore('spinner', newBest)
    setAchievementProgress('miniGame:spinner:bestScore', newBest)
    if (tickets === JACKPOT) incrementAchievementProgress('miniGame:spinner:jackpots')
  }, [])

  // Fire achievements once when result is first shown
  const achievementsFiredRef = useRef(false)
  if (phase === 'result' && result !== null && !achievementsFiredRef.current) {
    achievementsFiredRef.current = true
    handleResultShown(result)
  }

  const handlePlayAgain = () => {
    achievementsFiredRef.current = false
    setResult(null)
    setPhase('ready')
  }

  const canSpin = balance >= SPIN_COST && phase === 'ready'
  const isJackpot = result === JACKPOT

  return (
    <OverlayScreen title="THE LUCKY DRAW" onBack={onBack}>
      <div className="casino-screen">
        {/* Dealer */}
        <div className="casino-dealer-row">
          <img
            className="casino-dealer-img"
            src={`${(import.meta as { env: { BASE_URL: string } }).env.BASE_URL}sprites/hub-npc-dealer.svg`}
            alt="Vince the Dealer"
          />
          <div className="casino-dealer-speech">
            {phase === 'ready'   && 'Place your crystals and spin the wheel!'}
            {phase === 'spinning' && "Round and round she goes..."}
            {phase === 'result' && isJackpot && '⭐ JACKPOT! You\'re a legend!'}
            {phase === 'result' && !isJackpot && `${result} tickets! Not bad.`}
          </div>
        </div>

        {/* Roulette canvas */}
        <div className="casino-table-wrap">
          <div ref={canvasRef} className="casino-canvas" />
        </div>

        {/* Crystal balance */}
        <div className="casino-currency">💎 {balance.toLocaleString()} crystals</div>

        {/* Controls */}
        {phase === 'ready' && (
          <button
            className={`action-btn${canSpin ? ' action-btn--gold' : ''} casino-spin-btn`}
            onClick={spin}
            disabled={!canSpin}
          >
            {canSpin ? `SPIN — ${SPIN_COST} 💎` : `NEED ${SPIN_COST} 💎`}
          </button>
        )}

        {phase === 'spinning' && (
          <div className="casino-spinning-label">Spinning...</div>
        )}

        {phase === 'result' && result !== null && (
          <div className="casino-result u-col u-items-c u-gap-4">
            {isJackpot && <div className="casino-jackpot">⭐ JACKPOT! ⭐</div>}
            <div className="casino-result-headline">You won <strong>{result}</strong> 🎫</div>
            <div className="u-flex u-gap-4">
              <button className="action-btn action-btn--gold" onClick={handlePlayAgain}>SPIN AGAIN</button>
              <button className="action-btn" onClick={onBack}>LEAVE TABLE</button>
            </div>
          </div>
        )}
      </div>
    </OverlayScreen>
  )
}
