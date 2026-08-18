import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { HeroAction } from './HeroAction';

const meta = {
  component: HeroAction,
  parameters: { layout: 'centered' },
  title: 'Title/HeroAction',
} satisfies Meta<typeof HeroAction>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Campaign: Story = {
  args: { label: 'CAMPAIGN', locked: false, onClick: fn() },
};

export const ContinueRun: Story = {
  args: { label: 'CONTINUE RUN', locked: false, onClick: fn() },
};

export const Locked: Story = {
  args: {
    label: 'CAMPAIGN',
    locked: true,
    hint: 'Collect 12 more cards to unlock Campaign — play Quick Battle to earn cards!',
    onClick: fn(),
  },
};
