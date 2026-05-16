import React, { useEffect, useState } from 'react'
import { CardTile } from '../cards/CardTile'
import { CardDetailModal } from '../cards/CardDetailModal'
import { getCardCatalog } from '../../game/cards'
import { NodeType } from '../../game/questline'
import { BattleStats, Card } from '../../game/types'

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

interface Props {
  choices: string[]     // 3 card names
  nodeType: NodeType
  crystals: number      // crystals awarded for this battle
  onPick: (cardName: string) => void
  onSkip: () => void
  headerOverride?: { title: string; sub: string }
  /** When provided, battle stats are shown above the reward cards. */
  battleSummary?: { stats: BattleStats; gameTime: number; playerScore: number }
}

const NODE_FLAVOUR: Record<NodeType, string> = {
  battle:   'The enemy is routed. Pick a card from the spoils.',
  elite:    'A formidable foe falls. Choose your reward.',
  boss:     'The shard guardian is defeated. A legendary prize awaits.',
  rest:     '',
  event:    '',
  merchant: '',
}

export function PostBattleReward({ choices, nodeType, crystals, onPick, onSkip, headerOverride, battleSummary }: Props) {
  const catalog = getCardCatalog()
  const cards   = choices.map(name => catalog.find(c => c.name === name)).filter(Boolean) as ReturnType<typeof getCardCatalog>[number][]

  // Track which cards have been flipped (revealed face-up)
  const [flipped,    setFlipped]    = useState<boolean[]>(() => choices.map(() => false))
  // Card currently being claimed (triggers dim + transition animation)
  const [claimed,    setClaimed]    = useState<string | null>(null)
  // Card the player has tapped to highlight / select
  const [selected,   setSelected]   = useState<string | null>(null)
  // Card whose detail modal is open
  const [detailCard, setDetailCard] = useState<Card | null>(null)

  // Sequentially reveal cards with a short stagger; re-run if choices arrive late
  useEffect(() => {
    setFlipped(choices.map(() => false))
    setClaimed(null)
    setSelected(null)
    const timers = choices.map((_, i) =>
      setTimeout(() => {
        setFlipped(prev => {
          const next = [...prev]
          next[i] = true
          return next
        })
      }, 350 + i * 450)
    )
    return () => timers.forEach(clearTimeout)
  }, [choices.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  function claimCard(name: string) {
    if (claimed || !flipped[cards.findIndex(c => c.name === name)]) return
    setClaimed(name)
    setTimeout(() => onPick(name), 380)
  }

  function handleCardClick(name: string, idx: number) {
    if (claimed || !flipped[idx]) return
    // Toggle selection; tapping the same card deselects it
    setSelected(prev => prev === name ? null : name)
  }

  const allFlipped = flipped.every(Boolean)

  return (
    <div className="reward-screen">
      <div className="reward-header u-text-c">
        <div className="reward-title">{headerOverride?.title ?? 'VICTORY'}</div>
        <div className="reward-sub">{headerOverride?.sub ?? NODE_FLAVOUR[nodeType]}</div>
        {crystals > 0 && <div className="reward-crystals">+{crystals} ◆</div>}
      </div>

      {battleSummary && (
        <div className="reward-battle-summary">
          <div className="reward-summary-row"><span>UNITS DEFEATED</span><span>{battleSummary.stats.playerKills}</span></div>
          <div className="reward-summary-row"><span>UNITS LOST</span><span>{battleSummary.stats.playerUnitsLost}</span></div>
          <div className="reward-summary-row"><span>DAMAGE DEALT</span><span>{battleSummary.playerScore}</span></div>
          <div className="reward-summary-row"><span>DURATION</span><span>{formatDuration(battleSummary.gameTime)}</span></div>
        </div>
      )}

      <div className="reward-cards">
        {cards.map((card, i) => {
          const isSelected  = selected === card.name
          const shouldDim   = claimed ? claimed !== card.name : selected ? selected !== card.name : false

          return (
            <div key={card.name} className="reward-card-flip-wrap">
              <div
                className={[
                  'reward-card-flipper',
                  flipped[i] ? 'reward-card-flipper--flipped' : '',
                  isSelected  ? 'reward-card-flipper--selected' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleCardClick(card.name, i)}
                style={{
                  cursor:  flipped[i] && !claimed ? 'pointer' : 'default',
                  opacity: shouldDim ? 0.3 : 1,
                  transition: 'opacity 0.3s ease',
                }}
              >
                {/* Back face */}
                <div className="reward-card-back">✦</div>
                {/* Front face */}
                <div className="reward-card-face">
                  <CardTile card={card} canAfford={true} />
                </div>
              </div>

              {/* Info button — only visible after card is revealed and before claim */}
              {flipped[i] && !claimed && (
                <button
                  className="reward-card-info-btn"
                  onClick={e => { e.stopPropagation(); setDetailCard(card) }}
                >
                  ⓘ
                </button>
              )}
            </div>
          )
        })}
      </div>

      {allFlipped && !claimed && (
        <div className="reward-actions">
          <button
            className="action-btn"
            onClick={() => {
              const target = selected ?? choices[Math.floor(Math.random() * choices.length)]
              claimCard(target)
            }}
          >
            Continue
          </button>
          <button className="action-btn reward-skip-btn" onClick={onSkip}>
            I Don't Want This Reward It'll Ruin My Deck
          </button>
        </div>
      )}

      {detailCard && (
        <CardDetailModal
          card={detailCard}
          collection={[]}
          onClose={() => setDetailCard(null)}
        />
      )}
    </div>
  )
}
