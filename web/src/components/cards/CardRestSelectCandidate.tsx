import React, { useState } from 'react'
import { SpriteImg } from '../ui/SpriteImg'

interface Props {
  name: string
  playCount: number
  rank: number
  isSelected: boolean
  onClick: (name: string) => void
}

export function CardRestSelectCandidate({ name, playCount, rank, isSelected, onClick }: Props) {
  return (
    <div
      className={[
        'card-rest-candidate',
        isSelected ? 'card-rest-candidate--selected' : '',
      ].join(' ')}
      onClick={() => onClick(name)}
    >
      <div className="card-art u-flex u-items-c u-just-c">
        {isSelected ? <span className="card-art-flame">🔥</span> : null}
        <SpriteImg name={name} className="card-sprite" />
      </div>
      <div className="crc-rank">#{rank} most used</div>
      <div className="crc-name">{name}</div>
      <div className="crc-count">×{playCount ?? 0} plays this act</div>
    </div>
  )
}
