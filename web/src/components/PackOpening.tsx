import React, { useEffect, useRef, useState } from 'react'
import { getCardCatalog } from '../game/cards'
import { rarityStars } from '../game/cards'
import { addCardsToCollection } from '../game/collection'
import { CardTile } from './CardTile'
import { useCardDetail } from './useCardDetail'

interface Props {
  /** Array of 5 card names in reveal order */
  pack: string[]
  onDone: () => void
}

const TAP_REQUIRED: Partial<Record<string, number>> = { rare: 3, legendary: 5 }

export function PackOpening({ pack, onDone }: Props) {
  const catalog = getCardCatalog()
  const [revealed, setRevealed] = useState(0)
  const [flippingOut, setFlippingOut] = useState<Set<number>>(new Set())
  const [tapCounts, setTapCounts] = useState<Record<number, number>>({})
  const tapCountsRef = useRef<Record<number, number>>({})
  const decayTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const [wobbleKeys, setWobbleKeys] = useState<Record<number, number>>({})
  const [done, setDone] = useState(false)

  // Clean up decay timers on unmount
  useEffect(() => () => { Object.values(decayTimers.current).forEach(clearTimeout) }, [])
  const { openDetail, cardDetailNode } = useCardDetail()

  const cards = pack.map(name => catalog.find(c => c.name === name) ?? null)

  function revealCard(i: number) {
    setFlippingOut(prev => new Set([...prev, i]))
    setTimeout(() => {
      setFlippingOut(prev => { const s = new Set(prev); s.delete(i); return s })
      setRevealed(r => r + 1)
    }, 180)
  }

  // Auto-advance for common/uncommon; pause for rare/legendary until tapped
  useEffect(() => {
    if (revealed >= pack.length) {
      addCardsToCollection(pack.map(name => ({ cardName: name, count: 1 })))
      setDone(true)
      return
    }
    const card = cards[revealed]
    const rarity = card?.rarity ?? 'common'
    if ((TAP_REQUIRED[rarity] ?? 0) > 0) return // wait for taps

    const delay = revealed === 0 ? 600 : 800
    const flipTimer = setTimeout(() => revealCard(revealed), delay)
    return () => clearTimeout(flipTimer)
  }, [revealed, pack.length])

  function setCount(i: number, n: number) {
    tapCountsRef.current[i] = n
    setTapCounts(prev => ({ ...prev, [i]: n }))
  }

  function scheduleDecay(i: number) {
    clearTimeout(decayTimers.current[i])
    decayTimers.current[i] = setTimeout(() => {
      const cur = tapCountsRef.current[i] ?? 0
      if (cur <= 0) return
      const next = cur - 1
      setCount(i, next)
      if (next > 0) scheduleDecay(i) // cascade: keep decaying until 0
    }, 500)
  }

  function handleTap(i: number) {
    const card = cards[i]
    const rarity = card?.rarity ?? 'common'
    const tapsNeeded = TAP_REQUIRED[rarity] ?? 0
    const current = tapCountsRef.current[i] ?? 0
    if (current >= tapsNeeded) return

    clearTimeout(decayTimers.current[i])
    const newCount = current + 1
    setCount(i, newCount)
    if (newCount >= tapsNeeded) {
      revealCard(i)
    } else {
      setWobbleKeys(prev => ({ ...prev, [i]: (prev[i] ?? 0) + 1 }))
      scheduleDecay(i)
    }
  }

  function renderCard(card: typeof cards[0], i: number) {
    const rarity = card?.rarity ?? 'common'
    const tapsNeeded = TAP_REQUIRED[rarity] ?? 0
    const tapsGiven = tapCounts[i] ?? 0
    const isRevealed = i < revealed
    const isWaiting = i === revealed && tapsNeeded > 0 && tapsGiven < tapsNeeded

    const isFlippingOut = flippingOut.has(i)
    const slotClasses = [
      'pack-card-slot',
      isFlippingOut ? 'pack-card-slot--flipping' : '',
      isRevealed ? 'pack-card-slot--revealed' : '',
      !isRevealed && !isFlippingOut && (rarity === 'legendary' || rarity === 'rare') ? `pack-card-slot--glow-${rarity}` : '',
    ].filter(Boolean).join(' ')

    return (
      <div
        key={i}
        className={slotClasses}
        style={{ animationDelay: `${i * 80}ms` }}
        onClick={isWaiting ? () => handleTap(i) : undefined}
      >
        <div className="pack-card-flip">
          <div className="pack-card-back">
            {/* remount on each tap to retrigger wobble animation */}
            <div
              key={`w-${wobbleKeys[i] ?? 0}`}
              className={`pack-card-hidden${(wobbleKeys[i] ?? 0) > 0 ? ' pack-wobble' : ''}`}
            >
              {isWaiting ? (
                <>
                  <div className="pack-hidden-question">?</div>
                  <div className="pack-hidden-dots">
                    {Array.from({ length: tapsNeeded }).map((_, t) => (
                      <span key={t} className={`pack-dot${t < tapsGiven ? ' pack-dot--filled' : ''}`} />
                    ))}
                  </div>
                  <div className="pack-hidden-tap">TAP!</div>
                </>
              ) : '?'}
            </div>
          </div>
          <div className="pack-card-front">
            {card ? (
              <div className="pack-card-reveal">
                <CardTile card={card} canAfford={true} onClick={done ? () => openDetail(card) : undefined} />
                <div className={`pack-card-rarity pack-card-rarity--${card.rarity}`}>
                  {rarityStars(card.rarity)}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  const row1 = cards.slice(0, 3)
  const row2 = cards.slice(3)

  const waitingForTap = revealed < pack.length && (TAP_REQUIRED[cards[revealed]?.rarity ?? 'common'] ?? 0) > 0

  return (
    <div className="pack-screen">
      <div className="pack-title">✦ PACK OPENED ✦</div>
      <div className="pack-subtitle">You earned a reward for winning!</div>

      <div className="pack-rows">
        <div className="pack-cards">{row1.map((card, i) => renderCard(card, i))}</div>
        {row2.length > 0 && (
          <div className="pack-cards">{row2.map((card, i) => renderCard(card, i + 3))}</div>
        )}
      </div>

      {done ? (
        <button className="action-btn action-btn--large" onClick={onDone}>
          CONTINUE →
        </button>
      ) : (
        <div className="pack-wait">{waitingForTap ? 'Tap the card to reveal it!' : 'Revealing…'}</div>
      )}

      {cardDetailNode}
    </div>
  )
}
