import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MerchantScreen, MerchantItem } from './MerchantScreen';
import { exampleCard, exampleUselessItem, exampleConsumableDef } from '../../game/types.sample';

const meta = {
  component: MerchantScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof MerchantScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

const sampleItems: MerchantItem[] = [
  { kind: 'card',       card: exampleCard,           price: 50 },
  { kind: 'item',       inventoryItem: exampleUselessItem, price: 30 },
  { kind: 'consumable', def: exampleConsumableDef,   price: 20 },
];

export const Default: Story = {
  args: {
    items: sampleItems,
    crystals: 120,
    onBuy: fn(),
    onDone: fn(),
  },
};

export const BrokePlayer: Story = {
  args: {
    items: sampleItems,
    crystals: 5,
    onBuy: fn(),
    onDone: fn(),
  },
};

export const CardsOnly: Story = {
  args: {
    items: [
      { kind: 'card', card: exampleCard, price: 40 },
      { kind: 'card', card: { ...exampleCard, id: 'c2', name: 'Archer', rarity: 'uncommon', cost: 2 }, price: 55 },
      { kind: 'card', card: { ...exampleCard, id: 'c3', name: 'Dragon', rarity: 'rare', cost: 5 }, price: 90 },
    ],
    crystals: 200,
    onBuy: fn(),
    onDone: fn(),
  },
};
