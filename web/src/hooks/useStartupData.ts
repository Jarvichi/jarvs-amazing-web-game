import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react'
import { peekDailyReward, type RewardDef } from '../game/dailyLogin'
import { getCardCatalog } from '../game/cards'
import { getUnclaimedGifts, type GiftDef } from '../game/gifts'
import { getUnreadCount as getNewsUnreadCount } from '../game/news'
import { hasPlayedFirstBattle, markFirstBattlePlayed } from '../game/onboarding'

interface UseStartupDataResult {
  dailyReward:        RewardDef | null
  setDailyReward:     Dispatch<SetStateAction<RewardDef | null>>
  pendingGifts:       GiftDef[]
  setPendingGifts:    Dispatch<SetStateAction<GiftDef[]>>
  newsUnreadCount:    number
  setNewsUnreadCount: Dispatch<SetStateAction<number>>
  /** Call once a battle ends so queued daily-reward/gift modals unlock (#2305). */
  onFirstBattleEnded: () => void
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
  // A brand-new player shouldn't see reward modals before playing a battle (#2305).
  const [firstBattleDone, setFirstBattleDone] = useState(hasPlayedFirstBattle)

  const onFirstBattleEnded = useCallback(() => {
    markFirstBattlePlayed()
    setFirstBattleDone(true)
  }, [])

  // ── Daily login reward ────────────────────────────────────
  // Peek at the reward on load (no claim yet — reward is granted when user taps CLAIM)
  useEffect(() => {
    if (!firstBattleDone) return
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
  }, [firstBattleDone])

  // ── Developer gifts ───────────────────────────────────────
  useEffect(() => {
    if (!firstBattleDone) return
    getUnclaimedGifts().then(unclaimed => {
      if (unclaimed.length > 0) setPendingGifts(unclaimed)
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstBattleDone])

  // ── News unread count ─────────────────────────────────────
  useEffect(() => {
    getNewsUnreadCount().then(setNewsUnreadCount).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { dailyReward, setDailyReward, pendingGifts, setPendingGifts, newsUnreadCount, setNewsUnreadCount, onFirstBattleEnded }
}
