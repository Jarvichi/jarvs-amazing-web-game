import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { LevelUpDetail } from './LevelUpDetail'
import { getCardCatalog } from '../../../game/cards'

const meta = {
  component: LevelUpDetail,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LevelUpDetail>

export default meta
type Story = StoryObj<typeof meta>

const farmCard = getCardCatalog().find(c => c.name === 'Farm') ?? getCardCatalog().find(c => c.cardType === 'structure')!

const richCity: any  = { gold: 5000 }
const poorCity: any  = { gold: 50 }

export const CanAfford: Story = {
  args: {
    levelCard: farmCard.name,
    card: farmCard,
    city: richCity,
    onBack: fn(),
    onLevelUp: fn(),
  },
}

export const CannotAfford: Story = {
  args: {
    levelCard: farmCard.name,
    card: farmCard,
    city: poorCity,
    onBack: fn(),
    onLevelUp: fn(),
  },
}
