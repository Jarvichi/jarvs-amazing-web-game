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
// for that config: locations are fogged unless admin-enabled; battle nodes
// are fogged unless they're a requiredClears prerequisite (directly, or
// through an OR-alternative) for reaching an open town. Forest Path, Bridge
// Battle, and River Crossing stay visible/clickable — clearing one of the
// first two is Thornwood Camp's (and River Crossing's, and Millhaven's,
// independently) only requirement, not "reach Ironhold Keep" — while every
// other battle (Collapsed Mine, Salt Marsh Crossing, Bandit Toll, etc.),
// which serves only locked content, stays fogged along with the towns
// themselves.
export const FoggedTowns: Story = {
  args: {
    onSelectNode: fn(),
    onBack:       fn(),
    onFeedback:   fn(),
    user:         null,
    restrictedNodeIds: new Set([
      'appleford', 'b-bandit-toll', 'b-blight-fields', 'b-crypt-road',
      'b-dread-gate', 'b-east-road', 'b-foundry-gate', 'b-grave-mists',
      'b-howling-dark', 'b-mine-trouble', 'b-orchard-raid', 'b-pirate-cove',
      'b-river-ford', 'b-royal-checkpoint', 'b-salt-marsh',
      'b-scarecrow-fields', 'b-smoke-fields', 'b-smugglers-landing',
      'b-south-road', 'b-tournament', 'b-west-road', 'capital-city',
      'dreadspire-citadel', 'gearford', 'gravemoor', 'harrowfield',
      'hollowmere', 'ironhold-keep', 'royal-palace', 'saltmere-port',
    ]),
  },
}
