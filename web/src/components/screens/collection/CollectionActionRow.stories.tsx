import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CollectionActionRow } from './CollectionActionRow';

const meta = {
  component: CollectionActionRow,
} satisfies Meta<typeof CollectionActionRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    totalExtras: 24,
    totalUpgradeable: 6,
    onDisenchantAll: fn(),
    onMasterAll: fn(),
  },
};

export const Hidden: Story = {
  args: {
    totalExtras: 0,
    totalUpgradeable: 0,
    onDisenchantAll: fn(),
    onMasterAll: fn(),
  },
};
