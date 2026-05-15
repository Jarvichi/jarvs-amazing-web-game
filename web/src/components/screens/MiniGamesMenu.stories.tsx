import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { MiniGamesMenu } from './MiniGamesMenu';

const meta = {
  component: MiniGamesMenu,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof MiniGamesMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    crystals: 100, 
    onCrystalsChange: fn(), 
    user: null, 
    characterName: 'Player 1', 
    onBack: fn(),
  },
};
