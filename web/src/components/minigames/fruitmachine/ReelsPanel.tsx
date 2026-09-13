import React from 'react'
import { REEL_STRIP, type LadderSymbol } from './reelConfig'

interface Props {
  display: [string, string, string]
  held: [boolean, boolean, boolean]
  recentlyHeld: [boolean, boolean, boolean]
  reelPositions: [number, number, number]
  ladderDisplay: LadderSymbol
  isSpinning: boolean
  isBusy: boolean
  isLucky: boolean
  nudgesAvailable: number
  onNudge: (i: 0 | 1 | 2, dir: 1 | -1) => void
  onToggleHold: (i: 0 | 1 | 2) => void
}

export function ReelsPanel({
  display, held, recentlyHeld, reelPositions, ladderDisplay,
  isSpinning, isBusy, isLucky, nudgesAvailable, onNudge, onToggleHold,
}: Props) {
  return (
    <div className="fm-reels u-flex u-gap-6 u-just-c">
      <table className="fm-reels-table">
        <thead>
          <tr>
            <td colSpan={3} align="center">&nbsp;</td>
            <td className="fm-ladder-reel-label" />
          </tr>
        </thead>
        <tbody>
          {/* Up Nudges */}
          <tr>
            {([0, 1, 2] as const).map(i => (
              <td key={i} className="fm-nudge">
                <button className="fm-nudge-btn" onClick={() => onNudge(i, -1)} disabled={nudgesAvailable <= 0}>▲</button>
              </td>
            ))}
            <td className="fm-ladder-reel-label">
              <div className="fm-ladder-reel-wrap u-col u-items-c u-gap-1">{isLucky ? 'Lucky?' : 'Trail'}</div>
            </td>
          </tr>
          {/* Main reels with peek symbols above/below */}
          <tr>
            {([0, 1, 2] as const).map(i => (
              <td key={i}>
                <div className={`fm-reel fm-reel--with-peek${held[i] ? ' fm-reel--held' : ''}${isSpinning && !held[i] ? ' fm-reel--spinning' : ''}`}>
                  <div className="fm-symbol fm-symbol--peek">
                    {REEL_STRIP[(reelPositions[i] - 1 + REEL_STRIP.length) % REEL_STRIP.length]}
                  </div>
                  <div className="fm-symbol">{display[i]}</div>
                  <div className="fm-symbol fm-symbol--peek">
                    {REEL_STRIP[(reelPositions[i] + 1) % REEL_STRIP.length]}
                  </div>
                </div>
              </td>
            ))}
            <td>
              <div className="fm-ladder-reel-wrap u-col u-items-c u-gap-1">
                <div className={`fm-reel fm-ladder-reel${(isSpinning || isLucky) ? ' fm-reel--spinning' : ''}`}>
                  <div className="fm-ladder-symbol">{ladderDisplay}</div>
                </div>
              </div>
            </td>
          </tr>
          {/* Down Nudges */}
          <tr>
            {([0, 1, 2] as const).map(i => (
              <td key={i} className="fm-nudge">
                <button className="fm-nudge-btn" onClick={() => onNudge(i, 1)} disabled={nudgesAvailable <= 0}>▼</button>
              </td>
            ))}
            <td />
          </tr>
          {/* Hold buttons */}
          <tr>
            {([0, 1, 2] as const).map(i => (
              <td key={i}>
                <button
                  className={`fm-hold-btn${held[i] ? ' fm-hold-btn--active' : ''}${recentlyHeld[i] && !held[i] ? ' fm-hold-btn--blocked' : ''}`}
                  onClick={() => onToggleHold(i)}
                  disabled={isBusy || recentlyHeld[i]}
                  title={recentlyHeld[i] ? 'Already held last spin' : undefined}
                >
                  {held[i] ? 'HELD' : recentlyHeld[i] ? '—' : 'HOLD'}
                </button>
              </td>
            ))}
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
