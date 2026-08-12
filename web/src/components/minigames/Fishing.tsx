// ─── Fishing Minigame ─────────────────────────────────────────────────────────
// Cast, wait for a bite, reel in. Score = fish weight (grams) published to
// the leaderboard. 5% chance to snag an item or card instead of a fish.

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { addCollectible, addHubItem, getHubItemCount, removeHubItem } from '../../game/itemStore'
import { addCardsToCollection } from '../../game/collection'
import { getCardCatalog } from '../../game/cards'
import ITEMS_DATA from '../../data/items.json'
import { logError } from '../../logger'

const BITE_WINDOW_MS = 1500

// ── Fish data ─────────────────────────────────────────────────────────────────

interface FishTier {
  tier: string
  icon: string
  names: string[]
  minG: number; maxG: number
  minCm: number; maxCm: number
  minT: number; maxT: number
  chance: number
}

export const FISH_TIERS: FishTier[] = [
  {
    tier: 'Tiddler', icon: '🐟',
    names: ['Minnow', 'Dace', 'Gudgeon', 'Bleak', 'Stickleback'],
    minG: 100,   maxG: 500,   minCm: 8,   maxCm: 25,  minT: 2,   maxT: 6,   chance: 40,
  },
  {
    tier: 'Small', icon: '🐠',
    names: ['Roach', 'Rudd', 'Perch', 'Bream', 'Chub'],
    minG: 500,   maxG: 2000,  minCm: 25,  maxCm: 45,  minT: 8,   maxT: 18,  chance: 30,
  },
  {
    tier: 'Medium', icon: '🐡',
    names: ['Carp', 'Tench', 'Barbel', 'Zander', 'Catfish'],
    minG: 2000,  maxG: 5000,  minCm: 45,  maxCm: 70,  minT: 22,  maxT: 40,  chance: 15,
  },
  {
    tier: 'Large', icon: '🦈',
    names: ['Pike', 'Salmon', 'Sea Bass', 'Wels Catfish', 'Sturgeon'],
    minG: 5000,  maxG: 12000, minCm: 70,  maxCm: 110, minT: 42,  maxT: 75,  chance: 9,
  },
  {
    tier: 'Trophy', icon: '🏆',
    names: ['Giant Carp', 'Monster Pike', 'River Titan', 'Trophy Salmon', 'Great Barbel'],
    minG: 12000, maxG: 25000, minCm: 110, maxCm: 150, minT: 80,  maxT: 130, chance: 5,
  },
  {
    tier: 'Legendary', icon: '✨',
    names: ['Ancient Sturgeon', 'Dragon Carp', 'Leviathan Eel', 'World Record Bass', 'Fracture Fish'],
    minG: 25000, maxG: 50000, minCm: 150, maxCm: 200, minT: 150, maxT: 250, chance: 1,
  },
]

// Cave-lake variant — same weights/ranges as FISH_TIERS (reuse the already-
// tuned balance), reskinned as pale, blind, deep-water species for the
// underground lake fishing spot. Distinct tier labels double as the key
// into CAVE_TIER_HUB_ITEM below, so they must not collide with FISH_TIERS'.
export const CAVE_FISH_TIERS: FishTier[] = [
  {
    tier: 'Blindling', icon: '🐟',
    names: ['Blind Loach', 'Pale Minnow', 'Cave Gudgeon', 'Sunken Bleak', 'Milk-eye'],
    minG: 100,   maxG: 500,   minCm: 8,   maxCm: 25,  minT: 2,   maxT: 6,   chance: 40,
  },
  {
    tier: 'Cave-dweller', icon: '🐠',
    names: ['Stone Roach', 'Grotto Perch', 'Cavefin', 'Hollow Bream', 'Root-eel'],
    minG: 500,   maxG: 2000,  minCm: 25,  maxCm: 45,  minT: 8,   maxT: 18,  chance: 30,
  },
  {
    tier: 'Deep Lurker', icon: '🐡',
    names: ['Stone Eel', 'Barbless Carp', 'Echo Catfish', 'Drip-fed Zander', 'Lantern Barbel'],
    minG: 2000,  maxG: 5000,  minCm: 45,  maxCm: 70,  minT: 22,  maxT: 40,  chance: 15,
  },
  {
    tier: 'Ancient', icon: '🦈',
    names: ['Sunless Pike', 'Deepwater Sturgeon', 'Cistern Bass', 'Old Blind Catfish', 'Wellspring Eel'],
    minG: 5000,  maxG: 12000, minCm: 70,  maxCm: 110, minT: 42,  maxT: 75,  chance: 9,
  },
  {
    tier: 'Abyssal', icon: '🏆',
    names: ['Abyssal Carp', 'Monster of the Hollow', 'Cavern Titan', 'Sightless Leviathan', 'Great Root-eel'],
    minG: 12000, maxG: 25000, minCm: 110, maxCm: 150, minT: 80,  maxT: 130, chance: 5,
  },
  {
    tier: 'Sunless', icon: '✨',
    names: ['The Sunless One'],
    minG: 25000, maxG: 50000, minCm: 150, maxCm: 200, minT: 150, maxT: 250, chance: 1,
  },
]

// ── Catch types ───────────────────────────────────────────────────────────────

interface FishCatch {
  kind: 'fish'
  tier: string
  tierIcon: string
  name: string
  weightGrams: number
  lengthCm: number
  tickets: number
}

interface ItemCatch {
  kind: 'item'
  id: string
  name: string
  icon: string
  desc: string
}

interface CardCatch {
  kind: 'card'
  name: string
  rarity: string
}

type Catch = FishCatch | ItemCatch | CardCatch

type Phase = 'idle' | 'waiting' | 'bite' | 'missed' | 'caught'

// ── Helpers ───────────────────────────────────────────────────────────────────

function rand(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min))
}

function rollFish(tiers: FishTier[]): FishCatch {
  const roll = Math.random() * 100
  let cum = 0
  let tier = tiers[0]
  for (const t of tiers) {
    cum += t.chance
    if (roll < cum) { tier = t; break }
  }
  return {
    kind: 'fish',
    tier: tier.tier,
    tierIcon: tier.icon,
    name: tier.names[rand(0, tier.names.length)],
    weightGrams: rand(tier.minG, tier.maxG),
    lengthCm: rand(tier.minCm, tier.maxCm),
    tickets: rand(tier.minT, tier.maxT),
  }
}

function formatWeight(g: number): string {
  return g < 1000 ? `${g}g` : `${(g / 1000).toFixed(1)}kg`
}

// Hub-mode catches become hub-items, keyed by fish tier (see hubItems.json).
export const TIER_HUB_ITEM: Record<string, string> = {
  Tiddler: 'fish-tiddler', Small: 'fish-small', Medium: 'fish-medium',
  Large: 'fish-large', Trophy: 'fish-trophy', Legendary: 'fish-legendary',
}
export const CAVE_TIER_HUB_ITEM: Record<string, string> = {
  Blindling: 'cave-fish-blindling', 'Cave-dweller': 'cave-fish-dweller', 'Deep Lurker': 'cave-fish-lurker',
  Ancient: 'cave-fish-ancient', Abyssal: 'cave-fish-abyssal', Sunless: 'cave-fish-sunless',
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onDone: (ticketsEarned: number, fishWeightGrams: number) => void
  /** 'tickets' (default): arcade mode — fish pay out tickets via onDone.
   *  'catch': hub-world mode — the caught fish is added to the hub-item
   *  inventory instead, and no tickets are ever awarded. */
  rewardMode?: 'tickets' | 'catch'
  /** 'river' (default): the standard Tiddler→Legendary tiers used at every
   *  ordinary fishing spot. 'cave': the pale, blind cave-lake species —
   *  same weights/ranges, exclusive hub-items — used only at the
   *  underground lake's fishing spot. */
  variant?: 'river' | 'cave'
}

export function Fishing({ onDone, rewardMode = 'tickets', variant = 'river' }: Props) {
  const usesBait = rewardMode === 'catch'
  const tiers = variant === 'cave' ? CAVE_FISH_TIERS : FISH_TIERS
  const tierHubItem = variant === 'cave' ? CAVE_TIER_HUB_ITEM : TIER_HUB_ITEM

  const [phase, setPhase]   = useState<Phase>('idle')
  const [result, setResult] = useState<Catch | null>(null)
  const [biteMs, setBiteMs] = useState(BITE_WINDOW_MS)
  const [baitCount, setBaitCount] = useState(() => usesBait ? getHubItemCount('fish-bait') : 0)

  const canCast = !usesBait || baitCount > 0

  const waitRef     = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const biteRef     = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const countRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimers = useCallback(() => {
    if (waitRef.current)  clearTimeout(waitRef.current)
    if (biteRef.current)  clearTimeout(biteRef.current)
    if (countRef.current) clearInterval(countRef.current)
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  function startCast() {
    if (usesBait) {
      let ok = false
      try { ok = removeHubItem('fish-bait', 1) }
      catch (e) { logError('Fishing: removeHubItem failed', { error: String(e) }) }
      if (!ok) return
      setBaitCount(getHubItemCount('fish-bait'))
    }
    clearTimers()
    setPhase('waiting')
    const delay = 2000 + Math.random() * 4000
    waitRef.current = setTimeout(triggerBite, delay)
  }

  function triggerBite() {
    setPhase('bite')
    setBiteMs(BITE_WINDOW_MS)
    const start = Date.now()
    countRef.current = setInterval(() => {
      setBiteMs(Math.max(0, BITE_WINDOW_MS - (Date.now() - start)))
    }, 50)
    biteRef.current = setTimeout(() => {
      clearTimers()
      setPhase('missed')
    }, BITE_WINDOW_MS)
  }

  function reelIn() {
    if (phase !== 'bite') return
    clearTimers()
    const catch_ = buildCatch()
    applyReward(catch_)
    setResult(catch_)
    setPhase('caught')
  }

  function buildCatch(): Catch {
    if (Math.random() >= 0.05) return rollFish(tiers)
    // 5% special
    if (Math.random() < 0.5) {
      const item = ITEMS_DATA[rand(0, ITEMS_DATA.length)]
      return { kind: 'item', id: item.id, name: item.name, icon: item.icon, desc: item.desc }
    }
    const catalog = getCardCatalog()
    if (catalog.length === 0) {
      const item = ITEMS_DATA[rand(0, ITEMS_DATA.length)]
      return { kind: 'item', id: item.id, name: item.name, icon: item.icon, desc: item.desc }
    }
    const card = catalog[rand(0, catalog.length)]
    return { kind: 'card', name: card.name, rarity: card.rarity }
  }

  function applyReward(c: Catch) {
    if (c.kind === 'item') {
      try { addCollectible(c.id) }
      catch (e) { logError('Fishing: addCollectible failed', { error: String(e) }) }
    } else if (c.kind === 'card') {
      addCardsToCollection([{ cardName: c.name, count: 1 }])
    } else if (rewardMode === 'catch') {
      const hubItemId = tierHubItem[c.tier]
      if (hubItemId) {
        try { addHubItem(hubItemId, 1) }
        catch (e) { logError('Fishing: addHubItem failed', { error: String(e) }) }
      }
    }
  }

  function catchTickets(): number {
    if (rewardMode === 'catch') return 0
    if (!result) return 0
    if (result.kind === 'fish')  return result.tickets
    if (result.kind === 'card')  return 10
    return 5
  }

  function catchWeightG(): number {
    if (result?.kind === 'fish') return result.weightGrams
    return 0
  }

  function done() { onDone(catchTickets(), catchWeightG()) }

  const biteBarPct = Math.round((biteMs / BITE_WINDOW_MS) * 100)

  return (
    <div className="fishing-screen">
      <div className="fishing-header">
        <div className="fishing-title">🎣 FISHING</div>
        {usesBait && <div className="fishing-bait-counter">🪱 {baitCount}</div>}
      </div>

      {/* Scene */}
      <div className="fishing-scene">
        {phase === 'idle' && (
          <div className="fishing-art u-col u-items-c u-gap-1">
            <div>🎣</div>
            <div className="fishing-water-idle">≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈</div>
          </div>
        )}

        {phase === 'waiting' && (
          <div className="fishing-art u-col u-items-c u-gap-1">
            <div className="fishing-rod-line">🎣</div>
            <div className="fishing-line">│</div>
            <div className="fishing-line">│</div>
            <div className="fishing-bobber-wrap">
              <span className="fishing-bobber">●</span>
            </div>
            <div className="fishing-water">≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈</div>
          </div>
        )}

        {phase === 'bite' && (
          <div className="fishing-art u-col u-items-c u-gap-1">
            <div className="fishing-rod-line">🎣</div>
            <div className="fishing-line fishing-line--taut">╲</div>
            <div className="fishing-line fishing-line--taut">╲</div>
            <div className="fishing-bobber-wrap">
              <span className="fishing-bobber fishing-bobber--bite">◉</span>
            </div>
            <div className="fishing-water">≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈</div>
          </div>
        )}

        {phase === 'missed' && (
          <div className="fishing-art u-col u-items-c u-gap-1 fishing-art--missed">
            <div>🎣 💦</div>
            <div className="fishing-water-idle">≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈</div>
          </div>
        )}

        {phase === 'caught' && result && (
          <div className="fishing-art u-col u-items-c u-gap-1 fishing-art--caught">
            <div className="fishing-catch-icon">
              {result.kind === 'fish' ? result.tierIcon : result.kind === 'item' ? result.icon : '🃏'}
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      <div className="fishing-status">
        {phase === 'idle' && (
          <p className="fishing-prompt">
            {canCast ? 'Cast your line and wait for a bite.' : "Out of bait — no more casts."}
          </p>
        )}
        {phase === 'waiting' && <p className="fishing-prompt fishing-prompt--waiting">Waiting for a bite…</p>}

        {phase === 'bite' && (
          <>
            <p className="fishing-prompt fishing-prompt--bite">🔴 BITE! REEL IN! 🔴</p>
            <div className="fishing-bite-bar-wrap">
              <div className="fishing-bite-bar" style={{ width: `${biteBarPct}%` }} />
            </div>
          </>
        )}

        {phase === 'missed' && (
          <p className="fishing-prompt fishing-prompt--missed">The fish got away… too slow!</p>
        )}

        {phase === 'caught' && result?.kind === 'fish' && (
          <div className="fishing-result u-col u-items-c u-gap-2">
            <div className="fishing-result-tier">✦ {result.tier} ✦</div>
            <div className="fishing-result-name">{result.tierIcon} {result.name}</div>
            <div className="fishing-result-stats u-flex u-gap-4 u-items-c">
              <span>{formatWeight(result.weightGrams)}</span>
              <span className="fishing-result-sep">·</span>
              <span>{result.lengthCm}cm</span>
            </div>
            <div className="fishing-result-tickets">
              {rewardMode === 'catch' ? `${result.tierIcon} Added to inventory!` : `+${result.tickets} 🎫`}
            </div>
          </div>
        )}

        {phase === 'caught' && result?.kind === 'item' && (
          <div className="fishing-result u-col u-items-c u-gap-2 fishing-result--special">
            <div className="fishing-result-tier">✦ SPECIAL FIND ✦</div>
            <div className="fishing-result-name">{result.icon} {result.name}</div>
            <div className="fishing-result-desc">{result.desc}</div>
            <div className="fishing-result-tickets">{rewardMode === 'catch' ? 'Added to inventory!' : '+5 🎫  ·  Added to inventory!'}</div>
          </div>
        )}

        {phase === 'caught' && result?.kind === 'card' && (
          <div className="fishing-result u-col u-items-c u-gap-2 fishing-result--special">
            <div className="fishing-result-tier">✦ RARE CARD FOUND ✦</div>
            <div className="fishing-result-name">🃏 {result.name}</div>
            <div className="fishing-result-desc">{result.rarity}</div>
            <div className="fishing-result-tickets">{rewardMode === 'catch' ? 'Added to collection!' : '+10 🎫  ·  Added to collection!'}</div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="fishing-controls u-col u-items-c u-gap-4">
        {phase === 'idle' && (
          canCast ? (
            <button className="action-btn action-btn--gold" onClick={startCast}>
              🎣 CAST!
            </button>
          ) : (
            <button className="action-btn" disabled>Out of bait</button>
          )
        )}

        {phase === 'waiting' && (
          <button className="action-btn" disabled>Waiting…</button>
        )}

        {phase === 'bite' && (
          <button className="action-btn action-btn--large fishing-reel-btn" onClick={reelIn}>
            🐟 REEL IN!
          </button>
        )}

        {phase === 'missed' && (
          <div className="fishing-btn-row u-flex u-gap-4 u-just-c">
            {canCast && <button className="action-btn action-btn--gold" onClick={startCast}>TRY AGAIN</button>}
            <button className="action-btn action-btn--danger" onClick={() => onDone(0, 0)}>GIVE UP</button>
          </div>
        )}

        {phase === 'caught' && (
          <div className="fishing-btn-row u-flex u-gap-4 u-just-c">
            {canCast && <button className="action-btn action-btn--gold" onClick={startCast}>FISH AGAIN</button>}
            <button className="action-btn" onClick={done}>DONE</button>
          </div>
        )}
      </div>
    </div>
  )
}
