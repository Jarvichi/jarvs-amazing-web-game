import React from 'react'
import { CityCell } from '../../../game/cityBuilder'
import { SpriteImg } from '../../ui/SpriteImg'

export interface Props {
  grid: (CityCell | null)[]
  cols: number
  rows: number
}

export function CityThumbnail({ grid, cols, rows }: Props) {
  return (
    <div className="fort-ring-city u-col u-items-c u-just-c u-gap-1" style={{ gridArea: 'ct' }}>
      <div
        className="fort-ring-city-grid u-grow u-gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
      >
        {Array.from({ length: cols * rows }, (_, i) => (
          <div key={i} className="fort-ring-city-cell u-flex u-items-c u-just-c">
            {grid[i] && <SpriteImg name={grid[i]!.cardName} className="fort-ring-city-sprite" />}
          </div>
        ))}
      </div>
      <div className="fort-ring-city-label">CITY</div>
    </div>
  )
}
