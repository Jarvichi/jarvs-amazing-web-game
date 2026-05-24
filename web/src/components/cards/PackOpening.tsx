import React, { useEffect, useRef, useState } from 'react'
import { getCardCatalog } from '../../game/cards'
import { rarityStars } from '../../game/cards'
import { addCardsToCollection } from '../../game/collection'
import { getAugmentCatalog } from '../../game/augments'
import { CardTile } from './CardTile'
import { ModalBackdrop } from '../ui/ModalBackdrop'
import { useCardDetail } from './useCardDetail'

interface Props {
  /** One or more packs; each pack is an array of card names in reveal order */
  packs: string[][]
  onDone: () => void
}

const TAP_REQUIRED: Partial<Record<string, number>> = { rare: 3, legendary: 5 }

function rarityColor(rarity: string | undefined): string {
  if (rarity === 'legendary' || rarity === 'mythic') return '#ffcc00'
  if (rarity === 'epic') return '#cc55ff'
  if (rarity === 'rare') return '#5599ff'
  if (rarity === 'uncommon') return '#55cc55'
  return 'inherit'
}

export function PackOpening({ packs, onDone }: Props) {
  const catalog = [...getCardCatalog(), ...getAugmentCatalog()]

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
  const [showSummary, setShowSummary] = useState(false)

  // Track which packs have already had addCardsToCollection called
  const processedPacks = useRef<Set<number>>(new Set())

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
      if (!processedPacks.current.has(packIdxRef.current)) {
        processedPacks.current.add(packIdxRef.current)
        addCardsToCollection(pack.map(name => ({ cardName: name, count: 1 })))
      }
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

  function handleSkip() {
    packs.forEach((p, i) => {
      if (!processedPacks.current.has(i)) {
        processedPacks.current.add(i)
        addCardsToCollection(p.map(name => ({ cardName: name, count: 1 })))
      }
    })
    setShowSummary(true)
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
              <div className="pack-card-reveal u-col u-items-c u-gap-2">
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

  const allCardNames = packs.flat()
  const allCardObjects = allCardNames.map(name => catalog.find(c => c.name === name) ?? null)

  return (
    <div className="pack-screen u-col u-items-c u-just-c u-grow u-gap-7">
      <div className="pack-title">✦ PACK OPENED ✦</div>
      {isMultiPack ? (
        <div className="pack-subtitle">Pack {packIdx + 1} of {packs.length}</div>
      ) : (
        <div className="pack-subtitle">You earned a reward for winning!</div>
      )}

      <div className="pack-rows u-col u-items-c u-gap-5" key={packIdx}>
        <div className="pack-cards u-flex u-gap-4 u-just-c">{row1.map((card, i) => renderCard(card, i))}</div>
        {row2.length > 0 && (
          <div className="pack-cards u-flex u-gap-4 u-just-c">{row2.map((card, i) => renderCard(card, i + 3))}</div>
        )}
      </div>

      {allDone ? (
        <button className="action-btn action-btn--large" onClick={onDone}>
          CONTINUE →
        </button>
      ) : (
        <div className="pack-wait" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span>{waitingForTap ? 'Tap the card to reveal it!' : 'Revealing…'}</span>
          {isMultiPack && (
            <button className="action-btn" style={{ fontSize: 11, padding: '4px 12px' }} onClick={handleSkip}>
              Skip to end
            </button>
          )}
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

      {showSummary && (
        <ModalBackdrop onClose={onDone} zIndex={300}>
          <div className="daily-modal" style={{ maxWidth: 360, textAlign: 'left' }}>
            <div className="daily-modal-header">✦ ALL CARDS</div>
            <div className="daily-modal-sub">
              {allCardNames.length} card{allCardNames.length !== 1 ? 's' : ''} across {packs.length} packs
            </div>
            <div style={{ width: '100%', maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {allCardObjects.map((card, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', borderBottom: '1px solid #222' }}>
                  <span>{card?.name ?? '?'}</span>
                  <span style={{ color: rarityColor(card?.rarity) }}>{rarityStars(card?.rarity ?? 'common')}</span>
                </div>
              ))}
            </div>
            <button className="action-btn" onClick={onDone}>CONTINUE →</button>
          </div>
        </ModalBackdrop>
      )}
    </div>
  )
}
