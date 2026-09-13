import type { Meta, StoryObj } from '@storybook/react-vite'
import { BoardTrail } from './BoardTrail'
import { BOARD_NODES } from './boardConfig'

const meta = {
  component: BoardTrail,
} satisfies Meta<typeof BoardTrail>

export default meta
type Story = StoryObj<typeof meta>

function windowAround(pos: number) {
  return [-2, -1, 0, 1, 2].flatMap(offset => {
    const absPos = pos + offset
    if (absPos < 0) return []
    const idx = absPos % BOARD_NODES.length
    return [{ idx, node: BOARD_NODES[idx], isCurrent: offset === 0 }]
  })
}

export const Default: Story = {
  args: {
    boardWindow: windowAround(10),
    boardPos: 10,
    totalNodes: BOARD_NODES.length,
  },
}

export const AtStart: Story = {
  args: {
    boardWindow: windowAround(0),
    boardPos: 0,
    totalNodes: BOARD_NODES.length,
  },
}
