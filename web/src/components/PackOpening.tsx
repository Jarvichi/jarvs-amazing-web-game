import React, { useEffect, useRef, useState } from 'react'
import { getCardCatalog } from '../game/cards'
import { rarityStars } from '../game/cards'
import { addCardsToCollection } from '../game/collection'
import { CardTile } from './CardTile'
import { useCardDetail } from './useCardDetail'

interface Props {
  /** One or more packs; each pack is an array of card names in reveal order */
  packs: string[][]
  onDone: () => void
}

const TAP_REQUIRED: Partial<Record<string, number>> = { rare: 3, legendary: 5 }

export function PackOpening({ packs, onDone }: Props) {
  const catalog = getCardCatalog()

  // Which pack we're currently opening
  const [packIdx, setPackIdx] = useState(0)
  const packIdxRef = useRef(0)

  const pack = packs[packIdx] ?? []

  const [revealed, setRevealed] = useState(0)
  const [flippingOut, setFlippingOut] = useState<Set<number>>(new Set())
  const [tapCounts, setTapCounts] = useState<Record<number, number>>({})
  const tapCountsRef = useRef<Record<number, number>>({})
  const decayTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const [wobbleKeys, setWobbleKeys] = useState<Record<number, number>>({})
  const [allDone, setAllDone] = useState(false)
  const [spotlightCard, setSpotlightCard] = useState<number | null>(null)
  const [spotlightExiting, setSpotlightExiting] = useState(false)

  // Clean up decay timers on unmount
  useEffect(() => () => { Object.values(decayTimers.current).forEach(clearTimeout) }, [])
  const { openDetail, cardDetailNode } = useCardDetail()

  const cards = pack.map(name => catalog.find(c => c.name === name) ?? null)

  function advanceToNextPack() {
    const nextIdx = packIdxRef.current + 1
    packIdxRef.current = nextIdx
    setPackIdx(nextIdx)
    setRevealed(0)
    setFlippingOut(new Set())
    setTapCounts({})
    tapCountsRef.current = {}
    Object.values(decayTimers.current).forEach(clearTimeout)
    decayTimers.current = {}
    setWobbleKeys({})
    setSpotlightCard(null)
    setSpotlightExiting(false)
  }

  function revealCard(i: number) {
    setFlippingOut(prev => new Set([...prev, i]))
    setTimeout(() => {
      setFlippingOut(prev => { const s = new Set(prev); s.delete(i); return s })
      setRevealed(r => r + 1)
    }, 180)
  }

  // Show spotlight when a tap-required card becomes current
  useEffect(() => {
    if (revealed >= pack.length) return
    const card = cards[revealed]
    const rarity = card?.rarity ?? 'common'
    if ((TAP_REQUIRED[rarity] ?? 0) > 0) {
      setSpotlightCard(revealed)
      setSpotlightExiting(false)
    }
  }, [revealed])

  // Auto-advance for common/uncommon; pause for rare/legendary until tapped
  // When all cards in the current pack are revealed, advance to next pack or finish
  useEffect(() => {
    if (revealed >= pack.length && pack.length > 0) {
      addCardsToCollection(pack.map(name => ({ cardName: name, count: 1 })))
      if (packIdxRef.current < packs.length - 1) {
        const t = setTimeout(advanceToNextPack, 1000)
        return () => clearTimeout(t)
      } else {
        setAllDone(true)
      }
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
      if (next > 0) scheduleDecay(i)
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
      setSpotlightExiting(true)
      setTimeout(() => {
        setSpotlightCard(null)
        setSpotlightExiting(false)
        revealCard(i)
      }, 260)
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
    const isSpotlighted = spotlightCard === i
    const slotClasses = [
      'pack-card-slot',
      isFlippingOut ? 'pack-card-slot--flipping' : '',
      isRevealed ? 'pack-card-slot--revealed' : '',
      !isRevealed && !isFlippingOut && (rarity === 'legendary' || rarity === 'rare') ? `pack-card-slot--glow-${rarity}` : '',
      isSpotlighted ? 'pack-card-slot--spotlighted' : '',
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
                <CardTile card={card} canAfford={true} onClick={allDone ? () => openDetail(card) : undefined} />
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

  const isMultiPack = packs.length > 1

  return (
    <div className="pack-screen">
      <div className="pack-title">✦ PACK OPENED ✦</div>
      {isMultiPack ? (
        <div className="pack-subtitle">Pack {packIdx + 1} of {packs.length}</div>
      ) : (
        <div className="pack-subtitle">You earned a reward for winning!</div>
      )}

      <div className="pack-rows" key={packIdx}>
        <div className="pack-cards">{row1.map((card, i) => renderCard(card, i))}</div>
        {row2.length > 0 && (
          <div className="pack-cards">{row2.map((card, i) => renderCard(card, i + 3))}</div>
        )}
      </div>

      {allDone ? (
        <button className="action-btn action-btn--large" onClick={onDone}>
          CONTINUE →
        </button>
      ) : (
        <div className="pack-wait">
          {waitingForTap ? 'Tap the card to reveal it!' : 'Revealing…'}
        </div>
      )}

      {cardDetailNode}

      {/* Spotlight overlay for tap-required cards */}
      {spotlightCard !== null && (() => {
        const sc = cards[spotlightCard]
        const rarity = sc?.rarity ?? 'rare'
        const tapsNeeded = TAP_REQUIRED[rarity] ?? 0
        const tapsGiven = tapCounts[spotlightCard] ?? 0
        return (
          <div
            className={`pack-spotlight-overlay${spotlightExiting ? ' pack-spotlight-overlay--exiting' : ''}`}
            onClick={() => handleTap(spotlightCard)}
          >
            <div className={`pack-spotlight-card pack-spotlight-card--${rarity}`}>
              <div
                key={`ws-${wobbleKeys[spotlightCard] ?? 0}`}
                className={`pack-card-hidden pack-card-hidden--spotlight${(wobbleKeys[spotlightCard] ?? 0) > 0 ? ' pack-wobble' : ''}`}
              >
                <div className="pack-hidden-question">?</div>
                <div className="pack-hidden-dots">
                  {Array.from({ length: tapsNeeded }).map((_, t) => (
                    <span key={t} className={`pack-dot${t < tapsGiven ? ' pack-dot--filled' : ''}`} />
                  ))}
                </div>
                <div className="pack-hidden-tap">TAP!</div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
