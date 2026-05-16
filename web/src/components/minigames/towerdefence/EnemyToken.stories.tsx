import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { EnemyToken, Props } from './EnemyToken';
import { exampleTDGameState, exampleTowerPool } from '../../../game/types.sample';

const meta = {
  component: EnemyToken,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof EnemyToken>;

export default meta;

type Story = StoryObj<typeof meta>;



const defaultProps: Props = {
  enemy: exampleTDGameState.enemies[0],
};

export const Default: Story = {
  args: {
    ...defaultProps,
  },
};


export const Damaged: Story = {
  args: {
    enemy: { ...exampleTDGameState.enemies[0], hp: 3, maxHp: 10 },
  },
};

export const Shielded: Story = {
  args: {
    enemy: { ...exampleTDGameState.enemies[0], hp: 3, maxHp: 10, shielded: true },
  },
};

export const Dead: Story = {
  args: {
    enemy: { ...exampleTDGameState.enemies[0], hp: 0, maxHp: 10 },
  },
};

