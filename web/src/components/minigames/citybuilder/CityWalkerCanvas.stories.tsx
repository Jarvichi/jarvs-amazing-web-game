import React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { CityWalkerCanvas, CitySprite } from './CityWalkerCanvas'

const meta = {
  component: CityWalkerCanvas,
  parameters: { layout: 'centered' },
  decorators: [
    (Story: React.ComponentType) => (
      // Stands in for .city-zoom-wrapper — sprite coords are pixels in this box.
      <div style={{ width: 480, height: 320, position: 'relative', background: '#2d5a27' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CityWalkerCanvas>

export default meta
type Story = StoryObj<typeof meta>

const resident = (key: string, name: string, x: number, y: number): CitySprite =>
  ({ key, name, x, y, fps: 6 })

export const Residents: Story = {
  args: {
    sprites: [
      resident('w-0', 'Goblin',   80,  70),
      resident('w-1', 'Skeleton', 200, 70),
      resident('w-2', 'Orc',      320, 70),
      resident('w-3', 'Dragon',   440, 70),
    ],
  },
}

/** Rising discontent: the "!" marker appears first, then the dimmed grey state. */
export const UnhappyResidents: Story = {
  args: {
    sprites: [
      { ...resident('w-0', 'Goblin', 80, 100) },
      { ...resident('w-1', 'Goblin', 200, 100), badge: '!' },
      { ...resident('w-2', 'Goblin', 320, 100), badge: '!', faded: true },
    ],
  },
}

export const Builders: Story = {
  args: {
    sprites: [
      { key: 'b-0', name: 'Builder', x: 120, y: 160, fps: 8 },
      { key: 'b-1', name: 'Builder', x: 240, y: 160, fps: 8 },
    ],
  },
}

/** Carriers scale with distance and show their load on the return leg. */
export const Carriers: Story = {
  args: {
    sprites: [
      { key: 'c-0', name: 'Goblin', x: 100, y: 160, fps: 8, scale: 0.7 },
      { key: 'c-1', name: 'Goblin', x: 220, y: 160, fps: 8, scale: 1,   badge: '🌾', badgeColor: '#ffffff' },
      { key: 'c-2', name: 'Goblin', x: 340, y: 160, fps: 8, scale: 1.3, badge: '🪵', badgeColor: '#ffffff' },
    ],
  },
}

/** Everything at once, as the live city renders it. */
export const MixedCrowd: Story = {
  args: {
    sprites: [
      resident('w-0', 'Goblin',   60,  60),
      { ...resident('w-1', 'Skeleton', 160, 90), badge: '!' },
      { ...resident('w-2', 'Orc',      260, 60), faded: true, badge: '!' },
      resident('w-3', 'Dragon',   360, 90),
      { key: 'b-0', name: 'Builder', x: 140, y: 220, fps: 8 },
      { key: 'c-0', name: 'Goblin',  x: 300, y: 230, fps: 8, scale: 1.2, badge: '⛏', badgeColor: '#ffffff' },
    ],
  },
}

/** A name with no sprite art must not break the rest of the layer. */
export const MissingSprite: Story = {
  args: {
    sprites: [
      resident('w-0', 'Goblin', 160, 160),
      resident('w-1', 'Not A Real Unit Name', 240, 160),
      resident('w-2', 'Orc', 320, 160),
    ],
  },
}
