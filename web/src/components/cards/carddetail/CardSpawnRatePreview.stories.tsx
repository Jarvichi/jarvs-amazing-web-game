import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardSpawnRatePreview } from './CardSpawnRatePreview';
import { exampleUnitTemplate } from '../../../game/types.sample';

const meta = {
  component: CardSpawnRatePreview,
} satisfies Meta<typeof CardSpawnRatePreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    unit: {
      ...exampleUnitTemplate,
      moveSpeed: 0,
      maxHp: 30,
      structureEffect: { type: 'spawn', unitTemplate: exampleUnitTemplate, intervalMs: 25000 },
    },
  },
};
