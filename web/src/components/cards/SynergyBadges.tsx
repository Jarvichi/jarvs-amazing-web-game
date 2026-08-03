import { SynergyGroup } from '../../game/synergies'

interface Props {
  /** Groups this card belongs to, most specific first. Only the first `maxGroups` render. */
  groups: SynergyGroup[]
  /**
   * How many cards in the current deck this card pairs with. Omit outside the
   * deck builder — the ⚡ count only means something next to a deck.
   */
  deckMatches?: number
  /** Cap on group icons shown. The card tile is dense; two is all that fits. */
  maxGroups?: number
}

/**
 * Synergy markers for a card. Icon-only by design — a card tile has no room for
 * group names, so the labels live in the `title` tooltip and the full breakdown
 * lives in CardDetailModal.
 */
export function SynergyBadges({ groups, deckMatches = 0, maxGroups = 2 }: Props) {
  const shown = groups.slice(0, maxGroups)
  if (shown.length === 0 && deckMatches === 0) return null

  const tooltip = [
    ...groups.map(g => `${g.icon} ${g.label}`),
    deckMatches > 0 ? `Pairs with ${deckMatches} card${deckMatches === 1 ? '' : 's'} in your deck` : '',
  ].filter(Boolean).join('\n')

  return (
    <div className="card-synergy-badge" title={tooltip}>
      {shown.map(g => (
        <span key={g.id} className="card-synergy-icon">{g.icon}</span>
      ))}
      {deckMatches > 0 && (
        <span className="card-synergy-count">⚡{deckMatches}</span>
      )}
    </div>
  )
}
