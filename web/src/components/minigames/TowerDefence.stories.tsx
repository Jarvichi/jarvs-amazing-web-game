import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { TowerDefence } from './TowerDefence';
import { exampleUnitTemplate } from "../../game/types.sample";

const meta = {
  component: TowerDefence,
} satisfies Meta<typeof TowerDefence>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    pool: [
      { template: exampleUnitTemplate, total: 10, buildingName: 'Goblin Camp' },
    ],
    mode: 'collection',
    "onDone": fn(),
  },
};