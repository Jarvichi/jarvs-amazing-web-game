import { useState, useEffect, type Dispatch, type SetStateAction } from 'react'
import { peekDailyReward, type RewardDef } from '../game/dailyLogin'
import { getCardCatalog } from '../game/cards'
import { getUnclaimedGifts, type GiftDef } from '../game/gifts'
import { getUnreadCount as getNewsUnreadCount } from '../game/news'

interface UseStartupDataResult {
  dailyReward:        RewardDef | null
  setDailyReward:     Dispatch<SetStateAction<RewardDef | null>>
  pendingGifts:       GiftDef[]
  setPendingGifts:    Dispatch<SetStateAction<GiftDef[]>>
  newsUnreadCount:    number
  setNewsUnreadCount: Dispatch<SetStateAction<number>>
}

/**
 * Loads the daily login reward, unclaimed developer gifts, and news unread
 * count on mount. Exposes setters so callers can clear state after the user
 * acts on each notification.
 */
export function useStartupData(): UseStartupDataResult {
  const [dailyReward,        setDailyReward]     = useState<RewardDef | null>(null)
  const [pendingGifts,       setPendingGifts]     = useState<GiftDef[]>([])
  const [newsUnreadCount,    setNewsUnreadCount]  = useState(0)

  // ── Daily login reward ────────────────────────────────────
  // Peek at the reward on load (no claim yet — reward is granted when user taps CLAIM)
  useEffect(() => {
    const raw = peekDailyReward()
    if (!raw) return
    let reward = raw
    const catalog = getCardCatalog()
    if (reward.type === 'card') {
      const pool = reward.rarity ? catalog.filter(c => c.rarity === reward.rarity) : catalog
      const src  = pool.length > 0 ? pool : catalog
      const card = src[Math.floor(Math.random() * src.length)]
      reward = { ...reward, cardName: card.name }
    }
    setDailyReward(reward)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Developer gifts ───────────────────────────────────────
  useEffect(() => {
    getUnclaimedGifts().then(unclaimed => {
      if (unclaimed.length > 0) setPendingGifts(unclaimed)
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── News unread count ─────────────────────────────────────
  useEffect(() => {
    getNewsUnreadCount().then(setNewsUnreadCount).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { dailyReward, setDailyReward, pendingGifts, setPendingGifts, newsUnreadCount, setNewsUnreadCount }
}
