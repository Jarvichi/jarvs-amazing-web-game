import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CardSynergyPanel } from './CardSynergyPanel';

const meta = {
  component: CardSynergyPanel,
} satisfies Meta<typeof CardSynergyPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  args: {
    synergyGroups: [
      { id: 'undead', label: 'Undead Horde', icon: '💀', desc: 'Gains +1 ATK for each other undead unit in play.', tags: ['undead'], cards: [] },
    ],
    comboLinks: [
      { kind: 'spawns', partner: 'Goblin', detail: 'Spawns a Goblin every 9s' },
    ],
    expandedRow: null,
    onToggleRow: fn(),
  },
};

export const Expanded: Story = {
  args: {
    ...Collapsed.args,
    expandedRow: 'synergy',
  },
};
