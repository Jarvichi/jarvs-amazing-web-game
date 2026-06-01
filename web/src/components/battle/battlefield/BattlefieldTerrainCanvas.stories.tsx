import React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { BattlefieldTerrainCanvas } from './BattlefieldTerrainCanvas'

const meta = {
  component: BattlefieldTerrainCanvas,
  parameters: { layout: 'centered' },
  decorators: [
    (Story: React.ComponentType) => (
      // Battlefield lane proportions: tall and narrow (rotated vertical combat area)
      <div style={{ width: 320, height: 560, position: 'relative', border: '1px solid #333' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BattlefieldTerrainCanvas>

export default meta
type Story = StoryObj<typeof meta>

export const Forest:   Story = { args: { environment: 'forest',   id: 'forest-test'   } }
export const Farmland: Story = { args: { environment: 'farmland', id: 'farmland-test' } }
export const Ruins:    Story = { args: { environment: 'ruins',    id: 'ruins-test'    } }
export const Ashen:    Story = { args: { environment: 'ashen',    id: 'ashen-test'    } }
export const Sand:     Story = { args: { environment: 'sand',     id: 'sand-test'     } }
export const Volcano:  Story = { args: { environment: 'volcano',  id: 'volcano-test'  } }
export const Citadel:  Story = { args: { environment: 'citadel',  id: 'citadel-test'  } }
export const Coast:    Story = { args: { environment: 'coast',    id: 'coast-test'    } }
export const Frost:    Story = { args: { environment: 'frost',    id: 'frost-test'    } }
export const Reef:     Story = { args: { environment: 'reef',     id: 'reef-test'     } }
export const Sky:      Story = { args: { environment: 'sky',      id: 'sky-test'      } }
