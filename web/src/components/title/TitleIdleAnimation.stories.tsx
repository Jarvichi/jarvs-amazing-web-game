import type { Meta, StoryObj } from '@storybook/react-vite';

import { TitleIdleAnimation } from './TitleIdleAnimation';

const meta = {
  component: TitleIdleAnimation,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TitleIdleAnimation>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
