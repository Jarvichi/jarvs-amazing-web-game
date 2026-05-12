import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { TowerDefence } from './TowerDefence';
import { UnitTemplate } from "../../game/types";

const meta = {
  component: TowerDefence,
} satisfies Meta<typeof TowerDefence>;

export default meta;

type Story = StoryObj<typeof meta>;

const unitTemplate : UnitTemplate = {
  name: 'Goblin',
  attack: 5,
  maxHp: 10,
  isWall: false,
  bypassWall: false,
  moveSpeed: 1,
  attackRange: 1,
  attackCooldownMs: 1000
}

export const Default: Story = {
  args: {
    pool: [
      { template: unitTemplate, total: 10 },
    ],
    mode: 'collection',
    "onDone": fn(),
  },
};