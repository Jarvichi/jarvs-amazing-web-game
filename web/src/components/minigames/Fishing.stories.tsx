import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Fishing } from './Fishing';

const meta = {
  component: Fishing,
  parameters: { layout: 'fullscreen' },
  args: { onDone: fn() },
} satisfies Meta<typeof Fishing>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Hub-world mode: casts cost bait and catches go to the inventory. */
export const HubCatchMode: Story = { args: { rewardMode: 'catch' } };

export const LakeSpot: Story  = { args: { variant: 'lake' } };
export const CaveLake: Story  = { args: { variant: 'cave' } };
export const HarbourSpot: Story = { args: { variant: 'ocean' } };
