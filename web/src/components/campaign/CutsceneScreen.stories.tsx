import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CutsceneScreen } from './CutsceneScreen';
import type { CutscenePanel } from '../../game/questline';

const meta = {
  component: CutsceneScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CutsceneScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

const examplePanels: CutscenePanel[] = [
  {
    title: 'The Shattered Dominion',
    text: 'The land was once whole.\n\nNow the shards of the Dominion scatter across ruined battlefields, each one guarded by a warlord who has forgotten what peace looks like.',
  },
  {
    title: 'A Call to Arms',
    text: 'You are Jarv. You have a deck of cards and a burning desire to prove something.\n\nWhat exactly? Even you are not sure. But you march anyway.',
  },
];

export const Default: Story = {
  args: {
    panels: examplePanels,
    onDone: fn(),
  },
};
