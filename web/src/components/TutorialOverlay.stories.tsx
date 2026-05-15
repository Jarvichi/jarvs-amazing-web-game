import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { TutorialOverlay } from './TutorialOverlay';

const meta = {
  component: TutorialOverlay,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TutorialOverlay>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    steps: [
      { title: 'Welcome!', body: 'This is your base. Protect it at all costs.' },
      { title: 'Play Cards', body: 'Drag cards from your hand to deploy units on the battlefield.' },
      { title: 'Earn Mana', body: 'Mana regenerates over time. Spend it on cards.' },
    ],
    onDone: fn(),
  },
};

export const SingleStep: Story = {
  args: {
    steps: [
      { title: 'Tip', body: 'Wall units block enemies — place them early to buy time.' },
    ],
    onDone: fn(),
  },
};
