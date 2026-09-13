import React from 'react'
import { Button } from '../../ui/Button'
import { Icon } from '../../ui/icons/Icon'

const SPIN_COUNT_OPTIONS = [1, 5, 10, 25, 50] as const
export type SpinCount = (typeof SPIN_COUNT_OPTIONS)[number]

interface Props {
  isNudge: boolean
  isLucky: boolean
  isBusy: boolean
  isInAutoSpin: boolean
  nudgesAvailable: number
  freeSpin: boolean
  spinCount: SpinCount
  autoSpinsLeft: number
  canSpin: boolean
  onStartSpin: () => void
  onSetSpinCount: (n: SpinCount) => void
  onStopAutoSpin: () => void
  onFinishNudge: () => void
  onStopLucky: () => void
  credits: number
  ticketsPerCredit: number
  onCashOut: () => void
  canBuy: boolean
  buyCost: number
  buyAmount: number
  availCrystals: number
  onBuyCredits: () => void
}

export function SpinControls({
  isNudge, isLucky, isBusy, isInAutoSpin, nudgesAvailable, freeSpin, spinCount, autoSpinsLeft,
  canSpin, onStartSpin, onSetSpinCount, onStopAutoSpin, onFinishNudge, onStopLucky,
  credits, ticketsPerCredit, onCashOut, canBuy, buyCost, buyAmount, availCrystals, onBuyCredits,
}: Props) {
  return (
    <>
      <div className="fm-controls u-flex u-gap-6 u-just-c u-wrap">
        <div className={`action-btn ${isNudge || isLucky ? 'action-btn--disabled' : 'action-btn--gold'}`}>
          {isNudge ? (
            <div className="action-btn action-btn--noborder-disabled">NUDGE — {nudgesAvailable} remaining</div>
          ) : isLucky ? (
            <div className="action-btn action-btn--noborder-disabled">LUCKY? — Tap STOP to freeze the trail reel!</div>
          ) : (
            <>
              <Button className="action-btn--noborder" onClick={onStartSpin} disabled={!canSpin}>
                {freeSpin ? 'FREE SPIN' : spinCount === 1 ? 'SPIN (1 credit)' : `SPIN ×${isInAutoSpin ? autoSpinsLeft : spinCount} (${spinCount} credits)`}
              </Button>
              <div className="fm-spin-count-selector u-flex u-gap-3 u-just-c">
                {SPIN_COUNT_OPTIONS.map(n => (
                  <button
                    key={n}
                    className={`filter-btn filter-btn--gold${spinCount === n ? ' filter-btn--active' : ''}`}
                    onClick={() => onSetSpinCount(n)}
                    disabled={isBusy || isInAutoSpin}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <Button
          variant={isInAutoSpin ? 'danger' : isNudge || isLucky ? 'gold' : 'default'}
          onClick={isInAutoSpin ? onStopAutoSpin : isNudge ? onFinishNudge : isLucky ? onStopLucky : undefined}
          disabled={!isInAutoSpin && !isNudge && !isLucky}
        >
          {isInAutoSpin ? 'STOP' : isNudge ? 'DONE' : 'STOP'}
        </Button>
      </div>

      <div className="fm-controls u-flex u-gap-6 u-just-c u-wrap">
        <Button onClick={onCashOut} disabled={isBusy || isInAutoSpin}>
          CASH OUT ({credits * ticketsPerCredit} 🎫)
        </Button>
      </div>

      {canBuy && (
        <button className="fm-buy-credits" onClick={onBuyCredits}>
          + Buy {buyAmount} credits — {buyCost} <Icon name="crystal" size={12} /> (you have {availCrystals})
        </button>
      )}
    </>
  )
}
