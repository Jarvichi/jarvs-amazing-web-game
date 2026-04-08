import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CollectionScreen } from './CollectionScreen';

const meta = {
  component: CollectionScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CollectionScreen>;

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
