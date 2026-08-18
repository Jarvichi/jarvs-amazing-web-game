import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { TopBar } from './TopBar';

const meta = {
  component: TopBar,
  parameters: { layout: 'centered' },
  title: 'Battle/TopBar',
  decorators: [(Story) => <div style={{ width: 380, background: '#0a0a0a', padding: 12 }}><Story /></div>],
} satisfies Meta<typeof TopBar>;

export default meta;

type Story = StoryObj<typeof meta>;

const callbacks = { onToggleLog: fn(), onPause: fn() };

export const Default: Story = {
  args: {
    ...callbacks,
    timeStr: '2:14',
    suddenDeath: false,
    endlessMode: false,
    endlessTruceSecs: 0,
    playerScore: 3,
    opponentScore: 1,
    eventType: null,
    activeRelic: null,
    devMode: false,
    logAvailable: true,
    logOpen: false,
  },
};

export const EndlessWithTruce: Story = {
  args: {
    ...callbacks,
    timeStr: '5:02',
    suddenDeath: false,
    endlessMode: true,
    endlessWave: 4,
    endlessTruceSecs: 8,
    playerScore: 0,
    opponentScore: 0,
    eventType: null,
    activeRelic: null,
    devMode: false,
    logAvailable: true,
    logOpen: false,
  },
};

export const SuddenDeathWithEventAndRelic: Story = {
  args: {
    ...callbacks,
    timeStr: '3:00',
    suddenDeath: true,
    endlessMode: false,
    endlessTruceSecs: 0,
    playerScore: 2,
    opponentScore: 2,
    eventType: 'bloodMoon',
    activeRelic: { icon: '🗡️', name: 'Bloodied Edge', desc: 'Units deal +10% damage.' },
    devMode: true,
    logAvailable: true,
    logOpen: true,
  },
};
