import React, { useEffect, useRef, useState } from 'react'
import { BattleEventState } from '../../game/types'

interface Props {
  event: BattleEventState | null
}

const EVENT_CONFIG: Record<string, { icon: string; className: string }> = {
  bloodMoon:  { icon: '🌑', className: 'beo--blood-moon' },
  fogOfWar:   { icon: '🌫', className: 'beo--fog-of-war' },
  supplyDrop: { icon: '📦', className: 'beo--supply-drop' },
  earthquake: { icon: '🌋', className: 'beo--earthquake' },
}

export function BattleEventOverlay({ event }: Props) {
  const [shown, setShown] = useState<BattleEventState | null>(null)
  const [visible, setVisible] = useState(false)
  const lastTypeRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!event) { lastTypeRef.current = null; return }
    // Trigger on new event type (different from last shown)
    if (event.type === lastTypeRef.current) return
    lastTypeRef.current = event.type
    setShown(event)
    setVisible(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(false), 3200)
  }, [event?.type])

  if (!shown) return null
  const cfg = EVENT_CONFIG[shown.type] ?? { icon: '⚡', className: '' }

  return (
    <div className={`beo ${cfg.className} ${visible ? 'beo--visible' : 'beo--exit'}`}
      aria-live="assertive"
    >
      <div className="beo-icon">{cfg.icon}</div>
      <div className="beo-label">{shown.label}</div>
    </div>
  )
}
