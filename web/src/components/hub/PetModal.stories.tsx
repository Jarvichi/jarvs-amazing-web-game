import type { Meta, StoryObj } from '@storybook/react-vite'
import { PetModal } from './PetModal'
import { adoptPet } from '../../game/hub/pet'

const meta = {
  component: PetModal,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PetModal>

export default meta
type Story = StoryObj<typeof meta>

export const NoPet: Story = {
  args: {
    onClose: () => {},
  },
  decorators: [
    (Story) => {
      localStorage.removeItem('jarv_hub_pet')
      return <Story />
    },
  ],
}

export const WithActivePet: Story = {
  args: {
    onClose: () => {},
  },
  decorators: [
    (Story) => {
      localStorage.removeItem('jarv_hub_pet')
      adoptPet('dog', 'golden', 'Rex')
      return <Story />
    },
  ],
}
