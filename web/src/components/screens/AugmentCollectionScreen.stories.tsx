import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { AugmentCollectionScreen } from './AugmentCollectionScreen';

const meta = {
  component: AugmentCollectionScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AugmentCollectionScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBack: fn(),
  },
};
