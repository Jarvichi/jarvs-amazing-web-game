import { fn, within, userEvent, expect } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { SpeedClover } from './SpeedClover';

const meta = {
  component: SpeedClover,
  tags: ['ci'],
  parameters: { layout: 'centered' },
  title: 'Battle/SpeedClover',
  decorators: [(Story) => <div style={{ background: '#0a0a0a', padding: 12 }}><Story /></div>],
} satisfies Meta<typeof SpeedClover>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OneX: Story = {
  args: { speedMultiplier: 1, onSetSpeed: fn() },
};

export const TwoX: Story = {
  args: { speedMultiplier: 2, onSetSpeed: fn() },
};

export const FourX: Story = {
  args: { speedMultiplier: 4, onSetSpeed: fn() },
};

export const EightX: Story = {
  args: { speedMultiplier: 8, onSetSpeed: fn() },
};

// Same pattern as StanceBar.stories.tsx's expanded stories: clicking the tiny meter
// open should always yield 4 real petal buttons, one per speed option.
export const Expanded: Story = {
  args: { speedMultiplier: 2, onSetSpeed: fn() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /tap to change/i }))
    const group = await canvas.findByRole('group', { name: 'Speed' })
    expect(group.querySelectorAll('.stance-petal').length).toBe(4)
  },
};
