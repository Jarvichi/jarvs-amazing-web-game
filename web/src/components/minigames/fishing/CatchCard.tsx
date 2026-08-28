import React from 'react'
import { Panel } from '../../ui/Panel'
import { formatWeight, tierAccent, type Catch } from '../Fishing.data'

// ─── Catch card ───────────────────────────────────────────────────────────────
// The trophy screen for whatever came out of the water: a tier-coloured frame,
// the specimen's stars (previously computed and then thrown away — nothing in
// the UI ever showed them), its weight and length, and what it earned.

interface Props {
  result: Catch
  /** Index of the fish's tier within its locale's table — drives the frame
   *  colour and the "how rare was this" ribbon. Ignored for item/card finds. */
  tierIndex?: number
  /** 1-5 specimen stars for a fish catch. */
  stars?: number
  /** "+18 🎫" / "Added to inventory!" — whatever this mode paid out. */
  reward: string
}

function Stars({ count }: { count: number }) {
  return (
    <div className="catch-stars" aria-label={`${count} of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`catch-star${i <= count ? ' catch-star--on' : ''}`}>★</span>
      ))}
    </div>
  )
}

export function CatchCard({ result, tierIndex = 0, stars = 1, reward }: Props) {
  const special = result.kind !== 'fish'
  const accent = special ? '#ffcc00' : tierAccent(tierIndex)
  const icon = result.kind === 'fish' ? result.tierIcon : result.kind === 'item' ? result.icon : '🃏'
  const ribbon = result.kind === 'fish' ? result.tier
    : result.kind === 'item' ? 'SPECIAL FIND' : 'RARE CARD'

  return (
    <Panel
      elevation="floating"
      tone={special ? 'gold' : 'neutral'}
      runeCorners
      className="catch-card u-col u-items-c u-gap-3"
      style={{ '--catch-accent': accent } as React.CSSProperties}
    >
      <div className="catch-ribbon">✦ {ribbon} ✦</div>

      <div className="catch-icon-wrap">
        <div className="catch-icon-glow" />
        <div className="catch-icon">{icon}</div>
      </div>

      <div className="catch-name">{result.name}</div>

      {result.kind === 'fish' && (
        <>
          <Stars count={stars} />
          <div className="catch-stats">
            <span className="catch-stat">
              <span className="catch-stat-value">{formatWeight(result.weightGrams)}</span>
              <span className="catch-stat-key">WEIGHT</span>
            </span>
            <span className="catch-stat-div" />
            <span className="catch-stat">
              <span className="catch-stat-value">{result.lengthCm}cm</span>
              <span className="catch-stat-key">LENGTH</span>
            </span>
          </div>
        </>
      )}

      {result.kind === 'item' && <div className="catch-desc">{result.desc}</div>}
      {result.kind === 'card' && <div className="catch-desc catch-desc--rarity">{result.rarity}</div>}

      <div className="catch-reward">{reward}</div>
    </Panel>
  )
}
