import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { QuestsScreen } from './QuestsScreen';

const meta = {
  component: QuestsScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof QuestsScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBack: fn(),
  },
};
