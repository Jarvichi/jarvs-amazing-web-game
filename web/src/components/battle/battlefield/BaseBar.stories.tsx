import type { Meta, StoryObj } from '@storybook/react-vite';

import { BaseBar } from './BaseBar';
import { ManaBar } from './ManaBar';

const meta = {
  component: BaseBar,
  parameters: { layout: 'centered' },
  title: 'Battle/BaseBar',
  decorators: [(Story) => <div style={{ width: 320, background: '#0a0a0a', padding: 12 }}><Story /></div>],
} satisfies Meta<typeof BaseBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Opponent: Story = {
  args: {
    owner: 'opponent',
    portraitSrc: '/sprites/goblin.svg',
    portraitAlt: 'opponent',
    hp: 850,
    maxHp: 1000,
    color: '#ff4444',
    rightSlot: <span className="strategy-label">RUSH</span>,
  },
};

export const Player: Story = {
  args: {
    owner: 'player',
    portraitSrc: '/sprites/knight.svg',
    portraitAlt: 'player',
    hp: 1000,
    maxHp: 1000,
    color: '#33ff33',
    rightSlot: <>MANA 4/6 <ManaBar mana={4} maxMana={6} manaAccum={0.4} /></>,
  },
};

export const PlayerLowHp: Story = {
  args: {
    owner: 'player',
    portraitSrc: '/sprites/knight.svg',
    portraitAlt: 'player',
    hp: 120,
    maxHp: 1000,
    color: '#33ff33',
    rightSlot: <>MANA 2/6 <ManaBar mana={2} maxMana={6} manaAccum={0.1} /></>,
  },
};
