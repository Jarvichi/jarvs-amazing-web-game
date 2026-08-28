// ─── Fishing Minigame ─────────────────────────────────────────────────────────
// Three beats, each a skill check:
//   1. CAST   — stop the sweeping power meter. A longer cast reaches the deep
//              water where the big tiers hold, but takes longer to get a bite.
//   2. STRIKE — the float goes under; hit it inside the bite window or the fish
//              spits the hook.
//   3. FIGHT  — hold REEL to lift a band and keep the running fish inside it
//              until the landing gauge fills. Let it empty and the line snaps.
// Score = fish weight (grams) published to the leaderboard. 5% chance to snag
// an item or card instead of a fish (junk doesn't fight — it comes straight in).

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MinigameShell } from './MinigameShell'
import { FishingScene, type ScenePhase } from './fishing/FishingScene'
import { CastMeter } from './fishing/CastMeter'
import { ReelGauge } from './fishing/ReelGauge'
import { CatchCard } from './fishing/CatchCard'
import {
  VARIANT_TIERS, VARIANT_TIER_HUB_ITEM, computeFishStars,
  type FishTier, type FishVariant, type FishCatch, type Catch,
} from './Fishing.data'
import {
  castMeterPower, castTierWeights, pickWeightedIndex, biteWaitMs,
  createFightConfig, createFightState, stepFight, fightOutcome, fishInBand,
  type FightConfig, type FightState,
} from './Fishing.physics'
import { addCollectible, addHubItem, getHubItemCount, removeHubItem } from '../../game/itemStore'
import { addCardsToCollection } from '../../game/collection'
import { getCardCatalog } from '../../game/cards'
import { recordFishCaught } from '../../game/hub/journal'
import { addCaughtFish } from '../../game/hub/caughtFish'
import ITEMS_DATA from '../../data/items.json'
import { logError } from '../../logger'

const BITE_WINDOW_MS = 1500
const CAST_FLIGHT_MS = 700
/** The fight sim runs on rAF; React only re-renders on this cadence. */
const FIGHT_RENDER_MS = 40

// The screen and the scene move through exactly the same beats, so the scene's
// phase union is the single definition of them.
type Phase = ScenePhase

// ── Helpers ───────────────────────────────────────────────────────────────────

function rand(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min))
}

/** Roll a fish, with the tier weighting tilted by how far the cast went.
 *  Returns the tier index too — the fight difficulty scales off it. */
export function rollFish(tiers: FishTier[], castPower = 50): { fish: FishCatch; tierIndex: number } {
  const weights = castTierWeights(tiers.map(t => t.chance), castPower)
  const tierIndex = pickWeightedIndex(weights, Math.random())
  const tier = tiers[tierIndex]
  return {
    tierIndex,
    fish: {
      kind: 'fish',
      tier: tier.tier,
      tierIcon: tier.icon,
      name: tier.names[rand(0, tier.names.length)],
      weightGrams: rand(tier.minG, tier.maxG),
      lengthCm: rand(tier.minCm, tier.maxCm),
      tickets: rand(tier.minT, tier.maxT),
    },
  }
}

// Re-exported for the screens that still import the fish tables from here.
export type { FishTier, FishVariant } from './Fishing.data'

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onDone: (ticketsEarned: number, fishWeightGrams: number) => void
  /** 'tickets' (default): arcade mode — fish pay out tickets via onDone.
   *  'catch': hub-world mode — the caught fish is added to the hub-item
   *  inventory instead, and no tickets are ever awarded. */
  rewardMode?: 'tickets' | 'catch'
  /** Which locale's fish table and scene theme to use — see Fishing.data.ts. */
  variant?: FishVariant
}

/** Fight readout mirrored into React at FIGHT_RENDER_MS; the authoritative
 *  state lives in a ref driven by rAF. */
interface FightView {
  bandPos: number
  fishPos: number
  gauge: number
  inBand: boolean
}

export function Fishing({ onDone, rewardMode = 'tickets', variant = 'river' }: Props) {
  const usesBait = rewardMode === 'catch'
  const tiers = VARIANT_TIERS[variant]
  const tierHubItem = VARIANT_TIER_HUB_ITEM[variant]

  const [phase, setPhase]         = useState<Phase>('idle')
  const [meterPower, setMeter]    = useState(0)
  const [castPower, setCastPower] = useState(50)
  const [biteMs, setBiteMs]       = useState(BITE_WINDOW_MS)
  const [result, setResult]       = useState<Catch | null>(null)
  const [tierIndex, setTierIndex] = useState(0)
  const [fightView, setFightView] = useState<FightView>({ bandPos: 0.25, fishPos: 0.55, gauge: 0.35, inBand: false })
  const [baitCount, setBaitCount] = useState(() => usesBait ? getHubItemCount('fish-bait') : 0)

  const canCast = !usesBait || baitCount > 0

  // The fish already rolled at the strike, held back until it is landed.
  const hookedRef  = useRef<{ fish: FishCatch; tierIndex: number } | null>(null)
  const fightRef   = useRef<FightState>(createFightState())
  const fightCfg   = useRef<FightConfig>(createFightConfig(0, tiers.length))
  const holdingRef = useRef(false)
  const waitRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearWait = useCallback(() => {
    if (waitRef.current) { clearTimeout(waitRef.current); waitRef.current = null }
  }, [])

  useEffect(() => clearWait, [clearWait])

  // ── Per-frame loop: cast sweep, bite countdown, and the fight sim ───────────
  useEffect(() => {
    if (phase !== 'charging' && phase !== 'bite' && phase !== 'fight') return
    let raf = 0
    const start = performance.now()
    let last = start
    let lastRender = 0

    const frame = (now: number) => {
      const dt = now - last
      last = now

      if (phase === 'charging') {
        setMeter(castMeterPower(now - start))
      } else if (phase === 'bite') {
        const left = BITE_WINDOW_MS - (now - start)
        if (left <= 0) { setBiteMs(0); setPhase('missed'); return }
        setBiteMs(left)
      } else {
        const next = stepFight(fightRef.current, fightCfg.current, holdingRef.current, dt, Math.random)
        fightRef.current = next
        const outcome = fightOutcome(next)
        if (outcome === 'landed') { land(); return }
        if (outcome === 'lost')   { setPhase('lost'); return }
        if (now - lastRender >= FIGHT_RENDER_MS) {
          lastRender = now
          setFightView({
            bandPos: next.bandPos, fishPos: next.fishPos, gauge: next.gauge,
            inBand: fishInBand(next, fightCfg.current),
          })
        }
      }
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // `land` is stable enough for this loop — it only reads refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Space bar mirrors the REEL button so the fight is playable on a keyboard.
  useEffect(() => {
    if (phase !== 'fight') return
    const down = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); holdingRef.current = true } }
    const up   = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); holdingRef.current = false } }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      holdingRef.current = false
    }
  }, [phase])

  // ── Flow ───────────────────────────────────────────────────────────────────

  function beginCharge() {
    if (!canCast) return
    clearWait()
    setResult(null)
    hookedRef.current = null
    setMeter(0)
    setPhase('charging')
  }

  /** Lock the meter where the player stopped it and send the float out. */
  function releaseCast() {
    if (usesBait) {
      let ok = false
      try { ok = removeHubItem('fish-bait', 1) }
      catch (e) { logError('Fishing: removeHubItem failed', { error: String(e) }) }
      if (!ok) { setPhase('idle'); return }
      setBaitCount(getHubItemCount('fish-bait'))
    }
    const power = meterPower
    setCastPower(power)
    setPhase('flying')
    waitRef.current = setTimeout(() => {
      setPhase('waiting')
      waitRef.current = setTimeout(() => {
        setBiteMs(BITE_WINDOW_MS)
        setPhase('bite')
      }, biteWaitMs(power, Math.random()))
    }, CAST_FLIGHT_MS)
  }

  /** Strike inside the bite window. Junk comes straight in; a fish fights. */
  function strike() {
    if (phase !== 'bite') return
    clearWait()
    const junk = rollSpecial()
    if (junk) {
      setTierIndex(0)
      finish(junk)
      return
    }
    const rolled = rollFish(tiers, castPower)
    hookedRef.current = rolled
    fightCfg.current = createFightConfig(rolled.tierIndex, tiers.length)
    fightRef.current = createFightState()
    setFightView({ bandPos: fightRef.current.bandPos, fishPos: fightRef.current.fishPos, gauge: fightRef.current.gauge, inBand: false })
    setPhase('fight')
  }

  function land() {
    const hooked = hookedRef.current
    if (!hooked) { setPhase('lost'); return }
    setTierIndex(hooked.tierIndex)
    finish(hooked.fish)
  }

  function finish(c: Catch) {
    applyReward(c)
    setResult(c)
    setPhase('caught')
  }

  /** 5% of strikes snag something that isn't a fish — an item or a card.
   *  Returns null for the ordinary case, where a fish is on the hook. */
  function rollSpecial(): Catch | null {
    if (Math.random() >= 0.05) return null
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
    } else {
      recordFishCaught(variant, c.name)
      if (rewardMode === 'catch') {
        const hubItemId = tierHubItem[c.tier]
        if (hubItemId) {
          try { addHubItem(hubItemId, 1) }
          catch (e) { logError('Fishing: addHubItem failed', { error: String(e) }) }
        }
        const tierDef = tiers.find(t => t.tier === c.tier)
        if (tierDef) {
          addCaughtFish({
            locale: variant, tier: c.tier, tierIcon: c.tierIcon, name: c.name,
            weightGrams: c.weightGrams, lengthCm: c.lengthCm,
            stars: computeFishStars(c.weightGrams, tierDef),
          })
        }
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
    return result?.kind === 'fish' ? result.weightGrams : 0
  }

  function done() { onDone(catchTickets(), catchWeightG()) }

  function giveUp() { clearWait(); onDone(0, 0) }

  // ── Render ─────────────────────────────────────────────────────────────────

  const scenePower = phase === 'charging' ? meterPower : castPower
  const biteBarPct = Math.round((biteMs / BITE_WINDOW_MS) * 100)
  const stars = result?.kind === 'fish' && tiers[tierIndex]
    ? computeFishStars(result.weightGrams, tiers[tierIndex])
    : 1
  const rewardLine = result?.kind === 'fish'
    ? (rewardMode === 'catch' ? `${result.tierIcon} Added to inventory!` : `+${result.tickets} 🎫`)
    : result?.kind === 'card'
      ? (rewardMode === 'catch' ? 'Added to collection!' : '+10 🎫  ·  Added to collection!')
      : (rewardMode === 'catch' ? 'Added to inventory!' : '+5 🎫  ·  Added to inventory!')

  return (
    <MinigameShell
      title="FISHING"
      icon="🎣"
      className="fishing-screen"
      stat={usesBait ? `🪱 ${baitCount}` : undefined}
    >
      <FishingScene
        variant={variant}
        phase={phase}
        castPower={scenePower}
        fishPos={fightView.fishPos}
        catchIcon={result?.kind === 'fish' ? result.tierIcon : result?.kind === 'item' ? result.icon : '🃏'}
      />

      {/* ── Read-out: whatever the current beat needs ── */}
      <div className="fishing-readout">
        {(phase === 'idle' || phase === 'charging') && (
          <CastMeter power={phase === 'charging' ? meterPower : 0} locked={phase === 'idle'} />
        )}

        {phase === 'flying' && <p className="fishing-prompt">The float arcs out over the water…</p>}

        {phase === 'waiting' && (
          <p className="fishing-prompt fishing-prompt--waiting">Waiting for a bite…</p>
        )}

        {phase === 'bite' && (
          <>
            <p className="fishing-prompt fishing-prompt--bite">BITE! STRIKE NOW!</p>
            <div className="fishing-bite-bar-wrap">
              <div className="fishing-bite-bar" style={{ width: `${biteBarPct}%` }} />
            </div>
          </>
        )}

        {phase === 'fight' && (
          <ReelGauge
            bandPos={fightView.bandPos}
            bandSize={fightCfg.current.bandSize}
            fishPos={fightView.fishPos}
            gauge={fightView.gauge}
            holding={fightView.inBand}
          />
        )}

        {phase === 'missed' && (
          <p className="fishing-prompt fishing-prompt--missed">Too slow — it spat the hook.</p>
        )}

        {phase === 'lost' && (
          <p className="fishing-prompt fishing-prompt--missed">
            The line went slack… {hookedRef.current?.fish.tier ?? 'It'} got away.
          </p>
        )}

        {phase === 'caught' && result && (
          <CatchCard result={result} tierIndex={tierIndex} stars={stars} reward={rewardLine} />
        )}
      </div>

      {/* ── Controls ── */}
      <div className="fishing-controls u-col u-items-c u-gap-4">
        {phase === 'idle' && (
          canCast
            ? <button className="action-btn action-btn--gold action-btn--large" onClick={beginCharge}>🎣 CAST</button>
            : <button className="action-btn" disabled>Out of bait</button>
        )}

        {phase === 'charging' && (
          <button className="action-btn action-btn--gold action-btn--large fishing-release-btn" onClick={releaseCast}>
            RELEASE!
          </button>
        )}

        {(phase === 'flying' || phase === 'waiting') && (
          <button className="action-btn" disabled>{phase === 'flying' ? 'Casting…' : 'Waiting…'}</button>
        )}

        {phase === 'bite' && (
          <button className="action-btn action-btn--large fishing-strike-btn" onClick={strike}>
            ⚡ STRIKE!
          </button>
        )}

        {phase === 'fight' && (
          <button
            className={`action-btn action-btn--large fishing-reel-btn${fightView.inBand ? ' fishing-reel-btn--on' : ''}`}
            onPointerDown={() => { holdingRef.current = true }}
            onPointerUp={() => { holdingRef.current = false }}
            onPointerLeave={() => { holdingRef.current = false }}
            onPointerCancel={() => { holdingRef.current = false }}
            onContextMenu={e => e.preventDefault()}
          >
            🌀 HOLD TO REEL
          </button>
        )}

        {(phase === 'missed' || phase === 'lost') && (
          <div className="fishing-btn-row u-flex u-gap-4 u-just-c">
            {canCast && <button className="action-btn action-btn--gold" onClick={beginCharge}>TRY AGAIN</button>}
            <button className="action-btn action-btn--danger" onClick={giveUp}>GIVE UP</button>
          </div>
        )}

        {phase === 'caught' && (
          <div className="fishing-btn-row u-flex u-gap-4 u-just-c">
            {canCast && <button className="action-btn action-btn--gold" onClick={beginCharge}>FISH AGAIN</button>}
            <button className="action-btn" onClick={done}>DONE</button>
          </div>
        )}
      </div>
    </MinigameShell>
  )
}
