import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { BottomPanel, Props } from './BottomPanel';
import { exampleTDGameState, exampleTowerPool } from '../../../game/types.sample';

const meta = {
  component: BottomPanel,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BottomPanel>;

export default meta;

type Story = StoryObj<typeof meta>;



const defaultProps: Props = {
  lastLog: 'Welcome to Tower Defence!',
  canPlaceTowers: true,
  selected: null,
  selectedTower: null,
  pool: exampleTowerPool,
  game: exampleTDGameState,
  towerCost: fn().mockReturnValue(50),
  handleSelectUnit: fn(),
};

export const Default: Story = {
  args: {
    ...defaultProps,
  },
};

export const NoTowersAvailable: Story = {
  args: {
    ...defaultProps,
    pool: [],
  },
};

export const CannotAffordTowers: Story = {
  args: {
    ...defaultProps,
    canPlaceTowers: false,
  },
};

export const TowerSelected: Story = {
  args: {
    ...defaultProps,
    selected: exampleTowerPool[0].template,
  },
};