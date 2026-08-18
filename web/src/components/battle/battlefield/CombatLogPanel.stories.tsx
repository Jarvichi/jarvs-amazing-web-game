import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CombatLogPanel } from './CombatLogPanel';

const meta = {
  component: CombatLogPanel,
  parameters: { layout: 'centered' },
  title: 'Battle/CombatLogPanel',
  decorators: [(Story) => <div style={{ width: 340, height: 300, position: 'relative', background: '#0a0a0a' }}><Story /></div>],
} satisfies Meta<typeof CombatLogPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

const sampleEntries = [
  'Player deployed Goblin.',
  'Opponent deployed Archer.',
  '!!★ HERO Valeria unleashed by Player!',
  'Valeria destroyed Archer!',
  'Your AOE! 3 enemies hit for 42 damage.',
  'Player units healed 20 HP.',
  'Opponent upgraded Watchtower! (Lvl 2)',
  '💎 Crystal Golem cracked — half HP, double damage!',
];

export const Empty: Story = {
  args: { entries: [], open: true, onClose: fn() },
};

export const WithEntries: Story = {
  args: { entries: sampleEntries, open: true, onClose: fn() },
};

export const Closed: Story = {
  args: { entries: sampleEntries, open: false, onClose: fn() },
};
