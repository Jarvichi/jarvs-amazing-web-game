// ─── Crystal Catch ────────────────────────────────────────────────────────────
// Catch falling items by clicking them before they hit the bottom.
// Crystals = +3 tickets, coins = +1, bombs = -10 (game ends if tickets hit 0).

import React, { useState, useEffect, useRef } from 'react'
import { playMinigameCorrect, playMinigameWrong } from '../../game/sound'
import { MinigameShell } from './MinigameShell'
import { MinigameResultPanel } from './MinigameResultPanel'

interface Props {
  onDone: (ticketsEarned: number) => void
}

type ItemKind = 'crystal' | 'coin' | 'bomb'

interface FallingItem {
  id:    number
  kind:  ItemKind
  x:     number   // percentage 0-90
  y:     number   // percentage 0-100
  speed: number   // % per frame
}

const ICON: Record<ItemKind, string>   = { crystal: '🔮', coin: '🪙', bomb: '💣' }
const VALUE: Record<ItemKind, number>  = { crystal: 3,    coin: 1,     bomb: -10 }
const GAME_DURATION_MS = 30000
const SPAWN_INTERVAL   = 800  // ms between new items

let nextId = 1

function randomKind(elapsed: number): ItemKind {
  const phase = Math.floor(elapsed / 8000)  // speed phase 0-3
  const bombChance = 0.12 + phase * 0.04
  const r = Math.random()
  if (r < bombChance) return 'bomb'
  if (r < bombChance + 0.35) return 'coin'
  return 'crystal'
}

export function CrystalCatch({ onDone }: Props) {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'result'>('ready')
  const [items, setItems] = useState<FallingItem[]>([])
  const [tickets, setTickets] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_MS)
  const [pops, setPops] = useState<{ id: number; x: number; y: number; label: string }[]>([])

  const ticketsRef    = useRef(0)
  const startRef      = useRef<number>(0)
  const lastSpawnRef  = useRef<number>(0)
  const rafRef        = useRef<number | null>(null)
  const doneCalledRef = useRef(false)
  // Stable ref to onDone so the animation loop always calls the latest version
  const onDoneRef     = useRef(onDone)
  useEffect(() => { onDoneRef.current = onDone }, [onDone])

  // Use a ref for the tick function so the RAF loop never holds a stale closure
  const tickRef = useRef<() => void>(() => {})

  useEffect(() => {
    tickRef.current = () => {
      const now      = Date.now()
      const elapsed  = now - startRef.current
      const remaining = GAME_DURATION_MS - elapsed

      if (remaining <= 0) {
        setTimeLeft(0)
        if (!doneCalledRef.current) {
          doneCalledRef.current = true
          if (rafRef.current) cancelAnimationFrame(rafRef.current)
          setPhase('result')
          onDoneRef.current(ticketsRef.current)
        }
        return
      }

      setTimeLeft(remaining)

      // Spawn new item
      const speedPhase = Math.floor(elapsed / 8000)
      if (now - lastSpawnRef.current > SPAWN_INTERVAL - speedPhase * 100) {
        lastSpawnRef.current = now
        const kind  = randomKind(elapsed)
        const speed = 0.6 + speedPhase * 0.15 + Math.random() * 0.2
        setItems(prev => [
          ...prev,
          { id: nextId++, kind, x: Math.random() * 85, y: 0, speed },
        ])
      }

      // Move items downward
      setItems(prev => {
        const updated: FallingItem[] = []
        for (const item of prev) {
          const newY = item.y + item.speed
          if (newY < 100) updated.push({ ...item, y: newY })
        }
        return updated
      })

      rafRef.current = requestAnimationFrame(() => tickRef.current())
    }
  })

  function startGame() {
    ticketsRef.current    = 0
    startRef.current      = Date.now()
    lastSpawnRef.current  = Date.now()
    doneCalledRef.current = false
    setTickets(0)
    setItems([])
    setTimeLeft(GAME_DURATION_MS)
    setPhase('playing')
    rafRef.current = requestAnimationFrame(() => tickRef.current())
  }

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  function catchItem(id: number, kind: ItemKind, x: number, y: number) {
    setItems(prev => prev.filter(i => i.id !== id))
    const delta = VALUE[kind]
    if (kind === 'bomb') playMinigameWrong()
    else playMinigameCorrect()
    const newTickets = Math.max(0, ticketsRef.current + delta)
    ticketsRef.current = newTickets
    setTickets(newTickets)

    // Pop label
    const label = delta >= 0 ? `+${delta}` : `${delta}`
    setPops(prev => [...prev, { id, x, y, label }])
    setTimeout(() => setPops(prev => prev.filter(p => p.id !== id)), 700)

    // Bomb ends the round if tickets hit 0
    if (kind === 'bomb' && ticketsRef.current === 0 && !doneCalledRef.current) {
      doneCalledRef.current = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      setPhase('result')
      onDoneRef.current(0)
    }
  }

  const pct = timeLeft / GAME_DURATION_MS

  return (
    <MinigameShell title="CRYSTAL CATCH" icon="💎">
      {phase === 'ready' && (
        <div className="minigame-ready u-col u-items-c u-gap-5">
          <p>Catch 🔮 crystals (+3) and 🪙 coins (+1).</p>
          <p>Avoid 💣 bombs (-10 tickets). Timer: 30 seconds.</p>
          <button className="action-btn action-btn--gold" onClick={startGame}>START</button>
        </div>
      )}

      {phase === 'playing' && (
        <>
          <div className="catch-hud">
            <span>🎫 {tickets}</span>
            <div className="catch-timer-bar-wrap">
              <div className="catch-timer-bar" style={{ width: `${pct * 100}%` }} />
            </div>
            <span>{(timeLeft / 1000).toFixed(1)}s</span>
          </div>

          <div className="catch-arena">
            {items.map(item => (
              <button
                key={item.id}
                className={`catch-item catch-item--${item.kind}`}
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
                onClick={() => catchItem(item.id, item.kind, item.x, item.y)}
                aria-label={item.kind}
              >
                {ICON[item.kind]}
              </button>
            ))}
            {pops.map(p => (
              <div
                key={p.id}
                className="catch-pop"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              >
                {p.label}
              </div>
            ))}
          </div>
        </>
      )}

      {phase === 'result' && (
        <MinigameResultPanel
          headline={`You caught ${ticketsRef.current} tickets!`}
          ctaLabel="COLLECT & EXIT"
          onCta={() => onDone(ticketsRef.current)}
        />
      )}
    </MinigameShell>
  )
}
