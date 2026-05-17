import type { Meta, StoryObj } from '@storybook/react-vite'
import { CityThumbnail } from './CityThumbnail'
import { getCardCatalog } from '../../../game/cards'

const meta = {
  component: CityThumbnail,
} satisfies Meta<typeof CityThumbnail>

export default meta
type Story = StoryObj<typeof meta>

const structures = getCardCatalog().filter(c => c.cardType === 'structure')

const sparseGrid = Array(20).fill(null).map((_, i) =>
  i % 3 === 0 && structures[i % structures.length]
    ? { cardName: structures[i % structures.length].name, level: 0 } as any
    : null
)

export const Empty: Story = {
  args: { grid: Array(20).fill(null), cols: 5, rows: 4 },
}

export const Populated: Story = {
  args: { grid: sparseGrid, cols: 5, rows: 4 },
}
