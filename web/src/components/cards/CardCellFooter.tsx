import React from 'react'
import { MasteryBar } from '../ui/MasteryBar'

interface Props {
  /**
   * The count line. Left free-form because the three call sites genuinely
   * count different things — the Collection screen shows copies owned
   * (`×4`), the deck builder's deck panel shows copies in the deck (`×2`),
   * and its collection panel shows the ratio (`1/4`). Everything *around*
   * the count is fixed here so the three stop drifting apart.
   */
  children: React.ReactNode
  /** Mastery bar is rendered whenever there is any XP at all. */
  xp?: number
  /** Opens the card detail modal. Omit to hide the ⓘ button. */
  onInfo?: () => void
}

/**
 * The strip under a card tile in any card grid.
 *
 * This markup used to be copy-pasted at three call sites, which is how they
 * ended up disagreeing: the deck panel had no ⓘ button at all (so a card in
 * your deck could not be inspected without hunting for it in the collection
 * below), and only two of the three rendered a mastery bar.
 */
export function CardCellFooter({ children, xp, onInfo }: Props) {
  return (
    <div className="cell-footer">
      {/* Count and ⓘ share a line; the mastery bar gets the full width
          underneath. The ⓘ previously used .extra-btn, whose `flex: 1` in
          this column-direction footer stretched it into a tall block
          detached from its own card. */}
      <div className="cell-footer-top">
        {children}
        {onInfo && (
          <button
            className="cell-info-btn"
            onClick={e => { e.stopPropagation(); onInfo() }}
            title="Card details"
            aria-label="Card details"
          >ⓘ</button>
        )}
      </div>
      {xp !== undefined && xp > 0 && <MasteryBar xp={xp} />}
    </div>
  )
}
