import type { Meta, StoryObj } from '@storybook/react-vite'
import { ChefCookingModal } from './ChefCookingModal'
import type { CookIngredient } from '../../game/hub/chefCooking'

const bag: CookIngredient[] = [
  { id: 'chicken-feed',      name: 'Chicken Feed',      icon: '🌾', count: 4 },
  { id: 'egg',               name: 'Egg',               icon: '🥚', count: 3 },
  { id: 'fish-large',        name: 'Large Fish',        icon: '🦈', count: 1 },
  { id: 'glowcap-mushroom',  name: 'Glowcap Mushroom',  icon: '🍄', count: 2 },
  { id: 'honey',             name: 'Honey',             icon: '🍯', count: 1 },
  { id: 'rainwater',         name: 'Rainwater',         icon: '💧', count: 6 },
  { id: 'spice-pouch',       name: 'Spice Pouch',       icon: '🧂', count: 1 },
  { id: 'wild-berries',      name: 'Wild Berries',      icon: '🫐', count: 2 },
]

const meta = {
  component: ChefCookingModal,
  parameters: { layout: 'fullscreen' },
  args: {
    chefName: 'Mad Chef Grimble',
    maxIngredients: 5,
    onCook: () => {},
    onClose: () => {},
  },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChefCookingModal>

export default meta
type Story = StoryObj<typeof meta>

/** A full satchel — the ordinary case, nothing picked yet. */
export const Default: Story = {
  args: { items: bag },
}

/** One item to choose from, so the grid's single-tile layout stays honest. */
export const SingleIngredient: Story = {
  args: { items: [bag[0]] },
}

/** Nothing to cook with — the chef says so rather than showing an empty grid. */
export const EmptySatchel: Story = {
  args: { items: [] },
}
