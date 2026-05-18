import React from 'react'
import { CityState, TradeOffer, ActiveCaravan, RESOURCE_ICONS } from '../../../game/cityBuilder'

function fmtMs(ms: number): string {
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export interface Props {
  city:             CityState
  currentTime:      number
  onDispatch:       () => void
  onClose:          () => void
}

function OfferCard({ offer, city, currentTime, onDispatch, onClose }: {
  offer: TradeOffer
  city: CityState
  currentTime: number
  onDispatch: () => void
  onClose: () => void
}) {
  const isSell = offer.direction === 'sell'
  const canAfford = isSell
    ? city.resources[offer.resource] >= offer.amount
    : city.gold >= offer.gold
  const expiresIn = Math.max(0, offer.expiresAt - currentTime)

  return (
    <div className="city-trade-offer">
      <div className="city-trade-offer-title">
        {isSell ? '📤 SELL OFFER' : '📥 BUY OFFER'}
        <span className="city-trade-expires"> expires {fmtMs(expiresIn)}</span>
      </div>
      <div className="city-trade-offer-body">
        {isSell ? (
          <>
            Send <strong>{offer.amount} {RESOURCE_ICONS[offer.resource]} {offer.resource}</strong>
            {' '}→ receive <strong>⚙ {offer.gold.toLocaleString()} gold</strong>
          </>
        ) : (
          <>
            Pay <strong>⚙ {offer.gold.toLocaleString()} gold</strong>
            {' '}→ receive <strong>{offer.amount} {RESOURCE_ICONS[offer.resource]} {offer.resource}</strong>
          </>
        )}
      </div>
      {!canAfford && (
        <div className="city-trade-warn">
          {isSell ? `Need ${offer.amount} ${offer.resource} (have ${Math.floor(city.resources[offer.resource])})` : `Need ⚙ ${offer.gold.toLocaleString()} gold`}
        </div>
      )}
      <button
        className={`action-btn${canAfford ? ' action-btn--gold' : ''}`}
        disabled={!canAfford}
        onClick={() => { onDispatch(); onClose() }}
      >
        🐪 DISPATCH CARAVAN
      </button>
    </div>
  )
}

function CaravanStatus({ caravan, currentTime }: { caravan: ActiveCaravan; currentTime: number }) {
  const returnsIn = Math.max(0, caravan.returnsAt - currentTime)
  const isSell = caravan.offer.direction === 'sell'
  return (
    <div className="city-trade-caravan">
      <div className="city-trade-caravan-title">🐪 CARAVAN AWAY</div>
      <div className="city-trade-caravan-body">
        {isSell
          ? `Delivering ${caravan.offer.amount} ${caravan.offer.resource} — returning with ⚙ ${caravan.offer.gold.toLocaleString()} gold`
          : `Fetching ${caravan.offer.amount} ${caravan.offer.resource} — returning in ${fmtMs(returnsIn)}`
        }
      </div>
      <div className="city-trade-returns">Returns in {fmtMs(returnsIn)}</div>
    </div>
  )
}

export function TradeRouteModal({ city, currentTime, onDispatch, onClose }: Props) {
  return (
    <div className="city-req-overlay" onClick={onClose}>
      <div className="city-req-modal" onClick={e => e.stopPropagation()}>
        <div className="city-req-header">🐪 TRADE ROUTES</div>
        <div className="city-trade-desc">
          Dispatch a caravan to trade resources. A new offer arrives every 4 hours.
          The caravan returns with goods after 2 hours.
        </div>

        {city.activeCaravan ? (
          <CaravanStatus caravan={city.activeCaravan} currentTime={currentTime} />
        ) : city.tradeOffer ? (
          <OfferCard
            offer={city.tradeOffer}
            city={city}
            currentTime={currentTime}
            onDispatch={onDispatch}
            onClose={onClose}
          />
        ) : (
          <div className="city-trade-waiting">No offer available yet — check back soon.</div>
        )}

        <button className="action-btn" onClick={onClose}>CLOSE</button>
      </div>
    </div>
  )
}
