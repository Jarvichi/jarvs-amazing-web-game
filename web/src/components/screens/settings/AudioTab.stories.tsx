import type { Meta, StoryObj } from '@storybook/react-vite';

import { AudioTab } from './AudioTab';

const meta = {
  component: AudioTab,
  title: 'Settings/AudioTab',
  parameters: { layout: 'padded' },
} satisfies Meta<typeof AudioTab>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
