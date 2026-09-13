import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardMasteryBlock } from './CardMasteryBlock';
import { exampleUnitTemplate } from '../../../game/types.sample';

const meta = {
  component: CardMasteryBlock,
} satisfies Meta<typeof CardMasteryBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unit: Story = {
  args: {
    masteryLvl: 2,
    xp: 40,
    unit: exampleUnitTemplate,
  },
};

export const Elite: Story = {
  args: {
    masteryLvl: 5,
    xp: 155,
    unit: exampleUnitTemplate,
  },
};

export const Structure: Story = {
  args: {
    masteryLvl: 1,
    xp: 10,
    unit: { ...exampleUnitTemplate, moveSpeed: 0, isWall: true },
  },
};
