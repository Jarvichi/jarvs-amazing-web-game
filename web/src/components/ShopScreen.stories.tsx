import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ShopScreen } from './ShopScreen';

const meta = {
  component: ShopScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ShopScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    crystals: 250,
    onBuyCrystalPack: fn(),
    onBack: fn(),
    onCrystalsChange: fn(),
  },
};
