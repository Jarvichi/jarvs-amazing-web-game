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
    onBuyCrystalPack: fn<(qty: number) => void>(),
    onBack: fn(),
    onCrystalsChange: fn(),
  },
};

/** Tapped a specific hub NPC with a known sprite — the banner shows their
 *  sprite instead of the generic role emoji. */
export const TappedNpcWithSprite: Story = {
  args: {
    ...Default.args,
    category: 'cards',
    buildingId: 'card-shop',
    tappedNpc: { name: 'Vorn', dialogue: ["I only come out at night."], sprite: 'hub-npc-vorn' },
  },
};
