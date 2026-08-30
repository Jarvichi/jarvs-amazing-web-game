import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { ChronicleRow } from './ChronicleRow'

const meta = {
  component: ChronicleRow,
  args: { onOpen: fn(), onDismiss: fn() },
} satisfies Meta<typeof ChronicleRow>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    number: 7,
    title: "The Archive's Last Silence",
    teaser: 'The order swore to record everything and judge nothing. Then it learned something it could not simply file.',
    date: '25 Aug',
    reward: '💎 40 crystals',
  },
}

export const Unread: Story = {
  args: { ...Default.args, unread: true },
}

/** No route to the Chronicle — the row still reads, it just isn't tappable. */
export const NotTappable: Story = {
  args: { ...Default.args, onOpen: undefined },
}
