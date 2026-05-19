import React, { useState } from 'react'
import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { ZoneEditor } from './ZoneEditor'

const meta = {
  component: ZoneEditor,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ZoneEditor>

export default meta
type Story = StoryObj<typeof meta>

const baseCity: any = {
  grid: new Array(16).fill(undefined),
  rows: 4,
  resources: { wheat: 0, wood: 0, ore: 0, bread: 0, planks: 0, metal: 0 },
  gold: 0,
  fortifications: [],
  builderQueue: [],
  happiness: {},
  districts: {},
}

function Wrapper({ initialCity }: { initialCity: any }) {
  const [city, setCity] = useState(initialCity)
  return <ZoneEditor city={city} onSave={setCity} onBack={fn()} />
}

export const EmptyZones: Story = {
  args: {} as any,
  render: () => <Wrapper initialCity={baseCity} />,
}

export const WithZones: Story = {
  args: {} as any,
  render: () => (
    <Wrapper initialCity={{ ...baseCity, districts: { 0: 'farming', 1: 'industrial', 2: 'military' } }} />
  ),
}
