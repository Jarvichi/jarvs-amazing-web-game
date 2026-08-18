import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { CityAlertBanner } from './CityAlertBanner';

const meta = {
  component: CityAlertBanner,
  parameters: { layout: 'centered' },
  title: 'Title/CityAlertBanner',
} satisfies Meta<typeof CityAlertBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onClick: fn() },
};
