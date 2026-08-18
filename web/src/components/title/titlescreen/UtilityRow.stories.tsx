import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { UtilityRow } from './UtilityRow';

const meta = {
  component: UtilityRow,
  parameters: { layout: 'centered' },
  title: 'Title/UtilityRow',
} satisfies Meta<typeof UtilityRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onTraining: fn(), onMiniGames: fn() },
};
