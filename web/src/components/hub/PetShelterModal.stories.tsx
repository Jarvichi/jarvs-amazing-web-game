import type { Meta, StoryObj } from '@storybook/react-vite'
import { PetShelterModal } from './PetShelterModal'
import { adoptPet } from '../../game/hub/pet'

const meta = {
  component: PetShelterModal,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PetShelterModal>

export default meta
type Story = StoryObj<typeof meta>

export const FirstVisit: Story = {
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

export const AlreadyHasPet: Story = {
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
