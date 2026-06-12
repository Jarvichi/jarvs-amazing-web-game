import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ChronicleScreen } from './ChronicleScreen';

const meta = {
  component: ChronicleScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ChronicleScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBack: fn(),
  },
};
