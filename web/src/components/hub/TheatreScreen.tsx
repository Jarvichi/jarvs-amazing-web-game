// ─── Curtain Call — Crown Theatre stage performance ──────────────────────────
// A marker sweeps back and forth across the stage; click CUE! to land it in
// the highlighted zone. 5 acts, each a little faster and narrower than the
// last. Grade per act: Miss / Good / Perfect. Free to play — rewards tickets.

import React, { useEffect, useRef, useState } from 'react'
import { playMinigameCorrect, playMinigameWrong } from '../../game/sound'
import { addTickets } from '../../game/miniGames'
import { incrementAchievementProgress, setAchievementProgress } from '../../game/achievements'

interface Props {
  onBack: () => void
}

type Grade = 'miss' | 'good' | 'perfect'

const TOTAL_ACTS = 5
const TICKETS: Record<Grade, number> = { miss: 0, good: 10, perfect: 20 }
const GRADE_LABEL: Record<Grade, string> = { miss: 'MISS', good: 'GOOD', perfect: 'PERFECT!' }

// Zone half-width (% of the 0-100 bar) shrinks each act; sweep period speeds up.
function actZoneHalfWidth(act: number): number {
  return 16 - act * 2 // act 0..4 -> 16..8
}
function actPeriodMs(act: number): number {
  return 1600 - act * 150 // act 0..4 -> 1600..1000
}

function randomZoneCenter(halfWidth: number): number {
  return halfWidth + 10 + Math.random() * (100 - 2 * (halfWidth + 10))
}

export function TheatreScreen({ onBack }: Props) {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'result'>('ready')
  const [act, setAct] = useState(0)
  const [markerPos, setMarkerPos] = useState(0)
  const [zoneCenter, setZoneCenter] = useState(50)
  const [grades, setGrades] = useState<Grade[]>([])
  const [flash, setFlash] = useState<Grade | null>(null)

  const startRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const actRef = useRef(0)
  const zoneCenterRef = useRef(50)
  const lockedRef = useRef(false)

  const tickRef = useRef<() => void>(() => {})
  useEffect(() => {
    tickRef.current = () => {
      const a = actRef.current
      const period = actPeriodMs(a)
      const elapsed = (Date.now() - startRef.current) % period
      const t = elapsed / period // 0..1
      // Triangle wave 0 -> 100 -> 0
      const pos = t < 0.5 ? t * 2 * 100 : (1 - t) * 2 * 100
      setMarkerPos(pos)
      rafRef.current = requestAnimationFrame(() => tickRef.current())
    }
  })

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  function startAct(actIndex: number) {
    actRef.current = actIndex
    const halfWidth = actZoneHalfWidth(actIndex)
    const center = randomZoneCenter(halfWidth)
    zoneCenterRef.current = center
    setZoneCenter(center)
    setAct(actIndex)
    lockedRef.current = false
    startRef.current = Date.now()
    setPhase('playing')
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => tickRef.current())
  }

  function startGame() {
    setGrades([])
    startAct(0)
  }

  function cue() {
    if (phase !== 'playing' || lockedRef.current) return
    lockedRef.current = true
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const halfWidth = actZoneHalfWidth(actRef.current)
    const dist = Math.abs(markerPos - zoneCenterRef.current)
    let grade: Grade
    if (dist > halfWidth) grade = 'miss'
    else if (dist > halfWidth * 0.4) grade = 'good'
    else grade = 'perfect'

    if (grade === 'miss') playMinigameWrong()
    else playMinigameCorrect()

    setFlash(grade)
    setGrades(prev => [...prev, grade])
    setTimeout(() => {
      setFlash(null)
      const nextAct = actRef.current + 1
      if (nextAct >= TOTAL_ACTS) {
        finishShow([...grades, grade])
      } else {
        startAct(nextAct)
      }
    }, 700)
  }

  function finishShow(finalGrades: Grade[]) {
    const total = finalGrades.reduce((sum, g) => sum + TICKETS[g], 0)
    addTickets(total)
    incrementAchievementProgress('miniGame:gamesPlayed')
    incrementAchievementProgress('miniGame:ticketsEarned', total)
    setAchievementProgress('miniGame:theatre:bestScore', total)
    setPhase('result')
  }

  const total = grades.reduce((sum, g) => sum + TICKETS[g], 0)
  const perfectCount = grades.filter(g => g === 'perfect').length

  function applauseHeadline(): string {
    if (perfectCount === TOTAL_ACTS) return '⭐ STANDING OVATION! ⭐'
    if (total >= 70) return 'A rousing ovation!'
    if (total >= 40) return 'Warm applause.'
    if (total > 0) return 'Scattered, polite applause...'
    return 'The crowd shuffles out in silence.'
  }

  const halfWidth = actZoneHalfWidth(act)

  return (
    <div className="minigame-screen theatre-screen">
      <div className="minigame-title">🎭 CURTAIN CALL</div>

      {phase === 'ready' && (
        <div className="minigame-ready u-col u-items-c u-gap-5">
          <p>Time your cue to land the marker in the golden zone.</p>
          <p>5 acts — each faster and tighter than the last.</p>
          <button className="action-btn action-btn--gold" onClick={startGame}>TAKE THE STAGE</button>
        </div>
      )}

      {phase === 'playing' && (
        <>
          <div className="theatre-act-counter">Act {act + 1} / {TOTAL_ACTS}</div>

          <div className="theatre-stage">
            <div
              className="theatre-zone"
              style={{ left: `${zoneCenter - halfWidth}%`, width: `${halfWidth * 2}%` }}
            />
            <div className="theatre-marker" style={{ left: `${markerPos}%` }} />
          </div>

          {flash && (
            <div className={`theatre-flash theatre-flash--${flash}`}>{GRADE_LABEL[flash]}</div>
          )}

          <button className="action-btn action-btn--gold theatre-cue-btn" onClick={cue} disabled={lockedRef.current}>
            CUE!
          </button>
        </>
      )}

      {phase === 'result' && (
        <div className="minigame-result-panel u-col u-items-c u-gap-5">
          <div className="minigame-result-headline">{applauseHeadline()}</div>
          <div className="minigame-result-breakdown">
            {grades.map((g, i) => (
              <div key={i}>Act {i + 1}: {GRADE_LABEL[g]} — +{TICKETS[g]} 🎫</div>
            ))}
            <div className="minigame-result-total">Total: {total} 🎫</div>
          </div>
          <button className="action-btn action-btn--gold" onClick={onBack}>
            COLLECT &amp; EXIT
          </button>
        </div>
      )}
    </div>
  )
}
