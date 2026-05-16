import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { TowerDefenceEndScreen, Props } from './EndScreen';
import { exampleTDGameState, exampleTowerPool } from '../../../game/types.sample';

const meta = {
  component: TowerDefenceEndScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TowerDefenceEndScreen>;

export default meta;

type Story = StoryObj<typeof meta>;



const defaultProps: Props = {

  game: exampleTDGameState,
    reward: 100,
    onDone: fn(),
    rewardLabel: '100 Gold',
};

export const Default: Story = {
  args: {
    ...defaultProps,
  },
};
