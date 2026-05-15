import { fn } from "storybook/test";
import type { Meta, StoryObj } from '@storybook/react-vite';

import { AchievementsScreen } from './AchievementsScreen';

const meta = {
  component: AchievementsScreen,
} satisfies Meta<typeof AchievementsScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "onBack": fn(),
    "onCrystalsChanged": fn()
  },
};