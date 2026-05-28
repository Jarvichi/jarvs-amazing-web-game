import { fn } from 'storybook/test'
import { useRef } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubTownCanvas } from './HubTownCanvas'

const meta = {
  component: HubTownCanvas,
  render: (args) => {
    const returnRef = useRef<(() => void) | null>(null)
    return <HubTownCanvas {...args} returnRef={returnRef} />
  },
} satisfies Meta<typeof HubTownCanvas>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onAreaEnter:    fn(),
    onNodeInteract: fn(),
    onAvatarMove:   fn(),
  },
}
