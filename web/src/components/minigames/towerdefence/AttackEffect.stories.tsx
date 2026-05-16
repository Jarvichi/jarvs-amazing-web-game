import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { AttackEffect, Props } from './AttackEffect';
import { exampleTDAttackEvent, exampleTowerPool } from '../../../game/types.sample';

const meta = {
  component: AttackEffect,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AttackEffect>;

export default meta;

type Story = StoryObj<typeof meta>;



const defaultProps: Props = {
  ev: exampleTDAttackEvent,
};

export const Default: Story = {
  args: {
    ...defaultProps,
  },
};

export const Aoe: Story = {
  args: {
    ev: { ...exampleTDAttackEvent, aoeRadius: 48 },
  },
};

// Projectile Types - 'arrow' | 'fireball' | 'icebolt' | 'poisonblob' | 'magic' | 'lightning' | 'aoe'
export const Projectile_arrow: Story = {
  args: {
    ev: { ...exampleTDAttackEvent, projectileType: 'arrow' },
  },
};

export const Projectile_fireball: Story = {
  args: {
    ev: { ...exampleTDAttackEvent, projectileType: 'fireball' },
  },
};

export const Projectile_icebolt: Story = {
  args: {
    ev: { ...exampleTDAttackEvent, projectileType: 'icebolt' },
  },
};

export const Projectile_poisonblob: Story = {
  args: {
    ev: { ...exampleTDAttackEvent, projectileType: 'poisonblob' },
  },
};

export const Projectile_magic: Story = {
  args: {
    ev: { ...exampleTDAttackEvent, projectileType: 'magic' },
  },
};

export const Projectile_lightning: Story = {
  args: {
    ev: { ...exampleTDAttackEvent, projectileType: 'lightning' },
  },
};

export const Projectile_aoe: Story = {
  args: {
    ev: { ...exampleTDAttackEvent, projectileType: 'aoe', aoeRadius: 48 },
  },
};


