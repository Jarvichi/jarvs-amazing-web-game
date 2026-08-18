import type { Meta, StoryObj } from '@storybook/react-vite';

import { ManaBar } from './ManaBar';

const meta = {
  component: ManaBar,
  parameters: { layout: 'centered' },
  title: 'Battle/ManaBar',
  decorators: [(Story) => <div style={{ background: '#0a0a0a', padding: 12 }}><Story /></div>],
} satisfies Meta<typeof ManaBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { mana: 0, maxMana: 6, manaAccum: 0 },
};

export const Regenerating: Story = {
  args: { mana: 2, maxMana: 6, manaAccum: 0.6 },
};

export const Full: Story = {
  args: { mana: 6, maxMana: 6, manaAccum: 0 },
};

export const HighMaxMana: Story = {
  args: { mana: 7, maxMana: 10, manaAccum: 0.3 },
};
