import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { InventoryScreen } from './InventoryScreen';

const meta = {
  component: InventoryScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof InventoryScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBack: fn(),
    onCrystalsChanged: fn(),
  },
};
