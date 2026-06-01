import React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { CityTerrainCanvas } from './CityTerrainCanvas'

const meta = {
  component: CityTerrainCanvas,
  parameters: { layout: 'centered' },
  decorators: [
    (Story: React.ComponentType) => (
      // City grid proportions: roughly square, larger than battlefield
      <div style={{ width: 480, height: 480, position: 'relative', border: '1px solid #333' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CityTerrainCanvas>

export default meta
type Story = StoryObj<typeof meta>

export const Farmland: Story = { args: { environment: 'farmland', id: 'city-farmland' } }
export const Forest:   Story = { args: { environment: 'forest',   id: 'city-forest'   } }
export const Ruins:    Story = { args: { environment: 'ruins',    id: 'city-ruins'     } }
export const Ashen:    Story = { args: { environment: 'ashen',    id: 'city-ashen'     } }
export const Sand:     Story = { args: { environment: 'sand',     id: 'city-sand'      } }
export const Volcano:  Story = { args: { environment: 'volcano',  id: 'city-volcano'   } }
export const Citadel:  Story = { args: { environment: 'citadel',  id: 'city-citadel'   } }
export const Coast:    Story = { args: { environment: 'coast',    id: 'city-coast'     } }
export const Frost:    Story = { args: { environment: 'frost',    id: 'city-frost'     } }
