import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatUpgradeScreen } from './StatUpgradeScreen';

const meta = {
  component: StatUpgradeScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof StatUpgradeScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onSelect: fn(),
  },
};
