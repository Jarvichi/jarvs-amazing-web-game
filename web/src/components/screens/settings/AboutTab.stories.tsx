import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { AboutTab } from './AboutTab';

const meta = {
  component: AboutTab,
  title: 'Settings/AboutTab',
  parameters: { layout: 'padded' },
} satisfies Meta<typeof AboutTab>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithUpdateCheck: Story = {
  args: { onCheckForUpdates: fn(async () => {}) },
};
