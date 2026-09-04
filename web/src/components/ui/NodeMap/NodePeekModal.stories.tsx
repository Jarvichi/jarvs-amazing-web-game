import { fn } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { NodePeekModal } from './NodePeekModal'
import type { QuestNode } from '../../../game/questline'

const meta = {
  component: NodePeekModal,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="game-container">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NodePeekModal>

export default meta
type Story = StoryObj<typeof meta>

const battleNode: QuestNode = {
  id: 'story-battle-1',
  type: 'battle',
  label: 'The Goblin Clearing',
  description: 'A scouting party guards the path forward.',
  row: 0,
  col: 0,
  rowCols: 1,
  childIds: [],
  enemyDeck: ['Goblin', 'Archer'],
  handicap: 2,
}

const townNode: QuestNode = {
  id: 'story-town-1',
  type: 'merchant',
  label: 'Millhaven',
  description: 'A quiet market town at the edge of the forest. Traders pass through here daily.',
  row: 0,
  col: 0,
  rowCols: 1,
  childIds: [],
}

const clearedBattleNode: QuestNode = {
  id: 'story-battle-2',
  type: 'battle',
  label: 'Thornwood Outpost',
  description: 'You have already driven off the defenders here.',
  row: 1,
  col: 0,
  rowCols: 1,
  childIds: [],
  enemyDeck: ['Goblin'],
  handicap: 1,
}

const lockedNode: QuestNode = {
  id: 'story-locked-1',
  type: 'battle',
  label: 'The Dark Citadel',
  description: 'A forbidding fortress. The path here is still blocked.',
  row: 2,
  col: 0,
  rowCols: 1,
  childIds: [],
  requiredClears: ['story-battle-1', 'story-battle-2'],
  handicap: 5,
}

// ── Campaign mode ─────────────────────────────────────────────────────────────

export const CampaignBattleNode: Story = {
  args: {
    node: battleNode,
    actId: 'example-act',
    nodeHistory: new Set(),
    activeModifiers: [],
    mode: 'campaign',
    onEnter: fn(),
    onClose: fn(),
  },
}

export const CampaignWithHistory: Story = {
  args: {
    node: battleNode,
    actId: 'example-act',
    nodeHistory: new Set(['example-act:story-battle-1']),
    activeModifiers: [
      { type: 'enemyHpPercent', value: 25, label: '+25% enemy HP' },
    ],
    mode: 'campaign',
    onEnter: fn(),
    onClose: fn(),
  },
}

const tieredNode: QuestNode = {
  ...battleNode,
  id: 'story-battle-tiered',
  enemyTier: 2,
}

/** Player's deck-power band matches the act's expectation — tier shown, no reason line. */
export const CampaignTierAtExpectedBand: Story = {
  args: {
    node: tieredNode,
    actId: 'example-act',
    nodeHistory: new Set(),
    activeModifiers: [],
    mode: 'campaign',
    playerBandTier: 2,
    expectedBand: 2,
    onEnter: fn(),
    onClose: fn(),
  },
}

/** A strong deck raises the effective tier above the node's authored one — the reason line is the point. */
export const CampaignTierRaisedByStrongDeck: Story = {
  args: {
    node: tieredNode,
    actId: 'example-act',
    nodeHistory: new Set(),
    activeModifiers: [],
    mode: 'campaign',
    playerBandTier: 4,
    expectedBand: 1,
    onEnter: fn(),
    onClose: fn(),
  },
}

/** A weaker-than-expected deck gets a tier of mercy. */
export const CampaignTierEasedForWeakDeck: Story = {
  args: {
    node: tieredNode,
    actId: 'example-act',
    nodeHistory: new Set(),
    activeModifiers: [],
    mode: 'campaign',
    playerBandTier: 1,
    expectedBand: 3,
    onEnter: fn(),
    onClose: fn(),
  },
}

// ── World mode ────────────────────────────────────────────────────────────────

export const WorldAvailableTown: Story = {
  args: {
    node: townNode,
    mode: 'world',
    isCleared: false,
    isAvailable: true,
    onEnter: fn(),
    onClose: fn(),
  },
}

export const WorldClearedBattle: Story = {
  args: {
    node: clearedBattleNode,
    mode: 'world',
    isCleared: true,
    isAvailable: true,
    onEnter: fn(),
    onClose: fn(),
  },
}

export const WorldLockedNode: Story = {
  args: {
    node: lockedNode,
    mode: 'world',
    isCleared: false,
    isAvailable: false,
    onEnter: fn(),
    onClose: fn(),
  },
}
