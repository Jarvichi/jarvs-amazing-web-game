import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { ReplayBriefingScreen } from './ReplayBriefingScreen';
import { exampleAct } from '../../game/types.sample';

const meta = {
  component: ReplayBriefingScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ReplayBriefingScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FirstTime: Story = {
  args: {
    act: exampleAct,
    completionCount: 0,
    onBegin: fn(),
    onBack: fn(),
  },
};

export const Replaying: Story = {
  args: {
    act: exampleAct,
    completionCount: 3,
    onBegin: fn(),
    onBack: fn(),
  },
};

export const AfterFailure: Story = {
  args: {
    act: exampleAct,
    completionCount: 1,
    lastRunFailed: true,
    onBegin: fn(),
    onBack: fn(),
  },
};
