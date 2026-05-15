import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { HeroCardsScreen } from './HeroCardsScreen';

const meta = {
  component: HeroCardsScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof HeroCardsScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onBack: fn(),
  },
};
