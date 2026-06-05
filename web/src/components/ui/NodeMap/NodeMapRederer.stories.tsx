import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { NodeMapRederer } from './NodeMapRederer'
import { exampleAct, exampleRunState } from '../../../game/types.sample'
import { WORLD_MAP } from '../../../data/world/worldMapDef'

const meta = {
  component: NodeMapRederer,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NodeMapRederer>

export default meta
type Story = StoryObj<typeof meta>

// ── Campaign (grid) mode ──────────────────────────────────────────────────────

export const CampaignMode: Story = {
  args: {
    id: exampleAct.id,
    worldMap: exampleAct,
    run: exampleRunState,
    setPeekNode: fn(),
    showPaths: true,
  },
}

export const CampaignFreshRun: Story = {
  args: {
    id: exampleAct.id,
    worldMap: exampleAct,
    run: {
      ...exampleRunState,
      completedNodeIds: [],
      pendingNodeId: null,
    },
    setPeekNode: fn(),
    showPaths: true,
  },
}

// ── World (freeform) mode ─────────────────────────────────────────────────────

export const WorldMode: Story = {
  args: {
    id: 'hub-world',
    worldMap: WORLD_MAP,
    clearedNodeIds: new Set<string>(),
    mapWidth: 700,
    mapHeight: 520,
    setPeekNode: fn(),
    showPaths: false,
  },
}

export const WorldModeWithClears: Story = {
  args: {
    id: 'hub-world',
    worldMap: WORLD_MAP,
    clearedNodeIds: new Set(Object.keys(WORLD_MAP.nodes).slice(0, 2)),
    mapWidth: 700,
    mapHeight: 520,
    setPeekNode: fn(),
    showPaths: false,
  },
}
