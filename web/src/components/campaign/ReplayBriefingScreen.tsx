import React, { useState } from 'react'
import { Act, ReplayModifier } from '../../game/questline'

interface TierOption {
  label: string
  count: number
  modifiers: ReplayModifier[]
  extraCrystals: number  // bonus crystals per battle vs base earned difficulty
  isBase: boolean        // this is the player's minimum earned tier
}

interface Props {
  act: Act
  completionCount: number  // how many times the player has beaten this act (= min modifier count)
  lastRunFailed?: boolean  // if true, show mercy tiers (all options, min = 0)
  actHasUncollectedFragment?: boolean  // this act still has a memory fragment the player hasn't found
  crystals?: number
  ownsCharm?: boolean      // player already holds a Memory Charm in their stash
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

function buildTiers(act: Act, completionCount: number): TierOption[] {
  const all: ReplayModifier[] = act.replayModifiers ?? []
  const baseCrystals = crystalBonusFor(all.slice(0, completionCount))
  const tiers: TierOption[] = []

  // Minimum = earned tier (completion count modifiers, cannot go lower)
  tiers.push({
    label: TIER_NAMES[Math.min(completionCount - 1, TIER_NAMES.length - 1)],
    count: completionCount,
    modifiers: all.slice(0, completionCount),
    extraCrystals: 0,
    isBase: true,
  })

  // Optional harder tiers (up to +2 beyond base, or max available)
  const upTo = Math.min(all.length, completionCount + 2)
  for (let i = completionCount + 1; i <= upTo; i++) {
    const mods = all.slice(0, i)
    tiers.push({
      label: TIER_NAMES[Math.min(i - 1, TIER_NAMES.length - 1)],
      count: i,
      modifiers: mods,
      extraCrystals: crystalBonusFor(mods) - baseCrystals + (i - completionCount) * 5,
      isBase: false,
    })
  }

  return tiers
}

function buildMercyTiers(act: Act): TierOption[] {
  const all: ReplayModifier[] = act.replayModifiers ?? []
  const tiers: TierOption[] = []

  // Base: no modifiers (mandatory minimum after a failed run)
  tiers.push({
    label: 'NO MODIFIERS',
    count: 0,
    modifiers: [],
    extraCrystals: 0,
    isBase: true,
  })

  // All modifier tiers available as optional upgrades
  for (let i = 1; i <= all.length; i++) {
    const mods = all.slice(0, i)
    tiers.push({
      label: TIER_NAMES[Math.min(i - 1, TIER_NAMES.length - 1)],
      count: i,
      modifiers: mods,
      extraCrystals: crystalBonusFor(mods) + i * 5,
      isBase: false,
    })
  }

  return tiers
}

export function ReplayBriefingScreen({ act, completionCount, lastRunFailed, actHasUncollectedFragment, crystals, ownsCharm, onBuyCharm, onBegin, onBack }: Props) {
  const mercy = lastRunFailed === true
  const tiers = mercy ? buildMercyTiers(act) : buildTiers(act, completionCount)
  const [selected, setSelected] = useState(mercy ? 0 : completionCount)

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
              <button
                className="action-btn rb-charm-buy-btn"
                disabled={(crystals ?? 0) < 1000}
                onClick={onBuyCharm}
              >
                🔮 BUY MEMORY CHARM — 1000◆
              </button>
            </>
          )}
        </div>
      )}

      <div className="rb-actions u-col u-gap-5 u-items-c">
        <button className="action-btn action-btn--large rb-begin-btn" onClick={() => onBegin(selected)}>
          BEGIN RUN ›
        </button>
        <button className="action-btn rb-back-btn u-text-md" onClick={onBack}>
          ← BACK
        </button>
      </div>
    </div>
  )
}
