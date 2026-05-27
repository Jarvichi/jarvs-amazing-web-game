import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CollectionTabScreen } from './CollectionTabScreen';

const meta = {
  component: CollectionTabScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CollectionTabScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    crystals: 250,
    onCrystalsChanged: fn(),
    onBack: fn(),
    commanderName: null,
    onPromoteCommander: fn(),
  },
};
