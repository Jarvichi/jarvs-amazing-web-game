import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HomeGrid } from './HomeGrid'
import type { FurnitureDef } from '../../../game/hub/furniture'
import type { PlacedFurniture } from '../../../game/hub/homeLayout'

const DEFS: Record<string, FurnitureDef> = {
  'reading-lamp': { id: 'reading-lamp', name: 'Reading Lamp', icon: '💡', desc: '', footprint: { w: 1, h: 1 }, price: 20 },
  'cozy-rug': { id: 'cozy-rug', name: 'Cozy Rug', icon: '🟥', desc: '', footprint: { w: 2, h: 2 }, price: 30 },
  'round-table': { id: 'round-table', name: 'Round Table', icon: '🟤', desc: '', footprint: { w: 2, h: 1 }, price: 35 },
}

function getDef(itemId: string): FurnitureDef | undefined {
  return DEFS[itemId]
}

const meta = {
  component: HomeGrid,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HomeGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    placed: [],
    getDef,
    selectedId: null,
    tappable: true,
    onCellTap: fn(),
    onPieceTap: fn(),
  },
}

const populated: PlacedFurniture[] = [
  { id: 'lamp-1', itemId: 'reading-lamp', x: 0, y: 0, rotation: 0 },
  { id: 'rug-1', itemId: 'cozy-rug', x: 2, y: 1, rotation: 0 },
  { id: 'table-1', itemId: 'round-table', x: 5, y: 4, rotation: 90 },
]

export const Populated: Story = {
  args: {
    placed: populated,
    getDef,
    selectedId: null,
    tappable: false,
    onCellTap: fn(),
    onPieceTap: fn(),
  },
}

export const PieceSelected: Story = {
  args: {
    placed: populated,
    getDef,
    selectedId: 'rug-1',
    tappable: false,
    onCellTap: fn(),
    onPieceTap: fn(),
  },
}

export const ArmedForPlacement: Story = {
  args: {
    placed: populated,
    getDef,
    selectedId: null,
    tappable: true,
    onCellTap: fn(),
    onPieceTap: fn(),
  },
}
