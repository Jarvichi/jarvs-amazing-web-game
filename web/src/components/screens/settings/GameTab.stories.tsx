import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { GameTab } from './GameTab';

const meta = {
  component: GameTab,
  title: 'Settings/GameTab',
  parameters: { layout: 'padded' },
} satisfies Meta<typeof GameTab>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onResetGame: fn() },
};
