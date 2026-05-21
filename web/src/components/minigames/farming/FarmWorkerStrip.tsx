import React from 'react'

export interface Props {
  assignedWorkers: number
  cityPopulation:  number
  onAssign:        () => void
  onUnassign:      () => void
}

export function FarmWorkerStrip({ assignedWorkers, cityPopulation, onAssign, onUnassign }: Props) {
  const canAssign   = assignedWorkers < cityPopulation
  const canUnassign = assignedWorkers > 0

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
        {assignedWorkers}<span className="farm-worker-sep">/</span>{cityPopulation}
      </span>
      <button
        className="farm-worker-btn"
        onClick={onAssign}
        disabled={!canAssign}
        title={canAssign ? 'Assign a city resident as a farmer' : 'No spare city residents'}
        aria-label="Assign farmer"
      >
        +
      </button>
      <span className="farm-worker-hint">
        +{(assignedWorkers * 5).toFixed(0)}% production · {assignedWorkers * 2} def
      </span>
    </div>
  )
}
