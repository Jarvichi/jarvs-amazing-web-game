import React from 'react'

export interface Props {
  assignedWorkers: number
  maxWorkers:      number
  nextFarmerCost:  number | null
  cityGold:        number
  onAssign:        () => void
  onUnassign:      () => void
  onHireFarmer:    () => void
}

export function FarmWorkerStrip({
  assignedWorkers, maxWorkers, nextFarmerCost, cityGold,
  onAssign, onUnassign, onHireFarmer,
}: Props) {
  const canAssign   = assignedWorkers < maxWorkers
  const canUnassign = assignedWorkers > 0
  const canHire     = nextFarmerCost !== null && cityGold >= nextFarmerCost

  return (
    <div className="farm-worker-strip">
      <span className="farm-worker-label">👨‍🌾 Farmers</span>
      <button
        className="farm-worker-btn"
        onClick={onUnassign}
        disabled={!canUnassign}
        title="Send a farmer back to the city"
        aria-label="Unassign farmer"
      >
        −
      </button>
      <span className="farm-worker-count">
        {assignedWorkers}<span className="farm-worker-sep">/</span>{maxWorkers}
      </span>
      <button
        className="farm-worker-btn"
        onClick={onAssign}
        disabled={!canAssign}
        title={canAssign ? 'Assign a city resident as a farmer' : 'All farmer slots filled — hire more below'}
        aria-label="Assign farmer"
      >
        +
      </button>
      <span className="farm-worker-hint">
        +{(assignedWorkers * 5).toFixed(0)}% production · {assignedWorkers * 2} def
      </span>
      {nextFarmerCost !== null && (
        <button
          className={`farm-worker-hire-btn${canHire ? ' farm-worker-hire-btn--ready' : ''}`}
          onClick={onHireFarmer}
          disabled={!canHire}
          title={canHire
            ? `Hire a new farmer slot for ⚙ ${nextFarmerCost.toLocaleString()} gold`
            : `Need ⚙ ${nextFarmerCost.toLocaleString()} gold to hire`}
        >
          + HIRE  ⚙ {nextFarmerCost.toLocaleString()}
        </button>
      )}
    </div>
  )
}
