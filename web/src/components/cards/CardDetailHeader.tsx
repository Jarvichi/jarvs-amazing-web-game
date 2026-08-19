import type { CSSProperties } from "react"
import { CollectionEntry, getMasteryXp, masteryProgress } from "../../game/collection"
import { Card } from "../../game/types"
import { Icon } from "../ui/icons/Icon"

export interface Props {
  card: Card
  collection: CollectionEntry[]
  colour?: string
  onClose: () => void
}

export function CardDetailHeader({ card,collection, colour, onClose }: Props) {
    const starLevel = ({ common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6, shiny: 4, holofoil: 4, glass: 4 } as Record<string,number>)[card.rarity] ?? 1
  const xp     = getMasteryXp(collection, card.name)
  const { level: masteryLvl, current: xpCur, needed: xpNeeded } = masteryProgress(xp)


    return (
                <div className="cdm-header" style={colour ? { '--cdm-rarity-color': colour } as CSSProperties : undefined}>
          <span className="cdm-name" style={{ color: colour }}>{card.name}</span>
              {masteryLvl > 0 && (
                <div className="cdm-header-mastery">Mastery ★{masteryLvl} · {xpCur}/{xpNeeded} XP</div>
              )}

          <span className="cdm-rarity" style={{ color: colour }}>
            {'★'.repeat(starLevel)}
            {' '}{card.rarity.toUpperCase()}
          </span>
          <button className="cdm-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={14} />
          </button>
        </div>
    )
}