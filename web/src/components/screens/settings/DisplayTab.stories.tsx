import type { Meta, StoryObj } from '@storybook/react-vite';

import { DisplayTab } from './DisplayTab';

const meta = {
  component: DisplayTab,
  title: 'Settings/DisplayTab',
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DisplayTab>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
