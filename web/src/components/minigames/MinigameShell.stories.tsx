import type { Meta, StoryObj } from '@storybook/react-vite';

import { MinigameShell } from './MinigameShell';

const meta = {
  component: MinigameShell,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof MinigameShell>;

export default meta;

type Story = StoryObj<typeof meta>;

const body = (
  <div style={{ color: '#c8c8d8', padding: 24 }}>Game board goes here.</div>
);

export const Default: Story = {
  args: { title: 'TILE FLIP', icon: '🃏', children: body },
};

export const WithStat: Story = {
  args: { title: 'HIGHER OR LOWER', icon: '🎴', stat: 'Streak: 4 · Credits: 120', children: body },
};

export const NoIcon: Story = {
  args: { title: 'CRYSTAL CATCH', children: body },
};
