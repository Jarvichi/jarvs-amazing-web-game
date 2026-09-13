import type { Meta, StoryObj } from '@storybook/react-vite'
import { WordMeter } from './WordMeter'

const meta = {
  component: WordMeter,
} satisfies Meta<typeof WordMeter>

export default meta
type Story = StoryObj<typeof meta>

export const Trail: Story = {
  args: {
    letters: ['T', 'R', 'A', 'I', 'L'],
    litCount: 2,
    title: 'Land 🌟 symbols to spell TRAIL and advance the board',
  },
}

export const Loser: Story = {
  args: {
    letters: ['L', 'O', 'S', 'E', 'R'],
    litCount: 3,
    tone: 'loser',
    title: 'Each trail Lose lights a letter — spell LOSER to jump to position 35',
  },
}

export const Empty: Story = {
  args: {
    letters: ['T', 'R', 'A', 'I', 'L'],
    litCount: 0,
  },
}
