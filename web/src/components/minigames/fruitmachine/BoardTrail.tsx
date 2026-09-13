import React from 'react'
import type { BoardWindowEntry } from './boardConfig'

interface Props {
  boardWindow: BoardWindowEntry[]
  boardPos: number
  totalNodes: number
}

export function BoardTrail({ boardWindow, boardPos, totalNodes }: Props) {
  return (
    <>
      <div className="fm-board u-flex u-gap-2 u-just-c">
        {boardWindow.map(({ idx, node, isCurrent }) => (
          <div key={idx} className={`fm-board-node${isCurrent ? ' fm-board-node--current' : ''}`}>
            <div className="fm-board-node-label">{node.label}</div>
          </div>
        ))}
      </div>
      <div className="fm-board u-flex u-gap-2 u-just-c">
        {boardPos + 1}/{totalNodes + 1}
      </div>
    </>
  )
}
