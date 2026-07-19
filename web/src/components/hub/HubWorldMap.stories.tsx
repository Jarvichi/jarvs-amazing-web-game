import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { HubWorldMap } from './HubWorldMap'

const meta = {
  component: HubWorldMap,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HubWorldMap>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onSelectNode: fn(),
    onBack:       fn(),
    onFeedback:   fn(),
    user:         null,
  },
}

// Only Thornwood Camp is admin-enabled (plus the always-open Ravenwatch and
// Millhaven). Matches what App.tsx's restrictedTownNodeIds actually computes
// for that config: fog only ever covers locations (towns/castles/camps/
// ports), never battle nodes — so Forest Path and Bridge Battle stay fully
// visible and clickable (they have no locationKey and no requiredClears, so
// hiding them would strand Thornwood Camp's own requiredClears — which only
// needs one of those two battles cleared — behind fog with no way to satisfy
// it). Only Ironhold Keep itself (and every other non-enabled location) is
// fogged; the road into it fades into the fog since one endpoint is hidden.
export const FoggedTowns: Story = {
  args: {
    onSelectNode: fn(),
    onBack:       fn(),
    onFeedback:   fn(),
    user:         null,
    restrictedNodeIds: new Set([
      'ironhold-keep', 'gravemoor', 'hollowmere', 'dreadspire-citadel',
      'appleford', 'saltmere-port', 'harrowfield', 'capital-city',
      'royal-palace', 'gearford',
    ]),
  },
}
