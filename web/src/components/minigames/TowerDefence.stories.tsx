import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { TowerDefence } from './TowerDefence';
import { exampleTowerPool, exampleUnitTemplate } from "../../game/types.sample";

const meta = {
  component: TowerDefence,
} satisfies Meta<typeof TowerDefence>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    pool: exampleTowerPool,
    mode: 'collection',
    "onDone": fn(),
  },
};