import React, { useState, useEffect } from 'react'
import { CRYSTAL_PACK_COST, addCardsToCollection } from '../../game/collection'
import { incrementAchievementProgress } from '../../game/achievements'
import {
  getDailyShopNPC,
  resolveShopNpcForHubNpc,
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
  ShopNPC,
  recordNPCVisit,
  isShopItemSold,
  markCardBought,
  markAugmentBought,
} from '../../game/shopSchedule'
import { getAugmentCard } from '../../game/augments'
import { addAugmentInstance } from '../../game/collection'
import { loadInventory, removeFromInventory } from '../../game/dailyLogin'
import { ALL_CONSUMABLES, addToConsumableStash } from '../../game/questline'
import { saveCrystals } from '../../game/collection'
import { emitSound } from '../../game/sound'
import { SpriteImg } from '../ui/SpriteImg'
import { OverlayScreen } from '../ui/OverlayScreen'
import { Section } from '../ui/Section'
import { Icon } from '../ui/icons/Icon'
import { getCardCatalog } from '../../game/cards'
import { CardDealTile } from './shop/CardDealTile'
import { AugmentDealCard } from './shop/AugmentDealCard'
import { ConsumableTile } from './shop/ConsumableTile'
import { CrystalPackPanel } from './shop/CrystalPackPanel'
import { PackPurchaseConfirmModal } from './shop/PackPurchaseConfirmModal'
import { SellSlotRow } from './shop/SellSlotRow'

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

type ShopCategory = 'cards' | 'augments' | 'supplies'

const CATEGORY_TITLE: Record<ShopCategory, string> = {
  cards:    'CARD SHOP',
  augments: 'AUGMENTS',
  supplies: 'SUPPLIES',
}

interface Props {
  crystals: number
  onBuyCrystalPack: (qty: number) => void
  onCrystalsChange: (newAmount: number) => void
  onBack: () => void
  category?: ShopCategory
  /** Which trader's stock this screen represents, for the "already bought today" gate.
   *  Defaults to Ravenwatch's own card-shop/augment-shop ids, preserving legacy behavior. */
  buildingId?: string
  /** The specific hub NPC the player tapped to get here, if any. When present,
   *  the banner reflects this NPC (by name/dialogue) instead of the random
   *  daily/shift pick. Absent for the plain title-screen 'shop' entry. */
  tappedNpc?: { name: string; dialogue?: string[]; sprite?: string }
}

export function ShopScreen({ crystals, onBuyCrystalPack, onCrystalsChange, onBack, category, buildingId, tappedNpc }: Props) {
  const show = (c: ShopCategory) => !category || category === c
  const cardBuildingId    = buildingId ?? 'card-shop'
  const augmentBuildingId = buildingId ?? 'augment-shop'

  const [packQty, setPackQty] = useState(1)
  const maxPackQty = Math.max(0, Math.floor((crystals - 100) / CRYSTAL_PACK_COST))
  const canBuyPack = crystals >= CRYSTAL_PACK_COST * packQty
  const [pendingPackBuy, setPendingPackBuy] = useState(false)

  const resolveNpc = (): ShopNPC => tappedNpc
    ? resolveShopNpcForHubNpc(buildingId ?? tappedNpc.name, tappedNpc.name, tappedNpc.dialogue)
    : getDailyShopNPC()

  const [npc, setNpc] = useState(resolveNpc)
  const [dailyCards, setDailyCards] = useState(() => getDailyShopCards(undefined, undefined, resolveNpc()))
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
        const freshNpc = resolveNpc()
        setNpc(freshNpc)
        setDailyCards(getDailyShopCards(undefined, undefined, freshNpc))
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
    const updated = markCardBought(shopState, cardBuildingId, deal.cardName)
    setShopState(updated)
    saveDailyShopState(updated)
  }

  function handleBuyAugment() {
    const price = dailyAugment.price
    if (crystals < price || !dailyAugment.augmentName || isShopItemSold(shopState, augmentBuildingId, { kind: 'augment' })) return
    const next = crystals - price
    emitSound('shopPurchase')
    onCrystalsChange(next)
    addAugmentInstance(dailyAugment.augmentName)
    const updated = markAugmentBought(shopState, augmentBuildingId)
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

  const roleLabel: Record<string, React.ReactNode> = {
    owner:      <Icon name="shop" size={32} />,
    apprentice: <Icon name="star" size={32} />,
    specialist: <Icon name="scroll" size={32} />,
    wanderer:   <Icon name="compass" size={32} />,
  }

  // Only show the tapped NPC's own sprite when the banner is still displaying
  // that same NPC — a rare traveling seller substitution shows a different
  // name/role, so their (mismatched) sprite would be misleading.
  const npcSprite = tappedNpc?.sprite && npc.name === tappedNpc.name ? tappedNpc.sprite : undefined

  return (
    <OverlayScreen title={category ? CATEGORY_TITLE[category] : 'SHOP'} onBack={onBack} right={<span className="crystal-count"><Icon name="crystal" size={14} /> {crystals.toLocaleString()}</span>}>
      <div className="shop-wrapper">

      {/* NPC banner */}
      <div className="shop-npc-banner">
        <div className="shop-npc-icon">
          {npcSprite
            ? <SpriteImg name={npcSprite} className="shop-npc-sprite" />
            : (roleLabel[npc.role] ?? <Icon name="shop" size={32} />)}
        </div>
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
        {show('cards') && (
          <Section
            className="shop-section"
            title={<>Current Stock <Icon name="timer" size={14} /> refreshes in <span className="shop-countdown-time">{formatCountdown(countdown)}</span></>}
          >
            <div className="shop-daily-cards u-flex u-gap-6 u-wrap u-just-c">
              {dailyCards.map(deal => {
                const bought = isShopItemSold(shopState, cardBuildingId, { kind: 'card', cardName: deal.cardName })
                const price = cardPrice(deal)
                const canAfford = crystals >= price && !bought && deal.cardName !== ''
                const discounted = npc.role === 'apprentice' && weekend
                const card = getCard(deal)

                return (
                  <CardDealTile
                    key={deal.cardName}
                    deal={deal}
                    card={card}
                    bought={bought}
                    price={price}
                    discounted={discounted}
                    canAfford={canAfford}
                    onBuy={() => handleBuyCard(deal)}
                  />
                )
              })}
            </div>
          </Section>
        )}

        {/* ── Today's Augment ── */}
        {show('augments') && dailyAugment.augmentName !== '' && (() => {
          const aug = getAugmentCard(dailyAugment.augmentName)
          const bought = isShopItemSold(shopState, augmentBuildingId, { kind: 'augment' })
          const canAfford = crystals >= dailyAugment.price && !bought
          return (
            <Section className="shop-section" title="Today's Augment — 1 per stock cycle">
              <AugmentDealCard deal={dailyAugment} aug={aug} bought={bought} canAfford={canAfford} onBuy={handleBuyAugment} />
            </Section>
          )
        })()}

        {/* ── Consumables ── */}
        {show('supplies') && (
          <Section className="shop-section" title="Campaign Supplies — always in stock">
            <div className="shop-consumables u-flex u-gap-6 u-wrap u-just-c">
              {ALL_CONSUMABLES.map(c => {
                const effectivePrice = npc.role === 'apprentice' && weekend ? Math.floor(c.price * 0.9) : c.price
                const discounted = npc.role === 'apprentice' && weekend
                const canAfford = crystals >= effectivePrice
                return (
                  <ConsumableTile
                    key={c.id}
                    consumable={c}
                    price={effectivePrice}
                    discounted={discounted}
                    canAfford={canAfford}
                    onBuy={() => handleBuyConsumable(c.id, c.price)}
                  />
                )
              })}
            </div>
          </Section>
        )}

        {/* ── Crystal pack ── */}
        {show('cards') && (
          <>
            <CrystalPackPanel
              packQty={packQty}
              maxPackQty={maxPackQty}
              canBuyPack={canBuyPack}
              crystals={crystals}
              crystalPackCost={CRYSTAL_PACK_COST}
              onQtyChange={setPackQty}
              onBuyClick={handleBuyPackClick}
            />
            {pendingPackBuy && (
              <PackPurchaseConfirmModal
                packQty={packQty}
                totalCost={CRYSTAL_PACK_COST * packQty}
                onCancel={() => setPendingPackBuy(false)}
                onConfirm={handleConfirmPackBuy}
              />
            )}
          </>
        )}

        {/* ── Sell slots ── */}
        {show('supplies') && (
          <Section
            className="shop-section"
            title={<>Buying Today{weekend && <span className="shop-weekend-badge">WEEKEND — 3 slots</span>}</>}
          >
            {sellSlots.map(slot => {
              const slotId = slot.id
              const hasItem = inventory.some(i => i.id === slotId)
              const alreadySold = shopState.soldItemIds.includes(slotId)
              const msg = sellMsgs[slotId] ?? null
              const apprenticeWillBuy = npc.role === 'apprentice' && weekend && hasItem

              return (
                <SellSlotRow
                  key={slotId}
                  icon={slot.icon}
                  name={slot.name}
                  desc={slot.desc}
                  hasItem={hasItem}
                  alreadySold={alreadySold}
                  npcName={npc.name}
                  apprenticeWillBuy={apprenticeWillBuy}
                  message={msg}
                  onSell={() => handleSellClick(slotId, hasItem)}
                />
              )
            })}
          </Section>
        )}

      </div>

      </div>
    </OverlayScreen>
  )
}
