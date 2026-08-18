import React, { useEffect, useRef, useState } from 'react'

const LOW_HP_PCT = 0.25
const FLASH_MS = 220

interface Props {
  current: number
  max: number
  color: string
}

/** Base/unit HP bar — flashes white on any HP decrease and switches to a
 *  pulsing danger state below 25% so a base about to fall reads as urgent,
 *  not just "a shorter bar than before". */
export function HpBar({ current, max, color }: Props) {
  const pct = Math.max(0, (current / max) * 100)
  const low = pct > 0 && pct <= LOW_HP_PCT * 100
  const prevRef = useRef(current)
  const [flashing, setFlashing] = useState(false)

  useEffect(() => {
    if (current < prevRef.current) {
      setFlashing(true)
      const id = setTimeout(() => setFlashing(false), FLASH_MS)
      prevRef.current = current
      return () => clearTimeout(id)
    }
    prevRef.current = current
  }, [current])

  return (
    <div className={`hp-bar-track${low ? ' hp-bar-track--low' : ''}${flashing ? ' hp-bar-track--flash' : ''}`}>
      <div className="hp-bar-fill" style={{ width: `${pct}%`, background: color }} />
      <span className="hp-bar-text">{current}/{max}</span>
    </div>
  )
}
