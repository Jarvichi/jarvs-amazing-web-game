import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { FishAppraisalScreen } from './FishAppraisalScreen'
import type { CaughtFish } from '../../game/hub/caughtFish'

function seedCaughtFish(fish: Omit<CaughtFish, 'id'>[]): void {
  localStorage.setItem('jarv_caught_fish', JSON.stringify(fish.map((f, i) => ({ ...f, id: `story-${i}` }))))
}

const meta = {
  component: FishAppraisalScreen,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FishAppraisalScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: { crystals: 100, onCrystalsChange: fn(), onBack: fn() },
  decorators: [
    (Story) => { seedCaughtFish([]); return <Story /> },
  ],
}

export const WithCatches: Story = {
  args: { crystals: 250, onCrystalsChange: fn(), onBack: fn() },
  decorators: [
    (Story) => {
      seedCaughtFish([
        { locale: 'ocean', tier: 'Shoal', tierIcon: '🐟', name: 'Silverside', weightGrams: 150, lengthCm: 10, stars: 2 },
        { locale: 'ocean', tier: 'Reef', tierIcon: '🐠', name: 'Mackerel', weightGrams: 1900, lengthCm: 44, stars: 4 },
        { locale: 'ocean', tier: 'Deep Sea', tierIcon: '🏆', name: 'Giant Tuna', weightGrams: 24500, lengthCm: 149, stars: 5 },
        { locale: 'river', tier: 'Tiddler', tierIcon: '🐟', name: 'Minnow', weightGrams: 480, lengthCm: 24, stars: 5 },
      ])
      return <Story />
    },
  ],
}
