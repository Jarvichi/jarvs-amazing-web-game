import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { OverlayScreen } from './OverlayScreen';

const meta = {
  component: OverlayScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof OverlayScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Settings',
    onBack: fn(),
    children: 'Screen content goes here.',
  },
};

export const WithRight: Story = {
  args: {
    title: 'Collection',
    onBack: fn(),
    right: 'Filter ▾',
    children: 'Collection items would appear here.',
  },
};
