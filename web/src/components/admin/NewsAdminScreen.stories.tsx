import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { NewsAdminScreen } from './NewsAdminScreen';

const meta = {
  component: NewsAdminScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof NewsAdminScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBack: fn(),
  },
};
