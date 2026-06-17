import type { Meta, StoryObj } from '@storybook/react-vite';

import { HubWeather } from './HubWeather';

const meta = {
  component: HubWeather,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof HubWeather>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Rain: Story = { args: { type: 'rain' } };
export const Snow: Story = { args: { type: 'snow' } };
export const Fog: Story = { args: { type: 'fog' } };
export const Clear: Story = { args: { type: 'clear' } };
