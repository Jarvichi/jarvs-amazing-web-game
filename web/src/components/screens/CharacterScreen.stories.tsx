import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CharacterScreen } from './CharacterScreen';

const meta = {
  component: CharacterScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CharacterScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onDone: fn(),
  },
};
