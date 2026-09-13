import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { AutoBuildModal } from './AutoBuildModal';

const meta = {
  component: AutoBuildModal,
} satisfies Meta<typeof AutoBuildModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onSelect: fn(),
    onClose: fn(),
  },
};
