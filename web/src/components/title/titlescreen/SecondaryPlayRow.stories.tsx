import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { SecondaryPlayRow } from './SecondaryPlayRow';
import { Icon } from '../../ui/icons/Icon';

const meta = {
  component: SecondaryPlayRow,
  parameters: { layout: 'centered' },
  title: 'Title/SecondaryPlayRow',
} satisfies Meta<typeof SecondaryPlayRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    quickBattleLabel: <><Icon name="sword" size={16} /> QUICK BATTLE</>,
    onQuickBattle: fn(),
    onEndless: fn(),
  },
};

export const DeckInvalid: Story = {
  args: {
    quickBattleLabel: '⚠ DECK (4/10)',
    quickBattleHint: 'Deck needs 6 more cards',
    onQuickBattle: fn(),
    onEndless: fn(),
  },
};

export const WithHub: Story = {
  args: {
    quickBattleLabel: <><Icon name="sword" size={16} /> QUICK BATTLE</>,
    onQuickBattle: fn(),
    onEndless: fn(),
    hubUnlocked: true,
    onHub: fn(),
  },
};
