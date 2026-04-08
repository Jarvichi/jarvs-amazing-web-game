import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { GiftAdminScreen } from './GiftAdminScreen';

const meta = {
  component: GiftAdminScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof GiftAdminScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBack: fn(),
  },
};
