import React, { useEffect, useState } from 'react'
import { CardTile } from './CardTile'
import { getCardCatalog } from '../game/cards'
import { NodeType } from '../game/questline'

interface Props {
  choices: string[]     // 3 card names
  nodeType: NodeType
  crystals: number      // crystals awarded for this battle
  onPick: (cardName: string) => void
  onSkip: () => void
  headerOverride?: { title: string; sub: string }
}

const NODE_FLAVOUR: Record<NodeType, string> = {
  battle:   'The enemy is routed. Pick a card from the spoils.',
  elite:    'A formidable foe falls. Choose your reward.',
  boss:     'The shard guardian is defeated. A legendary prize awaits.',
  rest:     '',
  event:    '',
  merchant: '',
}

export function PostBattleReward({ choices, nodeType, crystals, onPick, onSkip, headerOverride }: Props) {
  const catalog = getCardCatalog()
  const cards   = choices.map(name => catalog.find(c => c.name === name)).filter(Boolean) as ReturnType<typeof getCardCatalog>[number][]

  // Track which cards have been flipped (revealed face-up)
  const [flipped, setFlipped] = useState<boolean[]>(() => choices.map(() => false))
  const [picked,  setPicked]  = useState<string | null>(null)

  // Sequentially reveal cards with a short stagger; re-run if choices arrive late
  useEffect(() => {
    setFlipped(choices.map(() => false))
    setPicked(null)
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

  function handlePick(name: string) {
    if (picked || !flipped[cards.findIndex(c => c.name === name)]) return
    setPicked(name)
    setTimeout(() => onPick(name), 380)
  }

  const allFlipped = flipped.every(Boolean)

  return (
    <div className="reward-screen">
      <div className="reward-header">
        <div className="reward-title">{headerOverride?.title ?? 'VICTORY'}</div>
        <div className="reward-sub">{headerOverride?.sub ?? NODE_FLAVOUR[nodeType]}</div>
        {crystals > 0 && <div className="reward-crystals">+{crystals} ◆</div>}
      </div>

      <div className="reward-cards">
        {cards.map((card, i) => (
          <div key={card.name} className="reward-card-flip-wrap">
            <div
              className={`reward-card-flipper${flipped[i] ? ' reward-card-flipper--flipped' : ''}`}
              onClick={() => handlePick(card.name)}
              style={{
                cursor: flipped[i] && !picked ? 'pointer' : 'default',
                opacity: picked && picked !== card.name ? 0.3 : 1,
                transition: 'opacity 0.3s ease',
              }}
            >
              {/* Back face */}
              <div className="reward-card-back">✦</div>
              {/* Front face */}
              <div className="reward-card-face">
                <CardTile card={card} canAfford={true} onClick={() => handlePick(card.name)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {allFlipped && !picked && (
        <button className="action-btn reward-skip-btn" onClick={onSkip}>
          SKIP REWARD
        </button>
      )}
    </div>
  )
}
