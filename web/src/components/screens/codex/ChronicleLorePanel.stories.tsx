import type { Meta, StoryObj } from '@storybook/react-vite';

import { ChronicleLorePanel } from './ChronicleLorePanel';

const meta = {
  component: ChronicleLorePanel,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ChronicleLorePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Unlocked: Story = {
  args: {
    entry: {
      id: 'chapter1',
      number: 1,
      title: 'The Fracture Begins',
      teaser: 'A single shard falls, and the world cracks with it.',
      lore: 'Long before the Dominion shattered, there was only the Vale.\n\nThen the sky split open.',
      unlocked: true,
    },
  },
};

export const Locked: Story = {
  args: {
    entry: {
      id: 'chapter1',
      number: 1,
      title: '',
      teaser: '',
      lore: '',
      unlocked: false,
    },
  },
};
