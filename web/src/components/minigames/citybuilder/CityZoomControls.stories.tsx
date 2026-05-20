import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { CityZoomControls } from './CityZoomControls'

const meta: Meta<typeof CityZoomControls> = {
  title: 'CityBuilder/CityZoomControls',
  component: CityZoomControls,
  parameters: { backgrounds: { default: 'dark' } },
}
export default meta
type Story = StoryObj<typeof CityZoomControls>

export const AtMin: Story = {
  args: { scale: 1, onZoomIn: fn(), onZoomOut: fn(), onZoomTo: fn() },
}

export const AtMid: Story = {
  args: { scale: 2, onZoomIn: fn(), onZoomOut: fn(), onZoomTo: fn() },
}

export const AtMax: Story = {
  args: { scale: 4, onZoomIn: fn(), onZoomOut: fn(), onZoomTo: fn() },
}
