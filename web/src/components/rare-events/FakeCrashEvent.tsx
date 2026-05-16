import React, { useEffect, useState } from 'react'
import { RareEventEffect } from './types'

interface Props {
  onDone: (effect: RareEventEffect) => void
}

// Progress keyframes: [elapsed_ms, percent]
const KEYFRAMES: [number, number][] = [
  [0,     0],
  [1200,  3],
  [2500,  8],
  [3500,  14],  // ← first stall begins
  [8800,  14],  // ← stall holds for 5 seconds
  [9400,  22],
  [10200, 35],
  [10900, 48],
  [11600, 67],  // ← second stall begins
  [14800, 67],  // ← stall holds
  [15400, 81],
  [16000, 89],
  [16600, 95],
  [17200, 100],
]

function progressAt(elapsed: number): number {
  for (let i = 1; i < KEYFRAMES.length; i++) {
    const [t0, p0] = KEYFRAMES[i - 1]
    const [t1, p1] = KEYFRAMES[i]
    if (elapsed <= t1) {
      return p0 + (p1 - p0) * Math.max(0, (elapsed - t0) / (t1 - t0))
    }
  }
  return 100
}

export function FakeCrashEvent({ onDone }: Props) {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<'crash' | 'reboot'>('crash')

  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => {
      const elapsed = Date.now() - start
      const p = progressAt(elapsed)
      setProgress(Math.floor(p))
      if (elapsed >= 17200) {
        clearInterval(id)
        setPhase('reboot')
      }
    }, 100)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (phase !== 'reboot') return
    const id = setTimeout(() => {
      const killed = Math.floor(Math.random() * 2) + 2  // 2-3 units
      onDone({
        killEnemyUnits: killed,
        logMessage: `[SYSTEM] Crash recovery complete. ${killed} corrupted enemy units purged.`,
      })
    }, 2600)
    return () => clearTimeout(id)
  }, [phase, onDone])

  if (phase === 'reboot') {
    return (
      <div className="rc-screen rc-screen--reboot">
        <div className="rc-reboot-logo">JARV'S AMAZING WEB GAME</div>
        <div className="rc-reboot-spinner">▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░</div>
        <div className="rc-reboot-text">Restarting...</div>
      </div>
    )
  }

  return (
    <div className="rc-screen">
      <div className="rc-content u-col u-gap-8">
        <div className="rc-sad">:(</div>

        <p className="rc-headline">
          Your game ran into a problem and needs to restart. We're just
          collecting some error info, and then we'll restart for you.
        </p>

        <div className="rc-progress-line">
          {progress}% complete
        </div>

        <p className="rc-small">
          For more information about this issue and possible fixes, visit<br />
          https://jarvswebgame.fake/stop/GOBLIN_ILLEGAL_OPERATION
        </p>

        <p className="rc-code">
          Stop code: GOBLIN_ILLEGAL_OPERATION
        </p>
      </div>
    </div>
  )
}
