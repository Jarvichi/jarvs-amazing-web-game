import React, { useState, useEffect } from 'react'
import { CRYSTAL_PACK_COST, addCardsToCollection } from '../../game/collection'
import { incrementAchievementProgress } from '../../game/achievements'
import {
  getDailyShopNPC,
  getDailyShopCards,
  getDailyShopSellSlots,
  getDailyShopAugment,
  loadDailyShopState,
  saveDailyShopState,
  getSecondsUntilShopReset,
  getSecondsUntilShiftEnd,
  logDevSchedule,
  isWeekend,
  ShopCardDeal,
  ShopAugmentDeal,
  recordNPCVisit,
} from '../../game/shopSchedule'
import { getAugmentCard, augmentSlotLabel } from '../../game/augments'
import { addAugmentInstance } from '../../game/collection'
import { loadInventory, removeFromInventory } from '../../game/dailyLogin'
import { ALL_CONSUMABLES, addToConsumableStash } from '../../game/questline'
import { saveCrystals } from '../../game/collection'
import { emitSound } from '../../game/sound'
import { SpriteImg } from '../ui/SpriteImg'
import { OverlayScreen } from '../ui/OverlayScreen'
import { getCardCatalog } from '../../game/cards'
import { CardTile } from '../cards/CardTile'

const UPGRADE_SPRITE: Record<string, string> = {
  buffAttack: 'upgrade-attack',
  healUnits:  'upgrade-heal',
  buffSpeed:  'upgrade-speed',
  buffMaxHp:  'upgrade-hp',
  buffRange:  'upgrade-range',
}

function spriteName(cardName: string): string {
  const card = getCardCatalog().find(c => c.name === cardName)
  if (!card) return cardName
  if (card.cardType === 'upgrade' && card.upgradeEffect) {
    return UPGRADE_SPRITE[card.upgradeEffect.type] ?? 'upgrade'
  }
  return cardName
}

// Shopkeeper rejection lines — always picky, never suspicious
const REJECTION_LINES = [
  "Hmm. Close, but this one has too much character. I need a mint-condition specimen.",
  "The provenance is all wrong — I specifically need one acquired on a Tuesday.",
  "Ah, yes... but this variety has a slightly off-centre weight distribution. Not what I'm after.",
  "I can see it's been well-loved. Mine needs to be completely untouched.",
  "The colour's faded just a touch. I'm holding out for the original hue.",
  "It's the right item, but the wrong season's batch. Try again next time.",
  "Nearly perfect — but I need one with no scratches on the underside.",
  "I appreciate the effort. Unfortunately I've become very particular about the grain.",
  "This one smells faintly of adventure. I need one that's never left a pocket.",
  "Fascinating specimen, truly. But I've already committed to sourcing one locally.",
  "The edges are just slightly worn. I'm looking for factory-fresh only.",
  "You're the third person today. None of you have quite the right one.",
  "Wonderful. Truly. But I made a promise to myself: only the unhandled variety.",
]

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
}

/** Natural-language time for NPC dialogue: "2h 30m", "45 minutes", "a moment". */
function formatShiftTimeNatural(seconds: number): string {
  if (seconds <= 90) return 'a moment'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h} hour${h > 1 ? 's' : ''}`
  return `${m} minute${m !== 1 ? 's' : ''}`
}

interface Props {
  crystals: number
  onBuyCrystalPack: (qty: number) => void
  onCrystalsChange: (newAmount: number) => void
  onBack: () => void
}

const PACK_QUANTITIES = [1, 3, 5, 10]

export function ShopScreen({ crystals, onBuyCrystalPack, onCrystalsChange, onBack }: Props) {
  const [packQty, setPackQty] = useState(1)
  const maxPackQty = Math.max(0, Math.floor((crystals - 100) / CRYSTAL_PACK_COST))
  const canBuyPack = crystals >= CRYSTAL_PACK_COST * packQty
  const [pendingPackBuy, setPendingPackBuy] = useState(false)

  const [npc, setNpc] = useState(() => getDailyShopNPC())
  const [dailyCards, setDailyCards] = useState(() => getDailyShopCards())
  const [dailyAugment, setDailyAugment] = useState<ShopAugmentDeal>(() => getDailyShopAugment())
  const [sellSlots, setSellSlots] = useState(() => getDailyShopSellSlots())
  const [weekend, setWeekend] = useState(() => isWeekend())

  const [shopState, setShopState] = useState(() => loadDailyShopState())
  const [inventory, setInventory] = useState(() => loadInventory())
  const [sellMsgs, setSellMsgs] = useState<Record<string, string | null>>({})
  const [sellCounts, setSellCounts] = useState<Record<string, number>>({})
  const [countdown, setCountdown] = useState(getSecondsUntilShopReset())
  const [shiftCountdown, setShiftCountdown] = useState(getSecondsUntilShiftEnd())

  // Dev schedule dump — ?dev=1 in URL
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('dev') === '1') {
      logDevSchedule()
    }
  }, [])

  // Track unique NPC visits for the "meet all staff" achievement
  useEffect(() => {
    if (recordNPCVisit(npc.name)) {
      incrementAchievementProgress('misc:staff_met')
    }
  }, [npc.name])

  useEffect(() => {
    const id = setInterval(() => {
      const secs = getSecondsUntilShopReset()
      setCountdown(secs)
      setShiftCountdown(getSecondsUntilShiftEnd())
      if (secs === 0) {
        setNpc(getDailyShopNPC())
        setDailyCards(getDailyShopCards())
        setDailyAugment(getDailyShopAugment())
        setSellSlots(getDailyShopSellSlots())
        setWeekend(isWeekend())
        setShopState(loadDailyShopState())
        setSellMsgs({})
        setSellCounts({})
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Card deal: apply apprentice weekend discount
  function cardPrice(deal: ShopCardDeal): number {
    if (npc.role === 'apprentice' && weekend) {
      return Math.floor(deal.price * 0.9)
    }
    return deal.price
  }

  function getCard(deal: ShopCardDeal) {
    const catalog = getCardCatalog()
    return catalog.find(c => c.name === deal.cardName) ?? null
  }

  function handleBuyConsumable(id: string, price: number) {
    const effectivePrice = npc.role === 'apprentice' && weekend ? Math.floor(price * 0.9) : price
    if (crystals < effectivePrice) {
      incrementAchievementProgress('misc:shop_broke_click')
      return
    }
    const next = crystals - effectivePrice
    emitSound('shopPurchase')
    saveCrystals(next)
    onCrystalsChange(next)
    addToConsumableStash(id)
  }

  function handleBuyPackClick() {
    if (canBuyPack) {
      setPendingPackBuy(true)
    } else {
      incrementAchievementProgress('misc:shop_broke_click')
    }
  }

  function handleConfirmPackBuy() {
    emitSound('shopPurchase')
    onBuyCrystalPack(packQty)
    setPendingPackBuy(false)
  }

  function handleBuyCard(deal: ShopCardDeal) {
    const price = cardPrice(deal)
    if (crystals < price || deal.cardName === '') return
    const next = crystals - price
    emitSound('shopPurchase')
    onCrystalsChange(next)
    addCardsToCollection([{ cardName: deal.cardName, count: 1 }])
    const updated = { ...shopState, boughtCardNames: [...shopState.boughtCardNames, deal.cardName] }
    setShopState(updated)
    saveDailyShopState(updated)
  }

  function handleBuyAugment() {
    const price = dailyAugment.price
    if (crystals < price || !dailyAugment.augmentName || shopState.boughtAugment) return
    const next = crystals - price
    emitSound('shopPurchase')
    onCrystalsChange(next)
    addAugmentInstance(dailyAugment.augmentName)
    const updated = { ...shopState, boughtAugment: true }
    setShopState(updated)
    saveDailyShopState(updated)
  }

  function handleSellClick(slotId: string, hasItem: boolean) {
    if (!hasItem) return
    if (shopState.soldItemIds.includes(slotId)) return
    incrementAchievementProgress('misc:shop_sell_attempt')
    const count = sellCounts[slotId] ?? 0
    setSellMsgs(m => ({ ...m, [slotId]: REJECTION_LINES[count % REJECTION_LINES.length] }))
    setSellCounts(c => ({ ...c, [slotId]: count + 1 }))
    const updated = { ...shopState, soldItemIds: [...shopState.soldItemIds, slotId] }
    setShopState(updated)
    saveDailyShopState(updated)
    // Remove the item from inventory now that it has been sold
    removeFromInventory(slotId)
    setInventory(loadInventory())
  }

  const roleLabel: Record<string, string> = {
    owner:      '🏪',
    apprentice: '🌟',
    specialist: '📚',
    wanderer:   '🌍',
  }

  return (
    <OverlayScreen title="SHOP" onBack={onBack} right={<span className="crystal-count">💎 {crystals.toLocaleString()}</span>}>
      <div className="shop-wrapper">

      {/* NPC banner */}
      <div className="shop-npc-banner">
        <div className="shop-npc-icon">{roleLabel[npc.role] ?? '🏪'}</div>
        <div className="shop-npc-info">
          <div className="shop-npc-name">
            {npc.name} <span className="shop-npc-title">— {npc.title}</span>
            <div className="shop-npc-perk">✦ {npc.perk}</div>
          </div>
          <div className="shop-npc-greeting">"{npc.greeting}"</div>
          <div className="shop-npc-greeting">"{npc.shiftEndLine.replace('{time}', formatShiftTimeNatural(shiftCountdown))}"</div>
        </div>
      </div>

      <div className="shop-content u-col u-items-c u-gap-8">

        {/* ── Daily card deals ── */}
        <div className="shop-section">
          <div className="shop-section-header">Current Stock
        🕐 refreshes in <span className="shop-countdown-time">{formatCountdown(countdown)}</span>
      

</div>
          <div className="shop-daily-cards u-flex u-gap-6 u-wrap u-just-c">
            {dailyCards.map(deal => {
              const bought = shopState.boughtCardNames.includes(deal.cardName)
              const price = cardPrice(deal)
              const canAfford = crystals >= price && !bought && deal.cardName !== ''
              const discounted = npc.role === 'apprentice' && weekend
              const card = getCard(deal)

              return (
                <div key={deal.cardName} className={`shop-card-deal shop-card-deal--${deal.rarity}${bought ? ' shop-card-deal--bought' : ''}`}>
                  {card ? (
                    <CardTile card={card} canAfford={canAfford} showDetails={true} />
                  ) : ( <>Error!</> ) /* This should never happen since the shop schedule only offers valid cards, but just in case... */}
                  {bought ? (
                    <div className="shop-purchased">PURCHASED ✓</div>
                  ) : (
                    <button
                      className={`action-btn action-btn--gold shop-card-buy-btn${!canAfford ? ' shop-card-buy-btn--poor' : ''}`}
                      onClick={() => handleBuyCard(deal)}
                      disabled={!canAfford}
                    >
                      {discounted && <span className="shop-discount-badge">-10%</span>}
                      {price} 💎
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Today's Augment ── */}
        {dailyAugment.augmentName !== '' && (() => {
          const aug = getAugmentCard(dailyAugment.augmentName)
          const bought = shopState.boughtAugment ?? false
          const canAfford = crystals >= dailyAugment.price && !bought
          return (
            <div className="shop-section">
              <div className="shop-section-header">Today's Augment — 1 per stock cycle</div>
              <div className={`shop-augment-deal shop-augment-deal--${dailyAugment.rarity}${bought ? ' shop-augment-deal--bought' : ''}`}>
                <div className="shop-augment-name">{dailyAugment.augmentName}</div>
                {aug && (
                  <div className="shop-augment-meta">
                    <span className={`rarity-badge rarity-badge--${dailyAugment.rarity}`}>{dailyAugment.rarity}</span>
                    {aug.augmentSlot && <span className="shop-augment-slot">{augmentSlotLabel(aug.augmentSlot)}</span>}
                  </div>
                )}
                {aug?.description && <div className="shop-augment-desc">{aug.description}</div>}
                {bought ? (
                  <div className="shop-purchased">PURCHASED ✓</div>
                ) : (
                  <button
                    className={`action-btn action-btn--gold shop-card-buy-btn${!canAfford ? ' shop-card-buy-btn--poor' : ''}`}
                    onClick={handleBuyAugment}
                    disabled={!canAfford}
                  >
                    {dailyAugment.price} 💎
                  </button>
                )}
              </div>
            </div>
          )
        })()}

        {/* ── Consumables ── */}
        <div className="shop-section">
          <div className="shop-section-header">Campaign Supplies — always in stock</div>
          <div className="shop-consumables u-flex u-gap-6 u-wrap u-just-c">
            {ALL_CONSUMABLES.map(c => {
              const effectivePrice = npc.role === 'apprentice' && weekend ? Math.floor(c.price * 0.9) : c.price
              const discounted = npc.role === 'apprentice' && weekend
              const canAfford = crystals >= effectivePrice
              return (
                <div key={c.id} className="shop-consumable-tile u-col u-items-c u-gap-3 u-grow">
                  <div className="shop-consumable-icon">{c.icon}</div>
                  <div className="shop-consumable-name">{c.name}</div>
                  <div className="shop-consumable-desc">{c.desc}</div>
                  <button
                    className={`action-btn action-btn--gold shop-consumable-buy-btn${canAfford ? '' : ' shop-card-buy-btn--poor'}`}
                    onClick={() => handleBuyConsumable(c.id, c.price)}
                    disabled={!canAfford}
                  >
                    {discounted && <span className="shop-discount-badge">-10%</span>}
                    {effectivePrice} 💎
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Crystal pack ── */}
        <div className="shop-item">
          <div className="shop-item-icon">🎁</div>
          <div className="shop-item-name">Card Pack</div>
          <div className="shop-item-desc">
            5 cards · 2 Common · 1 Uncommon · 1 Rare · 1 Bonus
          </div>
          <div className="shop-pack-qty-row u-flex u-gap-4 u-just-c u-wrap">
            {PACK_QUANTITIES.map(q => (
              <button
                key={q}
                className={`filter-btn${packQty === q && packQty !== maxPackQty ? ' filter-btn--active' : ''}`}
                onClick={() => setPackQty(q)}
              >
                ×{q}
              </button>
            ))}
            <button
              className={`filter-btn filter-btn--gold${packQty === maxPackQty && maxPackQty > 0 ? ' filter-btn--active' : ''}`}
              onClick={() => setPackQty(maxPackQty)}
              disabled={maxPackQty === 0}
              title={maxPackQty === 0 ? 'Not enough crystals' : `Buy ${maxPackQty} packs`}
            >
              MAX{maxPackQty > 0 ? ` ×${maxPackQty}` : ''}
            </button>
          </div>
          <button
            className="action-btn action-btn--gold"
            onClick={handleBuyPackClick}
            disabled={false}
          >
            {canBuyPack
              ? `Buy ${packQty > 1 ? `${packQty}× ` : ''}— ${CRYSTAL_PACK_COST * packQty} 💎`
              : `Need ${CRYSTAL_PACK_COST * packQty - crystals} more 💎`}
          </button>

          {/* Max buy confirmation modal */}
          {pendingPackBuy && (
            <div className="shop-confirm-backdrop" onClick={() => setPendingPackBuy(false)}>
              <div className="shop-confirm-modal" onClick={e => e.stopPropagation()}>
                <div className="shop-confirm-title">🎁 Card Packs</div>
                <div className="shop-confirm-body">
                  This will buy <strong>{packQty} card pack{packQty !== 1 ? 's' : ''}</strong> for <strong>{CRYSTAL_PACK_COST * packQty} 💎</strong>
                </div>
                <div className="shop-confirm-actions">
                  <button className="action-btn" onClick={() => setPendingPackBuy(false)}>Oh no</button>
                  <button className="action-btn action-btn--gold" onClick={handleConfirmPackBuy}>Oh yes!</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Sell slots ── */}
        <div className="shop-section">
          <div className="shop-section-header">
            Buying Today
            {weekend && <span className="shop-weekend-badge">WEEKEND — 3 slots</span>}
          </div>
          {sellSlots.map(slot => {
            const slotId = slot.id
            const hasItem = inventory.some(i => i.id === slotId)
            const alreadySold = shopState.soldItemIds.includes(slotId)
            const msg = sellMsgs[slotId] ?? null
            const apprenticeWillBuy = npc.role === 'apprentice' && weekend && hasItem

            return (
              <div key={slotId} className="shop-item">
                <div className="shop-item-icon">🛒</div>
                <div className="shop-item-name">{slot.icon} {slot.name}</div>
                <div className="shop-item-desc">"{slot.desc}"</div>
                {msg ? (
                  <div className="shop-keeper-msg">
                    <span className="shop-keeper-label">{npc.name}:</span> "{msg}"
                  </div>
                ) : (
                  <div className="shop-item-desc shop-item-desc--muted">
                    {alreadySold
                      ? "You've already tried selling this today. Come back tomorrow."
                      : hasItem
                        ? apprenticeWillBuy
                          ? `${npc.name} is very interested and will give you a fair deal.`
                          : "You have this item. The shopkeeper is very interested."
                        : "You don't have this item."}
                  </div>
                )}
                <button
                  className={`action-btn${!hasItem ? ' action-btn--dim' : ''}`}
                  onClick={() => handleSellClick(slotId, hasItem)}
                  disabled={!hasItem || alreadySold}
                >
                  Sell {slot.icon} {slot.name}
                </button>
              </div>
            )
          })}
        </div>

      </div>

      </div>
    </OverlayScreen>
  )
}
