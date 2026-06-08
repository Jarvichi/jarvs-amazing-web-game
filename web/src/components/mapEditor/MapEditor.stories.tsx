import type { Meta, StoryObj } from '@storybook/react'
import { MapEditor } from './MapEditor'

const meta = {
  title:      'Map Editor/MapEditor',
  component:  MapEditor,
  parameters: {
    layout: 'fullscreen',
    docs:   { description: { component: 'Visual map editor for hub towns, castles and interiors. Dev-only — requires Storybook dev server for file saves.' } },
  },
} satisfies Meta<typeof MapEditor>

export default meta
type Story = StoryObj<typeof meta>

export const Ravenwatch: Story = {
  args: { initialMapId: 'ravenwatch' },
}

export const Millhaven: Story = {
  args: { initialMapId: 'millhaven' },
}

export const IronholdKeep: Story = {
  args: { initialMapId: 'ironholdkeep' },
}
