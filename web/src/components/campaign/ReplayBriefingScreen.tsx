import React, { useState } from 'react'
import { Act, ReplayModifier } from '../../game/questline'
import { Button } from '../ui/Button'

interface TierOption {
  label: string
  count: number
  modifiers: ReplayModifier[]
  extraCrystals: number  // bonus crystals per battle vs base earned difficulty
  isBase: boolean        // this is the player's minimum earned tier
}

interface Props {
  act: Act
  completionCount: number  // how many times the player has beaten this act (one input to the min modifier count)
  lastRunFailed?: boolean  // if true, show mercy tiers (all options, min floor lowered)
  actHasUncollectedFragment?: boolean  // this act still has a memory fragment the player hasn't found
  crystals?: number
  ownsCharm?: boolean      // player already holds a Memory Charm in their stash
  /**
   * The player's current deck-power band tier (1-5, see deckPower.ts).
   * #2296: the mandatory minimum is max(completionCount, playerBandTier - 1)
   * — a defeat still grants mercy, but it can no longer drop a Mythic-band
   * deck's minimum all the way to the floor the way a flat 0 used to.
   * Defaults to 1 (no upward pressure) for a caller that doesn't have it.
   */
  playerBandTier?: number
  onBuyCharm?: () => void
  onBegin: (chosenCount: number) => void
  onBack: () => void
}

function modifierIcon(type: ReplayModifier['type']): string {
  switch (type) {
    case 'enemyHpPercent':         return '🛡'
    case 'enemyIntervalReduction': return '⚡'
    case 'enemyHandBonus':         return '🃏'
    case 'crystalBonus':           return '◆'
    default:                       return '⚠'
  }
}

const TIER_NAMES = ['HARDENED', 'VETERAN', 'BRUTAL', 'NIGHTMARE', 'INFERNO']

function crystalBonusFor(mods: ReplayModifier[]): number {
  return mods.filter(m => m.type === 'crystalBonus').reduce((s, m) => s + m.value, 0)
}

/**
 * The mandatory minimum tier count. #2296: floored not just by how many
 * times the player has beaten this act, but by how far above the act's
 * expectations their current deck sits — a Mythic-band deck replaying an
 * early act doesn't get to declare the fight trivial by fiat.
 */
export function mandatoryMinCount(completionCount: number, playerBandTier: number, maxCount: number): number {
  return Math.max(0, Math.min(maxCount, Math.max(completionCount, playerBandTier - 1)))
}

function tierLabel(count: number): string {
  return count === 0 ? 'NO MODIFIERS' : TIER_NAMES[Math.min(count - 1, TIER_NAMES.length - 1)]
}

function buildTiers(act: Act, completionCount: number, playerBandTier: number): TierOption[] {
  const all: ReplayModifier[] = act.replayModifiers ?? []
  const minCount = mandatoryMinCount(completionCount, playerBandTier, all.length)
  const baseCrystals = crystalBonusFor(all.slice(0, minCount))
  const tiers: TierOption[] = []

  // Minimum = the greater of the earned tier and the deck-power floor above — cannot go lower.
  tiers.push({
    label: tierLabel(minCount),
    count: minCount,
    modifiers: all.slice(0, minCount),
    extraCrystals: 0,
    isBase: true,
  })

  // Optional harder tiers (up to +2 beyond the minimum, or max available)
  const upTo = Math.min(all.length, minCount + 2)
  for (let i = minCount + 1; i <= upTo; i++) {
    const mods = all.slice(0, i)
    tiers.push({
      label: tierLabel(i),
      count: i,
      modifiers: mods,
      extraCrystals: crystalBonusFor(mods) - baseCrystals + (i - minCount) * 5,
      isBase: false,
    })
  }

  return tiers
}

function buildMercyTiers(act: Act, playerBandTier: number): TierOption[] {
  const all: ReplayModifier[] = act.replayModifiers ?? []
  // A defeat still grants mercy — completionCount plays no part here — but
  // the floor is playerBandTier - 1, not an unconditional 0.
  const minCount = mandatoryMinCount(0, playerBandTier, all.length)
  const tiers: TierOption[] = []

  // Base: mandatory minimum after a failed run
  tiers.push({
    label: tierLabel(minCount),
    count: minCount,
    modifiers: all.slice(0, minCount),
    extraCrystals: 0,
    isBase: true,
  })

  // Harder tiers available as optional upgrades
  for (let i = minCount + 1; i <= all.length; i++) {
    const mods = all.slice(0, i)
    tiers.push({
      label: tierLabel(i),
      count: i,
      modifiers: mods,
      extraCrystals: crystalBonusFor(mods) + (i - minCount) * 5,
      isBase: false,
    })
  }

  return tiers
}

export function ReplayBriefingScreen({ act, completionCount, lastRunFailed, actHasUncollectedFragment, crystals, ownsCharm, playerBandTier = 1, onBuyCharm, onBegin, onBack }: Props) {
  const mercy = lastRunFailed === true
  const tiers = mercy ? buildMercyTiers(act, playerBandTier) : buildTiers(act, completionCount, playerBandTier)
  const [selected, setSelected] = useState(tiers[0]?.count ?? 0)

  const ordinal = (n: number) =>
    n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`

  return (
    <div className="replay-briefing">
      <div className="rb-header u-text-c u-col u-gap-3">
        <div className="rb-act-label">{act.title}</div>
        <div className="rb-title">// CAMPAIGN REPLAY</div>
        {mercy ? (
          <>
            <div className="rb-subtitle">
              Your last run ended in defeat. Choose your difficulty — a clean slate is available.
            </div>
            <div className="rb-rule">
              <span className="rb-mandatory">NO MODIFIERS</span> is your minimum.
              Harder tiers offer bonus crystals.
            </div>
          </>
        ) : (
          <>
            <div className="rb-subtitle">
              You have completed this act <strong>{completionCount}</strong> time{completionCount !== 1 ? 's' : ''}.
              This is your <strong>{ordinal(completionCount + 1)}</strong> run.
            </div>
            <div className="rb-rule">
              Modifiers earned on prior runs are <span className="rb-mandatory">mandatory</span>.
              Choose a harder tier for bonus crystals.
            </div>
          </>
        )}
      </div>

      <div className="rb-tiers u-col u-gap-5">
        {tiers.map(tier => {
          const isSelected = selected === tier.count
          return (
            <button
              key={tier.count}
              className={`rb-tier${isSelected ? ' rb-tier--selected' : ''}`}
              onClick={() => setSelected(tier.count)}
            >
              <div className="rb-tier-top u-flex u-items-c u-gap-4 u-wrap">
                <span className="rb-tier-label">{tier.label}</span>
                {tier.isBase && <span className="rb-tier-tag rb-tier-tag--required">REQUIRED</span>}
                {!tier.isBase && <span className="rb-tier-tag rb-tier-tag--optional">OPTIONAL</span>}
                {tier.extraCrystals > 0 && (
                  <span className="rb-tier-crystal">+{tier.extraCrystals} ◆/battle</span>
                )}
              </div>
              <ul className="rb-tier-mods">
                {tier.modifiers.length === 0 && (
                  <li className="rb-tier-mod u-flex u-items-c u-gap-3 rb-tier-mod--required">
                    <span className="rb-tier-mod-label">No modifiers active</span>
                  </li>
                )}
                {tier.modifiers.map((m, i) => (
                  <li
                    key={i}
                    className={`rb-tier-mod u-flex u-items-c u-gap-3${mercy || i < completionCount ? ' rb-tier-mod--required' : ' rb-tier-mod--bonus'}`}
                  >
                    <span className="rb-tier-mod-icon">{modifierIcon(m.type)}</span>
                    <span className="rb-tier-mod-label">{m.label}</span>
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      {actHasUncollectedFragment && (
        <div className="rb-charm u-col u-gap-3 u-text-c">
          {ownsCharm ? (
            <div className="rb-subtitle">
              🔮 <strong>Memory Charm</strong> equipped — a missing fragment will stay reachable on the map this run.
            </div>
          ) : (
            <>
              <div className="rb-subtitle">
                A memory fragment from this chapter is still missing.
              </div>
              <Button
                className="rb-charm-buy-btn"
                disabled={(crystals ?? 0) < 1000}
                onClick={onBuyCharm}
              >
                🔮 BUY MEMORY CHARM — 1000◆
              </Button>
            </>
          )}
        </div>
      )}

      <div className="rb-actions u-col u-gap-5 u-items-c">
        <Button size="lg" className="rb-begin-btn" onClick={() => onBegin(selected)}>
          BEGIN RUN ›
        </Button>
        <Button className="rb-back-btn u-text-md" onClick={onBack}>
          ← BACK
        </Button>
      </div>
    </div>
  )
}
