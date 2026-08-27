import React from 'react'

interface Props {
  areaName: string | null
}

/** Ambient overlay in the canvas's corner: the name of the area you just
 *  walked into, fading in and out as you move between them.
 *
 *  Used to also carry the clock and the weather glyph. The clock went to the
 *  header because it's load-bearing for hub decisions (shop hours, NPC
 *  schedules, festivals), and the weather followed it there: it gates
 *  dialogue choices and dig spots, so it belongs with the other actionable
 *  readouts rather than in a corner the eye only visits by accident. The
 *  rain/snow particles on the canvas are unaffected — those are the weather
 *  itself, not a label for it.
 *
 *  What's left is genuinely local: the area name has no second home, and it
 *  means nothing outside the canvas it's naming. */
export function HubStatusCluster({ areaName }: Props) {
  return (
    <div className="hub-status-cluster">
      <div className={`hub-status-cluster__area${areaName ? ' hub-status-cluster__area--visible' : ''}`}>
        {areaName ?? ''}
      </div>
    </div>
  )
}
