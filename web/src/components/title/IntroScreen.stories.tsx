import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { IntroScreen } from './IntroScreen';

const meta = {
  component: IntroScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof IntroScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
