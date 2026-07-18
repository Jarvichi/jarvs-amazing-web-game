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
// Millhaven). Matches what App.tsx's restrictedTownNodeIds would compute for
// that config: every other town is fogged, and so is every battle node whose
// only destination is one of those locked towns (Forest Path / Bridge Battle,
// which solely gate the locked Ironhold Keep) — while River Crossing stays
// open since it leads on to the unlocked Millhaven.
export const FoggedTowns: Story = {
  args: {
    onSelectNode: fn(),
    onBack:       fn(),
    onFeedback:   fn(),
    user:         null,
    restrictedNodeIds: new Set([
      'forest-path', 'bridge-battle', 'ironhold-keep', 'b-blight-fields',
      'gravemoor', 'b-grave-mists', 'b-crypt-road', 'hollowmere',
      'b-howling-dark', 'b-dread-gate', 'dreadspire-citadel', 'b-east-road',
      'appleford', 'b-orchard-raid', 'b-salt-marsh', 'saltmere-port',
      'b-pirate-cove', 'b-smugglers-landing', 'b-south-road', 'harrowfield',
      'b-scarecrow-fields', 'b-river-ford', 'b-royal-checkpoint',
      'capital-city', 'royal-palace', 'b-tournament', 'b-west-road',
      'b-mine-trouble', 'gearford', 'b-smoke-fields', 'b-foundry-gate',
      'b-bandit-toll',
    ]),
  },
}
