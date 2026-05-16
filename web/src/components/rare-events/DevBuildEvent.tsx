import React, { useEffect, useState } from 'react'
import { RareEventEffect } from './types'

interface Props {
  onDone: (effect: RareEventEffect) => void
}

const LOG_LINES = [
  '[DEBUG] Initialising combat tick loop... OK',
  '[DEBUG] Loading unit templates... 394 definitions found',
  '[WARN]  Mana overflow on opponent deck (expected < 6, got 6)',
  '[DEBUG] Pathfinding grid: 64x12 nodes, 0 blocked',
  '[ERROR] NullRefException: unit.target is null at CombatResolver.resolveAttack()',
  '[DEBUG] Retrying with fallback target...',
  '[WARN]  Fallback triggered 47 times this battle. Investigating.',
  '[DEBUG] Enemy wave scheduler: interval=1200ms, next=NOW',
  '[INFO]  Patch candidate found — applying hotfix b7a2c9f...',
  '[INFO]  Diff: opponentBase.hp -= 30  // TODO: revert before ship',
  '[INFO]  Hotfix applied. Resume combat.',
]

export function DevBuildEvent({ onDone }: Props) {
  const [visibleLines, setVisibleLines] = useState<string[]>([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      if (i < LOG_LINES.length) {
        setVisibleLines(prev => [...prev, LOG_LINES[i]])
        i++
      } else {
        clearInterval(id)
        setTimeout(() => setDone(true), 800)
      }
    }, 380)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!done) return
    const id = setTimeout(() => {
      onDone({
        damage: 30,
        logMessage: '[HOTFIX b7a2c9f] Enemy base -30 HP. Do not ship this.',
      })
    }, 1200)
    return () => clearTimeout(id)
  }, [done, onDone])

  return (
    <div className="dev-build-overlay u-absolute u-col u-items-c u-just-c">
      <div className="dev-build-header">
        ⚠ INTERNAL BUILD — NOT FOR DISTRIBUTION
      </div>
      <div className="dev-build-log">
        {visibleLines.map((line, i) => (
          <div
            key={i}
            className={
              line.startsWith('[ERROR]') ? 'dev-log-error' :
              line.startsWith('[WARN]')  ? 'dev-log-warn'  :
              line.startsWith('[INFO]')  ? 'dev-log-info'  : 'dev-log-debug'
            }
          >{line}</div>
        ))}
        {done && (
          <div className="dev-log-info dev-build-done">✓ Hotfix deployed. Resuming combat.</div>
        )}
      </div>
    </div>
  )
}
