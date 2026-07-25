import React from 'react'
import { MemoryFragment } from '../../game/codex'

interface Props {
  fragment: MemoryFragment
  alreadyFound: boolean
  shardBonus: boolean
  onCollect: () => void
}

export function MemoryFragmentScreen({ fragment, alreadyFound, shardBonus, onCollect }: Props) {
  return (
    <div className="overlay-screen memory-screen">
      <div className="memory-type-tag">[MEMORY FRAGMENT]</div>
      <div className="memory-title">{fragment.title}</div>

      <div className="memory-body">
        {fragment.body.split('\n\n').map((para, i) => (
          <p key={i} className="memory-para">{para}</p>
        ))}
      </div>

      {alreadyFound && (
        <div className="memory-already-found">— ALREADY DISCOVERED —</div>
      )}

      {!alreadyFound && shardBonus && (
        <div className="memory-shard-bonus">
          ◆ All shard memories restored. A gift from the past — Health Potion added to supplies.
        </div>
      )}

      <button className="event-choice-btn memory-collect-btn" onClick={onCollect}>
        {alreadyFound ? 'RETURN TO MAP ›' : 'ADD TO CODEX ›'}
      </button>
    </div>
  )
}
