import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { EventScreen } from './EventScreen';
import type { EventData } from '../../game/questline';

const meta = {
  component: EventScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof EventScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

const exampleEvent: EventData = {
  id: 'shrine-of-plenty',
  title: 'Shrine of Plenty',
  description: 'You stumble upon a crumbling shrine. An inscription reads: "Give, and ye shall receive. Or not. The shrine makes no promises."',
  choices: [
    {
      label: 'Leave an offering',
      consequence: 'You feel slightly less wealthy.',
      effect: { type: 'damageHp', amount: 5 },
    },
    {
      label: 'Pray for guidance',
      consequence: 'The shrine glows warmly.',
      effect: { type: 'healHp', amount: 8 },
    },
    {
      label: 'Walk away',
      consequence: 'Nothing happens. The shrine watches.',
      effect: { type: 'nothing' },
    },
  ],
};

export const Default: Story = {
  args: {
    event: exampleEvent,
    onChoice: fn(),
    playerHp: 35,
    maxHp: 50,
  },
};

export const LowHp: Story = {
  args: {
    event: exampleEvent,
    onChoice: fn(),
    playerHp: 8,
    maxHp: 50,
  },
};
