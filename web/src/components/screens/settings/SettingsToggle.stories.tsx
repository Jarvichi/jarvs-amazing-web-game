import { fn } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { SettingsToggle } from './SettingsToggle';

const meta = {
  component: SettingsToggle,
  title: 'Settings/SettingsToggle',
  parameters: { layout: 'centered' },
} satisfies Meta<typeof SettingsToggle>;

export default meta;

type Story = StoryObj<typeof meta>;

export const On: Story = {
  args: { checked: true, onChange: fn(), label: 'Sound' },
};

export const Off: Story = {
  args: { checked: false, onChange: fn(), label: 'Sound' },
};

export const Disabled: Story = {
  args: { checked: false, onChange: fn(), label: 'Sound', disabled: true },
};
