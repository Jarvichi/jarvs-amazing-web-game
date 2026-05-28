import { fn } from 'storybook/test'
import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubDialogue } from './HubDialogue'

const meta = {
  component: HubDialogue,
  render: (args) => {
    const [line, setLine] = useState(args.line)
    return <HubDialogue line={line} onClose={() => setLine(null)} />
  },
} satisfies Meta<typeof HubDialogue>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  args: {
    line: 'The roads beyond the outer walls grow darker by the day. Tread carefully, wanderer.',
    onClose: fn(),
  },
}

export const Closed: Story = {
  args: {
    line: null,
    onClose: fn(),
  },
}
