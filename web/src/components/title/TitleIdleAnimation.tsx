import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getCardCatalog } from '../../game/cards'
import { loadCollection } from '../../game/collection'
import { Card } from '../../game/types'
import { AnimatedSpriteImg } from '../ui/SpriteImg'
import { getAchievementProgress, incrementAchievementProgress } from '../../game/achievements'

const RANDOM_FACTS = [
  'The background has never moved. Not once.',
  'No goblins were consulted in the making of this game.',
  'Your base has feelings. It prefers not to discuss them.',
  'The enemy base is also just trying its best.',
  'Did you know: mana is technically a renewable resource?',
  'Walls don\'t have opinions, but if they did, they\'d be cautious.',
  'According to statistics, you are currently playing this game.',
  'Approximately 0% of battles have ended in a polite agreement.',
  'Time spent on the title screen is not wasted. Probably.',
  'Fun fact: this message was not written by the unit you\'re looking at.',
  'The number of times you\'ve blinked since opening this game is unknown to science.',
  'This unit is not thinking about anything in particular.',
  'There are no known diplomatic relationships between any two cards.',
  'Combat is just disagreement with extra steps.',
  'Some units have never been deployed. They seem fine with it.',
  'The title screen has been here the whole time.',
  'Studies suggest that tapping the screen achieves various results.',
  'Somewhere, a goblin is being deployed into a battle it did not start.',
  'Units do not experience the passage of time between battles. Lucky them.',
  'The crystal economy remains robust and largely unexplained.',
]

function buildMessages(card: Card): string[] {
  const msgs: string[] = []

  if (card.lore) msgs.push(card.lore)

  const kills = getAchievementProgress(`kill:${card.name}`)
  if (kills > 0) {
    const killMsgs = [
      `You've slain ${kills.toLocaleString()} of my kind. Not that I'm keeping score.`,
      `${kills.toLocaleString()} of us have fallen under your command. We've noticed.`,
      `I've been defeated ${kills.toLocaleString()} time${kills === 1 ? '' : 's'} so far. I'm choosing to see it as experience.`,
      `Death count: ${kills.toLocaleString()}. This is fine.`,
    ]
    msgs.push(killMsgs[kills % killMsgs.length])
  }

  if (card.unit) {
    const u = card.unit
    const tags = u.tags?.join(', ') ?? 'unknown'
    msgs.push(`ATK ${u.attack} · HP ${u.maxHp} · Tags: ${tags}. These are just numbers. I am more than numbers.`)
  }

  msgs.push(RANDOM_FACTS[Math.floor(Math.random() * RANDOM_FACTS.length)])

  return msgs
}

const INACTIVITY_MS = 30_000
const DISPLAY_MS = 10_000
const WALK_IN_MS = 1_800
const WALK_OUT_MS = 1_500
const WALK_OUT_FAST_MS = 600

type Side = 'left' | 'right'

interface VisitorState {
  card: Card
  side: Side
  message: string
}

export function TitleIdleAnimation() {
  // Phase: idle → appearing → visible → disappearing
  const [phase, setPhase] = useState<'idle' | 'appearing' | 'visible' | 'disappearing'>('idle')
  const [visitor, setVisitor] = useState<VisitorState | null>(null)
  const [fastExit, setFastExit] = useState(false)
  // atCenter drives the CSS transform transition (false = off-screen, true = centered)
  const [atCenter, setAtCenter] = useState(false)

  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const addTimer = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }
  const clearAllTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  // Ref to the "schedule next visit" fn so walk-out can restart the cycle automatically
  const scheduleNextRef = useRef<() => void>(() => {})
  // Timestamp when the unit became visible — used for the tap grace period
  const visibleAtRef = useRef<number>(0)

  const startWalkOut = useCallback((fast: boolean) => {
    clearAllTimers()
    setFastExit(fast)
    setAtCenter(false)
    setPhase('disappearing')
    phaseRef.current = 'disappearing'
    addTimer(() => {
      setPhase('idle')
      setVisitor(null)
      setAtCenter(false)
      phaseRef.current = 'idle'
      // Automatically restart the cycle so the next visitor appears without
      // needing the user to interact first
      scheduleNextRef.current()
    }, fast ? WALK_OUT_FAST_MS + 100 : WALK_OUT_MS + 100)
  }, [])

  const startAnimation = useCallback(() => {
    if (phaseRef.current !== 'idle') return

    const catalog    = getCardCatalog()
    const collection = loadCollection()
    const owned      = new Set(collection.filter(e => e.count > 0).map(e => e.cardName))
    const candidates = catalog.filter(c => {
      if (c.cardType !== 'unit' || !c.unit) return false
      if (c.unit.isWall || c.unit.moveSpeed === 0) return false
      return owned.has(c.name)
    })
    if (candidates.length === 0) return

    const card = candidates[Math.floor(Math.random() * candidates.length)]
    const side: Side = Math.random() < 0.5 ? 'left' : 'right'
    const messages = buildMessages(card)
    const message = messages[Math.floor(Math.random() * messages.length)]

    incrementAchievementProgress('misc:title_idle_seen')

    setFastExit(false)
    setAtCenter(false)
    setVisitor({ card, side, message })
    setPhase('appearing')
    phaseRef.current = 'appearing'

    // One rAF double-pump so element is in DOM at off-screen position before we animate
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAtCenter(true)
        addTimer(() => {
          if (phaseRef.current !== 'appearing') return
          setPhase('visible')
          phaseRef.current = 'visible'
          visibleAtRef.current = Date.now()
          addTimer(() => {
            if (phaseRef.current === 'visible') startWalkOut(false)
          }, DISPLAY_MS)
        }, WALK_IN_MS)
      })
    })
  }, [startWalkOut])

  // Inactivity tracking — resets on any user interaction while idle
  useEffect(() => {
    let inactivityId: ReturnType<typeof setTimeout>

    const scheduleNext = () => {
      clearTimeout(inactivityId)
      inactivityId = setTimeout(() => {
        if (phaseRef.current === 'idle') startAnimation()
      }, INACTIVITY_MS)
    }

    // Expose so walk-out can restart the cycle automatically
    scheduleNextRef.current = scheduleNext

    const onInteraction = () => {
      if (phaseRef.current === 'idle') scheduleNext()
    }

    scheduleNext()
    window.addEventListener('mousemove', onInteraction)
    window.addEventListener('touchstart', onInteraction, { passive: true })
    window.addEventListener('keydown', onInteraction)

    return () => {
      clearTimeout(inactivityId)
      window.removeEventListener('mousemove', onInteraction)
      window.removeEventListener('touchstart', onInteraction)
      window.removeEventListener('keydown', onInteraction)
    }
  }, [startAnimation])

  // Clean up timers on unmount
  useEffect(() => () => clearAllTimers(), [])

  const handleTap = useCallback(() => {
    if (phaseRef.current !== 'visible') return
    // Grace period: ignore taps in the first 600 ms after becoming visible so
    // synthetic mobile click events from earlier touches don't instantly dismiss
    if (Date.now() - visibleAtRef.current < 600) return
    incrementAchievementProgress('misc:title_idle_tap')
    startWalkOut(true)
  }, [startWalkOut])

  if (!visitor || phase === 'idle') return null

  const { card, side, message } = visitor

  // X position: off-screen left, center, or off-screen right.
  // Base is left:50%, so -50% (of own width) keeps it truly centred.
  // Add ±120vw to push it fully off-screen on either side.
  const offLeft = 'translateX(calc(-50% - 120vw))'
  const offRight = 'translateX(calc(-50% + 120vw))'
  const center = 'translateX(-50%)'

  let translateX: string
  if (atCenter) {
    translateX = center
  } else if (phase === 'disappearing') {
    // Continue in direction of travel: left-entering unit walks off to the right
    translateX = side === 'left' ? offRight : offLeft
  } else {
    // appearing: start off-screen on entry side
    translateX = side === 'left' ? offLeft : offRight
  }

  const transitionDuration =
    phase === 'appearing' ? `${WALK_IN_MS}ms` :
    phase === 'disappearing' ? `${fastExit ? WALK_OUT_FAST_MS : WALK_OUT_MS}ms` :
    '0ms'

  const unitStyle: React.CSSProperties = {
    transform: translateX,
    transition: `transform ${transitionDuration} linear`,
  }

  // Flip sprite so unit faces inward (left-entering unit faces right, right-entering faces left)
  const spriteFlip: React.CSSProperties = {
    transform: side === 'right' ? 'scaleX(-1)' : undefined,
  }

  const showBubble = phase === 'visible'
  const isClickable = phase === 'visible'

  return (
    <div
      className={`title-idle-overlay${isClickable ? ' title-idle-overlay--active' : ''}`}
      onClick={isClickable ? handleTap : undefined}
    >
      <div className="title-idle-unit u-absolute u-col u-items-c u-gap-2" style={unitStyle}>
        {showBubble && (
          <div className="title-idle-bubble">
            <p className="title-idle-bubble-text">{message}</p>
            <div className="title-idle-bubble-tail" />
          </div>
        )}
        <div className="title-idle-sprite-wrap u-flex u-just-c" style={spriteFlip}>
          <AnimatedSpriteImg name={card.name} frameCount={3} fps={8} className="title-idle-sprite" />
        </div>
      </div>
    </div>
  )
}
