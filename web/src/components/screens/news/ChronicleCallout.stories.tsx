import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { ChronicleCallout } from './ChronicleCallout'

const meta = {
  component: ChronicleCallout,
  args: { onOpen: fn() },
} satisfies Meta<typeof ChronicleCallout>

export default meta

type Story = StoryObj<typeof meta>

export const Unread: Story = {
  args: {
    number: 7,
    title: "The Archive's Last Silence",
    teaser: 'The order swore to record everything and judge nothing. Then it learned something it could not simply file.',
    reward: '💎 40 crystals',
    unread: true,
  },
}

/** Already read: the same chapter, without the gold flag. */
export const Read: Story = {
  args: { ...Unread.args, unread: false },
}
