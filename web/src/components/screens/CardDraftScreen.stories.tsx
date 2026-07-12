import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardDraftScreen } from './CardDraftScreen';

const meta = {
  component: CardDraftScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CardDraftScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onComplete: fn(),
    onBack: fn(),
  },
};
